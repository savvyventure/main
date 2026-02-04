const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// The database file lives in the project root under /data
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'syncup.db');

// Create the data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Open (or create) the SQLite database file
const db = new Database(DB_PATH);

// Enable WAL mode for better performance with concurrent reads
db.pragma('journal_mode = WAL');
// Enforce foreign key constraints
db.pragma('foreign_keys = ON');

module.exports = db;
