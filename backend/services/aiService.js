import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { env } from '../config/env.js';
import { cacheGet, cacheSet } from '../db/redis.js';
import { findCharacter } from '../repositories/characterRepository.js';
import { getProgress } from './progressService.js';

const execFileAsync = promisify(execFile);

const SEASONAL_CHARS = {
  1: ['年', '正', '新', '春'],
  2: ['春', '生', '木', '东'],
  3: ['雨', '草', '木', '生'],
  4: ['清', '明', '水', '日'],
  5: ['夏', '立', '火', '日'],
  6: ['雨', '水', '田', '禾'],
  7: ['暑', '火', '日', '水'],
  8: ['秋', '禾', '月', '金'],
  9: ['秋', '月', '白', '收'],
  10: ['霜', '金', '山', '田'],
  11: ['冬', '北', '水', '雪'],
  12: ['冬', '雪', '家', '安']
};

function compactCharacter(character) {
  return {
    char: character.char,
    pinyin: character.pinyin || '',
    radical: character.radical || '',
    strokes: character.strokes || 0,
    meaning: character.meaning || '',
    stages: (character.stages || []).slice(0, 5).map((stage) => ({
      name: stage.name || stage.label || '',
      glyph: stage.glyph || '',
      period: stage.period || '',
      description: stage.description || stage.desc || ''
    }))
  };
}

async function callLlm(instructions, input) {
  if (!env.deepseekApiKey) return '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  const url = `${env.deepseekBaseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = JSON.stringify({
    model: env.deepseekModel,
    messages: [
      { role: 'system', content: instructions },
      { role: 'user', content: input }
    ],
    thinking: { type: 'disabled' },
    temperature: 0.7,
    max_tokens: 260
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.deepseekApiKey}`
      },
      body
    });

    if (!response.ok) {
      const message = await response.text();
      console.warn(`AI response failed: ${response.status} ${message.slice(0, 200)}`);
      return '';
    }

    const data = await response.json();
    return (data?.choices?.[0]?.message?.content || '').trim();
  } catch (error) {
    console.warn(`AI fetch unavailable, retrying with curl: ${error.message}`);
    // Pass the API key via a 0600 temp config file so it never appears in
    // the process argument list (which is visible to `ps`).
    const configPath = join(tmpdir(), `sw-ai-${randomBytes(8).toString('hex')}.conf`);
    try {
      await writeFile(configPath, `header = "Authorization: Bearer ${env.deepseekApiKey}"\n`, { mode: 0o600 });
      const { stdout } = await execFileAsync('curl', [
        '-sS',
        '--max-time',
        '20',
        '-X',
        'POST',
        url,
        '-H',
        'Content-Type: application/json',
        '--config',
        configPath,
        '-d',
        body
      ], { maxBuffer: 1024 * 1024 });
      const data = JSON.parse(stdout);
      if (data?.error) {
        console.warn(`AI curl response failed: ${data.error.message || data.error.type || 'unknown error'}`);
        return '';
      }
      return (data?.choices?.[0]?.message?.content || '').trim();
    } catch (curlError) {
      console.warn(`AI response unavailable: ${curlError.message}`);
      return '';
    } finally {
      await unlink(configPath).catch(() => {});
    }
  } finally {
    clearTimeout(timer);
  }
}

function trimText(text, max = 260) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function chinaDateParts(date = new Date()) {
  const chinaTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const year = chinaTime.getUTCFullYear();
  const month = chinaTime.getUTCMonth() + 1;
  const day = chinaTime.getUTCDate();
  return {
    year,
    month,
    day,
    dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  };
}

function fallbackStory(character) {
  const stages = (character.stages || []).filter((stage) => stage.description || stage.desc);
  const first = stages[0];
  const last = stages[stages.length - 1];
  const start = first
    ? `最早的“${character.char}”带着${first.name || first.label || '古文字'}的痕迹，${first.description || first.desc}`
    : `“${character.char}”从古文字一路走来，留下了清晰的造字线索。`;
  const end = last
    ? `后来到${last.name || last.label || '楷书'}，形体逐渐稳定，今天我们写下它时，也是在和古人的观察力对话。`
    : `今天再看这个字，仍能读到古人观察世界、整理意义的方式。`;
  return trimText(`${start} ${end}`, 180);
}

function storyTitle(character) {
  return `“${character.char}”从哪里来`;
}

function fallbackDaily(character, date = new Date()) {
  const { month } = chinaDateParts(date);
  const seasonal = month >= 5 && month <= 7
    ? '今天适合从万物生长和光热流动里理解它。'
    : month >= 8 && month <= 10
      ? '今天适合从收获、秩序与时间变化里理解它。'
      : month >= 11 || month <= 1
        ? '今天适合从收藏、安定与岁时更替里理解它。'
        : '今天适合从萌发、更新与生命力里理解它。';
  return trimText(`今日推荐“${character.char}”。${seasonal}${character.meaning || ''}`, 160);
}

function seasonContext(date = new Date()) {
  const { month } = chinaDateParts(date);
  if (month >= 3 && month <= 4) return '春日，适合讲萌发、生长与新的开始';
  if (month >= 5 && month <= 7) return '初夏到盛夏，适合讲光、热、生长与活力';
  if (month >= 8 && month <= 10) return '秋日，适合讲收获、秩序与时间变化';
  return '冬日，适合讲收藏、安定与岁时更替';
}

export async function generateCharacterStory(char) {
  const normalized = Array.from(String(char || '').trim())[0];
  const cacheKey = `ai:story:${normalized}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const character = await findCharacter(normalized);
  if (!character) {
    const error = new Error('未找到该汉字的演变数据');
    error.statusCode = 404;
    throw error;
  }

  const compact = compactCharacter(character);
  const instructions = [
    '你是“汉字故事官”，也是一个温和活泼的汉字讲解员。',
    '只依据输入的汉字资料讲解，不编造考古来源。',
    '输出中文，不要 Markdown，不要列表。',
    '用适合语音播报的短句，语言有画面感，控制在150字左右。'
  ].join('\n');
  const input = `请根据这些资料讲“${compact.char}”的起源故事，像在展厅里给孩子讲解：\n${JSON.stringify(compact, null, 2)}`;
  const generated = await callLlm(instructions, input);
  const story = trimText(generated || fallbackStory(character), 220);

  const result = {
    char: compact.char,
    title: storyTitle(character),
    storyteller: '小字灵',
    story,
    voiceText: story,
    generated: Boolean(generated)
  };
  // AI 结果缓存 7 天；失败时落回兜底文案，仅缓存 5 分钟避免长期固化。
  await cacheSet(cacheKey, result, result.generated ? 604800 : 300);
  return result;
}

export async function explainQuizAnswer(char, chosen, isCorrect) {
  const story = await generateCharacterStory(char);
  const prefix = isCorrect
    ? `你猜对了，是“${story.char}”。`
    : `正确答案是“${story.char}”，你选的是“${chosen || '未知'}”。`;
  return {
    ...story,
    story: trimText(`${prefix}${story.story}`, 240)
  };
}

export async function answerCharacterQuestion(char, question) {
  const cleanQuestion = String(question || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!cleanQuestion) {
    const error = new Error('缺少问题');
    error.statusCode = 400;
    throw error;
  }

  // Build context from the current character plus any Chinese characters
  // mentioned in the question, so a question can be about any character.
  const currentChar = Array.from(String(char || '').trim())[0];
  const mentioned = cleanQuestion.match(/[一-鿿]/g) || [];
  const candidateChars = [...new Set([currentChar, ...mentioned].filter(Boolean))].slice(0, 6);

  const contextChars = [];
  for (const c of candidateChars) {
    const character = await findCharacter(c);
    if (character) contextChars.push(compactCharacter(character));
  }

  const instructions = [
    '你是“小字灵”，《说文解字》与汉字字形演变方面的讲解员，语气温和活泼。',
    '回答用户关于汉字的问题：字形演变、字源、六书、部首、读音、含义等。',
    '如提供了相关汉字资料，优先依据资料；资料未覆盖时可用汉字常识合理讲解，但不要编造具体的考古发现或出土文献名称。',
    '若问题与汉字无关，礼貌说明你只讲汉字。',
    '输出中文，不要 Markdown，不要列表，控制在140字以内。'
  ].join('\n');
  const input = [
    contextChars.length
      ? `相关汉字资料：\n${JSON.stringify(contextChars, null, 2)}`
      : '（暂无结构化汉字资料，可用汉字常识作答）',
    `\n用户问题：${cleanQuestion}`
  ].join('\n');
  const generated = await callLlm(instructions, input);

  return {
    char: currentChar || (contextChars[0] && contextChars[0].char) || '',
    question: cleanQuestion,
    answer: trimText(generated || '小字灵暂时无法连线，请稍后再试。', 240),
    generated: Boolean(generated)
  };
}

export async function generateDailyRecommendation(openid) {
  const today = new Date();
  const todayParts = chinaDateParts(today);
  const dateKey = todayParts.dateKey;
  const cacheKey = `ai:daily:${openid || 'anon'}:${dateKey}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const progress = await getProgress(openid);
  const unlocked = new Set(progress.unlocked || []);
  const candidates = SEASONAL_CHARS[todayParts.month] || ['说', '文', '人'];
  const ordered = [
    ...candidates.filter((char) => !unlocked.has(char)),
    ...candidates.filter((char) => unlocked.has(char)),
    '说'
  ];
  let character = null;
  for (const char of ordered) {
    character = await findCharacter(char);
    if (character) break;
  }
  if (!character) character = await findCharacter('说');
  if (!character) {
    const error = new Error('暂无可推荐汉字');
    error.statusCode = 404;
    throw error;
  }
  const compact = compactCharacter(character);

  const instructions = [
    '你是“AI每日一字”推荐官。',
    '根据日期、季节氛围和用户学习历史，生成一句有趣推荐语。',
    '不要编造具体节气、节日或热点名称；除非输入里明确给出。',
    '输出中文，80到120字，不要列表。'
  ].join('\n');
  const input = JSON.stringify({
    date: dateKey,
    seasonContext: seasonContext(today),
    unlockedCount: progress.unlockedCount,
    recent: (progress.history || []).slice(0, 8),
    recommended: compact
  }, null, 2);
  const generated = await callLlm(instructions, input);

  const result = {
    char: compact.char,
    title: `今日汉字：${compact.char}`,
    date: dateKey,
    pinyin: compact.pinyin,
    radical: compact.radical,
    meaning: compact.meaning,
    insight: trimText(generated || fallbackDaily(character, today), 180),
    generated: Boolean(generated)
  };
  // 每用户每日推荐缓存 1 天；兜底文案仅缓存 10 分钟。
  await cacheSet(cacheKey, result, result.generated ? 86400 : 600);
  return result;
}
