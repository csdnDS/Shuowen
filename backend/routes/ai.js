import { Router } from 'express';
import { env } from '../config/env.js';
import { answerCharacterQuestion, explainQuizAnswer, generateCharacterStory, generateDailyRecommendation } from '../services/aiService.js';
import { asyncRoute, getOpenId } from '../utils/request.js';

export function createAiRouter() {
  const router = Router();

  router.get('/ai/story/:char', asyncRoute(async (req, res) => {
    const data = await generateCharacterStory(req.params.char);
    res.json(data);
  }));

  router.get('/ai/daily', asyncRoute(async (req, res) => {
    const data = await generateDailyRecommendation(getOpenId(req));
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

  router.get('/ai/status', asyncRoute(async (_req, res) => {
    res.json({
      provider: 'deepseek',
      configured: Boolean(env.deepseekApiKey),
      model: env.deepseekModel
    });
  }));

  return router;
}
