import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { MongoClient } from 'mongodb';
import { env } from '../config/env.js';
import { coreGlyphChars, getGlyphAssetKey, glyphCharVariants, glyphStageMeta } from '../data/glyphAssets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicRoot = path.resolve(__dirname, '../assets/public');
const manifestPath = path.join(publicRoot, 'commons-glyph-manifest.json');

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'ShuowenMiniProgram/0.1 (local development; Wikimedia Commons glyph import)';
const FETCH_TIMEOUT_MS = 30000;
const RETRIES = 2;
const DEFAULT_CONCURRENCY = 8;
const execFileAsync = promisify(execFile);
const proxyArg = process.argv.find((item) => item.startsWith('--proxy='));
const explicitProxy = proxyArg ? proxyArg.slice('--proxy='.length) : '';

const stageCandidates = {
  oracle: ['oracle', 'oracle-1', 'oracle-2', 'oracle-3', 'oracle-4', 'oracle-5', 'oracle-6', 'oracle-shang'],
  bronze: ['bronze', 'bronze-1', 'bronze-2', 'bronze-3', 'bronze-4', 'bronze-5', 'bronze-shang', 'bronze-western', 'bronze-spring', 'bronze-zhou'],
  seal: ['seal', 'bigseal', 'smallseal', 'seal-qin'],
  clerical: ['clerical-han', 'clerical', 'cler'],
  regular: []
};

const allowedLicensePatterns = [
  /cc0/i,
  /public domain/i,
  /^pd$/i,
  /cc-by/i,
  /cc-by-sa/i
];

function pickChars() {
  const arg = process.argv.find((item) => item.startsWith('--chars='));
  if (!arg) return coreGlyphChars;
  const chars = arg.slice('--chars='.length);
  return Array.from(chars).filter((char) => coreGlyphChars.includes(char));
}

function parseNumberArg(name, fallback) {
  const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const value = Number(arg.slice(name.length + 3));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function variantsFor(char) {
  return glyphCharVariants[char] || [char];
}

function candidateTitles(char, era) {
  return variantsFor(char).flatMap((variant) =>
    (stageCandidates[era] || []).map((suffix) => `File:${variant}-${suffix}.svg`)
  );
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function searchTerms(char, era) {
  const suffixes = stageCandidates[era] || [];
  return variantsFor(char).flatMap((variant) => [
    ...suffixes.map((suffix) => `intitle:${variant}-${suffix}.svg`),
    ...suffixes.map((suffix) => `${variant} ${suffix} svg`),
    `"${variant}-${era}.svg"`,
    `${variant} ancient chinese ${era} svg`
  ]);
}

function titleMatchesStage(title, char, era) {
  const lower = String(title || '').toLowerCase();
  const allowed = stageCandidates[era] || [];
  return variantsFor(char).some((variant) =>
    allowed.some((suffix) => lower === `file:${variant}-${suffix}.svg`.toLowerCase())
  );
}

function normalizeLicense(value) {
  return String(value || '').replace(/<[^>]+>/g, '').trim();
}

function isAllowedLicense(extmetadata = {}) {
  const values = [
    extmetadata.LicenseShortName?.value,
    extmetadata.UsageTerms?.value,
    extmetadata.Copyrighted?.value,
    extmetadata.License?.value
  ].map(normalizeLicense);

  return values.some((value) => allowedLicensePatterns.some((pattern) => pattern.test(value)));
}

function extractMetadata(page) {
  const info = page.imageinfo?.[0];
  const ext = info?.extmetadata || {};
  return {
    title: page.title,
    originalUrl: info?.url || '',
    descriptionUrl: info?.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/^File:/, 'File:'))}`,
    license: normalizeLicense(ext.LicenseShortName?.value || ext.UsageTerms?.value || ext.License?.value),
    usageTerms: normalizeLicense(ext.UsageTerms?.value),
    artist: normalizeLicense(ext.Artist?.value),
    credit: normalizeLicense(ext.Credit?.value)
  };
}

async function commonsQuery(params) {
  const url = new URL(COMMONS_API);
  Object.entries({
    format: 'json',
    origin: '*',
    ...params
  }).forEach(([key, value]) => url.searchParams.set(key, value));

  const text = await fetchText(url);
  return JSON.parse(text);
}

async function findUsableFile(titles) {
  if (!titles.length) return null;

  const data = await commonsQuery({
    action: 'query',
    titles: titles.join('|'),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    redirects: '1'
  });

  const pages = Object.values(data.query?.pages || {})
    .filter((page) => !page.missing && page.imageinfo?.[0]?.url);

  for (const page of pages) {
    if (isAllowedLicense(page.imageinfo[0].extmetadata)) {
      return extractMetadata(page);
    }
  }

  return null;
}

async function findUsableFilesByTitle(titles) {
  const files = new Map();

  for (const titleChunk of chunk(titles, 40)) {
    const data = await commonsQuery({
      action: 'query',
      titles: titleChunk.join('|'),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      redirects: '1'
    });

    const pages = Object.values(data.query?.pages || {})
      .filter((page) => !page.missing && page.imageinfo?.[0]?.url);

    for (const page of pages) {
      if (isAllowedLicense(page.imageinfo[0].extmetadata)) {
        files.set(page.title.toLowerCase(), extractMetadata(page));
      }
    }
  }

  return files;
}

async function searchCandidateTitles(char, era) {
  const found = new Set();

  for (const term of searchTerms(char, era)) {
    const data = await commonsQuery({
      action: 'query',
      list: 'search',
      srnamespace: '6',
      srsearch: term,
      srlimit: '8'
    });

    for (const item of data.query?.search || []) {
      if (/\.svg$/i.test(item.title) && titleMatchesStage(item.title, char, era)) {
        found.add(item.title);
      }
    }

    if (found.size >= 12) break;
  }

  return [...found];
}

async function findUsableFileForStage(char, era) {
  const exact = await findUsableFile(candidateTitles(char, era));
  if (exact) return exact;
  if (hasArg('no-search')) return null;

  const searchedTitles = await searchCandidateTitles(char, era);
  return findUsableFile(searchedTitles);
}

async function downloadSvg(url, filePath) {
  const svg = await fetchText(url);
  if (!svg.includes('<svg')) {
    throw new Error(`Downloaded file is not SVG: ${url}`);
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, svg, 'utf8');
}

async function fetchText(url) {
  if (explicitProxy || hasArg('curl-first')) {
    return fetchTextWithCurl(url);
  }

  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return response.text();
  } catch (error) {
    return fetchTextWithCurl(url);
  }
}

async function fetchTextWithCurl(url) {
  const target = url.toString();
  const args = [
    '-fsSL',
    '--http1.1',
    '--retry',
    '2',
    '--retry-delay',
    '1',
    '--connect-timeout',
    '8',
    '--max-time',
    String(Math.ceil(FETCH_TIMEOUT_MS / 1000)),
    '-A',
    USER_AGENT
  ];

  if (explicitProxy) {
    args.push('--proxy', explicitProxy);
  }

  args.push(target);

  const { stdout } = await execFileAsync('curl', args, {
    maxBuffer: 20 * 1024 * 1024,
    timeout: FETCH_TIMEOUT_MS + 5000
  });
  return stdout;
}

async function fetchWithRetry(url) {
  let lastError;

  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT }
      });
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

async function loadManifest() {
  try {
    return JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch (_error) {
    return { generatedAt: '', assets: {} };
  }
}

async function updateMongo(stageAssets) {
  if (!env.mongoUri || !stageAssets.length) return;

  const client = new MongoClient(env.mongoUri);
  await client.connect();
  try {
    const db = client.db(env.mongoDbName);
    for (const asset of stageAssets) {
      await db.collection('characters').updateOne(
        { char: asset.char, 'stages.era': asset.era },
        {
          $set: {
            'stages.$.assetKey': asset.assetKey,
            'stages.$.assetType': 'svg',
            'stages.$.assetSource': asset.sourceName,
            'stages.$.assetStatus': 'verified',
            'stages.$.license': asset.license,
            'stages.$.sourceUrl': asset.sourceUrl,
            'stages.$.attribution': asset.attribution,
            'stages.$.verifiedAt': asset.verifiedAt,
            updatedAt: new Date()
          }
        }
      );
    }
  } finally {
    await client.close();
  }
}

async function importStageAsset({ char, stage, file, manifest, imported }) {
  const assetKey = getGlyphAssetKey(char, stage.era);
  const filePath = path.join(publicRoot, assetKey);
  await downloadSvg(file.originalUrl, filePath);

  const attribution = file.artist || file.credit || file.title;
  const record = {
    type: 'stage-glyph-svg',
    char,
    era: stage.era,
    key: assetKey,
    assetKey,
    sourceName: 'Wikimedia Commons Ancient Chinese characters project',
    sourceTitle: file.title,
    sourceUrl: file.descriptionUrl,
    originalUrl: file.originalUrl,
    license: file.license || file.usageTerms,
    attribution,
    status: 'verified',
    contentType: 'image/svg+xml',
    verifiedAt: new Date().toISOString()
  };

  manifest.assets[`${char}-${stage.era}`] = record;
  imported.push(record);
  await fs.mkdir(publicRoot, { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  await updateMongo([record]);
  console.log(`imported ${char} ${stage.era}: ${file.title}`);
}

async function importExactBatch(tasks, manifest, imported, skipped, concurrency) {
  const downloadDelay = parseNumberArg('download-delay', 0);
  const pending = tasks.filter(({ char, stage }) => {
    const existing = manifest.assets?.[`${char}-${stage.era}`];
    if (existing?.status === 'verified') {
      skipped.push({ char, era: stage.era, reason: 'already verified' });
      return false;
    }
    return true;
  });
  const titles = [...new Set(pending.flatMap(({ char, stage }) => candidateTitles(char, stage.era)))];
  const filesByTitle = await findUsableFilesByTitle(titles);
  const downloadTasks = [];

  for (const task of pending) {
    const file = candidateTitles(task.char, task.stage.era)
      .map((title) => filesByTitle.get(title.toLowerCase()))
      .find(Boolean);

    if (!file) {
      skipped.push({
        char: task.char,
        era: task.stage.era,
        candidates: candidateTitles(task.char, task.stage.era)
      });
      continue;
    }

    downloadTasks.push({ ...task, file });
  }

  let downloadCursor = 0;
  async function downloadNext() {
    while (downloadCursor < downloadTasks.length) {
      const task = downloadTasks[downloadCursor];
      downloadCursor += 1;
      try {
        if (downloadDelay > 0 && downloadCursor > 1) {
          await sleep(downloadDelay);
        }
        await importStageAsset({ ...task, manifest, imported });
      } catch (error) {
        skipped.push({
          char: task.char,
          era: task.stage.era,
          error: error.message
        });
        console.warn(`skipped ${task.char} ${task.stage.era}: ${error.message}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, downloadTasks.length) }, () => downloadNext())
  );
}

async function main() {
  const chars = pickChars();
  const concurrency = parseNumberArg('concurrency', DEFAULT_CONCURRENCY);
  const force = hasArg('force');
  const manifest = await loadManifest();
  manifest.generatedAt = new Date().toISOString();
  manifest.source = 'Wikimedia Commons Ancient Chinese characters project';
  manifest.policy = 'Downloads only SVG files whose Commons metadata reports CC0, Public Domain, CC-BY, or CC-BY-SA.';

  const imported = [];
  const skipped = [];
  const tasks = chars.flatMap((char) =>
    glyphStageMeta
      .filter((item) => item.era !== 'regular')
      .map((stage) => ({ char, stage }))
  );
  let cursor = 0;

  async function importNext() {
    while (cursor < tasks.length) {
      const task = tasks[cursor];
      cursor += 1;
      const { char, stage } = task;
      const existing = manifest.assets?.[`${char}-${stage.era}`];

      if (!force && existing?.status === 'verified') {
        skipped.push({ char, era: stage.era, reason: 'already verified' });
        continue;
      }

      try {
        const file = await findUsableFileForStage(char, stage.era);

        if (!file) {
          skipped.push({ char, era: stage.era, candidates: candidateTitles(char, stage.era) });
          continue;
        }

        await importStageAsset({ char, stage, file, manifest, imported });
      } catch (error) {
        skipped.push({
          char,
          era: stage.era,
          error: error.message
        });
        console.warn(`skipped ${char} ${stage.era}: ${error.message}`);
      }
    }
  }

  if (hasArg('no-search')) {
    await importExactBatch(tasks, manifest, imported, skipped, Math.min(concurrency, 4));
  } else {
    await Promise.all(
      Array.from({ length: Math.min(concurrency, tasks.length) }, () => importNext())
    );
  }

  await fs.mkdir(publicRoot, { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(JSON.stringify({
    ok: true,
    imported: imported.length,
    skipped: skipped.length,
    verifiedTotal: Object.values(manifest.assets || {}).filter((asset) => asset.status === 'verified').length,
    manifestPath,
    skipped
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  if (/fetch failed|timeout|aborted/i.test(error.message || '') || /TIMEOUT/i.test(error.cause?.code || '')) {
    console.error('无法连接 Wikimedia Commons。请确认当前网络能访问 https://commons.wikimedia.org 后重试：npm run commons:import');
  }
  process.exit(1);
});
