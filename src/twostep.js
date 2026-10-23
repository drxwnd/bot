// Two-step login with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy,
// 1Password...). These apps all use the same standard (TOTP, RFC 6238): a shared secret and the time
// give a 6-digit code that changes every 30 seconds.
//
// The secret is stored encrypted with a key made from SESSION_SECRET, so a copy of the database alone
// doesn't give away anyone's codes. Changing SESSION_SECRET therefore switches two-step off for
// everyone (their codes stop matching); they'd use a backup code and set it up again.

const crypto = require('crypto');
const QRCode = require('qrcode');
const db = require('./db');
const config = require('./config');

const STEP = 30;
const DIGITS = 6;
// Codes from one step either side are accepted, for phones whose clock is a little off.
const WINDOW = 1;
const BACKUP_CODES = 10;

// ---- Base32, the format authenticator apps use for the secret ----

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function unbase32(str) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of str.replace(/=+$/, '').toUpperCase()) {
    const i = ALPHABET.indexOf(ch);
    if (i === -1) throw new Error('Not base32');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ---- The code itself ----

function codeAt(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = crypto.createHmac('sha1', secret).update(counter).digest();
  const offset = mac[mac.length - 1] & 15;
  const n = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(n).padStart(DIGITS, '0');
}

const stepNow = () => Math.floor(Date.now() / 1000 / STEP);

// The time step a code belongs to, or null. A step at or before `lastStep` has been used already.
function match(secret, code, lastStep = null) {
  const clean = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const now = stepNow();
  for (let s = now - WINDOW; s <= now + WINDOW; s += 1) {
    if (lastStep != null && s <= lastStep) continue;
    const expected = codeAt(secret, s);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return s;
  }
  return null;
}

// ---- Storing the secret ----

const key = crypto.createHash('sha256').update(`two-step:${config.sessionSecret}`).digest();

function seal(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(secret), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString('base64url')).join('.');
}

function unseal(stored) {
  try {
    const [iv, tag, body] = String(stored).split('.').map((s) => Buffer.from(s, 'base64url'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    return null;
  }
}

const q = {
  user: db.prepare('SELECT id, email, totp_secret, totp_pending, totp_enabled_at, totp_last_step FROM users WHERE id = ?'),
  setPending: db.prepare('UPDATE users SET totp_pending = ? WHERE id = ?'),
  enable: db.prepare(`
    UPDATE users SET totp_secret = totp_pending, totp_pending = NULL, totp_enabled_at = datetime('now'), totp_last_step = ?
    WHERE id = ? AND totp_pending = ?`),
  used: db.prepare('UPDATE users SET totp_last_step = ? WHERE id = ? AND (totp_last_step IS NULL OR totp_last_step < ?)'),
  disable: db.prepare('UPDATE users SET totp_secret = NULL, totp_pending = NULL, totp_enabled_at = NULL, totp_last_step = NULL WHERE id = ?'),
  clearCodes: db.prepare('DELETE FROM recovery_codes WHERE user_id = ?'),
  addCode: db.prepare('INSERT INTO recovery_codes (user_id, code_hash) VALUES (?, ?)'),
  useCode: db.prepare("UPDATE recovery_codes SET used_at = datetime('now') WHERE user_id = ? AND code_hash = ? AND used_at IS NULL"),
  codesLeft: db.prepare('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ? AND used_at IS NULL'),
};

const hashCode = (code) => crypto.createHash('sha256').update(`recovery:${String(code).toLowerCase().replace(/[^a-z0-9]/g, '')}`).digest('hex');

// ---- What the routes use ----

const isOn = (user) => Boolean(user && user.totp_enabled_at);

// Start setting up (or move to a new phone): a fresh secret, used only once a code from it is
// entered. Until then the current secret, if there is one, keeps working.
async function begin(userId) {
  q.setPending.run(seal(crypto.randomBytes(20)), userId);
  return details(userId);
}

// What the setup page shows for the secret waiting to be confirmed: a QR code and the key to type in.
async function details(userId) {
  const user = q.user.get(userId);
  const secret = user && user.totp_pending ? unseal(user.totp_pending) : null;
  if (!secret) return null;
  const key = base32(secret);
  const label = encodeURIComponent(`${config.siteName}:${user.email}`);
  const uri = `otpauth://totp/${label}?secret=${key}&issuer=${encodeURIComponent(config.siteName)}&digits=${DIGITS}&period=${STEP}`;
  return { key: key.match(/.{1,4}/g).join(' '), qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
}

// Switch it on once the person proves their app shows the right code. Returns fresh backup codes, or null.
function confirm(userId, code) {
  const user = q.user.get(userId);
  const secret = user && user.totp_pending ? unseal(user.totp_pending) : null;
  const step = secret ? match(secret, code) : null;
  if (step == null) return null;
  return db.transaction(() => {
    if (!q.enable.run(step, userId, user.totp_pending).changes) return null;
    return newBackupCodes(userId);
  })();
}

// Check a login code or a backup code. Each one works once.
function check(userId, code) {
  const user = q.user.get(userId);
  if (!isOn(user)) return false;
  const clean = String(code || '').trim();
  if (/^\d[\d\s]{5,}$/.test(clean)) {
    const secret = unseal(user.totp_secret);
    const step = secret ? match(secret, clean, user.totp_last_step) : null;
    // The update only goes through if no other login used this step in the meantime.
    return step != null && q.used.run(step, userId, step).changes > 0;
  }
  return q.useCode.run(userId, hashCode(clean)).changes > 0;
}

function newBackupCodes(userId) {
  const codes = Array.from({ length: BACKUP_CODES }, () => {
    const raw = crypto.randomBytes(5).toString('hex');
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  db.transaction(() => {
    q.clearCodes.run(userId);
    for (const c of codes) q.addCode.run(userId, hashCode(c));
  })();
  return codes;
}

function turnOff(userId) {
  db.transaction(() => {
    q.disable.run(userId);
    q.clearCodes.run(userId);
  })();
}

const backupCodesLeft = (userId) => q.codesLeft.get(userId).n;

module.exports = { isOn, begin, details, confirm, check, newBackupCodes, turnOff, backupCodesLeft, codeAt, unbase32, stepNow };
