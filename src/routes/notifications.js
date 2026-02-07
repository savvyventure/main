const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// ------- LIST NOTIFICATIONS -------

router.get('/', requireAuth, (req, res) => {
  const userId = req.session.user.id;

  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(userId);

  // Mark all as read
  db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
  ).run(userId);

  res.render('pages/notifications', {
    title: 'Notifications - SyncUp',
    notifications,
  });
});

module.exports = router;
