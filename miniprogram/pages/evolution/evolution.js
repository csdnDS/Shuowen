const { request } = require('../../utils/request');
const fallback = require('../../utils/fallback');
const glyphs = require('../../data/glyphs');
const { getOracleSrc } = require('../../utils/oracleSVGs');

const INDEX_LABELS = ['①', '②', '③', '④', '⑤'];
const QUIZ_POOL = ['人', '水', '山', '日', '月', '火', '木', '大', '女', '子', '口', '手', '心', '目', '王', '土', '天', '禾', '竹', '生', '明', '龙', '家', '老', '雨', '鸟', '马', '鱼', '羊', '牛', '田', '风'];

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

Page({
  data: {
    query: '说',
    character: null,
    searchHistory: [],
    hasSearchHistory: false,
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
    aiVoicePlaying: false,
    aiPanelExpanded: true,
    dailyRecommendation: null,
    dailyLoading: false,
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

  onLoad(options = {}) {
    const searchHistory = wx.getStorageSync('searchHistory') || [];
    const pendingChar = wx.getStorageSync('pendingEvolutionChar');
    const initialChar = options.char || pendingChar || '人';
    if (pendingChar) wx.removeStorageSync('pendingEvolutionChar');

    // Catalog from bundled data is always available, with backend
    // potentially adding more.
    this.setData({
      searchHistory,
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
    this._loadQuiz();
    this._loadCharacter(initialChar);
  },

  onShow() {
    const pendingChar = wx.getStorageSync('pendingEvolutionChar');
    if (pendingChar) {
      wx.removeStorageSync('pendingEvolutionChar');
      this._loadCharacter(pendingChar);
    }
    if (this.data.character) {
      this._refreshBookmarkState(this.data.character.char);
    }
  },

  onUnload() {
    if (this._debounce) clearTimeout(this._debounce);
    this._stopAiVoice();
  },

  onInput(event) {
    const val = event.detail.value;
    this.setData({ query: val });
    if (this._debounce) clearTimeout(this._debounce);
    this._debounce = setTimeout(() => {
      const trimmed = (val || '').trim();
      if (!trimmed) return;
      const firstChar = Array.from(trimmed)[0];
      // Chinese character — load directly
      if (/[一-鿿㐀-䶿]/.test(firstChar)) {
        this._loadCharacter(firstChar);
        return;
      }
      // ASCII — treat as pinyin prefix search
      const norm = normPinyin(trimmed);
      const match = this.data.catalog.find(
        (item) => normPinyin(item.pinyin) === norm
      ) || this.data.catalog.find(
        (item) => normPinyin(item.pinyin).startsWith(norm)
      );
      if (match) this._loadCharacter(match.char);
    }, 400);
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

  openAssistantActions() {
    wx.showActionSheet({
      itemList: ['每日一字', '猜字游戏', '汉字故事官'],
      success: (res) => {
        if (res.tapIndex === 0 || res.tapIndex === 1) {
          this.setData({ aiPanelExpanded: true });
          this._scrollToSelector('#ai-feature-panel');
        } else if (res.tapIndex === 2) {
          this._scrollToSelector('#ai-story-panel');
        }
      }
    });
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
    if (char) this._loadCharacter(char);
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
      const pool = shuffle(QUIZ_POOL);
      let quiz = null;
      for (const char of pool.slice(0, 12)) {
        const data = await request(`/api/characters/${encodeURIComponent(char)}`, 'GET', {}, { timeout: 8000 });
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
    const bundled = glyphs.byChar[char];
    if (bundled) {
      this._applyCharacter(bundled);
    }
    this.setData({ loading: true });
    try {
      const remote = await request(`/api/characters/${encodeURIComponent(char)}`);
      const merged = this._mergeRemote(bundled, remote);
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
      const data = await request('/api/characters?limit=100');
      // Backend may return characters not in our bundled set; merge while
      // preserving bundled-first ordering.
      const remote = data.items || [];
      const seen = new Set(glyphs.catalog.map((c) => c.char));
      const extras = remote.filter((c) => !seen.has(c.char));
      const merged = glyphs.catalog.concat(extras).slice(0, 100);
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
      assetEnabled: Boolean(stage.assetEnabled)
    }));
    return { ...remote, stages };
  },

  _applyCharacter(character) {
    const stages = (character.stages || []).map((stage, idx) => {
      const enriched = { ...stage, indexLabel: INDEX_LABELS[idx] || '' };
      // Inject SVG oracle bone image for 甲骨文 stage when available
      if (!stage.assetUrl && stage.era === 'oracle') {
        const src = getOracleSrc(character.char);
        if (src) enriched.oracleSrc = src;
      }
      return enriched;
    });
    const searchHistory = this._saveSearchHistory(character.char);
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
      aiVoicePlaying: false,
      compareExpanded: false,
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

  async _unlockViewedCharacter(char) {
    try {
      await request('/api/progress/unlock', 'POST', { char }, { timeout: 5000 });
    } catch (_err) {
      // Progress is non-blocking; the evolution page should still render.
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
    } finally {
      this.setData({ aiStoryLoading: false });
    }
  },

  _stopAiVoice() {
    if (this._aiAudio) {
      this._aiAudio.stop();
      this._aiAudio.destroy();
      this._aiAudio = null;
    }
    this.setData({ aiVoicePlaying: false });
  },

  speakAiStory() {
    const story = this.data.aiStory;
    if (!story || this.data.aiVoicePlaying) return;

    wx.showModal({
      title: '语音播报未启用',
      content: '请先在微信小程序后台添加“同声传译”插件，再把 app.json 中的 WechatSI 插件声明打开。',
      showCancel: false
    });
    return;

    /*
    const plugin = requirePlugin('WechatSI');

    const content = story.voiceText || story.story;
    if (!content) return;
    this.setData({ aiVoicePlaying: true });

    plugin.textToSpeech({
      lang: 'zh_CN',
      tts: true,
      content,
      success: (res) => {
        const audio = wx.createInnerAudioContext();
        this._aiAudio = audio;
        audio.src = res.filename;
        audio.onEnded(() => this._stopAiVoice());
        audio.onError(() => {
          this._stopAiVoice();
          wx.showToast({ title: '语音播报失败', icon: 'none' });
        });
        audio.play();
      },
      fail: () => {
        this._stopAiVoice();
        wx.showToast({ title: '语音合成失败', icon: 'none' });
      }
    });
    */
  },

  stopAiStoryVoice() {
    this._stopAiVoice();
  }
});
