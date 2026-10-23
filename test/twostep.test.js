// Email verification, the Verified badge, and two-step login with an authenticator app.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tradebench-2step-'));
process.env.DATA_DIR = tmp;
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.STRIPE_SECRET_KEY = '';
process.env.ADMIN_EMAIL = 'boss@test.local';
process.env.ADMIN_TWO_STEP = '1';

const app = require('../server');
const db = require('../src/db');
const mailer = require('../src/mailer');
const twostep = require('../src/twostep');

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
    if (body) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      const params = new URLSearchParams({ _csrf: csrf });
      for (const [k, v] of Object.entries(body)) params.append(k, v);
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
  return { cookies, get: (u) => req('GET', u), post: (u, b = {}) => req('POST', u, b) };
}

async function signup(b, as, name, email) {
  await b.get('/signup' + (as === 'tradie' ? '?as=tradie' : ''));
  const res = await b.post('/signup', { as, name, email, phone: '0400 123 456', password: 'longpassword' });
  assert.strictEqual(res.status, 302);
}

async function login(b, email, password = 'longpassword') {
  await b.get('/login');
  return b.post('/login', { email, password });
}

async function verifyLink(email) {
  await mailer.flush();
  const msg = [...mailer.outbox].reverse().find((m) => m.to === email && m.kind === 'verify_email');
  return msg && new URL(msg.text.match(/https?:\/\/\S+\/verify-email\/[\w-]+/)[0]).pathname;
}

const user = (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email);

// The code the person's phone would show right now, read from the key on the setup page.
function phoneCode(html, stepOffset = 0) {
  const key = html.match(/type: <code>([A-Z2-7 ]+)<\/code>/)[1].replace(/ /g, '');
  return twostep.codeAt(twostep.unbase32(key), twostep.stepNow() + stepOffset);
}

test('codes match the published test values, so real authenticator apps agree', () => {
  // RFC 6238 appendix B, SHA-1, last 6 of the 8 digits.
  const secret = Buffer.from('12345678901234567890');
  assert.strictEqual(twostep.codeAt(secret, Math.floor(59 / 30)), '287082');
  assert.strictEqual(twostep.codeAt(secret, Math.floor(1111111109 / 30)), '081804');
  assert.strictEqual(twostep.codeAt(secret, Math.floor(20000000000 / 30)), '353130');
});

test('a new account gets a link that confirms its email, once', async () => {
  const b = browser();
  await signup(b, 'customer', 'Vera', 'vera@test.local');
  assert.strictEqual(user('vera@test.local').email_verified_at, null);
  assert.match((await b.get('/dashboard')).text, /Confirm your email/);

  const link = await verifyLink('vera@test.local');
  assert.ok(link, 'verification email sent');
  assert.strictEqual((await b.get(link)).status, 302);
  assert.ok(user('vera@test.local').email_verified_at);
  assert.doesNotMatch((await b.get('/dashboard')).text, /Confirm your email/);
  // The same link doesn't work twice.
  assert.strictEqual((await browser().get(link)).status, 404);
  // The link itself is never kept in the email log.
  assert.ok(!db.prepare("SELECT body_text FROM emails WHERE kind = 'verify_email'").all().some((e) => e.body_text.includes(link)));
});

test('asking for the link again is capped at three an hour', async () => {
  const b = browser();
  await signup(b, 'customer', 'Rex', 'rex@test.local');
  await b.get('/dashboard/account');
  for (let i = 0; i < 4; i++) await b.post('/dashboard/account/verify-email');
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM email_verifications WHERE user_id = ?').get(user('rex@test.local').id).n, 3);
});

test('admin pages need two-step login, and a tradie needs a confirmed email to be approved', async () => {
  const admin = browser();
  await signup(admin, 'customer', 'Boss', 'boss@test.local');
  const blocked = await admin.get('/admin');
  assert.strictEqual(blocked.status, 302);
  assert.strictEqual(blocked.location, '/dashboard/account/two-step');

  // Turn it on: scan (read the key), then enter the current code.
  const setup = await admin.get('/dashboard/account/two-step');
  const done = await admin.post('/dashboard/account/two-step/enable', { code: phoneCode(setup.text) });
  assert.match(done.text, /Two-step login is on/);
  assert.strictEqual(done.text.match(/<li><code>[0-9a-f]{5}-[0-9a-f]{5}<\/code><\/li>/g).length, 10);
  assert.strictEqual((await admin.get('/admin')).status, 200);
  // Admins can't turn it off.
  await admin.post('/dashboard/account/two-step/disable', { password: 'longpassword', code: '000000' });
  assert.ok(user('boss@test.local').totp_enabled_at);

  // A tradie who hasn't confirmed their email can't be approved, and has no Verified badge.
  const tradie = browser();
  await signup(tradie, 'tradie', 'Tia', 'tia@test.local');
  db.prepare("INSERT INTO tradie_profiles (user_id, business_name, abn, trades, regions) VALUES (?, 'Tia Tiling', '51824753556', 'tiling', 'northern')").run(user('tia@test.local').id);
  const id = user('tia@test.local').id;
  await admin.get('/admin');
  await admin.post(`/admin/tradies/${id}/approve`);
  assert.strictEqual(db.prepare('SELECT status FROM tradie_profiles WHERE user_id = ?').get(id).status, 'pending');

  await tradie.get(await verifyLink('tia@test.local'));
  await admin.get('/admin');
  await admin.post(`/admin/tradies/${id}/approve`);
  assert.strictEqual(db.prepare('SELECT status FROM tradie_profiles WHERE user_id = ?').get(id).status, 'approved');
  assert.match((await browser().get(`/tradies/${id}`)).text, /class="tag verified"[^>]*>Verified</);
});

test('with two-step on, the password alone gets nowhere; each code and backup code works once', async () => {
  const b = browser();
  await signup(b, 'customer', 'Gus', 'gus@test.local');
  const setup = await b.get('/dashboard/account/two-step');
  const page = await b.post('/dashboard/account/two-step/enable', { code: phoneCode(setup.text) });
  const backup = page.text.match(/<li><code>([0-9a-f]{5}-[0-9a-f]{5})<\/code><\/li>/)[1];
  await b.post('/logout');

  // Right password: asked for a code, and not logged in yet.
  const c = browser();
  const res = await login(c, 'gus@test.local');
  assert.strictEqual(res.location, '/login/2step');
  assert.strictEqual((await c.get('/dashboard')).status, 302);

  await c.get('/login/2step');
  assert.strictEqual((await c.post('/login/2step', { code: '123456' })).status, 401);
  // The code used to switch it on (this time step) can't be used again; the next one works.
  const next = phoneCode(setup.text, 1);
  assert.strictEqual((await c.post('/login/2step', { code: next })).status, 302);
  assert.strictEqual((await c.get('/dashboard')).status, 200);

  // Someone who saw that code can't reuse it.
  const thief = browser();
  await login(thief, 'gus@test.local');
  await thief.get('/login/2step');
  assert.strictEqual((await thief.post('/login/2step', { code: next })).status, 401);

  // A backup code works once.
  const d = browser();
  await login(d, 'gus@test.local');
  await d.get('/login/2step');
  assert.strictEqual((await d.post('/login/2step', { code: backup.toUpperCase() })).status, 302);
  const e = browser();
  await login(e, 'gus@test.local');
  await e.get('/login/2step');
  assert.strictEqual((await e.post('/login/2step', { code: backup })).status, 401);
});

test('a password reset still needs the two-step code, and confirms the email', async () => {
  const b = browser();
  await signup(b, 'customer', 'Ida', 'ida@test.local');
  const setup = await b.get('/dashboard/account/two-step');
  await b.post('/dashboard/account/two-step/enable', { code: phoneCode(setup.text) });
  await b.post('/logout');

  const r = browser();
  await r.get('/forgot');
  await r.post('/forgot', { email: 'ida@test.local' });
  await mailer.flush();
  const msg = [...mailer.outbox].reverse().find((m) => m.to === 'ida@test.local' && m.kind === 'password_reset');
  const link = new URL(msg.text.match(/https?:\/\/\S+\/reset\/[\w-]+/)[0]).pathname;
  await r.get(link);
  const res = await r.post(link, { password: 'brandnewpassword' });
  assert.strictEqual(res.location, '/login/2step');
  assert.strictEqual((await r.get('/dashboard')).status, 302);
  assert.ok(user('ida@test.local').email_verified_at);
});

test('six wrong codes and it waits', async () => {
  const b = browser();
  await signup(b, 'customer', 'Max', 'max@test.local');
  const setup = await b.get('/dashboard/account/two-step');
  await b.post('/dashboard/account/two-step/enable', { code: phoneCode(setup.text) });
  await b.post('/logout');

  const c = browser();
  await login(c, 'max@test.local');
  await c.get('/login/2step');
  for (let i = 0; i < 6; i++) await c.post('/login/2step', { code: '000000' });
  // Even the right code is refused until the wait is over.
  assert.strictEqual((await c.post('/login/2step', { code: phoneCode(setup.text, 1) })).status, 429);
});
