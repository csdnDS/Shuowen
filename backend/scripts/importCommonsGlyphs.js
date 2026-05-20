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
const execFileAsync = promisify(execFile);

const stageCandidates = {
  oracle: ['oracle'],
  bronze: ['bronze', 'bronze-shang', 'bronze-western', 'bronze-spring', 'bronze-zhou'],
  seal: ['seal', 'bigseal'],
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

function variantsFor(char) {
  return glyphCharVariants[char] || [char];
}

function candidateTitles(char, era) {
  return variantsFor(char).flatMap((variant) =>
    (stageCandidates[era] || []).map((suffix) => `File:${variant}-${suffix}.svg`)
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

async function downloadSvg(url, filePath) {
  const svg = await fetchText(url);
  if (!svg.includes('<svg')) {
    throw new Error(`Downloaded file is not SVG: ${url}`);
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, svg, 'utf8');
}

async function fetchText(url) {
  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return response.text();
  } catch (error) {
    const target = url.toString();
    const { stdout } = await execFileAsync('curl', [
      '-fsSL',
      '--http1.1',
      '--retry',
      '2',
      '--retry-delay',
      '1',
      '--max-time',
      String(Math.ceil(FETCH_TIMEOUT_MS / 1000)),
      '-A',
      USER_AGENT,
      target
    ], {
      maxBuffer: 20 * 1024 * 1024
    });
    return stdout;
  }
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

async function main() {
  const chars = pickChars();
  const manifest = await loadManifest();
  manifest.generatedAt = new Date().toISOString();
  manifest.source = 'Wikimedia Commons Ancient Chinese characters project';
  manifest.policy = 'Downloads only SVG files whose Commons metadata reports CC0, Public Domain, CC-BY, or CC-BY-SA.';

  const imported = [];
  const skipped = [];

  for (const char of chars) {
    for (const stage of glyphStageMeta.filter((item) => item.era !== 'regular')) {
      try {
        const titles = candidateTitles(char, stage.era);
        const file = await findUsableFile(titles);

        if (!file) {
          skipped.push({ char, era: stage.era, candidates: titles });
          continue;
        }

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
        console.log(`imported ${char} ${stage.era}: ${file.title}`);
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

  await fs.mkdir(publicRoot, { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  await updateMongo(imported);

  console.log(JSON.stringify({
    ok: true,
    imported: imported.length,
    skipped: skipped.length,
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
