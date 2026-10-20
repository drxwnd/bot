// New accounts, made from the sign-up page or from a visitor posting their first job. Both use the
// same checks so the rules can't drift apart.

const bcrypt = require('bcryptjs');
const db = require('./db');
const { oneLine } = require('./helpers');

const q = {
  byEmail: db.prepare('SELECT id FROM users WHERE email = ?'),
  insert: db.prepare('INSERT INTO users (email, password_hash, name, phone, role, company) VALUES (?, ?, ?, ?, ?, ?)'),
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

module.exports = { read, problem, hash, insert, isTaken, TAKEN };
