/**
 * Network request utility with timeout, token injection, and error normalization.
 *
 * Backend base URL comes from app.globalData.apiBaseUrl. The 'x-openid' header
 * carries the user token persisted in local storage. When the backend is
 * unreachable the rejected error carries `.code` ('TIMEOUT'/'NETWORK'/...) so
 * callers can choose to fall back to local placeholders.
 */

const { ensureToken } = require('./auth');

const DEFAULT_TIMEOUT = 8000;
const RETRYABLE_CODES = new Set(['TIMEOUT', 'NETWORK', 'UNKNOWN']);

function wxRequest(params) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...params,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        const err = new Error(
          (res.data && res.data.message) || `请求失败 (${res.statusCode})`
        );
        err.code = 'HTTP_' + res.statusCode;
        err.statusCode = res.statusCode;
        reject(err);
      },
      fail(rawErr) {
        const message = rawErr.errMsg || '网络请求失败';
        const err = new Error(message);
        if (/timeout/i.test(message)) err.code = 'TIMEOUT';
        else if (/fail/i.test(message)) err.code = 'NETWORK';
        else err.code = 'UNKNOWN';
        reject(err);
      }
    });
  });
}

async function request(path, method = 'GET', data = {}, options = {}) {
  const app = getApp();
  if (app && app.globalData && app.globalData.backendReadyPromise && !options.skipBackendReady) {
    await app.globalData.backendReadyPromise.catch(() => '');
  }
  const baseUrl = (app && app.globalData && app.globalData.apiBaseUrl) || '';
  if (!baseUrl) {
    const err = new Error('后端地址未配置');
    err.code = 'CONFIG';
    throw err;
  }
  let token = wx.getStorageSync('token') || '';

  if (!token && !options.skipAuth && path !== '/api/auth/wechat') {
    try {
      token = await ensureToken();
    } catch (_err) {
      token = wx.getStorageSync('token') || '';
    }
  }

  const header = Object.assign(
    {
      'content-type': 'application/json',
      'x-openid': token
    },
    options.header || {}
  );
  const params = {
    url: `${baseUrl}${path}`,
    method,
    data,
    timeout: options.timeout || DEFAULT_TIMEOUT,
    header
  };

  return wxRequest(params);
}

async function getReadyApiBaseUrl() {
  const app = getApp();
  if (app && app.globalData && app.globalData.backendReadyPromise) {
    await app.globalData.backendReadyPromise.catch(() => '');
  }
  return (app && app.globalData && app.globalData.apiBaseUrl) || '';
}

function shouldRetryBackend(err) {
  return Boolean(err && RETRYABLE_CODES.has(err.code));
}

module.exports = {
  request,
  DEFAULT_TIMEOUT,
  getReadyApiBaseUrl,
  shouldRetryBackend
};
