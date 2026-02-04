// Socket.io setup for real-time messaging
// Socket.io lets the server push updates to users instantly
// without them having to refresh the page.

const db = require('../db/database');

module.exports = function (io) {
  io.on('connection', (socket) => {
    // When a user connects, they join a "room" named after their user ID.
    // This way we can send messages directly to specific users.
    socket.on('join', (userId) => {
      socket.join(`user_${userId}`);
    });

    // When a user sends a message
    socket.on('send_message', (data) => {
      const { senderId, receiverId, content } = data;

      // Verify chat consent exists and is accepted
      const consent = db.prepare(`
        SELECT id FROM chat_consent
        WHERE ((requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?))
        AND status = 'accepted'
      `).get(senderId, receiverId, receiverId, senderId);

      if (!consent) {
        socket.emit('error_message', { message: 'Chat consent required before messaging.' });
        return;
      }

      // Save message to the database
      const result = db.prepare(`
        INSERT INTO messages (sender_id, receiver_id, content)
        VALUES (?, ?, ?)
      `).run(senderId, receiverId, content);

      const message = {
        id: result.lastInsertRowid,
        sender_id: senderId,
        receiver_id: receiverId,
        content,
        created_at: new Date().toISOString(),
      };

      // Send the message to both the sender and receiver in real time
      io.to(`user_${receiverId}`).emit('new_message', message);
      io.to(`user_${senderId}`).emit('new_message', message);
    });

    // Mark messages as read
    socket.on('mark_read', (data) => {
      const { userId, otherUserId } = data;
      db.prepare(`
        UPDATE messages SET is_read = 1
        WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
      `).run(otherUserId, userId);
    });
  });
};
