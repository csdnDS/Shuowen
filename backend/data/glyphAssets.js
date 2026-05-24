import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestPath = path.resolve(__dirname, '../assets/public/commons-glyph-manifest.json');

export const coreGlyphChars = [
  '人', '水', '山', '日', '月', '火', '木', '文', '字', '说',
  '大', '女', '子', '口', '手', '心', '目', '王', '土', '天',
  '力', '禾', '竹', '生', '明', '龙', '家', '老', '雨', '鸟',
  '马', '鱼', '羊', '牛', '田', '风', '止', '光', '虫', '贝',
  '走', '来', '东', '西', '正', '见', '自', '耳', '足', '弓',
  '矢', '首', '面', '斤', '臣', '父', '母', '男', '友', '名',
  '宝', '黑', '赤', '青', '北', '门', '户', '工', '书', '学',
  '农', '商', '古', '鬼', '神', '本', '末', '朱', '果', '休',
  '采', '利', '初', '相', '主', '信', '仁', '安', '和', '道',
  '德', '善', '美', '思', '乐', '色', '长', '高', '多', '少'
];

function loadCommonsManifest() {
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (_error) {
    return { assets: {} };
  }
}

const commonsManifest = loadCommonsManifest();

export const glyphCharVariants = {
  '说': ['說', '说'],
  '龙': ['龍', '龙'],
  '鸟': ['鳥', '鸟'],
  '马': ['馬', '马'],
  '鱼': ['魚', '鱼'],
  '风': ['風', '风'],
  '贝': ['貝', '贝'],
  '见': ['見', '见'],
  '东': ['東', '东'],
  '门': ['門', '门'],
  '书': ['書', '书'],
  '学': ['學', '学'],
  '农': ['農', '农'],
  '宝': ['寶', '宝'],
  '乐': ['樂', '乐'],
  '长': ['長', '长']
};

export const glyphStageMeta = [
  {
    name: '甲骨文',
    era: 'oracle',
    label: '甲骨文',
    period: '商代晚期',
    assetSource: '项目内置甲骨文字形摹写草图，待替换为权威摹本或拓片'
  },
  {
    name: '金文',
    era: 'bronze',
    label: '金文',
    period: '西周至春秋战国',
    assetSource: '项目内置金文字形资产位，待替换为铭文摹本'
  },
  {
    name: '篆书',
    era: 'seal',
    label: '篆书',
    period: '秦代小篆',
    assetSource: '项目内置篆书字形资产位，待替换为《说文》小篆摹本'
  },
  {
    name: '隶书',
    era: 'clerical',
    label: '隶书',
    period: '汉代隶变',
    assetSource: '项目内置隶书字形资产位，待替换为汉隶碑刻摹本'
  },
  {
    name: '楷书',
    era: 'regular',
    label: '楷书',
    period: '唐代以后',
    assetSource: '通行楷书参考字形'
  }
];

function manifestAssetFor(char, era) {
  return commonsManifest.assets?.[`${char}-${era}`] || null;
}

export function getGlyphAssetKey(char, era) {
  return `glyphs/${char}/${era}.svg`;
}

export function createGlyphBaseCharacter(char) {
  return {
    char,
    meaning:
      `“${char}”已纳入百字核心字库，当前为基础条目。已建立五阶段字形资产位，后续可继续补充《说文》释义、古文字考释、权威来源与授权图。`,
    stages: glyphStageMeta.map((stage) => ({
      name: stage.name,
      era: stage.era,
      label: stage.label,
      glyph: char,
      period: stage.period,
      description:
        `“${char}”在${stage.name}阶段的精校说明待补录。当前先提供字形资产入口和基础时代背景，后续会以授权摹本与文献来源逐步替换。`
    }))
  };
}

export function enrichGlyphAssetStages(character) {
  if (!character || !coreGlyphChars.includes(character.char)) return character;

  const stages = (character.stages || []).map((stage, index) => {
    const meta = glyphStageMeta.find((item) => item.name === stage.name) || glyphStageMeta[index];
    if (!meta) return stage;
    const manifestAsset = manifestAssetFor(character.char, stage.era || meta.era);
    let manifestType = '';
    if (manifestAsset?.type === 'stage-glyph-font-reference') {
      manifestType = 'font';
    } else if (manifestAsset?.assetType) {
      manifestType = manifestAsset.assetType;
    } else if (manifestAsset?.contentType === 'image/svg+xml') {
      manifestType = 'svg';
    }

    return {
      ...stage,
      era: stage.era || meta.era,
      label: stage.label || meta.label,
      period: stage.period || meta.period,
      assetKey: manifestAsset?.assetKey || manifestAsset?.key || (Object.prototype.hasOwnProperty.call(stage, 'assetKey') ? stage.assetKey : getGlyphAssetKey(character.char, meta.era)),
      assetType: manifestType || stage.assetType || 'svg',
      assetSource: manifestAsset?.sourceName || manifestAsset?.sourceTitle || stage.assetSource || meta.assetSource,
      assetStatus: manifestAsset?.status || stage.assetStatus || (meta.era === 'regular' ? 'reference' : 'draft'),
      fontGlyph: manifestAsset?.fontGlyph || stage.fontGlyph || glyphCharVariants[character.char]?.[0] || '',
      license: manifestAsset?.license || stage.license || '',
      sourceUrl: manifestAsset?.sourceUrl || stage.sourceUrl || '',
      attribution: manifestAsset?.attribution || stage.attribution || '',
      verifiedAt: manifestAsset?.verifiedAt || stage.verifiedAt || ''
    };
  });

  return {
    ...character,
    stages
  };
}
