import { Router } from 'express';
import { getGlyphCoverage } from '../services/glyphCoverageService.js';
import { asyncRoute } from '../utils/request.js';

export function createGlyphCoverageRouter() {
  const router = Router();

  router.get('/glyph-coverage', asyncRoute(async (_req, res) => {
    const data = await getGlyphCoverage();
    res.json(data);
  }));

  return router;
}
