import { execFile } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import WebSocket from 'ws';
import { env } from '../config/env.js';
import { cacheGet, cacheSet } from './cacheService.js';
import { coreGlyphChars } from '../data/glyphAssets.js';
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
  const timer = setTimeout(() => controller.abort(), 6000);
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
        '8',
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

function ttsConfigured() {
  return Boolean(env.xfyunTtsAppId && env.xfyunTtsApiKey && env.xfyunTtsApiSecret);
}

function asrConfigured() {
  return Boolean(env.xfyunAsrAppId && env.xfyunAsrApiKey && env.xfyunAsrApiSecret);
}

function buildXfyunWsUrl({ host, path, apiKey, apiSecret }) {
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signature = createHmac('sha256', apiSecret)
    .update(signatureOrigin)
    .digest('base64');
  const authorizationOrigin = [
    `api_key="${apiKey}"`,
    'algorithm="hmac-sha256"',
    'headers="host date request-line"',
    `signature="${signature}"`
  ].join(', ');
  const authorization = Buffer.from(authorizationOrigin).toString('base64');
  const query = new URLSearchParams({ authorization, date, host });
  return `wss://${host}${path}?${query.toString()}`;
}

function buildXfyunTtsUrl() {
  return buildXfyunWsUrl({
    host: 'tts-api.xfyun.cn',
    path: '/v2/tts',
    apiKey: env.xfyunTtsApiKey,
    apiSecret: env.xfyunTtsApiSecret
  });
}

function buildXfyunAsrUrl() {
  return buildXfyunWsUrl({
    host: 'iat-api.xfyun.cn',
    path: '/v2/iat',
    apiKey: env.xfyunAsrApiKey,
    apiSecret: env.xfyunAsrApiSecret
  });
}

export async function synthesizeSpeech(text) {
  const cleanText = trimText(text, 500);
  if (!cleanText) {
    const error = new Error('缺少要朗读的文本');
    error.statusCode = 400;
    throw error;
  }
  if (!ttsConfigured()) {
    const error = new Error('讯飞语音合成未配置');
    error.statusCode = 503;
    throw error;
  }

  return new Promise((resolve, reject) => {
    const audioChunks = [];
    let settled = false;
    const ws = new WebSocket(buildXfyunTtsUrl());
    const timer = setTimeout(() => {
      finish(new Error('语音合成超时'));
    }, 18000);

    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch (_err) {
        // The socket may already be closed by the remote endpoint.
      }
      if (error) reject(error);
      else resolve(result);
    }

    ws.on('open', () => {
      ws.send(JSON.stringify({
        common: { app_id: env.xfyunTtsAppId },
        business: {
          aue: 'lame',
          sfl: 1,
          auf: 'audio/L16;rate=16000',
          vcn: env.xfyunTtsVoice,
          speed: 50,
          volume: 60,
          pitch: 50,
          bgs: 0,
          tte: 'UTF8'
        },
        data: {
          status: 2,
          text: Buffer.from(cleanText, 'utf8').toString('base64')
        }
      }));
    });

    ws.on('message', (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch (_err) {
        finish(new Error('语音合成返回格式异常'));
        return;
      }

      if (data.code !== 0) {
        finish(new Error(data.message || `语音合成失败 (${data.code})`));
        return;
      }

      if (data.data?.audio) {
        audioChunks.push(Buffer.from(data.data.audio, 'base64'));
      }
      if (data.data?.status === 2) {
        const audio = Buffer.concat(audioChunks);
        if (!audio.length) {
          finish(new Error('语音合成未返回音频'));
          return;
        }
        finish(null, {
          text: cleanText,
          audioBase64: audio.toString('base64'),
          mimeType: 'audio/mpeg',
          extension: 'mp3',
          provider: 'xfyun'
        });
      }
    });

    ws.on('error', (error) => {
      finish(error);
    });

    ws.on('close', () => {
      if (!settled) finish(new Error('语音合成连接已关闭'));
    });
  });
}

function parseIatWords(result) {
  return (result?.ws || [])
    .map((wordSlot) => wordSlot?.cw?.[0]?.w || '')
    .join('');
}

export async function transcribeSpeech(audioBuffer, options = {}) {
  if (!audioBuffer || !audioBuffer.length) {
    const error = new Error('缺少录音文件');
    error.statusCode = 400;
    throw error;
  }
  if (!asrConfigured()) {
    const error = new Error('讯飞语音听写未配置');
    error.statusCode = 503;
    throw error;
  }
  return new Promise((resolve, reject) => {
    const inputFormat = String(options.format || '').toLowerCase();
    const isPcm = inputFormat === 'pcm' || inputFormat === 'raw';
    const encoding = isPcm ? 'raw' : 'lame';
    // 16k/16bit/mono PCM is 32 bytes per millisecond, so 1280 bytes
    // matches the 40ms cadence expected by iFlytek's streaming ASR.
    const frameSize = isPcm ? 1280 : 8000;
    let offset = 0;
    let text = '';
    let settled = false;
    let sentLastFrame = false;
    const ws = new WebSocket(buildXfyunAsrUrl());
    const timer = setTimeout(() => {
      finish(new Error('语音识别超时'));
    }, 22000);

    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch (_err) {
        // The socket may already be closed by the remote endpoint.
      }
      if (error) reject(error);
      else resolve(result);
    }

    function nextFrame(status) {
      const end = Math.min(offset + frameSize, audioBuffer.length);
      const chunk = audioBuffer.subarray(offset, end);
      offset = end;
      if (status === 2) sentLastFrame = true;
      return {
        status,
        format: 'audio/L16;rate=16000',
        encoding,
        audio: chunk.toString('base64')
      };
    }

    function sendFrames() {
      const firstIsLast = audioBuffer.length <= frameSize;
      ws.send(JSON.stringify({
        common: { app_id: env.xfyunAsrAppId },
        business: {
          language: 'zh_cn',
          domain: 'iat',
          accent: 'mandarin',
          vad_eos: 3000
        },
        data: nextFrame(firstIsLast ? 2 : 0)
      }));
      if (firstIsLast) return;

      const interval = setInterval(() => {
        if (settled) {
          clearInterval(interval);
          return;
        }
        const isLast = offset + frameSize >= audioBuffer.length;
        ws.send(JSON.stringify({ data: nextFrame(isLast ? 2 : 1) }));
        if (isLast) clearInterval(interval);
      }, 40);
    }

    ws.on('open', sendFrames);

    ws.on('message', (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch (_err) {
        finish(new Error('语音识别返回格式异常'));
        return;
      }

      if (data.code !== 0) {
        console.warn(`ASR response failed: ${data.code} ${data.message || ''}`);
        finish(new Error(data.message || `语音识别失败 (${data.code})`));
        return;
      }

      const words = parseIatWords(data.data?.result);
      if (words) text += words;
      if (data.data?.status === 2) {
        const cleanText = text.replace(/\s+/g, '').trim();
        finish(null, {
          text: cleanText,
          provider: 'xfyun',
          generated: Boolean(cleanText)
        });
      }
    });

    ws.on('error', (error) => {
      finish(error);
    });

    ws.on('close', (code, reason) => {
      if (settled) return;
      const closeReason = reason ? reason.toString() : '';
      console.warn(`ASR websocket closed before final result: code=${code} reason=${closeReason || '(empty)'} sentLastFrame=${sentLastFrame}`);
      if (sentLastFrame && text) {
        const cleanText = text.replace(/\s+/g, '').trim();
        finish(null, {
          text: cleanText,
          provider: 'xfyun',
          generated: Boolean(cleanText),
          partial: true
        });
        return;
      }
      finish(new Error(closeReason || `语音识别连接已关闭 (${code})`));
    });
  });
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

function distinctChars(items) {
  return [...new Set(items.filter(Boolean).map((char) => Array.from(String(char).trim())[0]).filter(Boolean))];
}

function localPathReason(character, unlocked) {
  if (!character) return '补齐核心字库里的基础字，形成稳定的字形演变认知。';
  const sameRadical = unlocked.filter((item) => item.radical && item.radical === character.radical).length;
  if (sameRadical > 0) {
    return `你已经学过${character.radical || '相关'}部字，继续学习“${character.char}”可以把同一部首的字形线索串起来。`;
  }
  if (character.strokes && character.strokes <= 4) {
    return `“${character.char}”笔画较少，适合作为象形和基础构形的下一步练习。`;
  }
  return `“${character.char}”能补充新的部首和字义场景，让学习路径不只停留在已熟悉的字形。`;
}

function summarizeFocus(unlockedCharacters, recommendedCharacters) {
  const recentRadicals = unlockedCharacters
    .map((item) => item.radical)
    .filter(Boolean)
    .slice(0, 8);
  const topRadical = recentRadicals.find((radical, idx) => recentRadicals.indexOf(radical) !== idx) || recentRadicals[0];
  const nextRadicals = [...new Set(recommendedCharacters.map((item) => item.radical).filter(Boolean))].slice(0, 2);
  if (topRadical && nextRadicals.length) {
    return `从已学的${topRadical}部线索出发，补充${nextRadicals.join('、')}部字，形成部首和字形双线复习。`;
  }
  if (nextRadicals.length) {
    return `先从${nextRadicals.join('、')}部字开始，建立基础部首和五阶段字形的观察方法。`;
  }
  return '先学习核心高频字，再逐步扩展到部首关联和相似字辨析。';
}

function fallbackQuizInsight(correct, chosen, isCorrect) {
  if (isCorrect) {
    return `你抓住了“${correct.char}”的关键字形线索，可以继续观察它从甲骨文到楷书哪些笔画保留下来。`;
  }
  if (!chosen) {
    return `这题的关键在“${correct.char}”的早期形体。下次先看整体轮廓，再看部首和笔画方向。`;
  }
  if (correct.radical && chosen.radical && correct.radical === chosen.radical) {
    return `你可能被相同的${correct.radical}部线索带偏了。“${correct.char}”和“${chosen.char}”同部，但本义和整体轮廓不同。`;
  }
  if (correct.strokes && chosen.strokes && Math.abs(correct.strokes - chosen.strokes) <= 2) {
    return `你可能把笔画复杂度相近的字混在一起了。“${correct.char}”要优先看古文字整体轮廓，而不是只看现代笔画多少。`;
  }
  return `你可能把“${chosen.char}”的现代字形代入了古文字判断。辨认“${correct.char}”时，先抓它的本义图像，再看演变后的笔画。`;
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

function fallbackCharacterAnswer(contextChars, question) {
  const target = contextChars[0];
  if (!target) return '小字灵可以讲汉字的字形演变、部首、读音和含义。你可以换一个具体汉字问我。';

  const stages = target.stages || [];
  const earliest = stages.find((stage) => stage.description) || stages[0];
  const stageNames = stages.map((stage) => stage.name).filter(Boolean).slice(0, 5).join('、');
  const asksOrigin = /字源|来源|从哪|哪里来|为什么|本来/.test(question);
  const asksOracle = /甲骨|最早|古文字|像什么/.test(question);
  const asksMeaning = /意思|含义|什么意思|解释/.test(question);
  const asksPinyin = /读音|怎么读|拼音/.test(question);

  if (asksPinyin) {
    return `“${target.char}”读作${target.pinyin || '可结合教材读音学习'}，部首是${target.radical || '暂未记录'}，共有${target.strokes || '若干'}画。`;
  }
  if (asksOracle && earliest) {
    return `“${target.char}”的早期字形可以先看整体轮廓：${earliest.description || '它保留了古人观察事物后的形体线索'}后来逐步演变到今天的楷书。`;
  }
  if (asksOrigin && earliest) {
    return `“${target.char}”的字源可以从${earliest.name || '古文字'}看起：${earliest.description || target.meaning || '它把古人对事物的观察藏进字形里'}。`;
  }
  if (asksMeaning) {
    return `“${target.char}”的意思是${target.meaning || '可结合字形和语境理解'}。观察它的部首${target.radical || ''}和字形变化，能更容易记住这个字。`;
  }
  return `小字灵先按字形线索讲：“${target.char}”${target.meaning ? `表示${target.meaning}` : '可以从古文字形体来理解'}。${stageNames ? `它经历了${stageNames}这些阶段，` : ''}学习时先看轮廓，再看部首和笔画变化。`;
}

function isNoDataAnswer(text) {
  const clean = String(text || '').replace(/\s+/g, '');
  if (!clean) return false;
  return [
    /手头.*资料.*(没|未|没有).*收录/,
    /(资料|数据库|字库|信息).*(没|未|没有).*(收录|覆盖|记录|找到)/,
    /(没|未|没有).*(收录|覆盖|记录|找到).*(资料|信息|数据)/,
    /(现有|目前|当前).*(资料|信息|数据).*(不足|有限|缺少|不完整)/,
    /(没有|未能|无法).*(找到|查询到).*(该字|这个字|相关)/,
    /暂(未|无).*(收录|资料|信息|数据)/,
    /无法.*(回答|讲解|说明)/
  ].some((pattern) => pattern.test(clean));
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
  const normalized = Array.from(String(char || '').trim())[0];
  const chosenChar = Array.from(String(chosen || '').trim())[0];
  const [correctCharacter, chosenCharacter] = await Promise.all([
    findCharacter(normalized),
    chosenChar ? findCharacter(chosenChar) : Promise.resolve(null)
  ]);
  const story = await generateCharacterStory(normalized);
  let insight = '';

  if (correctCharacter) {
    const instructions = [
      '你是“AI错题诊断官”，负责给汉字字形测验生成错因分析。',
      '根据正确字和用户选择，指出可能混淆点，并给出下一次观察建议。',
      '不要编造考古来源，不要 Markdown，不要列表。',
      '中文输出，控制在90字以内。'
    ].join('\n');
    const input = JSON.stringify({
      correct: compactCharacter(correctCharacter),
      chosen: chosenCharacter ? compactCharacter(chosenCharacter) : { char: chosenChar || '' },
      isCorrect
    }, null, 2);
    insight = await callLlm(instructions, input);
  }

  const prefix = isCorrect
    ? `你猜对了，是“${story.char}”。`
    : `正确答案是“${story.char}”，你选的是“${chosen || '未知'}”。`;
  const diagnosis = trimText(insight || fallbackQuizInsight(
    correctCharacter || { char: story.char },
    chosenCharacter || (chosenChar ? { char: chosenChar } : null),
    isCorrect
  ), 120);
  return {
    ...story,
    diagnosis,
    narrative: story.story,
    story: trimText(`${prefix}${diagnosis}${story.story}`, 260)
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
    '不要说“手头资料未收录”“数据库没有信息”“无法回答”这类拒答句；资料不足时也要围绕当前字给出可学习的观察方法或通用解释。',
    '如果某个细节不确定，用“可以先这样观察”来讲，不要暴露系统资料不足。',
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
  const fallbackAnswer = fallbackCharacterAnswer(contextChars, cleanQuestion);
  const answer = isNoDataAnswer(generated) ? fallbackAnswer : (generated || fallbackAnswer);

  return {
    char: currentChar || (contextChars[0] && contextChars[0].char) || '',
    question: cleanQuestion,
    answer: trimText(answer, 240),
    generated: Boolean(generated && answer === generated)
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

export async function generateLearningPath(openid) {
  const progress = await getProgress(openid);
  const unlockedChars = distinctChars(progress.unlocked || []);
  const recentChars = distinctChars((progress.history || []).slice(0, 8).map((item) => item.char));
  const unlockedCharacters = [];
  for (const char of recentChars.length ? recentChars : unlockedChars.slice(-8)) {
    const character = await findCharacter(char);
    if (character) unlockedCharacters.push(compactCharacter(character));
  }

  const unlockedSet = new Set(unlockedChars);
  const recommendedCharacters = [];
  const radicalHints = unlockedCharacters.map((item) => item.radical).filter(Boolean);
  const candidatePool = [
    ...coreGlyphChars.filter((char) => !unlockedSet.has(char)),
    ...coreGlyphChars
  ];
  for (const char of candidatePool) {
    if (recommendedCharacters.length >= 3) break;
    const character = await findCharacter(char);
    if (!character) continue;
    if (
      recommendedCharacters.length === 0
      || radicalHints.includes(character.radical)
      || !recommendedCharacters.some((item) => item.radical === character.radical)
    ) {
      recommendedCharacters.push(compactCharacter(character));
    }
  }

  const focus = summarizeFocus(unlockedCharacters, recommendedCharacters);
  const instructions = [
    '你是“汉字学习路径智能体”，根据用户学习历史生成下一步学习建议。',
    '建议必须围绕部首、字形演变、相似字辨析和复习节奏。',
    '不要 Markdown，不要列表，中文输出，控制在120字以内。'
  ].join('\n');
  const input = JSON.stringify({
    unlockedCount: progress.unlockedCount,
    recent: unlockedCharacters,
    recommended: recommendedCharacters,
    focus
  }, null, 2);
  const generated = await callLlm(instructions, input);

  return {
    title: 'AI 个性化学习路径',
    unlockedCount: progress.unlockedCount,
    coreTotal: coreGlyphChars.length,
    focus,
    summary: trimText(generated || focus, 160),
    recommendations: recommendedCharacters.map((character) => ({
      char: character.char,
      pinyin: character.pinyin,
      radical: character.radical,
      strokes: character.strokes,
      reason: localPathReason(character, unlockedCharacters)
    })),
    generated: Boolean(generated)
  };
}
