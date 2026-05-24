const { request } = require('../../utils/request');
const { ensureToken } = require('../../utils/auth');
const fallback = require('../../utils/fallback');
const glyphs = require('../../data/glyphs');
const { getOracleSrc } = require('../../utils/oracleSVGs');
const { getUserSettings, getPageClass, applyThemeChrome, recordQuizMistake } = require('../../utils/settings');
const { loadHistoricalFonts } = require('../../utils/historicalFonts');

const INDEX_LABELS = ['①', '②', '③', '④', '⑤'];
const QUIZ_POOL = ['人', '水', '山', '日', '月', '火', '木', '大', '女', '子', '口', '手', '心', '目', '王', '土', '天', '禾', '竹', '生', '明', '龙', '家', '老', '雨', '鸟', '马', '鱼', '羊', '牛', '田', '风'];
const METRIC_KEY = 'aiLearningMetrics';

const TONE_MAP = {
  'ā':'a','á':'a','ǎ':'a','à':'a',
  'ē':'e','é':'e','ě':'e','è':'e',
  'ī':'i','í':'i','ǐ':'i','ì':'i',
  'ō':'o','ó':'o','ǒ':'o','ò':'o',
  'ū':'u','ú':'u','ǔ':'u','ù':'u',
  'ǖ':'v','ǘ':'v','ǚ':'v','ǜ':'v'
};

function normPinyin(s) {
  return (s || '').toLowerCase().replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, c => TONE_MAP[c] || c);
}

function shuffle(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function readLearningMetrics() {
  return wx.getStorageSync(METRIC_KEY) || {
    aiStoryCount: 0,
    aiAskCount: 0,
    quizExplainCount: 0,
    quizTotal: 0,
    quizCorrect: 0
  };
}

function quizAccuracy(metrics) {
  if (!metrics.quizTotal) return '0';
  return String(Math.round(metrics.quizCorrect * 100 / metrics.quizTotal));
}

Page({
  data: {
    query: '说',
    pageClass: '',
    character: null,
    searchHistory: [],
    hasSearchHistory: false,
    searchPanelVisible: false,
    searchFocus: false,
    catalog: [],
    catalogFiltered: [],
    catalogTotal: 9353,
    catalogReturned: 0,
    catalogExpanded: false,
    compareExpanded: false,
    bookmarked: false,
    offline: false,
    loading: false,
    aiStory: null,
    aiStoryLoading: false,
    askInput: '',
    askAnswer: null,
    askMessages: [],
    askLoading: false,
    askFocus: false,
    askPanelVisible: false,
    ttsLoadingIndex: null,
    ttsPlayingIndex: null,
    voiceAvailable: false,
    voiceListening: false,
    voiceRecognizing: false,
    voiceRecognizedText: '',
    voiceTip: '按住说话问小字灵',
    aiPanelExpanded: true,
    suggestions: [],
    showSuggestions: false,
    dailyRecommendation: null,
    dailyLoading: false,
    learningPath: null,
    learningPathLoading: false,
    learningDashboard: {
      coreTotal: 100,
      unlockedCount: 0,
      corePercentText: '0',
      aiInteractions: 0,
      quizTotal: 0,
      quizAccuracy: '0'
    },
    quiz: null,
    quizLoading: false,
    quizExplaining: false,
    quizAnswered: false,
    quizSelected: '',
    quizCorrect: false,
    quizExplanation: null,
    related: [],
    catalogIndex: -1,
    hasPrev: false,
    hasNext: false,
    suggestChars: ['说', '人', '水', '山', '日', '月', '火', '木', '龙', '鱼'],
    strokeFilter: 0,
    strokeOptions: [
      { label: '全部', value: 0 },
      { label: '1-3画', value: 3 },
      { label: '4-6画', value: 6 },
      { label: '7-10画', value: 10 },
      { label: '11画+', value: 99 }
    ]
  },

  _debounce: null,
  _charCache: null,
  _unlocked: null,
  _voiceManager: null,
  _voiceDraft: '',
  _voiceCanceled: false,
  _voiceStartAt: 0,
  _ttsAudio: null,

  onLoad(options = {}) {
    this._charCache = {};
    this._unlocked = new Set();
    const app = getApp();
    loadHistoricalFonts(app.globalData && app.globalData.apiBaseUrl);
    const settings = getUserSettings();
    applyThemeChrome(settings);
    const searchHistory = wx.getStorageSync('searchHistory') || [];
    const pendingChar = wx.getStorageSync('pendingEvolutionChar');
    const initialChar = options.char || pendingChar || '人';
    if (pendingChar) wx.removeStorageSync('pendingEvolutionChar');

    // Catalog from bundled data is always available, with backend
    // potentially adding more.
    this.setData({
      searchHistory,
      pageClass: getPageClass(settings),
      hasSearchHistory: searchHistory.length > 0,
      query: initialChar,
      catalog: glyphs.catalog,
      catalogFiltered: glyphs.catalog,
      catalogTotal: glyphs.total,
      catalogReturned: glyphs.catalog.length,
      quiz: this._buildFallbackQuiz()
    });
    this._fetchCatalog();
    this._loadDailyRecommendation();
    this._loadLearningPath();
    this._applyLearningDashboard();
    this._loadQuiz();
    this._initVoiceAsk();
    this._loadCharacter(initialChar);
  },

  onShow() {
    const settings = getUserSettings();
    applyThemeChrome(settings);
    this.setData({ pageClass: getPageClass(settings) });
    const pendingChar = wx.getStorageSync('pendingEvolutionChar');
    if (pendingChar) {
      wx.removeStorageSync('pendingEvolutionChar');
      this._loadCharacter(pendingChar);
    }
    if (this.data.character) {
      this._refreshBookmarkState(this.data.character.char);
    }
    this._applyLearningDashboard();
  },

  onUnload() {
    if (this._debounce) clearTimeout(this._debounce);
    this._stopTts();
    if (this._ttsAudio) {
      this._ttsAudio.destroy();
      this._ttsAudio = null;
    }
  },

  openSearchPanel() {
    this.setData({
      searchPanelVisible: true,
      searchFocus: true,
      suggestions: [],
      showSuggestions: false
    });
  },

  closeSearchPanel() {
    this.setData({
      searchPanelVisible: false,
      searchFocus: false,
      suggestions: [],
      showSuggestions: false
    });
  },

  noop() {},

  onInput(event) {
    const val = event.detail.value;
    this.setData({ query: val });
    if (this._debounce) clearTimeout(this._debounce);
    this._debounce = setTimeout(() => {
      const trimmed = (val || '').trim();
      if (!trimmed) {
        this.setData({ suggestions: [], showSuggestions: false });
        return;
      }
      const firstChar = Array.from(trimmed)[0];
      if (/[一-鿿㐀-䶿]/.test(firstChar)) {
        const suggestions = this.data.catalog
          .filter((item) => item.char && item.char.indexOf(firstChar) !== -1)
          .slice(0, 8);
        this.setData({ suggestions, showSuggestions: suggestions.length > 0 });
        return;
      }
      // ASCII — show a pinyin-prefix suggestion dropdown
      const norm = normPinyin(trimmed);
      const suggestions = this.data.catalog
        .filter((item) => item.pinyin && normPinyin(item.pinyin).startsWith(norm))
        .slice(0, 12);
      this.setData({ suggestions, showSuggestions: suggestions.length > 0 });
    }, 250);
  },

  submitSearch() {
    const trimmed = (this.data.query || '').trim();
    if (!trimmed) return;
    const firstChar = Array.from(trimmed)[0];
    if (/[一-鿿㐀-䶿]/.test(firstChar)) {
      this.closeSearchPanel();
      this._loadCharacter(firstChar);
      return;
    }
    const norm = normPinyin(trimmed);
    const match = this.data.catalog.find(
      (item) => normPinyin(item.pinyin) === norm
    ) || this.data.catalog.find(
      (item) => item.pinyin && normPinyin(item.pinyin).startsWith(norm)
    );
    if (match) {
      this.closeSearchPanel();
      this._loadCharacter(match.char);
      return;
    }
    wx.showToast({ title: '未找到匹配汉字', icon: 'none' });
  },

  useSuggestion(event) {
    const char = event.currentTarget.dataset.char;
    if (!char) return;
    this.closeSearchPanel();
    this._loadCharacter(char);
  },

  setStrokeFilter(event) {
    const value = event.currentTarget.dataset.value;
    this.setData({ strokeFilter: value });
    this._applyStrokeFilter(this.data.catalog, value);
  },

  toggleCatalog() {
    this.setData({ catalogExpanded: !this.data.catalogExpanded });
  },

  toggleCompare() {
    this.setData({ compareExpanded: !this.data.compareExpanded });
  },

  toggleAiPanel() {
    this.setData({ aiPanelExpanded: !this.data.aiPanelExpanded });
  },

  quickAsk() {
    this.setData({
      searchPanelVisible: false,
      askPanelVisible: true,
      askFocus: true
    });
  },

  closeAskPanel() {
    this._stopTts();
    this.setData({ askPanelVisible: false, askFocus: false });
  },

  useAskPreset(event) {
    const question = event.currentTarget.dataset.question;
    if (!question) return;
    this.setData({ askInput: question, askFocus: true });
  },

  openRadicalIndex() {
    const character = this.data.character;
    if (!character || !character.radical) return;
    wx.setStorageSync('pendingRadicalKeyword', character.radical);
    wx.switchTab({ url: '/pages/radicals/radicals' });
  },

  _applyStrokeFilter(catalog, strokeFilter) {
    let filtered;
    if (!strokeFilter) {
      filtered = catalog;
    } else if (strokeFilter === 3) {
      filtered = catalog.filter((c) => {
        const entry = glyphs.byChar[c.char];
        return entry && entry.strokes >= 1 && entry.strokes <= 3;
      });
    } else if (strokeFilter === 6) {
      filtered = catalog.filter((c) => {
        const entry = glyphs.byChar[c.char];
        return entry && entry.strokes >= 4 && entry.strokes <= 6;
      });
    } else if (strokeFilter === 10) {
      filtered = catalog.filter((c) => {
        const entry = glyphs.byChar[c.char];
        return entry && entry.strokes >= 7 && entry.strokes <= 10;
      });
    } else {
      filtered = catalog.filter((c) => {
        const entry = glyphs.byChar[c.char];
        return entry && entry.strokes >= 11;
      });
    }
    const currentChar = this.data.character && this.data.character.char;
    const catalogIndex = currentChar
      ? filtered.findIndex((c) => c.char === currentChar)
      : -1;
    this.setData({
      catalogFiltered: filtered,
      catalogReturned: filtered.length,
      catalogIndex,
      hasPrev: catalogIndex > 0,
      hasNext: catalogIndex >= 0 && catalogIndex < filtered.length - 1
    });
  },

  randomChar() {
    const pool = this.data.catalogFiltered.filter((item) => item.hasDetail);
    if (!pool.length) return;
    const item = pool[Math.floor(Math.random() * pool.length)];
    this.closeSearchPanel();
    this.setData({ query: item.char });
    this._loadCharacter(item.char);
  },

  prevChar() {
    const idx = this.data.catalogIndex;
    if (idx <= 0) return;
    const item = this.data.catalogFiltered[idx - 1];
    if (item) this._loadCharacter(item.char);
  },

  nextChar() {
    const idx = this.data.catalogIndex;
    const list = this.data.catalogFiltered;
    if (idx < 0 || idx >= list.length - 1) return;
    const item = list[idx + 1];
    if (item) this._loadCharacter(item.char);
  },

  useHistory(event) {
    const char = event.currentTarget.dataset.char;
    if (char) {
      this.closeSearchPanel();
      this._loadCharacter(char);
    }
  },

  useCatalog(event) {
    const char = event.currentTarget.dataset.char;
    if (char) this._loadCharacter(char);
  },

  clearHistory() {
    wx.removeStorageSync('searchHistory');
    this.setData({ searchHistory: [], hasSearchHistory: false });
  },

  async _loadDailyRecommendation() {
    if (this.data.dailyLoading) return;
    this.setData({ dailyLoading: true });
    try {
      const data = await request('/api/ai/daily', 'GET', {}, { timeout: 18000 });
      this.setData({ dailyRecommendation: data, dailyLoading: false });
    } catch (_err) {
      const fallbackChar = glyphs.byChar['火'] || glyphs.byChar['日'] || glyphs.byChar['人'];
      this.setData({
        dailyRecommendation: fallbackChar ? {
          char: fallbackChar.char,
          title: `今日汉字：${fallbackChar.char}`,
          pinyin: fallbackChar.pinyin || '',
          radical: fallbackChar.radical || '',
          meaning: fallbackChar.meaning || '',
          insight: `今天推荐“${fallbackChar.char}”。从字形里看见古人观察自然的方式，也把今天的学习从一个具体的字开始。`,
          generated: false
        } : null,
        dailyLoading: false
      });
    }
  },

  async _loadLearningPath() {
    if (this.data.learningPathLoading) return;
    this.setData({ learningPathLoading: true });
    try {
      const data = await request('/api/ai/learning-path', 'GET', {}, { timeout: 18000 });
      this.setData({
        learningPath: data,
        learningPathLoading: false
      });
      this._applyLearningDashboard(data);
    } catch (_err) {
      const recent = (wx.getStorageSync('recentViews') || []).map((item) => item.char);
      const seen = new Set(recent);
      const recommendations = glyphs.catalog
        .filter((item) => item.hasDetail && !seen.has(item.char))
        .slice(0, 3)
        .map((item) => {
          const detail = glyphs.byChar[item.char] || {};
          return {
            char: item.char,
            pinyin: detail.pinyin || item.pinyin || '',
            radical: detail.radical || '',
            strokes: detail.strokes || 0,
            reason: '先从核心字库中补齐未学习字，形成稳定的五阶段字形认知。'
          };
        });
      const fallbackPath = {
        title: 'AI 个性化学习路径',
        unlockedCount: recent.length,
        coreTotal: 100,
        focus: '当前离线，先根据最近浏览记录推荐未学习的核心字。',
        summary: '先补齐未浏览的核心字，再围绕部首和相似字进行复习。',
        recommendations,
        generated: false
      };
      this.setData({
        learningPath: fallbackPath,
        learningPathLoading: false
      });
      this._applyLearningDashboard(fallbackPath);
    }
  },

  refreshLearningPath() {
    this._loadLearningPath();
  },

  async usePathRecommendation(event) {
    const char = event.currentTarget.dataset.char;
    if (!char) return;
    this.setData({ query: char });
    await this._loadCharacter(char);
    this._scrollToCurrentCharacter();
  },

  _recordLearningMetric(key, amount = 1) {
    const metrics = readLearningMetrics();
    metrics[key] = (metrics[key] || 0) + amount;
    wx.setStorageSync(METRIC_KEY, metrics);
    this._applyLearningDashboard();
  },

  _applyLearningDashboard(pathData) {
    const metrics = readLearningMetrics();
    const path = pathData || this.data.learningPath || {};
    const coreTotal = path.coreTotal || 100;
    const unlockedCount = Math.min(coreTotal, path.unlockedCount || 0);
    const corePercentText = coreTotal ? String(Math.round(unlockedCount * 100 / coreTotal)) : '0';
    this.setData({
      learningDashboard: {
        coreTotal,
        unlockedCount,
        corePercentText,
        aiInteractions: (metrics.aiStoryCount || 0) + (metrics.aiAskCount || 0) + (metrics.quizExplainCount || 0),
        quizTotal: metrics.quizTotal || 0,
        quizAccuracy: quizAccuracy(metrics)
      }
    });
  },

  async useDailyRecommendation() {
    const daily = this.data.dailyRecommendation;
    if (!daily || !daily.char) return;
    this.setData({ query: daily.char });
    await this._loadCharacter(daily.char);
    this._scrollToCurrentCharacter();
  },

  async _loadQuiz() {
    if (this.data.quizLoading) return;
    this.setData({
      quizLoading: true,
      quizAnswered: false,
      quizSelected: '',
      quizCorrect: false,
      quizExplanation: null,
      quizExplaining: false
    });
    try {
      const pool = shuffle(QUIZ_POOL).slice(0, 12);
      // Fetch candidates in parallel, then pick the first usable one in order.
      const results = await Promise.all(pool.map((char) =>
        request(`/api/characters/${encodeURIComponent(char)}`, 'GET', {}, { timeout: 8000 })
          .catch(() => null)
      ));
      let quiz = null;
      for (const data of results) {
        if (!data) continue;
        const stages = data.stages || [];
        const stage = stages.find((item) => item.era === 'oracle' && item.assetUrl)
          || stages.find((item) => item.era === 'bronze' && item.assetUrl)
          || stages.find((item) => item.assetUrl);
        if (stage) {
          const distractors = shuffle(QUIZ_POOL.filter((item) => item !== data.char)).slice(0, 3);
          quiz = {
            char: data.char,
            pinyin: data.pinyin || '',
            meaning: data.meaning || '',
            stageLabel: stage.label || stage.name || '古文字',
            assetUrl: stage.assetUrl,
            options: shuffle([data.char, ...distractors]).map((option) => ({ char: option }))
          };
          break;
        }
      }
      if (!quiz) throw new Error('no quiz asset');
      this.setData({ quiz, quizLoading: false });
    } catch (_err) {
      const fallbackQuiz = this._buildFallbackQuiz();
      this.setData({ quiz: fallbackQuiz, quizLoading: false });
    }
  },

  _buildFallbackQuiz() {
    const char = '人';
    const src = getOracleSrc(char);
    return {
      char,
      pinyin: 'rén',
      meaning: '象人侧立之形。',
      stageLabel: '甲骨文',
      assetUrl: src || '',
      options: shuffle(['人', '大', '火', '木']).map((option) => ({ char: option }))
    };
  },

  async chooseQuizOption(event) {
    if (this.data.quizAnswered || this.data.quizExplaining) return;
    const chosen = event.currentTarget.dataset.char;
    const quiz = this.data.quiz;
    if (!quiz || !chosen) return;
    const isCorrect = chosen === quiz.char;
    this._recordLearningMetric('quizTotal');
    if (isCorrect) this._recordLearningMetric('quizCorrect');
    if (!isCorrect) {
      recordQuizMistake({
        char: quiz.char,
        chosen,
        pinyin: quiz.pinyin,
        meaning: quiz.meaning,
        stageLabel: quiz.stageLabel,
        assetUrl: quiz.assetUrl,
        source: 'evolution-quiz'
      });
    }
    const options = (quiz.options || []).map((option) => ({
      ...option,
      selected: option.char === chosen,
      correct: option.char === quiz.char
    }));
    this.setData({
      quiz: { ...quiz, options },
      quizAnswered: true,
      quizSelected: chosen,
      quizCorrect: isCorrect,
      quizExplaining: true
    });
    try {
      const data = await request('/api/ai/quiz/explain', 'POST', {
        char: quiz.char,
        chosen,
        isCorrect
      }, { timeout: 15000 });
      this._recordLearningMetric('quizExplainCount');
      this.setData({ quizExplanation: data, quizExplaining: false });
    } catch (_err) {
      this.setData({
        quizExplanation: {
          char: quiz.char,
          title: isCorrect ? `猜对了，是“${quiz.char}”` : `答案是“${quiz.char}”`,
          story: isCorrect
            ? `你猜对了！这张${quiz.stageLabel}字形保留了“${quiz.char}”最早的造字线索。`
            : `正确答案是“${quiz.char}”。这张${quiz.stageLabel}字形记录了它早期的形体特征。`,
          generated: false
        },
        quizExplaining: false
      });
    }
  },

  nextQuiz() {
    this._loadQuiz();
  },

  async openQuizCharacter() {
    const quiz = this.data.quiz;
    if (!quiz || !quiz.char) return;
    this.setData({ query: quiz.char });
    await this._loadCharacter(quiz.char);
    this._scrollToCurrentCharacter();
  },

  _scrollToCurrentCharacter() {
    this._scrollToSelector('#current-character-card');
  },

  _scrollToSelector(selector) {
    setTimeout(() => {
      wx.pageScrollTo({
        selector,
        duration: 300,
        offsetTop: 16
      });
    }, 80);
  },

  /**
   * Load a character with a 3-tier resolution strategy:
   *   1) Bundled curated dataset (data/glyphs.js)   — always available
   *   2) Backend API                                — adds richer data
   *   3) Legacy fallback                            — minimal example set
   *
   * Bundled data wins for the visual stages so the demo always looks good.
   * Backend metadata (pinyin / meaning) merges in when present.
   */
  async _loadCharacter(char) {
    const cached = this._charCache && this._charCache[char];
    if (cached) {
      this._applyCharacter(cached);
      this.setData({ offline: false });
      return;
    }
    const bundled = glyphs.byChar[char];
    if (bundled) {
      this._applyCharacter(bundled);
    }
    this.setData({ loading: true });
    try {
      const remote = await request(`/api/characters/${encodeURIComponent(char)}`);
      const merged = this._mergeRemote(bundled, remote);
      if (this._charCache) this._charCache[merged.char] = merged;
      this._applyCharacter(merged);
      this._unlockViewedCharacter(merged.char);
      this.setData({ offline: false });
    } catch (err) {
      if (!bundled) {
        const legacy = fallback.characters[char];
        if (legacy) {
          this._applyCharacter(this._normalizeLegacy(legacy));
        } else {
          this.setData({ character: null, offline: true });
          wx.showToast({ title: '该字暂未收录，可尝试常用字', icon: 'none' });
        }
      }
      this.setData({ offline: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  async _fetchCatalog() {
    try {
      const data = await request('/api/characters?limit=300');
      // Backend may return characters not in our bundled set; merge while
      // preserving bundled-first ordering.
      const remote = data.items || [];
      const seen = new Set(glyphs.catalog.map((c) => c.char));
      const extras = remote.filter((c) => !seen.has(c.char));
      const merged = glyphs.catalog.concat(extras).slice(0, 300);
      this.setData({
        catalog: merged,
        catalogTotal: data.total || glyphs.total,
        offline: false
      });
      this._applyStrokeFilter(merged, this.data.strokeFilter);
    } catch (err) {
      // Bundled catalog already shown; mark offline silently.
      this.setData({ offline: true });
    }
  },

  _mergeRemote(bundled, remote) {
    const normalizedRemote = this._normalizeLegacy(remote);
    if (!bundled) return normalizedRemote;
    const remoteStages = normalizedRemote.stages || [];
    return {
      ...bundled,
      pinyin: remote.pinyin || bundled.pinyin,
      meaning: remote.meaning || bundled.meaning,
      radical: remote.radical || bundled.radical,
      stages: (bundled.stages || []).map((stage, idx) => ({
        ...stage,
        ...(remoteStages[idx] || {}),
        era: stage.era,
        label: stage.label,
        glyph: (remoteStages[idx] && remoteStages[idx].glyph) || stage.glyph,
        desc: stage.desc || (remoteStages[idx] && remoteStages[idx].desc)
      }))
    };
  },

  _normalizeLegacy(remote) {
    const stages = (remote.stages || []).map((stage, idx) => ({
      era: ['oracle', 'bronze', 'seal', 'clerical', 'regular'][idx] || 'regular',
      label: stage.name || '',
      glyph: stage.glyph || remote.char,
      desc: stage.desc || stage.description || '',
      period: stage.period || '',
      assetKey: stage.assetKey || '',
      assetUrl: stage.assetUrl || '',
      assetType: stage.assetType || '',
      assetSource: stage.assetSource || '',
      assetStatus: stage.assetStatus || '',
      assetProvider: stage.assetProvider || '',
      sourceUrl: stage.sourceUrl || '',
      license: stage.license || '',
      attribution: stage.attribution || '',
      fontGlyph: stage.fontGlyph || '',
      assetEnabled: Boolean(stage.assetEnabled)
    }));
    return { ...remote, stages };
  },

  _applyCharacter(character) {
    const stages = (character.stages || []).map((stage, idx) => {
      const enriched = {
        ...stage,
        indexLabel: INDEX_LABELS[idx] || '',
        displayGlyph: stage.fontGlyph || stage.glyph,
        showAsset: Boolean(stage.assetUrl && (stage.assetType === 'svg' || !stage.assetType))
      };
      // Inject SVG oracle bone image for 甲骨文 stage when available
      if (!stage.assetUrl && stage.era === 'oracle') {
        const src = getOracleSrc(character.char);
        if (src) enriched.oracleSrc = src;
      }
      return enriched;
    });
    const searchHistory = this._saveSearchHistory(character.char);
    this._saveRecentView(character.char);
    // Find related chars from radical group (fallback.radicals has rich examples)
    const radicalEntry = character.radical
      ? fallback.radicals.find((r) => r.radical === character.radical)
      : null;
    const related = radicalEntry
      ? radicalEntry.examples
          .filter((c) => c !== character.char)
          .slice(0, 8)
          .map((c) => ({ char: c, hasDetail: Boolean(glyphs.byChar[c]) }))
      : [];
    const catalog = this.data.catalogFiltered;
    const catalogIndex = catalog.findIndex((c) => c.char === character.char);
    this.setData({
      query: character.char,
      character: { ...character, stages },
      aiStory: null,
      aiStoryLoading: false,
      askInput: '',
      askAnswer: null,
      askMessages: [],
      compareExpanded: false,
      suggestions: [],
      showSuggestions: false,
      related,
      searchHistory,
      hasSearchHistory: searchHistory.length > 0,
      catalogIndex,
      hasPrev: catalogIndex > 0,
      hasNext: catalogIndex >= 0 && catalogIndex < catalog.length - 1
    });
    this._refreshBookmarkState(character.char);
  },

  _saveSearchHistory(char) {
    const current = wx.getStorageSync('searchHistory') || [];
    const searchHistory = [char, ...current.filter((item) => item !== char)].slice(0, 8);
    wx.setStorageSync('searchHistory', searchHistory);
    return searchHistory;
  },

  _saveRecentView(char) {
    const current = wx.getStorageSync('recentViews') || [];
    const next = [
      { char, time: Date.now() },
      ...current.filter((item) => item.char !== char)
    ].slice(0, 20);
    wx.setStorageSync('recentViews', next);
  },

  async _unlockViewedCharacter(char) {
    if (this._unlocked && this._unlocked.has(char)) return;
    if (this._unlocked) this._unlocked.add(char);
    try {
      await request('/api/progress/unlock', 'POST', { char }, { timeout: 5000 });
    } catch (_err) {
      // Progress is non-blocking; the evolution page should still render.
      // Drop from the dedup set so a later view can retry the unlock.
      if (this._unlocked) this._unlocked.delete(char);
    }
  },

  _refreshBookmarkState(char) {
    const bookmarks = wx.getStorageSync('bookmarks') || [];
    this.setData({ bookmarked: bookmarks.indexOf(char) !== -1 });
  },

  toggleBookmark() {
    if (!this.data.character) return;
    const char = this.data.character.char;
    const bookmarks = wx.getStorageSync('bookmarks') || [];
    const idx = bookmarks.indexOf(char);
    let next;
    if (idx === -1) {
      next = [char, ...bookmarks].slice(0, 200);
      wx.showToast({ title: '已收藏', icon: 'success' });
    } else {
      next = bookmarks.filter((c) => c !== char);
      wx.showToast({ title: '已取消收藏', icon: 'none' });
    }
    wx.setStorageSync('bookmarks', next);
    this.setData({ bookmarked: idx === -1 });
  },

  async loadAiStory() {
    const character = this.data.character;
    if (!character || this.data.aiStoryLoading) return;
    this.setData({ aiStoryLoading: true });
    try {
      const data = await request(`/api/ai/story/${encodeURIComponent(character.char)}`, 'GET', {}, { timeout: 15000 });
      this._recordLearningMetric('aiStoryCount');
      this.setData({ aiStory: data });
    } catch (_err) {
      const first = (character.stages || []).find((stage) => stage.desc || stage.description);
      this.setData({
        aiStory: {
          char: character.char,
          title: `“${character.char}”从哪里来`,
          storyteller: '小字灵',
          story: `“${character.char}”的故事藏在字形变化里。${first ? (first.desc || first.description) : character.meaning} 从古文字到楷书，它把古人观察世界的方式留到了今天。`,
          voiceText: `“${character.char}”的故事藏在字形变化里。${first ? (first.desc || first.description) : character.meaning}`,
          generated: false
        }
      });
      this._recordLearningMetric('aiStoryCount');
    } finally {
      this.setData({ aiStoryLoading: false });
    }
  },

  onAskInput(event) {
    this.setData({ askInput: event.detail.value });
  },

  _getTtsAudio() {
    if (this._ttsAudio) return this._ttsAudio;
    const audio = wx.createInnerAudioContext();
    audio.obeyMuteSwitch = false;
    audio.onEnded(() => {
      this.setData({ ttsPlayingIndex: null });
    });
    audio.onStop(() => {
      this.setData({ ttsPlayingIndex: null });
    });
    audio.onError((err = {}) => {
      this.setData({ ttsLoadingIndex: null, ttsPlayingIndex: null });
      const message = err.errMsg || '朗读失败，请稍后重试';
      wx.showToast({ title: message.slice(0, 18), icon: 'none' });
    });
    this._ttsAudio = audio;
    return audio;
  },

  _stopTts() {
    if (!this._ttsAudio) {
      this.setData({ ttsPlayingIndex: null });
      return;
    }
    try {
      this._ttsAudio.stop();
    } catch (_err) {
      this.setData({ ttsPlayingIndex: null });
    }
  },

  _writeTtsFile(audioBase64, extension = 'mp3') {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      const safeExt = String(extension || 'mp3').replace(/[^a-z0-9]/gi, '') || 'mp3';
      const filePath = `${wx.env.USER_DATA_PATH}/xiao-ziling-tts-${Date.now()}.${safeExt}`;
      fs.writeFile({
        filePath,
        data: audioBase64,
        encoding: 'base64',
        success: () => resolve(filePath),
        fail: reject
      });
    });
  },

  async toggleSpeakMessage(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (this.data.ttsLoadingIndex !== null) return;
    if (this.data.ttsPlayingIndex === index) {
      this._stopTts();
      return;
    }

    const item = (this.data.askMessages || [])[index];
    const text = (item && item.text || '').trim();
    if (!text) return;

    this._stopTts();
    this.setData({ ttsLoadingIndex: index });
    try {
      const data = await request('/api/ai/tts', 'POST', { text }, { timeout: 22000 });
      if (!data || !data.audioBase64) {
        throw new Error('语音合成未返回音频');
      }
      const filePath = await this._writeTtsFile(data.audioBase64, data.extension);
      const audio = this._getTtsAudio();
      audio.src = filePath;
      this.setData({ ttsPlayingIndex: index });
      audio.play();
    } catch (err) {
      const message = err && err.statusCode === 503 ? '语音合成未配置' : '暂时无法朗读';
      wx.showToast({ title: message, icon: 'none' });
    } finally {
      this.setData({ ttsLoadingIndex: null });
    }
  },

  _initVoiceAsk() {
    if (this._voiceManager) return;
    try {
      if (typeof wx.getRecorderManager !== 'function') {
        throw new Error('recorder unavailable');
      }
      const manager = wx.getRecorderManager();
      this._voiceManager = manager;
      this.setData({ voiceAvailable: true, voiceTip: '按住说话问小字灵' });

      manager.onStart(() => {
        this._voiceCanceled = false;
        this._voiceStartAt = Date.now();
        this.setData({
          voiceListening: true,
          voiceRecognizing: false,
          voiceRecognizedText: '',
          voiceTip: '正在听，松开发送'
        });
      });

      manager.onStop(async (res = {}) => {
        const duration = Date.now() - (this._voiceStartAt || Date.now());
        this.setData({
          voiceListening: false,
          voiceRecognizing: true,
          voiceTip: '正在识别...'
        });
        if (this._voiceCanceled) {
          this.setData({ voiceRecognizing: false, voiceTip: '按住说话问小字灵' });
          return;
        }
        if (duration < 800) {
          this.setData({ voiceRecognizing: false, voiceTip: '按住说话问小字灵' });
          wx.showToast({ title: '按住说满1秒再松开', icon: 'none' });
          return;
        }
        if (!res.tempFilePath) {
          this.setData({ voiceRecognizing: false, voiceTip: '按住说话问小字灵' });
          wx.showToast({ title: '没有录到声音', icon: 'none' });
          return;
        }
        try {
          const data = await this._uploadVoiceFile(res.tempFilePath);
          const text = (data && data.text || '').trim();
          this.setData({
            voiceRecognizing: false,
            voiceRecognizedText: text,
            voiceTip: '按住说话问小字灵'
          });
          if (!text) {
            wx.showToast({ title: '没有听清，再试一次', icon: 'none' });
            return;
          }
          this.setData({ askInput: text });
          this.submitAsk();
        } catch (_err) {
          this.setData({ voiceRecognizing: false, voiceTip: '按住说话问小字灵' });
          wx.showToast({ title: (_err.message || '语音识别失败').slice(0, 18), icon: 'none' });
        }
      });

      manager.onError((res = {}) => {
        const message = res.errMsg || '录音失败';
        this.setData({
          voiceListening: false,
          voiceRecognizing: false,
          voiceTip: '按住说话问小字灵'
        });
        wx.showToast({ title: String(message).slice(0, 18), icon: 'none' });
      });
    } catch (_err) {
      this.setData({
        voiceAvailable: false,
        voiceTip: '当前微信版本不支持录音'
      });
    }
  },

  async _uploadVoiceFile(filePath) {
    const app = getApp();
    const baseUrl = (app && app.globalData && app.globalData.apiBaseUrl) || '';
    let token = wx.getStorageSync('token') || '';
    if (!token) {
      try {
        token = await ensureToken();
      } catch (_err) {
        token = wx.getStorageSync('token') || '';
      }
    }
    await new Promise((resolve, reject) => {
      wx.getFileInfo({
        filePath,
        success(info) {
          if (!info.size || info.size < 1200) {
            reject(new Error('录音太短，请说完整一句'));
            return;
          }
          resolve(info);
        },
        fail: () => resolve()
      });
    });
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${baseUrl}/api/ai/asr`,
        filePath,
        name: 'audio',
        timeout: 25000,
        header: {
          'x-openid': token
        },
        formData: {
          format: 'pcm'
        },
        success(res) {
          let data = {};
          try {
            data = JSON.parse(res.data || '{}');
          } catch (_err) {
            reject(new Error('语音识别返回格式异常'));
            return;
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
            return;
          }
          reject(new Error(data.message || `语音识别失败 (${res.statusCode})`));
        },
        fail(err) {
          reject(new Error(err.errMsg || '语音上传失败'));
        }
      });
    }).catch(() => this._uploadVoiceFileAsBase64(filePath));
  },

  _uploadVoiceFileAsBase64(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: async (file) => {
          try {
            const data = await request('/api/ai/asr', 'POST', {
              audioBase64: file.data,
              format: 'pcm'
            }, { timeout: 25000 });
            resolve(data);
          } catch (err) {
            reject(err);
          }
        },
        fail(err) {
          reject(new Error(err.errMsg || '读取录音失败'));
        }
      });
    });
  },

  _ensureRecordPermission() {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: (settings) => {
          if (settings.authSetting['scope.record']) {
            resolve();
            return;
          }
          wx.authorize({
            scope: 'scope.record',
            success: resolve,
            fail: () => {
              wx.showModal({
                title: '需要麦克风权限',
                content: '请在设置中允许使用麦克风后，再按住说话问小字灵。',
                confirmText: '去设置',
                success: (res) => {
                  if (res.confirm) wx.openSetting();
                }
              });
              reject(new Error('未授权录音'));
            }
          });
        },
        fail: () => resolve()
      });
    });
  },

  async startVoiceAsk() {
    if (this.data.askLoading || this.data.voiceListening || this.data.voiceRecognizing) return;
    if (!this._voiceManager) this._initVoiceAsk();
    if (!this._voiceManager) {
      wx.showModal({
        title: '语音输入未启用',
        content: '当前微信版本暂不支持录音，请先用文字提问小字灵。',
        showCancel: false
      });
      return;
    }
    try {
      await this._ensureRecordPermission();
      wx.vibrateShort({ type: 'light' });
      this._voiceCanceled = false;
      this._voiceManager.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 96000,
        format: 'pcm'
      });
    } catch (err) {
      if (err && err.message === '未授权录音') return;
      const message = (err && err.errMsg) || '暂时无法录音';
      wx.showToast({ title: message.slice(0, 18), icon: 'none' });
    }
  },

  finishVoiceAsk() {
    if (!this._voiceManager || !this.data.voiceListening) return;
    this.setData({ voiceTip: '正在识别...' });
    try {
      this._voiceManager.stop();
    } catch (_err) {
      this.setData({ voiceListening: false, voiceRecognizing: false });
    }
  },

  cancelVoiceAsk() {
    if (!this._voiceManager || !this.data.voiceListening) return;
    this._voiceCanceled = true;
    this.setData({ voiceTip: '已取消' });
    try {
      this._voiceManager.stop();
    } catch (_err) {
      this.setData({ voiceListening: false, voiceRecognizing: false });
    }
  },

  async submitAsk() {
    const character = this.data.character;
    if (!character || this.data.askLoading) return;
    const question = (this.data.askInput || '').trim();
    if (!question) {
      wx.showToast({ title: '请输入想问的问题', icon: 'none' });
      return;
    }
    const messages = [
      ...(this.data.askMessages || []),
      { role: 'user', text: question }
    ];
    this.setData({
      askLoading: true,
      askInput: '',
      askMessages: messages
    });
    try {
      const data = await request('/api/ai/ask', 'POST', {
        char: character.char,
        question
      }, { timeout: 15000 });
      this._recordLearningMetric('aiAskCount');
      this.setData({
        askAnswer: data,
        askMessages: [
          ...messages,
          { role: 'assistant', text: data.answer || '小字灵还在想这个问题。' }
        ]
      });
    } catch (_err) {
      const fallbackAnswer = `小字灵暂时无法连线。关于“${character.char}”，可以先看看上面的字形演变与释义。`;
      this.setData({
        askAnswer: { char: character.char, question, answer: fallbackAnswer, generated: false },
        askMessages: [
          ...messages,
          { role: 'assistant', text: fallbackAnswer }
        ]
      });
      this._recordLearningMetric('aiAskCount');
    } finally {
      this.setData({ askLoading: false });
    }
  }

});
