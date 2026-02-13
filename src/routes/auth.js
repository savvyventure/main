const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { redirectIfAuth } = require('../middleware/auth');

// Number of "salt rounds" for bcrypt - higher = more secure but slower
const SALT_ROUNDS = 12;

// ------- SIGNUP -------

router.get('/signup', redirectIfAuth, (req, res) => {
  res.render('pages/signup', { title: 'Sign Up - SyncUp', errors: [], formData: {} });
});

router.post('/signup', redirectIfAuth, [
  // Validation rules - these check the form data before processing
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .trim()
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),
  body('full_name')
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Full name is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('password_confirm')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
], async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.render('pages/signup', {
      title: 'Sign Up - SyncUp',
      errors: errors.array(),
      formData: req.body,
    });
  }

  const { username, email, full_name, password } = req.body;

  // Check if username or email already exists
  const existing = db.prepare(
    'SELECT id FROM users WHERE username = ? OR email = ?'
  ).get(username, email);

  if (existing) {
    return res.render('pages/signup', {
      title: 'Sign Up - SyncUp',
      errors: [{ msg: 'Username or email already taken' }],
      formData: req.body,
    });
  }

  // Hash the password (never store plain text passwords!)
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Insert the new user
  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash, full_name) VALUES (?, ?, ?, ?)'
  ).run(username, email, passwordHash, full_name);

  // Log them in immediately
  req.session.user = {
    id: result.lastInsertRowid,
    username,
    email,
    full_name,
    avatar_url: '/images/default-avatar.png',
  };

  res.redirect('/');
});

// ------- LOGIN -------

router.get('/login', redirectIfAuth, (req, res) => {
  res.render('pages/login', { title: 'Log In - SyncUp', errors: [], formData: {} });
});

router.post('/login', redirectIfAuth, [
  body('email').trim().isEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.render('pages/login', {
      title: 'Log In - SyncUp',
      errors: errors.array(),
      formData: req.body,
    });
  }

  const { email, password } = req.body;

  // Find the user by email
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) {
    return res.render('pages/login', {
      title: 'Log In - SyncUp',
      errors: [{ msg: 'Invalid email or password' }],
      formData: req.body,
    });
  }

  // Compare the entered password with the stored hash
  const match = await bcrypt.compare(password, user.password_hash);

  if (!match) {
    return res.render('pages/login', {
      title: 'Log In - SyncUp',
      errors: [{ msg: 'Invalid email or password' }],
      formData: req.body,
    });
  }

  // Store user info in the session (this keeps them logged in)
  req.session.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    avatar_url: user.avatar_url,
  };

  res.redirect('/');
});

// ------- LOGOUT -------

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
