const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// ------- LIST NOTIFICATIONS -------

router.get('/', requireAuth, async (req, res) => {
  const userId = req.session.user.id;

  const notifications = await db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 50
  `).all(userId);

  // Mark all as read
  await db.prepare(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE'
  ).run(userId);

  res.render('pages/notifications', {
    title: 'Notifications - SyncUp',
    notifications,
  });
});

module.exports = router;
