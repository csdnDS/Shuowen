const { loadHistoricalFonts } = require('./utils/historicalFonts');
const { apiBaseCandidates } = require('./config');

const API_BASE_CANDIDATES = apiBaseCandidates
  .map((baseUrl) => String(baseUrl || '').replace(/\/$/, ''))
  .filter(Boolean);

const BACKEND_STORAGE_KEY = 'shuowenApiBaseUrl';

function uniq(items) {
  return [...new Set(items.filter(Boolean))];
}

function pingBackend(baseUrl, timeout = 2500) {
  return new Promise((resolve) => {
    if (!baseUrl) {
      resolve(false);
      return;
    }
    wx.request({
      url: `${baseUrl}/api/health`,
      timeout,
      success(res) {
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      },
      fail() {
        resolve(false);
      }
    });
  });
}

App({
  globalData: {
    apiBaseCandidates: API_BASE_CANDIDATES,
    apiBaseUrl: API_BASE_CANDIDATES[0] || '',
    backendUnreachable: false,
    backendReadyPromise: null
  },

  onLaunch() {
    this.globalData.backendReadyPromise = this.ensureBackendBase();
  },

  async ensureBackendBase(options = {}) {
    const preferred = String(options.preferred || '').replace(/\/$/, '');
    const candidates = uniq([
      ...(this.globalData.apiBaseCandidates || [])
    ]);
    const saved = String(wx.getStorageSync(BACKEND_STORAGE_KEY) || '').replace(/\/$/, '');
    const orderedCandidates = uniq([
      preferred,
      ...candidates,
      saved
    ]);

    for (const baseUrl of orderedCandidates) {
      const ok = await pingBackend(baseUrl, options.timeout || 2500);
      if (ok) {
        this.globalData.apiBaseUrl = baseUrl;
        this.globalData.backendUnreachable = false;
        wx.setStorageSync(BACKEND_STORAGE_KEY, baseUrl);
        loadHistoricalFonts(baseUrl);
        return baseUrl;
      }
    }

    this.globalData.backendUnreachable = true;
    return this.globalData.apiBaseUrl;
  }
});
