import { Router } from 'express';
import { radicals } from '../data/seedData.js';
import { getCharacterStats } from '../repositories/characterRepository.js';
import { getMemoryStats } from '../repositories/userRepository.js';

export function createSystemRouter() {
  const router = Router();

  router.get('/stats', (_req, res) => {
    const characterStats = getCharacterStats();
    const memoryStats = getMemoryStats();
    res.json({
      characters: characterStats.total,
      richEntries: characterStats.richEntries,
      radicals: radicals.length,
      users: memoryStats.users,
      totalActivities: memoryStats.totalActivities,
      totalUnlocked: memoryStats.totalUnlocked,
      uptime: Math.floor(process.uptime())
    });
  });

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: Date.now() });
  });

  return router;
}
