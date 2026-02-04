const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// ------- INBOX: list all conversations -------

router.get('/', requireAuth, (req, res) => {
  const userId = req.session.user.id;

  // Get all users this person has conversations with
  const conversations = db.prepare(`
    SELECT
      u.id, u.username, u.avatar_url,
      m.content AS last_message,
      m.created_at AS last_message_at,
      (SELECT COUNT(*) FROM messages
       WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0) AS unread_count
    FROM users u
    JOIN messages m ON m.id = (
      SELECT id FROM messages
      WHERE (sender_id = u.id AND receiver_id = ?)
         OR (sender_id = ? AND receiver_id = u.id)
      ORDER BY created_at DESC LIMIT 1
    )
    WHERE u.id != ?
    ORDER BY m.created_at DESC
  `).all(userId, userId, userId, userId);

  // Get pending chat requests
  const pendingRequests = db.prepare(`
    SELECT cc.*, u.username, u.avatar_url
    FROM chat_consent cc
    JOIN users u ON cc.requester_id = u.id
    WHERE cc.target_id = ? AND cc.status = 'pending'
    ORDER BY cc.created_at DESC
  `).all(userId);

  res.render('pages/messages', {
    title: 'Messages - SyncUp',
    conversations,
    pendingRequests,
  });
});

// ------- VIEW CONVERSATION WITH A SPECIFIC USER -------

router.get('/chat/:userId', requireAuth, (req, res) => {
  const currentUserId = req.session.user.id;
  const otherUserId = parseInt(req.params.userId);

  // Verify chat consent exists
  const consent = db.prepare(`
    SELECT * FROM chat_consent
    WHERE ((requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?))
    AND status = 'accepted'
  `).get(currentUserId, otherUserId, otherUserId, currentUserId);

  if (!consent) {
    return res.redirect('/messages?error=Chat consent required');
  }

  const otherUser = db.prepare('SELECT id, username, avatar_url FROM users WHERE id = ?')
    .get(otherUserId);

  if (!otherUser) {
    return res.status(404).render('pages/error', {
      title: 'User Not Found',
      message: 'This user does not exist.',
    });
  }

  // Get all messages between the two users
  const messages = db.prepare(`
    SELECT * FROM messages
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at ASC
  `).all(currentUserId, otherUserId, otherUserId, currentUserId);

  // Mark messages from the other user as read
  db.prepare(
    'UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0'
  ).run(otherUserId, currentUserId);

  res.render('pages/chat', {
    title: `Chat with ${otherUser.username} - SyncUp`,
    otherUser,
    messages,
  });
});

// ------- REQUEST CHAT CONSENT -------

router.post('/request/:userId', requireAuth, (req, res) => {
  const targetId = parseInt(req.params.userId);
  const requesterId = req.session.user.id;

  if (targetId === requesterId) {
    return res.redirect('back');
  }

  // Check if consent already exists in either direction
  const existing = db.prepare(`
    SELECT * FROM chat_consent
    WHERE (requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?)
  `).get(requesterId, targetId, targetId, requesterId);

  if (!existing) {
    db.prepare('INSERT INTO chat_consent (requester_id, target_id) VALUES (?, ?)')
      .run(requesterId, targetId);
  }

  res.redirect('/messages');
});

// ------- ACCEPT / DECLINE CHAT CONSENT -------

router.post('/consent/:id/accept', requireAuth, (req, res) => {
  db.prepare(
    "UPDATE chat_consent SET status = 'accepted', updated_at = datetime('now') WHERE id = ? AND target_id = ?"
  ).run(req.params.id, req.session.user.id);

  res.redirect('/messages');
});

router.post('/consent/:id/decline', requireAuth, (req, res) => {
  db.prepare(
    "UPDATE chat_consent SET status = 'declined', updated_at = datetime('now') WHERE id = ? AND target_id = ?"
  ).run(req.params.id, req.session.user.id);

  res.redirect('/messages');
});

module.exports = router;
