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
