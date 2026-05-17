import { Elysia, t } from "elysia";
import { ApiError } from "../errors.js";
import {
  getFiles,
  deleteFiles,
  moveFiles,
  renameFile as renameTelegram,
  resolvePeer,
} from "../../services/drive.js";
import { getTelegramClient, getEntitySafe } from "../../services/telegram.js";
import { CustomFile } from "telegram/client/uploads.js";
import { Api } from "telegram";
import { emitProgress } from "../../services/progress.js";
import { refreshIndex } from "../../services/indexer.js";
import { getSession } from "../../repositories/sessions.js";
import {
  renameFile as renameLocal,
  getFileFolders,
  saveFileIndex,
  deleteFilesFromIndex,
  moveFilesIndex,
  getAllChunkMessageIds,
} from "../../repositories/index.js";
import { deleteSharesByFiles, moveShares } from "../../repositories/shares.js";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const MAX_CHUNK_SIZE = 1900 * 1024 * 1024; // 1.9GB to stay safe under 2GB limit
const UPLOAD_TEMP_DIR = "cache/uploads/";

if (!fs.existsSync(UPLOAD_TEMP_DIR)) {
  fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
}

export const filesRouter = new Elysia({ prefix: "/files" })
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
  .get("/", async ({ query: { folder_id }, sessionId }) => {
    const fId = folder_id ? parseInt(folder_id, 10) : null;
    const files = await getFiles(sessionId!, fId);
    return { data: files };
  }, {
    query: t.Object({
      folder_id: t.Optional(t.String({ description: "Optional folder ID to list files from" })),
    }),
    detail: {
      summary: "List files",
      tags: ["Files"],
    }
  })
  .post("/upload", async ({ body: { files: uploadedFiles, folder_id, transfer_ids, transfer_id }, sessionId }) => {
    const files = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];
    if (!files || files.length === 0 || !files[0]) {
      throw new ApiError(400, "No files uploaded");
    }

    const client = await getTelegramClient(sessionId!);
    const session = await getSession(sessionId!);
    if (!session) throw new ApiError(401, "Session not found");
    
    const fId = folder_id ? parseInt(folder_id, 10) : null;
    const peer = fId
      ? await getEntitySafe(sessionId!, fId)
      : await getEntitySafe(sessionId!, "me");

    let idx = 0;
    for (const fileObj of files) {
      const file = fileObj as File;
      const originalname = file.name;
      const size = file.size;

      const tempPath = path.join(UPLOAD_TEMP_DIR, `${crypto.randomUUID()}_${originalname}`);
      const arrayBuffer = await file.arrayBuffer();
      await Bun.write(tempPath, arrayBuffer);

      let tid = "unknown";
      if (transfer_ids) {
        tid = Array.isArray(transfer_ids) ? transfer_ids[idx] : transfer_ids;
      } else if (transfer_id) {
        tid = transfer_id;
      }

      const totalChunks = Math.ceil(size / MAX_CHUNK_SIZE);
      const chunkId = totalChunks > 1 ? crypto.randomUUID() : undefined;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * MAX_CHUNK_SIZE;
        const end = Math.min(start + MAX_CHUNK_SIZE, size);
        const currentChunkSize = end - start;
        const basePercent = (start / size) * 100;

        const buffer = Buffer.from(arrayBuffer.slice(start, end));

        const uploadedFile = await client.uploadFile({
          file: new CustomFile(originalname, currentChunkSize, "", buffer),
          workers: 4,
          maxBufferSize: MAX_CHUNK_SIZE + 1024,
          onProgress: (progress) => {
            const chunkPercent = (progress as number) * (currentChunkSize / size) * 100;
            const backendPercent = basePercent + chunkPercent;
            const displayPercent = 50 + backendPercent * 0.5;

            emitProgress(sessionId!, "upload-progress", {
              id: tid,
              percent: Math.round(displayPercent),
            });
          },
        });

        const meta = {
          n: originalname,
          s: size,
          cid: chunkId,
          idx: i,
          tot: totalChunks,
        };

        const result = await client.sendFile(peer, {
          file: uploadedFile,
          forceDocument: true,
          caption: `[TD_META]${JSON.stringify(meta)}[/TD_META]`,
        });

        if (result instanceof Api.Message) {
          const resolvedPeer = await client.getEntity(peer);
          const peerId = resolvedPeer instanceof Api.User || resolvedPeer instanceof Api.Channel || resolvedPeer instanceof Api.Chat ? Number(resolvedPeer.id) : 0;

          await saveFileIndex(session.phone, {
            id: result.id,
            folder_id: fId,
            peer_id: peerId,
            name: originalname,
            size: size,
            mime_type: file.type,
            file_ext: path.extname(originalname).slice(1) || null,
            created_at: new Date().toISOString(),
            icon_type: "file",
            chunk_id: chunkId,
            chunk_index: i,
            total_chunks: totalChunks,
          });
        }
      }

      emitProgress(sessionId!, "upload-progress", { id: tid, percent: 100 });
      await fs.promises.unlink(tempPath);
      idx++;
    }

    return { status: "uploaded" };
  }, {
    body: t.Object({
      files: t.Files({ description: "Files to upload" }),
      folder_id: t.Optional(t.String()),
      transfer_ids: t.Optional(t.Union([t.String(), t.Array(t.String())])),
      transfer_id: t.Optional(t.String()),
    }),
    detail: {
      summary: "Upload files",
      tags: ["Files"],
    }
  })
  .post("/delete", async ({ body: { message_ids }, sessionId }) => {
    const session = await getSession(sessionId!);
    if (!session) throw new ApiError(401, "Session not found");

    const numericIds = message_ids.map((id) =>
      typeof id === "string" ? parseInt(id, 10) : id,
    );
    // Retrieve all message IDs including chunk messages
    const allMessageIds = await getAllChunkMessageIds(session.phone, numericIds);
    const mappings = await getFileFolders(session.phone, allMessageIds);

    // Group by folder_id
    const groups: Record<string, number[]> = {};
    for (const m of mappings) {
      const key = m.folder_id === null ? "null" : m.folder_id.toString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(m.message_id);
    }

    for (const [folderKey, ids] of Object.entries(groups)) {
      const fId = folderKey === "null" ? null : parseInt(folderKey, 10);
      await deleteFiles(sessionId!, fId, ids);
    }

    // Also delete any share links associated with these files
    await deleteSharesByFiles(session.phone, numericIds);

    // Update local index immediately
    await deleteFilesFromIndex(session.phone, numericIds);

    return { status: "deleted" };
  }, {
    body: t.Object({
      message_ids: t.Array(t.Union([t.Number(), t.String()])),
    }),
    detail: {
      summary: "Delete files (auto-detect folders)",
      tags: ["Files"],
    }
  })
  .post("/move", async ({ body: { message_ids, to_folder_id }, sessionId }) => {
    const session = await getSession(sessionId!);
    if (!session) throw new ApiError(401, "Session not found");

    const numericIds = message_ids.map((id) =>
      typeof id === "string" ? parseInt(id, 10) : id,
    );
    const targetFolderId =
      to_folder_id !== undefined && to_folder_id !== null
        ? typeof to_folder_id === "string"
          ? parseInt(to_folder_id, 10)
          : (to_folder_id as number)
        : 0;
    
    // Resolve all chunk message IDs so they are moved together
    const allMessageIds = await getAllChunkMessageIds(session.phone, numericIds);
    const mappings = await getFileFolders(session.phone, allMessageIds);

    // Group by source folder_id
    const groups: Record<string, number[]> = {};
    for (const m of mappings) {
      const key = (m.folder_id === null || m.folder_id === undefined) ? "0" : m.folder_id.toString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(m.message_id);
    }

    const allMappings: Record<number, number> = {};

    for (const [fromFolderKey, ids] of Object.entries(groups)) {
      const fromId = parseInt(fromFolderKey, 10);
      const mapping = await moveFiles(sessionId!, ids, fromId, targetFolderId);
      Object.assign(allMappings, mapping);
    }

    const client = await getTelegramClient(sessionId!);
    const targetPeer = await resolvePeer(sessionId!, targetFolderId);
    const resolvedTargetPeer = await client.getEntity(targetPeer);
    const targetPeerId = resolvedTargetPeer instanceof Api.User || resolvedTargetPeer instanceof Api.Channel || resolvedTargetPeer instanceof Api.Chat ? Number(resolvedTargetPeer.id) : 0;

    // Update local index immediately with new IDs and folder
    await moveFilesIndex(session.phone, allMappings, targetFolderId, targetPeerId);

    // Update corresponding public share links with new message_ids and target folder
    await moveShares(session.phone, allMappings, targetFolderId);

    return { status: "moved" };
  }, {
    body: t.Object({
      message_ids: t.Array(t.Union([t.Number(), t.String()])),
      to_folder_id: t.Optional(t.Union([t.Number(), t.String(), t.Null()])),
    }),
    detail: {
      summary: "Move files (auto-detect source folders)",
      tags: ["Files"],
    }
  })
  .post("/rename", async ({ body: { folder_id, message_id, new_name }, sessionId }) => {
    const session = await getSession(sessionId!);
    if (!session) throw new ApiError(401, "Session not found");

    const fId = folder_id ? parseInt(folder_id, 10) : null;
    const mId = typeof message_id === 'string' ? parseInt(message_id, 10) : message_id;

    await renameLocal(session.phone, fId ?? 0, mId, new_name);
    await renameTelegram(sessionId!, fId, mId, new_name);

    return { status: "renamed" };
  }, {
    body: t.Object({
      message_id: t.Union([t.Number(), t.String()]),
      folder_id: t.Optional(t.String()),
      new_name: t.String({ minLength: 1 }),
    }),
    detail: {
      summary: "Rename file",
      tags: ["Files"],
    }
  });
