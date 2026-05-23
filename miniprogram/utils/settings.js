const SETTINGS_KEY = 'userSettings';
const MISTAKES_KEY = 'quizMistakes';

const DEFAULT_SETTINGS = {
  fontSize: 'medium',
  theme: 'light'
};

function getUserSettings() {
  return {
    ...DEFAULT_SETTINGS,
    ...(wx.getStorageSync(SETTINGS_KEY) || {})
  };
}

function saveUserSettings(settings) {
  const next = {
    ...DEFAULT_SETTINGS,
    ...(settings || {})
  };
  wx.setStorageSync(SETTINGS_KEY, next);
  return next;
}

function getPageClass(settings) {
  const value = settings || getUserSettings();
  const fontClass = { small: 'fs-small', large: 'fs-large' }[value.fontSize] || '';
  const themeClass = value.theme === 'dark' ? 'theme-dark' : '';
  return [fontClass, themeClass].filter(Boolean).join(' ');
}

function applyThemeChrome(settings) {
  const value = settings || getUserSettings();
  const dark = value.theme === 'dark';
  wx.setNavigationBarColor({
    frontColor: dark ? '#ffffff' : '#000000',
    backgroundColor: dark ? '#18181B' : '#FFFFFF'
  });
  wx.setTabBarStyle({
    color: dark ? '#A1A1AA' : '#A0A0A0',
    selectedColor: dark ? '#FAFAFA' : '#1A1A1A',
    backgroundColor: dark ? '#27272A' : '#FFFFFF',
    borderStyle: dark ? 'black' : 'white'
  });
}

function getQuizMistakes() {
  return wx.getStorageSync(MISTAKES_KEY) || [];
}

function recordQuizMistake(item) {
  if (!item || !item.char || !item.chosen) return getQuizMistakes();
  const current = getQuizMistakes();
  const key = `${item.char}-${item.chosen}`;
  const existing = current.find((mistake) => `${mistake.char}-${mistake.chosen}` === key);
  const nextItem = {
    id: `${key}-${Date.now()}`,
    char: item.char,
    chosen: item.chosen,
    pinyin: item.pinyin || '',
    meaning: item.meaning || '',
    stageLabel: item.stageLabel || '古文字',
    assetUrl: item.assetUrl || '',
    source: item.source || 'quiz',
    count: existing ? existing.count + 1 : 1,
    time: Date.now()
  };
  const next = [nextItem, ...current.filter((mistake) => `${mistake.char}-${mistake.chosen}` !== key)].slice(0, 50);
  wx.setStorageSync(MISTAKES_KEY, next);
  return next;
}

function clearQuizMistakes() {
  wx.removeStorageSync(MISTAKES_KEY);
  return [];
}

module.exports = {
  DEFAULT_SETTINGS,
  getUserSettings,
  saveUserSettings,
  getPageClass,
  applyThemeChrome,
  getQuizMistakes,
  recordQuizMistake,
  clearQuizMistakes
};
