import { getGlyphCoverage } from '../services/glyphCoverageService.js';

const ERA_LABELS = {
  oracle: '甲骨',
  bronze: '金文',
  seal: '篆书',
  clerical: '隶书',
  regular: '楷书'
};

function compactStage(stage) {
  const mark = stage.status === 'verified'
    ? 'V'
    : stage.status === 'reference'
      ? 'R'
      : stage.status === 'draft'
        ? 'D'
        : '-';
  return `${ERA_LABELS[stage.era] || stage.era}:${mark}`;
}

function printText(coverage) {
  const { totals } = coverage;
  console.log(`百字库覆盖率：${totals.verifiedStages}/${totals.stages} verified (${(totals.verifiedRate * 100).toFixed(1)}%)`);
  console.log(`已有真实来源字：${totals.verifiedCharacters}/${totals.characters}`);
  console.log(`全阶段 verified 字：${totals.fullyVerifiedCharacters}/${totals.characters}`);
  console.log('');

  for (const item of coverage.items) {
    const stages = item.stages.map(compactStage).join('  ');
    const missing = item.needsSource.length ? `缺：${item.needsSource.map((era) => ERA_LABELS[era] || era).join('、')}` : '已全量 verified';
    console.log(`${item.char}  ${item.verifiedCount}/${item.totalStages}  ${stages}  ${missing}`);
  }
}

async function main() {
  const coverage = await getGlyphCoverage();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(coverage, null, 2));
    return;
  }

  printText(coverage);
}

try {
  await main();
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
