const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const db = require('../db');

// Dynamic URLs - Works for both Local and Production
const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? 'https://book-elien-backend.vercel.app' 
  : 'http://localhost:3041';

const FRONTEND_URL = process.env.NODE_ENV === 'production' 
  ? 'https://book-elien.vercel.app' 
  : 'http://localhost:3020';

console.log('🔧 Google OAuth Config - Backend:', BACKEND_URL);
console.log('🔧 Google OAuth Config - Frontend:', FRONTEND_URL);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${BACKEND_URL}/users/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const googleId = profile.id;
        const avatar = profile.photos?.[0]?.value || null;

        let result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
          result = await db.query(
            `INSERT INTO users (name, email, google_id, avatar, created_at)
             VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
            [name, email, googleId, avatar]
          );
        } else if (!result.rows[0].google_id) {
          await db.query(
            'UPDATE users SET google_id = $1, avatar = $2 WHERE email = $3',
            [googleId, avatar, email]
          );
        }

        return done(null, result.rows[0]);
      } catch (error) {
        console.error('❌ Google OAuth error:', error);
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Google Login Route
router.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account',
}));

// Google Callback Route
router.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${FRONTEND_URL}/auth/login-form?error=google_failed`,
  }),
  (req, res) => {
    const user = req.user;

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const nameParts = (user.name || '').trim().split(' ');
    const userProfile = {
      id: user.id,
      f_name: nameParts[0] || '',
      l_name: nameParts.slice(1).join(' ') || '',
      email: user.email,
      avatar: user.avatar,
    };

    res.redirect(
      `${FRONTEND_URL}/auth/google-callback?token=${accessToken}&user=${encodeURIComponent(JSON.stringify(userProfile))}`
    );
  }
);

module.exports = router;