const { request } = require('../../utils/request');
const fallback = require('../../utils/fallback');

const KNOWN_IDS = ['zisheng', 'dadao', 'shuzhong', 'liushu', 'xushenmu'];

// Area descriptions for the detail panel
const AREA_DESC = {
  zisheng:  '许慎文化园核心地标，游客最集中区域。许慎雕像与字圣广场依次排列，为打卡热点。',
  dadao:    '贯穿全园的主轴大道，商业展馆与文化长廊沿路分布，人流量持续较高。',
  shuzhong: '叔重堂内陈列历代字书珍本与许慎生平展览，以学术观众为主。',
  liushu:   '六书广场以象形、指事、会意、形声、转注、假借六种造字法为主题造景。',
  xushenmu: '许慎墓位于园区深处，环境清幽，前来祭拜与参观的访客相对较少。'
};

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

// Simulate small ±3 fluctuation for offline/demo mode
function simulateHeat(base) {
  const delta = Math.floor(Math.random() * 7) - 3;
  return Math.min(100, Math.max(0, base + delta));
}

Page({
  data: {
    areas: [],
    active: null,
    detailVisible: false,
    offline: false,
    loading: false,
    lastUpdated: '',
    legend: [
      { color: '#94A3B8', label: '清静', range: '< 55' },
      { color: '#F59E0B', label: '适中', range: '55–69' },
      { color: '#EA580C', label: '较热', range: '70–84' },
      { color: '#DC2626', label: '高热', range: '≥ 85' }
    ]
  },

  _baseHeat: null,
  _refreshTimer: null,

  onLoad() {
    this.fetchHeatmap();
  },

  onShow() {
    // Resume auto-refresh when page is visible
    if (this.data.offline && this._baseHeat) {
      this._startAutoRefresh();
    }
  },

  onHide() {
    this._stopAutoRefresh();
  },

  onUnload() {
    this._stopAutoRefresh();
  },

  async fetchHeatmap() {
    this.setData({ loading: true });
    try {
      const data = await request('/api/heatmap');
      const list = Array.isArray(data) ? data : data.areas || [];
      this._baseHeat = null;
      this._applyAreas(list);
      this.setData({ offline: false });
    } catch (err) {
      // Store base values for simulation
      this._baseHeat = {};
      fallback.heatmap.areas.forEach((a) => { this._baseHeat[a.id] = a.heat; });
      this._applyAreas(fallback.heatmap.areas);
      this.setData({ offline: true });
      this._startAutoRefresh();
    } finally {
      this.setData({ loading: false });
    }
  },

  _applyAreas(list) {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const areas = (list || [])
      .filter((item) => KNOWN_IDS.includes(item.id))
      .sort((a, b) => b.heat - a.heat)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
        color: heatColor(item.heat),
        heatLabel: heatLabel(item.heat),
        desc: AREA_DESC[item.id] || ''
      }));
    this.setData({ areas, lastUpdated: timeStr });
    if (this.data.active) {
      const refreshed = areas.find((a) => a.id === this.data.active.id);
      if (refreshed) this.setData({ active: refreshed });
    }
  },

  _startAutoRefresh() {
    this._stopAutoRefresh();
    this._refreshTimer = setInterval(() => {
      if (!this._baseHeat) return;
      const simulated = KNOWN_IDS.map((id) => ({
        id,
        name: (this.data.areas.find((a) => a.id === id) || {}).name || id,
        heat: simulateHeat(this._baseHeat[id] || 50)
      }));
      this._applyAreas(simulated);
    }, 30000); // every 30s
  },

  _stopAutoRefresh() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
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
    this._stopAutoRefresh();
    this.fetchHeatmap();
  }
});
