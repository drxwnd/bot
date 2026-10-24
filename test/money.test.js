// The money findings from docs/SECURITY_AUDIT.md (U5, U6, U21, U23) and the invite email one (U24),
// each tried against the code. Stripe is played by a small stand-in so its failures can be staged.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tradebench-money-'));
process.env.DATA_DIR = tmp;
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.STRIPE_SECRET_KEY = '';
process.env.ADMIN_EMAIL = 'boss@test.local';

const app = require('../server');
const db = require('../src/db');
const mailer = require('../src/mailer');
const payments = require('../src/payments');

let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  payments.useStripe(null);
  server.close();
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const one = (sql, ...a) => db.prepare(sql).get(...a);

// Just enough of Stripe's API. `fail` makes the next call throw, either after the money moved
// ('after', like a timeout once Stripe has done it) or before ('before').
function fakeStripe() {
  const s = { transfers: [], refunds: [], sessions: {}, intents: {}, created: [], fail: {} };
  const maybeFail = (kind, record) => {
    const how = s.fail[kind];
    s.fail[kind] = null;
    if (how === 'before') throw new Error('ECONNRESET');
    record();
    if (how === 'after') throw new Error('ETIMEDOUT');
  };
  s.api = {
    transfers: {
      create: async (params) => {
        const t = { id: `tr_${s.transfers.length + 1}`, reversed: false, ...params };
        maybeFail('transfer', () => s.transfers.push(t));
        return t;
      },
      list: async ({ transfer_group }) => ({ data: s.transfers.filter((t) => t.transfer_group === transfer_group) }),
    },
    refunds: {
      create: async (params) => {
        const r = { id: `re_${s.refunds.length + 1}`, status: 'succeeded', ...params };
        maybeFail('refund', () => s.refunds.push(r));
        return r;
      },
      list: async ({ payment_intent }) => ({ data: s.refunds.filter((r) => r.payment_intent === payment_intent) }),
    },
    checkout: {
      sessions: {
        retrieve: async (id) => s.sessions[id],
        create: async (params) => {
          const session = { id: `cs_${s.created.length + 1}`, url: `https://checkout.test/${s.created.length + 1}`, status: 'open', ...params };
          s.created.push(params);
          s.sessions[session.id] = session;
          return session;
        },
        expire: async () => {},
      },
    },
    paymentIntents: { retrieve: async (id) => s.intents[id] },
  };
  return s;
}

// A held payment of $200 on a job of its own.
let n = 0;
function heldPayment() {
  n += 1;
  const user = (email, role) => Number(db.prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?, '!', 'Test', ?)").run(email, role).lastInsertRowid);
  const customerId = user(`c${n}@test.local`, 'customer');
  const tradieId = user(`t${n}@test.local`, 'tradie');
  const jobId = Number(db.prepare(`
    INSERT INTO jobs (customer_id, title, trade, suburb, postcode, region, description, budget, timing, status)
    VALUES (?, 'Test job', 'tiling', 'Subiaco', '6008', 'central', 'Test', 'under-500', 'flexible', 'paid')`).run(customerId).lastInsertRowid);
  const quoteId = db.prepare("INSERT INTO quotes (job_id, tradie_id, amount_cents, message, status) VALUES (?, ?, 20000, 'x', 'accepted')").run(jobId, tradieId).lastInsertRowid;
  const id = Number(db.prepare(`
    INSERT INTO payments (job_id, quote_id, amount_cents, fee_cents, customer_fee_cents, status, stripe_charge_id, stripe_payment_intent)
    VALUES (?, ?, 20000, 1500, 400, 'held', ?, ?)`).run(jobId, quoteId, `ch_${jobId}`, `pi_${jobId}`).lastInsertRowid);
  return { id, jobId, quoteId, customerId, get: () => one('SELECT * FROM payments WHERE id = ?', id) };
}
const TRADIE = { stripe_account_id: 'acct_x' };

// ---- U5 ----

test('U5: a payout that errors after Stripe made it is found, and the customer is not refunded on top', async () => {
  const s = fakeStripe();
  payments.useStripe(s.api);
  try {
    const p = heldPayment();
    s.fail.transfer = 'after';
    await assert.rejects(payments.release(p.get(), TRADIE), /ETIMEDOUT/);
    assert.strictEqual(p.get().status, 'held');
    assert.strictEqual(p.get().pending_action, 'release');

    // The admin sees a held payment and presses Refund.
    await assert.rejects(payments.refund(p.get()), /already been paid out/);
    assert.strictEqual(s.refunds.length, 0, 'no refund sent');
    assert.strictEqual(p.get().status, 'released');
    assert.strictEqual(p.get().transfer_id, 'tr_1');
  } finally {
    payments.useStripe(null);
  }
});

test("U5: a payout that never happened can be refunded, once it's clear it never happened", async () => {
  const s = fakeStripe();
  payments.useStripe(s.api);
  try {
    const p = heldPayment();
    s.fail.transfer = 'before';
    await assert.rejects(payments.release(p.get(), TRADIE), /ECONNRESET/);
    // Too soon to be sure Stripe didn't do it.
    await assert.rejects(payments.refund(p.get()), /a moment ago/);
    assert.strictEqual(s.refunds.length, 0);
    db.prepare("UPDATE payments SET pending_action_at = datetime('now', '-5 minutes') WHERE id = ?").run(p.id);
    await payments.refund(p.get());
    assert.strictEqual(p.get().status, 'refunded');
    assert.strictEqual(s.refunds.length, 1);
    assert.strictEqual(s.transfers.length, 0);
  } finally {
    payments.useStripe(null);
  }
});

test('U5: trying the payout again after an error does not pay twice', async () => {
  const s = fakeStripe();
  payments.useStripe(s.api);
  try {
    const p = heldPayment();
    s.fail.transfer = 'after';
    await assert.rejects(payments.release(p.get(), TRADIE));
    await payments.release(p.get(), TRADIE);
    assert.strictEqual(s.transfers.length, 1);
    assert.strictEqual(p.get().status, 'released');
  } finally {
    payments.useStripe(null);
  }
});

test('U5: a refund that errors after Stripe made it blocks the payout', async () => {
  const s = fakeStripe();
  payments.useStripe(s.api);
  try {
    const p = heldPayment();
    s.fail.refund = 'after';
    await assert.rejects(payments.refund(p.get()), /ETIMEDOUT/);
    await assert.rejects(payments.release(p.get(), TRADIE), /already been refunded/);
    assert.strictEqual(s.transfers.length, 0, 'no payout sent');
    assert.strictEqual(p.get().status, 'refunded');
  } finally {
    payments.useStripe(null);
  }
});

// ---- U21 ----

test('U21: a checkout whose payment failed afterwards gets a new card-only checkout', async () => {
  const s = fakeStripe();
  payments.useStripe(s.api);
  try {
    const p = heldPayment();
    db.prepare("UPDATE payments SET status = 'pending', stripe_session_id = 'cs_old' WHERE id = ?").run(p.id);
    s.sessions.cs_old = { id: 'cs_old', status: 'complete', payment_status: 'unpaid', payment_intent: 'pi_old', amount_total: 20400, metadata: { payment_id: String(p.id) } };
    const job = { id: p.jobId, title: 'Test job' };
    const quote = one('SELECT * FROM quotes WHERE id = ?', p.quoteId);

    // A bank debit still going through: no second checkout.
    s.intents.pi_old = { id: 'pi_old', status: 'processing' };
    assert.strictEqual(await payments.startCheckout(job, quote, { email: 'c@test.local' }), `/jobs/${p.jobId}?paid=1`);
    assert.strictEqual(s.created.length, 0);

    // It bounced: a new checkout, cards only.
    s.intents.pi_old = { id: 'pi_old', status: 'requires_payment_method' };
    assert.match(await payments.startCheckout(job, quote, { email: 'c@test.local' }), /^https:\/\/checkout\.test\//);
    assert.strictEqual(s.created.length, 1);
    assert.deepStrictEqual(s.created[0].payment_method_types, ['card']);
  } finally {
    payments.useStripe(null);
  }
});

// ---- The site, with payments simulated ----

function browser() {
  const cookies = {};
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
  if (res.status !== 302) return res;
  await mailer.flush();
  const msg = [...mailer.outbox].reverse().find((m) => m.to === email && m.kind === 'verify_email');
  await b.get(new URL(msg.text.match(/https?:\/\/\S+\/verify-email\/[\w-]+/)[0]).pathname);
  return res;
}

let customer, tradie, tradieId, jobId;
const setTradie = (status) => db.prepare('UPDATE tradie_profiles SET status = ? WHERE user_id = ?').run(status, tradieId);
const jobStatus = () => one('SELECT status FROM jobs WHERE id = ?', jobId).status;

test('setup: a customer, an approved tiler and a quote', async () => {
  customer = browser();
  await signup(customer, 'customer', 'Cleo', 'cleo@test.local');
  tradie = browser();
  await signup(tradie, 'tradie', 'Tia', 'tia@test.local');
  await tradie.get('/dashboard/profile');
  await tradie.post('/dashboard/profile', {
    name: 'Tia', phone: '0400 123 456', business_name: 'Tia Tiles', abn: '51 824 753 556', sectors: 'housing',
    trades: 'tiling', regions: 'north-east', insurer: 'QBE', insurance_expiry: '2030-01-01',
  });
  tradieId = one("SELECT id FROM users WHERE email = 'tia@test.local'").id;
  setTradie('approved');

  await customer.get('/jobs/new?trade=tiling');
  const res = await customer.form('/jobs', {
    sector: 'housing', title: 'Replace cracked tiles', trade: 'tiling', address: '1 Test St, Bayswater WA 6053',
    description: 'Two cracked floor tiles in the kitchen, spares in the shed.', budget: '500-2k', timing: 'flexible',
  });
  jobId = Number(res.location.split('/').pop());
  await tradie.get(`/jobs/${jobId}`);
  await tradie.post(`/jobs/${jobId}/quotes`, { amount: '845', message: 'All materials included, 5 year warranty.' });
  assert.ok(one('SELECT id FROM quotes WHERE job_id = ?', jobId));
});

// ---- U23 ----

test('U23: accepting checks the quote still says what the customer read, not just the price', async () => {
  const page = await customer.get(`/jobs/${jobId}`);
  const seen = page.text.match(/name="quote_version" value="([a-f0-9]+)"/)[1];
  const quote = one('SELECT * FROM quotes WHERE job_id = ?', jobId);

  // Same price, less included.
  await tradie.get(`/jobs/${jobId}`);
  await tradie.post(`/jobs/${jobId}/quotes`, { amount: '845', message: 'Labour only. Materials extra, no warranty.' });
  await customer.get(`/jobs/${jobId}`);
  await customer.post(`/quotes/${quote.id}/accept`, { amount_cents: '84500', quote_version: seen });
  assert.strictEqual(one('SELECT status FROM quotes WHERE id = ?', quote.id).status, 'pending');
  assert.strictEqual(jobStatus(), 'open');

  // With the page read again, it goes through.
  const fresh = (await customer.get(`/jobs/${jobId}`)).text.match(/name="quote_version" value="([a-f0-9]+)"/)[1];
  await customer.post(`/quotes/${quote.id}/accept`, { amount_cents: '84500', quote_version: fresh });
  assert.strictEqual(jobStatus(), 'awarded');
});

// ---- U6 ----

test("U6: a tradie who isn't approved any more can't be paid, or paid out to", async () => {
  // Sent back for checking after the quote was accepted: the customer can't pay yet.
  setTradie('pending');
  await customer.get(`/jobs/${jobId}`);
  let res = await customer.post(`/jobs/${jobId}/pay`);
  assert.strictEqual(res.location, `/jobs/${jobId}#payment`);
  assert.strictEqual(jobStatus(), 'awarded');
  assert.strictEqual(payments.paymentForJob(jobId), undefined);

  // Approved again: paying works (simulated, so it's held straight away).
  setTradie('approved');
  await customer.get(`/jobs/${jobId}`);
  res = await customer.post(`/jobs/${jobId}/pay`);
  assert.strictEqual(jobStatus(), 'paid');

  // Turned down after the customer paid: the money isn't released to them.
  setTradie('rejected');
  db.prepare("UPDATE tradie_profiles SET stripe_account_id = 'acct_t', payouts_enabled = 1 WHERE user_id = ?").run(tradieId);
  await customer.get(`/jobs/${jobId}`);
  await customer.post(`/jobs/${jobId}/release`);
  assert.strictEqual(payments.paymentForJob(jobId).status, 'held');

  setTradie('approved');
  await customer.get(`/jobs/${jobId}`);
  await customer.post(`/jobs/${jobId}/release`);
  assert.strictEqual(payments.paymentForJob(jobId).status, 'released');
});

// ---- U24 ----

test('U24: names with phone numbers or links stay out of the emails we send', async () => {
  const spam = browser();
  const res = await signup(spam, 'customer', 'URGENT payout on hold call 1300 123 456', 'spam@test.local');
  assert.notStrictEqual(res.status, 302);
  assert.strictEqual(one("SELECT COUNT(*) AS n FROM users WHERE email = 'spam@test.local'").n, 0);

  const owner = browser();
  await signup(owner, 'customer', 'Nell', 'nell@test.local');
  const ownerId = one("SELECT id FROM users WHERE email = 'nell@test.local'").id;
  db.prepare("UPDATE users SET company = 'Visit tb-support.com now' WHERE id = ?").run(ownerId);
  await owner.get('/team');
  await owner.post('/team/invite', { name: 'Pat', email: 'pat@test.local', role: 'staff' });
  assert.strictEqual(one('SELECT COUNT(*) AS n FROM team_members WHERE account_id = ?', ownerId).n, 0);

  db.prepare("UPDATE users SET company = 'Nell Holdings' WHERE id = ?").run(ownerId);
  await owner.get('/team');
  await owner.post('/team/invite', { name: 'Pat', email: 'pat@test.local', role: 'staff' });
  await mailer.flush();
  const invite = [...mailer.outbox].reverse().find((m) => m.to === 'pat@test.local');
  assert.strictEqual(invite.subject, "You've been invited to a team on Tradebench");
});
