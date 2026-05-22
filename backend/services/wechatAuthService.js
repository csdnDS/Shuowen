import { env } from '../config/env.js';

const PLACEHOLDER_VALUES = new Set([
  '',
  'your-wechat-appid',
  'your-wechat-secret'
]);

function hasWechatCredentials() {
  return !PLACEHOLDER_VALUES.has(env.wxAppId) && !PLACEHOLDER_VALUES.has(env.wxSecret);
}

function createDevOpenId(code) {
  const suffix = String(code || 'openid').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'openid';
  return `dev-${suffix}`;
}

export async function resolveWechatLogin(code) {
  const cleanCode = String(code || '').trim();
  if (!cleanCode) {
    const error = new Error('缺少微信登录 code');
    error.statusCode = 400;
    throw error;
  }

  if (!hasWechatCredentials()) {
    return {
      openid: createDevOpenId(cleanCode),
      authMode: 'dev',
      configured: false
    };
  }

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', env.wxAppId);
  url.searchParams.set('secret', env.wxSecret);
  url.searchParams.set('js_code', cleanCode);
  url.searchParams.set('grant_type', 'authorization_code');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json();

    if (!response.ok || data.errcode || !data.openid) {
      const message = data.errmsg || `微信登录失败 (${response.status})`;
      const error = new Error(message);
      error.statusCode = 401;
      error.wechatError = data;
      throw error;
    }

    return {
      openid: data.openid,
      unionid: data.unionid || '',
      authMode: 'wechat',
      configured: true
    };
  } finally {
    clearTimeout(timer);
  }
}
