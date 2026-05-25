import { closeMysqlPool } from '../db/mysql.js';
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

  const activities = await listActivities(openid);
  const storedUser = await findUser(openid);

  console.log(JSON.stringify({
    ok: true,
    user,
    storedUser,
    beforeProgress,
    unlock,
    afterProgress,
    activities: activities.slice(0, 5)
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMysqlPool();
  });
