import { Router } from 'express';
import { getProgress, unlockCharacter, unlockRandomCharacter } from '../services/progressService.js';
import { asyncRoute, getOpenId } from '../utils/request.js';

export function createProgressRouter() {
  const router = Router();

  router.get('/progress', asyncRoute(async (req, res) => {
    const data = await getProgress(getOpenId(req));
    res.json(data);
  }));

  router.post('/progress/unlock', asyncRoute(async (req, res) => {
    const char = req.body?.char;
    const data = char
      ? await unlockCharacter(getOpenId(req), char)
      : await unlockRandomCharacter(getOpenId(req));
    res.json(data);
  }));

  return router;
}
