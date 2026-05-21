import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMongoDb } from '../db/mongo.js';
import { characterData } from '../data/seedData.js';
import { coreGlyphChars, createGlyphBaseCharacter, enrichGlyphAssetStages, glyphStageMeta } from '../data/glyphAssets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestPath = path.resolve(__dirname, '../assets/public/commons-glyph-manifest.json');

const STATUS_RANK = {
  verified: 4,
  reference: 3,
  draft: 2,
  pending: 1,
  missing: 0
};

async function loadCommonsManifest() {
  try {
    return JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch (_error) {
    return { assets: {} };
  }
}

function summarizeStage(stage, manifestAsset) {
  const status = manifestAsset?.status || stage?.assetStatus || 'missing';
  return {
    name: stage?.name || '',
    era: stage?.era || '',
    status,
    assetKey: manifestAsset?.assetKey || manifestAsset?.key || stage?.assetKey || '',
    sourceUrl: manifestAsset?.sourceUrl || stage?.sourceUrl || '',
    license: manifestAsset?.license || stage?.license || '',
    attribution: manifestAsset?.attribution || stage?.attribution || '',
    verifiedAt: manifestAsset?.verifiedAt || stage?.verifiedAt || ''
  };
}

function buildFallbackCharacters() {
  const richItems = Object.values(characterData).map((item) => enrichGlyphAssetStages(item));
  const richSet = new Set(richItems.map((item) => item.char));
  const baseItems = coreGlyphChars
    .filter((char) => !richSet.has(char))
    .map((char) => enrichGlyphAssetStages(createGlyphBaseCharacter(char)));
  return [...richItems, ...baseItems];
}

async function loadCharacters() {
  const mongoDb = await getMongoDb();
  if (mongoDb) {
    const docs = await mongoDb
      .collection('characters')
      .find(
        { char: { $in: coreGlyphChars } },
        { projection: { _id: 0, char: 1, meaning: 1, stages: 1, hasDetail: 1, source: 1 } }
      )
      .toArray();

    if (docs.length) {
      const byChar = new Map(docs.map((doc) => [doc.char, doc]));
      return coreGlyphChars.map((char) => byChar.get(char) || enrichGlyphAssetStages(createGlyphBaseCharacter(char)));
    }
  }

  const fallbackByChar = new Map(buildFallbackCharacters().map((item) => [item.char, item]));
  return coreGlyphChars.map((char) => fallbackByChar.get(char) || enrichGlyphAssetStages(createGlyphBaseCharacter(char)));
}

function summarizeCharacter(character, manifest) {
  const stagesByEra = new Map((character.stages || []).map((stage) => [stage.era, stage]));
  const stages = glyphStageMeta.map((meta) => {
    const stage = stagesByEra.get(meta.era) || {
      name: meta.name,
      era: meta.era,
      assetStatus: 'missing'
    };
    const manifestAsset = manifest.assets?.[`${character.char}-${meta.era}`];
    return summarizeStage(stage, manifestAsset);
  });

  const statusCounts = stages.reduce((acc, stage) => {
    acc[stage.status] = (acc[stage.status] || 0) + 1;
    return acc;
  }, {});
  const verifiedCount = statusCounts.verified || 0;
  const nonPendingCount = stages.filter((stage) => STATUS_RANK[stage.status] >= STATUS_RANK.draft).length;

  return {
    char: character.char,
    verifiedCount,
    nonPendingCount,
    totalStages: stages.length,
    completionRate: Number((verifiedCount / stages.length).toFixed(3)),
    needsSource: stages
      .filter((stage) => stage.status !== 'verified')
      .map((stage) => stage.era),
    statusCounts,
    stages
  };
}

export async function getGlyphCoverage() {
  const [characters, manifest] = await Promise.all([
    loadCharacters(),
    loadCommonsManifest()
  ]);

  const items = characters.map((character) => summarizeCharacter(character, manifest));
  const totals = items.reduce((acc, item) => {
    acc.characters += 1;
    acc.stages += item.totalStages;
    acc.verifiedStages += item.verifiedCount;
    acc.nonPendingStages += item.nonPendingCount;
    for (const stage of item.stages) {
      acc.statusCounts[stage.status] = (acc.statusCounts[stage.status] || 0) + 1;
    }
    return acc;
  }, {
    characters: 0,
    stages: 0,
    verifiedStages: 0,
    nonPendingStages: 0,
    statusCounts: {}
  });

  return {
    generatedAt: new Date().toISOString(),
    scope: 'core-100',
    totals: {
      ...totals,
      verifiedCharacters: items.filter((item) => item.verifiedCount > 0).length,
      fullyVerifiedCharacters: items.filter((item) => item.verifiedCount === item.totalStages).length,
      verifiedRate: Number((totals.verifiedStages / totals.stages).toFixed(3))
    },
    items,
    gaps: items
      .filter((item) => item.needsSource.length > 0)
      .map((item) => ({
        char: item.char,
        missingEras: item.needsSource
      }))
  };
}
