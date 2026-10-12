const express = require('express');
const db = require('../db');
const config = require('../config');
const C = require('../constants');
const { TRADE_INFO, REGION_INFO } = require('../seo-content');
const seo = require('../seo');

const router = express.Router();

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
    SELECT DISTINCT trade, region FROM jobs WHERE status = 'open'`),
  tradieAreas: db.prepare(`SELECT trades, regions FROM tradie_profiles WHERE status = 'approved'`),
  openJobs: db.prepare(`SELECT id, created_at FROM jobs WHERE status = 'open' ORDER BY created_at DESC LIMIT 5000`),
  profiles: db.prepare(`
    SELECT u.id, COALESCE(MAX(r.created_at), p.approved_at) AS updated
    FROM tradie_profiles p JOIN users u ON u.id = p.user_id LEFT JOIN reviews r ON r.tradie_id = u.id
    WHERE p.status = 'approved' GROUP BY u.id`),
};

function activeComboSet() {
  const set = new Set(q.activeCombos.all().map((r) => `${r.trade}/${r.region}`));
  for (const t of q.tradieAreas.all()) {
    for (const trade of t.trades.split(',')) for (const region of t.regions.split(',')) set.add(`${trade}/${region}`);
  }
  return set;
}

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

  res.render('pages/trade', {
    title: `${info.plural} in Perth and WA`,
    description: seo.truncate(`Need ${info.plural.toLowerCase()} in Perth or regional WA? Post your job free and get quotes from checked local tradies. ${info.jobs.slice(0, 3).join(', ')} and more.`),
    trade,
    info,
    region: null,
    jobs: q.jobs.all({ trade: trade.slug, region: null }),
    tradies: q.tradies.all({ trade: trade.slug, region: null }),
    breadcrumbs: crumbs,
    jsonld: [
      seo.breadcrumbList(crumbs),
      seo.service({ name: `${info.plural} in Western Australia`, description: info.jobs.join(', '), path, serviceType: trade.name }),
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
  // Thin pages hurt the whole site in Google, so these only get indexed once there's real content.
  if (!jobs.length && !tradies.length) res.locals.robots = 'noindex, follow';

  res.render('pages/trade', {
    title: `${info.plural} in ${label}`,
    description: seo.truncate(`Get quotes from checked ${info.plural.toLowerCase()} in ${area.places.slice(0, 4).join(', ')} and across ${label}. Post your job free. Pay only when it's done.`),
    trade,
    info,
    region,
    area,
    label,
    jobs,
    tradies,
    breadcrumbs: crumbs,
    jsonld: [
      seo.breadcrumbList(crumbs),
      seo.service({ name: `${info.plural} in ${label}`, description: info.jobs.join(', '), path, areaServed: label, serviceType: trade.name }),
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

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Disallow: /dashboard',
      'Disallow: /admin',
      'Disallow: /login',
      'Disallow: /signup',
      'Disallow: /jobs/new',
      'Disallow: /stripe/',
      '',
      `Sitemap: ${seo.url('/sitemap.xml')}`,
      '',
    ].join('\n'),
  );
});

router.get('/sitemap.xml', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const entries = [];
  const add = (path, priority, lastmod = today, changefreq = 'weekly') =>
    entries.push({ loc: seo.url(path), lastmod, changefreq, priority });

  add('/', '1.0', today, 'daily');
  add('/jobs', '0.9', today, 'daily');
  for (const s of C.SECTORS) add(s.path, '0.9');
  add('/how-it-works', '0.7', today, 'monthly');
  add('/for-tradies', '0.8', today, 'monthly');
  add('/trades', '0.8');
  add('/areas', '0.8');
  for (const t of SEO_TRADES) add(`/trades/${t.slug}`, '0.8');
  for (const r of C.REGIONS) add(`/areas/${r.slug}`, '0.7');

  const combos = activeComboSet();
  for (const t of SEO_TRADES) {
    for (const r of C.REGIONS) if (combos.has(`${t.slug}/${r.slug}`)) add(`/trades/${t.slug}/${r.slug}`, '0.6');
  }
  for (const job of q.openJobs.all()) add(`/jobs/${job.id}`, '0.5', job.created_at.slice(0, 10), 'daily');
  for (const p of q.profiles.all()) add(`/tradies/${p.id}`, '0.5', (p.updated || today).slice(0, 10), 'monthly');
  add('/terms', '0.2', today, 'yearly');
  add('/privacy', '0.2', today, 'yearly');

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries
      .map(
        (e) =>
          `  <url><loc>${e.loc}</loc><lastmod>${e.lastmod}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`,
      )
      .join('\n') +
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
