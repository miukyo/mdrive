import { Router } from 'express';
import { ApiError } from '../errors.js';
import { getFiles, deleteFiles, moveFiles, renameFile as renameTelegram } from '../../services/drive.js';
import { getTelegramClient } from '../../services/telegram.js';
import multer from 'multer';
import { CustomFile } from 'telegram/client/uploads.js';
import { emitProgress } from '../../services/progress.js';
import { refreshIndex } from '../../services/indexer.js';
import { getSession } from '../../repositories/sessions.js';
import { renameFile as renameLocal } from '../../repositories/index.js';
import fs from 'node:fs';
import crypto from 'node:crypto';

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

const MAX_CHUNK_SIZE = 1900 * 1024 * 1024; // 1.9GB to stay safe under 2GB limit

filesRouter.post("/upload", upload.array("files"), async (req, res, next) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0)
      throw new ApiError(400, "No files uploaded");

    const sessionId = (req as any).sessionId;
    const client = await getTelegramClient(sessionId);
    const folderId = req.body.folder_id
      ? parseInt(req.body.folder_id, 10)
      : null;
    const peer = folderId
      ? await client.getInputEntity(folderId)
      : await client.getInputEntity("me");

    let idx = 0;
    for (const file of files) {
      let tid = "unknown";
      if (req.body.transfer_ids) {
        tid = Array.isArray(req.body.transfer_ids)
          ? req.body.transfer_ids[idx]
          : req.body.transfer_ids;
      } else if (req.body.transfer_id) {
        tid = req.body.transfer_id;
      }

      const totalChunks = Math.ceil(file.size / MAX_CHUNK_SIZE);
      const chunkId = totalChunks > 1 ? crypto.randomUUID() : undefined;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * MAX_CHUNK_SIZE;
        const end = Math.min(start + MAX_CHUNK_SIZE, file.size);
        const currentChunkSize = end - start;

        // Emit progress based on total file size
        const basePercent = (start / file.size) * 100;

        // Read chunk into buffer
        // Note: For files > 2GB, we read chunk by chunk to avoid memory issues
        const buffer = Buffer.alloc(currentChunkSize);
        const fd = await fs.promises.open(file.path, "r");
        await fd.read(buffer, 0, currentChunkSize, start);
        await fd.close();

        const uploadedFile = await client.uploadFile({
          file: new CustomFile(file.originalname, currentChunkSize, "", buffer),
          workers: 4,
          maxBufferSize: MAX_CHUNK_SIZE + 1024,
          onProgress: (progress) => {
            const chunkPercent = (progress as number) * (currentChunkSize / file.size) * 100;
            const backendPercent = basePercent + chunkPercent;
            // Map 0-100% backend progress to 50-100% total progress
            const displayPercent = 50 + (backendPercent * 0.5);
            
            emitProgress(sessionId, "upload-progress", {
              id: tid,
              percent: Math.round(displayPercent),
            });
          },
        });

        const meta = {
          n: file.originalname,
          s: file.size,
          cid: chunkId,
          idx: i,
          tot: totalChunks,
        };

        await client.sendFile(peer, {
          file: uploadedFile,
          forceDocument: true,
          caption: `[TD_META]${JSON.stringify(meta)}[/TD_META]`,
        });
      }

      emitProgress(sessionId, "upload-progress", { id: tid, percent: 100 });

      // Clean up local temp file
      await fs.promises.unlink(file.path);
      idx++;
    }

    // Update index asynchronously after upload
    refreshIndex(sessionId).catch(console.error);
    res.json({ status: "uploaded" });
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

filesRouter.post('/rename', async (req, res, next) => {
  try {
    const { message_id, folder_id, name } = req.body;
    if (!message_id || !name) {
      throw new ApiError(400, 'message_id and name are required');
    }
    
    const sessionId = (req as any).sessionId;
    const session = await getSession(sessionId);
    if (!session) throw new ApiError(401, 'Session not found');

    await renameLocal(
      session.phone,
      folder_id ? parseInt(folder_id, 10) : 0,
      parseInt(message_id, 10),
      name,
    );

    // Also update in Telegram (caption)
    await renameTelegram(
      sessionId,
      folder_id ? parseInt(folder_id, 10) : null,
      parseInt(message_id, 10),
      name,
    );

    res.json({ status: "renamed" });
  } catch (err) {
    next(err);
  }
});
