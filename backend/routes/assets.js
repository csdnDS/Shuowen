import { Router } from 'express';
import { signAsset, signAssets } from '../services/assetService.js';
import { asyncRoute } from '../utils/request.js';

export function createAssetRouter() {
  const router = Router();

  router.get('/oss/signature', asyncRoute(async (req, res) => {
    const asset = await signAsset(req, req.query.key, req.query.expires);
    return res.json(asset);
  }));

  router.post('/oss/signatures', asyncRoute(async (req, res) => {
    const result = await signAssets(req, req.body.keys, req.body.expires);
    return res.json(result);
  }));

  return router;
}
