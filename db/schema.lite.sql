CREATE TABLE IF NOT EXISTS telegram_sessions (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  api_id INTEGER NOT NULL,
  api_hash TEXT NOT NULL,
  session_string TEXT NOT NULL DEFAULT '',
  phone_code_hash TEXT,
  auth_state TEXT NOT NULL DEFAULT 'logged_out',
  pin TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME
);

CREATE INDEX IF NOT EXISTS telegram_sessions_phone_idx ON telegram_sessions (phone);
CREATE INDEX IF NOT EXISTS telegram_sessions_last_active_idx ON telegram_sessions (last_active_at);

CREATE TABLE IF NOT EXISTS telegram_index_folders (
  phone TEXT NOT NULL,
  folder_id INTEGER NOT NULL,
  parent_id INTEGER,
  name TEXT NOT NULL,
  indexed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (phone, folder_id)
);

CREATE TABLE IF NOT EXISTS telegram_index_files (
  phone TEXT NOT NULL,
  folder_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  peer_id INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  file_ext TEXT,
  created_at DATETIME,
  icon_type TEXT NOT NULL DEFAULT 'file',
  chunk_id TEXT,
  chunk_index INTEGER,
  total_chunks INTEGER,
  indexed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (phone, folder_id, message_id)
);

CREATE INDEX IF NOT EXISTS telegram_index_files_name_idx ON telegram_index_files (name);
CREATE INDEX IF NOT EXISTS telegram_index_files_folder_idx ON telegram_index_files (folder_id);

CREATE TABLE IF NOT EXISTS telegram_share_links (
  token TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  share_type TEXT NOT NULL,
  folder_id INTEGER,
  message_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);