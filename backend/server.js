import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { localAssetRoot } from './services/assetService.js';
import { createAiRouter } from './routes/ai.js';
import { createAssetRouter } from './routes/assets.js';
import { createAuthRouter } from './routes/auth.js';
import { createCharacterRouter } from './routes/characters.js';
import { createGlyphCoverageRouter } from './routes/glyphCoverage.js';
import { createProgressRouter } from './routes/progress.js';
import { createRadicalRouter } from './routes/radicals.js';
import { createSystemRouter } from './routes/system.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', true);

app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

app.use(cors());

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const rateBuckets = new Map();

app.use('/api', (req, res, next) => {
  const now = Date.now();
  const bucket = rateBuckets.get(req.ip);

  if (!bucket || now - bucket.start >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(req.ip, { start: now, count: 1 });
    return next();
  }

  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ message: '请求过于频繁，请稍后再试' });
  }
  return next();
});

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.start >= RATE_LIMIT_WINDOW_MS) rateBuckets.delete(key);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

app.use(express.json({ limit: '4mb' }));
app.use('/assets', express.static(localAssetRoot, {
  maxAge: '1y',
  immutable: true
}));

const systemRouter = createSystemRouter();

app.use('/api', createCharacterRouter());
app.use('/api', createGlyphCoverageRouter());
app.use('/api', createRadicalRouter());
app.use('/api', createAiRouter());
app.use('/api', createProgressRouter());
app.use('/api', createAuthRouter());
app.use('/api', createAssetRouter());
app.use('/api', systemRouter);
app.use(systemRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: error.message || '服务器内部错误' });
});

app.listen(env.port, () => {
  console.log(`Shuowen backend listening at http://localhost:${env.port}`);
});
