const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../public/uploads/avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `user-${req.session.user.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'));
    cb(null, true);
  },
});

// ------- VIEW PROFILE -------

router.get('/:username', async (req, res) => {
  const user = await db.prepare(
    'SELECT id, username, full_name, bio, avatar_url, created_at FROM users WHERE username = $1'
  ).get(req.params.username);

  if (!user) {
    return res.status(404).render('pages/error', {
      title: 'User Not Found',
      message: 'This user does not exist.',
    });
  }

  // Get events created by this user
  const events = await db.prepare(
    "SELECT * FROM events WHERE creator_id = $1 AND status = 'active' ORDER BY event_date DESC"
  ).all(user.id);

  // Get reviews by this user
  const reviews = await db.prepare(`
    SELECT r.*, e.title AS event_title
    FROM reviews r
    JOIN events e ON r.event_id = e.id
    WHERE r.user_id = $1
    ORDER BY r.created_at DESC
  `).all(user.id);

  // Chat status and block status for logged-in users viewing other profiles
  let chatStatus = null;  // null, 'pending_sent', 'pending_received', 'connected', 'declined'
  let isBlocked = false;
  let hasBlockedYou = false;

  if (req.session.user && req.session.user.id !== user.id) {
    const currentUserId = req.session.user.id;

    // Check chat consent status
    const consent = await db.prepare(`
      SELECT * FROM chat_consent
      WHERE (requester_id = $1 AND target_id = $2) OR (requester_id = $3 AND target_id = $4)
    `).get(currentUserId, user.id, user.id, currentUserId);

    if (consent) {
      if (consent.status === 'accepted') {
        chatStatus = 'connected';
      } else if (consent.status === 'pending') {
        chatStatus = consent.requester_id === currentUserId ? 'pending_sent' : 'pending_received';
      } else if (consent.status === 'declined') {
        chatStatus = 'declined';
      }
    }

    // Check block status
    const blockByMe = await db.prepare(
      'SELECT id FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2'
    ).get(currentUserId, user.id);
    isBlocked = !!blockByMe;

    const blockByThem = await db.prepare(
      'SELECT id FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2'
    ).get(user.id, currentUserId);
    hasBlockedYou = !!blockByThem;
  }

  res.render('pages/profile', {
    title: `${user.username} - SyncUp`,
    profileUser: user,
    events,
    reviews,
    chatStatus,
    isBlocked,
    hasBlockedYou,
  });
});

// ------- EDIT PROFILE -------

router.get('/:username/edit', requireAuth, async (req, res) => {
  if (req.session.user.username !== req.params.username) {
    return res.redirect(`/profile/${req.params.username}`);
  }

  const user = await db.prepare('SELECT * FROM users WHERE id = $1').get(req.session.user.id);

  res.render('pages/profile-edit', {
    title: 'Edit Profile - SyncUp',
    profileUser: user,
    errors: [],
  });
});

router.post('/:username/edit', requireAuth, upload.single('avatar_file'), [
  body('full_name').trim().isLength({ min: 1, max: 100 }).withMessage('Full name is required'),
  body('bio').trim().isLength({ max: 500 }).withMessage('Bio must be under 500 characters'),
], async (req, res) => {
  if (req.session.user.username !== req.params.username) {
    return res.redirect(`/profile/${req.params.username}`);
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const user = await db.prepare('SELECT * FROM users WHERE id = $1').get(req.session.user.id);
    return res.render('pages/profile-edit', {
      title: 'Edit Profile - SyncUp',
      profileUser: { ...user, ...req.body },
      errors: errors.array(),
    });
  }

  const { full_name, bio } = req.body;

  // Determine new avatar_url
  let avatar_url = null;
  if (req.file) {
    avatar_url = '/uploads/avatars/' + req.file.filename;
  } else if (req.body.avatar_preset) {
    avatar_url = req.body.avatar_preset;
  }

  if (avatar_url) {
    await db.prepare(
      "UPDATE users SET full_name = $1, bio = $2, avatar_url = $3, updated_at = NOW() WHERE id = $4"
    ).run(full_name, bio || '', avatar_url, req.session.user.id);
    req.session.user.avatar_url = avatar_url;
  } else {
    await db.prepare(
      "UPDATE users SET full_name = $1, bio = $2, updated_at = NOW() WHERE id = $3"
    ).run(full_name, bio || '', req.session.user.id);
  }

  // Update session data
  req.session.user.full_name = full_name;

  res.redirect(`/profile/${req.params.username}`);
});

module.exports = router;
