import { Elysia, t } from "elysia";
import { ApiError } from "../errors.js";
import { refreshIndex } from "../../services/indexer.js";
import { createBackup, restoreLatestBackup } from "../../services/backup.js";
import { searchFiles, getStorageStats } from "../../repositories/index.js";
import { getSession } from "../../repositories/sessions.js";

export const indexingRouter = new Elysia({ prefix: "/index" })
  .derive(({ headers }) => {
    const sessionId = headers["x-session-id"];
    return { 
      sessionId,
      hasSession: !!sessionId 
    };
  })
  .onBeforeHandle(({ hasSession, set }) => {
    if (!hasSession) {
      set.status = 401;
      return {
        error: { message: "Unauthorized: missing x-session-id" },
      };
    }
  })
  .post("/refresh", async ({ sessionId }) => {
    await refreshIndex(sessionId!);
    return { status: "indexing_completed" };
  }, {
    detail: {
      summary: "Refresh file index",
      tags: ["Index"],
    }
  })
  .get("/search", async ({ query: { q, category, folderId, startDate, endDate, limit, offset, ids }, sessionId }) => {
    const session = await getSession(sessionId!);
    if (!session) throw new ApiError(401, "Session not found");

    const messageIds = ids
      ? ids.split(",")
          .map((id) => parseInt(id, 10))
          .filter((id) => !isNaN(id))
      : undefined;

    const results = await searchFiles(session.phone, {
      query: q,
      category,
      folderId: folderId ? parseInt(folderId) : undefined,
      startDate,
      endDate,
      messageIds,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
    return { data: results };
  }, {
    query: t.Object({
      q: t.Optional(t.String({ description: "Search query string" })),
      category: t.Optional(t.String({ description: "Filter by file category" })),
      folderId: t.Optional(t.String({ description: "Filter by folder ID" })),
      startDate: t.Optional(t.String({ format: "date-time" })),
      endDate: t.Optional(t.String({ format: "date-time" })),
      limit: t.Optional(t.String({ default: "50" })),
      offset: t.Optional(t.String({ default: "0" })),
      ids: t.Optional(t.String({ description: "Comma-separated message IDs" })),
    }),
    detail: {
      summary: "Search files",
      tags: ["Index"],
    }
  })
  .get("/stats", async ({ sessionId }) => {
    const session = await getSession(sessionId!);
    if (!session) throw new ApiError(401, "Session not found");

    const stats = await getStorageStats(session.phone);
    return { data: stats };
  }, {
    detail: {
      summary: "Get storage statistics",
      tags: ["Index"],
    }
  })
  .post("/backup", async ({ sessionId }) => {
    await createBackup(sessionId!);
    return { status: "backup_sent" };
  }, {
    detail: {
      summary: "Create and send index backup to Telegram",
      tags: ["Index"],
    }
  })
  .post("/restore", async ({ sessionId }) => {
    const result = await restoreLatestBackup(sessionId!);
    return result;
  }, {
    detail: {
      summary: "Restore index from latest Telegram backup",
      tags: ["Index"],
    }
  });
