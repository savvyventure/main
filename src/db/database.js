const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set.');
  console.error('Set DATABASE_URL to your PostgreSQL connection string and restart.');
  process.exit(1);
}

// Use DATABASE_URL from environment (Railway provides this automatically)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Wrapper to provide a similar API to better-sqlite3
// This allows gradual migration with minimal code changes
const db = {
  // Execute a query that returns rows (SELECT)
  prepare: (sql) => ({
    // Get single row
    get: async (...params) => {
      const result = await pool.query(convertPlaceholders(sql), params);
      return result.rows[0];
    },
    // Get all rows
    all: async (...params) => {
      const result = await pool.query(convertPlaceholders(sql), params);
      return result.rows;
    },
    // Execute (INSERT, UPDATE, DELETE)
    run: async (...params) => {
      const result = await pool.query(convertPlaceholders(sql), params);
      return {
        changes: result.rowCount,
        lastInsertRowid: result.rows?.[0]?.id
      };
    },
  }),

  // Execute raw SQL (for schema creation)
  exec: async (sql) => {
    await pool.query(sql);
  },

  // Get the pool for direct access if needed
  pool,
};

// Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
function convertPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

module.exports = db;
