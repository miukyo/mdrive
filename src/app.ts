import express from 'express';
import cors from 'cors';
import { apiReference } from '@scalar/express-api-reference';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { errorHandler } from './http/errors.js';
import { authRouter } from './http/routes/auth.js';
import { foldersRouter } from './http/routes/folders.js';
import { filesRouter } from './http/routes/files.js';
import { streamRouter } from './http/routes/stream.js';
import { indexingRouter } from './http/routes/indexing.js';
import { shareRouter } from './http/routes/share.js';
import { transfersRouter } from './http/routes/transfers.js';
import { thumbnailRouter } from './http/routes/thumbnail.js';

export const app = express();

app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json());

const openapiPath = path.join(process.cwd(), 'src', 'openapi.json');

app.use(
  '/docs',
  apiReference({
    theme: 'default',
    content: fs.readFileSync(openapiPath, 'utf-8'),
  })
);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes will be mounted here
app.use('/api/auth', authRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/files', filesRouter);
app.use('/api/stream', streamRouter);
app.use('/api/index', indexingRouter);
app.use('/api/share', shareRouter);
app.use('/api/transfers', transfersRouter);
app.use('/api/thumbnail', thumbnailRouter);

app.use(errorHandler);
