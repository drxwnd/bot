const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(config.dataDir, { recursive: true });

const db = new Database(process.env.DB_FILE || path.join(config.dataDir, 'tradebench.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  phone         TEXT,
  role          TEXT NOT NULL CHECK (role IN ('customer', 'tradie', 'admin')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tradie_profiles (
  user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  business_name     TEXT NOT NULL,
  abn               TEXT NOT NULL,
  trades            TEXT NOT NULL,
  regions           TEXT NOT NULL,
  licence_no        TEXT,
  insurer           TEXT,
  insurance_expiry  TEXT,
  years_trading     INTEGER,
  bio               TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  stripe_account_id TEXT,
  payouts_enabled   INTEGER NOT NULL DEFAULT 0,
  approved_at       TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id                INTEGER PRIMARY KEY,
  customer_id       INTEGER NOT NULL REFERENCES users(id),
  title             TEXT NOT NULL,
  trade             TEXT NOT NULL,
  suburb            TEXT NOT NULL,
  postcode          TEXT NOT NULL,
  address           TEXT,
  region            TEXT NOT NULL,
  description       TEXT NOT NULL,
  budget            TEXT NOT NULL,
  timing            TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'awarded', 'paid', 'completed', 'cancelled')),
  accepted_quote_id INTEGER,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status, created_at);

CREATE TABLE IF NOT EXISTS job_photos (
  id       INTEGER PRIMARY KEY,
  job_id   INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  filename TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quotes (
  id           INTEGER PRIMARY KEY,
  job_id       INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  tradie_id    INTEGER NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  message      TEXT NOT NULL,
  start_date   TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (job_id, tradie_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id                    INTEGER PRIMARY KEY,
  job_id                INTEGER NOT NULL UNIQUE REFERENCES jobs(id),
  quote_id              INTEGER NOT NULL REFERENCES quotes(id),
  amount_cents          INTEGER NOT NULL,
  fee_cents             INTEGER NOT NULL,
  stripe_session_id     TEXT,
  stripe_payment_intent TEXT,
  stripe_charge_id      TEXT,
  transfer_id           TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'held', 'released', 'refunded')),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at               TEXT,
  released_at           TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY,
  job_id      INTEGER NOT NULL UNIQUE REFERENCES jobs(id),
  tradie_id   INTEGER NOT NULL REFERENCES users(id),
  customer_id INTEGER NOT NULL REFERENCES users(id),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Columns added after launch. SQLite can't add a column with IF NOT EXISTS, so check first.
function addColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

addColumn('users', 'company', 'TEXT');
// Who a customer is (home, landlord, hotel, mining), from the get-started quiz.
addColumn('users', 'customer_type', 'TEXT');
addColumn('jobs', 'sector', "TEXT NOT NULL DEFAULT 'housing'");
addColumn('jobs', 'requirements', 'TEXT');
// When the customer accepted a quote (for the "pay to lock it in" reminder), and how many tradies the
// new-job alert went to (for the admin's alerts).
addColumn('jobs', 'awarded_at', 'TEXT');
addColumn('jobs', 'alerted', 'INTEGER');
addColumn('tradie_profiles', 'sectors', "TEXT NOT NULL DEFAULT 'housing'");
addColumn('tradie_profiles', 'tickets', 'TEXT');

// Admin accounts: 'owner' can do everything, 'support' can't move money or manage staff.
addColumn('users', 'admin_level', 'TEXT');

// Invoicing settings for a tradie business.
addColumn('tradie_profiles', 'hourly_rate_cents', 'INTEGER');
addColumn('tradie_profiles', 'gst_registered', 'INTEGER NOT NULL DEFAULT 0');
addColumn('tradie_profiles', 'payment_details', 'TEXT');
addColumn('tradie_profiles', 'invoice_prefix', "TEXT NOT NULL DEFAULT 'INV-'");

db.exec(`
-- People who log in on behalf of an account: a tradie business, a customer business or the Tradebench admin.
-- account_id is the owner's user id. user_id stays empty until the invite is accepted.
CREATE TABLE IF NOT EXISTS team_members (
  id         INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id    INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL,
  token      TEXT UNIQUE,
  status     TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'removed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A job a tradie business is running: either won on Tradebench (job_id set) or their own private job.
CREATE TABLE IF NOT EXISTS work_orders (
  id             INTEGER PRIMARY KEY,
  account_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source         TEXT NOT NULL CHECK (source IN ('tradebench', 'private')),
  job_id         INTEGER UNIQUE REFERENCES jobs(id),
  title          TEXT NOT NULL,
  client_name    TEXT,
  client_phone   TEXT,
  client_email   TEXT,
  address        TEXT,
  description    TEXT,
  price_cents    INTEGER,
  status         TEXT NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new', 'scheduled', 'in_progress', 'done', 'invoiced', 'paid', 'cancelled')),
  assigned_to    INTEGER REFERENCES users(id),
  scheduled_date TEXT,
  scheduled_time TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS work_orders_account ON work_orders(account_id, status);

CREATE TABLE IF NOT EXISTS work_notes (
  id         INTEGER PRIMARY KEY,
  work_id    INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  body       TEXT,
  photo      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS time_entries (
  id         INTEGER PRIMARY KEY,
  work_id    INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  work_date  TEXT NOT NULL,
  minutes    INTEGER NOT NULL CHECK (minutes > 0),
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS work_costs (
  id           INTEGER PRIMARY KEY,
  work_id      INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  description  TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id         INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id    INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  number     TEXT NOT NULL,
  issued_on  TEXT NOT NULL,
  due_on     TEXT NOT NULL,
  gst        INTEGER NOT NULL DEFAULT 0,
  notes      TEXT,
  status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  paid_on    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, number)
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id               INTEGER PRIMARY KEY,
  invoice_id       INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description      TEXT NOT NULL,
  quantity         REAL NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  position         INTEGER NOT NULL DEFAULT 0
);
`);

// Sessions carry this key. Changing it logs the user out everywhere (removed team members,
// password resets).
addColumn('users', 'session_key', 'TEXT');
db.exec(`UPDATE users SET session_key = lower(hex(randomblob(16))) WHERE session_key IS NULL`);

// Notifications.
addColumn('users', 'email_alerts', 'INTEGER NOT NULL DEFAULT 1');
addColumn('payments', 'customer_fee_cents', 'INTEGER NOT NULL DEFAULT 0');
addColumn('payments', 'disputed', 'INTEGER NOT NULL DEFAULT 0');
// How much went back to the customer. The secure payment fee isn't refunded.
addColumn('payments', 'refunded_cents', 'INTEGER');

db.exec(`
-- Every email we send (or would have sent, without a provider). Kept for support and debugging.
CREATE TABLE IF NOT EXISTS emails (
  id         INTEGER PRIMARY KEY,
  to_email   TEXT NOT NULL,
  kind       TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body_text  TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'logged', 'failed')),
  error      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at    TEXT
);
CREATE INDEX IF NOT EXISTS emails_created ON emails(created_at);

-- One-off reminders that have already gone out, so the hourly check never repeats one.
CREATE TABLE IF NOT EXISTS reminders_sent (
  kind    TEXT NOT NULL,
  ref_id  INTEGER NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (kind, ref_id)
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

-- Stripe can send the same event more than once.
CREATE TABLE IF NOT EXISTS stripe_events (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Tradies can reply to reviews; and add a logo and photos of their work to their profile.
addColumn('reviews', 'reply', 'TEXT');
addColumn('reviews', 'reply_at', 'TEXT');
addColumn('tradie_profiles', 'logo', 'TEXT');
db.exec(`
CREATE TABLE IF NOT EXISTS tradie_photos (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename   TEXT NOT NULL,
  caption    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS tradie_photos_user ON tradie_photos(user_id);
`);

// Email verification: a link emailed at sign-up proves the person owns the address. A verified email is
// part of an account's "Verified" badge (and, for tradies, of being approved).
addColumn('users', 'email_verified_at', 'TEXT');
// Two-step login with an authenticator app. Secrets are stored encrypted (see src/twostep.js). The
// pending one is waiting to be confirmed (first set-up, or a move to a new phone) while the current
// one keeps working. last_step stops a code being used twice.
addColumn('users', 'totp_secret', 'TEXT');
addColumn('users', 'totp_pending', 'TEXT');
addColumn('users', 'totp_enabled_at', 'TEXT');
addColumn('users', 'totp_last_step', 'INTEGER');
db.exec(`
CREATE TABLE IF NOT EXISTS email_verifications (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);
-- One-time backup codes for two-step login, for when the phone is lost. Only hashes are kept.
CREATE TABLE IF NOT EXISTS recovery_codes (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at   TEXT,
  PRIMARY KEY (user_id, code_hash)
);
`);

// Sessions live in the cookie, so logging out records that session's id here and the cookie stops
// working even if someone copied it. Rows are dropped once the cookie would have expired anyway.
db.exec(`
CREATE TABLE IF NOT EXISTS revoked_sessions (
  sid        TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);
`);

// Indexes for the lookups the site does on every page.
db.exec(`
CREATE INDEX IF NOT EXISTS quotes_tradie ON quotes(tradie_id, status);
CREATE INDEX IF NOT EXISTS quotes_job ON quotes(job_id, status);
CREATE INDEX IF NOT EXISTS reviews_tradie ON reviews(tradie_id);
CREATE INDEX IF NOT EXISTS jobs_customer ON jobs(customer_id, status);
CREATE INDEX IF NOT EXISTS job_photos_job ON job_photos(job_id);
CREATE INDEX IF NOT EXISTS work_notes_work ON work_notes(work_id);
CREATE INDEX IF NOT EXISTS time_entries_work ON time_entries(work_id);
CREATE INDEX IF NOT EXISTS work_costs_work ON work_costs(work_id);
CREATE INDEX IF NOT EXISTS invoices_work ON invoices(work_id);
CREATE INDEX IF NOT EXISTS invoice_lines_invoice ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS team_members_account ON team_members(account_id, status);
CREATE INDEX IF NOT EXISTS payments_charge ON payments(stripe_charge_id);
CREATE INDEX IF NOT EXISTS payments_intent ON payments(stripe_payment_intent);
CREATE INDEX IF NOT EXISTS work_orders_assigned ON work_orders(assigned_to);
`);

module.exports = db;
