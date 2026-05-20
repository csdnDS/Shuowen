import { getRedisClient } from '../db/redis.js';
import { getMemoryStats } from '../repositories/userRepository.js';

function maskOpenId(openid) {
  if (!openid || openid.length <= 8) return '说文用户';
  return `${openid.slice(0, 4)}****${openid.slice(-4)}`;
}

export async function updateLeaderboard(openid, unlockedCount) {
  const redis = await getRedisClient();
  if (!redis) return;

  try {
    await redis.zAdd('leaderboard:unlock', [{ score: unlockedCount, value: openid }]);
  } catch (error) {
    console.warn(`Redis leaderboard update failed: ${error.message}`);
  }
}

export async function getLeaderboard(limit = 20) {
  const redis = await getRedisClient();
  if (redis) {
    try {
      const rows = await redis.zRangeWithScores('leaderboard:unlock', 0, limit - 1, {
        REV: true
      });
      if (rows.length) {
        return rows.map((row, index) => ({
          rank: index + 1,
          openid: row.value,
          nickname: maskOpenId(row.value),
          unlockedCount: row.score
        }));
      }
    } catch (error) {
      console.warn(`Redis leaderboard read failed: ${error.message}`);
    }
  }

  return getMemoryStats().userProgressEntries
    .map(([openid, unlocked]) => ({
      openid,
      nickname: maskOpenId(openid),
      unlockedCount: unlocked.length
    }))
    .sort((a, b) => b.unlockedCount - a.unlockedCount)
    .slice(0, limit)
    .map((item, index) => ({ rank: index + 1, ...item }));
}
