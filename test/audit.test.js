// The five confirmed findings from docs/SECURITY_AUDIT.md (C1 to C5), each tried against the running app.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tradebench-audit-'));
process.env.DATA_DIR = tmp;
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.STRIPE_SECRET_KEY = '';
process.env.ADMIN_EMAIL = 'boss@test.local';
// Stalled uploads are dropped after this long without progress (10 seconds on the live site).
process.env.UPLOAD_STALL_MS = '1500';

const app = require('../server');
const db = require('../src/db');
const mailer = require('../src/mailer');

let server;
let port;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  port = server.address().port;
  base = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

function browser(ip) {
  const cookies = {};
  let csrf = null;
  async function req(method, url, body, headers = {}) {
    headers = { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '), ...(ip ? { 'x-forwarded-for': ip } : {}), ...headers };
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

async function linkIn(email, kind, re) {
  await mailer.flush();
  const msg = [...mailer.outbox].reverse().find((m) => m.to === email && m.kind === kind);
  assert.ok(msg, `${kind} email to ${email}`);
  return new URL(msg.text.match(re)[0]).pathname;
}

async function signup(b, as, name, email, { confirm = true } = {}) {
  await b.get('/signup' + (as === 'tradie' ? '?as=tradie' : ''));
  const res = await b.post('/signup', { as, name, email, phone: '0400 123 456', password: 'longpassword' });
  assert.strictEqual(res.status, 302, `signup ${email}`);
  if (confirm) await b.get(await linkIn(email, 'verify_email', /https?:\/\/\S+\/verify-email\/[\w-]+/));
}

async function resetPassword(b, email, password) {
  await b.get('/forgot');
  await b.post('/forgot', { email });
  const link = await linkIn(email, 'password_reset', /https?:\/\/\S+\/reset\/[\w-]+/);
  await b.get(link);
  return b.post(link, { password });
}

async function invite(owner, name, email) {
  await owner.get('/team');
  await owner.post('/team/invite', { name, email, role: 'staff' });
  const token = (await owner.get('/team')).text.match(/\/invite\/([A-Za-z0-9_-]+)/)[1];
  const member = browser();
  await member.get(`/invite/${token}`);
  await member.post(`/invite/${token}`, { name, password: 'longpassword' });
  assert.strictEqual((await member.get('/dashboard')).status, 200, `${email} logged in`);
  return member;
}

const one = (sql, ...a) => db.prepare(sql).get(...a);
const idOf = (email) => one('SELECT id FROM users WHERE email = ?', email).id;

// ---- C1 ----

// Starts a job post that says it's 10MB and then sends almost nothing, like the attack in the audit.
function stalledUpload() {
  const s = net.connect(port, '127.0.0.1');
  s.write('POST /jobs HTTP/1.1\r\nHost: localhost\r\nContent-Type: multipart/form-data; boundary=X\r\nContent-Length: 10000000\r\n\r\n--X\r\n');
  let reply = '';
  s.on('data', (d) => (reply += d));
  s.on('error', () => {});
  const closed = new Promise((r) => s.once('close', r));
  return { closed, reply: () => reply, socket: s };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('C1: slow uploads from one place no longer block everyone else, and are dropped', async () => {
  const customer = browser();
  await signup(customer, 'customer', 'Cleo', 'cleo@test.local');
  await customer.get('/jobs/new?trade=tiling');

  const a = stalledUpload();
  const b = stalledUpload();
  await wait(200);
  // One address can only hold two uploads open at once...
  const c = stalledUpload();
  await c.closed;
  assert.match(c.reply(), /^HTTP\/1\.1 503/);

  // ...and anyone else can still post a job while those two are held.
  const res = await customer.form('/jobs', {
    sector: 'housing', title: 'Replace cracked tiles', trade: 'tiling', address: '1 Test St, Bayswater WA 6053',
    description: 'Two cracked floor tiles in the kitchen, spares in the shed.', budget: '500-2k', timing: 'flexible',
  });
  assert.strictEqual(res.status, 302, 'job posted');

  // The stalled ones are cut off soon after they stop sending.
  const timeout = wait(6000).then(() => 'still open');
  assert.notStrictEqual(await Promise.race([a.closed, timeout]), 'still open');
  assert.notStrictEqual(await Promise.race([b.closed, timeout]), 'still open');
});

// ---- C2 ----

test('C2: very long emails are cut to 200 characters before they are counted', async () => {
  const f = browser('10.2.0.1');
  await f.get('/login');
  let res;
  // Each email is different, but only after the first 200 characters.
  for (let i = 0; i < 9; i++) res = await f.post('/login', { email: `${'a'.repeat(250)}${i}@test.local`, password: 'wrong' });
  assert.strictEqual(res.status, 429);
  assert.ok(!res.text.includes('a'.repeat(201)), 'the page only echoes the first 200 characters');
});

// ---- C3 ----

test('C3: a burst of logins at once can not get past the per-email limit', async () => {
  const tries = [];
  for (let i = 0; i < 45; i++) {
    const f = browser(`10.3.${i}.1`);
    await f.get('/login');
    tries.push(f);
  }
  const results = await Promise.all(tries.map((f, i) => f.post('/login', { email: 'target@test.local', password: `guess${i}` })));
  const statuses = results.map((r) => r.status);
  const checked = statuses.filter((s) => s === 401).length;
  assert.ok(checked <= 30, `${checked} passwords were checked; the limit is 30`);
  assert.ok(statuses.every((s) => [401, 429, 503].includes(s)), statuses.join(','));
});

test('C3: addresses in one IPv6 /64 count as one', async () => {
  let res;
  for (let i = 1; i <= 9; i++) {
    const f = browser(`2001:db8:5:6::${i.toString(16)}`);
    await f.get('/login');
    res = await f.post('/login', { email: 'six@test.local', password: 'wrong' });
  }
  assert.strictEqual(res.status, 429);
  const other = browser('2001:db8:5:7::1');
  await other.get('/login');
  assert.strictEqual((await other.post('/login', { email: 'six@test.local', password: 'wrong' })).status, 401, 'a different /64 is not affected');
});

// ---- C4 ----

test('C4: an account can only add so many private jobs, hours and costs', async () => {
  const t = browser();
  await signup(t, 'tradie', 'Tia', 'tia@test.local');
  await t.get('/dashboard/profile');
  await t.post('/dashboard/profile', {
    name: 'Tia', phone: '0400 123 456', business_name: 'Tia Tiles', abn: '51 824 753 556', sectors: 'housing',
    trades: 'tiling', regions: 'north-east', insurer: 'QBE', insurance_expiry: '2030-01-01',
  });
  const tid = idOf('tia@test.local');
  assert.strictEqual(one('SELECT status FROM tradie_profiles WHERE user_id = ?', tid).status, 'pending');
  const fill = db.prepare("INSERT INTO work_orders (account_id, source, title, client_name, status) VALUES (?, 'private', 'Filler', 'Client', 'new')");
  const count = () => one("SELECT COUNT(*) AS n FROM work_orders WHERE account_id = ? AND source = 'private'", tid).n;
  const addJob = async () => {
    await t.get('/work/new');
    return t.post('/work', { title: 'Bathroom regrout', client_name: 'Sam' });
  };

  // Still being checked: up to 20.
  for (let i = count(); i < 20; i++) fill.run(tid);
  let res = await addJob();
  assert.strictEqual(res.status, 400);
  assert.match(res.text, /while your business is being checked/);
  assert.strictEqual(count(), 20);

  // Approved: up to 50 a day.
  db.prepare("UPDATE tradie_profiles SET status = 'approved' WHERE user_id = ?").run(tid);
  assert.strictEqual((await addJob()).status, 302);
  for (let i = count(); i < 50; i++) fill.run(tid);
  res = await addJob();
  assert.strictEqual(res.status, 400);
  assert.match(res.text, /daily limit/);

  // Rejected: none.
  db.prepare("UPDATE tradie_profiles SET status = 'rejected' WHERE user_id = ?").run(tid);
  assert.match((await addJob()).text, /so you can(&#39;|')t add jobs/);
  db.prepare("UPDATE tradie_profiles SET status = 'approved' WHERE user_id = ?").run(tid);

  // Up to 500 time entries on one job.
  const workId = one("SELECT id FROM work_orders WHERE account_id = ? AND title = 'Bathroom regrout'", tid).id;
  const addTime = db.prepare("INSERT INTO time_entries (work_id, user_id, work_date, minutes) VALUES (?, ?, '2026-10-01', 60)");
  db.transaction(() => { for (let i = 0; i < 500; i++) addTime.run(workId, tid); })();
  await t.get(`/work/${workId}`);
  await t.post(`/work/${workId}/time`, { hours: '2' });
  assert.strictEqual(one('SELECT COUNT(*) AS n FROM time_entries WHERE work_id = ?', workId).n, 500);
});

test('C4: a backup is skipped, not half written, when the disk is nearly full', async () => {
  const { backup } = require('../src/backup');
  const realStatfs = fs.statfsSync;
  fs.statfsSync = (p) => ({ ...realStatfs(p), bavail: 1, bsize: 4096 });
  try {
    await assert.rejects(backup({ force: true }), /Not enough free disk space/);
  } finally {
    fs.statfsSync = realStatfs;
  }
  assert.deepStrictEqual(fs.readdirSync(path.join(tmp, 'backups')), []);
  assert.ok(await backup({ force: true }), 'works again once there is room');
});

// ---- C5 ----

test("C5: an account can't invite a team until its email is confirmed", async () => {
  const owner = browser();
  await signup(owner, 'customer', 'Nell', 'nell@test.local', { confirm: false });
  await owner.get('/team');
  await owner.post('/team/invite', { name: 'Atk', email: 'atk@test.local', role: 'staff' });
  assert.strictEqual(one('SELECT COUNT(*) AS n FROM team_members WHERE account_id = ?', idOf('nell@test.local')).n, 0);
  assert.match((await owner.get('/team')).text, /Confirm your email address first/);
});

test('C5: resetting the password of an unconfirmed account removes the team logins someone else made', async () => {
  // Someone signs up with the victim's email and adds a login of their own (as was possible before
  // the check above, so the account is confirmed just for the invite).
  const attacker = browser();
  await signup(attacker, 'customer', 'Vic', 'vic@corp.test', { confirm: false });
  const vid = idOf('vic@corp.test');
  db.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?").run(vid);
  const planted = await invite(attacker, 'Atk', 'atk@evil.test');
  db.prepare('UPDATE users SET email_verified_at = NULL WHERE id = ?').run(vid);

  // The real owner gets in with a reset link.
  const victim = browser();
  const res = await resetPassword(victim, 'vic@corp.test', 'victimspassword');
  assert.strictEqual(res.location, '/team');
  assert.strictEqual((await planted.get('/dashboard')).status, 302, "the planted login's session has ended");
  assert.strictEqual((await attacker.get('/dashboard')).status, 302);
  assert.strictEqual(one("SELECT password_hash FROM users WHERE email = 'atk@evil.test'").password_hash, '!');
  assert.strictEqual(one("SELECT COUNT(*) AS n FROM team_members WHERE account_id = ? AND status != 'removed'", vid).n, 0);
  const again = browser();
  await again.get('/login');
  assert.strictEqual((await again.post('/login', { email: 'atk@evil.test', password: 'longpassword' })).status, 401, "and it can't log in again");
});

test('C5: on a confirmed account, a reset keeps the team and points the owner at it', async () => {
  const owner = browser();
  await signup(owner, 'customer', 'Ola', 'ola@test.local');
  const staff = await invite(owner, 'Pat', 'pat@test.local');
  const res = await resetPassword(browser(), 'ola@test.local', 'anotherlongpassword');
  assert.strictEqual(res.location, '/team');
  assert.strictEqual((await staff.get('/dashboard')).status, 200, 'real staff are not logged out without warning');
});
