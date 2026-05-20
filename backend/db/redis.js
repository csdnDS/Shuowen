import { createClient } from 'redis';
import { env } from '../config/env.js';

let clientPromise = null;

export async function getRedisClient() {
  if (!env.redisUrl) return null;

  try {
    if (!clientPromise) {
      clientPromise = (async () => {
        const client = createClient({ url: env.redisUrl });
        client.on('error', (error) => {
          console.warn(`Redis client error: ${error.message}`);
        });
        await client.connect();
        return client;
      })();
    }
    return await clientPromise;
  } catch (error) {
    console.warn(`Redis unavailable, using memory fallback: ${error.message}`);
    clientPromise = null;
    return null;
  }
}

export async function cacheGet(key) {
  const redis = await getRedisClient();
  if (!redis) return null;

  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn(`Redis cache read failed: ${error.message}`);
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = 60) {
  const redis = await getRedisClient();
  if (!redis) return;

  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    console.warn(`Redis cache write failed: ${error.message}`);
  }
}

export async function cacheDel(key) {
  const redis = await getRedisClient();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    console.warn(`Redis cache delete failed: ${error.message}`);
  }
}

export async function closeRedisClient() {
  if (!clientPromise) return;

  try {
    const client = await clientPromise;
    if (client.isOpen) {
      await client.quit();
    }
  } finally {
    clientPromise = null;
  }
}
