const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { flash } = require('../middleware');

const router = express.Router();

const findByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const insertUser = db.prepare(
  'INSERT INTO users (email, password_hash, name, phone, role) VALUES (?, ?, ?, ?, ?)',
);

// Small in-memory throttle on login attempts per IP + email.
const attempts = new Map();
function throttled(key) {
  const now = Date.now();
  const rec = attempts.get(key) || { n: 0, until: 0, first: now };
  if (now - rec.first > 15 * 60 * 1000) Object.assign(rec, { n: 0, first: now });
  attempts.set(key, rec);
  return rec;
}

function safeNext(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('pages/login', { title: 'Log in', next: req.query.next || '', email: '' });
});

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const rec = throttled(`${req.ip}|${email}`);

  if (rec.n >= 8) {
    return res.status(429).render('pages/login', {
      title: 'Log in',
      next: req.body.next,
      email,
      error: 'Too many attempts. Wait 15 minutes and try again.',
    });
  }

  const user = findByEmail.get(email);
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) {
    rec.n += 1;
    return res.status(401).render('pages/login', {
      title: 'Log in',
      next: req.body.next,
      email,
      error: "That email and password don't match.",
    });
  }

  attempts.delete(`${req.ip}|${email}`);
  req.session.uid = user.id;
  res.redirect(safeNext(req.body.next));
});

router.get('/signup', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  const as = req.query.as === 'tradie' ? 'tradie' : 'customer';
  res.render('pages/signup', { title: as === 'tradie' ? 'Join as a tradie' : 'Create an account', as, values: {}, next: req.query.next || '' });
});

router.post('/signup', async (req, res) => {
  const as = req.body.as === 'tradie' ? 'tradie' : 'customer';
  const values = {
    name: String(req.body.name || '').trim(),
    email: String(req.body.email || '').trim().toLowerCase(),
    phone: String(req.body.phone || '').trim(),
  };
  const password = String(req.body.password || '');

  let error = null;
  if (!values.name) error = 'Enter your name.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) error = 'Enter a valid email address.';
  else if (as === 'tradie' && !/^[\d\s+()-]{8,}$/.test(values.phone)) error = 'Enter a phone number customers can reach you on.';
  else if (password.length < 8) error = 'Use at least 8 characters for your password.';
  else if (findByEmail.get(values.email)) error = 'There is already an account with that email. Try logging in.';

  if (error) {
    return res.status(400).render('pages/signup', {
      title: as === 'tradie' ? 'Join as a tradie' : 'Create an account',
      as,
      values,
      next: req.body.next,
      error,
    });
  }

  const role = config.adminEmail && values.email === config.adminEmail ? 'admin' : as;
  const hash = await bcrypt.hash(password, 11);
  const info = insertUser.run(values.email, hash, values.name, values.phone || null, role);
  req.session.uid = Number(info.lastInsertRowid);

  if (role === 'tradie') {
    flash(req, 'success', 'Account created. Now tell us about your business so we can check you over.');
    return res.redirect('/dashboard/profile');
  }
  flash(req, 'success', `Welcome to ${config.siteName}.`);
  res.redirect(safeNext(req.body.next));
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});

module.exports = router;
