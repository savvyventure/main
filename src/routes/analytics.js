const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// Simple admin check (first user is admin for now)
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.id !== 1) {
    return res.status(403).render('pages/error', {
      title: 'Access Denied',
      message: 'You do not have permission to view this page.',
    });
  }
  next();
}

// ------- ANALYTICS DASHBOARD -------

router.get('/', requireAuth, requireAdmin, (req, res) => {
  // Page views today
  const todayViews = db.prepare(`
    SELECT COUNT(*) AS count FROM page_views
    WHERE date(created_at) = date('now')
  `).get().count;

  // Page views this week
  const weekViews = db.prepare(`
    SELECT COUNT(*) AS count FROM page_views
    WHERE created_at >= datetime('now', '-7 days')
  `).get().count;

  // Total users
  const totalUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;

  // Total events
  const totalEvents = db.prepare('SELECT COUNT(*) AS count FROM events').get().count;

  // Total reviews
  const totalReviews = db.prepare('SELECT COUNT(*) AS count FROM reviews').get().count;

  // Popular pages (top 10)
  const popularPages = db.prepare(`
    SELECT path, COUNT(*) AS views
    FROM page_views
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY path
    ORDER BY views DESC
    LIMIT 10
  `).all();

  // Popular events (by views)
  const popularEvents = db.prepare(`
    SELECT e.id, e.title, COUNT(pv.id) AS views
    FROM events e
    LEFT JOIN page_views pv ON pv.path = '/events/' || e.id
    WHERE pv.created_at >= datetime('now', '-7 days') OR pv.created_at IS NULL
    GROUP BY e.id
    ORDER BY views DESC
    LIMIT 5
  `).all();

  // Recent signups
  const recentSignups = db.prepare(`
    SELECT id, username, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 5
  `).all();

  // Views by day (last 7 days)
  const viewsByDay = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS views
    FROM page_views
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all();

  res.render('pages/analytics', {
    title: 'Analytics - SyncUp',
    stats: {
      todayViews,
      weekViews,
      totalUsers,
      totalEvents,
      totalReviews,
    },
    popularPages,
    popularEvents,
    recentSignups,
    viewsByDay,
  });
});

module.exports = router;
