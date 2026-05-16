const { request } = require('../../utils/request');
const fallback = require('../../utils/fallback');

const LAYOUT_IDS = {
  zisheng: true,
  dadao: true,
  shuzhong: true,
  liushu: true,
  xushenmu: true
};

// Heat color (refined, no longer terra-cotta palette)
function heatColor(heat) {
  if (heat >= 85) return '#DC2626';
  if (heat >= 70) return '#EA580C';
  if (heat >= 55) return '#F59E0B';
  return '#94A3B8';
}

function heatLabel(heat) {
  if (heat >= 85) return '高热';
  if (heat >= 70) return '较热';
  if (heat >= 55) return '适中';
  return '清静';
}

Page({
  data: {
    areas: [],
    active: null,
    detailVisible: false,
    offline: false,
    loading: false,
    legend: [
      { color: '#94A3B8', label: '清静', range: '0–54' },
      { color: '#F59E0B', label: '适中', range: '55–69' },
      { color: '#EA580C', label: '较热', range: '70–84' },
      { color: '#DC2626', label: '高热', range: '85–100' }
    ]
  },

  onLoad() {
    this.fetchHeatmap();
  },

  async fetchHeatmap() {
    this.setData({ loading: true });
    try {
      const data = await request('/api/heatmap');
      const list = Array.isArray(data) ? data : data.areas || [];
      this._applyAreas(list);
      this.setData({ offline: false });
    } catch (err) {
      this._applyAreas(fallback.heatmap.areas);
      this.setData({ offline: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  _applyAreas(list) {
    const areas = (list || [])
      .filter((item) => LAYOUT_IDS[item.id])
      .sort((a, b) => b.heat - a.heat)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
        color: heatColor(item.heat),
        heatLabel: heatLabel(item.heat)
      }));
    this.setData({ areas });
    if (this.data.active && areas.length) {
      const refreshed = areas.find((a) => a.id === this.data.active.id);
      if (refreshed) this.setData({ active: refreshed });
    }
  },

  selectArea(event) {
    const id = event.currentTarget.dataset.id;
    const active = this.data.areas.find((item) => item.id === id);
    if (!active) return;
    wx.vibrateShort({ type: 'light' });
    this.setData({ active, detailVisible: true });
  },

  hideDetail() {
    this.setData({ detailVisible: false });
  },

  refreshHeatmap() {
    this.fetchHeatmap();
  }
});
