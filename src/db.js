const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(config.dataDir, { recursive: true });

const db = new Database(process.env.DB_FILE || path.join(config.dataDir, 'ezbuild.db'));
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
addColumn('jobs', 'sector', "TEXT NOT NULL DEFAULT 'housing'");
addColumn('jobs', 'requirements', 'TEXT');
addColumn('tradie_profiles', 'sectors', "TEXT NOT NULL DEFAULT 'housing'");
addColumn('tradie_profiles', 'tickets', 'TEXT');

module.exports = db;
