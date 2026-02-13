const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// Admin check - first user is admin
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.id !== 1) {
    return res.status(403).render('pages/error', {
      title: 'Access Denied',
      message: 'You do not have permission to view this page.',
    });
  }
  next();
}

// ------- ADMIN DASHBOARD -------

router.get('/', requireAuth, requireAdmin, (req, res) => {
  res.redirect('/admin/users');
});

// ------- LIST ALL USERS -------

router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT
      u.id, u.username, u.email, u.full_name, u.created_at,
      (SELECT COUNT(*) FROM events WHERE creator_id = u.id) AS event_count,
      (SELECT COUNT(*) FROM reviews WHERE user_id = u.id) AS review_count,
      (SELECT COUNT(*) FROM table_bookings WHERE user_id = u.id) AS booking_count
    FROM users u
    ORDER BY u.created_at DESC
  `).all();

  res.render('pages/admin-users', {
    title: 'Admin - Users',
    users,
  });
});

// ------- VIEW USER DETAILS -------

router.get('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const user = db.prepare(`
    SELECT * FROM users WHERE id = ?
  `).get(req.params.id);

  if (!user) {
    return res.status(404).render('pages/error', {
      title: 'User Not Found',
      message: 'This user does not exist.',
    });
  }

  const events = db.prepare(`
    SELECT * FROM events WHERE creator_id = ? ORDER BY created_at DESC
  `).all(user.id);

  const reviews = db.prepare(`
    SELECT r.*, e.title AS event_title
    FROM reviews r
    JOIN events e ON r.event_id = e.id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(user.id);

  const bookings = db.prepare(`
    SELECT tb.*, vt.table_label, e.title AS event_title
    FROM table_bookings tb
    JOIN vip_tables vt ON tb.table_id = vt.id
    JOIN events e ON vt.event_id = e.id
    WHERE tb.user_id = ?
    ORDER BY tb.created_at DESC
  `).all(user.id);

  res.render('pages/admin-user-detail', {
    title: `Admin - ${user.username}`,
    user,
    events,
    reviews,
    bookings,
  });
});

// ------- DELETE USER -------

router.post('/users/:id/delete', requireAuth, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);

  // Don't allow deleting yourself (admin)
  if (userId === req.session.user.id) {
    return res.redirect('/admin/users?error=Cannot delete your own account');
  }

  // Delete user's data (cascade)
  db.prepare('DELETE FROM review_votes WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM reviews WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM table_bookings WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM vip_tables WHERE host_id = ?').run(userId);
  db.prepare('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?').run(userId, userId);
  db.prepare('DELETE FROM chat_consent WHERE requester_id = ? OR target_id = ?').run(userId, userId);
  db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_blocks WHERE blocker_id = ? OR blocked_id = ?').run(userId, userId);
  db.prepare('DELETE FROM page_views WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM events WHERE creator_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  res.redirect('/admin/users?success=User deleted');
});

module.exports = router;
