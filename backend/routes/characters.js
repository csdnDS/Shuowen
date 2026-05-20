import { Router } from 'express';
import { TOTAL_SHUOWEN_COUNT } from '../data/seedData.js';
import { findCharacter, listCharacters, listWorks } from '../repositories/characterRepository.js';
import { signAssets } from '../services/assetService.js';
import { asyncRoute } from '../utils/request.js';

async function attachStageAssetUrls(req, character) {
  const keys = (character.stages || [])
    .map((stage) => stage.assetKey)
    .filter(Boolean);

  if (!keys.length) return character;

  const signed = await signAssets(req, keys, 3600);
  const byKey = new Map(signed.assets.map((asset) => [asset.key, asset]));

  return {
    ...character,
    stages: character.stages.map((stage) => {
      if (!stage.assetKey) return stage;
      const asset = byKey.get(stage.assetKey);
      if (!asset) return stage;
      return {
        ...stage,
        assetUrl: asset.url,
        assetProvider: asset.provider,
        assetEnabled: asset.enabled
      };
    })
  };
}

export function createCharacterRouter() {
  const router = Router();

  router.get('/characters', asyncRoute(async (req, res) => {
    const data = await listCharacters(req.query.q || '', Number(req.query.limit) || 80);
    res.json({
      total: TOTAL_SHUOWEN_COUNT,
      returned: data.length,
      items: data
    });
  }));

  router.get('/characters/:char', asyncRoute(async (req, res) => {
    const char = [...req.params.char][0];
    const data = await findCharacter(char);

    if (!data) {
      return res.status(404).json({ message: '未找到该汉字的演变数据' });
    }

    return res.json(await attachStageAssetUrls(req, data));
  }));

  router.get('/works', asyncRoute(async (_req, res) => {
    const data = await listWorks();
    res.json(data);
  }));

  return router;
}
