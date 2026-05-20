import { Router } from 'express';
import { buildHeatmap, saveCheckin } from '../services/heatmapService.js';
import { asyncRoute, getOpenId } from '../utils/request.js';

export function createHeatmapRouter() {
  const router = Router();

  router.get('/heatmap', asyncRoute(async (_req, res) => {
    const data = await buildHeatmap();
    res.json(data);
  }));

  router.post('/checkins', asyncRoute(async (req, res) => {
    const openid = getOpenId(req);
    if (!req.body.areaId) {
      return res.status(400).json({ message: '缺少打卡区域 areaId' });
    }
    const checkin = await saveCheckin(openid, req.body);
    return res.json({ ok: true, checkin });
  }));

  return router;
}
