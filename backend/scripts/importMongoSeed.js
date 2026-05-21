import { MongoClient } from 'mongodb';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';
import { characterData, radicals, works } from '../data/seedData.js';
import { coreGlyphChars, createGlyphBaseCharacter, enrichGlyphAssetStages } from '../data/glyphAssets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commonsManifestPath = path.resolve(__dirname, '../assets/public/commons-glyph-manifest.json');

function withoutUndefined(value) {
  return JSON.parse(JSON.stringify(value));
}

async function loadCommonsManifest() {
  try {
    return JSON.parse(await fs.readFile(commonsManifestPath, 'utf8'));
  } catch (_error) {
    return { assets: {} };
  }
}

function applyCommonsMetadata(characterItems, commonsManifest) {
  const verifiedByCharEra = new Map(
    Object.values(commonsManifest.assets || {})
      .filter((asset) => asset.status === 'verified' && asset.char && asset.era)
      .map((asset) => [`${asset.char}-${asset.era}`, asset])
  );

  return characterItems.map((character) => ({
    ...character,
    stages: (character.stages || []).map((stage) => {
      const asset = verifiedByCharEra.get(`${character.char}-${stage.era}`);
      if (!asset) return stage;

      return {
        ...stage,
        assetKey: asset.key || stage.assetKey,
        assetType: 'svg',
        assetSource: asset.sourceName,
        assetStatus: 'verified',
        license: asset.license,
        sourceUrl: asset.sourceUrl,
        attribution: asset.attribution,
        verifiedAt: asset.verifiedAt
      };
    })
  }));
}

async function upsertMany(collection, items, keyField) {
  if (!items.length) return { matched: 0, upserted: 0 };

  const result = await collection.bulkWrite(
    items.map((item) => ({
      updateOne: {
        filter: { [keyField]: item[keyField] },
        update: {
          $set: withoutUndefined({
            ...item,
            updatedAt: new Date()
          }),
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        upsert: true
      }
    })),
    { ordered: false }
  );

  return {
    matched: result.matchedCount,
    modified: result.modifiedCount,
    upserted: result.upsertedCount
  };
}

async function ensureIndexes(db) {
  await db.collection('characters').createIndex({ char: 1 }, { unique: true });
  await db.collection('characters').createIndex({ radical: 1 });
  await db.collection('characters').createIndex({ title: 1 });
  await db.collection('characters').createIndex({ pinyin: 1 });
  await db.collection('characters').createIndex({ strokes: 1 });

  await db.collection('works').createIndex({ id: 1 }, { unique: true });
  await db.collection('works').createIndex({ title: 1 });
  await db.collection('works').createIndex({ dynasty: 1 });

  await db.collection('radicals').createIndex({ radical: 1 }, { unique: true });
  await db.collection('radicals').createIndex({ pinyin: 1 });
  await db.collection('radicals').createIndex({ strokes: 1 });
}

async function main() {
  if (!env.mongoUri) {
    throw new Error('MONGO_URI 未配置，请先在 backend/.env 中设置 MongoDB 连接');
  }

  const client = new MongoClient(env.mongoUri);
  await client.connect();

  try {
    const db = client.db(env.mongoDbName);
    await ensureIndexes(db);
    const commonsManifest = await loadCommonsManifest();

    const richItems = Object.values(characterData).map((item) => ({
      ...enrichGlyphAssetStages(item),
      hasDetail: true,
      source: 'seed'
    }));
    const richSet = new Set(richItems.map((item) => item.char));
    const baseCoreItems = coreGlyphChars
      .filter((char) => !richSet.has(char))
      .map((char) => ({
        ...enrichGlyphAssetStages(createGlyphBaseCharacter(char)),
        hasDetail: true,
        source: 'core-glyph-base'
      }));
    const characterItems = applyCommonsMetadata([...richItems, ...baseCoreItems], commonsManifest);
    const workItems = works.map((item) => ({
      ...item,
      source: 'seed'
    }));
    const radicalItems = radicals.map((item) => ({
      ...item,
      source: 'seed'
    }));

    const charactersResult = await upsertMany(db.collection('characters'), characterItems, 'char');
    const worksResult = await upsertMany(db.collection('works'), workItems, 'id');
    const radicalsResult = await upsertMany(db.collection('radicals'), radicalItems, 'radical');

    console.log(JSON.stringify({
      db: env.mongoDbName,
      characters: {
        input: characterItems.length,
        ...charactersResult
      },
      works: {
        input: workItems.length,
        ...worksResult
      },
      radicals: {
        input: radicalItems.length,
        ...radicalsResult
      }
    }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
