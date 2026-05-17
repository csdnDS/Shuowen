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
  { char: '人', pinyin: 'rén',  hasDetail: true },
  { char: '大', pinyin: 'dà',   hasDetail: true },
  { char: '女', pinyin: 'nǚ',   hasDetail: true },
  { char: '子', pinyin: 'zǐ',   hasDetail: true },
  { char: '山', pinyin: 'shān', hasDetail: true },
  { char: '水', pinyin: 'shuǐ', hasDetail: true },
  { char: '火', pinyin: 'huǒ',  hasDetail: true },
  { char: '木', pinyin: 'mù',   hasDetail: true },
  { char: '日', pinyin: 'rì',   hasDetail: true },
  { char: '月', pinyin: 'yuè',  hasDetail: true },
  { char: '口', pinyin: 'kǒu',  hasDetail: true },
  { char: '手', pinyin: 'shǒu', hasDetail: true },
  { char: '心', pinyin: 'xīn',  hasDetail: true },
  { char: '目', pinyin: 'mù',   hasDetail: true },
  { char: '上', pinyin: 'shàng',hasDetail: true },
  { char: '下', pinyin: 'xià',  hasDetail: true },
  { char: '中', pinyin: 'zhōng',hasDetail: true },
  { char: '王', pinyin: 'wáng', hasDetail: true },
  { char: '文', pinyin: 'wén',  hasDetail: true },
  { char: '字', pinyin: 'zì',   hasDetail: true },
  { char: '言', pinyin: 'yán',  hasDetail: true },
  { char: '说', pinyin: 'shuō', hasDetail: true },
  { char: '行', pinyin: 'xíng', hasDetail: true },
  { char: '土', pinyin: 'tǔ',   hasDetail: true },
  { char: '金', pinyin: 'jīn',  hasDetail: true },
  { char: '天', pinyin: 'tiān', hasDetail: true },
  { char: '年', pinyin: 'nián', hasDetail: true },
  { char: '力', pinyin: 'lì',   hasDetail: true },
  { char: '白', pinyin: 'bái',  hasDetail: true },
  { char: '玉', pinyin: 'yù',   hasDetail: true },
  { char: '石', pinyin: 'shí',  hasDetail: true },
  { char: '刀', pinyin: 'dāo',  hasDetail: true },
  { char: '禾', pinyin: 'hé',   hasDetail: true },
  { char: '竹', pinyin: 'zhú',  hasDetail: true },
  { char: '生', pinyin: 'shēng',hasDetail: true },
  { char: '老', pinyin: 'lǎo',  hasDetail: true },
  { char: '明', pinyin: 'míng', hasDetail: true },
  { char: '龙', pinyin: 'lóng', hasDetail: true },
  { char: '家', pinyin: 'jiā',  hasDetail: true },
  { char: '雨', pinyin: 'yǔ',   hasDetail: true },
  { char: '鸟', pinyin: 'niǎo', hasDetail: true },
  { char: '马', pinyin: 'mǎ',   hasDetail: true },
  { char: '鱼', pinyin: 'yú',   hasDetail: true },
  { char: '羊', pinyin: 'yáng', hasDetail: true },
  { char: '牛', pinyin: 'niú',  hasDetail: true },
  { char: '田', pinyin: 'tián', hasDetail: true },
  { char: '风', pinyin: 'fēng', hasDetail: true },
  { char: '止', pinyin: 'zhǐ',  hasDetail: true },
  { char: '光', pinyin: 'guāng',hasDetail: true },
  { char: '虫', pinyin: 'chóng',hasDetail: true },
  { char: '贝', pinyin: 'bèi',  hasDetail: true },
  { char: '走', pinyin: 'zǒu',  hasDetail: true },
  { char: '来', pinyin: 'lái',  hasDetail: true },
  { char: '东', pinyin: 'dōng', hasDetail: true },
  { char: '西', pinyin: 'xī',   hasDetail: true },
  { char: '正', pinyin: 'zhèng',hasDetail: true },
  { char: '见', pinyin: 'jiàn', hasDetail: true },
  { char: '自', pinyin: 'zì',   hasDetail: true },
  { char: '耳', pinyin: 'ěr',   hasDetail: true },
  { char: '足', pinyin: 'zú',   hasDetail: true },
  { char: '弓', pinyin: 'gōng', hasDetail: true },
  { char: '矢', pinyin: 'shǐ',  hasDetail: true },
  { char: '首', pinyin: 'shǒu', hasDetail: true },
  { char: '面', pinyin: 'miàn', hasDetail: true },
  { char: '斤', pinyin: 'jīn',  hasDetail: true },
  { char: '臣', pinyin: 'chén', hasDetail: true },
  { char: '父', pinyin: 'fù',   hasDetail: true },
  { char: '母', pinyin: 'mǔ',   hasDetail: true },
  { char: '男', pinyin: 'nán',  hasDetail: true },
  { char: '友', pinyin: 'yǒu',  hasDetail: true },
  { char: '名', pinyin: 'míng', hasDetail: true },
  { char: '宝', pinyin: 'bǎo',  hasDetail: true },
  { char: '黑', pinyin: 'hēi',  hasDetail: true },
  { char: '赤', pinyin: 'chì',  hasDetail: true },
  { char: '青', pinyin: 'qīng', hasDetail: true },
  { char: '北', pinyin: 'běi',  hasDetail: true },
  { char: '门', pinyin: 'mén',  hasDetail: true },
  { char: '户', pinyin: 'hù',   hasDetail: true },
  { char: '工', pinyin: 'gōng', hasDetail: true },
  { char: '书', pinyin: 'shū',  hasDetail: true },
  { char: '学', pinyin: 'xué',  hasDetail: true },
  { char: '农', pinyin: 'nóng', hasDetail: true },
  { char: '商', pinyin: 'shāng',hasDetail: true },
  { char: '古', pinyin: 'gǔ',   hasDetail: true },
  { char: '鬼', pinyin: 'guǐ',  hasDetail: true },
  { char: '神', pinyin: 'shén', hasDetail: true },
  { char: '本', pinyin: 'běn',  hasDetail: true },
  { char: '末', pinyin: 'mò',   hasDetail: true },
  { char: '朱', pinyin: 'zhū',  hasDetail: true },
  { char: '果', pinyin: 'guǒ',  hasDetail: true },
  { char: '休', pinyin: 'xiū',  hasDetail: true },
  { char: '采', pinyin: 'cǎi',  hasDetail: true },
  { char: '利', pinyin: 'lì',   hasDetail: true },
  { char: '初', pinyin: 'chū',  hasDetail: true },
  { char: '相', pinyin: 'xiāng',hasDetail: true },
  { char: '主', pinyin: 'zhǔ',  hasDetail: true },
  { char: '信', pinyin: 'xìn',  hasDetail: true },
  { char: '仁', pinyin: 'rén',  hasDetail: true },
  { char: '安', pinyin: 'ān',   hasDetail: true },
  { char: '和', pinyin: 'hé',   hasDetail: true },
  { char: '道', pinyin: 'dào',  hasDetail: true },
  { char: '德', pinyin: 'dé',   hasDetail: true },
  { char: '善', pinyin: 'shàn', hasDetail: true },
  { char: '美', pinyin: 'měi',  hasDetail: true },
  { char: '思', pinyin: 'sī',   hasDetail: true },
  { char: '乐', pinyin: 'lè',   hasDetail: true }
];

const radicals = [
  { radical: '人', pinyin: 'rén',  strokes: 2, meaning: '人物动作相关', examples: ['仁', '从', '众', '休', '信', '仕', '仰', '位'] },
  { radical: '刀', pinyin: 'dāo',  strokes: 2, meaning: '刀刃割切相关', examples: ['分', '切', '刊', '则', '刻', '刺', '剑', '刃'] },
  { radical: '口', pinyin: 'kǒu',  strokes: 3, meaning: '口舌言语相关', examples: ['古', '名', '君', '品', '唱', '问', '吐', '叫'] },
  { radical: '土', pinyin: 'tǔ',   strokes: 3, meaning: '土地地面相关', examples: ['地', '城', '坊', '坛', '墙', '坐', '基', '坏'] },
  { radical: '大', pinyin: 'dà',   strokes: 3, meaning: '大广阔相关',   examples: ['天', '太', '夫', '夷', '奇', '奔', '奥', '奖'] },
  { radical: '女', pinyin: 'nǚ',   strokes: 3, meaning: '女性婚姻相关', examples: ['妇', '妈', '姐', '妹', '嫂', '婆', '姻', '姑'] },
  { radical: '子', pinyin: 'zǐ',   strokes: 3, meaning: '幼童孳生相关', examples: ['字', '孩', '孙', '孝', '孕', '学', '存', '孤'] },
  { radical: '山', pinyin: 'shān', strokes: 3, meaning: '山岳地势相关', examples: ['峰', '岭', '岩', '岳', '峡', '崖', '嶂', '峻'] },
  { radical: '心', pinyin: 'xīn',  strokes: 4, meaning: '情感思维相关', examples: ['思', '想', '念', '忆', '怀', '感', '恩', '志'] },
  { radical: '手', pinyin: 'shǒu', strokes: 4, meaning: '手部动作相关', examples: ['打', '持', '扶', '择', '推', '拿', '握', '搬'] },
  { radical: '日', pinyin: 'rì',   strokes: 4, meaning: '日光时间相关', examples: ['明', '晴', '晖', '晓', '时', '昼', '暮', '星'] },
  { radical: '月', pinyin: 'yuè',  strokes: 4, meaning: '月体阴阳相关', examples: ['朗', '朔', '望', '朝', '期', '朦', '胧', '朋'] },
  { radical: '木', pinyin: 'mù',   strokes: 4, meaning: '树木植物相关', examples: ['林', '森', '枝', '根', '桥', '树', '桌', '板'] },
  { radical: '水', pinyin: 'shuǐ', strokes: 4, meaning: '水流液体相关', examples: ['江', '河', '清', '泉', '海', '洗', '流', '湖'] },
  { radical: '火', pinyin: 'huǒ',  strokes: 4, meaning: '火光热能相关', examples: ['炎', '灯', '炽', '烟', '烛', '焰', '燃', '热'] },
  { radical: '目', pinyin: 'mù',   strokes: 5, meaning: '眼目视觉相关', examples: ['看', '相', '省', '眉', '睡', '眼', '盲', '督'] },
  { radical: '言', pinyin: 'yán',  strokes: 7, meaning: '言语表达相关', examples: ['说', '语', '诗', '话', '论', '读', '议', '词'] },
  { radical: '金', pinyin: 'jīn',  strokes: 8, meaning: '金属器物相关', examples: ['银', '铜', '铁', '铅', '锡', '钢', '针', '钟'] },
  { radical: '禾', pinyin: 'hé',   strokes: 5, meaning: '谷物农作物相关', examples: ['年', '秀', '秋', '种', '积', '稻', '穗', '稼'] },
  { radical: '竹', pinyin: 'zhú',  strokes: 6, meaning: '竹器文具相关', examples: ['笔', '篇', '簿', '箱', '筐', '管', '篮', '筒'] },
  { radical: '雨', pinyin: 'yǔ',   strokes: 8, meaning: '天气气象相关', examples: ['雪', '霜', '露', '雷', '霞', '霓', '雾', '霹'] },
  { radical: '鸟', pinyin: 'niǎo', strokes: 5, meaning: '鸟禽飞翔相关', examples: ['鸡', '鸭', '鹅', '鸽', '鹤', '鸦', '鹰', '雀'] },
  { radical: '马', pinyin: 'mǎ',   strokes: 3, meaning: '马匹驾驭相关', examples: ['驾', '驱', '骑', '驰', '骏', '驹', '驯', '骤'] },
  { radical: '鱼', pinyin: 'yú',   strokes: 8, meaning: '鱼类水产相关', examples: ['鲤', '鲫', '鲸', '鲨', '鳊', '鳍', '鳞', '鲜'] },
  { radical: '羊', pinyin: 'yáng', strokes: 6, meaning: '羊牧祥瑞相关', examples: ['祥', '美', '善', '义', '羔', '群', '羹', '羞'] },
  { radical: '牛', pinyin: 'niú',  strokes: 4, meaning: '牛畜耕作相关', examples: ['牧', '物', '犁', '牲', '犀', '特', '牟', '牺'] },
  { radical: '田', pinyin: 'tián', strokes: 5, meaning: '田地农耕相关', examples: ['男', '留', '畜', '界', '畏', '畔', '甸', '略'] },
  { radical: '止', pinyin: 'zhǐ',  strokes: 4, meaning: '行走停止相关', examples: ['步', '正', '武', '歧', '此', '涉', '歼', '趋'] },
  { radical: '虫', pinyin: 'chóng',strokes: 6, meaning: '虫豸爬行相关', examples: ['蛇', '蝶', '蚂', '蜂', '蛙', '蜘', '蟹', '螃'] },
  { radical: '贝', pinyin: 'bèi',  strokes: 4, meaning: '财货钱币相关', examples: ['财', '货', '贸', '贵', '购', '赋', '贷', '赢'] },
  { radical: '走', pinyin: 'zǒu',  strokes: 7, meaning: '行走奔跑相关', examples: ['赶', '起', '超', '越', '趁', '趋', '趣', '赴'] },
  { radical: '父', pinyin: 'fù',   strokes: 4, meaning: '父辈权威相关', examples: ['父', '爸', '爷', '爹', '翁', '甫', '爰', '釜'] },
  { radical: '母', pinyin: 'mǔ',   strokes: 5, meaning: '母性养育相关', examples: ['母', '妈', '毋', '每', '毒', '海', '梅', '媒'] },
  { radical: '弓', pinyin: 'gōng', strokes: 3, meaning: '弓箭弯曲相关', examples: ['弓', '弹', '强', '张', '弧', '弦', '弱', '引'] },
  { radical: '矢', pinyin: 'shǐ',  strokes: 5, meaning: '箭矢射击相关', examples: ['矢', '知', '短', '矩', '疾', '矮', '候', '族'] },
  { radical: '首', pinyin: 'shǒu', strokes: 9, meaning: '头部领首相关', examples: ['首', '道', '馗', '馘', '馘', '馐', '馑', '馒'] },
  { radical: '黑', pinyin: 'hēi',  strokes: 12, meaning: '黑色暗色相关', examples: ['黑', '墨', '默', '黛', '黔', '黯', '黝', '黢'] }
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
