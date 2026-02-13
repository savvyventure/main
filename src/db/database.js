const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database path from environment or default to /data directory
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'syncup.db');
const DATA_DIR = path.dirname(DB_PATH);

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
