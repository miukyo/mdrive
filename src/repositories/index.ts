import { sqlite } from '../db.js';
import { FileMetadata, FolderMetadata } from '../models.js';

export const saveFolderIndex = async (phone: string, folder: FolderMetadata) => {
  sqlite.query(
    `INSERT INTO telegram_index_folders (phone, folder_id, parent_id, name)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (phone, folder_id) DO UPDATE
     SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id, indexed_at = CURRENT_TIMESTAMP`
  ).run(phone, folder.id, folder.parent_id || null, folder.name);
};

export const saveFileIndex = async (phone: string, file: FileMetadata) => {
  sqlite.query(
    `INSERT INTO telegram_index_files (phone, folder_id, message_id, name, size, mime_type, file_ext, created_at, icon_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (phone, folder_id, message_id) DO UPDATE
     SET name = EXCLUDED.name, size = EXCLUDED.size, mime_type = EXCLUDED.mime_type, file_ext = EXCLUDED.file_ext, icon_type = EXCLUDED.icon_type, indexed_at = CURRENT_TIMESTAMP`
  ).run(phone, file.folder_id || 0, file.id, file.name, file.size, file.mime_type || null, file.file_ext || null, file.created_at || null, file.icon_type);
};

export const clearUserIndex = async (phone: string) => {
  sqlite.query('DELETE FROM telegram_index_folders WHERE phone = ?').run(phone);
  sqlite.query('DELETE FROM telegram_index_files WHERE phone = ?').run(phone);
};

export interface SearchFilters {
  query?: string;
  category?: string;
  folderId?: number;
  fileExt?: string;
  startDate?: string;
  endDate?: string;
  messageIds?: number[];
  limit?: number;
  offset?: number;
}

export const searchFiles = async (phone: string, filters: SearchFilters): Promise<FileMetadata[]> => {
  let sql = `SELECT * FROM telegram_index_files WHERE phone = ?`;
  const params: any[] = [phone];

  if (filters.query) {
    sql += ` AND name LIKE ?`;
    params.push(`%${filters.query}%`);
  }

  if (filters.folderId !== undefined) {
    sql += ` AND folder_id = ?`;
    params.push(filters.folderId);
  }

  if (filters.fileExt) {
    sql += ` AND file_ext = ?`;
    params.push(filters.fileExt.toLowerCase());
  }

  if (filters.category) {
    switch (filters.category) {
      case 'images':
        sql += ` AND mime_type LIKE 'image/%'`;
        break;
      case 'videos':
        sql += ` AND mime_type LIKE 'video/%'`;
        break;
      case 'audio':
        sql += ` AND mime_type LIKE 'audio/%'`;
        break;
      case 'docs':
        sql += ` AND (mime_type IN ('application/pdf', 'application/msword', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') OR file_ext IN ('pdf', 'doc', 'docx', 'txt', 'epub'))`;
        break;
      case 'others':
        sql += ` AND NOT (mime_type LIKE 'image/%' OR mime_type LIKE 'video/%' OR mime_type LIKE 'audio/%' OR mime_type IN ('application/pdf', 'application/msword', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') OR file_ext IN ('pdf', 'doc', 'docx', 'txt', 'epub'))`;
        break;
    }
  }

  if (filters.startDate) {
    sql += ` AND created_at >= ?`;
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    sql += ` AND created_at <= ?`;
    params.push(filters.endDate);
  }

  if (filters.messageIds && filters.messageIds.length > 0) {
    const placeholders = filters.messageIds.map(() => '?').join(',');
    sql += ` AND message_id IN (${placeholders})`;
    params.push(...filters.messageIds);
  }

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(filters.limit || 50);
  params.push(filters.offset || 0);

  const rows = sqlite.query(sql).all(...params) as any[];
  
  return rows.map((row) => ({
    id: row.message_id,
    folder_id: row.folder_id === 0 ? null : row.folder_id,
    name: row.name,
    size: row.size,
    mime_type: row.mime_type,
    file_ext: row.file_ext,
    created_at: row.created_at,
    icon_type: row.icon_type,
  }));
};

export const getStorageStats = async (phone: string) => {
  const rows = sqlite.query(
    `SELECT 
      CASE 
        WHEN mime_type LIKE 'image/%' THEN 'images'
        WHEN mime_type LIKE 'video/%' THEN 'videos'
        WHEN mime_type LIKE 'audio/%' THEN 'audio'
        WHEN mime_type IN ('application/pdf', 'application/msword', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') 
          OR file_ext IN ('pdf', 'doc', 'docx', 'txt', 'epub') THEN 'docs'
        ELSE 'others'
      END as category,
      SUM(size) as total_size,
      COUNT(*) as count
    FROM telegram_index_files 
    WHERE phone = ?
    GROUP BY category`
  ).all(phone) as any[];

  return rows;
};

export const getUserFullIndex = async (phone: string) => {
  const folders = sqlite.query('SELECT * FROM telegram_index_folders WHERE phone = ?').all(phone) as any[];
  const files = sqlite.query('SELECT * FROM telegram_index_files WHERE phone = ?').all(phone) as any[];
  return { folders, files };
};
