const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// Helper: create a notification for a user
function notify(userId, type, message, link) {
  db.prepare(
    'INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)'
  ).run(userId, type, message, link || '');
}

// ------- MY TABLES (host dashboard) -------

router.get('/my-tables', requireAuth, (req, res) => {
  const userId = req.session.user.id;

  // Get all tables this user is hosting, with event info
  const tables = db.prepare(`
    SELECT vt.*, e.title AS event_title, e.event_date, e.venue
    FROM vip_tables vt
    JOIN events e ON vt.event_id = e.id
    WHERE vt.host_id = ?
    ORDER BY e.event_date ASC
  `).all(userId);

  // For each table, get its bookings
  const tableIds = tables.map(t => t.id);
  let bookings = [];
  if (tableIds.length > 0) {
    const placeholders = tableIds.map(() => '?').join(',');
    bookings = db.prepare(`
      SELECT tb.*, u.username, u.full_name
      FROM table_bookings tb
      JOIN users u ON tb.user_id = u.id
      WHERE tb.table_id IN (${placeholders})
      ORDER BY tb.created_at DESC
    `).all(...tableIds);
  }

  // Group bookings by table_id
  const bookingsByTable = {};
  bookings.forEach(b => {
    if (!bookingsByTable[b.table_id]) bookingsByTable[b.table_id] = [];
    bookingsByTable[b.table_id].push(b);
  });

  res.render('pages/my-tables', {
    title: 'My Tables - SyncUp',
    tables,
    bookingsByTable,
    query: req.query,
  });
});

// ------- MY BOOKINGS (guest dashboard) -------

router.get('/my-bookings', requireAuth, (req, res) => {
  const userId = req.session.user.id;

  const bookings = db.prepare(`
    SELECT tb.*, vt.table_label, vt.price_per_seat, vt.currency, vt.host_id,
           e.id AS event_id, e.title AS event_title, e.event_date, e.venue,
           host.username AS host_name
    FROM table_bookings tb
    JOIN vip_tables vt ON tb.table_id = vt.id
    JOIN events e ON vt.event_id = e.id
    JOIN users host ON vt.host_id = host.id
    WHERE tb.user_id = ?
    ORDER BY e.event_date ASC
  `).all(userId);

  res.render('pages/my-bookings', {
    title: 'My Bookings - SyncUp',
    bookings,
    query: req.query,
  });
});

// ------- CREATE A VIP TABLE LISTING -------

router.post('/create', requireAuth, [
  body('event_id').isInt().withMessage('Event is required'),
  body('total_seats').isInt({ min: 1 }).withMessage('At least 1 seat required'),
  body('available_seats').isInt({ min: 1 }).withMessage('At least 1 available seat required'),
  body('price_per_seat').isFloat({ min: 0 }).withMessage('Price must be 0 or more'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.redirect(`/events/${req.body.event_id}?error=Invalid table data`);
  }

  const { event_id, table_label, total_seats, available_seats, price_per_seat, description } = req.body;

  db.prepare(`
    INSERT INTO vip_tables (event_id, host_id, table_label, total_seats, available_seats, price_per_seat, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    event_id, req.session.user.id,
    table_label || '', parseInt(total_seats),
    parseInt(available_seats), parseFloat(price_per_seat),
    description || ''
  );

  res.redirect(`/events/${event_id}?success=Table listed successfully!`);
});

// ------- BOOK A SEAT -------

router.post('/:id/book', requireAuth, (req, res) => {
  const table = db.prepare('SELECT * FROM vip_tables WHERE id = ?').get(req.params.id);

  if (!table) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      message: 'This VIP table does not exist.',
    });
  }

  if (table.host_id === req.session.user.id) {
    return res.redirect(`/events/${table.event_id}?error=You cannot book your own table`);
  }

  const seats = parseInt(req.body.seats) || 1;

  if (seats > table.available_seats) {
    return res.redirect(`/events/${table.event_id}?error=Not enough seats available`);
  }

  // Check if user already has an active booking for this table
  const existingBooking = db.prepare(
    "SELECT id FROM table_bookings WHERE table_id = ? AND user_id = ? AND status != 'cancelled'"
  ).get(req.params.id, req.session.user.id);

  if (existingBooking) {
    return res.redirect(`/events/${table.event_id}?error=You already have a booking for this table`);
  }

  const event = db.prepare('SELECT title FROM events WHERE id = ?').get(table.event_id);

  // Create the booking, update available seats, and notify the host
  const book = db.transaction(() => {
    db.prepare(
      'INSERT INTO table_bookings (table_id, user_id, seats, status) VALUES (?, ?, ?, ?)'
    ).run(req.params.id, req.session.user.id, seats, 'confirmed');

    const newAvailable = table.available_seats - seats;
    db.prepare(
      "UPDATE vip_tables SET available_seats = ?, status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newAvailable, newAvailable === 0 ? 'full' : 'available', req.params.id);

    // Notify the table host
    const label = table.table_label || 'your VIP table';
    notify(
      table.host_id,
      'booking_received',
      `${req.session.user.username} booked ${seats} seat${seats > 1 ? 's' : ''} at ${label} for "${event.title}"`,
      `/tables/my-tables`
    );
  });

  book();

  res.redirect(`/tables/my-bookings?success=Seat booked successfully!`);
});

// ------- CANCEL A BOOKING (by the guest) -------

router.post('/bookings/:id/cancel', requireAuth, (req, res) => {
  const booking = db.prepare(`
    SELECT tb.*, vt.event_id, vt.table_label, vt.host_id
    FROM table_bookings tb
    JOIN vip_tables vt ON tb.table_id = vt.id
    WHERE tb.id = ? AND tb.user_id = ?
  `).get(req.params.id, req.session.user.id);

  if (!booking) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      message: 'Booking not found.',
    });
  }

  const event = db.prepare('SELECT title FROM events WHERE id = ?').get(booking.event_id);

  const cancel = db.transaction(() => {
    db.prepare(
      "UPDATE table_bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?"
    ).run(req.params.id);

    db.prepare(
      "UPDATE vip_tables SET available_seats = available_seats + ?, status = 'available', updated_at = datetime('now') WHERE id = ?"
    ).run(booking.seats, booking.table_id);

    // Notify the host
    const label = booking.table_label || 'your VIP table';
    notify(
      booking.host_id,
      'booking_cancelled',
      `${req.session.user.username} cancelled ${booking.seats} seat${booking.seats > 1 ? 's' : ''} at ${label} for "${event.title}"`,
      `/tables/my-tables`
    );
  });

  cancel();

  const returnTo = req.body.return_to || '/tables/my-bookings';
  res.redirect(`${returnTo}?success=Booking cancelled`);
});

// ------- CANCEL A TABLE LISTING (by the host) -------

router.post('/:id/cancel', requireAuth, (req, res) => {
  const table = db.prepare(
    'SELECT * FROM vip_tables WHERE id = ? AND host_id = ?'
  ).get(req.params.id, req.session.user.id);

  if (!table) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      message: 'Table not found or you do not have permission.',
    });
  }

  const event = db.prepare('SELECT title FROM events WHERE id = ?').get(table.event_id);

  const cancelTable = db.transaction(() => {
    db.prepare(
      "UPDATE vip_tables SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?"
    ).run(req.params.id);

    // Cancel all active bookings and notify each guest
    const activeBookings = db.prepare(
      "SELECT tb.*, u.username FROM table_bookings tb JOIN users u ON tb.user_id = u.id WHERE tb.table_id = ? AND tb.status != 'cancelled'"
    ).all(req.params.id);

    for (const booking of activeBookings) {
      db.prepare(
        "UPDATE table_bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?"
      ).run(booking.id);

      const label = table.table_label || 'a VIP table';
      notify(
        booking.user_id,
        'table_cancelled',
        `${req.session.user.username} cancelled ${label} for "${event.title}". Your booking of ${booking.seats} seat${booking.seats > 1 ? 's' : ''} has been refunded.`,
        `/tables/my-bookings`
      );
    }
  });

  cancelTable();

  res.redirect('/tables/my-tables?success=Table listing cancelled');
});

module.exports = router;
