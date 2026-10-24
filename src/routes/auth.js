const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { flash, logIn, logOut, logOutEverywhere, safeEqual } = require('../middleware');
const { limit, ipKey } = require('../ratelimit');
const notify = require('../notify');
const { unsubscribeToken } = require('../emails');
const accounts = require('../accounts');
const twostep = require('../twostep');
const verification = require('../verification');

const router = express.Router();

const findByEmail = db.prepare('SELECT * FROM users WHERE email = ?');

// Small in-memory throttle on login attempts per IP + email. Entries last 15 minutes and are swept
// every few minutes; the map also has a hard size cap, oldest dropped first, so it can't fill memory.
const WINDOW = 15 * 60 * 1000;
const MAX_TRACKED = 50_000;
const attempts = new Map();
function throttled(key) {
  const now = Date.now();
  let rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW) {
    attempts.delete(key);
    if (attempts.size >= MAX_TRACKED) attempts.delete(attempts.keys().next().value);
    rec = { n: 0, first: now };
    attempts.set(key, rec);
  }
  return rec;
}
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, r] of attempts) if (now - r.first > WINDOW) attempts.delete(k);
}, 5 * 60 * 1000);
sweep.unref();

// Password checks running at once. bcrypt takes the one CPU for a moment each, so a flood of logins
// gets "busy, try again" rather than slowing the whole site down for everyone.
const MAX_HASHING = 4;
let hashing = 0;

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
  // Sign-up keeps emails to 200 characters, so nothing longer can match an account.
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 200);
  const password = String(req.body.password || '');
  const ipEmail = `${ipKey(req.ip)}|${email}`;
  const rec = throttled(ipEmail);
  const forEmail = throttled(`email|${email}`);
  const page = (status, error) => res.status(status).render('pages/login', { title: 'Log in', next: req.body.next, email, error });

  if (rec.n >= 8 || forEmail.n >= EMAIL_FAILURES) {
    return page(429, 'Too many attempts. Wait 15 minutes and try again, or reset your password.');
  }
  if (hashing >= MAX_HASHING) {
    res.set('Retry-After', '5');
    return page(503, 'Lots of people are logging in right now. Wait a few seconds and try again.');
  }

  // Counted as a failure before the (slow) password check, so many tries sent at once can't all slip
  // in under the limit while the first ones are still being checked. Given back if it's right.
  rec.n += 1;
  forEmail.n += 1;
  hashing += 1;
  let ok;
  const user = findByEmail.get(email);
  try {
    ok = await bcrypt.compare(password.slice(0, 200), user ? user.password_hash : DUMMY_HASH);
  } finally {
    hashing -= 1;
  }
  if (!ok || !user) return page(401, "That email and password don't match.");

  attempts.delete(ipEmail);
  forEmail.n = Math.max(0, forEmail.n - 1);
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
  notify.newSignup(userId);

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
  const rec = throttled(`forgot|${ipKey(req.ip)}`);
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
  const before = resets.user.get(req.reset.user_id);
  const team = accounts.team(before.id);
  db.transaction(() => {
    resets.setPassword.run(hash, before.id);
    resets.useAll.run(before.id);
    // If the email had never been confirmed, whoever set the account up may not have owned it, so
    // any team logins they made (which have passwords of their own) are removed too.
    if (!before.email_verified_at) accounts.removeTeam(before.id);
  })();
  // Every device logged in with this login (the reason for the reset, perhaps) is logged out. Team
  // members have their own logins; see above and the Team page.
  logOutEverywhere(before.id);
  // The reset link came by email, so they clearly get mail at this address.
  verification.markVerified(before.id, before.email);
  let message = 'Password changed. You are logged in.';
  let next = '/dashboard';
  if (team.length && !before.email_verified_at) {
    message = 'Password changed. The team logins and invites on this account were removed, because the email had not been confirmed when they were set up. Invite your team again from here.';
    next = '/team';
  } else if (team.length) {
    message = "Password changed. Check your team below and remove anyone you don't recognise: they have their own logins.";
    next = '/team';
  }
  // A new password alone mustn't get past two-step login.
  if (twostep.isOn(before)) {
    flash(req, 'success', `${message} Enter your two-step code to finish logging in.`);
    return askForCode(req, res, before.id, next);
  }
  logIn(req, before.id);
  flash(req, 'success', message);
  res.redirect(next);
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

// One-click unsubscribe from the List-Unsubscribe header. Mail apps POST here without a cookie or form
// token (so it's let past the CSRF check in server.js); the signed token in the link is what proves it.
// Opening the link in a browser shows the normal page instead.
router.get('/unsubscribe/one-click', (req, res) => {
  res.redirect(`/unsubscribe?${new URLSearchParams({ u: String(req.query.u || ''), t: String(req.query.t || '') })}`);
});

router.post('/unsubscribe/one-click', (req, res) => {
  const user = checkUnsubscribe(req.query.u, req.query.t);
  if (!user) return res.status(400).type('text').send('Link not recognised');
  db.prepare('UPDATE users SET email_alerts = 0 WHERE id = ?').run(user.id);
  res.type('text').send('Unsubscribed from job alerts and reminders');
});

router.post('/logout', (req, res) => {
  logOut(req);
  res.redirect('/');
});

module.exports = router;
