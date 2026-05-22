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

app.use(cors());
app.use(express.json());
app.use('/assets', express.static(localAssetRoot, {
  maxAge: '1y',
  immutable: true
}));

app.use('/api', createCharacterRouter());
app.use('/api', createGlyphCoverageRouter());
app.use('/api', createRadicalRouter());
app.use('/api', createAiRouter());
app.use('/api', createProgressRouter());
app.use('/api', createAuthRouter());
app.use('/api', createAssetRouter());
app.use('/api', createSystemRouter());
app.use(createSystemRouter());

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: error.message || '服务器内部错误' });
});

app.listen(env.port, () => {
  console.log(`Shuowen backend listening at http://localhost:${env.port}`);
});
