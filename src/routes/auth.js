const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { redirectIfAuth } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/email');

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
  const existing = await db.prepare(
    'SELECT id FROM users WHERE username = $1 OR email = $2'
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

  // Insert the new user and return the created user
  const result = await db.pool.query(
    'INSERT INTO users (username, email, password_hash, full_name) VALUES ($1, $2, $3, $4) RETURNING id, username, email, full_name, avatar_url',
    [username, email, passwordHash, full_name]
  );

  const newUser = result.rows[0];

  // Log them in immediately
  req.session.user = {
    id: newUser.id,
    username: newUser.username,
    email: newUser.email,
    full_name: newUser.full_name,
    avatar_url: newUser.avatar_url,
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
  const user = await db.prepare('SELECT * FROM users WHERE email = $1').get(email);

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

// ------- FORGOT PASSWORD -------

router.get('/forgot-password', redirectIfAuth, (req, res) => {
  res.render('pages/forgot-password', {
    title: 'Forgot Password - SyncUp',
    errors: [],
    message: null
  });
});

router.post('/forgot-password', redirectIfAuth, [
  body('email')
    .trim()
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),
], async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.render('pages/forgot-password', {
      title: 'Forgot Password - SyncUp',
      errors: errors.array(),
      message: null,
    });
  }

  const { email } = req.body;

  try {
    // Find user by email
    const user = await db.prepare('SELECT * FROM users WHERE email = $1').get(email);

    // Always show success message (don't reveal if email exists for security)
    const successMessage = 'If an account exists with that email, you will receive a password reset link shortly.';

    if (!user) {
      // Don't reveal that user doesn't exist
      return res.render('pages/forgot-password', {
        title: 'Forgot Password - SyncUp',
        errors: [],
        message: successMessage,
      });
    }

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store token in database
    await db.pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, resetToken, expiresAt]
    );

    // Send password reset email
    const emailResult = await sendPasswordResetEmail(user.email, resetToken, user.username);

    if (!emailResult.success && !emailResult.devMode) {
      console.error('Failed to send password reset email:', emailResult.error);
    }

    res.render('pages/forgot-password', {
      title: 'Forgot Password - SyncUp',
      errors: [],
      message: successMessage,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.render('pages/forgot-password', {
      title: 'Forgot Password - SyncUp',
      errors: [{ msg: 'Something went wrong. Please try again later.' }],
      message: null,
    });
  }
});

// ------- RESET PASSWORD -------

router.get('/reset-password/:token', redirectIfAuth, async (req, res) => {
  const { token } = req.params;

  try {
    // Validate token
    const tokenData = await db.prepare(`
      SELECT * FROM password_reset_tokens
      WHERE token = $1 AND used = FALSE AND expires_at > NOW()
    `).get(token);

    if (!tokenData) {
      return res.render('pages/error', {
        title: 'Invalid Reset Link',
        message: 'This password reset link is invalid or has expired. Please request a new one.',
      });
    }

    res.render('pages/reset-password', {
      title: 'Reset Password - SyncUp',
      token,
      errors: [],
    });
  } catch (error) {
    console.error('Reset password GET error:', error);
    res.render('pages/error', {
      title: 'Error',
      message: 'Something went wrong. Please try again later.',
    });
  }
});

router.post('/reset-password/:token', redirectIfAuth, [
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('password_confirm')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
], async (req, res) => {
  const { token } = req.params;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.render('pages/reset-password', {
      title: 'Reset Password - SyncUp',
      token,
      errors: errors.array(),
    });
  }

  const { password } = req.body;

  try {
    // Validate token and get user
    const tokenData = await db.prepare(`
      SELECT * FROM password_reset_tokens
      WHERE token = $1 AND used = FALSE AND expires_at > NOW()
    `).get(token);

    if (!tokenData) {
      return res.render('pages/error', {
        title: 'Invalid Reset Link',
        message: 'This password reset link is invalid or has expired. Please request a new one.',
      });
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Update user password
    await db.prepare(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2'
    ).run(passwordHash, tokenData.user_id);

    // Mark token as used
    await db.prepare(
      'UPDATE password_reset_tokens SET used = TRUE WHERE id = $1'
    ).run(tokenData.id);

    // Render success page
    res.render('pages/password-reset-success', {
      title: 'Password Reset Successful - SyncUp',
    });
  } catch (error) {
    console.error('Reset password POST error:', error);
    res.render('pages/reset-password', {
      title: 'Reset Password - SyncUp',
      token,
      errors: [{ msg: 'Something went wrong. Please try again later.' }],
    });
  }
});

module.exports = router;
