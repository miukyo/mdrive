import { getSession } from '../repositories/sessions.js';
import { clearUserIndex, saveFileIndex, saveFolderIndex } from '../repositories/index.js';
import { scanFolders, getFiles } from './drive.js';

export const refreshIndex = async (sessionId: string) => {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');

  const phone = session.phone;
  await clearUserIndex(phone);

  const folders = await scanFolders(sessionId);
  
  // Also index root files
  folders.push({ id: 0, name: 'Root', parent_id: null });

  for (const folder of folders) {
    if (folder.id !== 0) {
      await saveFolderIndex(phone, folder);
    }
    const files = await getFiles(sessionId, folder.id === 0 ? null : folder.id);
    for (const file of files) {
      await saveFileIndex(phone, file);
    }
  }
};
