import { Elysia, t } from "elysia";
import { ApiError } from "../errors.js";
import { getTelegramClient } from "../../services/telegram.js";
import { getSession } from "../../repositories/sessions.js";
import { getFileChunks } from "../../repositories/index.js";
import { Api } from "telegram";
import bigInt from "big-integer";
import { getShareLink } from "../../repositories/shares.js";
import { sqlite } from "../../db.js";

export const streamRouter = new Elysia({ prefix: "/stream" })
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
            message: "Owner is currently offline, stream unavailable",
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
  .get("/", async ({ query: { message_id, folder_id }, sessionId, isPublicShare, share, headers, set }) => {
    const mId = typeof message_id === 'string' ? parseInt(message_id, 10) : message_id;
    const fId = folder_id ? (typeof folder_id === 'string' ? parseInt(folder_id, 10) : folder_id) : null;

    if (isNaN(mId)) {
      throw new ApiError(400, "invalid message_id");
    }

    if (isPublicShare) {
      const s = share as any;
      if (s.share_type === "file" && s.message_id !== mId) {
        throw new ApiError(403, "Forbidden: This file is not part of the share");
      }
      if (s.share_type === "folder") {
        const targetFolderId = s.folder_id === 0 ? null : s.folder_id;
        if (targetFolderId !== fId) {
          throw new ApiError(
            403,
            "Forbidden: This folder is not part of the share",
          );
        }
      }
    }

    const session = await getSession(sessionId!);
    if (!session) throw new ApiError(401, "Session not found");

    const client = await getTelegramClient(sessionId!);
    const peer = fId
      ? await client.getInputEntity(fId)
      : await client.getInputEntity("me");

    const dbChunks = await getFileChunks(session.phone, fId ?? 0, mId);
    let messages: Api.Message[] = [];
    let fileName = "download";
    let mimeType = "application/octet-stream";
    let totalSize = 0;

    if (dbChunks && dbChunks.length > 0) {
      const messageIds = dbChunks.map((c) => c.message_id);
      messages = (await client.getMessages(peer, {
        ids: messageIds,
      })) as Api.Message[];

      messages.sort((a, b) => {
        const idxA = dbChunks.find((c) => c.message_id === a.id)?.chunk_index || 0;
        const idxB = dbChunks.find((c) => c.message_id === b.id)?.chunk_index || 0;
        return idxA - idxB;
      });

      totalSize = dbChunks.reduce((acc, c) => acc + c.size, 0);
      fileName = dbChunks[0].name;
      mimeType = dbChunks[0].mime_type || "application/octet-stream";
    } else {
      const msgs = (await client.getMessages(peer, {
        ids: [mId],
      })) as Api.Message[];
      if (!msgs || msgs.length === 0) throw new ApiError(404, "File not found");
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
        throw new ApiError(400, "Unsupported media type");
      }
    }

    const range = headers.range;
    let start = 0;
    let end = totalSize - 1;

    set.headers["Accept-Ranges"] = "bytes";
    set.headers["Content-Type"] = mimeType;
    const safeFileName = fileName.replace(/[^\x20-\x7E]/g, "?");
    const encodedFileName = encodeURIComponent(fileName);
    set.headers[
      "Content-Disposition"
    ] = `inline; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = end - start + 1;

      set.status = 206;
      set.headers["Content-Range"] = `bytes ${start}-${end}/${totalSize}`;
      set.headers["Content-Length"] = chunkSize.toString();
    } else {
      set.headers["Content-Length"] = totalSize.toString();
    }

    const stream = new ReadableStream({
      async start(controller) {
        let currentGlobalOffset = 0;
        try {
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

            if (currentGlobalOffset <= end && chunkEnd >= start) {
              const localStart = Math.max(0, start - currentGlobalOffset);
              const localEnd = Math.min(chunkSize - 1, end - currentGlobalOffset);
              const bytesToRead = localEnd - localStart + 1;

              if (bytesToRead > 0) {
                const chunkStream = client.iterDownload({
                  file: media,
                  offset: bigInt(localStart),
                  requestSize: 1024 * 1024,
                });

                let bytesStreamedInChunk = 0;
                for await (const chunk of chunkStream) {
                  const remaining = bytesToRead - bytesStreamedInChunk;
                  if (remaining <= 0) break;

                  if (chunk.length > remaining) {
                    controller.enqueue(chunk.slice(0, remaining));
                    bytesStreamedInChunk += remaining;
                    break;
                  } else {
                    controller.enqueue(chunk);
                    bytesStreamedInChunk += chunk.length;
                  }
                }
              }
            }

            currentGlobalOffset += chunkSize;
            if (currentGlobalOffset > end) break;
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      status: set.status as any,
      headers: set.headers as any,
    });
  }, {
    query: t.Object({
      message_id: t.Union([t.Number(), t.String()]),
      folder_id: t.Optional(t.Union([t.Number(), t.String()])),
      session_id: t.Optional(t.String()),
      share_token: t.Optional(t.String()),
    }),
    headers: t.Object({
      range: t.Optional(t.String({ description: "HTTP Range header for partial content" })),
      "x-session-id": t.Optional(t.String()),
    }),
    detail: {
      summary: "Stream file or media",
      description: "Supports range requests. Requires either x-session-id (or session_id query) OR a share_token.",
      tags: ["Stream"],
    }
  });
