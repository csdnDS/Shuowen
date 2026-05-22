import { Router } from 'express';
import { TOTAL_SHUOWEN_COUNT } from '../data/seedData.js';
import { findUser, getUserUnlocked, listActivities, recordActivity, saveUser } from '../repositories/userRepository.js';
import { resolveWechatLogin } from '../services/wechatAuthService.js';
import { asyncRoute, getOpenId } from '../utils/request.js';

export function createAuthRouter() {
  const router = Router();

  router.post('/auth/wechat', asyncRoute(async (req, res) => {
    const login = await resolveWechatLogin(req.body?.code);
    const openid = login.openid;
    const profile = await saveUser({
      openid,
      nickname: req.body.nickname || '说文访客',
      avatarUrl: req.body.avatarUrl || ''
    });
    await recordActivity(openid, 'login', {
      source: 'miniprogram',
      authMode: login.authMode,
      configured: login.configured
    });

    res.json({
      token: openid,
      user: profile,
      authMode: login.authMode,
      configured: login.configured
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
