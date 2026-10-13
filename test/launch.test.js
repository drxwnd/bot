// Launch features: job alerts, password reset, unsubscribe, the minimum and customer fees,
// reminders and the health check.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tradebench-launch-'));
process.env.DATA_DIR = tmp;
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.STRIPE_SECRET_KEY = '';
process.env.ADMIN_EMAIL = 'boss@test.local';
process.env.MIN_FEE_DOLLARS = '15';
process.env.CUSTOMER_FEE_PERCENT = '2';
process.env.MAX_QUOTE_DOLLARS = '20000';

const app = require('../server');
const db = require('../src/db');
const mailer = require('../src/mailer');
const reminders = require('../src/reminders');

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

async function signup(b, as, name, email) {
  await b.get('/signup' + (as === 'tradie' ? '?as=tradie' : ''));
  const res = await b.post('/signup', { as, name, email, phone: '0400 123 456', password: 'longpassword' });
  assert.strictEqual(res.status, 302);
}

const one = (sql, ...args) => db.prepare(sql).get(...args);
const emailsTo = (to, kind) => db.prepare('SELECT * FROM emails WHERE to_email = ? AND kind = ?').all(to, kind);

async function approvedTradie(admin, name, email, fields) {
  const b = browser();
  await signup(b, 'tradie', name, email);
  await b.get('/dashboard/profile');
  await b.post('/dashboard/profile', {
    name, phone: '0400 123 456', abn: '51 824 753 556', insurer: 'QBE', insurance_expiry: '2027-01-01', ...fields,
  });
  const id = one('SELECT id FROM users WHERE email = ?', email).id;
  await admin.get('/admin');
  await admin.post(`/admin/tradies/${id}/approve`);
  return { b, id };
}

test('health check answers', async () => {
  const res = await fetch(base + '/healthz');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(await res.text(), 'ok');
});

test('job alerts, fees, contact details and reminders', async () => {
  const admin = browser();
  await signup(admin, 'customer', 'Boss', 'boss@test.local');

  const tiler = await approvedTradie(admin, 'Tia', 'tia@test.local', { business_name: 'Tia Tiles', sectors: 'housing', trades: 'tiling', regions: 'north-east' });
  await approvedTradie(admin, 'Paul', 'paul@test.local', { business_name: 'Paul Plumbing', sectors: 'housing', trades: 'plumbing', regions: 'north-east' });
  await approvedTradie(admin, 'Fran', 'fran@test.local', { business_name: 'Far Tiles', sectors: 'housing', trades: 'tiling', regions: 'pilbara' });
  const quiet = await approvedTradie(admin, 'Quinn', 'quinn@test.local', { business_name: 'Quiet Tiles', sectors: 'housing', trades: 'tiling', regions: 'north-east' });
  db.prepare('UPDATE users SET email_alerts = 0 WHERE id = ?').run(quiet.id);

  // Customer posts a tiling job in Bayswater (north-east).
  const customer = browser();
  await signup(customer, 'customer', 'Cleo', 'cleo@test.local');
  await customer.get('/jobs/new?trade=tiling');
  const res = await customer.form('/jobs', {
    sector: 'housing', title: 'Replace two cracked tiles', trade: 'tiling', address: '1 Test St, Bayswater WA 6053',
    description: 'Two cracked floor tiles in the kitchen, spares in the shed.', budget: 'under-500', timing: 'flexible',
  });
  const jobId = Number(res.location.split('/').pop());
  await mailer.flush();

  // Only the tiler who covers the area and wants alerts hears about it.
  assert.strictEqual(emailsTo('tia@test.local', 'new_job').length, 1);
  assert.strictEqual(emailsTo('paul@test.local', 'new_job').length, 0, 'wrong trade');
  assert.strictEqual(emailsTo('fran@test.local', 'new_job').length, 0, 'wrong area');
  assert.strictEqual(emailsTo('quinn@test.local', 'new_job').length, 0, 'alerts turned off');
  const alert = emailsTo('tia@test.local', 'new_job')[0];
  assert.match(alert.body_text, new RegExp(`/jobs/${jobId}`));
  assert.match(alert.body_text, /\/unsubscribe\?u=\d+&t=/);

  // A small $200 quote: the $15 minimum applies, and the customer pays 2% on top.
  await tiler.b.get(`/jobs/${jobId}`);
  // Quotes over the $20,000 cap are turned away.
  await tiler.b.post(`/jobs/${jobId}/quotes`, { amount: '25000', message: 'Full bathroom and kitchen rebuild.' });
  assert.strictEqual(one('SELECT COUNT(*) AS n FROM quotes WHERE job_id = ?', jobId).n, 0);
  await tiler.b.get(`/jobs/${jobId}`);

  await tiler.b.post(`/jobs/${jobId}/quotes`, { amount: '200', message: 'Cut out and replace both tiles, regrout.' });
  const quote = one('SELECT * FROM quotes WHERE job_id = ?', jobId);
  let page = await tiler.b.get(`/jobs/${jobId}`);
  assert.match(page.text, /You'd receive \$185\.00/);

  // Reminder after a day of the quote sitting there, and only once.
  db.prepare("UPDATE quotes SET created_at = datetime('now', '-2 days') WHERE id = ?").run(quote.id);
  reminders.run();
  reminders.run();
  await mailer.flush();
  assert.strictEqual(emailsTo('cleo@test.local', 'reminder_quotes').length, 1);

  await customer.get(`/jobs/${jobId}`);
  await customer.post(`/quotes/${quote.id}/accept`, { amount_cents: String(quote.amount_cents) });
  page = await customer.get(`/jobs/${jobId}`);
  assert.match(page.text, /Pay \$204\.00 to lock it in/);
  assert.doesNotMatch(page.text, /tia@test\.local/, 'no contact details before payment');

  await customer.post(`/jobs/${jobId}/pay`);
  const payment = one('SELECT * FROM payments WHERE job_id = ?', jobId);
  assert.strictEqual(payment.status, 'held');
  assert.strictEqual(payment.fee_cents, 1500);
  assert.strictEqual(payment.customer_fee_cents, 400);
  page = await customer.get(`/jobs/${jobId}`);
  assert.match(page.text, /tia@test\.local/);

  // Held for over a week: the customer is asked if it's done. A disputed payment can't be released.
  db.prepare("UPDATE payments SET paid_at = datetime('now', '-8 days') WHERE id = ?").run(payment.id);
  reminders.run();
  await mailer.flush();
  assert.strictEqual(emailsTo('cleo@test.local', 'reminder_release').length, 1);

  db.prepare('UPDATE payments SET disputed = 1 WHERE id = ?').run(payment.id);
  await tiler.b.get('/dashboard/payouts');
  await tiler.b.post('/dashboard/payouts/start');
  await customer.get(`/jobs/${jobId}`);
  await customer.post(`/jobs/${jobId}/release`);
  assert.strictEqual(one('SELECT status FROM payments WHERE id = ?', payment.id).status, 'held');

  db.prepare('UPDATE payments SET disputed = 0 WHERE id = ?').run(payment.id);
  await customer.get(`/jobs/${jobId}`);
  await customer.post(`/jobs/${jobId}/release`);
  assert.strictEqual(one('SELECT status FROM payments WHERE id = ?', payment.id).status, 'released');

  // Admin sees both fees as earnings.
  page = await admin.get('/admin');
  assert.match(page.text, /Fees earned<\/span><b>\$19\.00/);
});

test('password reset and unsubscribe links', async () => {
  const user = browser();
  await signup(user, 'customer', 'Rhea', 'rhea@test.local');

  // Unknown emails get the same answer, and no email.
  const anon = browser();
  await anon.get('/forgot');
  let res = await anon.post('/forgot', { email: 'nobody@test.local' });
  assert.match(res.text, /If there's an account/);
  res = await anon.post('/forgot', { email: 'rhea@test.local' });
  assert.match(res.text, /If there's an account/);
  await mailer.flush();
  assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM emails WHERE kind = 'password_reset'").get().n, 1);

  // The stored copy has the link blanked out; the email itself has it.
  assert.match(emailsTo('rhea@test.local', 'password_reset')[0].body_text, /\/reset\/\[link removed\]/);
  const sentReset = mailer.outbox.find((m) => m.to === 'rhea@test.local' && m.kind === 'password_reset');
  const token = sentReset.text.match(/\/reset\/([A-Za-z0-9_-]+)/)[1];
  res = await anon.get(`/reset/${token}`);
  assert.strictEqual(res.status, 200);
  res = await anon.post(`/reset/${token}`, { password: 'brandnewpassword' });
  assert.strictEqual(res.location, '/dashboard');

  // The link only works once, and the new password works.
  res = await browser().get(`/reset/${token}`);
  assert.strictEqual(res.status, 404);
  const fresh = browser();
  await fresh.get('/login');
  res = await fresh.post('/login', { email: 'rhea@test.local', password: 'brandnewpassword' });
  assert.strictEqual(res.location, '/dashboard');

  // Unsubscribe link: a bad signature is refused, a good one turns alerts off and back on.
  const uid = one("SELECT id FROM users WHERE email = 'rhea@test.local'").id;
  const { unsubscribeToken } = require('../src/emails');
  res = await browser().get(`/unsubscribe?u=${uid}&t=wrongwrongwrongwrongwron`);
  assert.strictEqual(res.status, 404);
  const b = browser();
  res = await b.get(`/unsubscribe?u=${uid}&t=${unsubscribeToken(uid)}`);
  assert.match(res.text, /Turn off job alerts/);
  res = await b.post('/unsubscribe', { u: String(uid), t: unsubscribeToken(uid), on: '0' });
  assert.match(res.text, /Job alerts are off/);
  assert.strictEqual(one('SELECT email_alerts FROM users WHERE id = ?', uid).email_alerts, 0);
});

test('printable flyers are admin only and carry a QR code', async () => {
  const admin = browser();
  await admin.get('/login');
  await admin.post('/login', { email: 'boss@test.local', password: 'longpassword' });
  let res = await admin.get('/admin/flyer/tradies');
  assert.strictEqual(res.status, 200);
  assert.match(res.text, /<svg[^>]*viewBox/);
  assert.match(res.text, /Get paid before you start/);
  res = await admin.get('/admin/flyer/customers');
  assert.match(res.text, /Scan to post your first job/);
  res = await browser().get('/admin/flyer/tradies');
  assert.notStrictEqual(res.status, 200);
});
