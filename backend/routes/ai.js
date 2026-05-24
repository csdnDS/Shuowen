import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { answerCharacterQuestion, explainQuizAnswer, generateCharacterStory, generateDailyRecommendation, generateLearningPath, synthesizeSpeech, transcribeSpeech } from '../services/aiService.js';
import { asyncRoute, getOpenId } from '../utils/request.js';

export function createAiRouter() {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }
  });

  router.get('/ai/story/:char', asyncRoute(async (req, res) => {
    const data = await generateCharacterStory(req.params.char);
    res.json(data);
  }));

  router.get('/ai/daily', asyncRoute(async (req, res) => {
    const data = await generateDailyRecommendation(getOpenId(req));
    res.json(data);
  }));

  router.get('/ai/learning-path', asyncRoute(async (req, res) => {
    const data = await generateLearningPath(getOpenId(req));
    res.json(data);
  }));

  router.post('/ai/quiz/explain', asyncRoute(async (req, res) => {
    const data = await explainQuizAnswer(
      req.body?.char,
      req.body?.chosen,
      Boolean(req.body?.isCorrect)
    );
    res.json(data);
  }));

  router.post('/ai/ask', asyncRoute(async (req, res) => {
    const data = await answerCharacterQuestion(req.body?.char, req.body?.question);
    res.json(data);
  }));

  router.post('/ai/tts', asyncRoute(async (req, res) => {
    const data = await synthesizeSpeech(req.body?.text);
    res.json(data);
  }));

  router.get('/ai/tts/audio', asyncRoute(async (req, res) => {
    const data = await synthesizeSpeech(req.query?.text);
    const audio = Buffer.from(data.audioBase64, 'base64');
    res.set({
      'Content-Type': data.mimeType || 'audio/mpeg',
      'Content-Length': String(audio.length),
      'Cache-Control': 'no-store'
    });
    res.end(audio);
  }));

  router.post('/ai/asr', upload.single('audio'), asyncRoute(async (req, res) => {
    const audioBuffer = req.file?.buffer || (
      req.body?.audioBase64
        ? Buffer.from(req.body.audioBase64, 'base64')
        : null
    );
    const data = await transcribeSpeech(audioBuffer, {
      format: req.body?.format
    });
    res.json(data);
  }));

  router.get('/ai/status', asyncRoute(async (_req, res) => {
    res.json({
      provider: 'deepseek',
      configured: Boolean(env.deepseekApiKey),
      model: env.deepseekModel,
      tts: {
        provider: 'xfyun',
        configured: Boolean(env.xfyunTtsAppId && env.xfyunTtsApiKey && env.xfyunTtsApiSecret),
        voice: env.xfyunTtsVoice
      },
      asr: {
        provider: 'xfyun',
        configured: Boolean(env.xfyunAsrAppId && env.xfyunAsrApiKey && env.xfyunAsrApiSecret)
      }
    });
  }));

  return router;
}
