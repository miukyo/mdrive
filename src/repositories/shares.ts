import { sqlite } from '../db.js';

export interface ShareLink {
  token: string;
  phone: string;
  share_type: string; // 'file' or 'folder'
  folder_id: number | null;
  message_id: number | null;
  is_active: number;
  created_at: Date;
}

export const createShareLink = async (token: string, phone: string, shareType: string, folderId: number | null, messageId: number | null) => {
  sqlite.query(
    `INSERT INTO telegram_share_links (token, phone, share_type, folder_id, message_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(token, phone, shareType, folderId, messageId);
};

export const getShareLink = async (token: string): Promise<ShareLink | null> => {
  const row = sqlite.query('SELECT * FROM telegram_share_links WHERE token = ?').get(token) as ShareLink | undefined;
  return row || null;
};

export const getUserShares = async (phone: string): Promise<ShareLink[]> => {
  const rows = sqlite.query('SELECT * FROM telegram_share_links WHERE phone = ? ORDER BY created_at DESC').all(phone) as any[];
  return rows;
};

export const deleteShareLink = async (token: string, phone: string) => {
  sqlite.query('DELETE FROM telegram_share_links WHERE token = ? AND phone = ?').run(token, phone);
};

export const toggleShareLink = async (token: string, phone: string) => {
  sqlite.query('UPDATE telegram_share_links SET is_active = 1 - is_active WHERE token = ? AND phone = ?').run(token, phone);
};

export const findExistingShareLink = async (phone: string, shareType: string, folderId: number | null, messageId: number | null): Promise<string | null> => {
  const row = sqlite.query(
    `SELECT token FROM telegram_share_links 
     WHERE phone = ? AND share_type = ? 
     AND (folder_id IS ? OR folder_id = ?)
     AND (message_id IS ? OR message_id = ?)
     LIMIT 1`
  ).get(phone, shareType, folderId, folderId, messageId, messageId) as { token: string } | undefined;
  return row?.token || null;
};

export const deleteSharesByFiles = async (phone: string, messageIds: number[]) => {
  if (messageIds.length === 0) return;
  const placeholders = messageIds.map(() => '?').join(',');
  sqlite.query(
    `DELETE FROM telegram_share_links 
     WHERE phone = ? AND share_type = 'file' 
     AND message_id IN (${placeholders})`
  ).run(phone, ...messageIds);
};

export const deleteShareByFolder = async (phone: string, folderId: number) => {
  // Use a CTE to find all subfolders recursively and delete their shares too
  sqlite.query(
    `DELETE FROM telegram_share_links 
     WHERE phone = ? AND share_type = 'folder' 
     AND folder_id IN (
       WITH RECURSIVE subordinates AS (
         SELECT folder_id FROM telegram_index_folders WHERE folder_id = ? AND phone = ?
         UNION ALL
         SELECT f.folder_id FROM telegram_index_folders f
         INNER JOIN subordinates s ON f.parent_id = s.folder_id
         WHERE f.phone = ?
       )
       SELECT folder_id FROM subordinates
     )`
  ).run(phone, folderId, phone, phone);
};

export const deleteSharesByFolderFiles = async (phone: string, folderId: number) => {
  // Delete all file shares that belong to any folder in the hierarchy
  sqlite.query(
    `DELETE FROM telegram_share_links 
     WHERE phone = ? AND share_type = 'file' 
     AND folder_id IN (
       WITH RECURSIVE subordinates AS (
         SELECT folder_id FROM telegram_index_folders WHERE folder_id = ? AND phone = ?
         UNION ALL
         SELECT f.folder_id FROM telegram_index_folders f
         INNER JOIN subordinates s ON f.parent_id = s.folder_id
         WHERE f.phone = ?
       )
       SELECT folder_id FROM subordinates
     )`
  ).run(phone, folderId, phone, phone);
};

export const moveShares = async (phone: string, mappings: Record<number, number>, toFolderId: number | null) => {
  const oldIds = Object.keys(mappings).map(Number);
  if (oldIds.length === 0) return;

  const targetFolder = (toFolderId === 0 || toFolderId === null) ? null : toFolderId;
  const query = sqlite.prepare(
    `UPDATE telegram_share_links 
     SET message_id = ?, folder_id = ? 
     WHERE phone = ? AND share_type = 'file' AND message_id = ?`
  );

  for (const oldId of oldIds) {
    const newId = mappings[oldId];
    if (newId) {
      query.run(newId, targetFolder, phone, oldId);
    }
  }
};
