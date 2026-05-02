import { Router } from 'express';
import { ApiError } from '../errors.js';
import { getFiles, deleteFiles, moveFiles } from '../../services/drive.js';
import { getTelegramClient } from '../../services/telegram.js';
import multer from 'multer';
import { CustomFile } from 'telegram/client/uploads.js';
import { emitProgress } from '../../services/progress.js';
import { refreshIndex } from '../../services/indexer.js';

export const filesRouter = Router();
const upload = multer({ dest: 'cache/uploads/' });

filesRouter.use((req, res, next) => {
  const sessionId = req.headers['x-session-id'] as string;
  if (!sessionId) {
    return next(new ApiError(401, 'Unauthorized: missing x-session-id'));
  }
  (req as any).sessionId = sessionId;
  next();
});

filesRouter.get('/', async (req, res, next) => {
  try {
    const folderId = req.query.folder_id ? parseInt(req.query.folder_id as string, 10) : null;
    const files = await getFiles((req as any).sessionId, folderId);
    res.json({ data: files });
  } catch (err) {
    next(err);
  }
});

filesRouter.post('/upload', upload.array('files'), async (req, res, next) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) throw new ApiError(400, 'No files uploaded');

    const sessionId = (req as any).sessionId;
    const client = await getTelegramClient(sessionId);
    const folderId = req.body.folder_id ? parseInt(req.body.folder_id, 10) : null;
    const peer = folderId ? await client.getInputEntity(folderId) : await client.getInputEntity('me');

    // Process files sequentially to maintain order and stable progress tracking
    let idx = 0;
    for (const file of files) {
      const tid = (req.body.transfer_ids && Array.isArray(req.body.transfer_ids)) ? req.body.transfer_ids[idx] : req.body.transfer_id || 'unknown';
      emitProgress(sessionId, 'upload-progress', { id: tid, percent: 0 });

      const uploadedFile = await client.uploadFile({
        file: new CustomFile(file.originalname, file.size, file.path),
        workers: 4,
        onProgress: (progress) => {
          emitProgress(sessionId, 'upload-progress', { id: tid, percent: Math.round((progress as number) * 100) });
        },
      });

      await client.sendFile(peer, { file: uploadedFile, forceDocument: true });

      emitProgress(sessionId, 'upload-progress', { id: tid, percent: 100 });

      // Clean up local temp file
      await import('node:fs').then(fs => fs.promises.unlink(file.path));
      idx++;
    }

    // Update index asynchronously after upload
    refreshIndex(sessionId).catch(console.error);
    res.json({ status: 'uploaded' });
  } catch (err) {
    next(err);
  }
});

filesRouter.delete('/', async (req, res, next) => {
  try {
    const { message_ids, folder_id } = req.body;
    if (!message_ids || !Array.isArray(message_ids)) {
      throw new ApiError(400, 'message_ids array is required');
    }
    const fId = folder_id ? parseInt(folder_id, 10) : null;
    const sessionId = (req as any).sessionId;
    await deleteFiles(sessionId, fId, message_ids);
    refreshIndex(sessionId).catch(console.error);
    res.json({ status: 'deleted' });
  } catch (err) {
    next(err);
  }
});

filesRouter.post('/move', async (req, res, next) => {
  try {
    const { message_ids, source_folder_id, target_folder_id } = req.body;
    if (!message_ids || !Array.isArray(message_ids)) {
      throw new ApiError(400, 'message_ids array is required');
    }
    const sourceFid = source_folder_id ? parseInt(source_folder_id, 10) : null;
    const targetFid = target_folder_id ? parseInt(target_folder_id, 10) : null;

    const sessionId = (req as any).sessionId;
    await moveFiles(sessionId, message_ids, sourceFid, targetFid);
    refreshIndex(sessionId).catch(console.error);
    res.json({ status: 'moved' });
  } catch (err) {
    next(err);
  }
});
