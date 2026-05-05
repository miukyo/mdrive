import { Elysia, t } from "elysia";
import crypto from "node:crypto";
import { ApiError } from "../errors.js";
import {
  createShareLink,
  getShareLink,
  getUserShares,
  deleteShareLink,
  toggleShareLink,
  findExistingShareLink,
} from "../../repositories/shares.js";
import { getSession } from "../../repositories/sessions.js";
import { getMessageMedia } from "../../services/preview.js";
import archiver from "archiver";
import { getFiles } from "../../services/drive.js";
import { sqlite } from "../../db.js";
import { Readable } from "node:stream";
import { getTelegramClient } from "../../services/telegram.js";
import { getFileChunks } from "../../repositories/index.js";
import { Api } from "telegram";

export const shareRouter = new Elysia({ prefix: "/share" })
  .post("/create", async ({ body: { share_type, folder_id, message_id }, headers }) => {
    const sessionId = headers["x-session-id"]!;
    const session = await getSession(sessionId);
    if (!session) throw new ApiError(401, "Session not found");

    const fId = folder_id !== undefined ? (typeof folder_id === 'string' ? parseInt(folder_id, 10) : folder_id) : null;
    const mId = message_id ? (typeof message_id === 'string' ? parseInt(message_id, 10) : message_id) : null;

    const existingToken = await findExistingShareLink(
      session.phone,
      share_type,
      fId,
      mId,
    );

    if (existingToken) {
      return { url: `/share/${existingToken}` };
    }

    const token = crypto.randomUUID();
    await createShareLink(token, session.phone, share_type, fId, mId);

    return { url: `/share/${token}` };
  }, {
    headers: t.Object({ "x-session-id": t.String() }),
    body: t.Object({
      share_type: t.Union([t.Literal("file"), t.Literal("folder")], { description: "Type of share" }),
      folder_id: t.Optional(t.Union([t.Number(), t.String()])),
      message_id: t.Optional(t.Union([t.Number(), t.String()])),
    }),
    detail: {
      summary: "Create public share link",
      tags: ["Share"],
    }
  })
  .get("/", async ({ headers }) => {
    const sessionId = headers["x-session-id"]!;
    const session = await getSession(sessionId);
    if (!session) throw new ApiError(401, "Session not found");

    const shares = await getUserShares(session.phone);
    return { data: shares };
  }, {
    headers: t.Object({ "x-session-id": t.String() }),
    detail: {
      summary: "List all user shares",
      tags: ["Share"],
    }
  })
  .delete("/:token", async ({ params: { token }, headers }) => {
    const sessionId = headers["x-session-id"]!;
    const session = await getSession(sessionId);
    if (!session) throw new ApiError(401, "Session not found");

    await deleteShareLink(token, session.phone);
    return { success: true };
  }, {
    headers: t.Object({ "x-session-id": t.String() }),
    params: t.Object({ token: t.String() }),
    detail: {
      summary: "Delete share link",
      tags: ["Share"],
    }
  })
  .patch("/:token/toggle", async ({ params: { token }, headers }) => {
    const sessionId = headers["x-session-id"]!;
    const session = await getSession(sessionId);
    if (!session) throw new ApiError(401, "Session not found");

    await toggleShareLink(token, session.phone);
    return { success: true };
  }, {
    headers: t.Object({ "x-session-id": t.String() }),
    params: t.Object({ token: t.String() }),
    detail: {
      summary: "Toggle share link active state",
      tags: ["Share"],
    }
  })
  .get("/:token", async ({ params: { token } }) => {
    const share = await getShareLink(token);
    if (!share) throw new ApiError(404, "Share link not found");
    if (share.is_active === 0) {
      throw new ApiError(403, "This share link has been disabled");
    }

    const owner = sqlite
      .query(
        "SELECT phone FROM telegram_sessions WHERE phone = ? AND auth_state = 'logged_in' LIMIT 1",
      )
      .get(share.phone) as { phone: string } | undefined;

    let response: any = {
      token: share.token,
      share_type: share.share_type,
      owner_phone: share.phone,
      created_at: share.created_at,
      is_owner_online: !!owner,
    };

    if (share.share_type === "file" && share.message_id) {
      const file = sqlite
        .query(
          "SELECT * FROM telegram_index_files WHERE phone = ? AND message_id = ? LIMIT 1",
        )
        .get(share.phone, share.message_id);
      response.file = file;
    } else if (share.share_type === "folder" && share.folder_id !== null) {
      const folder = sqlite
        .query(
          "SELECT * FROM telegram_index_folders WHERE phone = ? AND folder_id = ? LIMIT 1",
        )
        .get(share.phone, share.folder_id);

      const fileCount = sqlite
        .query(
          "SELECT COUNT(*) as count FROM telegram_index_files WHERE phone = ? AND folder_id = ?",
        )
        .get(share.phone, share.folder_id) as { count: number };

      response.folder = folder;
      response.file_count = fileCount.count;
    }

    return response;
  }, {
    params: t.Object({ token: t.String() }),
    detail: {
      summary: "Get share link information",
      tags: ["Share"],
    }
  })
  .get("/:token/stream", async ({ params: { token }, query, set }) => {
    const share = await getShareLink(token);
    if (!share) throw new ApiError(404, "Share link not found");
    if (share.is_active === 0) {
      throw new ApiError(403, "This share link has been disabled");
    }
    if (share.share_type !== "file" || !share.message_id) {
      throw new ApiError(400, "Streaming is only available for individual files");
    }

    const row = sqlite
      .query(
        "SELECT id, phone FROM telegram_sessions WHERE phone = ? AND auth_state = 'logged_in' LIMIT 1",
      )
      .get(share.phone) as { id: string; phone: string } | undefined;
    if (!row) {
      throw new ApiError(500, "User session unavailable to process share");
    }

    const sessionId = row.id;
    const phone = row.phone;
    const client = await getTelegramClient(sessionId);
    const peer = share.folder_id
      ? await client.getInputEntity(share.folder_id)
      : await client.getInputEntity("me");

    const file = sqlite
      .query(
        "SELECT * FROM telegram_index_files WHERE phone = ? AND message_id = ? LIMIT 1",
      )
      .get(phone, share.message_id) as any;

    if (!file) throw new ApiError(404, "File not found in index");

    if (query.download === "1") {
      const safeFileName = file.name.replace(/[^\x20-\x7E]/g, "?");
      const encodedFileName = encodeURIComponent(file.name);
      set.headers[
        "Content-Disposition"
      ] = `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`;
    }
    set.headers["Content-Type"] = file.mime_type || "application/octet-stream";
    set.headers["Accept-Ranges"] = "none";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const dbChunks = await getFileChunks(
            phone,
            share.folder_id ?? 0,
            share.message_id!,
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

            for (const msg of messages) {
              const media = msg.media;
              if (
                media instanceof Api.MessageMediaDocument &&
                media.document instanceof Api.Document
              ) {
                const chunkStream = client.iterDownload({
                  file: media,
                  requestSize: 1024 * 1024,
                });
                for await (const chunk of chunkStream) {
                  controller.enqueue(chunk);
                }
              }
            }
           controller.close();
          } else {
            const { media } = await getMessageMedia(
              sessionId,
              share.folder_id,
              share.message_id!,
            );
            const chunkStream = client.iterDownload({
              file: media,
              requestSize: 1024 * 1024,
            });
            for await (const chunk of chunkStream) {
              controller.enqueue(chunk);
            }
            controller.close();
          }
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, { headers: set.headers as any });
  }, {
    params: t.Object({ token: t.String() }),
    query: t.Object({
      download: t.Optional(t.String({ description: "Set to '1' to trigger file download" })),
    }),
    detail: {
      summary: "Stream shared file",
      tags: ["Share"],
    }
  })
  .get("/:token/zip", async ({ params: { token }, set }) => {
    const share = await getShareLink(token);
    if (!share) throw new ApiError(404, "Share link not found");
    if (share.is_active === 0) {
      throw new ApiError(403, "This share link has been disabled");
    }

    if (share.share_type !== "folder") {
      throw new ApiError(400, "Download as ZIP is only available for folders");
    }

    const row = sqlite
      .query(
        "SELECT id FROM telegram_sessions WHERE phone = ? AND auth_state = 'logged_in' LIMIT 1",
      )
      .get(share.phone) as { id: string } | undefined;
    if (!row) {
      throw new ApiError(500, "User session unavailable to process share");
    }

    const sessionId = row.id;
    const client = await getTelegramClient(sessionId);
    const peer = share.folder_id
      ? await client.getInputEntity(share.folder_id)
      : await client.getInputEntity("me");

    const files = await getFiles(
      sessionId,
      share.folder_id === 0 ? null : share.folder_id,
    );

    set.headers["Content-Type"] = "application/zip";
    set.headers[
      "Content-Disposition"
    ] = `attachment; filename="shared_folder_${token.slice(0, 8)}.zip"`;

    const archive = archiver("zip", { zlib: { level: 9 } });

    const stream = new ReadableStream({
      start(controller) {
        archive.on("data", (chunk) => controller.enqueue(chunk));
        archive.on("end", () => controller.close());
        archive.on("error", (err) => controller.error(err));

        (async () => {
          for (const fileMeta of files) {
            try {
              const dbChunks = await getFileChunks(
                share.phone,
                share.folder_id ?? 0,
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
                    const media = msg.media;
                    if (
                      media instanceof Api.MessageMediaDocument &&
                      media.document instanceof Api.Document
                    ) {
                      const chunkStream = client.iterDownload({
                        file: media,
                        requestSize: 1024 * 1024,
                      });
                      for await (const chunk of chunkStream) {
                        yield chunk;
                      }
                    }
                  }
                }

                archive.append(Readable.from(streamMultipleMessages()), {
                  name: fileMeta.name,
                });
              } else {
                const { media } = await getMessageMedia(
                  sessionId,
                  share.folder_id === 0 ? null : share.folder_id,
                  fileMeta.id,
                );
                const chunkStream = client.iterDownload({
                  file: media,
                  requestSize: 1024 * 1024,
                });
                archive.append(Readable.from(chunkStream), { name: fileMeta.name });
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
    params: t.Object({ token: t.String() }),
    detail: {
      summary: "Download shared folder as ZIP",
      tags: ["Share"],
    }
  });
