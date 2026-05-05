import { Elysia, t } from "elysia";
import { Api } from "telegram";
import { ApiError } from "../errors.js";
import { getTelegramClient } from "../../services/telegram.js";

export const thumbnailRouter = new Elysia({ prefix: "/thumbnail" })
  .derive(({ headers, query }) => {
    const sessionId = (headers["x-session-id"] as string) || (query.session_id as string);
    return { 
      sessionId,
      hasSession: !!sessionId 
    };
  })
  .onBeforeHandle(({ hasSession, set }) => {
    if (!hasSession) {
      set.status = 401;
      return {
        error: { message: "Unauthorized: missing session ID" },
      };
    }
  })
  .get("/", async ({ query: { message_id, folder_id }, sessionId, set }) => {
    const mId = typeof message_id === 'string' ? parseInt(message_id, 10) : message_id;
    const fId = folder_id ? (typeof folder_id === 'string' ? parseInt(folder_id, 10) : folder_id) : null;

    if (!mId) throw new ApiError(400, "message_id is required");

    const client = await getTelegramClient(sessionId!);
    const peer = fId
      ? await client.getInputEntity(fId)
      : await client.getInputEntity("me");

    const messages = (await client.getMessages(peer, {
      ids: [mId],
    })) as Api.Message[];
    if (!messages || messages.length === 0) {
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
      folder_id: t.Optional(t.Union([t.Number(), t.String()])),
      session_id: t.Optional(t.String()),
    }),
    detail: {
      summary: "Get media thumbnail",
      tags: ["Files"],
    }
  });
