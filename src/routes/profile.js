const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// ------- VIEW PROFILE -------

router.get('/:username', (req, res) => {
  const user = db.prepare(
    'SELECT id, username, full_name, bio, avatar_url, created_at FROM users WHERE username = ?'
  ).get(req.params.username);

  if (!user) {
    return res.status(404).render('pages/error', {
      title: 'User Not Found',
      message: 'This user does not exist.',
    });
  }

  // Get events created by this user
  const events = db.prepare(
    "SELECT * FROM events WHERE creator_id = ? AND status = 'active' ORDER BY event_date DESC"
  ).all(user.id);

  // Get reviews by this user
  const reviews = db.prepare(`
    SELECT r.*, e.title AS event_title
    FROM reviews r
    JOIN events e ON r.event_id = e.id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(user.id);

  res.render('pages/profile', {
    title: `${user.username} - SyncUp`,
    profileUser: user,
    events,
    reviews,
  });
});

// ------- EDIT PROFILE -------

router.get('/:username/edit', requireAuth, (req, res) => {
  if (req.session.user.username !== req.params.username) {
    return res.redirect(`/profile/${req.params.username}`);
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);

  res.render('pages/profile-edit', {
    title: 'Edit Profile - SyncUp',
    profileUser: user,
    errors: [],
  });
});

router.post('/:username/edit', requireAuth, [
  body('full_name').trim().isLength({ min: 1, max: 100 }).withMessage('Full name is required'),
  body('bio').trim().isLength({ max: 500 }).withMessage('Bio must be under 500 characters'),
], (req, res) => {
  if (req.session.user.username !== req.params.username) {
    return res.redirect(`/profile/${req.params.username}`);
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
    return res.render('pages/profile-edit', {
      title: 'Edit Profile - SyncUp',
      profileUser: { ...user, ...req.body },
      errors: errors.array(),
    });
  }

  const { full_name, bio } = req.body;

  db.prepare(
    "UPDATE users SET full_name = ?, bio = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(full_name, bio || '', req.session.user.id);

  // Update session data
  req.session.user.full_name = full_name;

  res.redirect(`/profile/${req.params.username}`);
});

module.exports = router;
