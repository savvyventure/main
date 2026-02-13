// This script creates all the database tables.
// Run it with:  npm run db:init

const fs = require('fs');
const path = require('path');
const db = require('./database');

const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');

// Execute the entire schema file
db.exec(schema);

console.log('Database initialized successfully at data/syncup.db');
console.log('Tables created:');

// List all tables that were created
const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
).all();

tables.forEach((t) => console.log(`  - ${t.name}`));
