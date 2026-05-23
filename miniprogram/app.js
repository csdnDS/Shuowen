const { loadHistoricalFonts } = require('./utils/historicalFonts');

// Detect environment to choose API base URL.
// In WeChat DevTools: __wxConfig.envVersion === 'develop'
// Production mini-program should point to the real HTTPS backend domain.
const DEV_API_BASE_URL = 'http://172.20.10.14:3001';

function resolveApiBase() {
  try {
    const env = __wxConfig && __wxConfig.envVersion;
    if (env === 'release') return 'https://api.shuowen.example.com';
    if (env === 'trial')   return DEV_API_BASE_URL;
  } catch (e) { /* __wxConfig not available outside DevTools */ }
  return DEV_API_BASE_URL;
}

App({
  globalData: {
    apiBaseUrl: resolveApiBase(),
    backendUnreachable: false
  },

  onLaunch() {
    loadHistoricalFonts(this.globalData.apiBaseUrl);
    this._checkBackend();
  },

  // Proactively ping the backend so all pages inherit connectivity status.
  async _checkBackend() {
    const url = this.globalData.apiBaseUrl + '/api/characters?limit=1';
    wx.request({
      url,
      timeout: 4000,
      success: (res) => {
        this.globalData.backendUnreachable = !(res.statusCode >= 200 && res.statusCode < 300);
      },
      fail: () => {
        this.globalData.backendUnreachable = true;
      }
    });
  }
});
