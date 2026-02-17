const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const db = require('../db/database');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.prepare('SELECT * FROM users WHERE id = $1').get(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${APP_URL}/auth/google/callback`,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists with this Google ID
      let user = await db.prepare('SELECT * FROM users WHERE google_id = $1').get(profile.id);
      if (user) return done(null, user);

      const email = profile.emails?.[0]?.value;
      if (email) {
        // Check if email already registered
        user = await db.prepare('SELECT * FROM users WHERE email = $1').get(email);
        if (user) {
          // Link Google ID to existing account
          await db.prepare('UPDATE users SET google_id = $1, auth_provider = $2 WHERE id = $3').run(profile.id, 'google', user.id);
          return done(null, user);
        }
      }

      // Create new user
      const username = (profile.displayName || email?.split('@')[0] || `user${Date.now()}`).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30) + Math.floor(Math.random() * 100);
      const avatar = profile.photos?.[0]?.value || '/images/default-avatar.png';
      const result = await db.pool.query(
        'INSERT INTO users (username, email, full_name, avatar_url, google_id, auth_provider, password_hash) VALUES ($1, $2, $3, $4, $5, $6, NULL) RETURNING *',
        [username, email || null, profile.displayName || username, avatar, profile.id, 'google']
      );
      done(null, result.rows[0]);
    } catch (err) {
      done(err);
    }
  }));
}

// Facebook Strategy
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: `${APP_URL}/auth/facebook/callback`,
    profileFields: ['id', 'displayName', 'email', 'photos'],
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await db.prepare('SELECT * FROM users WHERE facebook_id = $1').get(profile.id);
      if (user) return done(null, user);

      const email = profile.emails?.[0]?.value;
      if (email) {
        user = await db.prepare('SELECT * FROM users WHERE email = $1').get(email);
        if (user) {
          await db.prepare('UPDATE users SET facebook_id = $1, auth_provider = $2 WHERE id = $3').run(profile.id, 'facebook', user.id);
          return done(null, user);
        }
      }

      const username = (profile.displayName || `user${Date.now()}`).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 28) + Math.floor(Math.random() * 100);
      const avatar = profile.photos?.[0]?.value || '/images/default-avatar.png';
      const result = await db.pool.query(
        'INSERT INTO users (username, email, full_name, avatar_url, facebook_id, auth_provider, password_hash) VALUES ($1, $2, $3, $4, $5, $6, NULL) RETURNING *',
        [username, email || null, profile.displayName || username, avatar, profile.id, 'facebook']
      );
      done(null, result.rows[0]);
    } catch (err) {
      done(err);
    }
  }));
}

module.exports = passport;
