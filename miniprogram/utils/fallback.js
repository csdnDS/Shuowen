/**
 * Local fallback dataset used when the backend at localhost:3001 is
 * unreachable. Keeps the mini program demoable without running the API.
 */

const characters = {
  '说': {
    char: '说',
    pinyin: 'shuō',
    meaning: '解说、陈述；又作"悦"，喜悦。',
    radical: '言',
    strokes: 9,
    stages: [
      { name: '甲骨文', glyph: '说', desc: '形似口出气、人侧立倾听之状，本义为陈述。' },
      { name: '金文',   glyph: '说', desc: '左从言，右从兑，会意陈说之意。' },
      { name: '小篆',   glyph: '说', desc: '《说文》：说，释也。从言，兑声。' },
      { name: '隶书',   glyph: '说', desc: '笔画化，言旁规整为今体雏形。' },
      { name: '楷书',   glyph: '说', desc: '现代写法，沿用至今。' }
    ]
  },
  '人': {
    char: '人',
    pinyin: 'rén',
    meaning: '指人类、人格、为人。',
    radical: '人',
    strokes: 2,
    stages: [
      { name: '甲骨文', glyph: '人', desc: '象人侧立之形，垂手而立。' },
      { name: '金文',   glyph: '人', desc: '线条圆转，仍保侧立之姿。' },
      { name: '小篆',   glyph: '人', desc: '规整化，形态对称。' },
      { name: '隶书',   glyph: '人', desc: '撇捺分明，奠定楷书基础。' },
      { name: '楷书',   glyph: '人', desc: '撇捺直接，今日通用形。' }
    ]
  },
  '水': {
    char: '水',
    pinyin: 'shuǐ',
    meaning: '水，五行之一。',
    radical: '水',
    strokes: 4,
    stages: [
      { name: '甲骨文', glyph: '水', desc: '象河流之形，三道波纹。' },
      { name: '金文',   glyph: '水', desc: '波纹连贯，已显竖向流动。' },
      { name: '小篆',   glyph: '水', desc: '中竖加左右点，趋于规整。' },
      { name: '隶书',   glyph: '水', desc: '点画分明，结体方正。' },
      { name: '楷书',   glyph: '水', desc: '今日字形。' }
    ]
  }
};

const catalog = [
  { char: '说', pinyin: 'shuō', hasDetail: true },
  { char: '人', pinyin: 'rén',  hasDetail: true },
  { char: '水', pinyin: 'shuǐ', hasDetail: true },
  { char: '山', pinyin: 'shān', hasDetail: false },
  { char: '日', pinyin: 'rì',   hasDetail: false },
  { char: '月', pinyin: 'yuè',  hasDetail: false },
  { char: '火', pinyin: 'huǒ',  hasDetail: false },
  { char: '木', pinyin: 'mù',   hasDetail: false },
  { char: '文', pinyin: 'wén',  hasDetail: false },
  { char: '字', pinyin: 'zì',   hasDetail: false }
];

const radicals = [
  {
    radical: '人',
    name: '人部',
    meaning: '人类与人事相关',
    examples: ['仁', '从', '众', '休', '伐', '位', '何']
  },
  {
    radical: '水',
    name: '水部',
    meaning: '与水、流体相关',
    examples: ['江', '河', '海', '湖', '泉', '波', '流']
  },
  {
    radical: '言',
    name: '言部',
    meaning: '与言语、表达相关',
    examples: ['说', '语', '论', '议', '词', '诗']
  },
  {
    radical: '心',
    name: '心部',
    meaning: '与情感、思维相关',
    examples: ['思', '想', '念', '忆', '怀', '感']
  }
];

const heatmap = {
  areas: [
    { id: 'zisheng',  name: '字圣广场', heat: 92 },
    { id: 'dadao',    name: '六书大道', heat: 78 },
    { id: 'shuzhong', name: '书冢',     heat: 64 },
    { id: 'liushu',   name: '六书亭',   heat: 55 },
    { id: 'xushenmu', name: '许慎墓',   heat: 48 }
  ]
};

const progress = {
  total: 9353,
  unlockedCount: 0,
  unlocked: []
};

const me = {
  user: {
    openid: 'demo',
    nickname: '说文访客',
    avatarUrl: ''
  },
  stats: {
    total: 9353,
    unlockedCount: 0,
    activityCount: 0
  },
  activities: []
};

module.exports = {
  characters,
  catalog,
  radicals,
  heatmap,
  progress,
  me
};
