const { request } = require('../../utils/request');
const fallback = require('../../utils/fallback');
const glyphs = require('../../data/glyphs');
const { getOracleSrc } = require('../../utils/oracleSVGs');

const INDEX_LABELS = ['①', '②', '③', '④', '⑤'];

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
    bookmarked: false,
    offline: false,
    loading: false,
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
      catalogReturned: glyphs.catalog.length
    });
    this._fetchCatalog();
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
    this.setData({ catalogFiltered: filtered, catalogReturned: filtered.length });
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
    const item = this.data.catalog[idx - 1];
    if (item) this._loadCharacter(item.char);
  },

  nextChar() {
    const idx = this.data.catalogIndex;
    const catalog = this.data.catalog;
    if (idx < 0 || idx >= catalog.length - 1) return;
    const item = catalog[idx + 1];
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
      enriched.assetStatusText = stage.assetStatus === 'draft'
        ? '待精校'
        : stage.assetStatus === 'reference'
          ? '参考'
          : '';
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
    const catalog = this.data.catalog;
    const catalogIndex = catalog.findIndex((c) => c.char === character.char);
    this.setData({
      query: character.char,
      character: { ...character, stages },
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

  copyGlyph(event) {
    const glyph = event.currentTarget.dataset.glyph;
    wx.setClipboardData({
      data: glyph,
      success() { wx.showToast({ title: '已复制', icon: 'success' }); }
    });
  }
});
