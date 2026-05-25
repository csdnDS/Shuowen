import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { coreGlyphChars, getGlyphAssetKey, glyphStageMeta } from '../data/glyphAssets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const oracleModulePath = path.resolve(__dirname, '../../miniprogram/utils/oracleSVGs.js');
const { getOracleSvgMap } = require(oracleModulePath);

const generatedRoot = path.resolve(__dirname, '../assets/public');
const oracleDir = path.join(generatedRoot, 'oracle');
const glyphDir = path.join(generatedRoot, 'glyphs');
const manifestPath = path.join(generatedRoot, 'manifest.json');
const commonsManifestPath = path.join(generatedRoot, 'commons-glyph-manifest.json');

async function loadCommonsManifest() {
  try {
    return JSON.parse(await fs.readFile(commonsManifestPath, 'utf8'));
  } catch (_error) {
    return { assets: {} };
  }
}

function textSvg(char, stage) {
  const fontMap = {
    bronze: 'STKaiti, KaiTi, serif',
    seal: 'STSong, Songti SC, serif',
    clerical: 'STLiti, LiSu, KaiTi, serif',
    regular: 'PingFang SC, Helvetica Neue, sans-serif'
  };
  const labelMap = {
    bronze: '金文资产位',
    seal: '小篆资产位',
    clerical: '隶书资产位',
    regular: '楷书参考'
  };

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="7" y="7" width="86" height="86" rx="10" fill="#faf7f0" stroke="#d4af37" stroke-width="1.2" opacity="0.9"/>
  <text x="50" y="57" text-anchor="middle" dominant-baseline="middle" fill="#1a1a1a" font-size="54" font-family="${fontMap[stage.era] || 'serif'}">${char}</text>
  <text x="50" y="86" text-anchor="middle" fill="#9a7a2f" font-size="8" font-family="PingFang SC, sans-serif">${labelMap[stage.era] || stage.label}</text>
</svg>`;
}

async function writeOracleAssets() {
  const svgMap = getOracleSvgMap();
  const entries = Object.entries(svgMap);
  const commonsManifest = await loadCommonsManifest();
  const verifiedKeys = new Set(
    Object.values(commonsManifest.assets || {})
      .filter((asset) => asset.status === 'verified')
      .map((asset) => asset.key)
  );

  await fs.mkdir(oracleDir, { recursive: true });
  await fs.mkdir(glyphDir, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    assets: {}
  };

  await Promise.all(entries.map(async ([char, svg]) => {
    const key = `oracle/${char}.svg`;
    const filePath = path.join(generatedRoot, key);
    await fs.writeFile(filePath, svg, 'utf8');
    manifest.assets[char] = {
      type: 'oracle-svg',
      key,
      contentType: 'image/svg+xml'
    };
  }));

  await Promise.all(coreGlyphChars.flatMap((char) => glyphStageMeta.map(async (stage) => {
    const key = getGlyphAssetKey(char, stage.era);
    const filePath = path.join(generatedRoot, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    if (verifiedKeys.has(key)) {
      const asset = commonsManifest.assets[`${char}-${stage.era}`];
      manifest.assets[`${char}-${stage.era}`] = {
        ...asset,
        preserved: true
      };
      return;
    }
    const svg = stage.era === 'oracle' && svgMap[char]
      ? svgMap[char]
      : textSvg(char, stage);
    await fs.writeFile(filePath, svg, 'utf8');
    manifest.assets[`${char}-${stage.era}`] = {
      type: 'stage-glyph-svg',
      char,
      era: stage.era,
      key,
      source: stage.assetSource,
      status: stage.era === 'regular' ? 'reference' : 'draft',
      contentType: 'image/svg+xml'
    };
  })));

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}

await writeOracleAssets();
console.log(`已生成本地字形资产：${generatedRoot}`);
