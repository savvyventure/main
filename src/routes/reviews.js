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

// ------- EDIT A REVIEW (GET form) -------

router.get('/:id/edit', requireAuth, (req, res) => {
  const review = db.prepare(`
    SELECT r.*, e.title AS event_title
    FROM reviews r
    JOIN events e ON r.event_id = e.id
    WHERE r.id = ? AND r.user_id = ?
  `).get(req.params.id, req.session.user.id);

  if (!review) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      message: 'Review not found or you do not have permission to edit it.',
    });
  }

  res.render('pages/review-edit', {
    title: 'Edit Review - SyncUp',
    review,
  });
});

// ------- EDIT A REVIEW (POST update) -------

router.post('/:id/edit', requireAuth, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('content').trim().isLength({ min: 1 }).withMessage('Review text is required'),
], (req, res) => {
  const review = db.prepare('SELECT * FROM reviews WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.user.id);

  if (!review) {
    return res.status(404).render('pages/error', {
      title: 'Not Found',
      message: 'Review not found.',
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.redirect(`/reviews/${req.params.id}/edit?error=Invalid review data`);
  }

  const { rating, title, content } = req.body;

  db.prepare(`
    UPDATE reviews
    SET rating = ?, title = ?, content = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(rating, title || '', content, req.params.id);

  res.redirect(`/events/${review.event_id}?success=Review updated!`);
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

// ------- VOTE ON A REVIEW (helpful/not helpful) -------

router.post('/:id/vote', requireAuth, (req, res) => {
  const reviewId = parseInt(req.params.id);
  const userId = req.session.user.id;
  const vote = parseInt(req.body.vote); // 1 = helpful, -1 = not helpful

  if (vote !== 1 && vote !== -1) {
    return res.status(400).json({ error: 'Invalid vote' });
  }

  // Get the review to find the event_id
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);
  if (!review) {
    return res.status(404).json({ error: 'Review not found' });
  }

  // Can't vote on your own review
  if (review.user_id === userId) {
    return res.redirect(`/events/${review.event_id}?error=Cannot vote on your own review`);
  }

  // Check existing vote
  const existing = db.prepare(
    'SELECT * FROM review_votes WHERE review_id = ? AND user_id = ?'
  ).get(reviewId, userId);

  if (existing) {
    if (existing.vote === vote) {
      // Same vote = remove it (toggle off)
      db.prepare('DELETE FROM review_votes WHERE id = ?').run(existing.id);
    } else {
      // Different vote = update it
      db.prepare('UPDATE review_votes SET vote = ? WHERE id = ?').run(vote, existing.id);
    }
  } else {
    // New vote
    db.prepare('INSERT INTO review_votes (review_id, user_id, vote) VALUES (?, ?, ?)')
      .run(reviewId, userId, vote);
  }

  res.redirect(`/events/${review.event_id}`);
});

module.exports = router;
