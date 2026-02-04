const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

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

  res.redirect(`/events/${event_id}`);
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

  // Check if user already has a booking for this table
  const existingBooking = db.prepare(
    "SELECT id FROM table_bookings WHERE table_id = ? AND user_id = ? AND status != 'cancelled'"
  ).get(req.params.id, req.session.user.id);

  if (existingBooking) {
    return res.redirect(`/events/${table.event_id}?error=You already have a booking for this table`);
  }

  // Create the booking and update available seats (as a transaction)
  const book = db.transaction(() => {
    db.prepare(
      'INSERT INTO table_bookings (table_id, user_id, seats, status) VALUES (?, ?, ?, ?)'
    ).run(req.params.id, req.session.user.id, seats, 'confirmed');

    const newAvailable = table.available_seats - seats;
    db.prepare(
      "UPDATE vip_tables SET available_seats = ?, status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newAvailable, newAvailable === 0 ? 'full' : 'available', req.params.id);
  });

  book();

  res.redirect(`/events/${table.event_id}?success=Seat booked successfully!`);
});

// ------- CANCEL A BOOKING -------

router.post('/bookings/:id/cancel', requireAuth, (req, res) => {
  const booking = db.prepare(
    'SELECT tb.*, vt.event_id FROM table_bookings tb JOIN vip_tables vt ON tb.table_id = vt.id WHERE tb.id = ? AND tb.user_id = ?'
  ).get(req.params.id, req.session.user.id);

  if (!booking) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      message: 'Booking not found.',
    });
  }

  const cancel = db.transaction(() => {
    db.prepare(
      "UPDATE table_bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?"
    ).run(req.params.id);

    db.prepare(
      "UPDATE vip_tables SET available_seats = available_seats + ?, status = 'available', updated_at = datetime('now') WHERE id = ?"
    ).run(booking.seats, booking.table_id);
  });

  cancel();

  res.redirect(`/events/${booking.event_id}?success=Booking cancelled`);
});

module.exports = router;
