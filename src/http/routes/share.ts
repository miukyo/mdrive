import { Router } from "express";
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

export const shareRouter = Router();

// Create share link (requires auth)
shareRouter.post("/create", async (req, res, next) => {
  try {
    const sessionId = req.headers["x-session-id"] as string;
    if (!sessionId) throw new ApiError(401, "Unauthorized");

    const session = await getSession(sessionId);
    if (!session) throw new ApiError(401, "Session not found");

    const { share_type, folder_id, message_id } = req.body;
    if (!share_type) {
      throw new ApiError(400, "share_type required");
    }
    if (share_type === "folder" && folder_id === undefined) {
      throw new ApiError(400, "folder_id required for folder share");
    }

    const fId = folder_id !== undefined ? parseInt(folder_id, 10) : null;
    const mId = message_id ? parseInt(message_id, 10) : null;

    const existingToken = await findExistingShareLink(
      session.phone,
      share_type,
      fId,
      mId,
    );

    if (existingToken) {
      return res.json({ url: `/share/${existingToken}` });
    }

    const token = crypto.randomUUID();
    await createShareLink(token, session.phone, share_type, fId, mId);

    res.json({ url: `/share/${token}` });
  } catch (err) {
    next(err);
  }
});

// List all shares for current user
shareRouter.get("/", async (req, res, next) => {
  try {
    const sessionId = req.headers["x-session-id"] as string;
    if (!sessionId) throw new ApiError(401, "Unauthorized");

    const session = await getSession(sessionId);
    if (!session) throw new ApiError(401, "Session not found");

    const shares = await getUserShares(session.phone);
    res.json({ data: shares });
  } catch (err) {
    next(err);
  }
});

// Delete share (requires auth)
shareRouter.delete("/:token", async (req, res, next) => {
  try {
    const sessionId = req.headers["x-session-id"] as string;
    if (!sessionId) throw new ApiError(401, "Unauthorized");

    const session = await getSession(sessionId);
    if (!session) throw new ApiError(401, "Session not found");

    const { token } = req.params;
    await deleteShareLink(token, session.phone);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Toggle share status (requires auth)
shareRouter.patch("/:token/toggle", async (req, res, next) => {
  try {
    const sessionId = req.headers["x-session-id"] as string;
    if (!sessionId) throw new ApiError(401, "Unauthorized");

    const session = await getSession(sessionId);
    if (!session) throw new ApiError(401, "Session not found");

    const { token } = req.params;
    await toggleShareLink(token, session.phone);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Download from share link (public)
shareRouter.get("/:token", async (req, res, next) => {
  try {
    const { token } = req.params;
    const share = await getShareLink(token);
    if (!share) throw new ApiError(404, "Share link not found");
    if (share.is_active === 0)
      throw new ApiError(403, "This share link has been disabled");

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

    res.json(response);
  } catch (err) {
    next(err);
  }
});

// Stream or download from share link (public)
shareRouter.get("/:token/stream", async (req, res, next) => {
  try {
    const { token } = req.params;
    const share = await getShareLink(token);
    if (!share) throw new ApiError(404, "Share link not found");
    if (share.is_active === 0)
      throw new ApiError(403, "This share link has been disabled");
    if (share.share_type !== "file" || !share.message_id) {
      throw new ApiError(
        400,
        "Streaming is only available for individual files",
      );
    }

    const row = sqlite
      .query(
        "SELECT id, phone FROM telegram_sessions WHERE phone = ? AND auth_state = 'logged_in' LIMIT 1",
      )
      .get(share.phone) as { id: string; phone: string } | undefined;
    if (!row)
      throw new ApiError(500, "User session unavailable to process share");

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

    const dbChunks = await getFileChunks(
      phone,
      share.folder_id ?? 0,
      share.message_id,
    );

    if (req.query.download === "1") {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(file.name)}"`,
      );
    }
    res.setHeader("Content-Type", file.mime_type || "application/octet-stream");
    res.setHeader("Accept-Ranges", "none"); // Telegram streaming is complex for ranges, keeping it simple

    if (dbChunks && dbChunks.length > 0) {
      // Multi-part file
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
          const stream = client.iterDownload({
            file: media,
            requestSize: 1024 * 1024,
          });
          for await (const chunk of stream) {
            res.write(chunk);
          }
        }
      }
      res.end();
    } else {
      // Single file
      const { media } = await getMessageMedia(
        sessionId,
        share.folder_id,
        share.message_id,
      );
      const stream = client.iterDownload({
        file: media,
        requestSize: 1024 * 1024,
      });
      for await (const chunk of stream) {
        res.write(chunk);
      }
      res.end();
    }
  } catch (err) {
    next(err);
  }
});

// Download ZIP of share (public)
shareRouter.get("/:token/zip", async (req, res, next) => {
  try {
    const { token } = req.params;
    const share = await getShareLink(token);
    if (!share) throw new ApiError(404, "Share link not found");
    if (share.is_active === 0)
      throw new ApiError(403, "This share link has been disabled");

    if (share.share_type !== "folder") {
      throw new ApiError(400, "Download as ZIP is only available for folders");
    }

    const row = sqlite
      .query(
        "SELECT id FROM telegram_sessions WHERE phone = ? AND auth_state = 'logged_in' LIMIT 1",
      )
      .get(share.phone) as { id: string } | undefined;
    if (!row)
      throw new ApiError(500, "User session unavailable to process share");

    const sessionId = row.id;
    const client = await getTelegramClient(sessionId);
    const peer = share.folder_id
      ? await client.getInputEntity(share.folder_id)
      : await client.getInputEntity("me");

    const files = await getFiles(
      sessionId,
      share.folder_id === 0 ? null : share.folder_id,
    );

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="shared_folder_${token.slice(0, 8)}.zip"`,
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    for (const fileMeta of files) {
      try {
        const dbChunks = await getFileChunks(
          share.phone,
          share.folder_id ?? 0,
          fileMeta.id,
        );

        if (dbChunks && dbChunks.length > 0) {
          // Multi-part file
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
                const stream = client.iterDownload({
                  file: media,
                  requestSize: 1024 * 1024,
                });
                for await (const chunk of stream) {
                  yield chunk;
                }
              }
            }
          }

          archive.append(Readable.from(streamMultipleMessages()), {
            name: fileMeta.name,
          });
        } else {
          // Single file
          const { media } = await getMessageMedia(
            sessionId,
            share.folder_id === 0 ? null : share.folder_id,
            fileMeta.id,
          );
          const stream = client.iterDownload({
            file: media,
            requestSize: 1024 * 1024,
          });
          archive.append(Readable.from(stream), { name: fileMeta.name });
        }
      } catch (e) {
        console.error(`Failed to append file ${fileMeta.id} to ZIP`, e);
      }
    }

    await archive.finalize();
  } catch (err) {
    next(err);
  }
});
