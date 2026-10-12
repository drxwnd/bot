// The get-started quiz: both paths, saved answers, and pre-filled forms afterwards.
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
    if (body) {
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
  return { get: (u) => req('GET', u), post: (u, b) => req('POST', u, b) };
}

const decode = (s) => s.replace(/&amp;/g, '&');

test('customer path ends with a filled-in job form', async () => {
  const b = browser();
  let res = await b.get('/start');
  assert.match(res.text, /What brings you here/);
  res = await b.get('/start?path=need');
  assert.match(res.text, /Who's the work for/);
  res = await b.get('/start?path=need&who=hotel');
  assert.match(res.text, /What needs doing/);
  // Hotels see air con first.
  assert.ok(res.text.indexOf('Air con') < res.text.indexOf('Concreting'));
  res = await b.get('/start?path=need&who=hotel&trade=aircon&timing=urgent');
  assert.match(res.text, /Where's the job/);
  res = await b.get('/start?path=need&who=hotel&trade=aircon&timing=urgent&region=kimberley');
  assert.match(res.text, /You're all set/);
  assert.match(res.text, /access and timing/);
  assert.match(res.text, /still signing up/);

  // Sign up from the result page, then the job form is pre-filled.
  const signupHref = decode(res.text.match(/href="(\/signup\?next=[^"]+)"/)[1]);
  await b.get(signupHref);
  res = await b.post('/signup', { as: 'customer', name: 'Mia', email: 'mia@test.local', password: 'longpassword', next: decodeURIComponent(signupHref.split('next=')[1]) });
  assert.match(res.location, /^\/jobs\/new\?sector=hotels&trade=aircon&timing=urgent&region=kimberley/);
  assert.strictEqual(db.prepare("SELECT customer_type FROM users WHERE email = 'mia@test.local'").get().customer_type, 'hotel');
  res = await b.get(res.location);
  assert.match(res.text, /value="hotels" checked/);
  assert.match(res.text, /value="aircon" selected/);
  assert.match(res.text, /value="urgent" selected/);
  assert.match(res.text, /value="kimberley" selected/);
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

test('logged-out visitors heading to post a job start with the quiz', async () => {
  const res = await browser().get('/jobs/new');
  assert.strictEqual(res.location, '/start?path=need');
  const look = await browser().get('/start?path=look');
  assert.strictEqual(look.location, '/how-it-works');
});
