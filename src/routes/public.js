const express = require('express');
const db = require('../db');
const C = require('../constants');
const seo = require('../seo');
const config = require('../config');
const { feeLabel } = require('../helpers');

const router = express.Router();

const recentJobs = db.prepare(`
  SELECT id, sector, title, trade, suburb, budget, created_at,
    (SELECT COUNT(*) FROM quotes WHERE job_id = jobs.id AND status != 'withdrawn') AS quote_count
  FROM jobs WHERE status = 'open' ORDER BY created_at DESC LIMIT 5`);

const counts = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM tradie_profiles WHERE status = 'approved') AS tradies,
    (SELECT COUNT(*) FROM jobs WHERE status = 'open') AS open_jobs`);

router.get('/', (req, res) => {
  res.render('pages/home', {
    title: null,
    jobs: recentJobs.all(),
    counts: counts.get(),
    jsonld: [seo.organization(), seo.website()],
  });
});

const SECTOR_SEO = {
  housing: {
    title: 'Home repairs, maintenance and renovations in WA',
    description: 'Get quotes from checked tradies for home repairs, maintenance and renovations in Perth and regional WA. Free to post. Your payment is held until the job is done.',
  },
  hotels: {
    title: 'Hotel maintenance and repairs in WA',
    description: 'Hotel, motel and short-stay maintenance in Perth and regional WA. Air con, bathrooms, painting and refurbishments, worked around your guests. Free to post.',
  },
  mining: {
    title: 'Mine site, camp and workshop trades in WA',
    description: 'Tradies for mine sites, camps and workshops in the Pilbara, Goldfields and across WA. List inductions and tickets up front and get quotes from tradies who hold them.',
  },
};

const sectorJobs = db.prepare(`
  SELECT id, sector, title, trade, suburb, budget, created_at,
    (SELECT COUNT(*) FROM quotes WHERE job_id = jobs.id AND status != 'withdrawn') AS quote_count
  FROM jobs WHERE status = 'open' AND sector = ? ORDER BY created_at DESC LIMIT 5`);

for (const sector of C.SECTORS) {
  router.get(sector.path, (req, res) => {
    const crumbs = [{ name: 'Home', path: '/' }, { name: sector.name, path: sector.path }];
    res.render(`pages/sector-${sector.slug}`, {
      title: SECTOR_SEO[sector.slug].title,
      description: SECTOR_SEO[sector.slug].description,
      sector,
      jobs: sectorJobs.all(sector.slug),
      breadcrumbs: crumbs,
      jsonld: [
        seo.breadcrumbList(crumbs),
        seo.service({ name: SECTOR_SEO[sector.slug].title, description: SECTOR_SEO[sector.slug].description, path: sector.path }),
      ],
    });
  });
}

router.get('/how-it-works', (req, res) => {
  res.render('pages/how', {
    title: 'How it works',
    description: 'How to get quotes from checked tradies in WA, accept one, and pay safely. Your money is held until you sign the job off.',
  });
});

router.get('/for-tradies', (req, res) => {
  res.render('pages/tradies', {
    title: 'Find work as a tradie in WA, no lead fees',
    description: `Free for tradies to join and quote on jobs across WA. No lead fees. We take ${feeLabel} only when you win the job and get paid.`,
    jsonld: [seo.faqPage(TRADIE_FAQS)],
    faqs: TRADIE_FAQS,
  });
});

router.get('/terms', (req, res) =>
  res.render('pages/terms', { title: 'Terms of use', description: `The terms for using ${config.siteName} as a customer or a tradie: posting jobs, quoting, payments held until sign-off, fees and reviews.` }),
);
router.get('/photo-credits', (req, res) =>
  res.render('pages/photo-credits', { title: 'Photo credits', description: `Who took the photos used on ${config.siteName}, where they came from, and the Creative Commons licence each one is shared under.` }),
);
router.get('/privacy', (req, res) =>
  res.render('pages/privacy', { title: 'Privacy', description: `What personal information ${config.siteName} collects, why we need it, who can see it, and how to get it corrected or deleted.` }),
);

const tradieById = db.prepare(`
  SELECT u.id, u.name, u.created_at, p.*
  FROM users u JOIN tradie_profiles p ON p.user_id = u.id
  WHERE u.id = ? AND p.status = 'approved'`);
const reviewsFor = db.prepare(`
  SELECT r.rating, r.comment, r.created_at, r.reply, u.name AS customer_name, j.title, j.suburb
  FROM reviews r JOIN users u ON u.id = r.customer_id JOIN jobs j ON j.id = r.job_id
  WHERE r.tradie_id = ? ORDER BY r.created_at DESC`);
const completedCount = db.prepare(`
  SELECT COUNT(*) AS n FROM jobs j JOIN quotes q ON q.id = j.accepted_quote_id
  WHERE q.tradie_id = ? AND j.status = 'completed'`);

router.get('/tradies/:id', (req, res, next) => {
  const tradie = tradieById.get(Number(req.params.id));
  if (!tradie) return next();
  const reviews = reviewsFor.all(tradie.id);
  const photos = db.prepare('SELECT filename, caption FROM tradie_photos WHERE user_id = ? ORDER BY id DESC LIMIT 24').all(tradie.id);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const trades = tradie.trades.split(',').map((s) => C.tradeName[s]).filter(Boolean);
  const areas = tradie.regions.split(',').map((s) => C.regionName[s]).filter(Boolean);
  const business = {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    name: tradie.business_name,
    url: seo.url(`/tradies/${tradie.id}`),
    description: tradie.bio || `${trades.join(', ')} in ${areas.join(', ')}.`,
    areaServed: areas.map((name) => ({ '@type': 'AdministrativeArea', name })),
    knowsAbout: trades,
  };
  if (tradie.logo) business.logo = seo.url(`/uploads/${tradie.logo}`);
  if (tradie.logo || photos.length) business.image = [tradie.logo, ...photos.map((p) => p.filename)].filter(Boolean).slice(0, 6).map((f) => seo.url(`/uploads/${f}`));
  if (reviews.length) {
    business.aggregateRating = { '@type': 'AggregateRating', ratingValue: avg.toFixed(1), reviewCount: reviews.length, bestRating: 5, worstRating: 1 };
    business.review = reviews.slice(0, 5).map((r) => ({
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
      author: { '@type': 'Person', name: r.customer_name.split(' ')[0] },
      datePublished: r.created_at.slice(0, 10),
      reviewBody: r.comment || undefined,
    }));
  }
  res.render('pages/tradie-profile', {
    photos,
    title: `${tradie.business_name}: ${trades[0]}${trades.length > 1 ? ' and more' : ''}`,
    description: seo.truncate(`${tradie.business_name}, ${trades.join(', ').toLowerCase()} covering ${areas.slice(0, 3).join(', ')}. ${avg ? `Rated ${avg.toFixed(1)} from ${reviews.length} reviews. ` : ''}ABN and insurance checked.`),
    jsonld: [business],
    tradie,
    reviews,
    avg,
    completed: completedCount.get(tradie.id).n,
  });
});

const TRADIE_FAQS = [
  ["What if the customer won't sign off a finished job?", "Email us with the job number. We'll talk to both of you, look at photos of the finished work, and release the payment if it was done as quoted."],
  ['What if the job turns out bigger than the quote?', "Talk to the customer first. Extra work can go up as a separate job so it's paid and held the same way."],
  [`Is the ${config.feePercent}% plus GST?`, `No. It's ${feeLabel} of the quote, all in, taken out before the payout.`],
  ['Can I deal with the customer directly next time?', "For 12 months after we introduce you, please keep jobs with that customer on the site. That's what lets us skip charging for leads."],
];

module.exports = router;
