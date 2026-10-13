// Teams, roles and job management: invites, what each role can and can't do, timesheets,
// costs and invoices.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tradebench-team-'));
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

function browser() {
  const cookies = {};
  let csrf = null;
  async function req(method, url, body) {
    const headers = { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') };
    let payload;
    if (body instanceof FormData) payload = body;
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
    get: (u) => req('GET', u),
    post: (u, b = {}) => req('POST', u, b),
    form: (u, fields) => {
      const fd = new FormData();
      fd.set('_csrf', csrf);
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      return req('POST', u, fd);
    },
  };
}

async function signup(b, as, name, email, extra = {}) {
  await b.get('/signup' + (as === 'tradie' ? '?as=tradie' : ''));
  const res = await b.post('/signup', { as, name, email, phone: '0400 123 456', password: 'longpassword', ...extra });
  assert.strictEqual(res.status, 302);
}

async function invite(owner, name, email, role) {
  await owner.get('/team');
  let res = await owner.post('/team/invite', { name, email, role });
  assert.strictEqual(res.location, '/team');
  res = await owner.get('/team');
  const token = res.text.match(/\/invite\/([A-Za-z0-9_-]+)/)[1];
  const person = browser();
  res = await person.get(`/invite/${token}`);
  assert.match(res.text, /Join/);
  res = await person.post(`/invite/${token}`, { name, password: 'longpassword' });
  assert.strictEqual(res.status, 302);
  return person;
}

const id = (sql, ...args) => db.prepare(sql).get(...args);

test('tradie business: owner, worker and job management', async () => {
  const admin = browser();
  await signup(admin, 'customer', 'Boss', 'boss@test.local');

  // Tradie owner sets up and is approved.
  const owner = browser();
  await signup(owner, 'tradie', 'Dan Russo', 'dan@test.local');
  await owner.get('/dashboard/profile');
  await owner.post('/dashboard/profile', {
    name: 'Dan Russo', phone: '0400 123 456', business_name: 'Russo Tiling', abn: '51 824 753 556',
    sectors: 'housing', trades: 'tiling', regions: 'eastern', insurer: 'QBE', insurance_expiry: '2027-01-01',
  });
  const ownerId = id("SELECT id FROM users WHERE email = 'dan@test.local'").id;
  await admin.get('/admin');
  await admin.post(`/admin/tradies/${ownerId}/approve`);

  // Owner invites a worker. The worker gets a login tied to the business.
  const worker = await invite(owner, 'Luca', 'luca@test.local', 'worker');
  const workerId = id("SELECT id FROM users WHERE email = 'luca@test.local'").id;
  assert.strictEqual(id('SELECT account_id FROM team_members WHERE user_id = ?', workerId).account_id, ownerId);

  // Customer posts, owner quotes, customer accepts.
  const customer = browser();
  await signup(customer, 'customer', 'Sarah', 'sarah@test.local');
  await customer.get('/jobs/new?trade=tiling');
  let res = await customer.form('/jobs', {
    sector: 'housing', title: 'Regrout shower', trade: 'tiling', address: '1 Test St, Bayswater WA 6053',
    description: 'Shower grout cracking and four floor tiles need replacing.', budget: '500-2k', timing: 'two-weeks',
  });
  const jobId = Number(res.location.split('/').pop());
  await owner.get(`/jobs/${jobId}`);
  await owner.post(`/jobs/${jobId}/quotes`, { amount: '845', message: 'Regrout and replace the cracked tiles.' });
  const quoteId = id('SELECT id FROM quotes WHERE job_id = ?', jobId).id;
  await customer.get(`/jobs/${jobId}`);
  await customer.post(`/quotes/${quoteId}/accept`, { amount_cents: String(id('SELECT amount_cents FROM quotes WHERE id = ?', quoteId).amount_cents) });

  // Not in Work until it's paid: the work order carries the customer's contact details.
  res = await owner.get('/work');
  assert.doesNotMatch(res.text, /Regrout shower/);
  await customer.get(`/jobs/${jobId}`);
  await customer.post(`/jobs/${jobId}/pay`);

  // The won job shows up in Work automatically once paid.
  res = await owner.get('/work');
  assert.match(res.text, /Regrout shower/);
  const work = id('SELECT * FROM work_orders WHERE job_id = ?', jobId);
  assert.ok(work);
  assert.strictEqual(work.price_cents, 84500);

  // Worker can't see it until it's assigned.
  res = await worker.get(`/work/${work.id}`);
  assert.strictEqual(res.status, 404);

  await owner.get(`/work/${work.id}`);
  await owner.post(`/work/${work.id}`, { status: 'scheduled', assigned_to: String(workerId), scheduled_date: '2026-10-20', scheduled_time: '07:30' });

  // Worker: dashboard goes to their jobs, they see the address but no prices.
  res = await worker.get('/dashboard');
  assert.strictEqual(res.location, '/work');
  res = await worker.get(`/work/${work.id}`);
  assert.strictEqual(res.status, 200);
  assert.match(res.text, /1 Test St, Bayswater/);
  assert.doesNotMatch(res.text, /845/);
  res = await worker.get('/work/schedule?week=2026-10-19');
  assert.match(res.text, /Regrout shower/);

  // Worker logs hours, a cost and a note, then marks it done.
  await worker.post(`/work/${work.id}/time`, { work_date: '2026-10-20', hours: '3:30', note: 'Raked out and regrouted' });
  await worker.post(`/work/${work.id}/costs`, { description: 'Epoxy grout', amount: '62.50' });
  res = await worker.form(`/work/${work.id}/notes`, { body: 'Wall behind the shower was dry.' });
  assert.strictEqual(res.status, 302);
  await worker.post(`/work/${work.id}/status`, { status: 'done' });
  assert.strictEqual(id('SELECT SUM(minutes) AS m FROM time_entries WHERE work_id = ?', work.id).m, 210);
  assert.strictEqual(id('SELECT status FROM work_orders WHERE id = ?', work.id).status, 'done');

  // Worker can't reach quoting, money or team pages.
  assert.strictEqual((await worker.get('/invoices')).status, 403);
  assert.strictEqual((await worker.get('/team')).status, 403);
  assert.strictEqual((await worker.get('/dashboard/payouts')).status, 403);
  res = await worker.get(`/jobs/${jobId}`);
  assert.strictEqual(res.location, `/work/${work.id}`);
  await worker.post(`/jobs/${jobId}/quotes`, { amount: '1', message: 'should not be allowed to quote' });
  assert.strictEqual(id('SELECT COUNT(*) AS n FROM quotes WHERE job_id = ?', jobId).n, 1);

  // Owner sees the money summary.
  res = await owner.get(`/work/${work.id}`);
  assert.match(res.text, /\$845\.00/);
  assert.match(res.text, /Epoxy grout/);
  assert.match(res.text, /3h 30m/);

  // Private job with an invoice.
  await owner.get('/work/settings');
  await owner.post('/work/settings', { hourly_rate: '90', gst_registered: '1', invoice_prefix: 'RT-', payment_details: 'BSB 123-456 Acc 12345678' });
  await owner.get('/work/new');
  res = await owner.post('/work', { title: 'Retile laundry', client_name: 'Tom Nguyen', address: '3 Russell St, Morley WA 6062' });
  const privateId = Number(res.location.split('/').pop());
  await owner.get(`/work/${privateId}`);
  await owner.post(`/work/${privateId}/time`, { hours: '2', work_date: '2026-10-21' });
  await owner.post(`/work/${privateId}/costs`, { description: 'Tiles', amount: '100' });
  res = await owner.get(`/work/${privateId}/invoice`);
  assert.match(res.text, /value="Labour"/);
  res = await owner.post(`/work/${privateId}/invoice`, {
    line_description: ['Labour', 'Tiles'], line_quantity: ['2', '1'], line_price: ['90', '100'],
  });
  const invoiceUrl = res.location;
  res = await owner.get(invoiceUrl);
  assert.match(res.text, /Tax invoice/);
  assert.match(res.text, /RT-0001/);
  assert.match(res.text, /\$280\.00/); // subtotal
  assert.match(res.text, /\$28\.00/); // GST
  assert.match(res.text, /\$308\.00/); // total
  const invoiceId = Number(invoiceUrl.split('/').pop());
  await owner.post(`/invoices/${invoiceId}/status`, { status: 'paid' });
  assert.strictEqual(id('SELECT status FROM work_orders WHERE id = ?', privateId).status, 'paid');

  // Removing the worker stops them logging in.
  const memberId = id('SELECT id FROM team_members WHERE user_id = ?', workerId).id;
  await owner.get('/team');
  await owner.post(`/team/${memberId}/remove`);
  const again = browser();
  await again.get('/login');
  res = await again.post('/login', { email: 'luca@test.local', password: 'longpassword' });
  assert.strictEqual(res.status, 401);
});

test('customer business: staff post jobs, managers accept', async () => {
  const owner = browser();
  await signup(owner, 'customer', 'Mia Chen', 'mia@test.local', { company: 'Coastal Stays' });
  const staff = await invite(owner, 'Jess', 'jess@test.local', 'staff');

  await staff.get('/jobs/new?trade=tiling');
  let res = await staff.form('/jobs', {
    sector: 'hotels', title: 'Reseal five showers', trade: 'tiling', address: '47 Marine Tce, Fremantle WA 6160',
    description: 'Silicone has failed in five ensuites on the first floor.', budget: '2k-10k', timing: 'two-weeks',
  });
  assert.strictEqual(res.status, 302);
  const jobId = Number(res.location.split('/').pop());
  const ownerId = id("SELECT id FROM users WHERE email = 'mia@test.local'").id;
  assert.strictEqual(id('SELECT customer_id FROM jobs WHERE id = ?', jobId).customer_id, ownerId);

  // A quote comes in.
  const tradieId = db.prepare("INSERT INTO users (email, password_hash, name, role) VALUES ('t@test.local', 'x', 'T', 'tradie')").run().lastInsertRowid;
  db.prepare("INSERT INTO tradie_profiles (user_id, business_name, abn, trades, regions, status, insurance_expiry) VALUES (?, 'T Co', '51824753556', 'tiling', 'fremantle', 'approved', '2030-01-01')").run(tradieId);
  const quoteId = db.prepare("INSERT INTO quotes (job_id, tradie_id, amount_cents, message) VALUES (?, ?, 200000, 'Reseal all five ensuites')").run(jobId, tradieId).lastInsertRowid;

  // Staff can see the quote but not accept it.
  res = await staff.get(`/jobs/${jobId}`);
  assert.match(res.text, /T Co/);
  assert.match(res.text, /A manager accepts quotes/);
  await staff.post(`/quotes/${quoteId}/accept`, { amount_cents: String(id('SELECT amount_cents FROM quotes WHERE id = ?', quoteId).amount_cents) });
  assert.strictEqual(id('SELECT status FROM jobs WHERE id = ?', jobId).status, 'open');

  // Promote to manager, then it works.
  const memberId = id("SELECT id FROM team_members WHERE email = 'jess@test.local'").id;
  await owner.get('/team');
  await owner.post(`/team/${memberId}/role`, { role: 'manager' });
  await staff.get(`/jobs/${jobId}`);
  await staff.post(`/quotes/${quoteId}/accept`, { amount_cents: String(id('SELECT amount_cents FROM quotes WHERE id = ?', quoteId).amount_cents) });
  assert.strictEqual(id('SELECT status FROM jobs WHERE id = ?', jobId).status, 'awarded');
});

test('Tradebench support staff cannot move money', async () => {
  const boss = browser();
  await boss.get('/login');
  await boss.post('/login', { email: 'boss@test.local', password: 'longpassword' });
  const support = await invite(boss, 'Sam', 'sam@test.local', 'support');
  assert.strictEqual(id("SELECT admin_level FROM users WHERE email = 'sam@test.local'").admin_level, 'support');

  let res = await support.get('/admin');
  assert.strictEqual(res.status, 200);
  assert.match(res.text, /Support access/);
  assert.strictEqual((await support.get('/team')).status, 403);

  // Make a held payment and try to refund it as support.
  const job = id("SELECT id, accepted_quote_id FROM jobs WHERE status = 'awarded'");
  db.prepare("INSERT INTO payments (job_id, quote_id, amount_cents, fee_cents, status) VALUES (?, ?, 200000, 8000, 'held')").run(job.id, job.accepted_quote_id);
  const paymentId = id('SELECT id FROM payments WHERE job_id = ?', job.id).id;
  await support.post(`/admin/payments/${paymentId}/refund`);
  assert.strictEqual(id('SELECT status FROM payments WHERE id = ?', paymentId).status, 'held');
});
