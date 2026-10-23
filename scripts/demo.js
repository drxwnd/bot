// Fills an EMPTY local database with realistic sample data (made-up businesses, jobs, quotes and
// reviews) for demos and screenshots. Never run this against the live site.
//
//   DATA_DIR=./demo-data node scripts/demo.js
//
// Every account's password is: password123

const config = require('../src/config');
if (config.isProd) {
  console.error('Refusing to load demo data in production.');
  process.exit(1);
}

const bcrypt = require('bcryptjs');
const db = require('../src/db');
const { locate } = require('../src/locality');
const { feeFor } = require('../src/helpers');

if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n) {
  console.error('This database already has data. Point DATA_DIR at an empty folder.');
  process.exit(1);
}

const hash = bcrypt.hashSync('password123', 10);
const ago = (days, hours = 0) => `datetime('now', '-${days} days', '-${hours} hours')`;

function user(email, name, phone, role, company = null) {
  return Number(
    db.prepare('INSERT INTO users (email, password_hash, name, phone, role, company, created_at, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\', \'-120 days\'), datetime(\'now\', \'-120 days\'))')
      .run(email, hash, name, phone, role, company).lastInsertRowid,
  );
}

function tradie(email, name, phone, p) {
  const id = user(email, name, phone, 'tradie');
  db.prepare(`
    INSERT INTO tradie_profiles (user_id, business_name, abn, sectors, trades, regions, licence_no, tickets, insurer,
      insurance_expiry, years_trading, bio, status, payouts_enabled, stripe_account_id, approved_at)
    VALUES (@id, @business, @abn, @sectors, @trades, @regions, @licence, @tickets, @insurer, '2027-06-30', @years, @bio,
      @status, @payouts, @acct, datetime('now', '-100 days'))`).run({
    id, abn: '51824753556', licence: null, tickets: null, status: 'approved', payouts: 1, acct: `acct_demo_${id}`, ...p,
  });
  return id;
}

const admin = user('admin@demo.local', 'Site Admin', '0400 000 000', 'admin');

// ---- Customers ----
const sarah = user('sarah@demo.local', 'Sarah Mitchell', '0412 345 678', 'customer');
const mia = user('mia@demo.local', 'Mia Chen', '0423 456 789', 'customer', 'Coastal Stays Group');
const greg = user('greg@demo.local', 'Greg Paterson', '0434 567 890', 'customer', 'Ironbark Minerals');
const leanne = user('leanne@demo.local', 'Leanne Brooks', '0445 678 901', 'customer', 'Harbour Property Management');
const tom = user('tom@demo.local', 'Tom Nguyen', '0456 789 012', 'customer');

// ---- Tradies ----
const russo = tradie('dan@demo.local', 'Dan Russo', '0401 111 222', {
  business: 'Russo Tiling & Waterproofing', sectors: 'housing,hotels', trades: 'tiling,renovation',
  regions: 'northern,cbd,north-east,eastern,western', insurer: 'QBE', years: 18,
  bio: "Family-run tiling business based in Morley. Bathrooms, laundries, splashbacks and outdoor areas, plus waterproofing to AS 3740. I do the work myself, no subbies, and I'll tell you straight if a regrout will do instead of a full retile.",
});
const northside = tradie('priya@demo.local', 'Priya Nair', '0402 222 333', {
  business: 'Northside Plumbing & Gas', sectors: 'housing,hotels', trades: 'plumbing',
  regions: 'northern,cbd,north-east,western', licence: 'PL 9842', insurer: 'Allianz', years: 11,
  bio: 'Licensed plumber and gas fitter covering the northern suburbs. Hot water, blocked drains, leaks and bathroom rough-ins. Same-week service for most jobs.',
});
const coastline = tradie('jake@demo.local', 'Jake Whitford', '0403 333 444', {
  business: 'Coastline Electrical', sectors: 'housing,hotels', trades: 'electrical',
  regions: 'fremantle,southern,western,cbd', licence: 'EC 015472', insurer: 'CGU', years: 9,
  bio: 'Electrical contractor in Fremantle. Switchboards, safety switches, lighting and power points for homes, rentals and small hotels. Clean, on time, and I leave the place tidy.',
});
const pilbaraAir = tradie('tom.kerr@demo.local', 'Tom Kerr', '0404 444 555', {
  business: 'Pilbara Cool Air', sectors: 'mining,housing,hotels', trades: 'aircon,electrical',
  regions: 'pilbara', licence: 'EC 012980', insurer: 'Zurich', years: 14,
  tickets: 'ARCtick refrigerant handling licence (RHL), White Card, working at heights, EWP, current mine site medical. Inducted at several Newman and Tom Price sites.',
  bio: 'Air con installation and servicing across the Pilbara since 2012. Camp rooms, dongas, site offices and homes in Karratha and Hedland. Cyclone-rated outdoor unit mounts.',
});
const redDirt = tradie('lena@demo.local', 'Lena Ostrowski', '0405 555 666', {
  business: 'Red Dirt Fabrication', sectors: 'mining', trades: 'welding,fitting',
  regions: 'pilbara,goldfields', insurer: 'QBE', years: 12,
  tickets: 'Coded welder (AS/NZS 1554), White Card, confined space, working at heights, forklift (LF). Current medical and drug and alcohol clearance.',
  bio: 'Mobile welding and fabrication for mine sites, camps and workshops. Handrails, stairs, platforms, plant repairs and shutdown support.',
});
const hills = tradie('sam@demo.local', 'Sam Ho', '0406 666 777', {
  business: 'Hills Roofing & Gutters', sectors: 'housing', trades: 'roofing',
  regions: 'eastern,south-east,north-east', insurer: 'Allianz', years: 7,
  bio: 'Gutter replacement, leak repairs and rebedding and pointing for tiled roofs in the hills and eastern suburbs.',
});
const peel = tradie('aaron@demo.local', 'Aaron Blake', '0407 777 888', {
  business: 'Peel Paving & Concrete', sectors: 'housing', trades: 'concreting,bricklaying',
  regions: 'peel,southern,south-east', insurer: 'CGU', years: 15,
  bio: 'Driveways, exposed aggregate, paving and limestone walls from Cockburn down to Mandurah.',
});
const bayside = tradie('kate@demo.local', 'Kate Morrison', '0408 888 999', {
  business: 'Bayside Painting Co', sectors: 'housing,hotels', trades: 'painting,plastering',
  regions: 'fremantle,southern,western,cbd', licence: 'Painting contractor 4521', insurer: 'QBE', years: 10,
  bio: 'Registered painting contractor. Interiors, exteriors and rental repaints, plus patching and cornice repairs. We work around tenants and hotel guests.',
});
const goldfields = tradie('ben@demo.local', 'Ben Foster', '0409 999 000', {
  business: 'Goldfields Maintenance Services', sectors: 'mining,housing,hotels', trades: 'handyman,carpentry,plumbing',
  regions: 'goldfields', licence: 'PL 7731', insurer: 'Zurich', years: 8,
  tickets: 'White Card, working at heights, current medical. Inducted at camps around Kalgoorlie and Leonora.',
  bio: 'General maintenance for camps, motels and homes around Kalgoorlie-Boulder. Plumbing, carpentry and all the small jobs in between.',
});
tradie('chris@demo.local', 'Chris Adams', '0410 123 123', {
  business: 'Adams Carpentry', sectors: 'housing', trades: 'carpentry', regions: 'south-west', insurer: 'Allianz', years: 4,
  bio: 'Decking, pergolas and doors in the South West.', status: 'pending', payouts: 0, acct: null,
});

// ---- Jobs ----
const insertJob = db.prepare(`
  INSERT INTO jobs (customer_id, sector, title, trade, suburb, postcode, address, region, description, requirements, budget, timing, status, created_at)
  VALUES (@customer, @sector, @title, @trade, @suburb, @postcode, @address, @region, @description, @requirements, @budget, @timing, @status, datetime('now'))`);

function job(p) {
  const place = locate(p.address);
  if (place.error) throw new Error(`Bad demo address: ${p.address}`);
  const { days, hours, ...fields } = p;
  const info = insertJob.run({ requirements: null, status: 'open', ...fields, ...place });
  const id = Number(info.lastInsertRowid);
  db.prepare(`UPDATE jobs SET created_at = ${ago(days || 0, hours || 0)} WHERE id = ?`).run(id);
  return id;
}

const insertQuote = db.prepare(`
  INSERT INTO quotes (job_id, tradie_id, amount_cents, message, start_date, status) VALUES (?, ?, ?, ?, ?, ?)`);
function quote(jobId, tradieId, dollars, message, start = null, status = 'pending', hoursAgo = 2) {
  const id = Number(insertQuote.run(jobId, tradieId, dollars * 100, message, start, status).lastInsertRowid);
  db.prepare(`UPDATE quotes SET created_at = datetime('now', '-${hoursAgo} hours') WHERE id = ?`).run(id);
  return id;
}

function award(jobId, quoteId, paid, released) {
  db.prepare("UPDATE quotes SET status = 'declined' WHERE job_id = ? AND id != ?").run(jobId, quoteId);
  db.prepare("UPDATE quotes SET status = 'accepted' WHERE id = ?").run(quoteId);
  const status = released ? 'completed' : paid ? 'paid' : 'awarded';
  db.prepare('UPDATE jobs SET status = ?, accepted_quote_id = ? WHERE id = ?').run(status, quoteId, jobId);
  if (!paid) return;
  const amount = db.prepare('SELECT amount_cents FROM quotes WHERE id = ?').get(quoteId).amount_cents;
  db.prepare(`
    INSERT INTO payments (job_id, quote_id, amount_cents, fee_cents, status, stripe_payment_intent, stripe_charge_id, transfer_id, paid_at, released_at)
    VALUES (?, ?, ?, ?, ?, 'pi_demo', 'ch_demo', ?, datetime('now', '-10 days'), ${released ? "datetime('now', '-3 days')" : 'NULL'})`)
    .run(jobId, quoteId, amount, feeFor(amount), released ? 'released' : 'held', released ? 'tr_demo' : null);
}

function review(jobId, tradieId, customerId, rating, comment, daysAgo) {
  db.prepare(`INSERT INTO reviews (job_id, tradie_id, customer_id, rating, comment, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '-${daysAgo} days'))`).run(jobId, tradieId, customerId, rating, comment);
}

// Open housing jobs
const shower = job({
  customer: sarah, sector: 'housing', title: 'Regrout shower and replace four cracked floor tiles', trade: 'tiling',
  address: '14 Grand Promenade, Bayswater WA 6053', budget: '500-2k', timing: 'two-weeks', hours: 5,
  description: "Main bathroom, about 2.4m x 1.8m. Grout in the shower recess is cracking and there's a damp patch on the hallway wall behind it. Four floor tiles near the vanity are cracked. I've got about six spare tiles left over from when it was laid in 2015.",
});
quote(shower, russo, 845, "Rake out and regrout the full shower recess with epoxy grout, reseal all corners, and replace the four floor tiles using your spares. I'll check the wall behind with a moisture meter first. If the waterproofing has failed I'll let you know before going further. One and a half days on site.", '2026-10-21', 'pending', 3);
quote(shower, goldfields, 990, 'Regrout and reseal shower, replace cracked floor tiles. Price includes all materials.', null, 'withdrawn', 4);

const hws = job({
  customer: tom, sector: 'housing', title: 'Hot water system leaking from the bottom', trade: 'plumbing',
  address: '7 Lakeside Dr, Joondalup WA 6027', budget: '500-2k', timing: 'urgent', hours: 20,
  description: 'Rheem 315L electric storage unit, about 12 years old. Started leaking from the base this morning. Water is turned off at the unit for now. Happy to replace with a heat pump if the price is right.',
});
quote(hws, northside, 1890, 'Remove old unit and supply and install a new Rheem 315L electric, including new valves and tempering valve to code. Old unit taken away. Can do tomorrow morning. Heat pump option is $3,450 installed, and you may be able to claim a rebate.', '2026-10-13', 'pending', 6);

const board = job({
  customer: sarah, sector: 'housing', title: 'Switchboard upgrade and safety switches', trade: 'electrical',
  address: '22 Hampton Rd, Fremantle WA 6160', budget: '2k-10k', timing: 'month', days: 1,
  description: "1960s house still on ceramic fuses. Insurance company has asked us to upgrade the board and fit RCDs on all circuits. About 10 circuits. Board is on the front verandah.",
});
quote(board, coastline, 2650, 'Replace the old fuse board with a new enclosure and circuit breakers, RCBOs on every circuit, new main switch, and test and tag every circuit with a certificate for your insurer. Half a day, power off for about four hours.', '2026-10-28', 'pending', 18);

job({
  customer: tom, sector: 'housing', title: 'Replace gutters and downpipes on a single-storey house', trade: 'roofing',
  address: '9 Canning Rd, Kalamunda WA 6076', budget: '2k-10k', timing: 'month', days: 2,
  description: 'About 40m of gutters, rusted through in a few spots. Tiled roof, single storey, easy access from the yard. Want Colorbond in Monument or similar.',
});

const driveway = job({
  customer: sarah, sector: 'housing', title: 'Exposed aggregate driveway, about 55 square metres', trade: 'concreting',
  address: '31 Pershore Bend, Baldivis WA 6171', budget: '2k-10k', timing: 'month', days: 3,
  description: 'Currently compacted limestone. Want it boxed out and poured with exposed aggregate, sealed. Truck access is straight off the street.',
});
quote(driveway, peel, 6820, 'Excavate and compact, formwork, 100mm 25MPa exposed aggregate with mesh, saw cuts and two coats of sealer. Pour in one day, ready to drive on after 7 days.', '2026-11-04', 'pending', 40);

const repaint = job({
  customer: leanne, sector: 'housing', title: 'Repaint interior of 3x2 rental between tenants', trade: 'painting',
  address: '5 Rockingham Rd, Spearwood WA 6163', budget: '2k-10k', timing: 'two-weeks', days: 1, hours: 4,
  description: 'Vacant from the 25th. Walls, ceilings, doors and skirting throughout. A few patches where pictures were hung. Owner wants a neutral white.',
});
quote(repaint, bayside, 4380, 'Patch and sand, one coat of sealer undercoat where needed, and two coats of low-sheen acrylic throughout. Ceilings in flat white, and doors and trims in semi-gloss. Three days with two painters, all done before the new tenants move in.', '2026-10-26', 'pending', 12);

// Hotels
const resealHotel = job({
  customer: mia, sector: 'hotels', title: 'Reseal showers in five guest rooms', trade: 'tiling',
  address: '47 Marine Tce, Fremantle WA 6160', budget: '2k-10k', timing: 'two-weeks', hours: 9,
  requirements: 'Rooms 104 to 108 can be blocked out Monday to Wednesday. Work between 10am and 3pm only. Sign in at reception and use the service lift.',
  description: 'Silicone has failed in five ensuites on the first floor and some grout is cracking. Rooms are about 15 years old. We need them back in service as quickly as possible.',
});
quote(resealHotel, russo, 2350, 'Remove all old silicone, regrout where cracked, and reseal with mould-resistant silicone in all five ensuites. I can do rooms 104 to 106 on the Monday and 107 to 108 on the Tuesday, and they can be used again 24 hours after each.', '2026-10-19', 'pending', 6);
quote(resealHotel, bayside, 2900, 'Reseal and touch up grout in five ensuites, including a quick repaint of any water-marked ceilings in the same rooms.', '2026-10-22', 'pending', 7);

const broome = job({
  customer: mia, sector: 'hotels', title: 'Air con not cooling in 12 rooms', trade: 'aircon',
  address: '1 Robinson St, Broome WA 6725', budget: '2k-10k', timing: 'urgent', days: 1,
  requirements: 'Rooms are occupied. Work room by room after checkout (10am) and finish by 2pm each day. Accommodation can be provided on site.',
  description: '12 split systems in the east wing are running but not cooling properly. Likely need a service and regas. Units are Daikin, about 6 years old.',
});

const lobby = job({
  customer: mia, sector: 'hotels', title: 'Repaint lobby and reception walls', trade: 'painting',
  address: '200 Hay St, Perth WA 6000', budget: '2k-10k', timing: 'month', days: 12,
  requirements: 'Overnight work only, 11pm to 6am, so guests are not disturbed. Low-odour paint please.',
  description: 'Lobby and reception area, about 180 square metres of wall, 4.2m ceiling height. Some scuffing and a few patched areas.',
});
const lobbyQ = quote(lobby, bayside, 7400, 'Overnight works across four nights. Low-odour, washable paint, with drop sheets and edges taped every night so the lobby is clean by 6am. Scaffold tower included.', '2026-10-05', 'pending', 240);
award(lobby, lobbyQ, true, false);

// Mining
const camp = job({
  customer: greg, sector: 'mining', title: 'Replace split systems in eight camp rooms', trade: 'aircon',
  address: 'Ironbark village camp, Newman WA 6753', budget: '10k-50k', timing: 'month', days: 1,
  requirements: 'Site induction required (half day, done on arrival). White Card, current medical, and drug and alcohol test on site. DIDO from Newman. Meals provided at the camp mess.',
  description: 'Eight 2.5kW split systems in Block C have failed. Remove and dispose of old units and supply and install like-for-like replacements. Existing pipework and power can be reused.',
});
quote(camp, pilbaraAir, 21600, 'Supply and install eight Mitsubishi Heavy Industries 2.5kW reverse cycle units on the existing pipework and power. Old units degassed and removed, refrigerant recovered. Two techs, three days on site. Already inducted at two Newman sites, so only the local induction is needed.', '2026-10-27', 'pending', 15);

const rails = job({
  customer: greg, sector: 'mining', title: 'Fabricate and install handrails on workshop mezzanine', trade: 'welding',
  address: 'Ironbark processing plant workshop, Kalgoorlie WA 6430', budget: '10k-50k', timing: 'month', days: 4,
  requirements: 'Site induction and a hot work permit required. Coded welder for structural welds. Work Monday to Friday, 6am to 5pm.',
  description: 'Approximately 26m of handrail and kick plate along the workshop mezzanine, to AS 1657. Engineering drawings available.',
});
quote(rails, redDirt, 18450, 'Fabricate in our workshop to the drawings, hot-dip galvanise, and install on site over two days with a two-person crew. Includes all hot work gear and fire watch.', '2026-11-10', 'pending', 70);

job({
  customer: greg, sector: 'mining', title: 'Ablution block plumbing repairs', trade: 'plumbing',
  address: 'Ironbark village camp, Karratha WA 6714', budget: '2k-10k', timing: 'two-weeks', hours: 30,
  requirements: 'Camp induction, White Card. Flights not provided. Accommodation provided at the camp for the duration.',
  description: 'Three toilets and two showers in the men\'s ablution block need repairs: leaking cisterns, a failed mixer and a slow drain.',
});

// Completed jobs with reviews
function completed(p, tradieId, dollars, message, rating, comment, reviewDaysAgo) {
  const id = job({ ...p, days: p.days || 30 });
  const q = quote(id, tradieId, dollars, message, null, 'pending', 24 * 28);
  award(id, q, true, true);
  if (rating) review(id, tradieId, p.customer, rating, comment, reviewDaysAgo);
  return id;
}

completed({ customer: tom, sector: 'housing', title: 'Retile laundry floor', trade: 'tiling', address: '3 Russell St, Morley WA 6062', budget: '500-2k', timing: 'month', description: 'Small laundry, around 6 square metres. Old lino needs to come up and be replaced with porcelain tiles.', days: 60 },
  russo, 1380, 'Remove lino, level the floor, and lay 600x600 porcelain with a skirting tile.', 5, "Dan was on time both days, left the laundry spotless and the floor looks great. He even fixed the dodgy door stop without charging. Would use again.", 50);
completed({ customer: leanne, sector: 'housing', title: 'Splashback in rental kitchen', trade: 'tiling', address: '18 Coode St, Mount Lawley WA 6050', budget: '500-2k', timing: 'two-weeks', description: 'Kitchen splashback about 3m long. Subway tiles. Property is vacant.', days: 45 },
  russo, 920, 'Supply-and-lay subway tile splashback with white grout and silicone to the benchtop.', 5, 'Quick, tidy and the price was exactly as quoted. Our go-to tiler for the rentals now.', 38);
completed({ customer: mia, sector: 'hotels', title: 'Pool surround tile repairs', trade: 'tiling', address: '47 Marine Tce, Fremantle WA 6160', budget: '500-2k', timing: 'urgent', description: 'Six loose tiles on the pool surround, a trip hazard.', requirements: 'Pool area closed from 7am to 11am only.', days: 40 },
  russo, 640, 'Lift and relay six loose tiles, regrout the surround.', 4, 'Good job and finished inside our closure window. Took a day longer to book in than hoped.', 33);
completed({ customer: sarah, sector: 'housing', title: 'Blocked kitchen drain', trade: 'plumbing', address: '14 Grand Promenade, Bayswater WA 6053', budget: 'under-500', timing: 'urgent', description: 'Kitchen sink not draining at all.', days: 25 },
  northside, 280, 'Jet the kitchen line, camera check to make sure it is clear.', 5, 'Priya came out the same afternoon and showed us the camera footage. Great communication.', 22);
completed({ customer: tom, sector: 'housing', title: 'Replace leaking toilet cistern', trade: 'plumbing', address: '7 Lakeside Dr, Joondalup WA 6027', budget: 'under-500', timing: 'two-weeks', description: 'Cistern runs constantly.', days: 70 },
  northside, 420, 'Replace inlet and outlet valves, new flush button.', 4, 'Fixed properly. Bit pricier than I expected but no complaints about the work.', 62);
completed({ customer: leanne, sector: 'housing', title: 'Smoke alarms for rental compliance', trade: 'electrical', address: '5 Rockingham Rd, Spearwood WA 6163', budget: 'under-500', timing: 'two-weeks', description: 'Need hardwired interconnected smoke alarms before the new lease.', days: 35 },
  coastline, 690, 'Supply and install three hardwired interconnected photoelectric alarms with a compliance certificate.', 5, 'Sorted with the tenant directly and sent the certificate the same day. Easy.', 29);
completed({ customer: greg, sector: 'mining', title: 'Service air con in site office', trade: 'aircon', address: 'Ironbark site office, Newman WA 6753', budget: '500-2k', timing: 'month', description: 'Service six split systems in the site office.', requirements: 'Site induction required. Day trip DIDO.', days: 55 },
  pilbaraAir, 1240, 'Clean and service six units, check gas pressures, and report on condition.', 5, 'Already had his inductions and tickets, so there was no messing around getting on site. Thorough report afterwards.', 48);
completed({ customer: sarah, sector: 'housing', title: 'Repaint front fence and gate', trade: 'painting', address: '14 Grand Promenade, Bayswater WA 6053', budget: '500-2k', timing: 'month', description: 'Picket fence and gate, about 20m.', days: 80 },
  bayside, 1150, 'Sand, spot prime and two coats on the fence and gate.', 5, 'Looks brand new. Kate kept me updated the whole way through.', 71);


// ---- Teams ----
function member(accountId, email, name, role, kind, extra = {}) {
  const id = user(email, name, extra.phone || null, kind, extra.company || null);
  if (kind === 'admin') db.prepare("UPDATE users SET admin_level = 'support' WHERE id = ?").run(id);
  db.prepare("INSERT INTO team_members (account_id, user_id, email, name, role, status) VALUES (?, ?, ?, ?, ?, 'active')")
    .run(accountId, id, email, name, role);
  return id;
}
const luca = member(russo, 'luca@demo.local', 'Luca Russo', 'worker', 'tradie', { phone: '0411 222 333' });
const ana = member(russo, 'ana@demo.local', 'Ana Silva', 'worker', 'tradie', { phone: '0411 444 555' });
member(russo, 'rosa@demo.local', 'Rosa Russo', 'manager', 'tradie');
member(mia, 'jess@demo.local', 'Jess Taylor', 'staff', 'customer', { company: 'Coastal Stays Group' });
member(admin, 'sam.support@demo.local', 'Sam Lee', 'support', 'admin');
db.prepare("INSERT INTO team_members (account_id, email, name, role, token) VALUES (?, 'marco@demo.local', 'Marco Bianchi', 'worker', 'demo-invite-token')").run(russo);

// ---- Job management for Russo Tiling ----
db.prepare("UPDATE tradie_profiles SET hourly_rate_cents = 9500, gst_registered = 1, invoice_prefix = 'RT-', payment_details = ? WHERE user_id = ?")
  .run('Bank transfer to Russo Tiling & Waterproofing, BSB 016-123, account 4455 6677. Please use the invoice number as the reference.', russo);

const perth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Perth' }).format(new Date());
const dayOffset = (n) => {
  const d = new Date(perth() + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// Monday of this week, so the schedule always has something on it.
const monday = (() => { const d = new Date(perth() + 'T00:00:00Z'); return dayOffset(-((d.getUTCDay() + 6) % 7)); })();
const weekDay = (i) => { const d = new Date(monday + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); };

function work(p) {
  const id = Number(db.prepare(`
    INSERT INTO work_orders (account_id, source, title, client_name, client_phone, client_email, address, description, price_cents, status, assigned_to, scheduled_date, scheduled_time)
    VALUES (@account, 'private', @title, @client, @phone, @email, @address, @description, @price, @status, @assigned, @date, @time)`)
    .run({ account: russo, phone: null, email: null, description: null, price: null, assigned: null, date: null, time: null, ...p }).lastInsertRowid);
  return id;
}
const note = (w, u, body) => db.prepare('INSERT INTO work_notes (work_id, user_id, body) VALUES (?, ?, ?)').run(w, u, body);
const hours = (w, u, date, minutes, n = null) => db.prepare('INSERT INTO time_entries (work_id, user_id, work_date, minutes, note) VALUES (?, ?, ?, ?, ?)').run(w, u, date, minutes, n);
const cost = (w, u, d, dollars) => db.prepare('INSERT INTO work_costs (work_id, user_id, description, amount_cents) VALUES (?, ?, ?, ?)').run(w, u, d, Math.round(dollars * 100));

const ensuite = work({ title: 'Retile ensuite floor and shower', client: 'Helen Park', phone: '0422 987 654', email: 'helen.park@example.com',
  address: '21 Alexander Dr, Menora WA 6050', description: 'Ensuite about 2.1m x 1.6m. Lift existing tiles, re-waterproof the shower, lay 600x300 porcelain. Client supplying tiles.',
  price: 3850 * 100, status: 'in_progress', assigned: luca, date: weekDay(1), time: '07:00' });
hours(ensuite, luca, weekDay(0), 360, 'Demo, cleared old tiles and bedding');
hours(ensuite, luca, weekDay(1), 300, 'Screed and waterproofing');
cost(ensuite, luca, 'Waterproofing membrane and primer', 186.4);
cost(ensuite, luca, 'Tile adhesive, 6 bags', 132);
note(ensuite, luca, "Old screed was cracked near the waste, so I've redone that section. Membrane is curing, tiling tomorrow.");
note(ensuite, russo, 'Helen will leave the key in the lockbox, code 4821.');

const kitchen = work({ title: 'Kitchen splashback', client: 'Greenline Property', phone: '08 9201 4455', email: 'maintenance@example.com',
  address: '9 Oxford St, Leederville WA 6007', description: 'Subway tile splashback, 3.2m. Unit is tenanted, call the tenant on arrival.',
  status: 'scheduled', assigned: ana, date: weekDay(3), time: '08:30' });

work({ title: 'Quote visit: alfresco tiling', client: 'Mark Ellis', phone: '0433 765 432', address: '14 Waterford Way, Ellenbrook WA 6069',
  description: 'About 40 square metres of outdoor tiling. Wants a price on travertine and porcelain.', status: 'scheduled', assigned: russo, date: weekDay(2), time: '15:00' });

work({ title: 'Regrout pool steps', client: 'Coral Bay Apartments', address: '30 West Coast Hwy, Scarborough WA 6019', status: 'new' });

const laundry = work({ title: 'Laundry floor tiles', client: 'Priya Desai', phone: '0455 123 987', email: 'priya.d@example.com',
  address: '6 Ivy St, Inglewood WA 6052', status: 'invoiced', assigned: ana, date: dayOffset(-9), time: '07:30' });
hours(laundry, ana, dayOffset(-9), 420, 'Lifted vinyl, levelled, tiled');
cost(laundry, ana, 'Porcelain tiles, 7 sqm', 315);
cost(laundry, ana, 'Levelling compound', 58);

const invoice = (workId, number, status, issued, due, lines) => {
  const id = Number(db.prepare('INSERT INTO invoices (account_id, work_id, number, issued_on, due_on, gst, status, paid_on) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
    .run(russo, workId, number, issued, due, status, status === 'paid' ? due : null).lastInsertRowid);
  lines.forEach(([d, qty, price], i) => db.prepare('INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price_cents, position) VALUES (?, ?, ?, ?, ?)').run(id, d, qty, Math.round(price * 100), i));
};
invoice(laundry, 'RT-0002', 'sent', dayOffset(-8), dayOffset(6), [['Labour', 7, 95], ['Porcelain tiles, 7 sqm', 1, 315], ['Levelling compound', 1, 58]]);

const bathroom = work({ title: 'Bathroom wall tiles', client: 'Chris Walker', address: '2 Lord St, Bassendean WA 6054', status: 'paid', assigned: luca, date: dayOffset(-21) });
hours(bathroom, luca, dayOffset(-21), 480);
invoice(bathroom, 'RT-0001', 'paid', dayOffset(-20), dayOffset(-6), [['Wall tiling, main bathroom', 1, 2400]]);

console.log(`Demo data loaded:
  ${db.prepare('SELECT COUNT(*) n FROM tradie_profiles').get().n} tradie businesses, ${db.prepare('SELECT COUNT(*) n FROM jobs').get().n} jobs, ${db.prepare('SELECT COUNT(*) n FROM quotes').get().n} quotes, ${db.prepare('SELECT COUNT(*) n FROM reviews').get().n} reviews

Log in with any of these (password: password123):
  admin@demo.local      admin
  sarah@demo.local      homeowner
  mia@demo.local        hotel group (Coastal Stays Group)
  greg@demo.local       mining company (Ironbark Minerals)
  leanne@demo.local     property manager
  dan@demo.local        tiler (Russo Tiling & Waterproofing)
  tom.kerr@demo.local   Pilbara air con tradie

Team logins:
  rosa@demo.local       manager at Russo Tiling
  luca@demo.local       worker at Russo Tiling (sees only his jobs)
  jess@demo.local       staff at Coastal Stays Group (can't accept quotes)
  sam.support@demo.local  Tradebench support staff (can't move money)`);
