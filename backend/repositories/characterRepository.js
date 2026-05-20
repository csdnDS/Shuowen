import { getMongoDb } from '../db/mongo.js';
import { characterData, presetCharacters, TOTAL_SHUOWEN_COUNT, works } from '../data/seedData.js';
import { enrichGlyphAssetStages } from '../data/glyphAssets.js';

function createBaseCharacter(char) {
  return {
    char,
    meaning:
      `“${char}”已收录在扩展字库索引中，当前为基础条目。后续可从 MongoDB 的 characters 集合补充《说文》释义、古文字字形与考释来源。`,
    stages: ['甲骨文', '金文', '篆书', '隶书', '楷书'].map((name) => ({
      name,
      glyph: char,
      description:
        `扩展字库暂未录入“${char}”在${name}阶段的精校字形说明。接入 MongoDB 后，可为该阶段保存 glyph、description、source 与 imageKey 等字段。`
    }))
  };
}

function normPinyin(s) {
  return (s || '').toLowerCase()
    .replace(/[āáǎà]/g, 'a').replace(/[ēéěè]/g, 'e')
    .replace(/[īíǐì]/g, 'i').replace(/[ōóǒò]/g, 'o')
    .replace(/[ūúǔù]/g, 'u').replace(/[ǖǘǚǜ]/g, 'v');
}

export async function findCharacter(char) {
  const mongoDb = await getMongoDb();
  if (mongoDb) {
    const doc = await mongoDb.collection('characters').findOne({ char });
    if (doc) {
      const { _id, ...rest } = doc;
      return enrichGlyphAssetStages(rest);
    }
  }

  if (characterData[char]) return enrichGlyphAssetStages(characterData[char]);
  if (presetCharacters.includes(char)) return enrichGlyphAssetStages(createBaseCharacter(char));
  return null;
}

export async function listCharacters(query = '', limit = 80) {
  const mongoDb = await getMongoDb();
  if (mongoDb) {
    const filter = query ? {
      $or: [
        { char: { $regex: query } },
        { pinyin: { $regex: query, $options: 'i' } }
      ]
    } : {};
    const docs = await mongoDb
      .collection('characters')
      .find(filter, { projection: { _id: 0, char: 1, pinyin: 1, radical: 1, strokes: 1, hasDetail: 1 } })
      .limit(limit)
      .toArray();

    if (docs.length) return docs;
  }

  const normalized = query.trim().toLowerCase();
  const richChars = Object.values(characterData).map((d) => ({
    char: d.char,
    pinyin: d.pinyin || '',
    radical: d.radical || '',
    strokes: d.strokes || 0,
    hasDetail: true
  }));
  const richSet = new Set(richChars.map((c) => c.char));
  const baseChars = presetCharacters
    .filter((c) => !richSet.has(c))
    .map((c) => ({ char: c, pinyin: '', radical: '', strokes: 0, hasDetail: false }));
  const all = [...richChars, ...baseChars];

  return all
    .filter((item) => !normalized ||
      item.char.includes(normalized) ||
      normPinyin(item.pinyin).startsWith(normPinyin(normalized)) ||
      (item.radical || '').includes(normalized)
    )
    .slice(0, limit);
}

export async function listWorks() {
  const mongoDb = await getMongoDb();
  if (mongoDb) {
    const docs = await mongoDb
      .collection('works')
      .find({}, { projection: { _id: 0 } })
      .limit(50)
      .toArray();
    if (docs.length) return docs;
  }

  return works;
}

export function getCharacterStats() {
  return {
    total: TOTAL_SHUOWEN_COUNT,
    richEntries: Object.keys(characterData).length
  };
}
