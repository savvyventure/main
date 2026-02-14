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

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  // Page views today
  const todayViews = parseInt((await db.prepare(`
    SELECT COUNT(*) AS count FROM page_views
    WHERE DATE(created_at) = CURRENT_DATE
  `).get()).count);

  // Page views this week
  const weekViews = parseInt((await db.prepare(`
    SELECT COUNT(*) AS count FROM page_views
    WHERE created_at >= NOW() - INTERVAL '7 days'
  `).get()).count);

  // Total users
  const totalUsers = parseInt((await db.prepare('SELECT COUNT(*) AS count FROM users').get()).count);

  // Total events
  const totalEvents = parseInt((await db.prepare('SELECT COUNT(*) AS count FROM events').get()).count);

  // Total reviews
  const totalReviews = parseInt((await db.prepare('SELECT COUNT(*) AS count FROM reviews').get()).count);

  // Popular pages (top 10)
  const popularPages = await db.prepare(`
    SELECT path, COUNT(*) AS views
    FROM page_views
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY path
    ORDER BY views DESC
    LIMIT 10
  `).all();

  // Popular events (by views)
  const popularEvents = await db.prepare(`
    SELECT e.id, e.title, COUNT(pv.id) AS views
    FROM events e
    LEFT JOIN page_views pv ON pv.path = '/events/' || e.id
    WHERE pv.created_at >= NOW() - INTERVAL '7 days' OR pv.created_at IS NULL
    GROUP BY e.id, e.title
    ORDER BY views DESC
    LIMIT 5
  `).all();

  // Recent signups
  const recentSignups = await db.prepare(`
    SELECT id, username, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 5
  `).all();

  // Views by day (last 7 days)
  const viewsByDay = await db.prepare(`
    SELECT DATE(created_at) AS day, COUNT(*) AS views
    FROM page_views
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY DATE(created_at)
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
