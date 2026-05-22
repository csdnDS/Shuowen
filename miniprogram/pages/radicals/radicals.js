const { request } = require('../../utils/request');
const fallback = require('../../utils/fallback');
const glyphs = require('../../data/glyphs');

Page({
  data: {
    radicals: [],
    expandedMap: {},
    hasRadicals: false,
    offline: false,
    loading: false,
    keyword: '',
    resultCount: 0
  },

  _allRadicals: [],

  onLoad() {
    this.fetchRadicals();
  },

  onShow() {
    const pending = wx.getStorageSync('pendingRadicalKeyword');
    if (!pending) return;
    wx.removeStorageSync('pendingRadicalKeyword');
    this.setData({ keyword: pending });
    this._expandRadical(pending);
    this._filterAndSet(pending);
  },

  async fetchRadicals() {
    this.setData({ loading: true });
    try {
      const data = await request('/api/radicals');
      this._applyRadicals(data);
      this.setData({ offline: false });
    } catch (err) {
      this._applyRadicals(fallback.radicals);
      this.setData({ offline: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  _applyRadicals(data) {
    // Read fresh: onShow may have written radicalExpanded after fetchRadicals
    // started, so a snapshot taken before the await would be stale.
    const storedMap = wx.getStorageSync('radicalExpanded') || {};
    this._allRadicals = (data || []).map((item) => {
      const expanded = Boolean(storedMap[item.radical]);
      const annotatedExamples = (item.examples || []).map((char) => ({
        char,
        hasDetail: Boolean(glyphs.byChar[char])
      }));
      return {
        ...item,
        examples: annotatedExamples,
        expanded,
        countText: `${annotatedExamples.length} 字`,
        detailCount: annotatedExamples.filter((e) => e.hasDetail).length,
        expandText: expanded ? '收起' : '展开'
      };
    });
    this.setData({ expandedMap: storedMap });
    this._filterAndSet(this.data.keyword);
  },

  _filterAndSet(keyword) {
    const kw = (keyword || '').trim();
    let radicals;
    if (!kw) {
      radicals = this._allRadicals;
    } else {
      const kwLower = kw.toLowerCase();
      radicals = this._allRadicals.filter((item) =>
        item.radical.includes(kw) ||
        (item.meaning || '').includes(kw) ||
        (item.examples || []).some((e) => (e.char || e).includes(kw)) ||
        (item.pinyin || '').toLowerCase().startsWith(kwLower)
      );
    }
    this.setData({
      radicals,
      hasRadicals: radicals.length > 0,
      resultCount: radicals.length
    });
  },

  onKeywordInput(event) {
    const keyword = event.detail.value;
    this.setData({ keyword });
    this._filterAndSet(keyword);
  },

  clearKeyword() {
    this.setData({ keyword: '' });
    this._filterAndSet('');
  },

  toggleRadical(event) {
    const radical = event.currentTarget.dataset.radical;
    const expandedMap = {
      ...this.data.expandedMap,
      [radical]: !this.data.expandedMap[radical]
    };
    const radicals = this.data.radicals.map((item) => {
      if (item.radical !== radical) return item;
      const expanded = Boolean(expandedMap[radical]);
      return {
        ...item,
        expanded,
        expandText: expanded ? '收起' : '展开'
      };
    });
    wx.setStorageSync('radicalExpanded', expandedMap);
    this.setData({ expandedMap, radicals });
  },

  _expandRadical(radical) {
    if (!radical) return;
    const expandedMap = {
      ...this.data.expandedMap,
      [radical]: true
    };
    this._allRadicals = this._allRadicals.map((item) => {
      if (item.radical !== radical) return item;
      return {
        ...item,
        expanded: true,
        expandText: '收起'
      };
    });
    wx.setStorageSync('radicalExpanded', expandedMap);
    this.setData({ expandedMap });
  },

  goToEvolution(event) {
    const char = event.currentTarget.dataset.char;
    if (!char) return;
    wx.setStorageSync('pendingEvolutionChar', char);
    wx.switchTab({ url: '/pages/evolution/evolution' });
  }
});
