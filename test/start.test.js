// Getting started: customers go straight to the job form; tradies answer a few questions first.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tradebench-start-'));
process.env.DATA_DIR = tmp;
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');

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
    post: (u, b) => req('POST', u, b),
    form: (u, fields) => {
      const fd = new FormData();
      fd.set('_csrf', csrf);
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      return req('POST', u, fd);
    },
  };
}

test('people who need work done go straight to the job form, and sign up as they post', async () => {
  const b = browser();
  let res = await b.get('/start');
  assert.match(res.text, /What brings you here/);
  assert.match(res.text, /href="\/jobs\/new"/);

  // Old links to the customer questions land on the form with their answers filled in.
  res = await b.get('/start?path=need&who=hotel&trade=aircon&timing=urgent&region=kimberley');
  assert.strictEqual(res.location, '/jobs/new?sector=hotels&trade=aircon&timing=urgent&region=kimberley');
  res = await b.get(res.location);
  assert.strictEqual(res.status, 200);
  assert.match(res.text, /value="hotels" checked/);
  assert.match(res.text, /value="aircon" selected/);
  assert.match(res.text, /value="urgent" selected/);
  assert.match(res.text, /value="kimberley" selected/);
  assert.match(res.text, /Your details/);
  assert.match(res.text, /Post job and create account/);

  const job = {
    sector: 'hotels', title: 'Service four split systems', trade: 'aircon', address: '1 Test St, Bayswater WA 6053',
    description: 'Four wall-mounted split systems in guest rooms need a clean and service before summer.', budget: '500-2k', timing: 'urgent',
  };

  // An email that already has an account: nothing is created, and what they typed comes back.
  db.prepare("INSERT INTO users (email, password_hash, name, role) VALUES ('taken@test.local', '!', 'Taken', 'customer')").run();
  res = await b.form('/jobs', { ...job, name: 'Mia', email: 'taken@test.local', password: 'longpassword' });
  assert.strictEqual(res.status, 400);
  assert.match(res.text, /already an account with that email/);
  assert.match(res.text, /Service four split systems/);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n, 0);

  // A short password is refused the same way.
  res = await b.form('/jobs', { ...job, name: 'Mia', email: 'mia@test.local', password: 'short' });
  assert.strictEqual(res.status, 400);
  assert.match(res.text, /at least 8 characters/);

  res = await b.form('/jobs', { ...job, name: 'Mia', email: 'Mia@Test.local', phone: '0400 111 222', company: 'Coastal Stays', password: 'longpassword' });
  assert.strictEqual(res.status, 302);
  const jobId = Number(res.location.split('/').pop());
  const mia = db.prepare("SELECT * FROM users WHERE email = 'mia@test.local'").get();
  assert.ok(mia, 'account made');
  assert.strictEqual(mia.role, 'customer');
  assert.strictEqual(mia.company, 'Coastal Stays');
  assert.strictEqual(db.prepare('SELECT customer_id FROM jobs WHERE id = ?').get(jobId).customer_id, mia.id);

  // They're logged in, and the job page is theirs.
  res = await b.get(`/jobs/${jobId}`);
  assert.match(res.text, /your account is set up/);
  assert.strictEqual((await b.get('/dashboard')).status, 200);

  // The job form says how many checked tradies would see it.
  const api = await (await fetch(`${base}/api/locate?address=${encodeURIComponent('1 Test St, Bayswater WA 6053')}&trade=aircon&sector=hotels`)).json();
  assert.match(api.match, /still signing up/);
});

test('tradie path shows matching jobs and pre-fills business details', async () => {
  const b = browser();
  let res = await b.get('/start/pick?path=tradie&pick_trades=tiling&pick_trades=plumbing');
  assert.strictEqual(res.location, '/start?path=tradie&trades=tiling%2Cplumbing');
  res = await b.get('/start/pick?path=tradie&trades=tiling,plumbing&pick_sectors=housing');
  res = await b.get(res.location.replace('/start?', '/start/pick?') + '&pick_regions=northern&pick_regions=pilbara');
  res = await b.get(res.location);
  assert.match(res.text, /No matching jobs right this minute|match you/);
  assert.match(res.text, /Create your tradie account/);

  await b.get('/signup?as=tradie');
  res = await b.post('/signup', { as: 'tradie', name: 'Terry', email: 'terry@test.local', phone: '0400 000 000', password: 'longpassword' });
  assert.strictEqual(res.location, '/dashboard/profile');
  res = await b.get('/dashboard/profile');
  assert.match(res.text, /value="tiling" checked/);
  assert.match(res.text, /value="plumbing" checked/);
  assert.match(res.text, /value="pilbara" checked/);
  assert.doesNotMatch(res.text, /value="painting" checked/);
});

test('logged-out visitors can open the job form, and a multipart post still needs the form token', async () => {
  const b = browser();
  const res = await b.get('/jobs/new');
  assert.strictEqual(res.status, 200);
  assert.match(res.text, /Your details/);
  const fd = new FormData();
  fd.set('title', 'No token on this one');
  const post = await fetch(`${base}/jobs`, { method: 'POST', body: fd, redirect: 'manual' });
  assert.strictEqual(post.status, 403);
  const look = await browser().get('/start?path=look');
  assert.strictEqual(look.location, '/how-it-works');
});

test('the admin page counts users by type', async () => {
  const bcrypt = require('bcryptjs');
  db.prepare("INSERT INTO users (email, password_hash, name, role) VALUES ('boss@test.local', ?, 'Boss', 'admin')").run(bcrypt.hashSync('longpassword', 4));
  const admin = browser();
  await admin.get('/login');
  await admin.post('/login', { email: 'boss@test.local', password: 'longpassword' });
  const res = await admin.get('/admin');
  assert.strictEqual(res.status, 200);
  // From the tests above: Mia posted a job as a new customer, Terry signed up as a tradie with no
  // business details yet, and the disabled login used for the "email taken" check isn't counted.
  assert.match(res.text, /<span>Customers<\/span><b>1<\/b>/);
  assert.match(res.text, /<span>Tradie businesses<\/span><b>1<\/b>/);
  assert.match(res.text, /Customer accounts<\/dt><dd>1 <span class="small muted">\(1 have posted a job\)/);
  assert.match(res.text, /Tradies not finished<\/dt><dd>1 /);
  assert.match(res.text, /Everyone with a login<\/dt><dd><strong>3<\/strong>/);
  assert.match(res.text, /2 new accounts \(1 customer, 1 tradie\)/);
  assert.match(res.text, /mia@test\.local/);
});
