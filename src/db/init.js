// This script creates all the database tables.
// Run it with:  npm run db:init

const fs = require('fs');
const path = require('path');
const db = require('./database');

async function initDatabase() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Execute the entire schema file statement by statement
    const statements = schema.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await db.pool.query(statement);
      }
    }

    console.log('Database initialized successfully');
    console.log('Tables created:');

    // List all tables that were created (PostgreSQL version)
    const result = await db.pool.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    result.rows.forEach((t) => console.log(`  - ${t.tablename}`));

    process.exit(0);
  } catch (err) {
    console.error('Database initialization failed:', err);
    process.exit(1);
  }
}

initDatabase();
