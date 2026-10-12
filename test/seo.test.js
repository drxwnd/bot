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
