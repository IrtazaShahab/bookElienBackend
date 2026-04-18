const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

router.get('/', (_req, res) => {
  res.json({ message: 'Users API is up' });
});

router.post('/signup', async (req, res) => {
  try {
    const { f_name, l_name, email, password } = req.body;

    if (!f_name || !l_name || !email || !password) {
      return res.status(400).json({ message: 'f_name, l_name, email, and password are required' });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const insertResult = await db.query(
      'INSERT INTO users (f_name, l_name, email, password) VALUES ($1, $2, $3, $4) RETURNING id, f_name, l_name, email',
      [f_name, l_name, email, hashedPassword]
    );

    const user = insertResult.rows[0];
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      message: 'User created successfully',
      accessToken,
      data: user,
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ message: 'Error creating user' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await db.query(
      'SELECT id, f_name, l_name, email, password FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const accessToken = jwt.sign(
      { sub: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      message: 'Login successful',
      accessToken,
      data: {
        id: user.id,
        f_name: user.f_name,
        l_name: user.l_name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    if (err && (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED')) {
      return res.status(503).json({
        message: 'Database is unreachable. Check Supabase host/connection string.',
      });
    }
    return res.status(500).json({ message: 'Error during login' });
  }
});

module.exports = { router };
