import { Router } from 'express';
import { explainQuizAnswer, generateCharacterStory, generateDailyRecommendation } from '../services/aiService.js';
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

  router.get('/ai/status', asyncRoute(async (_req, res) => {
    res.json({
      provider: 'deepseek',
      configured: Boolean(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY),
      model: process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL || 'deepseek-v4-flash'
    });
  }));

  return router;
}
