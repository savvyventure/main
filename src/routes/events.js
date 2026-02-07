const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// ------- LIST ALL EVENTS (with search & filter) -------

router.get('/', (req, res) => {
  const { search, genre, venue, date_from, date_to } = req.query;

  let query = `
    SELECT e.*, u.username AS creator_name,
      (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE event_id = e.id) AS avg_rating,
      (SELECT COUNT(*) FROM reviews WHERE event_id = e.id) AS review_count
    FROM events e
    JOIN users u ON e.creator_id = u.id
    WHERE e.status = 'active'
  `;
  const params = [];

  // Apply filters if provided
  if (search) {
    query += ' AND (e.title LIKE ? OR e.description LIKE ? OR e.dj_artist LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  if (genre) {
    query += ' AND e.genre = ?';
    params.push(genre);
  }
  if (venue) {
    query += ' AND e.venue LIKE ?';
    params.push(`%${venue}%`);
  }
  if (date_from) {
    query += ' AND e.event_date >= ?';
    params.push(date_from);
  }
  if (date_to) {
    query += ' AND e.event_date <= ?';
    params.push(date_to);
  }

  query += ' ORDER BY e.event_date ASC';

  const events = db.prepare(query).all(...params);

  // Get distinct genres for the filter dropdown
  const genres = db.prepare(
    "SELECT DISTINCT genre FROM events WHERE genre != '' ORDER BY genre"
  ).all().map(r => r.genre);

  res.render('pages/events', {
    title: 'Events - SyncUp',
    events,
    genres,
    filters: req.query,
  });
});

// ------- VIEW SINGLE EVENT -------

router.get('/:id', (req, res) => {
  const event = db.prepare(`
    SELECT e.*, u.username AS creator_name, u.id AS creator_user_id
    FROM events e
    JOIN users u ON e.creator_id = u.id
    WHERE e.id = ?
  `).get(req.params.id);

  if (!event) {
    return res.status(404).render('pages/error', {
      title: 'Event Not Found',
      message: 'This event does not exist.',
    });
  }

  // Get VIP tables for this event
  const tables = db.prepare(`
    SELECT vt.*, u.username AS host_name
    FROM vip_tables vt
    JOIN users u ON vt.host_id = u.id
    WHERE vt.event_id = ? AND vt.status = 'available'
    ORDER BY vt.price_per_seat ASC
  `).all(req.params.id);

  // Get reviews for this event with vote counts
  const reviews = db.prepare(`
    SELECT r.*, u.username, u.avatar_url,
      (SELECT COUNT(*) FROM review_votes WHERE review_id = r.id AND vote = 1) AS helpful_count,
      (SELECT COUNT(*) FROM review_votes WHERE review_id = r.id AND vote = -1) AS not_helpful_count
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    WHERE r.event_id = ?
    ORDER BY r.created_at DESC
  `).all(req.params.id);

  // Get current user's votes on these reviews
  let userVotes = {};
  if (req.session.user) {
    const votes = db.prepare(`
      SELECT review_id, vote FROM review_votes
      WHERE user_id = ? AND review_id IN (SELECT id FROM reviews WHERE event_id = ?)
    `).all(req.session.user.id, req.params.id);
    votes.forEach(v => { userVotes[v.review_id] = v.vote; });
  }

  const avgRating = db.prepare(
    'SELECT ROUND(AVG(rating), 1) AS avg FROM reviews WHERE event_id = ?'
  ).get(req.params.id).avg;

  res.render('pages/event-detail', {
    title: `${event.title} - SyncUp`,
    event,
    tables,
    reviews,
    avgRating,
    userVotes,
    query: req.query,
  });
});

// ------- CREATE EVENT -------

router.get('/new/create', requireAuth, (req, res) => {
  res.render('pages/event-form', {
    title: 'Create Event - SyncUp',
    event: null,
    errors: [],
  });
});

router.post('/', requireAuth, [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required'),
  body('description').trim().isLength({ min: 1 }).withMessage('Description is required'),
  body('venue').trim().isLength({ min: 1 }).withMessage('Venue is required'),
  body('event_date').isISO8601().withMessage('Valid date is required'),
  body('price').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Price must be a positive number'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('pages/event-form', {
      title: 'Create Event - SyncUp',
      event: req.body,
      errors: errors.array(),
    });
  }

  const { title, description, venue, address, event_date, event_end, dj_artist, genre, price, capacity } = req.body;

  const result = db.prepare(`
    INSERT INTO events (creator_id, title, description, venue, address, event_date, event_end, dj_artist, genre, price, capacity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.session.user.id, title, description, venue,
    address || '', event_date, event_end || null,
    dj_artist || '', genre || '', parseFloat(price) || 0,
    parseInt(capacity) || 0
  );

  res.redirect(`/events/${result.lastInsertRowid}`);
});

// ------- EDIT EVENT -------

router.get('/:id/edit', requireAuth, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ? AND creator_id = ?')
    .get(req.params.id, req.session.user.id);

  if (!event) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      message: 'Event not found or you do not have permission to edit it.',
    });
  }

  res.render('pages/event-form', {
    title: 'Edit Event - SyncUp',
    event,
    errors: [],
  });
});

router.post('/:id/edit', requireAuth, [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required'),
  body('description').trim().isLength({ min: 1 }).withMessage('Description is required'),
  body('venue').trim().isLength({ min: 1 }).withMessage('Venue is required'),
  body('event_date').isISO8601().withMessage('Valid date is required'),
], (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ? AND creator_id = ?')
    .get(req.params.id, req.session.user.id);

  if (!event) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      message: 'Event not found or you do not have permission to edit it.',
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('pages/event-form', {
      title: 'Edit Event - SyncUp',
      event: { ...event, ...req.body },
      errors: errors.array(),
    });
  }

  const { title, description, venue, address, event_date, event_end, dj_artist, genre, price, capacity } = req.body;

  db.prepare(`
    UPDATE events SET title=?, description=?, venue=?, address=?, event_date=?,
      event_end=?, dj_artist=?, genre=?, price=?, capacity=?, updated_at=datetime('now')
    WHERE id = ?
  `).run(
    title, description, venue, address || '', event_date,
    event_end || null, dj_artist || '', genre || '',
    parseFloat(price) || 0, parseInt(capacity) || 0,
    req.params.id
  );

  res.redirect(`/events/${req.params.id}`);
});

module.exports = router;
