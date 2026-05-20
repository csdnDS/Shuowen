import { MongoClient } from 'mongodb';
import { env } from '../config/env.js';

let clientPromise = null;

export async function getMongoDb() {
  if (!env.mongoUri) return null;

  try {
    if (!clientPromise) {
      clientPromise = new MongoClient(env.mongoUri).connect();
    }
    const client = await clientPromise;
    return client.db(env.mongoDbName);
  } catch (error) {
    console.warn(`MongoDB unavailable, using memory fallback: ${error.message}`);
    clientPromise = null;
    return null;
  }
}
