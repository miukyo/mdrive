import { getTelegramClient } from './telegram.js';
import { getSession } from '../repositories/sessions.js';
import { getUserFullIndex, clearUserIndex, saveFileIndex, saveFolderIndex } from '../repositories/index.js';
import { Api } from 'telegram';
import { CustomFile } from 'telegram/client/uploads.js';

export const createBackup = async (sessionId: string) => {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');

  const data = await getUserFullIndex(session.phone);
  const json = JSON.stringify(data, null, 2);
  const buffer = Buffer.from(json);
  
  const client = await getTelegramClient(sessionId);
  
  const fileName = `telegram-drive-backup-${session.phone}.json`;
  
  await client.sendFile('me', {
    file: new CustomFile(fileName, buffer.length, '', buffer),
    caption: `Telegram Drive Index Backup\nGenerated at: ${new Date().toISOString()}`,
    attributes: [
      new Api.DocumentAttributeFilename({ fileName })
    ]
  });
};

export const restoreLatestBackup = async (sessionId: string) => {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');

  const client = await getTelegramClient(sessionId);
  
  // Search for backup messages in Saved Messages
  const messages = await client.getMessages('me', {
    search: `telegram-drive-backup-${session.phone}.json`,
    limit: 1
  });

  if (messages.length === 0) {
    throw new Error('No backup found in Saved Messages');
  }

  const msg = messages[0];
  if (!msg.media || !(msg.media instanceof Api.MessageMediaDocument)) {
    throw new Error('Latest backup message has no document');
  }

  const buffer = await client.downloadMedia(msg.media);
  if (!buffer) throw new Error('Failed to download backup');

  const data = JSON.parse(buffer.toString());
  
  const phone = session.phone;
  await clearUserIndex(phone);

  for (const folder of data.folders) {
    await saveFolderIndex(phone, {
      id: folder.folder_id,
      name: folder.name,
      parent_id: folder.parent_id
    });
  }

  for (const file of data.files) {
    await saveFileIndex(phone, {
      id: file.message_id,
      folder_id: file.folder_id === 0 ? null : file.folder_id,
      peer_id: file.peer_id ?? file.folder_id ?? 0,
      name: file.name,
      size: file.size,
      mime_type: file.mime_type,
      file_ext: file.file_ext,
      created_at: file.created_at,
      icon_type: file.icon_type
    });
  }

  return { status: 'restore_completed', count: data.files.length };
};
