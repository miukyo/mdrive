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
import { getTelegramClient, getEntitySafe } from "../../services/telegram.js";
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
      folder_id: t.Optional(t.Union([t.Number(), t.String(), t.Null()])),
      message_id: t.Optional(t.Union([t.Number(), t.String(), t.Null()])),
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
  .get("/:token", async ({ params: { token }, query: { folder_id } }) => {
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
      let currentFolderId = share.folder_id;
      
      // If a subfolder_id is requested, verify it's a descendant of the shared folder
      if (folder_id) {
        const requestedId = parseInt(folder_id, 10);
        if (requestedId !== share.folder_id) {
          const isDescendant = sqlite.query(`
            WITH RECURSIVE subordinates AS (
              SELECT folder_id, parent_id FROM telegram_index_folders WHERE folder_id = ? AND phone = ?
              UNION ALL
              SELECT f.folder_id, f.parent_id FROM telegram_index_folders f
              INNER JOIN subordinates s ON f.folder_id = s.parent_id
              WHERE f.phone = ?
            )
            SELECT COUNT(*) as count FROM subordinates WHERE folder_id = ?
          `).get(requestedId, share.phone, share.phone, share.folder_id) as { count: number };

          if (isDescendant.count > 0) {
            currentFolderId = requestedId;
          } else {
            throw new ApiError(403, "Access denied to this folder");
          }
        }
      }

      const folder = sqlite
        .query(
          "SELECT * FROM telegram_index_folders WHERE phone = ? AND folder_id = ? LIMIT 1",
        )
        .get(share.phone, currentFolderId);

      const files = sqlite
        .query(
          "SELECT * FROM telegram_index_files WHERE phone = ? AND folder_id = ?",
        )
        .all(share.phone, currentFolderId);

      const subfolders = sqlite
        .query(
          "SELECT * FROM telegram_index_folders WHERE phone = ? AND parent_id = ?",
        )
        .all(share.phone, currentFolderId);

      response.folder = folder;
      response.files = files;
      response.subfolders = subfolders;
      response.is_root = currentFolderId === share.folder_id;
    }

    return response;
  }, {
    params: t.Object({ token: t.String() }),
    query: t.Object({
      folder_id: t.Optional(t.String({ description: "Subfolder ID to browse" })),
    }),
    detail: {
      summary: "Get share link information",
      tags: ["Share"],
    }
  });
