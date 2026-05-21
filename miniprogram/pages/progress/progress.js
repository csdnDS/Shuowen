const { request } = require('../../utils/request');
const fallback = require('../../utils/fallback');
const glyphs = require('../../data/glyphs');
const { getOracleSrc } = require('../../utils/oracleSVGs');

function pad(value) {
  return `${value}`.padStart(2, '0');
}

function _accuracy(score) {
  if (!score || !score.total) return '0';
  return String(Math.round(score.correct * 100 / score.total));
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

function sameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function calculateStreak(history) {
  if (!history.length) return 0;
  const days = [...new Set(history.map((item) => new Date(item.time).toDateString()))];
  let cursor = new Date();
  let streak = 0;

  while (days.includes(cursor.toDateString())) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }

  return streak;
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
    quizScore: { total: 0, correct: 0 },
    quizAccuracy: '0',
    weekCalendar: [],
    charOfDay: null
  },

  onLoad() {
    const saved = wx.getStorageSync('quizLastScore');
    if (saved && saved.total > 0) {
      this.setData({ quizScore: saved, quizAccuracy: _accuracy(saved) });
    }
    this.fetchProgress();
    this._loadCharOfDay();
  },

  onShow() {
    this.fetchProgress();
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
      this._playRipple();
      this._applyProgress(result);
      this.setData({
        lastUnlock: {
          char,
          message: result.isNew ? '新解锁一字' : '此字已收录'
        }
      });
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
      const history = [{ char, time: Date.now() }, ...(this.data.progress.history || [])];
      this._playRipple();
      this._applyProgress({
        total: 9353,
        unlocked,
        unlockedCount: unlocked.length,
        history
      });
      this.setData({
        lastUnlock: { char, message: '离线模拟解锁' },
        offline: true
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  _applyLearningStats(history) {
    const rawHistory = history || [];
    const todayCount = rawHistory.filter((item) => sameDay(item.time, Date.now())).length;
    const recent = rawHistory.slice(0, 10).map((item, idx) => ({
      id: `${item.char}-${item.time}-${idx}`,
      char: item.char,
      time: item.time,
      timeLabel: formatRelativeTime(item.time)
    }));

    // Build 7-day calendar
    const calendar = [];
    const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const ds = d.toDateString();
      const count = rawHistory.filter((item) => new Date(item.time).toDateString() === ds).length;
      calendar.push({
        label: DAY_LABELS[d.getDay()],
        dateNum: d.getDate(),
        count,
        active: count > 0,
        isToday: i === 0
      });
    }
    this.setData({
      streakDays: calculateStreak(rawHistory),
      todayCount,
      recentUnlocks: recent,
      hasRecentUnlocks: recent.length > 0,
      weekCalendar: calendar
    });
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
      progress: {
        total,
        unlocked: progress.unlocked || [],
        unlockedCount: count,
        history: progress.history || []
      },
      percent,
      percentText: percent.toFixed(3),
      levelName,
      levelHint: remaining > 0 ? `再解 ${remaining} 字，晋级下一阶` : '已达最高「通识」阶段'
    });
    this._applyLearningStats(progress.history || []);
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

  _loadCharOfDay() {
    const pool = glyphs.catalog.filter((c) => glyphs.byChar[c.char]);
    if (!pool.length) return;
    // Use date string as a simple daily seed
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const entry = pool[seed % pool.length];
    const data = glyphs.byChar[entry.char];
    if (!data) return;
    const oracleSrc = getOracleSrc(data.char);
    const todayStr = `${today.getMonth() + 1}月${today.getDate()}日`;
    this.setData({
      charOfDay: {
        char: data.char,
        pinyin: data.pinyin,
        radical: data.radical,
        meaning: data.meaning,
        oracleSrc: oracleSrc || '',
        hasOracle: Boolean(oracleSrc),
        dateStr: todayStr
      }
    });
  },

  goToEvolution(event) {
    const char = event.currentTarget.dataset.char;
    if (!char) return;
    wx.setStorageSync('pendingEvolutionChar', char);
    wx.switchTab({ url: '/pages/evolution/evolution' });
  },

  goToCharOfDay() {
    const cod = this.data.charOfDay;
    if (!cod) return;
    wx.setStorageSync('pendingEvolutionChar', cod.char);
    wx.switchTab({ url: '/pages/evolution/evolution' });
  },

  // ── Quiz ───────────────────────────────────────────────────

  startQuiz() {
    this.setData({ quizScore: { total: 0, correct: 0 }, quizAccuracy: '0' });
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

    // Build all available hints from different eras (for progressive reveal)
    const hints = correctData.stages
      .filter((s) => s.desc)
      .map((s) => ({ era: s.label, desc: s.desc }));
    // Start with a random era hint
    const startIdx = Math.floor(Math.random() * Math.min(hints.length, 3));
    const orderedHints = [hints[startIdx], ...hints.filter((_, i) => i !== startIdx)];
    this.setData({
      quizActive: true,
      quiz: {
        correct,
        options,
        hints: orderedHints,
        hintIdx: 0,
        hint: orderedHints[0].desc,
        hintEra: orderedHints[0].era,
        canRevealMore: orderedHints.length > 1,
        meaning: correctData.meaning,
        pinyin: correctData.pinyin
      },
      quizResult: null
    });
  },

  revealNextHint() {
    const quiz = this.data.quiz;
    if (!quiz || !quiz.hints) return;
    const nextIdx = quiz.hintIdx + 1;
    if (nextIdx >= quiz.hints.length) return;
    const next = quiz.hints[nextIdx];
    this.setData({
      'quiz.hintIdx': nextIdx,
      'quiz.hint': next.desc,
      'quiz.hintEra': next.era,
      'quiz.canRevealMore': nextIdx < quiz.hints.length - 1
    });
  },

  quizAnswer(event) {
    if (this.data.quizResult) return;
    const chosen = event.currentTarget.dataset.char;
    const correct = this.data.quiz.correct;
    const isCorrect = chosen === correct;
    if (isCorrect) wx.vibrateShort({ type: 'light' });
    const prev = this.data.quizScore;
    const next = { total: prev.total + 1, correct: prev.correct + (isCorrect ? 1 : 0) };
    this.setData({
      quizResult: { chosen, correct, isCorrect },
      quizScore: next,
      quizAccuracy: _accuracy(next)
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
