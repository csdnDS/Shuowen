const { request } = require('../../utils/request');
const { loginWithProfile } = require('../../utils/auth');
const fallback = require('../../utils/fallback');
const glyphs = require('../../data/glyphs');
const { getUserSettings, saveUserSettings, getPageClass, applyThemeChrome, getQuizMistakes, clearQuizMistakes } = require('../../utils/settings');

function pad(v) { return `${v}`.padStart(2, '0'); }

function formatTime(value) {
  const d = new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function levelFor(count) {
  if (count >= 300) return { name: '通识', hint: '已达最高「通识」阶段' };
  if (count >= 100) return { name: '入门', hint: `再解 ${300 - count} 字达「通识」` };
  if (count >= 30)  return { name: '初学', hint: `再解 ${100 - count} 字达「入门」` };
  return { name: '初识', hint: `再解 ${30 - count} 字达「初学」` };
}

function enrichChar(char) {
  const entry = glyphs.byChar[char] || {};
  return {
    char,
    pinyin: entry.pinyin || '',
    radical: entry.radical || '其他',
    meaning: entry.meaning || ''
  };
}

function groupByRadical(items) {
  const groups = [];
  const index = {};
  items.forEach((item) => {
    const key = item.radical || '其他';
    if (!index[key]) {
      index[key] = { radical: key, count: 0, items: [] };
      groups.push(index[key]);
    }
    index[key].items.push(item);
    index[key].count += 1;
  });
  return groups.slice(0, 8);
}

Page({
  data: {
    isLoggedIn: false,
    user: {
      nickname: '说文访客',
      avatarUrl: ''
    },
    userInitial: '说',
    pageClass: '',
    stats: {
      total: 9353,
      unlockedCount: 0,
      streakDays: 0,
      todayCount: 0,
      bookmarkCount: 0
    },
    progressPercent: '0.00',
    levelName: '初识',
    levelHint: '',
    bookmarks: [],
    bookmarkGroups: [],
    recentViews: [],
    hasRecentViews: false,
    hasBookmarks: false,
    mistakesPreview: [],
    hasMistakes: false,
    settings: {
      fontSize: 'medium',
      theme: 'light'
    },
    loading: false,
    offline: false
  },

  onLoad() {
    this._loadLocalState();
    this._fetchMe();
  },

  onShow() {
    this._loadLocalState();
  },

  // ── Local state (works offline) ────────────────────────────

  _loadLocalState() {
    const rawBookmarks = wx.getStorageSync('bookmarks') || [];
    const bookmarks = rawBookmarks.map(enrichChar);
    const rawRecent = wx.getStorageSync('recentViews') || [];
    const recentViews = rawRecent
      .map((item) => enrichChar(item.char || item))
      .slice(0, 10);
    const streakState = wx.getStorageSync('streakState') || { lastDay: '', days: 0, todayCount: 0 };
    const today = new Date().toDateString();
    const streakDays = streakState.lastDay === today ? streakState.days : 0;
    const todayCount = streakState.lastDay === today ? streakState.todayCount : 0;
    const settings = getUserSettings();
    applyThemeChrome(settings);
    const mistakes = getQuizMistakes().slice(0, 5);
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');

    this.setData({
      bookmarks,
      bookmarkGroups: groupByRadical(bookmarks),
      recentViews,
      hasRecentViews: recentViews.length > 0,
      hasBookmarks: bookmarks.length > 0,
      mistakesPreview: mistakes,
      hasMistakes: mistakes.length > 0,
      'stats.bookmarkCount': bookmarks.length,
      'stats.streakDays': streakDays,
      'stats.todayCount': todayCount,
      settings,
      pageClass: getPageClass(settings),
      isLoggedIn: Boolean(token && userInfo),
      user: userInfo || this.data.user,
      userInitial: (userInfo && userInfo.nickname) ? Array.from(userInfo.nickname)[0] : '说'
    });
  },

  // ── Backend stats (with fallback) ──────────────────────────

  async _fetchMe() {
    this.setData({ loading: true });
    try {
      const data = await request('/api/me');
      this._applyStats(data.stats || {});
      if (data.user) this.setData({ user: data.user });
      this.setData({ offline: false });
    } catch (err) {
      this._applyStats(fallback.me.stats);
      this.setData({ offline: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  _applyStats(stats) {
    const total = stats.total || 9353;
    const count = stats.unlockedCount || 0;
    const percent = Math.min(100, (count / total) * 100).toFixed(2);
    const lvl = levelFor(count);
    this.setData({
      'stats.total': total,
      'stats.unlockedCount': count,
      progressPercent: percent,
      levelName: lvl.name,
      levelHint: lvl.hint
    });
  },

  // ── Real WeChat login flow ──────────────────────────────────

  async wechatLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      // 1. Get user profile (avatar + nickname). Requires user gesture.
      let profile;
      try {
        profile = await new Promise((resolve, reject) => {
          wx.getUserProfile({
            desc: '用于完善学习档案',
            success: resolve,
            fail: reject
          });
        });
      } catch (e) {
        // User declined. Continue with default placeholders.
        profile = { userInfo: { nickName: '说文用户', avatarUrl: '' } };
      }

      const userInfo = {
        nickname: profile.userInfo.nickName,
        avatarUrl: profile.userInfo.avatarUrl
      };

      // 2. Try exchanging code with backend; otherwise fall back to local-only
      try {
        const data = await loginWithProfile(userInfo);
        if (data.token) wx.setStorageSync('token', data.token);
      } catch (err) {
        // Backend unreachable — keep local login state only
        wx.setStorageSync('token', `local-${Date.now()}`);
      }

      wx.setStorageSync('userInfo', userInfo);
      this.setData({
        isLoggedIn: true,
        user: userInfo,
        userInitial: Array.from(userInfo.nickname)[0] || '说'
      });
      wx.showToast({ title: '登录成功', icon: 'success' });
      this._fetchMe();
    } catch (err) {
      wx.showToast({ title: '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确认退出当前帐号？本地学习记录不会被清除。',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          this.setData({
            isLoggedIn: false,
            user: { nickname: '说文访客', avatarUrl: '' },
            userInitial: '说'
          });
        }
      }
    });
  },

  // ── Navigation ──────────────────────────────────────────────

  goLearning()  { wx.switchTab({ url: '/pages/progress/progress' }); },
  goEvolution() { wx.switchTab({ url: '/pages/evolution/evolution' }); },
  goRadicals()  { wx.switchTab({ url: '/pages/radicals/radicals' }); },

  openBookmark(event) {
    const char = event.currentTarget.dataset.char;
    if (!char) return;
    wx.setStorageSync('pendingEvolutionChar', char);
    wx.switchTab({ url: '/pages/evolution/evolution' });
  },

  removeBookmark(event) {
    const char = event.currentTarget.dataset.char;
    const rawNext = (wx.getStorageSync('bookmarks') || []).filter((c) => c !== char);
    wx.setStorageSync('bookmarks', rawNext);
    const next = rawNext.map(enrichChar);
    this.setData({
      bookmarks: next,
      bookmarkGroups: groupByRadical(next),
      hasBookmarks: next.length > 0,
      'stats.bookmarkCount': next.length
    });
  },

  // ── Settings ─────────────────────────────────────────────────

  toggleFontSize() {
    const cycle = { small: 'medium', medium: 'large', large: 'small' };
    const next = cycle[this.data.settings.fontSize] || 'medium';
    const settings = saveUserSettings({ ...this.data.settings, fontSize: next });
    this.setData({ settings, pageClass: getPageClass(settings) });
    wx.showToast({
      title: { small: '小', medium: '中', large: '大' }[next],
      icon: 'none'
    });
  },

  toggleTheme() {
    const next = this.data.settings.theme === 'dark' ? 'light' : 'dark';
    const settings = saveUserSettings({ ...this.data.settings, theme: next });
    this.setData({ settings, pageClass: getPageClass(settings) });
    applyThemeChrome(settings);
    wx.showToast({ title: next === 'dark' ? '深色模式' : '浅色模式', icon: 'none' });
  },

  reviewMistake(event) {
    const char = event.currentTarget.dataset.char;
    if (!char) return;
    wx.setStorageSync('pendingEvolutionChar', char);
    wx.switchTab({ url: '/pages/evolution/evolution' });
  },

  clearMistakes() {
    wx.showModal({
      title: '清空错题本',
      content: '确定清空所有猜字错题记录？',
      confirmColor: '#DC2626',
      success: (res) => {
        if (!res.confirm) return;
        clearQuizMistakes();
        this.setData({ mistakesPreview: [], hasMistakes: false });
        wx.showToast({ title: '已清空', icon: 'success' });
      }
    });
  },

  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '将清除搜索历史、解锁记录、收藏与登录信息，确定继续？',
      confirmColor: '#DC2626',
      success: (res) => {
        if (res.confirm) {
          ['searchHistory', 'recentViews', 'unlockHistory', 'unlockTimes', 'bookmarks',
           'radicalExpanded', 'streakState', 'quizLastScore', 'token', 'userInfo', 'userSettings', 'quizMistakes', 'aiLearningMetrics']
            .forEach((k) => wx.removeStorageSync(k));
          this.setData({
            isLoggedIn: false,
            user: { nickname: '说文访客', avatarUrl: '' },
            userInitial: '说',
            bookmarks: [],
            bookmarkGroups: [],
            recentViews: [],
            hasRecentViews: false,
            hasBookmarks: false,
            mistakesPreview: [],
            hasMistakes: false,
            'stats.streakDays': 0,
            'stats.todayCount': 0,
            settings: { fontSize: 'medium', theme: 'light' },
            pageClass: ''
          });
          applyThemeChrome({ fontSize: 'medium', theme: 'light' });
          wx.showToast({ title: '已清除', icon: 'success' });
        }
      }
    });
  },

  showAbout() {
    wx.showModal({
      title: '关于说文',
      content: '说文 · 字源演变学习\n版本 1.0.0\n基于 QX 标准与《说文解字》构建。',
      showCancel: false
    });
  },

  copyContact() {
    wx.setClipboardData({
      data: 'shuowen@example.com',
      success() { wx.showToast({ title: '邮箱已复制', icon: 'success' }); }
    });
  }
});
