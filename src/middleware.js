const crypto = require('crypto');
const db = require('./db');
const { can, ROLE_NAMES } = require('./permissions');

const getUser = db.prepare('SELECT id, email, name, phone, role, company, admin_level FROM users WHERE id = ?');
const getProfile = db.prepare('SELECT * FROM tradie_profiles WHERE user_id = ?');
const getMembership = db.prepare("SELECT * FROM team_members WHERE user_id = ? AND status = 'active'");

// Loads the signed-in user, a CSRF token and any flash message into res.locals.
function loadSession(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');

  req.user = req.session.uid ? getUser.get(req.session.uid) : null;
  if (req.session.uid && !req.user) req.session.uid = null;

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

function flash(req, type, text) {
  req.session.flash = { type, text };
}

function verifyCsrf(req, res, next) {
  if (req.method !== 'POST') return next();
  const sent = (req.body && req.body._csrf) || req.get('x-csrf-token');
  const expected = req.session.csrf;
  if (
    sent &&
    expected &&
    sent.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected))
  ) {
    return next();
  }
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

module.exports = { loadSession, flash, verifyCsrf, requireLogin, requireRole, requireCan, requireApprovedTradie };
