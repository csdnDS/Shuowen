import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { env } from '../config/env.js';
import { coreGlyphChars, glyphCharVariants } from '../data/glyphAssets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicRoot = path.resolve(__dirname, '../assets/public');
const manifestPath = path.join(publicRoot, 'commons-glyph-manifest.json');
const ERAS = ['oracle', 'bronze', 'seal', 'clerical', 'regular'];

const META = {
  oracle: {
    assetType: 'svg',
    sourceName: '项目内置甲骨文字形参考摹写',
    sourceTitle: 'Shuowen oracle reference drawing',
    license: 'Project internal reference glyph',
    attribution: 'Shuowen project'
  },
  bronze: {
    assetType: 'font-reference',
    sourceName: '项目内置金文字形参考',
    sourceTitle: 'Shuowen bronze-style reference glyph',
    license: 'Project internal reference glyph',
    attribution: 'Shuowen project'
  },
  seal: {
    assetType: 'font-reference',
    sourceName: '项目内置篆书参考字形',
    sourceTitle: 'Shuowen seal-style reference glyph',
    license: 'Project internal reference glyph',
    attribution: 'Shuowen project'
  }
};

async function loadManifest() {
  try {
    return JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch (_error) {
    return { generatedAt: '', assets: {} };
  }
}

function fontGlyph(char) {
  return glyphCharVariants[char]?.[0] || char;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function updateMongo(records) {
  if (!env.mongoUri || !records.length) return 0;
  const client = new MongoClient(env.mongoUri);
  await client.connect();
  try {
    const db = client.db(env.mongoDbName);
    let modified = 0;
    for (const record of records) {
      const result = await db.collection('characters').updateOne(
        { char: record.char, 'stages.era': record.era },
        {
          $set: {
            'stages.$.assetKey': record.assetKey,
            'stages.$.assetType': record.assetType,
            'stages.$.assetSource': record.sourceName,
            'stages.$.assetStatus': record.status,
            'stages.$.fontGlyph': record.fontGlyph || '',
            'stages.$.license': record.license,
            'stages.$.sourceUrl': record.sourceUrl,
            'stages.$.attribution': record.attribution,
            'stages.$.verifiedAt': record.verifiedAt,
            updatedAt: new Date()
          }
        }
      );
      modified += result.modifiedCount;
    }
    return modified;
  } finally {
    await client.close();
  }
}

async function main() {
  const manifest = await loadManifest();
  manifest.generatedAt = new Date().toISOString();
  manifest.assets ||= {};

  const verifiedAt = new Date().toISOString();
  const imported = [];
  const skipped = [];

  for (const char of coreGlyphChars) {
    for (const era of ERAS) {
      const key = `${char}-${era}`;
      const existing = manifest.assets[key];
      if (existing?.status === 'verified') continue;
      if (!META[era]) continue;

      const meta = META[era];
      const assetKey = meta.assetType === 'svg' ? `glyphs/${char}/${era}.svg` : '';
      if (assetKey && !(await fileExists(path.join(publicRoot, assetKey)))) {
        skipped.push({ char, era, reason: 'missing local svg' });
        continue;
      }

      const record = {
        type: meta.assetType === 'svg' ? 'stage-glyph-svg-reference' : 'stage-glyph-font-reference',
        char,
        era,
        key: assetKey,
        assetKey,
        assetType: meta.assetType,
        fontGlyph: meta.assetType === 'svg' ? '' : fontGlyph(char),
        sourceUrl: '',
        originalUrl: '',
        status: 'verified',
        contentType: meta.assetType === 'svg' ? 'image/svg+xml' : 'text/reference',
        verifiedAt,
        ...meta
      };
      manifest.assets[key] = record;
      imported.push(record);
    }
  }

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  const mongoModified = await updateMongo(imported);
  console.log(JSON.stringify({
    ok: true,
    imported: imported.length,
    skipped,
    mongoModified,
    manifestPath
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
