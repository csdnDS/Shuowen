import { TOTAL_SHUOWEN_COUNT } from '../data/seedData.js';
import { coreGlyphChars } from '../data/glyphAssets.js';
import { addUserUnlocked, getUserProgressEntries, getUserUnlocked, recordActivity } from '../repositories/userRepository.js';

function toHistory(entries) {
  return entries
    .slice()
    .sort((a, b) => (b.unlockedAt - a.unlockedAt) || ((b.id || 0) - (a.id || 0)))
    .map((entry) => ({
      char: entry.char,
      time: entry.unlockedAt
    }));
}

export async function getProgress(openid) {
  const entries = await getUserProgressEntries(openid);
  const unlocked = entries.map((entry) => entry.char);
  return {
    total: TOTAL_SHUOWEN_COUNT,
    unlocked,
    unlockedCount: unlocked.length,
    history: toHistory(entries)
  };
}

export async function unlockRandomCharacter(openid) {
  const unlockedCharacters = await getUserUnlocked(openid);
  const pool = coreGlyphChars;
  const candidates = pool.filter((char) => !unlockedCharacters.includes(char));
  const unlockedChar =
    candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : pool[Math.floor(Math.random() * pool.length)];

  return unlockCharacter(openid, unlockedChar);
}

export async function unlockCharacter(openid, char) {
  const normalizedChar = Array.from(String(char || '').trim())[0];
  if (!normalizedChar) {
    const error = new Error('缺少要解锁的汉字');
    error.statusCode = 400;
    throw error;
  }

  await getUserProgressEntries(openid);
  const result = await addUserUnlocked(openid, normalizedChar);
  await recordActivity(openid, 'unlock_character', {
    char: normalizedChar,
    isNew: result.isNew
  });

  return {
    unlockedChar: normalizedChar,
    isNew: result.isNew,
    unlockedAt: result.unlockedAt,
    total: TOTAL_SHUOWEN_COUNT,
    unlocked: result.unlocked,
    unlockedCount: result.unlocked.length,
    history: toHistory(result.entries)
  };
}
