import { Router } from 'express';
import { ApiError } from '../errors.js';
import { refreshIndex } from '../../services/indexer.js';
import { createBackup, restoreLatestBackup } from '../../services/backup.js';
import { searchFiles, getStorageStats } from '../../repositories/index.js';
import { getSession } from '../../repositories/sessions.js';

export const indexingRouter = Router();

indexingRouter.use((req, res, next) => {
  const sessionId = req.headers['x-session-id'] as string;
  if (!sessionId) {
    return next(new ApiError(401, 'Unauthorized: missing x-session-id'));
  }
  (req as any).sessionId = sessionId;
  next();
});

indexingRouter.post('/refresh', async (req, res, next) => {
  try {
    // Fire and forget or await? Awaiting may take time, but the spec usually expects it or fires it async
    // Let's await for simplicity
    await refreshIndex((req as any).sessionId);
    res.json({ status: 'indexing_completed' });
  } catch (err) {
    next(err);
  }
});

indexingRouter.get('/search', async (req, res, next) => {
  try {
    const { q, category, folderId, startDate, endDate, limit, offset, ids } = req.query;

    const session = await getSession((req as any).sessionId);
    if (!session) throw new ApiError(401, 'Session not found');

    const messageIds = ids ? (ids as string).split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id)) : undefined;

    const results = await searchFiles(session.phone, {
      query: q as string,
      category: category as string,
      folderId: folderId ? parseInt(folderId as string) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
      messageIds,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });
    res.json({ data: results });
  } catch (err) {
    next(err);
  }
});

indexingRouter.get('/stats', async (req, res, next) => {
  try {
    const session = await getSession((req as any).sessionId);
    if (!session) throw new ApiError(401, 'Session not found');

    const stats = await getStorageStats(session.phone);
    res.json({ data: stats });
  } catch (err) {
    next(err);
  }
});

indexingRouter.post('/backup', async (req, res, next) => {
  try {
    await createBackup((req as any).sessionId);
    res.json({ status: 'backup_sent' });
  } catch (err) {
    next(err);
  }
});

indexingRouter.post('/restore', async (req, res, next) => {
  try {
    const result = await restoreLatestBackup((req as any).sessionId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
