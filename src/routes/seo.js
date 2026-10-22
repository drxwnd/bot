const express = require('express');
const db = require('../db');
const config = require('../config');
const C = require('../constants');
const { TRADE_INFO, REGION_INFO } = require('../seo-content');
const seo = require('../seo');
const money = (cents) => '$' + Math.round(cents / 100).toLocaleString('en-AU');

const router = express.Router();

// Paid jobs needed before a trade (or trade and area) page shows a price range.
const MIN_PRICED_JOBS = 5;

// Trades with a landing page ("other" is a catch-all, not something people search for).
const SEO_TRADES = C.TRADES.filter((t) => TRADE_INFO[t.slug]);

const q = {
  jobs: db.prepare(`
    SELECT id, sector, title, trade, suburb, budget, created_at,
      (SELECT COUNT(*) FROM quotes WHERE job_id = jobs.id AND status != 'withdrawn') AS quote_count
    FROM jobs
    WHERE status = 'open' AND (@trade IS NULL OR trade = @trade) AND (@region IS NULL OR region = @region)
    ORDER BY created_at DESC LIMIT 10`),
  tradies: db.prepare(`
    SELECT u.id, p.business_name, p.trades, p.years_trading,
      (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE tradie_id = u.id) AS rating,
      (SELECT COUNT(*) FROM reviews WHERE tradie_id = u.id) AS review_count
    FROM tradie_profiles p JOIN users u ON u.id = p.user_id
    WHERE p.status = 'approved'
      AND (@trade IS NULL OR (',' || p.trades || ',') LIKE ('%,' || @trade || ',%'))
      AND (@region IS NULL OR (',' || p.regions || ',') LIKE ('%,' || @region || ',%'))
    ORDER BY review_count DESC, p.approved_at ASC LIMIT 12`),
  // Trade + area pairs that have something real on them, so only those get indexed.
  activeCombos: db.prepare(`
    SELECT DISTINCT trade, region FROM jobs WHERE status = 'open'
    UNION
    SELECT j.trade, j.region FROM payments p JOIN jobs j ON j.id = p.job_id
    WHERE p.status IN ('held', 'released') AND p.paid_at > datetime('now', '-12 months')
    GROUP BY j.trade, j.region HAVING COUNT(*) >= @min`),
  tradieAreas: db.prepare(`SELECT trades, regions FROM tradie_profiles WHERE status = 'approved'`),
  openJobs: db.prepare(`SELECT id, sector, trade, region, created_at FROM jobs WHERE status = 'open' ORDER BY created_at DESC LIMIT 5000`),
  // What customers actually paid for this kind of job in the last year (the quote, not our fees).
  paidPrices: db.prepare(`
    SELECT p.amount_cents FROM payments p JOIN jobs j ON j.id = p.job_id
    WHERE p.status IN ('held', 'released') AND p.paid_at > datetime('now', '-12 months')
      AND j.trade = @trade AND (@region IS NULL OR j.region = @region)
    ORDER BY p.amount_cents`),
  profiles: db.prepare(`
    SELECT u.id, p.trades, p.regions, COALESCE(MAX(r.created_at), p.approved_at) AS updated
    FROM tradie_profiles p JOIN users u ON u.id = p.user_id LEFT JOIN reviews r ON r.tradie_id = u.id
    WHERE p.status = 'approved' GROUP BY u.id`),
};

function activeComboSet() {
  const set = new Set(q.activeCombos.all({ min: MIN_PRICED_JOBS }).map((r) => `${r.trade}/${r.region}`));
  for (const t of q.tradieAreas.all()) {
    for (const trade of t.trades.split(',')) for (const region of t.regions.split(',')) set.add(`${trade}/${region}`);
  }
  return set;
}

// Real prices for a trade (and area), from jobs paid through the site. Nothing is shown until there are
// enough jobs for the range to mean something. Amounts are rounded so no single job can be picked out.
function priceGuide(trade, region = null) {
  const cents = q.paidPrices.all({ trade, region }).map((r) => r.amount_cents);
  if (cents.length < MIN_PRICED_JOBS) return null;
  const at = (p) => {
    const i = (cents.length - 1) * p;
    const lo = Math.floor(i);
    return cents[lo] + (cents[Math.min(lo + 1, cents.length - 1)] - cents[lo]) * (i - lo);
  };
  const round = (c) => {
    const step = c < 100000 ? 1000 : 5000; // to the nearest $10 under $1,000, else the nearest $50
    return Math.max(step, Math.round(c / step) * step);
  };
  return { low: round(at(0.25)), high: round(at(0.75)), median: round(at(0.5)), jobs: cents.length };
}
const priceText = (g) => `Most paid jobs were ${money(g.low)} to ${money(g.high)}`;

// Short name for breadcrumbs and link lists, e.g. "Pilbara".
const regionShort = (slug) => C.regionName[slug].replace(/\s*\(.*\)$/, '');
// Name that reads well mid-sentence, e.g. "the Pilbara".
const regionLabel = (slug) => REGION_INFO[slug].name;
const tradeObj = (slug) => SEO_TRADES.find((t) => t.slug === slug);
const regionObj = (slug) => C.REGIONS.find((r) => r.slug === slug);

// ---- Directory pages ----

router.get('/trades', (req, res) => {
  res.render('pages/trades-index', {
    title: 'Find a tradie by trade',
    description: `Get quotes from checked tradies across Western Australia. ${SEO_TRADES.slice(0, 6).map((t) => t.name.toLowerCase()).join(', ')} and more.`,
    trades: SEO_TRADES,
    breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Trades', path: '/trades' }],
  });
});

router.get('/areas', (req, res) => {
  res.render('pages/areas-index', {
    title: 'Tradies across Perth and regional WA',
    description: 'Find checked tradies in Perth, the South West, the Goldfields, the Pilbara, the Kimberley and the rest of WA. Post a job free and compare quotes.',
    breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Areas', path: '/areas' }],
  });
});

// ---- Trade landing page ----

router.get('/trades/:trade', (req, res, next) => {
  const trade = tradeObj(req.params.trade);
  if (!trade) return next();
  const info = TRADE_INFO[trade.slug];
  const path = `/trades/${trade.slug}`;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Trades', path: '/trades' }, { name: info.plural, path }];
  const prices = priceGuide(trade.slug);

  res.render('pages/trade', {
    title: `${info.plural} in Perth and WA`,
    description: seo.truncate(prices
      ? `${info.plural} in Perth and WA. ${priceText(prices)}. Post your job free and get quotes from checked local tradies.`
      : `Need ${info.plural.toLowerCase()} in Perth or regional WA? Post your job free and get quotes from checked local tradies. ${info.jobs.slice(0, 3).join(', ')} and more.`),
    trade,
    info,
    prices,
    region: null,
    jobs: q.jobs.all({ trade: trade.slug, region: null }),
    tradies: q.tradies.all({ trade: trade.slug, region: null }),
    breadcrumbs: crumbs,
    jsonld: [
      seo.breadcrumbList(crumbs),
      seo.service({ name: `${info.plural} in Western Australia`, description: info.jobs.join(', '), path, serviceType: trade.name, prices }),
    ],
  });
});

// ---- Trade + area landing page ----

router.get('/trades/:trade/:region', (req, res, next) => {
  const trade = tradeObj(req.params.trade);
  const region = regionObj(req.params.region);
  if (!trade || !region) return next();
  const info = TRADE_INFO[trade.slug];
  const area = REGION_INFO[region.slug];
  const label = regionLabel(region.slug);
  const path = `/trades/${trade.slug}/${region.slug}`;
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: info.plural, path: `/trades/${trade.slug}` },
    { name: regionShort(region.slug), path },
  ];

  const jobs = q.jobs.all({ trade: trade.slug, region: region.slug });
  const tradies = q.tradies.all({ trade: trade.slug, region: region.slug });
  const prices = priceGuide(trade.slug, region.slug);
  // Thin pages hurt the whole site in Google, so these only get indexed once there's real content.
  if (!jobs.length && !tradies.length && !prices) res.locals.robots = 'noindex, follow';

  res.render('pages/trade', {
    title: `${info.plural} in ${label}`,
    description: seo.truncate(prices
      ? `${info.plural} in ${label}. ${priceText(prices)}. Post your job free and get quotes from checked local tradies.`
      : `Get quotes from checked ${info.plural.toLowerCase()} in ${area.places.slice(0, 4).join(', ')} and across ${label}. Post your job free. Pay only when it's done.`),
    trade,
    info,
    prices,
    region,
    area,
    label,
    jobs,
    tradies,
    breadcrumbs: crumbs,
    jsonld: [
      seo.breadcrumbList(crumbs),
      seo.service({ name: `${info.plural} in ${label}`, description: info.jobs.join(', '), path, areaServed: label, serviceType: trade.name, prices }),
    ],
  });
});

// ---- Area landing page ----

router.get('/areas/:region', (req, res, next) => {
  const region = regionObj(req.params.region);
  if (!region) return next();
  const area = REGION_INFO[region.slug];
  const label = regionLabel(region.slug);
  const path = `/areas/${region.slug}`;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Areas', path: '/areas' }, { name: regionShort(region.slug), path }];

  res.render('pages/area', {
    title: `Tradies in ${label}`,
    description: seo.truncate(`Find checked tradies in ${area.places.slice(0, 5).join(', ')} and across ${label}. Post a job free, compare quotes and pay when it's done.`),
    region,
    area,
    label,
    trades: SEO_TRADES,
    jobs: q.jobs.all({ trade: null, region: region.slug }),
    tradies: q.tradies.all({ trade: null, region: region.slug }),
    breadcrumbs: crumbs,
    jsonld: [seo.breadcrumbList(crumbs)],
  });
});

// ---- Crawler files ----

// The IndexNow key file (see src/indexnow.js).
if (config.indexNowKey) {
  router.get(`/${config.indexNowKey}.txt`, (req, res) => res.type('text/plain').send(config.indexNowKey));
}

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    [
      'User-agent: *',
      // The logged-in parts of the site and form endpoints: nothing here for search engines.
      'Disallow: /dashboard',
      'Disallow: /admin',
      'Disallow: /work',
      'Disallow: /invoices',
      'Disallow: /team',
      'Disallow: /invite/',
      'Disallow: /reset/',
      'Disallow: /forgot',
      'Disallow: /unsubscribe',
      'Disallow: /login',
      'Disallow: /signup',
      'Disallow: /jobs/new',
      'Disallow: /api/',
      'Disallow: /stripe/',
      '',
      `Sitemap: ${seo.url('/sitemap.xml')}`,
      '',
    ].join('\n'),
  );
});

// Each page's <lastmod> is the date its content really changed: a new job or a tradie approved or
// reviewed. Pages with no such date (how it works, terms) leave it out, because a date that's always
// "today" teaches Google to ignore the field for the whole site. Google ignores <changefreq> and
// <priority>, so they're left out too.
router.get('/sitemap.xml', (req, res) => {
  const jobs = q.openJobs.all();
  const profiles = q.profiles.all();
  const day = (s) => (s ? String(s).slice(0, 10) : null);
  const newest = (...dates) => dates.filter(Boolean).sort().pop() || null;
  const newestJob = (match) => day((jobs.find(match) || {}).created_at);
  const newestTradie = (match) => day(newest(...profiles.filter(match).map((p) => p.updated)));
  const covers = (list, slug) => list.split(',').includes(slug);

  const entries = [];
  const add = (path, lastmod = null) => entries.push({ loc: seo.url(path), lastmod });

  add('/', newestJob(() => true));
  add('/jobs', newestJob(() => true));
  for (const s of C.SECTORS) add(s.path, newestJob((j) => j.sector === s.slug));
  add('/how-it-works');
  add('/for-tradies');
  add('/trades');
  add('/areas');
  for (const t of SEO_TRADES) {
    add(`/trades/${t.slug}`, newest(newestJob((j) => j.trade === t.slug), newestTradie((p) => covers(p.trades, t.slug))));
  }
  for (const r of C.REGIONS) {
    add(`/areas/${r.slug}`, newest(newestJob((j) => j.region === r.slug), newestTradie((p) => covers(p.regions, r.slug))));
  }

  const combos = activeComboSet();
  for (const t of SEO_TRADES) {
    for (const r of C.REGIONS) {
      if (!combos.has(`${t.slug}/${r.slug}`)) continue;
      add(`/trades/${t.slug}/${r.slug}`, newest(
        newestJob((j) => j.trade === t.slug && j.region === r.slug),
        newestTradie((p) => covers(p.trades, t.slug) && covers(p.regions, r.slug)),
      ));
    }
  }
  for (const job of jobs) add(`/jobs/${job.id}`, day(job.created_at));
  for (const p of profiles) add(`/tradies/${p.id}`, day(p.updated));
  add('/terms');
  add('/privacy');
  add('/photo-credits');

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.map((e) => `  <url><loc>${e.loc}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`).join('\n') +
    '\n</urlset>\n';
  res.type('application/xml').send(xml);
});

router.get('/site.webmanifest', (req, res) => {
  res.type('application/manifest+json').send(
    JSON.stringify({
      name: config.siteName,
      short_name: config.siteName,
      start_url: '/',
      display: 'browser',
      background_color: '#f5f3ee',
      theme_color: '#1c1b18',
      icons: [
        { src: '/img/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/img/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    }),
  );
});

module.exports = router;
module.exports.SEO_TRADES = SEO_TRADES;
