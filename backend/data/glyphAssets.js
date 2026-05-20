export const coreGlyphChars = ['说', '文', '字', '人', '水', '山', '日', '月', '火', '木'];

export const glyphCharVariants = {
  '说': ['說', '说']
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

export function getGlyphAssetKey(char, era) {
  return `glyphs/${char}/${era}.svg`;
}

export function enrichGlyphAssetStages(character) {
  if (!character || !coreGlyphChars.includes(character.char)) return character;

  const stages = (character.stages || []).map((stage, index) => {
    const meta = glyphStageMeta.find((item) => item.name === stage.name) || glyphStageMeta[index];
    if (!meta) return stage;

    return {
      ...stage,
      era: stage.era || meta.era,
      label: stage.label || meta.label,
      period: stage.period || meta.period,
      assetKey: stage.assetKey || getGlyphAssetKey(character.char, meta.era),
      assetType: stage.assetType || 'svg',
      assetSource: stage.assetSource || meta.assetSource,
      assetStatus: stage.assetStatus || (meta.era === 'regular' ? 'reference' : 'draft'),
      license: stage.license || '',
      sourceUrl: stage.sourceUrl || '',
      attribution: stage.attribution || '',
      verifiedAt: stage.verifiedAt || ''
    };
  });

  return {
    ...character,
    stages
  };
}
