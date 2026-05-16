const { request } = require('../../utils/request');
const fallback = require('../../utils/fallback');
const glyphs = require('../../data/glyphs');

function pad(value) {
  return `${value}`.padStart(2, '0');
}

function formatClock(timestamp) {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(timestamp) {
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatRelativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  const days = Math.floor(diff / day);
  if (days === 1) return '昨天 ' + formatClock(timestamp);
  if (days < 30) return `${days} 天前`;
  return formatDate(timestamp);
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
    dailyGoal: 3,
    levelName: '初识',
    levelHint: '继续解字，逐级累进',
    rippleActive: false,
    lastUnlock: null,
    loading: false,
    offline: false,
    quizActive: false,
    quiz: null,
    quizResult: null,
    quizScore: { total: 0, correct: 0 }
  },

  onLoad() {
    const saved = wx.getStorageSync('quizLastScore');
    if (saved && saved.total > 0) this.setData({ quizScore: saved });
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
      // Mock unlock for offline mode (use full bundled catalog)
      const pool = glyphs.catalog.map((c) => c.char);
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
    const prevCount = (this.data.progress || {}).unlockedCount || 0;
    const percent = Math.min(100, (count / total) * 100);
    let levelName, nextMilestone;
    if (count >= 300) {
      levelName = '通识';
      nextMilestone = 0;
    } else if (count >= 100) {
      levelName = '入门';
      nextMilestone = 300;
    } else if (count >= 30) {
      levelName = '初学';
      nextMilestone = 100;
    } else {
      levelName = '初识';
      nextMilestone = 30;
    }
    const remaining = nextMilestone > 0 ? Math.max(0, nextMilestone - count) : 0;
    this.setData({
      progress: { total, unlocked: progress.unlocked || [], unlockedCount: count },
      percent,
      percentText: percent.toFixed(3),
      levelName,
      levelHint: remaining > 0 ? `再解 ${remaining} 字，晋级下一阶` : '已达最高「通识」阶段'
    });
    // Milestone celebration
    const milestones = [30, 100, 300];
    for (const m of milestones) {
      if (prevCount < m && count >= m) {
        const titles = { 30: '初学达成！解锁 30 字', 100: '入门达成！解锁 100 字', 300: '通识达成！解锁 300 字' };
        setTimeout(() => wx.showModal({
          title: '🎉 阶段达成',
          content: titles[m],
          showCancel: false
        }), 400);
        break;
      }
    }
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
  },

  // ── Quiz ───────────────────────────────────────────────────

  startQuiz() {
    this.setData({ quizScore: { total: 0, correct: 0 } });
    const unlocked = this.data.progress.unlocked;
    // Use unlocked chars first; fall back to full catalog for new users
    const eligible = unlocked.filter((c) => glyphs.byChar[c]);
    const pool = eligible.length >= 3 ? eligible : glyphs.catalog.map((c) => c.char).filter((c) => glyphs.byChar[c]);
    if (pool.length === 0) return;
    const correct = pool[Math.floor(Math.random() * pool.length)];
    const correctData = glyphs.byChar[correct];

    // Build distractors from catalog
    const others = glyphs.catalog.map((c) => c.char).filter((c) => c !== correct);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = others[i]; others[i] = others[j]; others[j] = t;
    }
    const options = [correct, ...others.slice(0, 3)];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = options[i]; options[i] = options[j]; options[j] = t;
    }

    // Randomly pick hint era: 甲骨文 (index 0) or 金文 (index 1) or 小篆 (index 2)
    const eraIdx = Math.floor(Math.random() * 3);
    const hintStage = correctData.stages[eraIdx] || correctData.stages[0];
    this.setData({
      quizActive: true,
      quiz: {
        correct,
        options,
        hint: hintStage.desc,
        hintEra: hintStage.label,
        meaning: correctData.meaning,
        pinyin: correctData.pinyin
      },
      quizResult: null
    });
  },

  quizAnswer(event) {
    if (this.data.quizResult) return;
    const chosen = event.currentTarget.dataset.char;
    const correct = this.data.quiz.correct;
    const isCorrect = chosen === correct;
    if (isCorrect) wx.vibrateShort({ type: 'light' });
    const prev = this.data.quizScore;
    this.setData({
      quizResult: { chosen, correct, isCorrect },
      quizScore: { total: prev.total + 1, correct: prev.correct + (isCorrect ? 1 : 0) }
    });
  },

  closeQuiz() {
    if (this.data.quizScore.total > 0) {
      wx.setStorageSync('quizLastScore', this.data.quizScore);
    }
    this.setData({ quizActive: false, quiz: null, quizResult: null });
  },

  goToQuizChar() {
    if (!this.data.quiz) return;
    const char = this.data.quiz.correct;
    wx.setStorageSync('pendingEvolutionChar', char);
    wx.switchTab({ url: '/pages/evolution/evolution' });
  }
});
