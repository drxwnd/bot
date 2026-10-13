const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { flash } = require('../middleware');
const notify = require('../notify');
const { unsubscribeToken } = require('../emails');

const router = express.Router();

const findByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const insertUser = db.prepare(
  'INSERT INTO users (email, password_hash, name, phone, role, company, customer_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
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
    company: String(req.body.company || '').trim().slice(0, 100),
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
  const company = role === 'tradie' ? null : values.company || null;
  const intent = req.session.intent || {};
  const customerType = role === 'customer' && intent.path === 'need' ? intent.who : null;
  const info = insertUser.run(values.email, hash, values.name, values.phone || null, role, company, customerType);
  req.session.uid = Number(info.lastInsertRowid);

  if (role === 'tradie') {
    flash(req, 'success', 'Account created. Now tell us about your business so we can check you over.');
    return res.redirect('/dashboard/profile');
  }
  flash(req, 'success', `Welcome to ${config.siteName}.`);
  res.redirect(safeNext(req.body.next));
});

// ---- Password reset ----

const resets = {
  insert: db.prepare("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))"),
  find: db.prepare("SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')"),
  useAll: db.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL"),
  setPassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
  user: db.prepare('SELECT * FROM users WHERE id = ?'),
};
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

router.get('/forgot', (req, res) => {
  res.locals.robots = 'noindex, nofollow';
  res.render('pages/forgot', { title: 'Reset your password', email: '' });
});

router.post('/forgot', (req, res) => {
  res.locals.robots = 'noindex, nofollow';
  const email = String(req.body.email || '').trim().toLowerCase();
  const rec = throttled(`forgot|${req.ip}`);
  if (rec.n >= 5) {
    return res.status(429).render('pages/forgot', { title: 'Reset your password', email, error: 'Too many requests. Wait 15 minutes and try again.' });
  }
  rec.n += 1;
  const user = findByEmail.get(email);
  // A removed team member's login is disabled with '!' and can't be brought back this way.
  if (user && user.password_hash !== '!') {
    const token = crypto.randomBytes(24).toString('base64url');
    resets.insert.run(hashToken(token), user.id);
    notify.passwordReset(user, `${config.siteUrl}/reset/${token}`);
  }
  // Same answer either way, so this can't be used to find out who has an account.
  res.render('pages/forgot', { title: 'Reset your password', email, sent: true });
});

function loadReset(req, res, next) {
  res.locals.robots = 'noindex, nofollow';
  req.reset = resets.find.get(hashToken(req.params.token));
  if (!req.reset) {
    return res.status(404).render('pages/error', {
      title: 'Link expired',
      message: 'That reset link has expired or has already been used. Ask for a new one from the log in page.',
    });
  }
  next();
}

router.get('/reset/:token', loadReset, (req, res) => {
  res.render('pages/reset', { title: 'Choose a new password', token: req.params.token });
});

router.post('/reset/:token', loadReset, async (req, res) => {
  const password = String(req.body.password || '');
  if (password.length < 8) {
    return res.status(400).render('pages/reset', { title: 'Choose a new password', token: req.params.token, error: 'Use at least 8 characters.' });
  }
  const hash = await bcrypt.hash(password, 11);
  db.transaction(() => {
    resets.setPassword.run(hash, req.reset.user_id);
    resets.useAll.run(req.reset.user_id);
  })();
  req.session.uid = req.reset.user_id;
  flash(req, 'success', 'Password changed. You are logged in.');
  res.redirect('/dashboard');
});

// ---- Turning off job alerts and reminders (the link at the bottom of those emails) ----

function checkUnsubscribe(u, t) {
  const id = Number(u);
  if (!Number.isInteger(id) || typeof t !== 'string') return null;
  const expected = unsubscribeToken(id);
  if (t.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(expected))) return null;
  return resets.user.get(id) || null;
}

router.get('/unsubscribe', (req, res) => {
  res.locals.robots = 'noindex, nofollow';
  const user = checkUnsubscribe(req.query.u, req.query.t);
  if (!user) return res.status(404).render('pages/error', { title: 'Link not recognised', message: `That link doesn't look right. Email ${config.supportEmail} and we'll turn alerts off for you.` });
  res.render('pages/unsubscribe', { title: 'Job alerts', email: user.email, alerts: Boolean(user.email_alerts), u: user.id, t: req.query.t });
});

router.post('/unsubscribe', (req, res) => {
  res.locals.robots = 'noindex, nofollow';
  const user = checkUnsubscribe(req.body.u, req.body.t);
  if (!user) return res.redirect('/');
  const on = req.body.on === '1' ? 1 : 0;
  db.prepare('UPDATE users SET email_alerts = ? WHERE id = ?').run(on, user.id);
  res.render('pages/unsubscribe', { title: 'Job alerts', email: user.email, alerts: Boolean(on), u: user.id, t: req.body.t });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});

module.exports = router;
