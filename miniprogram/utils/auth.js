let pendingTokenRequest = null;

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (res.code) resolve(res.code);
        else reject(new Error('微信登录未返回 code'));
      },
      fail: reject
    });
  });
}

function postWechatAuth(code, profile = {}) {
  const app = getApp();
  const baseUrl = (app && app.globalData && app.globalData.apiBaseUrl) || '';

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}/api/auth/wechat`,
      method: 'POST',
      data: {
        code,
        nickname: profile.nickname || '说文访客',
        avatarUrl: profile.avatarUrl || ''
      },
      timeout: 8000,
      header: {
        'content-type': 'application/json'
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.token) {
          resolve(res.data);
          return;
        }
        reject(new Error((res.data && res.data.message) || `登录失败 (${res.statusCode})`));
      },
      fail(err) {
        reject(new Error(err.errMsg || '登录请求失败'));
      }
    });
  });
}

async function ensureToken() {
  const existing = wx.getStorageSync('token');
  if (existing) return existing;

  if (!pendingTokenRequest) {
    pendingTokenRequest = (async () => {
      const code = await wxLogin();
      const data = await postWechatAuth(code);
      wx.setStorageSync('token', data.token);
      return data.token;
    })().finally(() => {
      pendingTokenRequest = null;
    });
  }

  return pendingTokenRequest;
}

async function loginWithProfile(profile) {
  const code = await wxLogin();
  const data = await postWechatAuth(code, profile);
  wx.setStorageSync('token', data.token);
  return data;
}

module.exports = {
  ensureToken,
  loginWithProfile
};
