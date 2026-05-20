import { getMongoDb } from '../db/mongo.js';
import { radicals } from '../data/seedData.js';

export async function listRadicals() {
  const mongoDb = await getMongoDb();
  if (mongoDb) {
    const docs = await mongoDb
      .collection('radicals')
      .find({}, { projection: { _id: 0 } })
      .sort({ strokes: 1, radical: 1 })
      .toArray();

    if (docs.length) return docs;
  }

  return radicals;
}
