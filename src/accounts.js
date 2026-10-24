// New accounts, made from the sign-up page or from a visitor posting their first job. Both use the
// same checks so the rules can't drift apart. Also removing team logins, which the Team page and
// password resets both do.

const bcrypt = require('bcryptjs');
const db = require('./db');
const { oneLine } = require('./helpers');
const { logOutEverywhere } = require('./middleware');

const q = {
  byEmail: db.prepare('SELECT id FROM users WHERE email = ?'),
  insert: db.prepare('INSERT INTO users (email, password_hash, name, phone, role, company) VALUES (?, ?, ?, ?, ?, ?)'),
  team: db.prepare("SELECT * FROM team_members WHERE account_id = ? AND status != 'removed'"),
  removeMember: db.prepare("UPDATE team_members SET status = 'removed', token = NULL, user_id = NULL WHERE id = ?"),
  disableLogin: db.prepare("UPDATE users SET password_hash = '!' WHERE id = ?"),
  unassign: db.prepare('UPDATE work_orders SET assigned_to = NULL WHERE assigned_to = ? AND account_id = ?'),
};

const TAKEN = 'There is already an account with that email. Try logging in.';

function read(body) {
  return {
    name: oneLine(body.name, 80),
    email: String(body.email || '').trim().toLowerCase().slice(0, 200),
    phone: oneLine(body.phone, 30),
    company: oneLine(body.company, 100),
  };
}

// The first problem with a new account's details, or null if they're fine.
function problem(values, password, role) {
  if (!values.name) return 'Enter your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return 'Enter a valid email address.';
  if (role === 'tradie' && !/^[\d\s+()-]{8,}$/.test(values.phone)) return 'Enter a phone number customers can reach you on.';
  if (password.length < 8) return 'Use at least 8 characters for your password.';
  if (password.length > 200) return 'Use 200 characters or fewer for your password.';
  if (q.byEmail.get(values.email)) return TAKEN;
  return null;
}

const hash = (password) => bcrypt.hash(password, 11);

// Insert the user and return their id. Run inside a transaction when other rows depend on it.
// Throws if the email was taken in the meantime (see isTaken).
function insert(values, passwordHash, role) {
  const company = role === 'tradie' ? null : values.company || null;
  return Number(q.insert.run(values.email, passwordHash, values.name, values.phone || null, role, company).lastInsertRowid);
}

// Two sign-ups with the same email at the same moment: the second insert hits the unique index.
const isTaken = (err) => err && err.code === 'SQLITE_CONSTRAINT_UNIQUE' && /users\.email/.test(err.message);

// Take someone off a team (or cancel their invite). Their login only existed for this team, so it's
// switched off for good and any session they have open ends now. The user row stays so their notes
// and hours stay on the jobs (and so its id can never be handed to someone else).
function removeMember(member) {
  db.transaction(() => {
    q.removeMember.run(member.id);
    if (member.user_id) {
      q.disableLogin.run(member.user_id);
      q.unassign.run(member.user_id, member.account_id);
      logOutEverywhere(member.user_id);
    }
  })();
}

// Everyone on an account's team, and invites not yet accepted.
const team = (ownerId) => q.team.all(ownerId);

function removeTeam(ownerId) {
  db.transaction(() => {
    for (const m of team(ownerId)) removeMember(m);
  })();
}

module.exports = { read, problem, hash, insert, isTaken, TAKEN, removeMember, removeTeam, team };
