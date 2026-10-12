const express = require('express');
const db = require('../db');
const C = require('../constants');

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
  res.render('pages/home', { title: null, jobs: recentJobs.all(), counts: counts.get() });
});

const sectorJobs = db.prepare(`
  SELECT id, sector, title, trade, suburb, budget, created_at,
    (SELECT COUNT(*) FROM quotes WHERE job_id = jobs.id AND status != 'withdrawn') AS quote_count
  FROM jobs WHERE status = 'open' AND sector = ? ORDER BY created_at DESC LIMIT 5`);

for (const sector of C.SECTORS) {
  router.get(sector.path, (req, res) => {
    res.render(`pages/sector-${sector.slug}`, {
      title: sector.name,
      sector,
      jobs: sectorJobs.all(sector.slug),
    });
  });
}

router.get('/how-it-works', (req, res) => {
  res.render('pages/how', { title: 'How it works' });
});

router.get('/for-tradies', (req, res) => {
  res.render('pages/tradies', { title: 'For tradies' });
});

router.get('/terms', (req, res) => res.render('pages/terms', { title: 'Terms of use' }));
router.get('/privacy', (req, res) => res.render('pages/privacy', { title: 'Privacy' }));

const tradieById = db.prepare(`
  SELECT u.id, u.name, u.created_at, p.*
  FROM users u JOIN tradie_profiles p ON p.user_id = u.id
  WHERE u.id = ? AND p.status = 'approved'`);
const reviewsFor = db.prepare(`
  SELECT r.rating, r.comment, r.created_at, u.name AS customer_name, j.title, j.suburb
  FROM reviews r JOIN users u ON u.id = r.customer_id JOIN jobs j ON j.id = r.job_id
  WHERE r.tradie_id = ? ORDER BY r.created_at DESC`);
const completedCount = db.prepare(`
  SELECT COUNT(*) AS n FROM jobs j JOIN quotes q ON q.id = j.accepted_quote_id
  WHERE q.tradie_id = ? AND j.status = 'completed'`);

router.get('/tradies/:id', (req, res, next) => {
  const tradie = tradieById.get(Number(req.params.id));
  if (!tradie) return next();
  const reviews = reviewsFor.all(tradie.id);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  res.render('pages/tradie-profile', {
    title: tradie.business_name,
    tradie,
    reviews,
    avg,
    completed: completedCount.get(tradie.id).n,
  });
});

module.exports = router;
