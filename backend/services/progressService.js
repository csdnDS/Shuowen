import { presetCharacters, TOTAL_SHUOWEN_COUNT } from '../data/seedData.js';
import { addUserUnlocked, getUserUnlocked, recordActivity } from '../repositories/userRepository.js';
import { updateLeaderboard } from './leaderboardService.js';

export async function getProgress(openid) {
  const unlocked = await getUserUnlocked(openid);
  return {
    total: TOTAL_SHUOWEN_COUNT,
    unlocked,
    unlockedCount: unlocked.length
  };
}

export async function unlockRandomCharacter(openid) {
  const unlockedCharacters = await getUserUnlocked(openid);
  const candidates = presetCharacters.filter((char) => !unlockedCharacters.includes(char));
  const unlockedChar =
    candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : presetCharacters[Math.floor(Math.random() * presetCharacters.length)];

  let nextUnlocked = unlockedCharacters;
  if (!unlockedCharacters.includes(unlockedChar)) {
    nextUnlocked = await addUserUnlocked(openid, unlockedChar);
    await updateLeaderboard(openid, nextUnlocked.length);
  }

  await recordActivity(openid, 'unlock_character', { char: unlockedChar, isNew: candidates.length > 0 });

  return {
    unlockedChar,
    isNew: candidates.length > 0,
    total: TOTAL_SHUOWEN_COUNT,
    unlocked: nextUnlocked,
    unlockedCount: nextUnlocked.length
  };
}
