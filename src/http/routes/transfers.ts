import { Router } from 'express';
import { addProgressClient, removeProgressClient } from '../../services/progress.js';
import { ApiError } from '../errors.js';

export const transfersRouter = Router();

transfersRouter.use((req, res, next) => {
  const sessionId = req.headers['x-session-id'] as string;
  if (!sessionId) {
    return next(new ApiError(401, 'Unauthorized: missing x-session-id'));
  }
  (req as any).sessionId = sessionId;
  next();
});

transfersRouter.get('/events', (req, res, next) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sid = (req as any).sessionId;
  addProgressClient(sid, res);

  req.on('close', () => {
    removeProgressClient(sid, res);
  });
});
