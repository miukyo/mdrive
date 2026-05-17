import { Elysia, t } from "elysia";
import { ApiError } from "../errors.js";
import { getTelegramClient, getEntitySafe } from "../../services/telegram.js";
import { getSession } from "../../repositories/sessions.js";
import { getFileChunks } from "../../repositories/index.js";
import { Api } from "telegram";
import bigInt from "big-integer";
import { getShareLink } from "../../repositories/shares.js";
import { sqlite } from "../../db.js";
import archiver from "archiver";
import { Readable } from "node:stream";
import { getMessageMedia } from "../../services/preview.js";

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
  .get("/", async ({ query: { message_id, folder_id, peer_id, download }, sessionId, isPublicShare, share, headers, set }) => {
    let mId: number;
    if (message_id === undefined || message_id === null) {
      if (isPublicShare && share && share.share_type === "file" && share.message_id !== null) {
        mId = share.message_id;
      } else {
        throw new ApiError(400, "invalid message_id");
      }
    } else {
      mId = typeof message_id === 'string' ? parseInt(message_id, 10) : message_id;
    }

    if (isNaN(mId)) {
      throw new ApiError(400, "invalid message_id");
    }

    let fId: number | null = null;
    if (peer_id) {
      fId = typeof peer_id === 'string' ? parseInt(peer_id, 10) : peer_id;
    } else if (folder_id !== undefined && folder_id !== null) {
      fId = typeof folder_id === 'string' ? parseInt(folder_id, 10) : folder_id;
    } else if (isPublicShare && share && share.share_type === "file") {
      fId = share.folder_id;
    }

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

    const session = await getSession(sessionId!);
    if (!session) throw new ApiError(401, "Session not found");

    const client = await getTelegramClient(sessionId!);
    const peer = fId
      ? await getEntitySafe(sessionId!, fId)
      : await getEntitySafe(sessionId!, "me");

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

      // Recalculate true size to guarantee Content-Length matches the stream exactly
      totalSize = messages.reduce((acc, msg) => {
        if (!msg) return acc;
        const media = msg.media;
        if (
          media instanceof Api.MessageMediaDocument &&
          media.document instanceof Api.Document
        ) {
          return acc + Number(media.document.size);
        }
        return acc;
      }, 0);
      fileName = dbChunks[0].name;
      mimeType = dbChunks[0].mime_type || "application/octet-stream";
    } else {
      const msgs = (await client.getMessages(peer, {
        ids: [mId],
      })) as Api.Message[];
      if (!msgs || msgs.length === 0 || !msgs[0]) throw new ApiError(404, "File not found");
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
    if (download === "1") {
      set.headers[
        "Content-Disposition"
      ] = `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`;
    } else {
      set.headers[
        "Content-Disposition"
      ] = `inline; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`;
    }

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

    async function* generateTelegramStream() {
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
                yield chunk.slice(0, remaining);
                bytesStreamedInChunk += remaining;
                break;
              } else {
                yield chunk;
                bytesStreamedInChunk += chunk.length;
              }
            }
          }
        }

        currentGlobalOffset += chunkSize;
        if (currentGlobalOffset > end) break;
      }
    }

    const iterator = generateTelegramStream();
    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { value, done } = await iterator.next();
          if (done) {
            controller.close();
          } else {
            controller.enqueue(value);
          }
        } catch (err) {
          controller.error(err);
        }
      },
      cancel() {
        iterator.return();
      },
    });

    return new Response(stream, {
      status: (set.status as number) || 200,
      headers: set.headers as any,
    });
  }, {
    query: t.Object({
      message_id: t.Optional(t.Union([t.Number(), t.String()])),
      folder_id: t.Optional(t.Union([t.Number(), t.String(), t.Null()])),
      peer_id: t.Optional(t.Union([t.Number(), t.String(), t.Null()])),
      session_id: t.Optional(t.String()),
      share_token: t.Optional(t.String()),
      download: t.Optional(t.String()),
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
  })
  .get("/zip", async ({ query: { folder_id, share_token, session_id }, sessionId, isPublicShare, share, set }) => {
    let fId = folder_id ? (typeof folder_id === 'string' ? parseInt(folder_id, 10) : folder_id) : null;
    let targetPhone = "";
    let rootFolderId = 0;
    let zipName = "folder.zip";

    if (isPublicShare) {
      const s = share as any;
      if (s.share_type !== "folder") {
        throw new ApiError(400, "Download as ZIP is only available for folders");
      }
      targetPhone = s.phone;
      rootFolderId = s.folder_id ?? 0;
      // If a nested folder_id is requested, verify descendant access
      if (fId && fId !== rootFolderId) {
        const isDescendant = sqlite.query(`
          WITH RECURSIVE subordinates AS (
            SELECT folder_id, parent_id FROM telegram_index_folders WHERE folder_id = ? AND phone = ?
            UNION ALL
            SELECT f.folder_id, f.parent_id FROM telegram_index_folders f
            INNER JOIN subordinates s ON f.folder_id = s.parent_id
            WHERE f.phone = ?
          )
          SELECT COUNT(*) as count FROM subordinates WHERE folder_id = ?
        `).get(fId, s.phone, s.phone, rootFolderId) as { count: number };

        if (isDescendant.count === 0) {
          throw new ApiError(403, "Forbidden: This folder is not part of the share");
        }
        rootFolderId = fId;
      }
      zipName = `shared_folder_${share_token?.slice(0, 8) || "export"}.zip`;
    } else {
      // Admin download
      const session = await getSession(sessionId!);
      if (!session) throw new ApiError(401, "Session not found");
      targetPhone = session.phone;
      rootFolderId = fId ?? 0;
      
      if (rootFolderId === 0) {
        zipName = "drive_root.zip";
      } else {
        const folder = sqlite.query(
          "SELECT name FROM telegram_index_folders WHERE phone = ? AND folder_id = ? LIMIT 1"
        ).get(targetPhone, rootFolderId) as { name: string } | undefined;
        zipName = folder ? `${folder.name}.zip` : "folder.zip";
      }
    }

    const client = await getTelegramClient(sessionId!);

    // Recursive helper to get all files in all subfolders
    const getAllFilesRecursive = (startFolderId: number) => {
      const allFiles: any[] = [];
      const traverse = (currentFId: number, pathPrefix: string = "") => {
        const files = sqlite
          .query("SELECT id, name, folder_id FROM telegram_index_files WHERE phone = ? AND folder_id = ?")
          .all(targetPhone, currentFId) as any[];
        
        for (const file of files) {
          allFiles.push({ ...file, zipPath: pathPrefix + file.name });
        }

        const subfolders = sqlite
          .query("SELECT folder_id, name FROM telegram_index_folders WHERE phone = ? AND parent_id = ?")
          .all(targetPhone, currentFId) as any[];

        for (const sub of subfolders) {
          traverse(sub.folder_id, pathPrefix + sub.name + "/");
        }
      };
      traverse(startFolderId);
      return allFiles;
    };

    const files = getAllFilesRecursive(rootFolderId);

    set.headers["Content-Type"] = "application/zip";
    const safeZipName = zipName.replace(/[^\x20-\x7E]/g, "?");
    const encodedZipName = encodeURIComponent(zipName);
    set.headers[
      "Content-Disposition"
    ] = `attachment; filename="${safeZipName}"; filename*=UTF-8''${encodedZipName}`;

    const archive = archiver("zip", { zlib: { level: 9 } });

    const stream = new ReadableStream({
      start(controller) {
        archive.on("data", (chunk) => controller.enqueue(chunk));
        archive.on("end", () => controller.close());
        archive.on("error", (err) => controller.error(err));

        (async () => {
          for (const fileMeta of files) {
            try {
              const peer = await getEntitySafe(sessionId!, fileMeta.folder_id || "me");
              const dbChunks = await getFileChunks(
                targetPhone,
                fileMeta.folder_id ?? 0,
                fileMeta.id,
              );

              if (dbChunks && dbChunks.length > 0) {
                const messages = (await client.getMessages(peer, {
                  ids: dbChunks.map((c) => c.message_id),
                })) as Api.Message[];

                messages.sort((a, b) => {
                  const idxA =
                    dbChunks.find((c) => c.message_id === a.id)?.chunk_index || 0;
                  const idxB =
                    dbChunks.find((c) => c.message_id === b.id)?.chunk_index || 0;
                  return idxA - idxB;
                });

                async function* streamMultipleMessages() {
                  for (const msg of messages) {
                    if (msg && msg.media) {
                      const chunkStream = client.iterDownload({
                        file: msg.media,
                        requestSize: 1024 * 1024,
                      });
                      for await (const chunk of chunkStream) {
                        yield chunk;
                      }
                    }
                  }
                }

                archive.append(Readable.from(streamMultipleMessages()), {
                  name: fileMeta.zipPath,
                });
              } else {
                const { media } = await getMessageMedia(
                  sessionId!,
                  fileMeta.folder_id ?? 0,
                  fileMeta.id,
                );
                const chunkStream = client.iterDownload({
                  file: media,
                  requestSize: 1024 * 1024,
                });
                archive.append(Readable.from(chunkStream), { name: fileMeta.zipPath });
              }
            } catch (e) {
              console.error(`Failed to append file ${fileMeta.id} to ZIP`, e);
            }
          }
          await archive.finalize();
        })();
      },
    });

    return new Response(stream, { headers: set.headers as any });
  }, {
    query: t.Object({
      folder_id: t.Optional(t.Union([t.Number(), t.String(), t.Null()])),
      share_token: t.Optional(t.String()),
      session_id: t.Optional(t.String()),
    }),
    detail: {
      summary: "Download folder as ZIP",
      description: "Requires either active session ID OR valid public share token.",
      tags: ["Stream"],
    }
  });
