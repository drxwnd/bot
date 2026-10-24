// Who gets emailed when: the admin's alerts, quote updates, closed jobs, reviews, reminders, and the
// one-click unsubscribe header. Emails go to a stand-in for Resend so the real request can be checked.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tradebench-emails-'));
process.env.DATA_DIR = tmp;
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.STRIPE_SECRET_KEY = '';
process.env.ADMIN_EMAIL = 'boss@test.local';
process.env.RESEND_API_KEY = 're_test_key';

// Requests to Resend are answered here and kept; everything else (the app under test) goes through.
const realFetch = globalThis.fetch;
const sentToResend = [];
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith('https://api.resend.com/')) {
    sentToResend.push(JSON.parse(opts.body));
    return new Response(JSON.stringify({ id: 'test' }), { status: 200 });
  }
  return realFetch(url, opts);
};

const app = require('../server');
const db = require('../src/db');
const { quoteVersion } = require('../src/helpers');
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
  globalThis.fetch = realFetch;
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
    const res = await realFetch(base + url, { method, headers, body: payload, redirect: 'manual' });
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
    raw: (u, body, headers) => req('POST', u, body, headers),
    form: (u, fields) => {
      const fd = new FormData();
      fd.set('_csrf', csrf);
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      return req('POST', u, fd);
    },
  };
}

const one = (sql, ...a) => db.prepare(sql).get(...a);
const emails = (to, kind) => db.prepare('SELECT * FROM emails WHERE to_email = ? AND kind = ? ORDER BY id').all(to, kind);
const link = (to, re) => {
  const m = [...mailer.outbox].reverse().find((e) => e.to === to && re.test(e.text));
  return m && new URL(m.text.match(re)[0]).pathname;
};

async function signup(b, as, name, email) {
  await b.get('/signup' + (as === 'tradie' ? '?as=tradie' : ''));
  await b.post('/signup', { as, name, email, phone: '0400 123 456', password: 'longpassword' });
  await mailer.flush();
  const confirm = link(email, /https?:\/\/\S+\/verify-email\/[A-Za-z0-9_-]+/);
  if (confirm) await b.get(confirm);
}

let admin;
const tradies = {};
async function approvedTiler(name, email) {
  const b = browser();
  await signup(b, 'tradie', name, email);
  await b.get('/dashboard/profile');
  await b.post('/dashboard/profile', {
    name, phone: '0400 123 456', business_name: `${name} Tiling`, abn: '51 824 753 556', sectors: 'housing',
    trades: 'tiling', regions: 'north-east', insurer: 'QBE', insurance_expiry: '2030-01-01',
  });
  const id = one('SELECT id FROM users WHERE email = ?', email).id;
  await admin.get('/admin');
  await admin.post(`/admin/tradies/${id}/approve`);
  tradies[name] = { b, id, email };
}

const job = {
  sector: 'housing', trade: 'tiling', address: '1 Test St, Bayswater WA 6053', budget: '500-2k', timing: 'flexible',
  description: 'Grout is cracking around the shower base and one tile is loose.',
};
async function postJob(b, title, extra = {}) {
  await b.get('/jobs/new');
  const res = await b.form('/jobs', { ...job, title, ...extra });
  return Number(res.location.split('/').pop());
}
async function quote(t, jobId, amount) {
  await t.b.get(`/jobs/${jobId}`);
  await t.b.post(`/jobs/${jobId}/quotes`, { amount, message: 'Remove old grout, regrout and reseal, fix the loose tile.' });
  return one('SELECT * FROM quotes WHERE job_id = ? AND tradie_id = ?', jobId, t.id);
}

test('setup, and the admin hears about every sign-up', async () => {
  admin = browser();
  await signup(admin, 'customer', 'Boss', 'boss@test.local');
  await approvedTiler('Tia', 'tia@test.local');
  await approvedTiler('Ted', 'ted@test.local');
  await mailer.flush();
  assert.deepStrictEqual(emails('boss@test.local', 'admin_signup').map((e) => e.subject), ['New tradie: Tia', 'New tradie: Ted']);
});

let customer;
let jobId;
test('a new job tells the admin how many tradies it reached', async () => {
  customer = browser();
  jobId = await postJob(customer, 'Regrout the ensuite shower', { name: 'Cleo', email: 'cleo@test.local', phone: '0411 222 333', password: 'longpassword' });
  await mailer.flush();
  const alert = emails('boss@test.local', 'admin_new_job').at(-1);
  assert.strictEqual(alert.subject, 'New job: Tiling in Bayswater (2 tradies alerted)');
  assert.match(alert.body_text, /Customer: Cleo \(new account\)/);
  assert.match(alert.body_text, /Phone: 0411 222 333/);
  assert.strictEqual(one('SELECT alerted FROM jobs WHERE id = ?', jobId).alerted, 2);

  // Nobody covers plumbing: the subject says so.
  await customer.get('/jobs/new');
  await customer.form('/jobs', { ...job, trade: 'plumbing', title: 'Fix a dripping kitchen tap', description: 'The kitchen mixer drips all the time and needs a new cartridge.' });
  await mailer.flush();
  assert.match(emails('boss@test.local', 'admin_new_job').at(-1).subject, /^New job, 0 MATCHES: Plumbing in Bayswater/);
});

test('a changed quote says it was updated, not that it is a new one', async () => {
  await quote(tradies.Tia, jobId, '600');
  await quote(tradies.Tia, jobId, '580');
  await mailer.flush();
  const subjects = emails('cleo@test.local', 'quote_received').map((e) => e.subject);
  assert.deepStrictEqual(subjects, ['New quote for your job: $600.00 from Tia Tiling', 'Tia Tiling updated their quote: $580.00']);
});

test('a review emails the tradie', async () => {
  const q = one('SELECT * FROM quotes WHERE job_id = ? AND tradie_id = ?', jobId, tradies.Tia.id);
  await customer.get(`/jobs/${jobId}`);
  await customer.post(`/quotes/${q.id}/accept`, { amount_cents: String(q.amount_cents), quote_version: quoteVersion(db.prepare('SELECT * FROM quotes WHERE id = ?').get(q.id)) });
  await customer.post(`/jobs/${jobId}/pay`);
  await tradies.Tia.b.get('/dashboard/payouts');
  await tradies.Tia.b.post('/dashboard/payouts/start');
  await customer.get(`/jobs/${jobId}`);
  await customer.post(`/jobs/${jobId}/release`);
  await customer.get(`/jobs/${jobId}`);
  await customer.post(`/jobs/${jobId}/review`, { rating: '4', comment: 'Tidy work, a day late.' });
  await mailer.flush();
  const review = emails('tia@test.local', 'review_received');
  assert.strictEqual(review.length, 1);
  assert.strictEqual(review[0].subject, 'New 4-star review: Regrout the ensuite shower');
  assert.match(review[0].body_text, /Cleo left you a 4-star review/);
  assert.match(review[0].body_text, /"Tidy work, a day late\."/);
});

test('closing a job tells everyone who quoted, including an accepted quote not yet paid for', async () => {
  const closing = await postJob(customer, 'Replace kitchen splashback tiles');
  await quote(tradies.Ted, closing, '900');
  await customer.get(`/jobs/${closing}`);
  await customer.post(`/jobs/${closing}/cancel`);

  const accepted = await postJob(customer, 'Fix drummy floor tiles in the hallway');
  const q = await quote(tradies.Tia, accepted, '450');
  await customer.get(`/jobs/${accepted}`);
  await customer.post(`/quotes/${q.id}/accept`, { amount_cents: String(q.amount_cents), quote_version: quoteVersion(db.prepare('SELECT * FROM quotes WHERE id = ?').get(q.id)) });
  await customer.get(`/jobs/${accepted}`);
  await customer.post(`/jobs/${accepted}/cancel`);
  await mailer.flush();

  const ted = emails('ted@test.local', 'job_closed');
  assert.strictEqual(ted.length, 1);
  assert.match(ted[0].body_text, /no longer taking quotes/);
  const tia = emails('tia@test.local', 'job_closed');
  assert.strictEqual(tia.length, 1);
  assert.match(tia[0].body_text, /won't go ahead\. Don't start any work on it/);
});

test('reminders: unpaid accepted quotes, no quotes, unconfirmed tradie emails', async () => {
  // Accepted a day ago, not paid: the customer is reminded once; at 3 days the admin hears.
  const unpaid = await postJob(customer, 'Seal the laundry floor tiles');
  const q = await quote(tradies.Ted, unpaid, '300');
  await customer.get(`/jobs/${unpaid}`);
  await customer.post(`/quotes/${q.id}/accept`, { amount_cents: String(q.amount_cents), quote_version: quoteVersion(db.prepare('SELECT * FROM quotes WHERE id = ?').get(q.id)) });
  db.prepare("UPDATE jobs SET awarded_at = datetime('now', '-25 hours') WHERE id = ?").run(unpaid);
  reminders.run();
  reminders.run();
  await mailer.flush();
  const pay = emails('cleo@test.local', 'reminder_pay');
  assert.strictEqual(pay.length, 1);
  assert.match(pay[0].body_text, /Pay \$300\.00 to lock it in/);
  assert.ok(!emails('boss@test.local', 'admin_alert').some((e) => /hasn't been paid/.test(e.body_text)));
  db.prepare("UPDATE jobs SET awarded_at = datetime('now', '-73 hours') WHERE id = ?").run(unpaid);
  reminders.run();
  await mailer.flush();
  assert.strictEqual(emails('boss@test.local', 'admin_alert').filter((e) => /hasn't been paid/.test(e.body_text)).length, 1);

  // No quotes: 4 hours is enough when no tradie was alerted; otherwise it waits a day.
  const plumbing = one("SELECT id FROM jobs WHERE trade = 'plumbing'").id;
  const tiling = await postJob(customer, 'Regrout the main bathroom floor');
  db.prepare("UPDATE jobs SET created_at = datetime('now', '-5 hours') WHERE id IN (?, ?)").run(plumbing, tiling);
  reminders.run();
  await mailer.flush();
  let none = emails('boss@test.local', 'admin_no_quotes').map((e) => e.subject);
  assert.deepStrictEqual(none, ['No quotes after 5 hours: Fix a dripping kitchen tap']);
  db.prepare("UPDATE jobs SET created_at = datetime('now', '-25 hours') WHERE id = ?").run(tiling);
  reminders.run();
  await mailer.flush();
  none = emails('boss@test.local', 'admin_no_quotes').map((e) => e.subject);
  assert.deepStrictEqual(none.slice(1), ['No quotes after 25 hours: Regrout the main bathroom floor']);

  // A tradie who never confirmed their email gets a fresh link at 1 day and again at 3 days.
  const slow = browser();
  await slow.get('/signup?as=tradie');
  await slow.post('/signup', { as: 'tradie', name: 'Sam', email: 'sam@test.local', phone: '0400 123 456', password: 'longpassword' });
  db.prepare("UPDATE email_verifications SET expires_at = datetime('now', '-1 hour')").run(); // so the hourly cap doesn't apply
  db.prepare("UPDATE users SET created_at = datetime('now', '-25 hours') WHERE email = 'sam@test.local'").run();
  reminders.run();
  reminders.run();
  await mailer.flush();
  assert.strictEqual(emails('sam@test.local', 'verify_email').length, 2, 'sign-up link, then the 1-day reminder');
  db.prepare("UPDATE users SET created_at = datetime('now', '-73 hours') WHERE email = 'sam@test.local'").run();
  reminders.run();
  await mailer.flush();
  assert.strictEqual(emails('sam@test.local', 'verify_email').length, 3, 'and the 3-day reminder');

  // Someone already 4 days in when this first runs gets one reminder, not two.
  const late = browser();
  await late.get('/signup?as=tradie');
  await late.post('/signup', { as: 'tradie', name: 'Lou', email: 'lou@test.local', phone: '0400 123 456', password: 'longpassword' });
  db.prepare("UPDATE users SET created_at = datetime('now', '-4 days') WHERE email = 'lou@test.local'").run();
  reminders.run();
  await mailer.flush();
  assert.strictEqual(emails('lou@test.local', 'verify_email').length, 2);
});

test('alerts carry one-click unsubscribe headers, and the one-click link works without a form token', async () => {
  await mailer.flush();
  const alert = sentToResend.find((m) => m.to[0] === 'ted@test.local' && /^New tiling job/.test(m.subject));
  assert.match(alert.headers['List-Unsubscribe'], /^<http:\/\/localhost:3000\/unsubscribe\/one-click\?u=\d+&t=[\w-]+>$/);
  assert.strictEqual(alert.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  // Transactional emails (a quote, a payment) don't have them.
  const quoteEmail = sentToResend.find((m) => m.to[0] === 'cleo@test.local' && /quote/.test(m.subject));
  assert.strictEqual(quoteEmail.headers, undefined);

  const target = new URL(alert.headers['List-Unsubscribe'].slice(1, -1));
  const bad = await realFetch(`${base}/unsubscribe/one-click?u=${target.searchParams.get('u')}&t=wrong`, { method: 'POST', body: 'List-Unsubscribe=One-Click', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.strictEqual(bad.status, 400);
  const res = await realFetch(base + target.pathname + target.search, { method: 'POST', body: 'List-Unsubscribe=One-Click', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(one("SELECT email_alerts FROM users WHERE email = 'ted@test.local'").email_alerts, 0);
  // Opening the same link in a browser shows the normal page.
  const opened = await browser().get(target.pathname + target.search);
  assert.match(opened.location, /^\/unsubscribe\?u=\d+&t=/);
});
