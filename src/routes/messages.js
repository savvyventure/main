const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// Helper: check if user is blocked
async function isBlocked(blockerId, blockedId) {
  const block = await db.prepare(
    'SELECT id FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2'
  ).get(blockerId, blockedId);
  return !!block;
}

// Helper: check if either user has blocked the other
async function hasBlockBetween(userId1, userId2) {
  const block = await db.prepare(`
    SELECT id FROM user_blocks
    WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $3 AND blocked_id = $4)
  `).get(userId1, userId2, userId2, userId1);
  return !!block;
}

// ------- INBOX: list all conversations -------

router.get('/', requireAuth, async (req, res) => {
  const userId = req.session.user.id;

  // Get all users this person has conversations with (exclude blocked)
  const conversations = await db.prepare(`
    SELECT
      u.id, u.username, u.avatar_url,
      m.content AS last_message,
      m.created_at AS last_message_at,
      (SELECT COUNT(*) FROM messages
       WHERE sender_id = u.id AND receiver_id = $1 AND is_read = FALSE) AS unread_count
    FROM users u
    JOIN messages m ON m.id = (
      SELECT id FROM messages
      WHERE (sender_id = u.id AND receiver_id = $2)
         OR (sender_id = $3 AND receiver_id = u.id)
      ORDER BY created_at DESC LIMIT 1
    )
    WHERE u.id != $4
      AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = $5 AND blocked_id = u.id)
    ORDER BY m.created_at DESC
  `).all(userId, userId, userId, userId, userId);

  // Get pending chat requests (exclude from blocked users)
  const pendingRequests = await db.prepare(`
    SELECT cc.*, u.username, u.avatar_url
    FROM chat_consent cc
    JOIN users u ON cc.requester_id = u.id
    WHERE cc.target_id = $1 AND cc.status = 'pending'
      AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = $2 AND blocked_id = u.id)
    ORDER BY cc.created_at DESC
  `).all(userId, userId);

  // Get sent requests (pending)
  const sentRequests = await db.prepare(`
    SELECT cc.*, u.username, u.avatar_url
    FROM chat_consent cc
    JOIN users u ON cc.target_id = u.id
    WHERE cc.requester_id = $1 AND cc.status = 'pending'
    ORDER BY cc.created_at DESC
  `).all(userId);

  // Get blocked users
  const blockedUsers = await db.prepare(`
    SELECT ub.id AS block_id, u.id, u.username, u.avatar_url
    FROM user_blocks ub
    JOIN users u ON ub.blocked_id = u.id
    WHERE ub.blocker_id = $1
    ORDER BY ub.created_at DESC
  `).all(userId);

  res.render('pages/messages', {
    title: 'Messages - SyncUp',
    conversations,
    pendingRequests,
    sentRequests,
    blockedUsers,
    query: req.query,
  });
});

// ------- VIEW CONVERSATION WITH A SPECIFIC USER -------

router.get('/chat/:userId', requireAuth, async (req, res) => {
  const currentUserId = req.session.user.id;
  const otherUserId = parseInt(req.params.userId);

  // Check if either user has blocked the other
  if (await hasBlockBetween(currentUserId, otherUserId)) {
    return res.redirect('/messages?error=Cannot chat with this user');
  }

  // Verify chat consent exists
  const consent = await db.prepare(`
    SELECT * FROM chat_consent
    WHERE ((requester_id = $1 AND target_id = $2) OR (requester_id = $3 AND target_id = $4))
    AND status = 'accepted'
  `).get(currentUserId, otherUserId, otherUserId, currentUserId);

  if (!consent) {
    return res.redirect('/messages?error=Chat consent required');
  }

  const otherUser = await db.prepare('SELECT id, username, avatar_url FROM users WHERE id = $1')
    .get(otherUserId);

  if (!otherUser) {
    return res.status(404).render('pages/error', {
      title: 'User Not Found',
      message: 'This user does not exist.',
    });
  }

  // Get all messages between the two users
  const messages = await db.prepare(`
    SELECT * FROM messages
    WHERE (sender_id = $1 AND receiver_id = $2)
       OR (sender_id = $3 AND receiver_id = $4)
    ORDER BY created_at ASC
  `).all(currentUserId, otherUserId, otherUserId, currentUserId);

  // Mark messages from the other user as read
  await db.prepare(
    'UPDATE messages SET is_read = TRUE WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE'
  ).run(otherUserId, currentUserId);

  res.render('pages/chat', {
    title: `Chat with ${otherUser.username} - SyncUp`,
    otherUser,
    messages,
  });
});

// ------- REQUEST CHAT CONSENT -------

router.post('/request/:userId', requireAuth, async (req, res) => {
  const targetId = parseInt(req.params.userId);
  const requesterId = req.session.user.id;

  if (targetId === requesterId) {
    return res.redirect('back');
  }

  // Check if blocked
  if (await hasBlockBetween(requesterId, targetId)) {
    return res.redirect('/messages?error=Cannot request chat with this user');
  }

  // Check if consent already exists in either direction
  const existing = await db.prepare(`
    SELECT * FROM chat_consent
    WHERE (requester_id = $1 AND target_id = $2) OR (requester_id = $3 AND target_id = $4)
  `).get(requesterId, targetId, targetId, requesterId);

  if (!existing) {
    await db.prepare('INSERT INTO chat_consent (requester_id, target_id) VALUES ($1, $2)')
      .run(requesterId, targetId);
  }

  res.redirect('/messages?success=Chat request sent');
});

// ------- ACCEPT / DECLINE CHAT CONSENT -------

router.post('/consent/:id/accept', requireAuth, async (req, res) => {
  await db.prepare(
    "UPDATE chat_consent SET status = 'accepted', updated_at = NOW() WHERE id = $1 AND target_id = $2"
  ).run(req.params.id, req.session.user.id);

  res.redirect('/messages');
});

router.post('/consent/:id/decline', requireAuth, async (req, res) => {
  await db.prepare(
    "UPDATE chat_consent SET status = 'declined', updated_at = NOW() WHERE id = $1 AND target_id = $2"
  ).run(req.params.id, req.session.user.id);

  res.redirect('/messages');
});

// ------- CANCEL SENT REQUEST -------

router.post('/request/:id/cancel', requireAuth, async (req, res) => {
  await db.prepare(
    "DELETE FROM chat_consent WHERE id = $1 AND requester_id = $2 AND status = 'pending'"
  ).run(req.params.id, req.session.user.id);

  res.redirect('/messages');
});

// ------- BLOCK USER -------

router.post('/block/:userId', requireAuth, async (req, res) => {
  const blockedId = parseInt(req.params.userId);
  const blockerId = req.session.user.id;

  if (blockedId === blockerId) {
    return res.redirect('back');
  }

  // Check if already blocked
  const existing = await db.prepare(
    'SELECT id FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2'
  ).get(blockerId, blockedId);

  if (!existing) {
    await db.prepare('INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)')
      .run(blockerId, blockedId);
  }

  res.redirect('/messages?success=User blocked');
});

// ------- UNBLOCK USER -------

router.post('/unblock/:userId', requireAuth, async (req, res) => {
  const blockedId = parseInt(req.params.userId);
  const blockerId = req.session.user.id;

  await db.prepare('DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2')
    .run(blockerId, blockedId);

  res.redirect('/messages?success=User unblocked');
});

module.exports = router;
