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
  sqlite
    .query(
      `INSERT INTO telegram_index_files (phone, folder_id, message_id, name, size, mime_type, file_ext, created_at, icon_type, chunk_id, chunk_index, total_chunks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (phone, folder_id, message_id) DO UPDATE
     SET name = EXCLUDED.name, size = EXCLUDED.size, mime_type = EXCLUDED.mime_type, file_ext = EXCLUDED.file_ext, icon_type = EXCLUDED.icon_type, 
         chunk_id = EXCLUDED.chunk_id, chunk_index = EXCLUDED.chunk_index, total_chunks = EXCLUDED.total_chunks,
         indexed_at = CURRENT_TIMESTAMP`,
    )
    .run(
      phone,
      file.folder_id || 0,
      file.id,
      file.name,
      file.size,
      file.mime_type || null,
      file.file_ext || null,
      file.created_at || null,
      file.icon_type,
      file.chunk_id || null,
      file.chunk_index !== undefined ? file.chunk_index : null,
      file.total_chunks !== undefined ? file.total_chunks : null,
    );
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

export const searchFiles = async (
  phone: string,
  filters: SearchFilters,
): Promise<FileMetadata[]> => {
  // Use a subquery or grouping to handle chunks
  // We want to return only one entry per file, but keep track of chunks
  // For non-chunked files, chunk_id is NULL.
  let sql = `
    SELECT 
      MIN(message_id) as message_id, 
      folder_id, 
      name, 
      MAX(size) as size, 
      mime_type, 
      file_ext, 
      MIN(created_at) as created_at, 
      icon_type,
      chunk_id,
      total_chunks
    FROM telegram_index_files 
    WHERE phone = ?
  `;
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

  sql += ` GROUP BY phone, folder_id, name, chunk_id ORDER BY created_at DESC LIMIT ? OFFSET ?`;
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
    chunk_id: row.chunk_id,
    total_chunks: row.total_chunks,
  }));
};

export const getStorageStats = async (phone: string) => {
  const rows = sqlite.query(
    `SELECT 
      category,
      SUM(size) as total_size,
      COUNT(*) as count
     FROM (
       SELECT 
         CASE 
           WHEN mime_type LIKE 'image/%' THEN 'images'
           WHEN mime_type LIKE 'video/%' THEN 'videos'
           WHEN mime_type LIKE 'audio/%' THEN 'audio'
           WHEN mime_type IN ('application/pdf', 'application/msword', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') 
             OR file_ext IN ('pdf', 'doc', 'docx', 'txt', 'epub') THEN 'docs'
           ELSE 'others'
         END as category,
         MAX(size) as size,
         chunk_id,
         name,
         folder_id
       FROM telegram_index_files 
       WHERE phone = ?
       GROUP BY phone, folder_id, name, chunk_id
     )
     GROUP BY category`
  ).all(phone) as any[];

  return rows;
};

export const getUserFullIndex = async (phone: string) => {
  const folders = sqlite.query('SELECT * FROM telegram_index_folders WHERE phone = ?').all(phone) as any[];
  const files = sqlite.query('SELECT * FROM telegram_index_files WHERE phone = ?').all(phone) as any[];
  return { folders, files };
};

export const renameFile = async (phone: string, folderId: number, messageId: number, newName: string) => {
  sqlite.query(
    `UPDATE telegram_index_files SET name = ?, indexed_at = CURRENT_TIMESTAMP 
     WHERE phone = ? AND folder_id = ? AND message_id = ?`
  ).run(newName, phone, folderId || 0, messageId);
};

export const getFileChunks = async (phone: string, folderId: number, messageId: number) => {
  const file = sqlite.query(
    'SELECT chunk_id FROM telegram_index_files WHERE phone = ? AND folder_id = ? AND message_id = ?'
  ).get(phone, folderId || 0, messageId) as { chunk_id: string | null } | undefined;

  if (!file || !file.chunk_id) {
    return null;
  }

  return sqlite.query(
    'SELECT * FROM telegram_index_files WHERE phone = ? AND chunk_id = ? ORDER BY chunk_index ASC'
  ).all(phone, file.chunk_id) as any[];
};

export const getFolders = async (phone: string): Promise<FolderMetadata[]> => {
  const rows = sqlite.query('SELECT * FROM telegram_index_folders WHERE phone = ? ORDER BY name ASC').all(phone) as any[];
  return rows.map(row => ({
    id: row.folder_id,
    parent_id: row.parent_id,
    name: row.name
  }));
};

export const deleteFolderIndex = async (phone: string, folderId: number) => {
  sqlite.query('DELETE FROM telegram_index_folders WHERE phone = ? AND folder_id = ?').run(phone, folderId);
  sqlite.query('DELETE FROM telegram_index_files WHERE phone = ? AND folder_id = ?').run(phone, folderId);
};
