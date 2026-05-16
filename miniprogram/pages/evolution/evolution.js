const { request } = require('../../utils/request');
const fallback = require('../../utils/fallback');
const glyphs = require('../../data/glyphs');

const INDEX_LABELS = ['①', '②', '③', '④', '⑤'];

Page({
  data: {
    query: '说',
    character: null,
    searchHistory: [],
    hasSearchHistory: false,
    catalog: [],
    catalogTotal: 9353,
    catalogReturned: 0,
    bookmarked: false,
    offline: false,
    loading: false
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
      const char = Array.from((val || '').trim())[0];
      if (char) this._loadCharacter(char);
    }, 400);
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
      this.setData({
        catalog: glyphs.catalog.concat(extras).slice(0, 100),
        catalogTotal: data.total || glyphs.total,
        catalogReturned: glyphs.catalog.length + Math.min(extras.length, 100 - glyphs.catalog.length),
        offline: false
      });
    } catch (err) {
      // Bundled catalog already shown; mark offline silently.
      this.setData({ offline: true });
    }
  },

  _mergeRemote(bundled, remote) {
    if (!bundled) return this._normalizeLegacy(remote);
    return {
      ...bundled,
      pinyin: remote.pinyin || bundled.pinyin,
      meaning: remote.meaning || bundled.meaning,
      radical: remote.radical || bundled.radical
    };
  },

  _normalizeLegacy(remote) {
    const stages = (remote.stages || []).map((stage, idx) => ({
      era: ['oracle', 'bronze', 'seal', 'clerical', 'regular'][idx] || 'regular',
      label: stage.name || '',
      glyph: stage.glyph || remote.char,
      desc: stage.desc || stage.description || ''
    }));
    return { ...remote, stages };
  },

  _applyCharacter(character) {
    const stages = (character.stages || []).map((stage, idx) => ({
      ...stage,
      indexLabel: INDEX_LABELS[idx] || ''
    }));
    const searchHistory = this._saveSearchHistory(character.char);
    this.setData({
      query: character.char,
      character: { ...character, stages },
      searchHistory,
      hasSearchHistory: searchHistory.length > 0
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
