const { request } = require('../../utils/request');
const fallback = require('../../utils/fallback');

Page({
  data: {
    radicals: [],
    expandedMap: {},
    hasRadicals: false,
    offline: false,
    loading: false,
    keyword: ''
  },

  onLoad() {
    this.fetchRadicals();
  },

  async fetchRadicals() {
    this.setData({ loading: true });
    const storedMap = wx.getStorageSync('radicalExpanded') || {};
    try {
      const data = await request('/api/radicals');
      this._applyRadicals(data, storedMap);
      this.setData({ offline: false });
    } catch (err) {
      this._applyRadicals(fallback.radicals, storedMap);
      this.setData({ offline: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  _applyRadicals(data, storedMap) {
    const radicals = (data || []).map((item) => {
      const expanded = Boolean(storedMap[item.radical]);
      return {
        ...item,
        expanded,
        countText: `${(item.examples || []).length} 字`,
        expandText: expanded ? '收起' : '展开'
      };
    });
    this.setData({
      radicals,
      expandedMap: storedMap,
      hasRadicals: radicals.length > 0
    });
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value });
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

  goToEvolution(event) {
    const char = event.currentTarget.dataset.char;
    if (!char) return;
    wx.setStorageSync('pendingEvolutionChar', char);
    wx.switchTab({ url: '/pages/evolution/evolution' });
  }
});
