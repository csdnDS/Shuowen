import { Router } from 'express';
import { TOTAL_SHUOWEN_COUNT } from '../data/seedData.js';
import { findUser, getUserUnlocked, listActivities, recordActivity, saveUser } from '../repositories/userRepository.js';
import { asyncRoute, getOpenId } from '../utils/request.js';

export function createAuthRouter() {
  const router = Router();

  router.post('/auth/wechat', asyncRoute(async (req, res) => {
    const openid = req.body.openid || `dev-${req.body.code || 'openid'}`;
    const profile = await saveUser({
      openid,
      nickname: req.body.nickname || '说文访客',
      avatarUrl: req.body.avatarUrl || ''
    });
    await recordActivity(openid, 'login', { source: 'miniprogram' });

    res.json({
      token: openid,
      user: profile
    });
  }));

  router.get('/me', asyncRoute(async (req, res) => {
    const openid = getOpenId(req);
    const user = (await findUser(openid)) || {
      openid,
      nickname: '说文访客',
      avatarUrl: ''
    };
    const unlocked = await getUserUnlocked(openid);
    const activities = await listActivities(openid);

    res.json({
      user,
      stats: {
        total: TOTAL_SHUOWEN_COUNT,
        unlockedCount: unlocked.length,
        activityCount: activities.length
      },
      activities
    });
  }));

  return router;
}
