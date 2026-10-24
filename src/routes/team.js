// Team management. An account owner invites people by link; they set a password and then log in
// on behalf of the owner's account with the role they were given. Used by tradie businesses,
// customer businesses and the Tradebench admin (for support staff).

const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { TEAM_ROLES, ROLE_NAMES } = require('../permissions');
const { flash, requireCan, logIn } = require('../middleware');
const { limit } = require('../ratelimit');
const notify = require('../notify');
const verification = require('../verification');
const accounts = require('../accounts');
const { oneLine, hasContactDetails } = require('../helpers');

// Each invite is an email from us to an address someone typed in, so an account can only send so many a day.
const INVITES_PER_DAY = 20;

const router = express.Router();

const q = {
  members: db.prepare(`
    SELECT m.*, u.phone FROM team_members m LEFT JOIN users u ON u.id = m.user_id
    WHERE m.account_id = ? AND m.status != 'removed' ORDER BY m.status = 'invited', m.created_at`),
  member: db.prepare('SELECT * FROM team_members WHERE id = ? AND account_id = ?'),
  // Invites work for 14 days.
  byToken: db.prepare("SELECT * FROM team_members WHERE token = ? AND status = 'invited' AND created_at > datetime('now', '-14 days')"),
  pendingForEmail: db.prepare("SELECT id FROM team_members WHERE account_id = ? AND email = ? AND status != 'removed'"),
  invitedToday: db.prepare("SELECT COUNT(*) AS n FROM team_members WHERE account_id = ? AND created_at > datetime('now', '-1 day')"),
  insert: db.prepare('INSERT INTO team_members (account_id, email, name, role, token) VALUES (?, ?, ?, ?, ?)'),
  setRole: db.prepare('UPDATE team_members SET role = ? WHERE id = ?'),
  activate: db.prepare("UPDATE team_members SET status = 'active', token = NULL, user_id = ?, name = ? WHERE id = ?"),
  userByEmail: db.prepare('SELECT id FROM users WHERE email = ?'),
  user: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare(
    'INSERT INTO users (email, password_hash, name, phone, role, company, admin_level) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ),
};

const inviteUrl = (token) => `${config.siteUrl}/invite/${token}`;
const kindOf = (req) => req.account.owner.role;

router.get('/team', requireCan('team'), (req, res) => {
  const kind = kindOf(req);
  res.render('pages/team', {
    title: 'Team',
    members: q.members.all(req.account.ownerId),
    roles: TEAM_ROLES[kind],
    ROLE_NAMES,
    kind,
    newInvite: req.session.newInvite || null,
    inviteUrl,
  });
  req.session.newInvite = null;
});

router.post('/team/invite', requireCan('team'), limit('team-invite', 30, 60 * 60 * 1000), (req, res) => {
  const kind = kindOf(req);
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 200);
  const name = oneLine(req.body.name, 80);
  const role = TEAM_ROLES[kind].find((r) => r.slug === req.body.role) ? req.body.role : null;

  let error = null;
  // Anyone can sign up with an email they don't own, so team logins (which outlast a password reset
  // by the real owner) wait until the address is confirmed.
  if (!req.account.owner.email_verified_at) error = 'Confirm your email address first, using the link we emailed you. Then you can invite your team.';
  else if (!name) error = "Enter the person's name.";
  // Both names go in the invite email we send to an address someone typed in.
  else if (hasContactDetails(name)) error = "Take phone numbers, emails and web links out of the person's name.";
  else if (hasContactDetails(businessName(req.account.owner))) error = 'Your name or business name has a phone number, email or web link in it. Take it out first, then invite your team.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = 'Enter a valid email address.';
  else if (!role) error = 'Pick a role.';
  else if (q.userByEmail.get(email)) error = 'That email already has its own Tradebench account. Use a different email for their team login.';
  else if (q.pendingForEmail.get(req.account.ownerId, email)) error = "They're already on your team or have an invite waiting.";
  else if (q.invitedToday.get(req.account.ownerId).n >= INVITES_PER_DAY) error = `You can send up to ${INVITES_PER_DAY} invites a day. Try again tomorrow.`;

  if (error) {
    flash(req, 'error', error);
    return res.redirect('/team');
  }

  const token = crypto.randomBytes(18).toString('base64url');
  q.insert.run(req.account.ownerId, email, name, role, token);
  notify.teamInvite({ email, name }, businessName(req.account.owner), inviteUrl(token));
  req.session.newInvite = { name, token };
  res.redirect('/team');
});

router.post('/team/:id/role', requireCan('team'), (req, res) => {
  const member = q.member.get(Number(req.params.id), req.account.ownerId);
  const role = TEAM_ROLES[kindOf(req)].find((r) => r.slug === req.body.role);
  if (member && role) {
    q.setRole.run(role.slug, member.id);
    flash(req, 'success', `${member.name} is now ${role.name.toLowerCase() === 'staff' ? 'staff' : `a ${role.name.toLowerCase()}`}.`);
  }
  res.redirect('/team');
});

router.post('/team/:id/remove', requireCan('team'), (req, res) => {
  const member = q.member.get(Number(req.params.id), req.account.ownerId);
  if (member) {
    accounts.removeMember(member);
    flash(req, 'success', `${member.name} has been removed and can no longer log in.`);
  }
  res.redirect('/team');
});

// ---- Accepting an invite ----

function loadInvite(req, res, next) {
  const invite = q.byToken.get(String(req.params.token));
  if (!invite) {
    return res.status(404).render('pages/error', {
      title: 'Invite not found',
      message: 'This invite link has expired, been used, or was cancelled. Ask whoever invited you for a new one.',
    });
  }
  req.invite = invite;
  req.inviteOwner = q.user.get(invite.account_id);
  next();
}

function businessName(owner) {
  if (owner.role === 'admin') return config.siteName;
  if (owner.role === 'tradie') {
    const p = db.prepare('SELECT business_name FROM tradie_profiles WHERE user_id = ?').get(owner.id);
    if (p) return p.business_name;
  }
  return owner.company || owner.name;
}

router.get('/invite/:token', loadInvite, (req, res) => {
  res.locals.robots = 'noindex, nofollow';
  if (req.user) {
    return res.render('pages/error', {
      title: 'Log out first',
      message: `You're logged in as ${req.user.email}. Log out, then open this invite link again to join.`,
    });
  }
  res.render('pages/invite', {
    title: 'Join the team',
    invite: req.invite,
    business: businessName(req.inviteOwner),
    roleName: ROLE_NAMES[req.invite.role],
    roleHint: (TEAM_ROLES[req.inviteOwner.role].find((r) => r.slug === req.invite.role) || {}).hint,
  });
});

router.post('/invite/:token', limit('invite', 20, 60 * 60 * 1000), loadInvite, async (req, res) => {
  const invite = req.invite;
  const owner = req.inviteOwner;
  const name = oneLine(req.body.name, 80);
  const phone = oneLine(req.body.phone, 30) || null;
  const password = String(req.body.password || '');

  const render = (error) =>
    res.status(400).render('pages/invite', {
      title: 'Join the team',
      invite: { ...invite, name },
      business: businessName(owner),
      roleName: ROLE_NAMES[invite.role],
      roleHint: (TEAM_ROLES[owner.role].find((r) => r.slug === invite.role) || {}).hint,
      error,
    });

  if (!name) return render('Enter your name.');
  if (password.length < 8) return render('Use at least 8 characters for your password.');
  if (password.length > 200) return render('Use 200 characters or fewer for your password.');
  if (q.userByEmail.get(invite.email)) return render('That email already has an account. Ask for an invite to a different email.');

  const hash = await bcrypt.hash(password, 11);
  const userId = db.transaction(() => {
    const id = Number(
      q.insertUser.run(invite.email, hash, name, phone, owner.role, owner.company || null, owner.role === 'admin' ? 'support' : null)
        .lastInsertRowid,
    );
    q.activate.run(id, name, invite.id);
    return id;
  })();

  // The invite link was emailed to this address, so opening it proves they get mail there.
  verification.markVerified(userId, invite.email);
  logIn(req, userId);
  flash(req, 'success', `Welcome to ${businessName(owner)}.`);
  res.redirect(owner.role === 'admin' ? '/admin' : owner.role === 'tradie' && invite.role === 'worker' ? '/work' : '/dashboard');
});

module.exports = router;
