import { Router } from 'express';
import { ApiError } from '../errors.js';
import { getMessageMedia } from '../../services/preview.js';
import { Api } from 'telegram';

export const streamRouter = Router();

streamRouter.use((req, res, next) => {
  const sessionId = req.headers['x-session-id'] as string;
  if (!sessionId) {
    return next(new ApiError(401, 'Unauthorized: missing x-session-id'));
  }
  (req as any).sessionId = sessionId;
  next();
});

streamRouter.get('/', async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;

    const messageId = parseInt(req.query.message_id as string, 10);
    const folderId = req.query.folder_id ? parseInt(req.query.folder_id as string, 10) : null;

    if (isNaN(messageId)) {
      throw new ApiError(400, 'invalid message_id');
    }

    const { client, media } = await getMessageMedia(sessionId, folderId, messageId);

    let totalSize = 0;
    let fileName = 'download';
    let mimeType = 'application/octet-stream';

    if (media instanceof Api.MessageMediaDocument && media.document instanceof Api.Document) {
      totalSize = Number(media.document.size);
      mimeType = media.document.mimeType;
      const attr = media.document.attributes.find((a) => a instanceof Api.DocumentAttributeFilename);
      if (attr instanceof Api.DocumentAttributeFilename) {
        fileName = attr.fileName;
      }
    } else {
      throw new ApiError(400, 'Unsupported media type');
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    if (totalSize > 0) {
      res.setHeader('Content-Length', totalSize);
    }

    const stream = client.iterDownload({
      file: media,
      requestSize: 1024 * 1024,
    });

    for await (const chunk of stream) {
      res.write(chunk);
    }

    res.end();
  } catch (err) {
    next(err);
  }
});
