import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Open SQLite database file (or create it if it doesn't exist)
export const sqlite = new Database('telegram_drive.sqlite');

// Initialize database schema
const schemaPath = path.join(process.cwd(), 'db', 'schema.lite.sql');
try {
  const schema = readFileSync(schemaPath, 'utf8');
  sqlite.exec(schema);
  console.log('SQLite schema initialized');
} catch (err) {
  console.error('Failed to initialize SQLite schema:', err);
}

// Removed the PostgreSQL-compatible query wrapper since we fully migrated to sqlite
