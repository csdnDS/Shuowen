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

const FONT_KEY = 'fonts/moe-li.ttf';
const SOURCE = {
  sourceName: '中華民國教育部隸書字形檔',
  sourceTitle: '教育部隸書字型檔（Version 3.00）',
  sourceUrl: 'https://language.moe.gov.tw/material/info?m=9fe3fb11-c3d5-41f2-b029-6d18a2c2fd0d',
  originalUrl: 'https://language.moe.gov.tw/uploads/files/17694976091079.zip',
  license: 'Creative Commons Attribution-NoDerivs 3.0 Taiwan (CC BY-ND 3.0 TW)',
  attribution: '中華民國教育部'
};

async function loadManifest() {
  try {
    return JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch (_error) {
    return { generatedAt: '', assets: {} };
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
        { char: record.char, 'stages.era': 'clerical' },
        {
          $set: {
            'stages.$.assetKey': record.assetKey,
            'stages.$.assetType': record.assetType,
            'stages.$.assetSource': record.sourceName,
            'stages.$.assetStatus': record.status,
            'stages.$.fontGlyph': record.fontGlyph,
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
  const fontPath = path.join(publicRoot, FONT_KEY);
  await fs.access(fontPath);

  const manifest = await loadManifest();
  manifest.generatedAt = new Date().toISOString();
  manifest.assets ||= {};

  const verifiedAt = new Date().toISOString();
  const records = [];
  const skipped = [];

  for (const char of coreGlyphChars) {
    const key = `${char}-clerical`;
    const existing = manifest.assets[key];
    if (existing?.status === 'verified' && existing?.sourceName !== SOURCE.sourceName) {
      skipped.push({ char, reason: 'existing verified svg' });
      continue;
    }

    const record = {
      type: 'stage-glyph-font-reference',
      char,
      era: 'clerical',
      fontGlyph: glyphCharVariants[char]?.[0] || char,
      key: FONT_KEY,
      assetKey: FONT_KEY,
      assetType: 'font',
      contentType: 'font/ttf',
      status: 'verified',
      verifiedAt,
      ...SOURCE
    };
    manifest.assets[key] = record;
    records.push(record);
  }

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  const mongoModified = await updateMongo(records);

  console.log(JSON.stringify({
    ok: true,
    imported: records.length,
    skipped: skipped.length,
    mongoModified,
    fontKey: FONT_KEY,
    manifestPath
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
