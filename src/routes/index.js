const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Home page - shows featured events and platform overview
router.get('/', (req, res) => {
  // Get upcoming events (next 10)
  const events = db.prepare(`
    SELECT e.*, u.username AS creator_name
    FROM events e
    JOIN users u ON e.creator_id = u.id
    WHERE e.status = 'active' AND e.event_date >= datetime('now')
    ORDER BY e.event_date ASC
    LIMIT 10
  `).all();

  // Get event count and user count for stats
  const stats = {
    eventCount: db.prepare("SELECT COUNT(*) AS c FROM events WHERE status = 'active'").get().c,
    userCount: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
    tableCount: db.prepare("SELECT COUNT(*) AS c FROM vip_tables WHERE status = 'available'").get().c,
  };

  res.render('pages/home', { title: 'SyncUp - Find Your Vibe', events, stats });
});

module.exports = router;
