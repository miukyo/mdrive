import { Elysia, t } from "elysia";
import { ApiError } from "../errors.js";
import { createFolder, deleteFolder, renameFolder } from "../../services/drive.js";
import { getFolders } from "../../repositories/index.js";
import { getSession } from "../../repositories/sessions.js";
import { deleteShareByFolder, deleteSharesByFolderFiles } from "../../repositories/shares.js";

export const foldersRouter = new Elysia({ prefix: "/folders" })
  .derive(({ headers }) => {
    const sessionId = headers["x-session-id"];
    return { 
      sessionId,
      hasSession: !!sessionId 
    };
  })
  .onBeforeHandle(({ hasSession, set }) => {
    if (!hasSession) {
      throw new ApiError(401, "Unauthorized: missing x-session-id");
    }
  })
  .get("/", async ({ sessionId }) => {
    const session = await getSession(sessionId!);
    if (!session) throw new ApiError(401, "Session not found");

    const folders = await getFolders(session.phone);
    return { data: folders };
  }, {
    detail: {
      summary: "List folders",
      tags: ["Folders"],
    }
  })
  .post("/", async ({ body: { name, parent_id }, sessionId }) => {
    const parentId = parent_id ? (typeof parent_id === 'string' ? parseInt(parent_id, 10) : parent_id) : null;
    const folder = await createFolder(sessionId!, name, parentId);
    return { data: folder };
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, description: "Folder name" }),
      parent_id: t.Optional(t.Union([t.Number(), t.String()])),
    }),
    detail: {
      summary: "Create folder",
      tags: ["Folders"],
    }
  })
  .put("/:id", async ({ params: { id }, body: { name }, sessionId }) => {
    const folderId = parseInt(id, 10);
    if (isNaN(folderId)) {
      throw new ApiError(400, "invalid folder id");
    }

    await renameFolder(sessionId!, folderId, name);
    return { status: "renamed" };
  }, {
    params: t.Object({
      id: t.String({ description: "Folder ID (numeric)" }),
    }),
    body: t.Object({
      name: t.String({ minLength: 1, description: "New folder name" }),
    }),
    detail: {
      summary: "Rename folder",
      tags: ["Folders"],
    }
  })
  .delete("/:id", async ({ params: { id }, sessionId }) => {
    const folderId = parseInt(id, 10);
    if (isNaN(folderId)) {
      throw new ApiError(400, "invalid folder id");
    }

    const session = await getSession(sessionId!);
    if (!session) throw new ApiError(401, "Session not found");

    await deleteFolder(sessionId!, folderId);
    // Also delete any share link associated with this folder (recursive)
    await deleteShareByFolder(session.phone, folderId);
    await deleteSharesByFolderFiles(session.phone, folderId);
    
    return { status: "deleted" };
  }, {
    params: t.Object({
      id: t.String({ description: "Folder ID (numeric)" }),
    }),
    detail: {
      summary: "Delete folder",
      tags: ["Folders"],
    }
  });
