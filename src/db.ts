import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function hashPhone(phone: string): string {
  if (!phone) return "";
  // Check if it's already a SHA-256 hash (64 hex characters)
  if (phone.length === 64 && /^[0-9a-f]{64}$/i.test(phone)) {
    return phone;
  }
  const cleanPhone = phone.replace(/\D/g, "");
  return crypto.createHash("sha256").update(cleanPhone).digest("hex");
}

// Open SQLite database file (or create it if it doesn't exist)
export const sqlite = new Database('telegram_drive.sqlite');

// Initialize database schema
const schemaPath = path.join(process.cwd(), 'db', 'schema.lite.sql');
try {
  const schema = readFileSync(schemaPath, 'utf8');
  sqlite.exec(schema);
  
  // Migration: Add peer_id if it doesn't exist
  try {
    const tableInfo = sqlite.query("PRAGMA table_info(telegram_index_files)").all() as any[];
    if (!tableInfo.find(c => c.name === 'peer_id')) {
      sqlite.exec("ALTER TABLE telegram_index_files ADD COLUMN peer_id INTEGER NOT NULL DEFAULT 0");
      // Backfill peer_id with folder_id for existing records
      sqlite.exec("UPDATE telegram_index_files SET peer_id = folder_id");
      console.log('Migration: added peer_id to telegram_index_files');
    }
  } catch (mErr) {
    console.warn('Migration check failed (might be okay if already present):', mErr);
  }

  console.log('SQLite schema initialized');
} catch (err) {
  console.error('Failed to initialize SQLite schema:', err);
}

// Removed the PostgreSQL-compatible query wrapper since we fully migrated to sqlite
