// Fills a local database with test accounts and jobs so you can click around.
// Never run this against the live site.

const config = require('../src/config');
if (config.isProd) {
  console.error('Refusing to seed in production.');
  process.exit(1);
}

const bcrypt = require('bcryptjs');
const db = require('../src/db');

const hash = bcrypt.hashSync('password123', 10);

function user(email, name, phone, role) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return existing.id;
  return Number(
    db.prepare('INSERT INTO users (email, password_hash, name, phone, role) VALUES (?, ?, ?, ?, ?)')
      .run(email, hash, name, phone, role).lastInsertRowid,
  );
}

const admin = user('admin@test.local', 'Site Admin', '0400 000 000', 'admin');
const customer = user('customer@test.local', 'Test Customer', '0400 111 222', 'customer');
const t1 = user('tiler@test.local', 'Test Tiler', '0400 333 444', 'tradie');
const t2 = user('plumber@test.local', 'Test Plumber', '0400 555 666', 'tradie');
const t3 = user('pending@test.local', 'Pending Tradie', '0400 777 888', 'tradie');

const profile = db.prepare(`
  INSERT OR IGNORE INTO tradie_profiles
    (user_id, business_name, abn, sectors, trades, regions, licence_no, insurer, insurance_expiry, years_trading, bio, status, approved_at)
  VALUES (?, ?, '51824753556', ?, ?, ?, ?, 'Test Insurer', '2027-06-30', ?, ?, ?, datetime('now'))`);

profile.run(t1, 'Test Tiling Co', 'housing,hotels', 'tiling,renovation', 'northern,cbd,eastern,western', null, 15, 'Test profile for local development.', 'approved');
profile.run(t2, 'Test Plumbing', 'housing,hotels,mining', 'plumbing,handyman,aircon', 'northern,cbd,southern,fremantle,pilbara', 'PL0000', 8, null, 'approved');
profile.run(t3, 'Not Yet Approved', 'housing', 'painting', 'peel', null, 2, null, 'pending');

const jobCount = db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n;
if (!jobCount) {
  const job = db.prepare(`
    INSERT INTO jobs (customer_id, sector, requirements, title, trade, suburb, postcode, region, description, budget, timing, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`);
  job.run(customer, 'housing', null, 'Regrout shower and replace four cracked floor tiles', 'tiling', 'Bayswater', '6053', 'eastern',
    'Main bathroom, about 2.4 x 1.8m. Shower grout is cracking and there is a damp patch on the wall behind it. Four floor tiles near the vanity are cracked. I have some spare tiles left over.',
    '500-2k', 'two-weeks', '-3 hours');
  job.run(customer, 'housing', null, 'Leaking kitchen mixer tap', 'plumbing', 'Scarborough', '6019', 'northern',
    'Single lever mixer has been dripping for a week and now leaks from the base when turned on. Happy to supply a new tap if needed.',
    'under-500', 'urgent', '-1 day');
  job.run(customer, 'hotels', 'Rooms 104 to 108 can be blocked out Monday to Wednesday. Work between 10am and 3pm only.', 'Reseal showers in five guest rooms', 'tiling', 'Fremantle', '6160', 'fremantle',
    'Silicone has failed in five ensuites on the first floor. Some grout is also cracking. Rooms are about 15 years old.',
    '2k-10k', 'two-weeks', '-5 hours');
  job.run(customer, 'mining', 'Site induction required. White Card and current medical. DIDO from Newman, meals provided.', 'Replace split systems in camp rooms', 'aircon', 'Newman', '6753', 'pilbara',
    'Eight split system units in the village have failed. Need removal and replacement with like-for-like units.',
    '10k-50k', 'month', '-1 day');
  job.run(customer, 'housing', null, 'Patio paving, about 30 square metres', 'concreting', 'Baldivis', '6171', 'peel',
    'Backyard is currently sand. Want it levelled and paved with standard 400x400 pavers. Access down the side of the house is 1.1m wide.',
    '2k-10k', 'month', '-2 days');
}

console.log(`Seeded. Log in with any of these (password: password123):
  admin@test.local     admin (id ${admin})
  customer@test.local  customer
  tiler@test.local     approved tradie
  plumber@test.local   approved tradie
  pending@test.local   tradie awaiting approval`);
