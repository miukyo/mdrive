import { sqlite } from '../db.js';

export interface ShareLink {
  token: string;
  phone: string;
  share_type: string; // 'file' or 'folder'
  folder_id: number | null;
  message_id: number | null;
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
