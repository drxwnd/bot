// End-to-end walk through the whole job flow using simulated payments.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tradebench-test-'));
process.env.DATA_DIR = tmp;
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.STRIPE_SECRET_KEY = '';
process.env.ADMIN_EMAIL = 'boss@test.local';

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

// Minimal browser: keeps cookies and pulls the CSRF token out of pages.
function browser() {
  let cookies = {};
  let csrf = null;
  async function req(method, url, body) {
    const headers = { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') };
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      payload = new URLSearchParams({ _csrf: csrf, ...body }).toString();
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
    get: (url) => req('GET', url),
    post: (url, body) => req('POST', url, body),
    form: (url, fields) => {
      const fd = new FormData();
      fd.set('_csrf', csrf);
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      return req('POST', url, fd);
    },
  };
}

async function signup(b, as, name, email) {
  await b.get('/signup' + (as === 'tradie' ? '?as=tradie' : ''));
  const res = await b.post('/signup', { as, name, email, phone: '0400 123 456', password: 'longpassword' });
  assert.strictEqual(res.status, 302, 'signup should redirect');
}

test('customer posts, tradie quotes, customer pays and releases', async () => {
  const admin = browser();
  const customer = browser();
  const tradie = browser();

  await signup(admin, 'customer', 'Boss', 'boss@test.local');
  await signup(customer, 'customer', 'Casey Customer', 'casey@test.local');
  await signup(tradie, 'tradie', 'Terry Tiler', 'terry@test.local');

  // CSRF is enforced.
  const forged = await customer.post('/jobs/1/cancel', { _csrf: 'nope' });
  assert.strictEqual(forged.status, 403);

  // Tradie fills in business details (bad ABN first).
  await tradie.get('/dashboard/profile');
  const profileFields = {
    name: 'Terry Tiler', phone: '0400 123 456', business_name: 'Terry Tiles', abn: '12 345 678 901',
    sectors: 'housing', trades: 'tiling', regions: 'eastern', insurer: 'QBE', insurance_expiry: '2027-01-01', years_trading: '12',
  };
  let res = await tradie.post('/dashboard/profile', profileFields);
  assert.match(res.text, /ABN doesn&#39;t look right/);
  res = await tradie.post('/dashboard/profile', { ...profileFields, abn: '51 824 753 556' });
  assert.strictEqual(res.status, 302);

  // Customer posts a job with a photo.
  await customer.get('/jobs/new');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  res = await customer.form('/jobs', {
    sector: 'housing', title: 'Regrout shower', trade: 'tiling', suburb: 'Bayswater', postcode: '6053', region: 'eastern',
    address: '1 Test St', description: 'Shower grout cracking and four floor tiles need replacing.',
    budget: '500-2k', timing: 'two-weeks', photos: new Blob([png], { type: 'image/png' }),
  });
  assert.strictEqual(res.status, 302);
  const jobUrl = res.location;
  const jobId = Number(jobUrl.split('/').pop());
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM job_photos WHERE job_id = ?').get(jobId).n, 1);

  // Mining jobs must say what's needed to get on site.
  await customer.get('/jobs/new?sector=mining');
  const miningJob = {
    sector: 'mining', title: 'Replace air con in six camp rooms', trade: 'aircon', suburb: 'Newman',
    postcode: '6753', region: 'pilbara', description: 'Six split systems in the camp have failed and need replacing.',
    budget: '10k-50k', timing: 'month',
  };
  res = await customer.form('/jobs', miningJob);
  assert.strictEqual(res.status, 400);
  assert.match(res.text, /site requirements/);
  res = await customer.form('/jobs', { ...miningJob, requirements_mining: 'Site induction, White Card. DIDO from Newman.' });
  assert.strictEqual(res.status, 302);
  const miningUrl = res.location;
  res = await browser().get(miningUrl);
  assert.match(res.text, /DIDO from Newman/);
  res = await browser().get('/jobs?sector=mining');
  assert.match(res.text, /camp rooms/);
  assert.doesNotMatch(res.text, /Regrout shower/);
  for (const page of ['/housing', '/hotels', '/mining']) {
    assert.strictEqual((await browser().get(page)).status, 200);
  }

  // Public board shows it, but not the private address.
  res = await browser().get('/jobs');
  assert.match(res.text, /Regrout shower/);
  res = await browser().get(jobUrl);
  assert.doesNotMatch(res.text, /1 Test St/);

  // Unapproved tradie can't quote.
  await tradie.get(jobUrl);
  res = await tradie.post(`${jobUrl}/quotes`, { amount: '850', message: 'Regrout and replace tiles, two days.' });
  assert.strictEqual(res.location, '/dashboard');

  // Admin approves.
  await admin.get('/admin');
  const tradieId = db.prepare("SELECT id FROM users WHERE email = 'terry@test.local'").get().id;
  res = await admin.post(`/admin/tradies/${tradieId}/approve`, {});
  assert.strictEqual(res.status, 302);

  // Tradie quotes.
  await tradie.get(jobUrl);
  res = await tradie.post(`${jobUrl}/quotes`, { amount: '$1,000', message: 'Regrout and replace tiles, two days.' });
  assert.strictEqual(res.status, 302);
  const quote = db.prepare('SELECT * FROM quotes WHERE job_id = ?').get(jobId);
  assert.strictEqual(quote.amount_cents, 100000);

  // Another customer can't accept it.
  const stranger = browser();
  await signup(stranger, 'customer', 'Sam Stranger', 'sam@test.local');
  await stranger.get('/jobs');
  await stranger.post(`/quotes/${quote.id}/accept`, {});
  assert.strictEqual(db.prepare('SELECT status FROM jobs WHERE id = ?').get(jobId).status, 'open');

  // Customer accepts and sees contact details; tradie sees the address.
  res = await customer.get(jobUrl);
  assert.match(res.text, /Terry Tiles/);
  await customer.post(`/quotes/${quote.id}/accept`, {});
  res = await customer.get(jobUrl);
  assert.match(res.text, /terry@test\.local/);
  res = await tradie.get(jobUrl);
  assert.match(res.text, /1 Test St/);

  // Customer pays (simulated). Money held.
  res = await customer.get(jobUrl);
  res = await customer.post(`${jobUrl}/pay`, {});
  assert.strictEqual(res.status, 303);
  let payment = db.prepare('SELECT * FROM payments WHERE job_id = ?').get(jobId);
  assert.strictEqual(payment.status, 'held');
  assert.strictEqual(payment.fee_cents, 4000);

  // Release blocked until the tradie sets up payouts.
  await customer.get(jobUrl);
  await customer.post(`${jobUrl}/release`, {});
  assert.strictEqual(db.prepare('SELECT status FROM payments WHERE job_id = ?').get(jobId).status, 'held');

  await tradie.get('/dashboard/payouts');
  await tradie.post('/dashboard/payouts/start', {});
  await customer.get(jobUrl);
  await customer.post(`${jobUrl}/release`, {});
  payment = db.prepare('SELECT * FROM payments WHERE job_id = ?').get(jobId);
  assert.strictEqual(payment.status, 'released');
  assert.strictEqual(db.prepare('SELECT status FROM jobs WHERE id = ?').get(jobId).status, 'completed');

  // Review shows on the public profile.
  await customer.get(jobUrl);
  await customer.post(`${jobUrl}/review`, { rating: '5', comment: 'Tidy work, on time.' });
  res = await browser().get(`/tradies/${tradieId}`);
  assert.match(res.text, /Tidy work, on time\./);

  // Admin totals reflect the 4% fee.
  res = await admin.get('/admin');
  assert.match(res.text, /\$40\.00/);
});
