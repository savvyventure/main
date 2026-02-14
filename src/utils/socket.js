// Socket.io setup for real-time messaging
// Socket.io lets the server push updates to users instantly
// without them having to refresh the page.

const db = require('../db/database');

// Helper: check if either user has blocked the other
async function hasBlockBetween(userId1, userId2) {
  const block = await db.prepare(`
    SELECT id FROM user_blocks
    WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $3 AND blocked_id = $4)
  `).get(userId1, userId2, userId2, userId1);
  return !!block;
}

module.exports = function (io) {
  io.on('connection', (socket) => {
    // When a user connects, they join a "room" named after their user ID.
    // This way we can send messages directly to specific users.
    socket.on('join', (userId) => {
      socket.join(`user_${userId}`);
    });

    // When a user sends a message
    socket.on('send_message', async (data) => {
      const { senderId, receiverId, content } = data;

      try {
        // Check if blocked
        if (await hasBlockBetween(senderId, receiverId)) {
          socket.emit('error_message', { message: 'Cannot send message to this user.' });
          return;
        }

        // Verify chat consent exists and is accepted
        const consent = await db.prepare(`
          SELECT id FROM chat_consent
          WHERE ((requester_id = $1 AND target_id = $2) OR (requester_id = $3 AND target_id = $4))
          AND status = 'accepted'
        `).get(senderId, receiverId, receiverId, senderId);

        if (!consent) {
          socket.emit('error_message', { message: 'Chat consent required before messaging.' });
          return;
        }

        // Save message to the database with RETURNING
        const result = await db.pool.query(`
          INSERT INTO messages (sender_id, receiver_id, content)
          VALUES ($1, $2, $3)
          RETURNING id, sender_id, receiver_id, content, created_at
        `, [senderId, receiverId, content]);

        const message = result.rows[0];

        // Send the message to both the sender and receiver in real time
        io.to(`user_${receiverId}`).emit('new_message', message);
        io.to(`user_${senderId}`).emit('new_message', message);
      } catch (err) {
        console.error('Socket.io send_message error:', err);
        socket.emit('error_message', { message: 'Failed to send message.' });
      }
    });

    // Mark messages as read
    socket.on('mark_read', async (data) => {
      const { userId, otherUserId } = data;
      try {
        await db.prepare(`
          UPDATE messages SET is_read = TRUE
          WHERE sender_id = $1 AND receiver_id = $2 AND is_read = FALSE
        `).run(otherUserId, userId);
      } catch (err) {
        console.error('Socket.io mark_read error:', err);
      }
    });
  });
};
