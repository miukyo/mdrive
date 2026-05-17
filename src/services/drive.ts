import { Api } from 'telegram';
import { getTelegramClient, invokeQueued, getEntitySafe } from './telegram.js';
import { FileMetadata, FolderMetadata } from '../models.js';
import { deleteFolderIndex, saveFolderIndex } from '../repositories/index.js';
import { getSession } from '../repositories/sessions.js';
import { sqlite } from '../db.js';
import path from 'node:path';

export const resolvePeer = async (sessionId: string, folderId: number | null) => {
  if (folderId) {
    return await getEntitySafe(sessionId, folderId);
  }
  return await getEntitySafe(sessionId, 'me');
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
  const peer = await resolvePeer(sessionId, folderId);

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

export const renameFolder = async (sessionId: string, folderId: number, newName: string) => {
  const client = await getTelegramClient(sessionId);
  const peer = await resolvePeer(sessionId, folderId);
  const session = await getSession(sessionId);
  if (!session) throw new Error("Session not found");

  // Get existing parent_id to preserve it
  const folders = sqlite.query("SELECT parent_id FROM telegram_index_folders WHERE phone = ? AND folder_id = ?").get(session.phone, folderId) as { parent_id: number | null } | undefined;
  const parentId = folders?.parent_id || null;

  const title = parentId ? `${newName} [TD:${parentId}]` : `${newName} [TD]`;

  await invokeQueued(
    sessionId,
    new Api.channels.EditTitle({
      channel: peer,
      title: title,
    })
  );

  await saveFolderIndex(session.phone, {
    id: folderId,
    name: newName,
    parent_id: parentId,
  });

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

  const peer = await resolvePeer(sessionId, folderId);
  const resolvedPeer = await client.getEntity(peer);
  const peerId = resolvedPeer instanceof Api.User || resolvedPeer instanceof Api.Channel || resolvedPeer instanceof Api.Chat ? Number(resolvedPeer.id) : 0;
  
  const messages = await client.getMessages(peer, { limit: 1000 });

  for (const msg of messages) {
    if (msg.media && msg.media instanceof Api.MessageMediaDocument) {
      const doc = msg.media.document;
      if (doc instanceof Api.Document) {
        let name = msg.message || "";
        let meta = extractMetadata(name);

        if (!meta) {
          let filename = "";
          for (const attr of doc.attributes) {
            if (attr instanceof Api.DocumentAttributeFilename) {
              filename = attr.fileName;
            }
          }
          if (!filename) filename = name || `file_${msg.id}`;

          const size = Number(doc.size);
          meta = {
            n: filename,
            s: size,
            cid: undefined,
            idx: 0,
            tot: 1,
          };
          name = filename;

          const newCaption = `${filename} [TD_META]${JSON.stringify(meta)}[/TD_META]`;
          try {
            await invokeQueued(
              sessionId,
              new Api.messages.EditMessage({
                peer,
                id: msg.id,
                message: newCaption,
              })
            );
            console.log(`Added metadata to manual message ID ${msg.id}`);
          } catch (e) {
            console.warn(`Failed to add metadata to message ID ${msg.id}:`, e);
          }
        } else {
          name = meta.n || name;
        }

        if (!name) name = "Unknown";

        const size = meta?.s || Number(doc.size);
        const mime = doc.mimeType;
        const ext = path.extname(name).slice(1) || null;

        files.push({
          id: msg.id,
          folder_id: folderId,
          peer_id: peerId,
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
        peer_id: peerId,
        name: msg.message || "Photo.jpg",
        size: -1, // Use -1 for unknown size
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
  const peer = await resolvePeer(sessionId, folderId);
  await client.deleteMessages(peer, messageIds, { revoke: true });
  return true;
};

export const moveFiles = async (
  sessionId: string,
  messageIds: number[],
  sourceFolderId: number | null,
  targetFolderId: number | null,
) => {
  if ((sourceFolderId || 0) === (targetFolderId || 0)) return {};

  const client = await getTelegramClient(sessionId);
  const sourcePeer = await resolvePeer(sessionId, sourceFolderId);
  const targetPeer = await resolvePeer(sessionId, targetFolderId);

  const result = await client.forwardMessages(targetPeer, {
    messages: messageIds,
    fromPeer: sourcePeer,
  });

  const mapping: Record<number, number> = {};
  const newMessagesList: any[] = [];

  if (result) {
    // Flatten result if it's a nested array (which client.forwardMessages returns in GramJS)
    const flattened = Array.isArray(result) ? result.flat() : [result];
    for (const item of flattened) {
      if (item) {
        const anyItem = item as any;
        if (anyItem.className === 'Message' || anyItem.className === 'MessageService') {
          newMessagesList.push(anyItem);
        } else if (anyItem.message && typeof anyItem.message === 'object' && (anyItem.message.className === 'Message' || anyItem.message.className === 'MessageService')) {
          newMessagesList.push(anyItem.message);
        } else if (typeof anyItem === 'object' && 'updates' in anyItem && Array.isArray(anyItem.updates)) {
          for (const u of anyItem.updates) {
            if (u && (u.className === 'UpdateNewMessage' || u.className === 'UpdateNewChannelMessage') && u.message) {
              newMessagesList.push(u.message);
            }
          }
        }
      }
    }
  }

  // Deduplicate by message ID
  const uniqueNewMessages = Array.from(new Map(newMessagesList.map(m => [m.id, m])).values());

  const unmatchedOldIds = [...messageIds];
  const unmatchedNewMsgs = [...uniqueNewMessages];

  // Strategy 1: Match using fwdFrom channelPost or savedFromMsgId
  for (let i = unmatchedNewMsgs.length - 1; i >= 0; i--) {
    const newMsg = unmatchedNewMsgs[i];
    const fwdFrom = newMsg.fwdFrom;
    if (fwdFrom) {
      const origId = fwdFrom.channelPost || fwdFrom.savedFromMsgId;
      if (origId && unmatchedOldIds.includes(Number(origId))) {
        mapping[Number(origId)] = newMsg.id;
        unmatchedOldIds.splice(unmatchedOldIds.indexOf(Number(origId)), 1);
        unmatchedNewMsgs.splice(i, 1);
      }
    }
  }

  // Helper to extract meta from caption
  const extractMeta = (caption: string) => {
    if (!caption) return null;
    const match = caption.match(/\[TD_META\](.*?)\[\/TD_META\]/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  };

  // Strategy 2: Match by metadata (chunk_id and chunk_index or name and size)
  if (unmatchedOldIds.length > 0 && unmatchedNewMsgs.length > 0) {
    const session = await getSession(sessionId);
    if (session) {
      const phone = session.phone;
      const placeholders = unmatchedOldIds.map(() => '?').join(',');
      const oldFiles = sqlite.query(
        `SELECT message_id, name, size, chunk_id, chunk_index FROM telegram_index_files 
         WHERE phone = ? AND message_id IN (${placeholders})`
      ).all(phone, ...unmatchedOldIds) as { message_id: number; name: string; size: number; chunk_id: string | null; chunk_index: number | null }[];

      for (let i = unmatchedNewMsgs.length - 1; i >= 0; i--) {
        const newMsg = unmatchedNewMsgs[i];
        const newMeta = extractMeta(newMsg.message || '');
        if (newMeta) {
          const match = oldFiles.find(f => {
            if (newMeta.cid && f.chunk_id === newMeta.cid) {
              return f.chunk_index === newMeta.idx;
            }
            return f.name === newMeta.n && f.size === newMeta.s;
          });
          
          if (match) {
            mapping[match.message_id] = newMsg.id;
            unmatchedOldIds.splice(unmatchedOldIds.indexOf(match.message_id), 1);
            unmatchedNewMsgs.splice(i, 1);
          }
        }
      }
    }
  }

  // Strategy 3: Match by order for any remaining
  if (unmatchedOldIds.length > 0 && unmatchedOldIds.length === unmatchedNewMsgs.length) {
    unmatchedOldIds.forEach((oldId, index) => {
      mapping[oldId] = unmatchedNewMsgs[index].id;
    });
  }

  // Only delete source messages that were successfully mapped (forwarded)
  const successfulOldIds = Object.keys(mapping).map(Number);
  if (successfulOldIds.length > 0) {
    await client.deleteMessages(sourcePeer, successfulOldIds, { revoke: true });
  }

  return mapping;
};

export const renameFile = async (
  sessionId: string,
  folderId: number | null,
  messageId: number,
  newName: string,
) => {
  const client = await getTelegramClient(sessionId);
  const peer = await resolvePeer(sessionId, folderId);

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
