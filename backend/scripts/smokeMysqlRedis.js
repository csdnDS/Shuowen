import { cacheDel } from '../db/redis.js';
import { closeMysqlPool } from '../db/mysql.js';
import { closeRedisClient } from '../db/redis.js';
import { buildHeatmap, saveCheckin } from '../services/heatmapService.js';
import { getLeaderboard } from '../services/leaderboardService.js';
import { getProgress, unlockRandomCharacter } from '../services/progressService.js';
import { findUser, listActivities, saveUser } from '../repositories/userRepository.js';

async function main() {
  const openid = `smoke-${Date.now()}`;

  const user = await saveUser({
    openid,
    nickname: '冒烟测试用户',
    avatarUrl: ''
  });

  const beforeProgress = await getProgress(openid);
  const unlock = await unlockRandomCharacter(openid);
  const afterProgress = await getProgress(openid);

  const checkin = await saveCheckin(openid, {
    areaId: 'zisheng',
    areaName: '字圣殿',
    lat: 33.58,
    lng: 114.02
  });
  await cacheDel('heatmap:current');
  const heatmap = await buildHeatmap();
  const leaderboard = await getLeaderboard(10);
  const activities = await listActivities(openid);
  const storedUser = await findUser(openid);

  console.log(JSON.stringify({
    ok: true,
    user,
    storedUser,
    beforeProgress,
    unlock,
    afterProgress,
    checkin,
    heatmapSample: heatmap.slice(0, 2),
    leaderboardSample: leaderboard.slice(0, 5),
    activities: activities.slice(0, 5)
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([
      closeMysqlPool(),
      closeRedisClient()
    ]);
  });
