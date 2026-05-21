import { getMysqlPool } from '../db/mysql.js';

const memoryUsers = new Map();
const memoryActivities = new Map();
const userProgress = new Map();

function parsePayload(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return {};
  }
}

export async function saveUser(profile) {
  const mysqlPool = await getMysqlPool();
  if (mysqlPool) {
    await mysqlPool.execute(
      `INSERT INTO users (openid, nickname, avatar_url, updated_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), avatar_url = VALUES(avatar_url), updated_at = NOW()`,
      [profile.openid, profile.nickname, profile.avatarUrl]
    );
    return profile;
  }

  memoryUsers.set(profile.openid, {
    ...(memoryUsers.get(profile.openid) || {}),
    ...profile,
    updatedAt: Date.now()
  });
  return memoryUsers.get(profile.openid);
}

export async function findUser(openid) {
  const mysqlPool = await getMysqlPool();
  if (mysqlPool) {
    const [rows] = await mysqlPool.execute(
      'SELECT openid, nickname, avatar_url AS avatarUrl, created_at AS createdAt FROM users WHERE openid = ? LIMIT 1',
      [openid]
    );
    return rows[0] || null;
  }

  return memoryUsers.get(openid) || null;
}

export async function recordActivity(openid, type, payload = {}) {
  const activity = {
    id: `${openid}-${type}-${Date.now()}`,
    openid,
    type,
    payload,
    createdAt: Date.now()
  };
  const mysqlPool = await getMysqlPool();
  if (mysqlPool) {
    await mysqlPool.execute(
      'INSERT INTO activities (openid, type, payload_json, created_at) VALUES (?, ?, ?, NOW())',
      [openid, type, JSON.stringify(payload)]
    );
    return activity;
  }

  const list = memoryActivities.get(openid) || [];
  memoryActivities.set(openid, [activity, ...list].slice(0, 50));
  return activity;
}

export async function listActivities(openid) {
  const mysqlPool = await getMysqlPool();
  if (mysqlPool) {
    const [rows] = await mysqlPool.execute(
      'SELECT id, type, payload_json AS payload, created_at AS createdAt FROM activities WHERE openid = ? ORDER BY created_at DESC LIMIT 20',
      [openid]
    );
    return rows.map((row) => ({
      ...row,
      payload: parsePayload(row.payload)
    }));
  }

  return memoryActivities.get(openid) || [];
}

export async function getUserUnlocked(openid) {
  const entries = await getUserProgressEntries(openid);
  return entries.map((entry) => entry.char);
}

export async function getUserProgressEntries(openid) {
  const mysqlPool = await getMysqlPool();
  if (mysqlPool) {
    const [rows] = await mysqlPool.execute(
      'SELECT id, char_value AS charValue, unlocked_at AS unlockedAt FROM user_progress WHERE openid = ? ORDER BY unlocked_at ASC, id ASC',
      [openid]
    );
    if (rows.length) {
      return rows.map((row) => ({
        id: row.id,
        char: row.charValue,
        unlockedAt: row.unlockedAt instanceof Date ? row.unlockedAt.getTime() : new Date(row.unlockedAt).getTime()
      }));
    }

    await Promise.all(
      ['说', '文', '人'].map((char) =>
        mysqlPool.execute(
          'INSERT IGNORE INTO user_progress (openid, char_value, unlocked_at) VALUES (?, ?, NOW())',
          [openid, char]
        )
      )
    );
    return getUserProgressEntries(openid);
  }

  if (!userProgress.has(openid)) {
    const now = Date.now();
    userProgress.set(openid, ['说', '文', '人'].map((char, index) => ({
      id: index + 1,
      char,
      unlockedAt: now + index
    })));
  }
  return userProgress.get(openid);
}

export async function addUserUnlocked(openid, char) {
  const mysqlPool = await getMysqlPool();
  if (mysqlPool) {
    const [result] = await mysqlPool.execute(
      'INSERT IGNORE INTO user_progress (openid, char_value, unlocked_at) VALUES (?, ?, NOW())',
      [openid, char]
    );
    const entries = await getUserProgressEntries(openid);
    return {
      entries,
      unlocked: entries.map((entry) => entry.char),
      isNew: result.affectedRows > 0,
      unlockedAt: (entries.find((entry) => entry.char === char) || {}).unlockedAt || Date.now()
    };
  }

  const entries = await getUserProgressEntries(openid);
  const isNew = !entries.some((entry) => entry.char === char);
  let nextEntries = entries;
  if (isNew) {
    nextEntries = [...entries, { id: entries.length + 1, char, unlockedAt: Date.now() }];
    userProgress.set(openid, nextEntries);
  }
  return {
    entries: nextEntries,
    unlocked: nextEntries.map((entry) => entry.char),
    isNew,
    unlockedAt: (nextEntries.find((entry) => entry.char === char) || {}).unlockedAt || Date.now()
  };
}

export function getMemoryStats() {
  return {
    users: memoryUsers.size,
    totalActivities: [...memoryActivities.values()].reduce((acc, list) => acc + list.length, 0),
    totalUnlocked: [...userProgress.values()].reduce((acc, list) => acc + list.length, 0),
    userProgressEntries: [...userProgress.entries()]
  };
}
