import { Router } from 'express';
import crypto from 'node:crypto';
import { ApiError } from '../errors.js';
import { createShareLink, getShareLink, getUserShares } from '../../repositories/shares.js';
import { getSession } from '../../repositories/sessions.js';
import { getMessageMedia } from '../../services/preview.js';
import archiver from 'archiver';
import { getFiles } from '../../services/drive.js';

export const shareRouter = Router();

// Create share link (requires auth)
shareRouter.post('/create', async (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'] as string;
    if (!sessionId) throw new ApiError(401, 'Unauthorized');

    const session = await getSession(sessionId);
    if (!session) throw new ApiError(401, 'Session not found');

    const { share_type, folder_id, message_id } = req.body;
    if (!share_type) {
      throw new ApiError(400, 'share_type required');
    }
    if (share_type === 'folder' && folder_id === undefined) {
      throw new ApiError(400, 'folder_id required for folder share');
    }

    const token = crypto.randomUUID();
    await createShareLink(token, session.phone, share_type, folder_id !== undefined ? parseInt(folder_id, 10) : null, message_id ? parseInt(message_id, 10) : null);

    res.json({ url: `/api/share/${token}` });
  } catch (err) {
    next(err);
  }
});

// List all shares for current user
shareRouter.get('/', async (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'] as string;
    if (!sessionId) throw new ApiError(401, 'Unauthorized');

    const session = await getSession(sessionId);
    if (!session) throw new ApiError(401, 'Session not found');

    const shares = await getUserShares(session.phone);
    res.json({ data: shares });
  } catch (err) {
    next(err);
  }
});

// Download from share link (public)
shareRouter.get('/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const share = await getShareLink(token);
    if (!share) throw new ApiError(404, 'Share link not found');

    // We need to resolve a session using the phone number stored in the share link.
    // However, the phone number doesn't map directly to a session object if the user is offline.
    // In a real scenario, the backend should connect using that phone's session_string.
    // For this prototype, let's query the DB for the first session ID that matches the phone.
    const { sqlite } = await import('../../db.js');
    const row = sqlite.query('SELECT id FROM telegram_sessions WHERE phone = ? AND auth_state = \'logged_in\' LIMIT 1').get(share.phone) as { id: string } | undefined;
    if (!row) throw new ApiError(500, 'User session unavailable to process share');
    
    const sessionId = row.id;

    if (share.share_type === 'file' && share.message_id) {
      // Stream single file
      const { client, media } = await getMessageMedia(sessionId, share.folder_id === 0 ? null : share.folder_id, share.message_id);
      
      let mimeType = 'application/octet-stream';
      let fileName = 'download';

      const fileRow = sqlite.query('SELECT name, mime_type FROM telegram_index_files WHERE phone = ? AND message_id = ? LIMIT 1').get(share.phone, share.message_id) as { name: string, mime_type: string } | undefined;
      if (fileRow) {
        if (fileRow.name) fileName = fileRow.name;
        if (fileRow.mime_type) mimeType = fileRow.mime_type;
      }
      
      const stream = client.iterDownload({
        file: media,
        requestSize: 1024 * 1024,
      });

      res.setHeader('Content-Type', mimeType);
      const encodedFileName = encodeURIComponent(fileName);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`);

      for await (const chunk of stream) {
        res.write(chunk);
      }
      res.end();
    } else if (share.share_type === 'folder') {
      // Download ZIP of folder
      const files = await getFiles(sessionId, share.folder_id === 0 ? null : share.folder_id);
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="folder_${share.folder_id}.zip"`);
      
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);

      for (const fileMeta of files) {
        try {
          const { client, media } = await getMessageMedia(sessionId, share.folder_id === 0 ? null : share.folder_id, fileMeta.id);
          const stream = client.iterDownload({ file: media, requestSize: 1024 * 1024 });
          // archiver accepts readable streams, but iterDownload is an async iterator
          // We can pipe it using Readable.from
          const { Readable } = await import('node:stream');
          archive.append(Readable.from(stream), { name: fileMeta.name });
        } catch (e) {
          console.error(`Failed to append file ${fileMeta.id} to ZIP`, e);
        }
      }
      
      await archive.finalize();
    } else {
      throw new ApiError(400, 'Invalid share configuration');
    }

  } catch (err) {
    next(err);
  }
});
