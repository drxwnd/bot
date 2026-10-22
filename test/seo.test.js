// Checks the things search engines rely on: meta tags, structured data, sitemap and robots.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tradebench-seo-'));
process.env.DATA_DIR = tmp;
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.SITE_URL = 'https://tradebench.au';
process.env.BING_SITE_VERIFICATION = 'bing-code-123';
process.env.INDEXNOW_KEY = 'test-indexnow-key-42';

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

const get = async (p) => {
  const res = await fetch(base + p);
  return { status: res.status, headers: res.headers, text: await res.text() };
};
const meta = (html, name) => (html.match(new RegExp(`name="${name}" content="([^"]*)"`)) || [])[1];
const jsonld = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));

test('public pages have a title, description, canonical and are indexable', async () => {
  for (const p of ['/', '/housing', '/hotels', '/mining', '/for-tradies', '/trades', '/areas', '/trades/plumbing', '/areas/pilbara']) {
    const { status, text } = await get(p);
    assert.strictEqual(status, 200, p);
    assert.match(text, /<title>[^<]{10,}<\/title>/, p);
    assert.ok((meta(text, 'description') || '').length > 50, `${p} description`);
    assert.strictEqual(meta(text, 'robots'), 'index, follow', p);
    assert.match(text, new RegExp(`<link rel="canonical" href="https://tradebench.au${p === '/' ? '/' : p}">`), p);
    assert.match(text, /property="og:image" content="https:\/\/tradebench.au\/img\/og.png"/, p);
  }
});

test('structured data is valid JSON with the expected types', async () => {
  assert.deepStrictEqual(jsonld((await get('/')).text).map((d) => d['@type']), ['Organization', 'WebSite']);
  assert.deepStrictEqual(jsonld((await get('/for-tradies')).text).map((d) => d['@type']), ['FAQPage']);
  assert.deepStrictEqual(jsonld((await get('/trades/tiling')).text).map((d) => d['@type']), ['BreadcrumbList', 'Service']);
});

test('private, error and empty pages stay out of the index', async () => {
  const login = await get('/login');
  assert.strictEqual(meta(login.text, 'robots'), 'noindex, nofollow');
  assert.strictEqual(login.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.strictEqual(meta((await get('/jobs/9999')).text, 'robots'), 'noindex, follow');
  assert.strictEqual(meta((await get('/nope')).text, 'robots'), 'noindex, follow');
  // No jobs or tradies yet, so trade + area pages shouldn't be indexed.
  assert.strictEqual(meta((await get('/trades/tiling/kimberley')).text, 'robots'), 'noindex, follow');
  assert.strictEqual(meta((await get('/jobs?trade=tiling')).text, 'robots'), 'noindex, follow');
});

test('sitemap and robots.txt', async () => {
  const sitemap = await get('/sitemap.xml');
  assert.match(sitemap.headers.get('content-type'), /xml/);
  assert.match(sitemap.text, /<loc>https:\/\/tradebench.au\/trades\/plumbing<\/loc>/);
  assert.match(sitemap.text, /<loc>https:\/\/tradebench.au\/areas\/pilbara<\/loc>/);
  assert.doesNotMatch(sitemap.text, /\/trades\/tiling\/kimberley/);
  assert.doesNotMatch(sitemap.text, /login|dashboard/);
  const robots = await get('/robots.txt');
  assert.match(robots.text, /Sitemap: https:\/\/tradebench.au\/sitemap.xml/);
  assert.match(robots.text, /Disallow: \/admin/);
});

test('robots.txt keeps crawlers out of the logged-in areas', async () => {
  const robots = await get('/robots.txt');
  for (const p of ['/work', '/invoices', '/team', '/invite/', '/api/']) assert.match(robots.text, new RegExp(`Disallow: ${p}\n`), p);
});

test('Bing verification and the IndexNow key file', async () => {
  assert.strictEqual(meta((await get('/')).text, 'msvalidate.01'), 'bing-code-123');
  const key = await get('/test-indexnow-key-42.txt');
  assert.strictEqual(key.status, 200);
  assert.strictEqual(key.text, 'test-indexnow-key-42');
});

// Real data for the rest: a tiler in Perth's north-east with paid jobs, one open job, one filled job.
let openJob;
let filledJob;
let tradieId;
test('setup: jobs, a tradie and payments', () => {
  const user = (email, role) => Number(db.prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?, '!', 'Test', ?)").run(email, role).lastInsertRowid);
  const customer = user('cust@test.local', 'customer');
  tradieId = user('tiler@test.local', 'tradie');
  db.prepare(`
    INSERT INTO tradie_profiles (user_id, business_name, abn, sectors, trades, regions, status, approved_at)
    VALUES (?, 'North Tiles', '51824753556', 'housing', 'tiling', 'north-east', 'approved', '2026-02-01 09:00:00')`).run(tradieId);
  const job = (status, created, trade = 'tiling') => Number(db.prepare(`
    INSERT INTO jobs (customer_id, sector, title, trade, suburb, postcode, region, description, budget, timing, status, created_at)
    VALUES (?, 'housing', 'Regrout a shower', ?, 'Bayswater', '6053', 'north-east', 'Grout cracking.', '500-2k', 'flexible', ?, ?)`)
    .run(customer, trade, status, created).lastInsertRowid);
  const paid = (dollars, trade = 'tiling') => {
    const id = job('completed', '2026-03-01 09:00:00', trade);
    const quote = db.prepare("INSERT INTO quotes (job_id, tradie_id, amount_cents, message, status) VALUES (?, ?, ?, 'x', 'accepted')").run(id, tradieId, dollars * 100).lastInsertRowid;
    db.prepare('UPDATE jobs SET accepted_quote_id = ? WHERE id = ?').run(quote, id);
    db.prepare("INSERT INTO payments (job_id, quote_id, amount_cents, fee_cents, status, paid_at) VALUES (?, ?, ?, 0, 'released', datetime('now', '-1 month'))").run(id, quote, dollars * 100);
  };
  for (const d of [400, 600, 800, 1000, 1500]) paid(d);
  for (const d of [200, 300, 400, 500]) paid(d, 'plumbing'); // one short of a price range
  openJob = job('open', '2026-05-20 08:00:00');
  filledJob = job('awarded', '2026-05-10 08:00:00');
});

test('trade pages show the real price range once there are enough paid jobs', async () => {
  const page = await get('/trades/tiling');
  assert.match(page.text, /\$600 to \$1,000/);
  assert.match(page.text, /middle price was \$800/);
  assert.match(page.text, /Based on 5 paid jobs/);
  assert.match(meta(page.text, 'description'), /Most paid jobs were \$600 to \$1,000/);
  const service = jsonld(page.text).find((d) => d['@type'] === 'Service');
  assert.deepStrictEqual(service.offers, { '@type': 'AggregateOffer', priceCurrency: 'AUD', lowPrice: '600.00', highPrice: '1000.00', offerCount: 5 });

  const area = await get('/trades/tiling/north-east');
  assert.match(area.text, /\$600 to \$1,000/);
  assert.strictEqual(meta(area.text, 'robots'), 'index, follow');

  const plumbing = await get('/trades/plumbing');
  assert.doesNotMatch(plumbing.text, /What plumbing costs/);
  assert.ok(!jsonld(plumbing.text).find((d) => d['@type'] === 'Service').offers);
});

test('sitemap dates are real, and only where there is one', async () => {
  const sitemap = (await get('/sitemap.xml')).text;
  assert.doesNotMatch(sitemap, /changefreq|priority/);
  assert.match(sitemap, new RegExp(`<loc>https://tradebench.au/jobs/${openJob}</loc><lastmod>2026-05-20</lastmod>`));
  assert.match(sitemap, /<loc>https:\/\/tradebench.au\/trades\/tiling<\/loc><lastmod>2026-05-20<\/lastmod>/);
  assert.match(sitemap, /<loc>https:\/\/tradebench.au\/trades\/tiling\/north-east<\/loc><lastmod>2026-05-20<\/lastmod>/);
  assert.match(sitemap, new RegExp(`<loc>https://tradebench.au/tradies/${tradieId}</loc><lastmod>2026-02-01</lastmod>`));
  assert.match(sitemap, /<loc>https:\/\/tradebench.au\/terms<\/loc><\/url>/);
  assert.match(sitemap, /<loc>https:\/\/tradebench.au\/how-it-works<\/loc><\/url>/);
});

test('jobs and profiles link to the trade and area pages', async () => {
  const job = (await get(`/jobs/${openJob}`)).text;
  assert.match(job, /href="\/trades\/tiling\/north-east"/);
  assert.match(job, /href="\/areas\/north-east"/);
  const profile = (await get(`/tradies/${tradieId}`)).text;
  assert.match(profile, /<a href="\/trades\/tiling">Tiling<\/a>/);
  assert.match(profile, /<a href="\/areas\/north-east">/);
});

test('a filled job points visitors to similar open ones', async () => {
  const page = await get(`/jobs/${filledJob}`);
  assert.match(page.text, /Job filled/);
  assert.match(page.text, new RegExp(`href="/jobs/${openJob}"`));
  assert.match(page.text, /href="\/trades\/tiling\/north-east"/);
  assert.strictEqual(meta(page.text, 'robots'), 'noindex, follow');
});
