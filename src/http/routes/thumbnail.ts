import { Elysia, t } from "elysia";
import { Api } from "telegram";
import { ApiError } from "../errors.js";
import { getTelegramClient, getEntitySafe } from "../../services/telegram.js";
import { getShareLink } from "../../repositories/shares.js";
import { sqlite } from "../../db.js";

export const thumbnailRouter = new Elysia({ prefix: "/thumbnail" })
  .derive(async ({ query, headers }) => {
    const sessionId = (headers["x-session-id"] as string) || (query.session_id as string);
    const shareToken = query.share_token as string;

    if (sessionId) {
      return { sessionId, isPublicShare: false };
    }

    if (shareToken) {
      const share = await getShareLink(shareToken);
      if (!share) {
        return {
          authErrorData: { status: 404, message: "Invalid share token" },
        };
      }

      const row = sqlite
        .query(
          "SELECT id FROM telegram_sessions WHERE phone = ? AND auth_state = 'logged_in' LIMIT 1",
        )
        .get(share.phone) as { id: string } | undefined;

      if (!row) {
        return {
          authErrorData: {
            status: 503,
            message: "Owner is currently offline, thumbnail unavailable",
          },
        };
      }

      return { sessionId: row.id, isPublicShare: true, share };
    }

    return {
      authErrorData: {
        status: 401,
        message: "Unauthorized: missing session ID or share token",
      },
    };
  })
  .onBeforeHandle(({ authErrorData, set }) => {
    if (authErrorData) {
      set.status = authErrorData.status as any;
      return {
        error: { message: authErrorData.message },
      };
    }
  })
  .get("/", async ({ query: { message_id, folder_id, peer_id }, sessionId, isPublicShare, share, set }) => {
    const mId = typeof message_id === 'string' ? parseInt(message_id, 10) : message_id;
    const fId = peer_id ? (typeof peer_id === 'string' ? parseInt(peer_id, 10) : peer_id) : (folder_id ? (typeof folder_id === 'string' ? parseInt(folder_id, 10) : folder_id) : null);

    if (!mId) throw new ApiError(400, "message_id is required");

    if (isPublicShare) {
      const s = share as any;
      if (s.share_type === "file" && s.message_id !== mId) {
        throw new ApiError(403, "Forbidden: This file is not part of the share");
      }
      if (s.share_type === "folder") {
        const targetFolderId = s.folder_id === 0 ? null : s.folder_id;
        const requestedFolderId = fId === 0 ? null : fId;

        if (targetFolderId !== requestedFolderId && requestedFolderId !== null && targetFolderId !== null) {
          const isDescendant = sqlite.query(`
            WITH RECURSIVE subordinates AS (
              SELECT folder_id, parent_id FROM telegram_index_folders WHERE folder_id = ? AND phone = ?
              UNION ALL
              SELECT f.folder_id, f.parent_id FROM telegram_index_folders f
              INNER JOIN subordinates s ON f.folder_id = s.parent_id
              WHERE f.phone = ?
            )
            SELECT COUNT(*) as count FROM subordinates WHERE folder_id = ?
          `).get(requestedFolderId, s.phone, s.phone, targetFolderId) as { count: number };

          if (isDescendant.count === 0) {
            throw new ApiError(403, "Forbidden: This folder is not part of the share");
          }
        } else if (targetFolderId !== requestedFolderId && targetFolderId !== null) {
          // If one is null (root) and they are not equal, then it's forbidden because they don't match
          throw new ApiError(403, "Forbidden: This folder is not part of the share");
        }
      }
    }

    const client = await getTelegramClient(sessionId!);
    const peer = fId
      ? await getEntitySafe(sessionId!, fId)
      : await getEntitySafe(sessionId!, "me");

    const messages = (await client.getMessages(peer, {
      ids: [mId],
    })) as Api.Message[];
    if (!messages || messages.length === 0 || !messages[0]) {
      throw new ApiError(404, "Message not found");
    }

    const msg = messages[0];
    if (!msg.media) throw new ApiError(404, "Message has no media");

    let location: Api.TypeInputFileLocation | undefined;
    let mimeType = "image/jpeg";

    if (msg.media instanceof Api.MessageMediaPhoto) {
      const photo = msg.media.photo as Api.Photo;
      const sizes = photo.sizes as Array<
        | Api.PhotoSize
        | Api.PhotoCachedSize
        | Api.PhotoSizeEmpty
        | Api.PhotoStrippedSize
      >;
      const small =
        sizes.find((s) => s instanceof Api.PhotoSize && s.type === "s") ||
        sizes.find((s) => s instanceof Api.PhotoSize && s.type === "m") ||
        sizes.find((s) => s instanceof Api.PhotoSize);

      if (!small || !(small instanceof Api.PhotoSize)) {
        throw new ApiError(404, "No thumbnail available");
      }

      location = new Api.InputPhotoFileLocation({
        id: photo.id,
        accessHash: photo.accessHash,
        fileReference: photo.fileReference,
        thumbSize: small.type,
      });
    } else if (msg.media instanceof Api.MessageMediaDocument) {
      const doc = msg.media.document as Api.Document;
      const thumbSizes = doc.thumbs ?? [];
      const thumb =
        thumbSizes.find((s) => s instanceof Api.PhotoSize && s.type === "s") ||
        thumbSizes.find((s) => s instanceof Api.PhotoSize && s.type === "m") ||
        thumbSizes.find((s) => s instanceof Api.PhotoSize);

      if (!thumb || !(thumb instanceof Api.PhotoSize)) {
        throw new ApiError(404, "No thumbnail available for this document");
      }

      location = new Api.InputDocumentFileLocation({
        id: doc.id,
        accessHash: doc.accessHash,
        fileReference: doc.fileReference,
        thumbSize: thumb.type,
      });
    } else {
      throw new ApiError(400, "Media type does not support thumbnails");
    }

    const chunks: Buffer[] = [];
    const stream = client.iterDownload({
      file: location!,
      requestSize: 65536,
    });

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    const buffer = Buffer.concat(chunks);
    if (!buffer.length) {
      throw new ApiError(500, "Failed to download thumbnail");
    }

    set.headers["Content-Type"] = mimeType;
    set.headers["Cache-Control"] = "public, max-age=86400";
    return buffer;
  }, {
    query: t.Object({
      message_id: t.Union([t.Number(), t.String()]),
      folder_id: t.Optional(t.Union([t.Number(), t.String(), t.Null()])),
      peer_id: t.Optional(t.Union([t.Number(), t.String(), t.Null()])),
      session_id: t.Optional(t.String()),
      share_token: t.Optional(t.String()),
    }),
    detail: {
      summary: "Get media thumbnail",
      tags: ["Files"],
    }
  });
