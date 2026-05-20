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
  const mysqlPool = await getMysqlPool();
  if (mysqlPool) {
    const [rows] = await mysqlPool.execute(
      'SELECT char_value AS charValue FROM user_progress WHERE openid = ? ORDER BY unlocked_at ASC',
      [openid]
    );
    if (rows.length) return rows.map((row) => row.charValue);

    await Promise.all(
      ['说', '文', '人'].map((char) =>
        mysqlPool.execute(
          'INSERT IGNORE INTO user_progress (openid, char_value, unlocked_at) VALUES (?, ?, NOW())',
          [openid, char]
        )
      )
    );
    return ['说', '文', '人'];
  }

  if (!userProgress.has(openid)) {
    userProgress.set(openid, ['说', '文', '人']);
  }
  return userProgress.get(openid);
}

export async function addUserUnlocked(openid, char) {
  const mysqlPool = await getMysqlPool();
  if (mysqlPool) {
    await mysqlPool.execute(
      'INSERT IGNORE INTO user_progress (openid, char_value, unlocked_at) VALUES (?, ?, NOW())',
      [openid, char]
    );
    return getUserUnlocked(openid);
  }

  const unlocked = await getUserUnlocked(openid);
  if (!unlocked.includes(char)) {
    userProgress.set(openid, [...unlocked, char]);
  }
  return getUserUnlocked(openid);
}

export function getMemoryStats() {
  return {
    users: memoryUsers.size,
    totalActivities: [...memoryActivities.values()].reduce((acc, list) => acc + list.length, 0),
    totalUnlocked: [...userProgress.values()].reduce((acc, list) => acc + list.length, 0),
    userProgressEntries: [...userProgress.entries()]
  };
}
