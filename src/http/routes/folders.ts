import { Router } from 'express';
import { ApiError } from '../errors.js';
import { createFolder, deleteFolder, scanFolders } from '../../services/drive.js';

export const foldersRouter = Router();

// Middleware to extract and validate session
foldersRouter.use((req, res, next) => {
  const sessionId = req.headers['x-session-id'] as string;
  if (!sessionId) {
    return next(new ApiError(401, 'Unauthorized: missing x-session-id'));
  }
  (req as any).sessionId = sessionId;
  next();
});

foldersRouter.get('/', async (req, res, next) => {
  try {
    const folders = await scanFolders((req as any).sessionId);
    res.json({ data: folders });
  } catch (err) {
    next(err);
  }
});

foldersRouter.post('/', async (req, res, next) => {
  try {
    const { name, parent_id } = req.body;
    const sessionId = (req as any).sessionId;
    if (!name) {
      throw new ApiError(400, 'name is required');
    }
    const parentId = parent_id ? parseInt(parent_id, 10) : null;
    const folder = await createFolder(sessionId, name, parentId);
    res.json({ data: folder });
  } catch (err) {
    next(err);
  }
});

foldersRouter.delete('/:id', async (req, res, next) => {
  try {
    const folderId = parseInt(req.params.id, 10);
    if (isNaN(folderId)) {
      throw new ApiError(400, 'invalid folder id');
    }
    await deleteFolder((req as any).sessionId, folderId);
    res.json({ status: 'deleted' });
  } catch (err) {
    next(err);
  }
});
