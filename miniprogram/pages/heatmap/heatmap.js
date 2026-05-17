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

// Base heat indices per area (weekday peak reference)
const BASE_HEAT = {
  zisheng:  92,
  dadao:    78,
  shuzhong: 64,
  liushu:   55,
  xushenmu: 48
};

// Time-of-day multiplier: 0-23 hours
function timeMultiplier(hour) {
  if (hour < 7)  return 0.15;   // Pre-opening
  if (hour < 9)  return 0.45;   // Early morning
  if (hour < 10) return 0.70;   // Opening rush
  if (hour < 12) return 0.95;   // Morning peak
  if (hour < 14) return 1.00;   // Midday peak
  if (hour < 16) return 0.90;   // Afternoon
  if (hour < 17) return 0.75;   // Late afternoon
  if (hour < 18) return 0.55;   // Pre-close
  if (hour < 20) return 0.30;   // Evening (some areas open)
  return 0.10;                   // Night
}

// Weekend boost for most-visited areas
function weekendBoost(id, isWeekend) {
  if (!isWeekend) return 1.0;
  const boosts = { zisheng: 1.15, dadao: 1.12, shuzhong: 1.05, liushu: 1.08, xushenmu: 1.03 };
  return boosts[id] || 1.0;
}

function simulateHeat(id) {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const base = BASE_HEAT[id] || 50;
  const timeMult = timeMultiplier(hour);
  const wkMult = weekendBoost(id, isWeekend);
  const raw = base * timeMult * wkMult;
  const noise = (Math.random() - 0.5) * 8;
  return Math.min(100, Math.max(0, Math.round(raw + noise)));
}

function visitAdvice(hour) {
  if (hour < 9)  return { tip: '当前为清晨，园区人少，适合安静游览。', icon: '🌅' };
  if (hour < 11) return { tip: '上午时段，游客量适中，是参观字书珍本的好时机。', icon: '☀️' };
  if (hour < 13) return { tip: '接近午间高峰，字圣广场与六书大道最为热闹。', icon: '🔆' };
  if (hour < 15) return { tip: '午后高峰时段，建议优先前往许慎墓等较清静区域。', icon: '🌡️' };
  if (hour < 17) return { tip: '下午游客量开始下降，适合在叔重堂细品字书。', icon: '🌤️' };
  if (hour < 19) return { tip: '傍晚时分，园内灯光渐起，别有一番古韵。', icon: '🌆' };
  return { tip: '夜间园区客流稀少，部分区域已关闭，请注意游览时间。', icon: '🌙' };
}

Page({
  data: {
    areas: [],
    active: null,
    detailVisible: false,
    offline: false,
    loading: false,
    lastUpdated: '',
    visitTip: '',
    visitIcon: '',
    legend: [
      { color: '#94A3B8', label: '清静', range: '< 55' },
      { color: '#F59E0B', label: '适中', range: '55–69' },
      { color: '#EA580C', label: '较热', range: '70–84' },
      { color: '#DC2626', label: '高热', range: '≥ 85' }
    ]
  },

  _refreshTimer: null,

  onLoad() {
    this.fetchHeatmap();
  },

  onShow() {
    if (this.data.offline) {
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
      this._applyAreas(list);
      this.setData({ offline: false });
    } catch (err) {
      // Generate time-aware simulated data for offline mode
      const simulated = KNOWN_IDS.map((id) => ({
        id,
        name: (fallback.heatmap.areas.find((a) => a.id === id) || {}).name || id,
        heat: simulateHeat(id)
      }));
      this._applyAreas(simulated);
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
    const advice = visitAdvice(now.getHours());
    this.setData({ areas, lastUpdated: timeStr, visitTip: advice.tip, visitIcon: advice.icon });
    if (this.data.active) {
      const refreshed = areas.find((a) => a.id === this.data.active.id);
      if (refreshed) this.setData({ active: refreshed });
    }
  },

  _startAutoRefresh() {
    this._stopAutoRefresh();
    this._refreshTimer = setInterval(() => {
      const simulated = KNOWN_IDS.map((id) => ({
        id,
        name: (this.data.areas.find((a) => a.id === id) || {}).name || id,
        heat: simulateHeat(id)
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
