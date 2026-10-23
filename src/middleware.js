const crypto = require('crypto');
const db = require('./db');
const { can, ROLE_NAMES } = require('./permissions');

const getUser = db.prepare("SELECT id, email, name, phone, role, company, admin_level, session_key, password_hash = '!' AS disabled FROM users WHERE id = ?");
const getProfile = db.prepare('SELECT * FROM tradie_profiles WHERE user_id = ?');
const getMembership = db.prepare("SELECT * FROM team_members WHERE user_id = ? AND status = 'active'");

// Loads the signed-in user, a CSRF token and any flash message into res.locals.
function loadSession(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');

  req.user = req.session.uid ? getUser.get(req.session.uid) : null;
  // The session must carry the user's current key, the login mustn't have been disabled, and this
  // session mustn't have been logged out.
  if (req.user && (req.session.sk !== req.user.session_key || req.user.disabled || isRevoked.get(req.session.sid || ''))) {
    req.user = null;
  }
  // Sessions from before session ids existed get one, so logging out can end them too.
  if (req.user && !req.session.sid) req.session.sid = crypto.randomBytes(16).toString('hex');
  if (req.session.uid && !req.user) {
    req.session.uid = null;
    req.session.sk = null;
  }

  // Work out whose account this person is acting for. Team members act for the owner.
  req.account = null;
  if (req.user) {
    const membership = getMembership.get(req.user.id);
    if (membership) {
      req.account = { ownerId: membership.account_id, role: membership.role, owner: getUser.get(membership.account_id) };
    } else if (req.user.role === 'admin') {
      req.account = { ownerId: req.user.id, role: req.user.admin_level === 'support' ? 'support' : 'owner', owner: req.user };
    } else {
      req.account = { ownerId: req.user.id, role: 'owner', owner: req.user };
    }
    req.account.roleName = ROLE_NAMES[req.account.role];
    if (req.user.role === 'tradie') req.user.profile = getProfile.get(req.account.ownerId) || null;
  }

  res.locals.user = req.user;
  res.locals.account = req.account;
  res.locals.can = (action) => can(req, action);
  res.locals.csrf = req.session.csrf;
  res.locals.flash = req.session.flash || null;
  res.locals.path = req.path;
  req.session.flash = null;
  next();
}

// Log a user in: a fresh CSRF token and the user's current session key.
const keyFor = db.prepare('SELECT session_key FROM users WHERE id = ?');
function logIn(req, userId) {
  req.session.uid = userId;
  req.session.sk = keyFor.get(userId).session_key;
  req.session.sid = crypto.randomBytes(16).toString('hex');
  req.session.csrf = crypto.randomBytes(24).toString('hex');
}

// Log out just this session. The cookie is cleared, and its id is remembered until the cookie
// would have expired (30 days), so a copy of it can't be used either.
const revoke = db.prepare("INSERT OR IGNORE INTO revoked_sessions (sid, expires_at) VALUES (?, datetime('now', '+31 days'))");
const pruneRevoked = db.prepare("DELETE FROM revoked_sessions WHERE expires_at < datetime('now')");
const isRevoked = db.prepare('SELECT 1 FROM revoked_sessions WHERE sid = ?');
function logOut(req) {
  if (req.session && req.session.sid) {
    revoke.run(req.session.sid);
    pruneRevoked.run();
  }
  req.session = null;
}

// Change a user's session key, which logs them out on every device.
const rotate = db.prepare('UPDATE users SET session_key = lower(hex(randomblob(16))) WHERE id = ?');
function logOutEverywhere(userId) {
  rotate.run(userId);
}

function flash(req, type, text) {
  req.session.flash = { type, text };
}

// Constant-time string compare that copes with different lengths and multibyte input.
function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function verifyCsrf(req, res, next) {
  if (req.method !== 'POST') return next();
  const sent = String((req.body && req.body._csrf) || req.get('x-csrf-token') || '');
  const expected = req.session.csrf;
  if (expected && safeEqual(sent, expected)) return next();
  res.status(403).render('pages/error', {
    title: 'Form expired',
    message: 'That form timed out. Go back, refresh the page and try again.',
  });
}

function requireLogin(req, res, next) {
  if (req.user) return next();
  flash(req, 'info', 'Log in to keep going.');
  res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return requireLogin(req, res, next);
    if (roles.includes(req.user.role)) return next();
    res.status(403).render('pages/error', {
      title: 'Not available',
      message: "Your account doesn't have access to that page.",
    });
  };
}

function requireCan(action) {
  return (req, res, next) => {
    if (!req.user) return requireLogin(req, res, next);
    if (can(req, action)) return next();
    res.status(403).render('pages/error', {
      title: 'Not available',
      message: "Your role on this account doesn't allow that. Ask the account owner if you need access.",
    });
  };
}

function requireApprovedTradie(req, res, next) {
  const p = req.user && req.user.profile;
  if (p && p.status === 'approved') return next();
  flash(req, 'info', "Your account is still being checked. You'll be able to quote once it's approved.");
  res.redirect('/dashboard');
}

module.exports = { loadSession, flash, verifyCsrf, safeEqual, logIn, logOut, logOutEverywhere, requireLogin, requireRole, requireCan, requireApprovedTradie };
