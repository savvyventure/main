const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// ------- LIST ALL EVENTS (with search & filter) -------

router.get('/', async (req, res) => {
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
  let paramCount = 1;

  // Apply filters if provided
  if (search) {
    query += ` AND (e.title LIKE $${paramCount} OR e.description LIKE $${paramCount + 1} OR e.dj_artist LIKE $${paramCount + 2})`;
    const term = `%${search}%`;
    params.push(term, term, term);
    paramCount += 3;
  }
  if (genre) {
    query += ` AND e.genre = $${paramCount}`;
    params.push(genre);
    paramCount += 1;
  }
  if (venue) {
    query += ` AND e.venue LIKE $${paramCount}`;
    params.push(`%${venue}%`);
    paramCount += 1;
  }
  if (date_from) {
    query += ` AND e.event_date >= $${paramCount}`;
    params.push(date_from);
    paramCount += 1;
  }
  if (date_to) {
    query += ` AND e.event_date <= $${paramCount}`;
    params.push(date_to);
    paramCount += 1;
  }

  query += ' ORDER BY e.event_date ASC';

  const events = await db.prepare(query).all(...params);

  // Get distinct genres for the filter dropdown
  const genres = (await db.prepare(
    "SELECT DISTINCT genre FROM events WHERE genre != '' ORDER BY genre"
  ).all()).map(r => r.genre);

  res.render('pages/events', {
    title: 'Events - SyncUp',
    events,
    genres,
    filters: req.query,
  });
});

// ------- VIEW SINGLE EVENT -------

router.get('/:id', async (req, res) => {
  const event = await db.prepare(`
    SELECT e.*, u.username AS creator_name, u.id AS creator_user_id
    FROM events e
    JOIN users u ON e.creator_id = u.id
    WHERE e.id = $1
  `).get(req.params.id);

  if (!event) {
    return res.status(404).render('pages/error', {
      title: 'Event Not Found',
      message: 'This event does not exist.',
    });
  }

  // Get VIP tables for this event
  const tables = await db.prepare(`
    SELECT vt.*, u.username AS host_name
    FROM vip_tables vt
    JOIN users u ON vt.host_id = u.id
    WHERE vt.event_id = $1 AND vt.status = 'available'
    ORDER BY vt.price_per_seat ASC
  `).all(req.params.id);

  // Get reviews for this event with vote counts
  const reviews = await db.prepare(`
    SELECT r.*, u.username, u.avatar_url,
      (SELECT COUNT(*) FROM review_votes WHERE review_id = r.id AND vote = 1) AS helpful_count,
      (SELECT COUNT(*) FROM review_votes WHERE review_id = r.id AND vote = -1) AS not_helpful_count
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    WHERE r.event_id = $1
    ORDER BY r.created_at DESC
  `).all(req.params.id);

  // Get current user's votes on these reviews
  let userVotes = {};
  if (req.session.user) {
    const votes = await db.prepare(`
      SELECT review_id, vote FROM review_votes
      WHERE user_id = $1 AND review_id IN (SELECT id FROM reviews WHERE event_id = $2)
    `).all(req.session.user.id, req.params.id);
    votes.forEach(v => { userVotes[v.review_id] = v.vote; });
  }

  const avgRating = (await db.prepare(
    'SELECT ROUND(AVG(rating), 1) AS avg FROM reviews WHERE event_id = $1'
  ).get(req.params.id)).avg;

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

router.get('/new/create', requireAuth, async (req, res) => {
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
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('pages/event-form', {
      title: 'Create Event - SyncUp',
      event: req.body,
      errors: errors.array(),
    });
  }

  const { title, description, venue, address, event_date, event_end, dj_artist, genre, price, capacity } = req.body;

  const result = await db.pool.query(`
    INSERT INTO events (creator_id, title, description, venue, address, event_date, event_end, dj_artist, genre, price, capacity)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id
  `, [
    req.session.user.id, title, description, venue,
    address || '', event_date, event_end || null,
    dj_artist || '', genre || '', parseFloat(price) || 0,
    parseInt(capacity) || 0
  ]);

  const newId = result.rows[0].id;
  res.redirect(`/events/${newId}`);
});

// ------- EDIT EVENT -------

router.get('/:id/edit', requireAuth, async (req, res) => {
  const event = await db.prepare('SELECT * FROM events WHERE id = $1 AND creator_id = $2')
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
], async (req, res) => {
  const event = await db.prepare('SELECT * FROM events WHERE id = $1 AND creator_id = $2')
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

  await db.prepare(`
    UPDATE events SET title=$1, description=$2, venue=$3, address=$4, event_date=$5,
      event_end=$6, dj_artist=$7, genre=$8, price=$9, capacity=$10, updated_at=NOW()
    WHERE id = $11
  `).run(
    title, description, venue, address || '', event_date,
    event_end || null, dj_artist || '', genre || '',
    parseFloat(price) || 0, parseInt(capacity) || 0,
    req.params.id
  );

  res.redirect(`/events/${req.params.id}`);
});

module.exports = router;
