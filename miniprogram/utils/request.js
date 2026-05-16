/**
 * Network request utility with timeout, token injection, and error normalization.
 *
 * Backend base URL comes from app.globalData.apiBaseUrl. The 'x-openid' header
 * carries the user token persisted in local storage. When the backend is
 * unreachable the rejected error carries `.code` ('TIMEOUT'/'NETWORK'/...) so
 * callers can choose to fall back to local placeholders.
 */

const DEFAULT_TIMEOUT = 8000;

function request(path, method = 'GET', data = {}, options = {}) {
  const app = getApp();
  const token = wx.getStorageSync('token') || '';
  const baseUrl = (app && app.globalData && app.globalData.apiBaseUrl) || '';

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}${path}`,
      method,
      data,
      timeout: options.timeout || DEFAULT_TIMEOUT,
      header: Object.assign(
        {
          'content-type': 'application/json',
          'x-openid': token
        },
        options.header || {}
      ),
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const err = new Error(
            (res.data && res.data.message) || `请求失败 (${res.statusCode})`
          );
          err.code = 'HTTP_' + res.statusCode;
          err.statusCode = res.statusCode;
          reject(err);
        }
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

module.exports = {
  request,
  DEFAULT_TIMEOUT
};
