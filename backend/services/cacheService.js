const memoryCache = new Map();

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export async function cacheGet(key) {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (item.expiresAt <= nowSeconds()) {
    memoryCache.delete(key);
    return null;
  }
  return item.value;
}

export async function cacheSet(key, value, ttlSeconds = 60) {
  memoryCache.set(key, {
    value,
    expiresAt: nowSeconds() + Math.max(1, Number(ttlSeconds) || 60)
  });
}
