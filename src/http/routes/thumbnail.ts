import { Router } from 'express';
import { Api } from 'telegram';
import { ApiError } from '../errors.js';
import { getTelegramClient } from '../../services/telegram.js';

export const thumbnailRouter = Router();

thumbnailRouter.use((req, res, next) => {
  const sessionId = req.headers['x-session-id'] as string;
  if (!sessionId) {
    return next(new ApiError(401, 'Unauthorized: missing x-session-id'));
  }
  (req as any).sessionId = sessionId;
  next();
});

thumbnailRouter.get('/', async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;

    const messageId = req.query.message_id ? parseInt(req.query.message_id as string, 10) : null;
    const folderId = req.query.folder_id ? parseInt(req.query.folder_id as string, 10) : null;

    if (!messageId) throw new ApiError(400, 'message_id is required');

    const client = await getTelegramClient(sessionId);
    const peer = folderId
      ? await client.getInputEntity(folderId)
      : await client.getInputEntity('me');

    const messages = await client.getMessages(peer, { ids: messageId });
    if (!messages || messages.length === 0) throw new ApiError(404, 'Message not found');

    const msg = messages[0];
    if (!msg.media) throw new ApiError(404, 'Message has no media');

    // Determine thumbnail type based on media kind
    let thumbSize: string | undefined;
    let fileReference: Buffer | undefined;
    let location: Api.TypeInputFileLocation | undefined;
    let mimeType = 'image/jpeg';

    if (msg.media instanceof Api.MessageMediaPhoto) {
      const photo = msg.media.photo as Api.Photo;
      // Pick the smallest size for thumbnail
      const sizes = photo.sizes as Array<Api.PhotoSize | Api.PhotoCachedSize | Api.PhotoSizeEmpty | Api.PhotoStrippedSize>;
      const small = sizes.find(s => s instanceof Api.PhotoSize && s.type === 's')
        || sizes.find(s => s instanceof Api.PhotoSize && s.type === 'm')
        || sizes.find(s => s instanceof Api.PhotoSize);

      if (!small || !(small instanceof Api.PhotoSize)) {
        throw new ApiError(404, 'No thumbnail available');
      }

      location = new Api.InputPhotoFileLocation({
        id: photo.id,
        accessHash: photo.accessHash,
        fileReference: photo.fileReference,
        thumbSize: small.type,
      });
    } else if (msg.media instanceof Api.MessageMediaDocument) {
      const doc = msg.media.document as Api.Document;

      // Check if it has a VideoSize or PhotoSize thumbnail
      const thumbSizes = doc.thumbs ?? [];
      const thumb = thumbSizes.find(s => s instanceof Api.PhotoSize && s.type === 's')
        || thumbSizes.find(s => s instanceof Api.PhotoSize && s.type === 'm')
        || thumbSizes.find(s => s instanceof Api.PhotoSize);

      if (!thumb || !(thumb instanceof Api.PhotoSize)) {
        throw new ApiError(404, 'No thumbnail available for this document');
      }

      location = new Api.InputDocumentFileLocation({
        id: doc.id,
        accessHash: doc.accessHash,
        fileReference: doc.fileReference,
        thumbSize: thumb.type,
      });
    } else {
      throw new ApiError(400, 'Media type does not support thumbnails');
    }

    // Collect thumbnail chunks via iterDownload
    const chunks: Buffer[] = [];
    const stream = client.iterDownload({
      file: location!,
      requestSize: 65536,
    });

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    const buffer = Buffer.concat(chunks);
    if (!buffer.length) throw new ApiError(500, 'Failed to download thumbnail');

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(buffer);
  } catch (err) {
    next(err);
  }
});
