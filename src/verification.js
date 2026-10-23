// Email verification. A link goes to the address at sign-up (and again on request); opening it
// proves the person owns the address. Links last three days and work once.
//
// An account's "Verified" badge needs a verified email, and a tradie can't be approved without one.

const crypto = require('crypto');
const db = require('./db');
const config = require('./config');
const notify = require('./notify');

const q = {
  user: db.prepare('SELECT id, email, email_verified_at FROM users WHERE id = ?'),
  insert: db.prepare("INSERT INTO email_verifications (token_hash, user_id, email, expires_at) VALUES (?, ?, ?, datetime('now', '+3 days'))"),
  recent: db.prepare("SELECT COUNT(*) AS n FROM email_verifications WHERE user_id = ? AND expires_at > datetime('now', '+3 days', '-1 hour')"),
  find: db.prepare("SELECT * FROM email_verifications WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')"),
  useAll: db.prepare("UPDATE email_verifications SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL"),
  mark: db.prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, datetime('now')) WHERE id = ? AND email = ?"),
};

const hashToken = (t) => crypto.createHash('sha256').update(`verify:${t}`).digest('hex');

// Email a verification link. Three an hour at most per account, so it can't be used to flood an
// inbox. Returns false when that limit is hit or the email is already verified.
function send(userId) {
  const user = q.user.get(userId);
  if (!user || user.email_verified_at) return false;
  if (q.recent.get(userId).n >= 3) return false;
  const token = crypto.randomBytes(24).toString('base64url');
  q.insert.run(hashToken(token), user.id, user.email);
  notify.verifyEmail(user, `${config.siteUrl}/verify-email/${token}`);
  return true;
}

// Use a link. Returns the user id it verified, or null if the link is unknown, used or expired. The
// address on the account must still be the one the link was sent to.
function use(token) {
  const row = q.find.get(hashToken(String(token || '')));
  if (!row) return null;
  return db.transaction(() => {
    const ok = q.mark.run(row.user_id, row.email).changes > 0;
    q.useAll.run(row.user_id);
    return ok ? row.user_id : null;
  })();
}

// Mark an address verified because the person has just proved they get mail there some other way
// (they opened a password reset or team invite link sent to it).
function markVerified(userId, email) {
  q.mark.run(userId, email);
  q.useAll.run(userId);
}

// The "Verified" badge: a verified email, and for tradies, approved after our checks.
function isVerified(user, profile = null) {
  if (!user || !user.email_verified_at) return false;
  if (user.role === 'tradie') return Boolean(profile && profile.status === 'approved');
  return true;
}

module.exports = { send, use, markVerified, isVerified };
