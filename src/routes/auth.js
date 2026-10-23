const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { flash, logIn, logOut, logOutEverywhere, safeEqual } = require('../middleware');
const { limit } = require('../ratelimit');
const notify = require('../notify');
const { unsubscribeToken } = require('../emails');
const accounts = require('../accounts');
const twostep = require('../twostep');
const verification = require('../verification');

const router = express.Router();

const findByEmail = db.prepare('SELECT * FROM users WHERE email = ?');

// Small in-memory throttle on login attempts per IP + email.
const attempts = new Map();
function throttled(key) {
  const now = Date.now();
  const rec = attempts.get(key) || { n: 0, until: 0, first: now };
  if (now - rec.first > 15 * 60 * 1000) Object.assign(rec, { n: 0, first: now });
  attempts.set(key, rec);
  if (attempts.size > 10000) {
    for (const [k, r] of attempts) if (now - r.first > 15 * 60 * 1000) attempts.delete(k);
  }
  return rec;
}

// Compared against when the email isn't found, so a wrong email takes as long as a wrong password
// and the timing doesn't give away who has an account.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 11);

// Failed logins on one email from any number of IPs. High enough that it takes a determined effort to
// lock someone out, low enough to stop password guessing spread across many addresses.
const EMAIL_FAILURES = 30;

// Only ever redirect to a path on this site. Backslashes and control characters are refused because
// browsers treat "/\\evil.com" like "//evil.com".
function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  if (/[\\\x00-\x1f\x7f]/.test(next)) return '/dashboard';
  try {
    const u = new URL(next, config.siteUrl);
    if (u.origin !== new URL(config.siteUrl).origin) return '/dashboard';
    return u.pathname + u.search + u.hash;
  } catch {
    return '/dashboard';
  }
}

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('pages/login', { title: 'Log in', next: req.query.next || '', email: '' });
});

const loginLimit = limit('login', 40, 15 * 60 * 1000, (req, res) =>
  res.render('pages/login', { title: 'Log in', next: req.body.next, email: '', error: 'Too many attempts. Wait 15 minutes and try again.' }),
);
const signupLimit = limit('signup', 12, 60 * 60 * 1000);

router.post('/login', loginLimit, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const rec = throttled(`${req.ip}|${email}`);
  const forEmail = throttled(`email|${email}`);

  if (rec.n >= 8 || forEmail.n >= EMAIL_FAILURES) {
    return res.status(429).render('pages/login', {
      title: 'Log in',
      next: req.body.next,
      email,
      error: 'Too many attempts. Wait 15 minutes and try again, or reset your password.',
    });
  }

  const user = findByEmail.get(email);
  const ok = await bcrypt.compare(password.slice(0, 200), user ? user.password_hash : DUMMY_HASH);
  if (!ok || !user) {
    rec.n += 1;
    forEmail.n += 1;
    return res.status(401).render('pages/login', {
      title: 'Log in',
      next: req.body.next,
      email,
      error: "That email and password don't match.",
    });
  }

  attempts.delete(`${req.ip}|${email}`);
  if (twostep.isOn(user)) return askForCode(req, res, user.id, safeNext(req.body.next));
  logIn(req, user.id);
  res.redirect(safeNext(req.body.next));
});

// ---- Two-step login: the password was right, now the code from their authenticator app ----

// Ten minutes to enter the code, after which they start again from the password.
const CODE_WINDOW = 10 * 60 * 1000;

function askForCode(req, res, userId, next) {
  req.session.uid = null;
  req.session.sk = null;
  req.session.twostep = { uid: userId, next, at: Date.now() };
  res.redirect('/login/2step');
}

function pendingCode(req) {
  const p = req.session.twostep;
  if (!p || Date.now() - p.at > CODE_WINDOW) return null;
  return p;
}

router.get('/login/2step', (req, res) => {
  res.locals.robots = 'noindex, nofollow';
  if (!pendingCode(req)) return res.redirect('/login');
  res.render('pages/twostep-login', { title: 'Two-step login' });
});

router.post('/login/2step', loginLimit, (req, res) => {
  res.locals.robots = 'noindex, nofollow';
  const p = pendingCode(req);
  if (!p) {
    flash(req, 'info', 'That took a while. Log in again.');
    return res.redirect('/login');
  }
  // Six wrong codes on one account in 15 minutes, from anywhere, and it waits. A 6-digit code can't
  // be guessed at that rate.
  const rec = throttled(`2step|${p.uid}`);
  if (rec.n >= 6) {
    return res.status(429).render('pages/twostep-login', { title: 'Two-step login', error: 'Too many wrong codes. Wait 15 minutes and try again.' });
  }
  if (!twostep.check(p.uid, req.body.code)) {
    rec.n += 1;
    return res.status(401).render('pages/twostep-login', { title: 'Two-step login', error: "That code didn't work. Check your app and try the newest code." });
  }
  attempts.delete(`2step|${p.uid}`);
  req.session.twostep = null;
  logIn(req, p.uid);
  if (!twostep.backupCodesLeft(p.uid)) flash(req, 'info', "You've used your last backup code. Make new ones under Account > Two-step login.");
  res.redirect(p.next || '/dashboard');
});

// ---- Email verification ----

router.get('/verify-email/:token', (req, res) => {
  res.locals.robots = 'noindex, nofollow';
  const id = verification.use(req.params.token);
  if (!id) {
    return res.status(404).render('pages/error', {
      title: 'Link expired',
      message: 'That link has expired or has already been used. Log in and send a new one from your account page.',
    });
  }
  flash(req, 'success', 'Email confirmed. Thanks.');
  res.redirect(req.user ? '/dashboard' : '/login');
});

router.get('/signup', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  const as = req.query.as === 'tradie' ? 'tradie' : 'customer';
  res.render('pages/signup', { title: as === 'tradie' ? 'Join as a tradie' : 'Create an account', as, values: {}, next: req.query.next || '' });
});

router.post('/signup', signupLimit, async (req, res, next) => {
  const as = req.body.as === 'tradie' ? 'tradie' : 'customer';
  const values = accounts.read(req.body);
  const password = String(req.body.password || '');
  const fail = (error) =>
    res.status(400).render('pages/signup', {
      title: as === 'tradie' ? 'Join as a tradie' : 'Create an account',
      as,
      values,
      next: req.body.next,
      error,
    });

  const error = accounts.problem(values, password, as);
  if (error) return fail(error);

  // Outside production, signing up with ADMIN_EMAIL makes you the admin, which keeps local testing
  // simple. In production admins are made with `node scripts/make-admin.js`, so nobody can claim
  // the admin account by signing up with that address first.
  const role = !config.isProd && config.adminEmail && values.email === config.adminEmail ? 'admin' : as;
  let userId;
  try {
    userId = accounts.insert(values, await accounts.hash(password), role);
  } catch (err) {
    if (accounts.isTaken(err)) return fail(accounts.TAKEN);
    return next(err);
  }
  logIn(req, userId);
  verification.send(userId);

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
  recent: db.prepare("SELECT COUNT(*) AS n FROM password_resets WHERE user_id = ? AND expires_at > datetime('now')"),
  useAll: db.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL"),
  setPassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
  user: db.prepare('SELECT * FROM users WHERE id = ?'),
};
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

router.get('/forgot', (req, res) => {
  res.locals.robots = 'noindex, nofollow';
  res.render('pages/forgot', { title: 'Reset your password', email: '' });
});

router.post('/forgot', limit('forgot', 10, 60 * 60 * 1000), (req, res) => {
  res.locals.robots = 'noindex, nofollow';
  const email = String(req.body.email || '').trim().toLowerCase();
  const rec = throttled(`forgot|${req.ip}`);
  if (rec.n >= 5) {
    return res.status(429).render('pages/forgot', { title: 'Reset your password', email, error: 'Too many requests. Wait 15 minutes and try again.' });
  }
  rec.n += 1;
  const user = findByEmail.get(email);
  // A removed team member's login is disabled with '!' and can't be brought back this way. At most
  // three links an hour go to one address, however many people ask, so it can't be used to flood an inbox.
  if (user && user.password_hash !== '!' && resets.recent.get(user.id).n < 3) {
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
  // A login that's been disabled (a removed team member) can't be brought back with an old link.
  if (req.reset && resets.user.get(req.reset.user_id).password_hash === '!') req.reset = null;
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
  if (password.length < 8 || password.length > 200) {
    return res.status(400).render('pages/reset', { title: 'Choose a new password', token: req.params.token, error: 'Use between 8 and 200 characters.' });
  }
  const hash = await bcrypt.hash(password, 11);
  db.transaction(() => {
    resets.setPassword.run(hash, req.reset.user_id);
    resets.useAll.run(req.reset.user_id);
  })();
  // Anyone else logged in to this account (the reason for the reset, perhaps) is logged out.
  logOutEverywhere(req.reset.user_id);
  // The reset link came by email, so they clearly get mail at this address.
  const user = resets.user.get(req.reset.user_id);
  verification.markVerified(user.id, user.email);
  // A new password alone mustn't get past two-step login.
  if (twostep.isOn(user)) {
    flash(req, 'success', 'Password changed. Enter your two-step code to finish logging in.');
    return askForCode(req, res, user.id, '/dashboard');
  }
  logIn(req, user.id);
  flash(req, 'success', 'Password changed. You are logged in.');
  res.redirect('/dashboard');
});

// ---- Turning off job alerts and reminders (the link at the bottom of those emails) ----

function checkUnsubscribe(u, t) {
  const id = Number(u);
  if (!Number.isInteger(id) || typeof t !== 'string') return null;
  if (!safeEqual(t, unsubscribeToken(id))) return null;
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
  logOut(req);
  res.redirect('/');
});

module.exports = router;
