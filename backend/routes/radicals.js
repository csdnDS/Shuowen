import { Router } from 'express';
import { listRadicals } from '../repositories/radicalRepository.js';
import { asyncRoute } from '../utils/request.js';

export function createRadicalRouter() {
  const router = Router();

  router.get('/radicals', asyncRoute(async (_req, res) => {
    const data = await listRadicals();
    res.json(data);
  }));

  return router;
}
