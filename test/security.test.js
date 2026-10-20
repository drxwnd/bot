// Attacks from the pre-launch security review, each tried against the running app.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tradebench-sec-'));
process.env.DATA_DIR = tmp;
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.STRIPE_SECRET_KEY = '';
process.env.ADMIN_EMAIL = 'boss@test.local';

const sharp = require('sharp');
const app = require('../server');
const db = require('../src/db');

let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

function browser() {
  const cookies = {};
  let csrf = null;
  async function req(method, url, body, headers = {}) {
    headers = { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '), ...headers };
    let payload;
    if (body instanceof FormData || typeof body === 'string') payload = body;
    else if (body) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      const params = new URLSearchParams({ _csrf: csrf });
      for (const [k, v] of Object.entries(body)) for (const item of [].concat(v)) params.append(k, item);
      payload = params.toString();
    }
    const res = await fetch(base + url, { method, headers, body: payload, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      cookies[pair.slice(0, i)] = pair.slice(i + 1);
    }
    const text = await res.text();
    const m = text.match(/name="_csrf" value="([a-f0-9]+)"/);
    if (m) csrf = m[1];
    return { status: res.status, location: res.headers.get('location'), text };
  }
  return {
    cookies,
    get csrf() { return csrf; },
    get: (u) => req('GET', u),
    post: (u, b = {}) => req('POST', u, b),
    raw: (u, body, headers) => req('POST', u, body, headers),
    form: (u, fields, files = []) => {
      const fd = new FormData();
      fd.set('_csrf', csrf);
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      for (const [k, buf, name] of files) fd.append(k, new Blob([buf], { type: 'image/jpeg' }), name);
      return req('POST', u, fd);
    },
  };
}

async function signup(b, as, name, email) {
  await b.get('/signup' + (as === 'tradie' ? '?as=tradie' : ''));
  const res = await b.post('/signup', { as, name, email, phone: '0400 123 456', password: 'longpassword' });
  assert.strictEqual(res.status, 302, `signup ${email}`);
}
const one = (sql, ...a) => db.prepare(sql).get(...a);

let admin, customer, tiler, jobId;

test('setup: admin, an approved tiler and a posted job', async () => {
  admin = browser();
  await signup(admin, 'customer', 'Boss', 'boss@test.local');
  tiler = browser();
  await signup(tiler, 'tradie', 'Tia', 'tia@test.local');
  await tiler.get('/dashboard/profile');
  await tiler.post('/dashboard/profile', {
    name: 'Tia', phone: '0400 123 456', business_name: 'Tia Tiles', abn: '51 824 753 556', sectors: 'housing',
    trades: 'tiling', regions: 'north-east', insurer: 'QBE', insurance_expiry: '2030-01-01',
  });
  const tid = one("SELECT id FROM users WHERE email = 'tia@test.local'").id;
  await admin.get('/admin');
  await admin.post(`/admin/tradies/${tid}/approve`);
  assert.strictEqual(one('SELECT status FROM tradie_profiles WHERE user_id = ?', tid).status, 'approved');

  customer = browser();
  await signup(customer, 'customer', 'Cleo', 'cleo@test.local');
  await customer.get('/jobs/new?trade=tiling');
  const res = await customer.form('/jobs', {
    sector: 'housing', title: 'Replace cracked tiles', trade: 'tiling', address: '1 Test St, Bayswater WA 6053',
    description: 'Two cracked floor tiles in the kitchen, spares in the shed.', budget: '500-2k', timing: 'flexible',
  });
  jobId = Number(res.location.split('/').pop());
  assert.ok(jobId);
});

test('a multipart POST cannot skip the CSRF check', async () => {
  await tiler.get(`/jobs/${jobId}`);
  await tiler.post(`/jobs/${jobId}/quotes`, { amount: '300', message: 'Cut out and replace both tiles, regrout.' });
  const quote = one('SELECT * FROM quotes WHERE job_id = ?', jobId);
  const res = await customer.raw(`/quotes/${quote.id}/accept`, '--X\r\n\r\n--X--\r\n', { 'content-type': 'multipart/form-data; boundary=X' });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(one('SELECT status FROM jobs WHERE id = ?', jobId).status, 'open');
});

test('accepting checks the price the customer saw', async () => {
  const quote = one('SELECT * FROM quotes WHERE job_id = ?', jobId);
  await customer.get(`/jobs/${jobId}`);
  await customer.post(`/quotes/${quote.id}/accept`, { amount_cents: '1000' });
  assert.strictEqual(one('SELECT status FROM jobs WHERE id = ?', jobId).status, 'open');
});

test("a tradie can't quote outside their trade, or below the minimum", async () => {
  await customer.get('/jobs/new?trade=plumbing');
  const res = await customer.form('/jobs', {
    sector: 'housing', title: 'Fix dripping tap', trade: 'plumbing', address: '1 Test St, Bayswater WA 6053',
    description: 'Kitchen mixer drips constantly, needs a new cartridge.', budget: 'under-500', timing: 'flexible',
  });
  const plumbingJob = Number(res.location.split('/').pop());
  await tiler.get(`/jobs/${plumbingJob}`);
  await tiler.post(`/jobs/${plumbingJob}/quotes`, { amount: '200', message: 'I can do this for you this week.' });
  assert.strictEqual(one('SELECT COUNT(*) AS n FROM quotes WHERE job_id = ?', plumbingJob).n, 0);

  await tiler.get(`/jobs/${jobId}`);
  await tiler.post(`/jobs/${jobId}/quotes`, { amount: '0.01', message: 'Cut out and replace both tiles, regrout.' });
  assert.strictEqual(one('SELECT amount_cents FROM quotes WHERE job_id = ?', jobId).amount_cents, 30000);
});

test('changing insurance or trades after approval sends the tradie back for checking', async () => {
  const tid = one("SELECT id FROM users WHERE email = 'tia@test.local'").id;
  await tiler.get('/dashboard/profile');
  await tiler.post('/dashboard/profile', {
    name: 'Tia', phone: '0400 123 456', business_name: 'Tia Tiles', abn: '51 824 753 556', sectors: 'housing',
    trades: ['tiling', 'electrical'], regions: 'north-east', insurer: 'QBE', insurance_expiry: '2030-01-01',
  });
  assert.strictEqual(one('SELECT status FROM tradie_profiles WHERE user_id = ?', tid).status, 'pending');
  await admin.get('/admin');
  await admin.post(`/admin/tradies/${tid}/approve`);
});

test('login redirects never leave the site', async () => {
  const b = browser();
  await signup(b, 'customer', 'Red', 'red@test.local');
  for (const next of ['/\\evil.com', '//evil.com', '/%5Cevil.com', 'https://evil.com']) {
    const fresh = browser();
    await fresh.get('/login');
    const res = await fresh.post('/login', { email: 'red@test.local', password: 'longpassword', next });
    assert.ok(res.location.startsWith('/') && !res.location.startsWith('//') && !res.location.includes('\\'), `${next} -> ${res.location}`);
    assert.ok(!/evil/.test(new URL(res.location, base).host));
  }
});

test("a removed team member's login stops working, and their id is never reused", async () => {
  const owner = browser();
  await signup(owner, 'customer', 'Mia', 'mia@test.local');
  await owner.get('/team');
  await owner.post('/team/invite', { name: 'Jess', email: 'jess@test.local', role: 'staff' });
  const token = (await owner.get('/team')).text.match(/\/invite\/([A-Za-z0-9_-]+)/)[1];
  const jess = browser();
  await jess.get(`/invite/${token}`);
  await jess.post(`/invite/${token}`, { name: 'Jess', password: 'longpassword' });
  assert.strictEqual((await jess.get('/dashboard')).status, 200);
  const jessId = one("SELECT id FROM users WHERE email = 'jess@test.local'").id;

  const memberId = one("SELECT id FROM team_members WHERE email = 'jess@test.local'").id;
  await owner.get('/team');
  await owner.post(`/team/${memberId}/remove`);
  const res = await jess.get('/dashboard');
  assert.strictEqual(res.status, 302, 'old session no longer logged in');

  // A brand new sign-up gets a new id, and the old cookie still doesn't log in as anyone.
  const newbie = browser();
  await signup(newbie, 'customer', 'Newbie', 'newbie@test.local');
  assert.notStrictEqual(one("SELECT id FROM users WHERE email = 'newbie@test.local'").id, jessId);
  assert.strictEqual((await jess.get('/dashboard')).status, 302);

  // And they can't get back in with a password reset.
  await jess.get('/forgot');
  await jess.post('/forgot', { email: 'jess@test.local' });
  assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM emails WHERE to_email = 'jess@test.local' AND kind = 'password_reset'").get().n, 0);
});

test('uploads: fake images are refused and location data is stripped', async () => {
  const gpsPhoto = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#a0522d' } })
    .withExif({ IFD0: { Make: 'TestPhone', Copyright: 'secret-location' } })
    .jpeg()
    .toBuffer();
  assert.ok((await sharp(gpsPhoto).metadata()).exif, 'test photo has EXIF');

  await customer.get('/jobs/new?trade=tiling');
  const res = await customer.form(
    '/jobs',
    {
      sector: 'housing', title: 'Regrout the laundry', trade: 'tiling', address: '1 Test St, Bayswater WA 6053',
      description: 'Laundry floor grout is crumbling in a few places.', budget: 'under-500', timing: 'flexible',
    },
    [['photos', gpsPhoto, 'real.jpg'], ['photos', Buffer.from('<html><script>alert(1)</script></html>'), 'fake.jpg']],
  );
  const id = Number(res.location.split('/').pop());
  const photos = db.prepare('SELECT filename FROM job_photos WHERE job_id = ?').all(id);
  assert.strictEqual(photos.length, 1, 'the fake one was dropped');
  const saved = fs.readFileSync(path.join(process.env.UPLOAD_DIR, photos[0].filename));
  const meta = await sharp(saved).metadata();
  assert.strictEqual(meta.format, 'jpeg');
  assert.ok(!meta.exif, 'EXIF removed');
  assert.ok(fs.existsSync(path.join(process.env.UPLOAD_DIR, photos[0].filename.replace('.jpg', '-sm.jpg'))), 'thumbnail made');
});

test("odd input (multibyte tokens) is refused instead of crashing", async () => {
  const res = await admin.raw('/login', '_csrf=%E2%82%AC%E2%82%AC', { 'content-type': 'application/x-www-form-urlencoded' });
  assert.strictEqual(res.status, 403);
  const u = await browser().get('/unsubscribe?u=1&t=%E2%82%AC%E2%82%AC%E2%82%AC%E2%82%AC%E2%82%AC%E2%82%AC%E2%82%AC%E2%82%AC');
  assert.strictEqual(u.status, 404);
});

test('form options must be real ones, not built-in object names', async () => {
  const before = one('SELECT COUNT(*) AS n FROM jobs').n;
  await customer.get('/jobs/new?trade=tiling');
  const res = await customer.form('/jobs', {
    sector: 'constructor', title: 'Odd job here', trade: 'constructor', address: '1 Test St, Bayswater WA 6053',
    description: 'Checking that made-up options are refused properly.', budget: 'toString', timing: '__proto__',
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(one('SELECT COUNT(*) AS n FROM jobs').n, before);
  for (const u of [
    '/jobs?trade=constructor', '/jobs?trade=tiling&trade=plumbing', '/jobs/new?trade=constructor&sector=__proto__',
    '/start?path=need&who=constructor', '/start?path=tradie&trades=constructor,hasOwnProperty',
    '/start?path=need&who=home&trade=plumbing&timing=urgent&region=__proto__', '/dashboard/jobs?tab=constructor',
  ]) {
    assert.strictEqual((await customer.get(u)).status, 200, u);
  }
});

test('contact details are kept out of what others see before payment', async () => {
  const { hasContactDetails } = require('../src/helpers');
  for (const t of ['call 0412 345 678', '+61 412 345 678', '(08) 9123 4567', '1300 123 456', 'tia@tiatiles.com.au', 'tia @ gmail . com', 'www.tiatiles.com', 'tiatiles.com.au']) {
    assert.ok(hasContactDetails(t), t);
  }
  for (const t of ['Price is $1,250 inc GST', 'Start 2026-10-14', 'ABN 51 824 753 556', 'Supply 20 tiles @ 45. Labour extra', 'Available 04/11/2026', '24/7 Plumbing']) {
    assert.ok(!hasContactDetails(t), t);
  }

  await customer.get('/jobs/new?trade=tiling');
  let res = await customer.form('/jobs', {
    sector: 'housing', title: 'Regrout the ensuite', trade: 'tiling', address: '1 Test St, Bayswater WA 6053',
    description: 'Grout is cracking around the shower base, call me on 0412 345 678.', budget: 'under-500', timing: 'flexible',
  });
  assert.strictEqual(res.status, 400);
  assert.match(res.text, /Take out phone numbers/);

  const tid = one("SELECT id FROM users WHERE email = 'tia@test.local'").id;
  await tiler.get(`/jobs/${jobId}`);
  await tiler.post(`/jobs/${jobId}/quotes`, { amount: '320', message: 'Happy to help, email me at tia@tiatiles.com.au' });
  assert.strictEqual(one('SELECT amount_cents FROM quotes WHERE job_id = ? AND tradie_id = ?', jobId, tid).amount_cents, 30000);

  await tiler.get('/dashboard/profile');
  res = await tiler.post('/dashboard/profile', {
    name: 'Tia', phone: '0400 123 456', business_name: 'Tia Tiles', abn: '51 824 753 556', sectors: 'housing',
    trades: ['tiling', 'electrical'], regions: 'north-east', insurer: 'QBE', insurance_expiry: '2030-01-01', bio: 'More at www.tiatiles.com.au',
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(one('SELECT bio FROM tradie_profiles WHERE user_id = ?', tid).bio, null);
});

test('one account can only post so many jobs a day', async () => {
  const cid = one("SELECT id FROM users WHERE email = 'cleo@test.local'").id;
  const have = one("SELECT COUNT(*) AS n FROM jobs WHERE customer_id = ? AND created_at > datetime('now', '-1 day')", cid).n;
  const add = db.prepare(`
    INSERT INTO jobs (customer_id, sector, title, trade, suburb, postcode, region, description, budget, timing)
    VALUES (?, 'housing', 'Filler job', 'tiling', 'Bayswater', '6053', 'north-east', 'Filler', 'under-500', 'flexible')`);
  for (let i = have; i < 10; i++) add.run(cid);
  await customer.get('/jobs/new?trade=tiling');
  const res = await customer.form('/jobs', {
    sector: 'housing', title: 'One job too many', trade: 'tiling', address: '1 Test St, Bayswater WA 6053',
    description: 'This one should be over the daily limit for the account.', budget: 'under-500', timing: 'flexible',
  });
  assert.strictEqual(res.status, 400);
  assert.match(res.text, /daily limit/);
});

test('reset emails to one address are capped, however many people ask', async () => {
  const b = browser();
  await signup(b, 'customer', 'Rae', 'rae@test.local');
  for (let i = 0; i < 5; i++) {
    const f = browser();
    await f.get('/forgot');
    await f.raw('/forgot', new URLSearchParams({ _csrf: f.csrf, email: 'rae@test.local' }).toString(), {
      'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': `10.0.0.${i + 1}`,
    });
  }
  await require('../src/mailer').flush();
  assert.strictEqual(one("SELECT COUNT(*) AS n FROM emails WHERE to_email = 'rae@test.local' AND kind = 'password_reset'").n, 3);
});

test("a manager can't change the owner's contact number", async () => {
  await tiler.get('/team');
  await tiler.post('/team/invite', { name: 'Ros', email: 'ros@test.local', role: 'manager' });
  const token = (await tiler.get('/team')).text.match(/\/invite\/([A-Za-z0-9_-]+)/)[1];
  const ros = browser();
  await ros.get(`/invite/${token}`);
  await ros.post(`/invite/${token}`, { name: 'Ros', password: 'longpassword' });
  await ros.get('/dashboard/profile');
  await ros.post('/dashboard/profile', {
    name: 'Ros', phone: '0499 999 999', business_name: 'Tia Tiles', abn: '51 824 753 556', sectors: 'housing',
    trades: ['tiling', 'electrical'], regions: 'north-east', insurer: 'QBE', insurance_expiry: '2030-01-01',
  });
  const owner = one("SELECT name, phone FROM users WHERE email = 'tia@test.local'");
  assert.strictEqual(owner.phone, '0400 123 456');
  assert.strictEqual(owner.name, 'Tia');
});

test('an image claiming to be enormous is refused before it is decoded', async () => {
  const zlib = require('zlib');
  const uploads = require('../src/uploads');
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#ffffff' } }).png().toBuffer();
  // Rewrite the PNG header to say 9,000 x 9,000 pixels (81 megapixels), with a matching checksum.
  png.writeUInt32BE(9000, 16);
  png.writeUInt32BE(9000, 20);
  png.writeUInt32BE(zlib.crc32(png.subarray(12, 29)), 29);
  await assert.rejects(uploads.save({ buffer: png }), /pixel limit/);
});

test('only real photo formats reach the image decoders, whatever the file says it is', async () => {
  const uploads = require('../src/uploads');
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
  const tiff = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#ffffff' } }).tiff().toBuffer();
  await assert.rejects(uploads.save({ buffer: svg, mimetype: 'image/jpeg' }), /Not a photo/);
  await assert.rejects(uploads.save({ buffer: tiff, mimetype: 'image/jpeg' }), /Not a photo/);
  for (const make of [(s) => s.jpeg(), (s) => s.png(), (s) => s.webp()]) {
    const buf = await make(sharp({ create: { width: 10, height: 10, channels: 3, background: '#ffffff' } })).toBuffer();
    assert.ok(uploads.isPhoto(buf));
  }
});

test('password guessing on one account is slowed down across many addresses', async () => {
  let res;
  for (let i = 0; i < 31; i++) {
    const f = browser();
    await f.get('/login');
    res = await f.raw('/login', new URLSearchParams({ _csrf: f.csrf, email: 'red@test.local', password: `wrong${i}` }).toString(), {
      'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': `10.1.${i}.1`,
    });
  }
  assert.strictEqual(res.status, 429);
});
