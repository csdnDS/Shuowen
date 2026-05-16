const { request } = require('../../utils/request');
const fallback = require('../../utils/fallback');

function pad(value) {
  return `${value}`.padStart(2, '0');
}

function formatClock(timestamp) {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRelativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  return formatClock(timestamp);
}

Page({
  data: {
    progress: { total: 9353, unlocked: [], unlockedCount: 0 },
    percent: 0,
    percentText: '0.000',
    recentUnlocks: [],
    hasRecentUnlocks: false,
    streakDays: 0,
    todayCount: 0,
    levelName: '初识',
    levelHint: '继续解字，逐级累进',
    rippleActive: false,
    lastUnlock: null,
    loading: false,
    offline: false
  },

  onLoad() {
    this.fetchProgress();
    this._loadStreak();
  },

  onShow() {
    this._loadStreak();
  },

  async fetchProgress() {
    this.setData({ loading: true });
    try {
      const progress = await request('/api/progress');
      this._applyProgress(progress);
      this.setData({ offline: false });
    } catch (err) {
      this._applyProgress(fallback.progress);
      this.setData({ offline: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  async unlock() {
    this.setData({ loading: true });
    try {
      const result = await request('/api/progress/unlock', 'POST');
      const char = result.unlockedChar;
      this._recordUnlock(char);
      this._playRipple();
      this._applyProgress(result);
      this.setData({
        lastUnlock: {
          char,
          message: result.isNew ? '新解锁一字' : '此字已收录'
        }
      });
      this._loadStreak();
    } catch (err) {
      // Mock unlock for offline mode
      const pool = ['人', '水', '山', '日', '月', '火', '木', '文', '字', '说'];
      const pickFrom = pool.filter((c) => this.data.progress.unlocked.indexOf(c) === -1);
      if (pickFrom.length === 0) {
        wx.showToast({ title: '离线字库已全部解锁', icon: 'none' });
        this.setData({ loading: false });
        return;
      }
      const char = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      const unlocked = [...this.data.progress.unlocked, char];
      this._recordUnlock(char);
      this._playRipple();
      this._applyProgress({
        total: 9353,
        unlocked,
        unlockedCount: unlocked.length
      });
      this.setData({
        lastUnlock: { char, message: '离线模拟解锁' },
        offline: true
      });
      this._loadStreak();
    } finally {
      this.setData({ loading: false });
    }
  },

  _recordUnlock(char) {
    const now = Date.now();
    const history = [{ char, time: now }, ...(wx.getStorageSync('unlockHistory') || [])].slice(0, 50);
    wx.setStorageSync('unlockHistory', history);

    const times = wx.getStorageSync('unlockTimes') || {};
    if (!times[char]) {
      times[char] = now;
      wx.setStorageSync('unlockTimes', times);
    }

    // Update streak / today count
    const today = new Date().toDateString();
    const streakState = wx.getStorageSync('streakState') || { lastDay: '', days: 0, todayCount: 0 };
    if (streakState.lastDay !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      streakState.days = streakState.lastDay === yesterday ? streakState.days + 1 : 1;
      streakState.lastDay = today;
      streakState.todayCount = 0;
    }
    streakState.todayCount += 1;
    wx.setStorageSync('streakState', streakState);
  },

  _loadStreak() {
    const streakState = wx.getStorageSync('streakState') || { lastDay: '', days: 0, todayCount: 0 };
    const today = new Date().toDateString();
    const days = streakState.lastDay === today ? streakState.days : 0;
    const todayCount = streakState.lastDay === today ? streakState.todayCount : 0;
    this.setData({ streakDays: days, todayCount });

    const rawHistory = wx.getStorageSync('unlockHistory') || [];
    const recent = rawHistory.slice(0, 10).map((item, idx) => ({
      id: `${item.char}-${item.time}-${idx}`,
      char: item.char,
      time: item.time,
      timeLabel: formatRelativeTime(item.time)
    }));
    this.setData({ recentUnlocks: recent, hasRecentUnlocks: recent.length > 0 });
  },

  _applyProgress(progress) {
    const total = progress.total || 9353;
    const count = progress.unlockedCount || (progress.unlocked || []).length;
    const percent = Math.min(100, (count / total) * 100);
    const levelName = count >= 100 ? '通识' : count >= 30 ? '入门' : '初识';
    const nextMilestone = count < 10 ? 10 : count < 30 ? 30 : count < 100 ? 100 : 300;
    const remaining = Math.max(0, nextMilestone - count);
    this.setData({
      progress: { total, unlocked: progress.unlocked || [], unlockedCount: count },
      percent,
      percentText: percent.toFixed(3),
      levelName,
      levelHint: remaining > 0 ? `再解 ${remaining} 字，晋级下一阶` : '已达最高阶段'
    });
  },

  _playRipple() {
    this.setData({ rippleActive: false });
    setTimeout(() => this.setData({ rippleActive: true }), 20);
    setTimeout(() => this.setData({ rippleActive: false }), 760);
  },

  goToEvolution(event) {
    const char = event.currentTarget.dataset.char;
    if (!char) return;
    wx.setStorageSync('pendingEvolutionChar', char);
    wx.switchTab({ url: '/pages/evolution/evolution' });
  }
});
