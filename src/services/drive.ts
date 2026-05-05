import { Api } from 'telegram';
import { getTelegramClient, invokeQueued } from './telegram.js';
import { FileMetadata, FolderMetadata } from '../models.js';
import { deleteFolderIndex, saveFolderIndex } from '../repositories/index.js';
import { getSession } from '../repositories/sessions.js';
import path from 'node:path';

const resolvePeer = async (client: any, folderId: number | null) => {
  if (folderId) {
    return await client.getInputEntity(folderId);
  }
  return await client.getInputEntity('me');
};

export const createFolder = async (sessionId: string, name: string, parentId: number | null = null): Promise<FolderMetadata> => {
  const client = await getTelegramClient(sessionId);

  const title = parentId ? `${name} [TD:${parentId}]` : `${name} [TD]`;
  const about = parentId 
    ? `Telegram Drive Storage Folder\n[telegram-drive-folder]\n[parent:${parentId}]`
    : `Telegram Drive Storage Folder\n[telegram-drive-folder]`;

  const result = await invokeQueued(
    sessionId,
    new Api.channels.CreateChannel({
      title,
      about,
      broadcast: true,
      megagroup: false,
    })
  );

  let chatId = 0;
  let accessHash = undefined;

  if (result instanceof Api.Updates) {
    const chat = result.chats[0];
    if (chat instanceof Api.Channel) {
      chatId = Number(chat.id);
      accessHash = chat.accessHash;
    } else {
      throw new Error('Created chat is not a channel');
    }
  } else {
    throw new Error('Unexpected response');
  }

  // Explicitly Disable TTL
  try {
    await invokeQueued(
      sessionId,
      new Api.messages.SetHistoryTTL({
        peer: new Api.InputPeerChannel({
          channelId: chatId as any,
          accessHash: accessHash!,
        }),
        period: 0,
      }),
    );
  } catch (err: any) {
    // Ignore CHAT_NOT_MODIFIED error
    if (!err.errorMessage?.includes("CHAT_NOT_MODIFIED")) {
      console.error("Failed to set TTL:", err);
    }
  }

  const session = await getSession(sessionId);
  if (session) {
    await saveFolderIndex(session.phone, {
      id: chatId,
      name,
      parent_id: parentId,
    });
  }

  return {
    id: chatId,
    name,
    parent_id: parentId,
  };
};

export const deleteFolder = async (sessionId: string, folderId: number) => {
  const client = await getTelegramClient(sessionId);
  const peer = await resolvePeer(client, folderId);

  await invokeQueued(
    sessionId,
    new Api.channels.DeleteChannel({
      channel: peer,
    })
  );

  const session = await getSession(sessionId);
  if (session) {
    await deleteFolderIndex(session.phone, folderId);
  }

  return true;
};

export const scanFolders = async (sessionId: string): Promise<FolderMetadata[]> => {
  const client = await getTelegramClient(sessionId);
  const folders: FolderMetadata[] = [];

  const dialogs = await client.getDialogs({});

  for (const dialog of dialogs) {
    const entity = dialog.entity;
    if (entity && entity.className === 'Channel') {
      const name = entity.title || '';
      const id = Number(entity.id);

      if (name.toLowerCase().includes('[td')) {
        let parentId: number | null = null;
        const parentMatch = name.match(/\[TD:(-?\d+)\]/i);
        if (parentMatch) {
          parentId = parseInt(parentMatch[1], 10);
        }
        const displayName = name.replace(/ \[TD(:-?\d+)?\]/gi, '').replace(/\[TD(:-?\d+)?\]/gi, '').trim();
        folders.push({ id, name: displayName, parent_id: parentId });
        continue;
      }

      try {
        const fullChat = await invokeQueued(
          sessionId,
          new Api.channels.GetFullChannel({
            channel: await client.getInputEntity(entity),
          })
        );
        if (fullChat.fullChat instanceof Api.ChannelFull) {
          const about = fullChat.fullChat.about;
          if (about.includes('[telegram-drive-folder]')) {
            let parentId: number | null = null;
            const parentMatch = about.match(/\[parent:(-?\d+)\]/i);
            if (parentMatch) {
              parentId = parseInt(parentMatch[1], 10);
            }
            folders.push({ id, name, parent_id: parentId });
          }
        }
      } catch (e) {
        console.warn(`Failed to get full info for ${name}`, e);
      }
    }
  }
  return folders;
};

export const extractMetadata = (text: string) => {
  const match = text.match(/\[TD_META\](.*)\[\/TD_META\]/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      return null;
    }
  }
  return null;
};

export const getFiles = async (
  sessionId: string,
  folderId: number | null,
): Promise<FileMetadata[]> => {
  const client = await getTelegramClient(sessionId);
  const files: FileMetadata[] = [];

  const peer = await resolvePeer(client, folderId);
  const messages = await client.getMessages(peer, { limit: 1000 });

  for (const msg of messages) {
    if (msg.media && msg.media instanceof Api.MessageMediaDocument) {
      const doc = msg.media.document;
      if (doc instanceof Api.Document) {
        let name = msg.message || "";
        const meta = extractMetadata(name);

        if (meta) {
          name = meta.n || name;
        } else if (!name) {
          for (const attr of doc.attributes) {
            if (attr instanceof Api.DocumentAttributeFilename) {
              name = attr.fileName;
            }
          }
        }

        if (!name) name = "Unknown";

        const size = meta?.s || Number(doc.size);
        const mime = doc.mimeType;
        const ext = path.extname(name).slice(1) || null;

        files.push({
          id: msg.id,
          folder_id: folderId,
          name,
          size,
          mime_type: mime,
          file_ext: ext,
          created_at: new Date(msg.date * 1000).toISOString(),
          icon_type: "file",
          chunk_id: meta?.cid,
          chunk_index: meta?.idx,
          total_chunks: meta?.tot,
        });
      }
    } else if (msg.media && msg.media instanceof Api.MessageMediaPhoto) {
      files.push({
        id: msg.id,
        folder_id: folderId,
        name: msg.message || "Photo.jpg",
        size: 0,
        mime_type: "image/jpeg",
        file_ext: "jpg",
        created_at: new Date(msg.date * 1000).toISOString(),
        icon_type: "file",
      });
    }
  }

  return files;
};

export const deleteFiles = async (sessionId: string, folderId: number | null, messageIds: number[]) => {
  const client = await getTelegramClient(sessionId);
  const peer = await resolvePeer(client, folderId);
  await client.deleteMessages(peer, messageIds, { revoke: true });
  return true;
};

export const moveFiles = async (sessionId: string, messageIds: number[], sourceFolderId: number | null, targetFolderId: number | null) => {
  if (sourceFolderId === targetFolderId) return true;

  const client = await getTelegramClient(sessionId);
  const sourcePeer = await resolvePeer(client, sourceFolderId);
  const targetPeer = await resolvePeer(client, targetFolderId);

  await client.forwardMessages(targetPeer, {
    messages: messageIds,
    fromPeer: sourcePeer,
  });

  await client.deleteMessages(sourcePeer, messageIds, { revoke: true });
  return true;
};

export const renameFile = async (
  sessionId: string,
  folderId: number | null,
  messageId: number,
  newName: string,
) => {
  const client = await getTelegramClient(sessionId);
  const peer = await resolvePeer(client, folderId);

  // Fetch message to preserve metadata if exists
  const [msg] = await client.getMessages(peer, { ids: [messageId] });
  let text = newName;

  if (msg && msg.message) {
    const meta = extractMetadata(msg.message);
    if (meta) {
      meta.n = newName;
      text = `${newName} [TD_META]${JSON.stringify(meta)}[/TD_META]`;
    }
  }

  await invokeQueued(sessionId, new Api.messages.EditMessage({
    peer,
    id: messageId,
    message: text,
  }));
  return true;
};
