// Team management. An account owner invites people by link; they set a password and then log in
// on behalf of the owner's account with the role they were given. Used by tradie businesses,
// customer businesses and the Tradebench admin (for support staff).

const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { TEAM_ROLES, ROLE_NAMES } = require('../permissions');
const { flash, requireCan } = require('../middleware');
const notify = require('../notify');

const router = express.Router();

const q = {
  members: db.prepare(`
    SELECT m.*, u.phone FROM team_members m LEFT JOIN users u ON u.id = m.user_id
    WHERE m.account_id = ? AND m.status != 'removed' ORDER BY m.status = 'invited', m.created_at`),
  member: db.prepare('SELECT * FROM team_members WHERE id = ? AND account_id = ?'),
  byToken: db.prepare("SELECT * FROM team_members WHERE token = ? AND status = 'invited'"),
  pendingForEmail: db.prepare("SELECT id FROM team_members WHERE account_id = ? AND email = ? AND status != 'removed'"),
  insert: db.prepare('INSERT INTO team_members (account_id, email, name, role, token) VALUES (?, ?, ?, ?, ?)'),
  setRole: db.prepare('UPDATE team_members SET role = ? WHERE id = ?'),
  remove: db.prepare("UPDATE team_members SET status = 'removed', token = NULL, user_id = NULL WHERE id = ?"),
  activate: db.prepare("UPDATE team_members SET status = 'active', token = NULL, user_id = ?, name = ? WHERE id = ?"),
  userByEmail: db.prepare('SELECT id FROM users WHERE email = ?'),
  user: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare(
    'INSERT INTO users (email, password_hash, name, phone, role, company, admin_level) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ),
  removeUser: db.prepare('DELETE FROM users WHERE id = ?'),
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

router.post('/team/invite', requireCan('team'), (req, res) => {
  const kind = kindOf(req);
  const email = String(req.body.email || '').trim().toLowerCase();
  const name = String(req.body.name || '').trim().slice(0, 80);
  const role = TEAM_ROLES[kind].find((r) => r.slug === req.body.role) ? req.body.role : null;

  let error = null;
  if (!name) error = "Enter the person's name.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = 'Enter a valid email address.';
  else if (!role) error = 'Pick a role.';
  else if (q.userByEmail.get(email)) error = 'That email already has its own Tradebench account. Use a different email for their team login.';
  else if (q.pendingForEmail.get(req.account.ownerId, email)) error = "They're already on your team or have an invite waiting.";

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
    db.transaction(() => {
      q.remove.run(member.id);
      // Their login only existed for this team, so it goes too. Their notes and hours stay on the jobs.
      if (member.user_id) {
        const hasHistory = db.prepare(`
          SELECT (SELECT COUNT(*) FROM work_notes WHERE user_id = @id) + (SELECT COUNT(*) FROM time_entries WHERE user_id = @id)
            + (SELECT COUNT(*) FROM work_costs WHERE user_id = @id) + (SELECT COUNT(*) FROM jobs WHERE customer_id = @id) AS n`).get({ id: member.user_id }).n;
        if (hasHistory) db.prepare("UPDATE users SET password_hash = '!' WHERE id = ?").run(member.user_id);
        else q.removeUser.run(member.user_id);
      }
    })();
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
      message: 'This invite link has already been used or was cancelled. Ask whoever invited you for a new one.',
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

router.post('/invite/:token', loadInvite, async (req, res) => {
  const invite = req.invite;
  const owner = req.inviteOwner;
  const name = String(req.body.name || '').trim().slice(0, 80);
  const phone = String(req.body.phone || '').trim() || null;
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

  req.session.uid = userId;
  flash(req, 'success', `Welcome to ${businessName(owner)}.`);
  res.redirect(owner.role === 'admin' ? '/admin' : owner.role === 'tradie' && invite.role === 'worker' ? '/work' : '/dashboard');
});

module.exports = router;
