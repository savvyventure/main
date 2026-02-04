const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// ------- CREATE A REVIEW -------

router.post('/', requireAuth, [
  body('event_id').isInt().withMessage('Event is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('content').trim().isLength({ min: 1 }).withMessage('Review text is required'),
], (req, res) => {
  const errors = validationResult(req);
  const eventId = req.body.event_id;

  if (!errors.isEmpty()) {
    return res.redirect(`/events/${eventId}?error=Invalid review data`);
  }

  const { rating, title, content } = req.body;

  // Check if the user already reviewed this event
  const existing = db.prepare(
    'SELECT id FROM reviews WHERE user_id = ? AND event_id = ?'
  ).get(req.session.user.id, eventId);

  if (existing) {
    return res.redirect(`/events/${eventId}?error=You already reviewed this event`);
  }

  db.prepare(
    'INSERT INTO reviews (user_id, event_id, rating, title, content) VALUES (?, ?, ?, ?, ?)'
  ).run(req.session.user.id, eventId, rating, title || '', content);

  res.redirect(`/events/${eventId}?success=Review posted!`);
});

// ------- DELETE A REVIEW -------

router.post('/:id/delete', requireAuth, (req, res) => {
  const review = db.prepare('SELECT * FROM reviews WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.user.id);

  if (!review) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      message: 'Review not found.',
    });
  }

  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.redirect(`/events/${review.event_id}`);
});

module.exports = router;
