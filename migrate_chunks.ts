import { Database } from 'bun:sqlite';
const db = new Database('telegram_drive.sqlite');

try {
    db.exec("ALTER TABLE telegram_index_files ADD COLUMN chunk_id TEXT;");
    console.log("Added chunk_id column");
} catch (e) {}

try {
    db.exec("ALTER TABLE telegram_index_files ADD COLUMN chunk_index INTEGER;");
    console.log("Added chunk_index column");
} catch (e) {}

try {
    db.exec("ALTER TABLE telegram_index_files ADD COLUMN total_chunks INTEGER;");
    console.log("Added total_chunks column");
} catch (e) {}

db.close();
