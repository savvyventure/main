// =============================================================
// SyncUp - Main Server File
// =============================================================
// This is the entry point of the application. It:
//   1. Creates an Express web server
//   2. Configures middleware (session, templates, static files)
//   3. Connects routes (URL handlers)
//   4. Starts listening for requests
// =============================================================

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const SESSION_SECRET = process.env.SESSION_SECRET || 'syncup-dev-secret-change-in-production';
const SESSIONS_PATH = process.env.SESSIONS_PATH || path.join(__dirname, '..', 'data');

// Initialize the database (creates tables if they don't exist)
const db = require('./db/database');
const fs = require('fs');
const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf-8');
db.exec(schema);

// Create the Express app and an HTTP server (needed for Socket.io)
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Trust proxy for production (needed for secure cookies behind reverse proxy)
if (NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ------- CONFIGURATION -------

// Tell Express to use EJS for rendering HTML templates
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Parse form data and JSON from incoming requests
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files (CSS, JS, images) from the public folder
app.use(express.static(path.join(__dirname, '..', 'public')));

// Session middleware: keeps users logged in via a cookie
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: SESSIONS_PATH,
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
    httpOnly: true,                     // prevents JavaScript access to cookie
    sameSite: 'lax',                    // CSRF protection
    secure: NODE_ENV === 'production', // HTTPS only in production
  },
}));

// Make the logged-in user and notification count available to all templates
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.notificationCount = 0;
  if (req.session.user) {
    const row = db.prepare(
      'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(req.session.user.id);
    res.locals.notificationCount = row.c;
  }
  next();
});

// Page view tracking (skip static assets and API routes)
app.use((req, res, next) => {
  // Only track GET requests for actual pages
  if (req.method === 'GET' && !req.path.match(/\.(css|js|png|jpg|ico|svg|woff|woff2)$/)) {
    try {
      db.prepare(`
        INSERT INTO page_views (path, user_id, session_id, referrer, user_agent)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        req.path,
        req.session.user ? req.session.user.id : null,
        req.sessionID || null,
        req.get('Referer') || '',
        (req.get('User-Agent') || '').substring(0, 500)
      );
    } catch (err) {
      // Silently fail - don't break the app if analytics fails
    }
  }
  next();
});

// ------- ROUTES -------

const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const tableRoutes = require('./routes/tables');
const messageRoutes = require('./routes/messages');
const reviewRoutes = require('./routes/reviews');
const profileRoutes = require('./routes/profile');
const notificationRoutes = require('./routes/notifications');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/admin');

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/events', eventRoutes);
app.use('/tables', tableRoutes);
app.use('/messages', messageRoutes);
app.use('/reviews', reviewRoutes);
app.use('/profile', profileRoutes);
app.use('/notifications', notificationRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/admin', adminRoutes);

// ------- SOCKET.IO (real-time messaging) -------

require('./utils/socket')(io);

// ------- ERROR HANDLING -------

// 404 - Page not found
app.use((req, res) => {
  res.status(404).render('pages/error', {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
  });
});

// 500 - Server error
app.use((err, req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).render('pages/error', {
    title: 'Server Error',
    message: 'Something went wrong. Please try again later.',
  });
});

// ------- START SERVER -------

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SyncUp is running at http://localhost:${PORT}`);
});
