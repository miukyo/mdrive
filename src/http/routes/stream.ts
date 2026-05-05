import { Router } from 'express';
import { ApiError } from '../errors.js';
import { getTelegramClient } from '../../services/telegram.js';
import { getSession } from '../../repositories/sessions.js';
import { getFileChunks } from '../../repositories/index.js';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { getShareLink } from '../../repositories/shares.js';
import { sqlite } from '../../db.js';

export const streamRouter = Router();

streamRouter.use(async (req, res, next) => {
  const sessionId =
    (req.headers['x-session-id'] as string) || (req.query.session_id as string);
  const shareToken = req.query.share_token as string;

  if (sessionId) {
    (req as any).sessionId = sessionId;
    return next();
  }

  if (shareToken) {
    try {
      const share = await getShareLink(shareToken);
      if (!share) return next(new ApiError(404, 'Invalid share token'));

      // Find the owner's active session
      const row = sqlite
        .query(
          "SELECT id FROM telegram_sessions WHERE phone = ? AND auth_state = 'logged_in' LIMIT 1",
        )
        .get(share.phone) as { id: string } | undefined;

      if (!row)
        return next(
          new ApiError(503, 'Owner is currently offline, stream unavailable'),
        );

      (req as any).sessionId = row.id;
      (req as any).isPublicShare = true;
      (req as any).share = share;
      return next();
    } catch (err) {
      return next(err);
    }
  }

  return next(new ApiError(401, 'Unauthorized: missing session ID or share token'));
});

streamRouter.get('/', async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;
    const messageId = parseInt(req.query.message_id as string, 10);
    const folderId = req.query.folder_id
      ? parseInt(req.query.folder_id as string, 10)
      : null;

    if (isNaN(messageId)) {
      throw new ApiError(400, 'invalid message_id');
    }

    // Security check for public shares
    if ((req as any).isPublicShare) {
      const share = (req as any).share;
      if (share.share_type === 'file' && share.message_id !== messageId) {
        throw new ApiError(403, 'Forbidden: This file is not part of the share');
      }
      if (share.share_type === 'folder') {
        const targetFolderId = share.folder_id === 0 ? null : share.folder_id;
        if (targetFolderId !== folderId) {
          throw new ApiError(
            403,
            'Forbidden: This folder is not part of the share',
          );
        }
      }
    }

    const session = await getSession(sessionId);
    if (!session) throw new ApiError(401, 'Session not found');

    const client = await getTelegramClient(sessionId);
    const peer = folderId
      ? await client.getInputEntity(folderId)
      : await client.getInputEntity('me');

    // Check if this is a chunked file
    const dbChunks = await getFileChunks(session.phone, folderId ?? 0, messageId);
    let messages: Api.Message[] = [];
    let fileName = 'download';
    let mimeType = 'application/octet-stream';
    let totalSize = 0;

    if (dbChunks && dbChunks.length > 0) {
      // It's chunked
      const messageIds = dbChunks.map((c) => c.message_id);
      messages = (await client.getMessages(peer, {
        ids: messageIds,
      })) as Api.Message[];

      // Sort messages to match dbChunks order
      messages.sort((a, b) => {
        const idxA = dbChunks.find((c) => c.message_id === a.id)?.chunk_index || 0;
        const idxB = dbChunks.find((c) => c.message_id === b.id)?.chunk_index || 0;
        return idxA - idxB;
      });

      totalSize = dbChunks.reduce((acc, c) => acc + c.size, 0);
      fileName = dbChunks[0].name;
      mimeType = dbChunks[0].mime_type || 'application/octet-stream';
    } else {
      // Single file
      const msgs = (await client.getMessages(peer, {
        ids: [messageId],
      })) as Api.Message[];
      if (!msgs || msgs.length === 0) throw new ApiError(404, 'File not found');
      messages = msgs;

      const media = messages[0].media;
      if (
        media instanceof Api.MessageMediaDocument &&
        media.document instanceof Api.Document
      ) {
        totalSize = Number(media.document.size);
        mimeType = media.document.mimeType;
        const attr = media.document.attributes.find(
          (a) => a instanceof Api.DocumentAttributeFilename,
        );
        if (attr instanceof Api.DocumentAttributeFilename) {
          fileName = attr.fileName;
        }
      } else {
        throw new ApiError(400, 'Unsupported media type');
      }
    }

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

    const range = req.headers.range;
    let start = 0;
    let end = totalSize - 1;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      res.setHeader('Content-Length', chunkSize);
    } else {
      res.setHeader('Content-Length', totalSize);
    }

    // Stream across multiple chunks if necessary
    let currentGlobalOffset = 0;
    for (const msg of messages) {
      const media = msg.media;
      if (
        !(
          media instanceof Api.MessageMediaDocument &&
          media.document instanceof Api.Document
        )
      )
        continue;

      const chunkSize = Number(media.document.size);
      const chunkEnd = currentGlobalOffset + chunkSize - 1;

      // Check if this chunk is within the requested range
      if (currentGlobalOffset <= end && chunkEnd >= start) {
        const localStart = Math.max(0, start - currentGlobalOffset);
        const localEnd = Math.min(chunkSize - 1, end - currentGlobalOffset);
        const bytesToRead = localEnd - localStart + 1;

        if (bytesToRead > 0) {
          const stream = client.iterDownload({
            file: media,
            offset: bigInt(localStart),
            requestSize: 1024 * 1024,
          });

          let bytesStreamedInChunk = 0;
          for await (const chunk of stream) {
            const remaining = bytesToRead - bytesStreamedInChunk;
            if (remaining <= 0) break;

            if (chunk.length > remaining) {
              res.write(chunk.slice(0, remaining));
              bytesStreamedInChunk += remaining;
              break;
            } else {
              res.write(chunk);
              bytesStreamedInChunk += chunk.length;
            }
          }
        }
      }

      currentGlobalOffset += chunkSize;
      if (currentGlobalOffset > end) break;
    }

    res.end();
  } catch (err) {
    next(err);
  }
});
