const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Home page - shows featured events and platform overview
router.get('/', async (req, res) => {
  // Get upcoming events (next 10)
  const events = await db.prepare(`
    SELECT e.*, u.username AS creator_name
    FROM events e
    JOIN users u ON e.creator_id = u.id
    WHERE e.status = 'active' AND e.event_date >= NOW()
    ORDER BY e.event_date ASC
    LIMIT 10
  `).all();

  // Get event count and user count for stats
  const stats = {
    eventCount: parseInt((await db.prepare("SELECT COUNT(*) AS c FROM events WHERE status = 'active'").get()).c),
    userCount: parseInt((await db.prepare('SELECT COUNT(*) AS c FROM users').get()).c),
    tableCount: parseInt((await db.prepare("SELECT COUNT(*) AS c FROM vip_tables WHERE status = 'available'").get()).c),
  };

  res.render('pages/home', { title: 'SyncUp - Find Your Vibe', events, stats });
});

module.exports = router;
