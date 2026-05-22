import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { coreGlyphChars } from '../data/glyphAssets.js';
import { getGlyphCoverage } from '../services/glyphCoverageService.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logPath = path.resolve(__dirname, '../assets/public/glyph-import-loop.log');

const HISTORICAL_ERAS = ['oracle', 'bronze', 'seal', 'clerical'];

function argValue(name, fallback) {
  const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const value = arg.slice(name.length + 3);
  return value || fallback;
}

function numberArg(name, fallback) {
  const value = Number(argValue(name, ''));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function boolArg(name) {
  return process.argv.includes(`--${name}`);
}

function pickChars() {
  const raw = argValue('chars', '');
  if (!raw) return coreGlyphChars;
  const wanted = new Set(Array.from(raw));
  return coreGlyphChars.filter((char) => wanted.has(char));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function appendLog(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, line, 'utf8');
  process.stdout.write(line);
}

function targetItems(coverage, allowedChars) {
  const allowed = new Set(allowedChars);
  return coverage.items
    .filter((item) => allowed.has(item.char))
    .map((item) => ({
      ...item,
      missingHistorical: item.stages
        .filter((stage) => HISTORICAL_ERAS.includes(stage.era) && stage.status !== 'verified')
        .map((stage) => stage.era)
    }))
    .filter((item) => item.missingHistorical.length > 0)
    .sort((a, b) =>
      (a.verifiedCount - b.verifiedCount) ||
      (b.missingHistorical.length - a.missingHistorical.length) ||
      allowedChars.indexOf(a.char) - allowedChars.indexOf(b.char)
    );
}

async function runImportForChar(char, mode) {
  const args = [
    'scripts/importCommonsGlyphs.js',
    '--curl-first',
    '--concurrency=1',
    '--query-batch-size=50',
    '--query-delay-ms=3000',
    '--query-retries=2',
    `--rate-limit-delay-ms=${numberArg('rate-limit-delay-ms', 30 * 60 * 1000)}`,
    '--download-delay=5000',
    '--download-retries=2',
    `--download-rate-limit-delay-ms=${numberArg('download-rate-limit-delay-ms', 5 * 60 * 1000)}`,
    `--chars=${char}`
  ];
  if (mode === 'exact') args.push('--no-search');

  const { stdout, stderr } = await execFileAsync('node', args, {
    cwd: path.resolve(__dirname, '..'),
    timeout: numberArg('per-char-timeout-ms', 180000),
    maxBuffer: 2 * 1024 * 1024
  });

  return `${stdout || ''}${stderr || ''}`;
}

async function main() {
  const allowedChars = pickChars();
  const maxCycles = numberArg('max-cycles', 0);
  const charDelayMs = numberArg('char-delay-ms', 90000);
  const cycleDelayMs = numberArg('cycle-delay-ms', 10 * 60 * 1000);
  const rateLimitDelayMs = numberArg('rate-limit-delay-ms', 30 * 60 * 1000);
  const exactOnly = boolArg('exact-only');
  let cycle = 0;

  await appendLog(`glyph import loop started, chars=${allowedChars.join('')}, exactOnly=${exactOnly}`);

  while (!maxCycles || cycle < maxCycles) {
    cycle += 1;
    const coverage = await getGlyphCoverage();
    const targets = targetItems(coverage, allowedChars);
    const verifiedHistorical = coverage.items.reduce((acc, item) =>
      acc + item.stages.filter((stage) => HISTORICAL_ERAS.includes(stage.era) && stage.status === 'verified').length
    , 0);
    const totalHistorical = coverage.items.length * HISTORICAL_ERAS.length;

    await appendLog(`cycle ${cycle}: historical verified ${verifiedHistorical}/${totalHistorical}; target chars=${targets.length}`);

    if (!targets.length) {
      await appendLog('all historical stages are verified for selected chars; loop complete');
      return;
    }

    for (const item of targets) {
      const mode = exactOnly ? 'exact' : (cycle % 3 === 1 ? 'exact' : 'search');
      await appendLog(`try ${item.char}, missing=${item.missingHistorical.join(',')}, mode=${mode}`);

      try {
        const output = await runImportForChar(item.char, mode);
        const importedMatch = output.match(/"imported":\s*(\d+)/);
        const imported = importedMatch ? Number(importedMatch[1]) : 0;
        await appendLog(`done ${item.char}, imported=${imported}`);

        if (/429|rate.?limit|Too Many Requests/i.test(output)) {
          await appendLog(`rate limited after ${item.char}; sleeping ${rateLimitDelayMs}ms`);
          await sleep(rateLimitDelayMs);
        } else {
          await sleep(charDelayMs);
        }
      } catch (error) {
        const output = `${error.stdout || ''}${error.stderr || ''}${error.message || ''}`;
        await appendLog(`error ${item.char}: ${String(error.message || error).slice(0, 300)}`);
        if (/429|rate.?limit|Too Many Requests/i.test(output)) {
          await appendLog(`rate limited; sleeping ${rateLimitDelayMs}ms`);
          await sleep(rateLimitDelayMs);
        } else {
          await sleep(charDelayMs);
        }
      }
    }

    await appendLog(`cycle ${cycle} complete; sleeping ${cycleDelayMs}ms`);
    await sleep(cycleDelayMs);
  }

  await appendLog(`stopped after max cycles=${maxCycles}`);
}

main().catch(async (error) => {
  await appendLog(`fatal: ${error.stack || error.message || error}`);
  process.exit(1);
});
