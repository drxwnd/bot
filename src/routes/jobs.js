const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const db = require('../db');
const config = require('../config');
const C = require('../constants');
const payments = require('../payments');
const { parseDollars } = require('../helpers');
const seo = require('../seo');
const { locate, errorMessage } = require('../locality');
const { flash, verifyCsrf, requireLogin, requireRole, requireCan, requireApprovedTradie } = require('../middleware');
const { can } = require('../permissions');

// Customer-side actions on a job. Admins act with the money permission instead.
function allowed(req, action) {
  return req.user.role === 'admin' ? can(req, 'money') : can(req, action);
}

function requireJobAction(action, message) {
  return (req, res, next) => {
    if (allowed(req, action)) return next();
    flash(req, 'error', message);
    res.redirect(`/jobs/${req.params.id}`);
  };
}
const MANAGER_ONLY = 'Only a manager or the account owner can do that. Ask them to take a look.';

const router = express.Router();

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic' };
const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + IMAGE_TYPES[file.mimetype]),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => cb(null, Boolean(IMAGE_TYPES[file.mimetype])),
});

function removeUploads(files) {
  for (const f of files || []) fs.rm(path.join(config.uploadDir, f.filename), { force: true }, () => {});
}

const q = {
  job: db.prepare(`
    SELECT j.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
      u.company AS customer_company
    FROM jobs j JOIN users u ON u.id = j.customer_id WHERE j.id = ?`),
  photos: db.prepare('SELECT filename FROM job_photos WHERE job_id = ?'),
  insertJob: db.prepare(`
    INSERT INTO jobs (customer_id, sector, title, trade, suburb, postcode, address, region, description, requirements, budget, timing)
    VALUES (@customer_id, @sector, @title, @trade, @suburb, @postcode, @address, @region, @description, @requirements, @budget, @timing)`),
  insertPhoto: db.prepare('INSERT INTO job_photos (job_id, filename) VALUES (?, ?)'),
  quotesForJob: db.prepare(`
    SELECT q.*, u.name AS tradie_name, u.email AS tradie_email, u.phone AS tradie_phone,
      p.business_name, p.licence_no, p.years_trading, p.insurer,
      (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE tradie_id = q.tradie_id) AS rating,
      (SELECT COUNT(*) FROM reviews WHERE tradie_id = q.tradie_id) AS review_count
    FROM quotes q JOIN users u ON u.id = q.tradie_id JOIN tradie_profiles p ON p.user_id = q.tradie_id
    WHERE q.job_id = ? AND q.status != 'withdrawn' ORDER BY q.amount_cents ASC`),
  quote: db.prepare('SELECT * FROM quotes WHERE id = ?'),
  myQuote: db.prepare('SELECT * FROM quotes WHERE job_id = ? AND tradie_id = ?'),
  insertQuote: db.prepare(`
    INSERT INTO quotes (job_id, tradie_id, amount_cents, message, start_date) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (job_id, tradie_id) DO UPDATE SET
      amount_cents = excluded.amount_cents, message = excluded.message, start_date = excluded.start_date,
      status = 'pending', created_at = datetime('now')`),
  withdrawQuote: db.prepare(`UPDATE quotes SET status = 'withdrawn' WHERE id = ? AND status = 'pending'`),
  acceptQuote: db.prepare(`UPDATE quotes SET status = 'accepted' WHERE id = ?`),
  declineOthers: db.prepare(`UPDATE quotes SET status = 'declined' WHERE job_id = ? AND id != ? AND status = 'pending'`),
  awardJob: db.prepare(`UPDATE jobs SET status = 'awarded', accepted_quote_id = ? WHERE id = ? AND status = 'open'`),
  cancelJob: db.prepare(`UPDATE jobs SET status = 'cancelled' WHERE id = ? AND status IN ('open', 'awarded')`),
  declineAll: db.prepare(`UPDATE quotes SET status = 'declined' WHERE job_id = ? AND status IN ('pending', 'accepted')`),
  profile: db.prepare('SELECT * FROM tradie_profiles WHERE user_id = ?'),
  review: db.prepare('SELECT * FROM reviews WHERE job_id = ?'),
  insertReview: db.prepare(
    'INSERT INTO reviews (job_id, tradie_id, customer_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
  ),
};

function loadJob(req, res, next) {
  const job = q.job.get(Number(req.params.id));
  if (!job) {
    return res.status(404).render('pages/error', {
      title: 'Job not found',
      message: "That job doesn't exist or has been removed.",
    });
  }
  req.job = job;
  next();
}

function ownsJob(req, res, next) {
  if (req.account.ownerId === req.job.customer_id || req.user.role === 'admin') return next();
  res.status(403).render('pages/error', { title: 'Not your job', message: 'Only the person who posted this job can do that.' });
}

// ---- Job board ----

router.get('/jobs', (req, res) => {
  const trade = C.tradeName[req.query.trade] ? req.query.trade : '';
  const region = C.regionName[req.query.region] ? req.query.region : '';
  const sector = C.sectorName[req.query.sector] ? req.query.sector : '';
  const where = ["j.status = 'open'"];
  const params = {};
  if (sector) { where.push('j.sector = @sector'); params.sector = sector; }
  if (trade) { where.push('j.trade = @trade'); params.trade = trade; }
  if (region) { where.push('j.region = @region'); params.region = region; }

  const jobs = db
    .prepare(`
      SELECT j.id, j.sector, j.title, j.trade, j.suburb, j.region, j.budget, j.timing, j.description, j.created_at,
        (SELECT COUNT(*) FROM quotes WHERE job_id = j.id AND status != 'withdrawn') AS quote_count,
        (SELECT COUNT(*) FROM job_photos WHERE job_id = j.id) AS photo_count
      FROM jobs j WHERE ${where.join(' AND ')} ORDER BY j.created_at DESC LIMIT 100`)
    .all(params);

  // Filtered views are near-duplicates of the main board, so keep them out of the index.
  if (trade || region || sector) res.locals.robots = 'noindex, follow';
  res.render('pages/jobs', {
    title: sector ? `${C.sectorName[sector]} jobs in WA` : 'Open trade jobs in Perth and WA',
    description: 'Repair, maintenance and building jobs posted by homeowners, hotels and mining companies across WA. Free for tradies to quote, no lead fees.',
    jobs,
    trade,
    region,
    sector,
  });
});

// ---- Post a job ----

router.get('/jobs/new', (req, res) => {
  if (!req.user) {
    // New visitors go through the quick get-started questions first, unless they've already answered them.
    if (!req.query.trade) return res.redirect('/start?path=need');
    flash(req, 'info', 'Create a free account first so tradies can send you quotes. It takes 30 seconds.');
    return res.redirect('/signup?next=' + encodeURIComponent(req.originalUrl));
  }
  if (req.user.role === 'tradie') {
    flash(req, 'info', 'Tradie accounts quote on jobs. Use a separate customer account to post one.');
    return res.redirect('/jobs');
  }
  res.render('pages/job-new', {
    title: 'Post a job',
    values: {
      trade: C.tradeName[req.query.trade] ? req.query.trade : '',
      sector: C.sectorName[req.query.sector] ? req.query.sector : 'housing',
      timing: C.timingName[req.query.timing] ? req.query.timing : '',
      region: C.regionName[req.query.region] ? req.query.region : '',
    },
  });
});

router.post(
  '/jobs',
  requireRole('customer', 'admin'),
  requireCan('post'),
  upload.array('photos', 6),
  verifyCsrf,
  (req, res) => {
    const b = req.body;
    const values = {
      customer_id: req.account.ownerId,
      sector: C.sectorName[b.sector] ? b.sector : '',
      title: String(b.title || '').trim().slice(0, 120),
      trade: String(b.trade || ''),
      address: String(b.address || '').trim().slice(0, 200),
      suburb: '',
      postcode: '',
      // Blank means "work it out from the address". Customers can override a wrong guess.
      region: C.regionName[b.region] ? b.region : '',
      description: String(b.description || '').trim().slice(0, 5000),
      // Each sector has its own extra field on the form; keep only the one that matches.
      requirements: String(b[`requirements_${b.sector}`] || '').trim().slice(0, 2000) || null,
      budget: String(b.budget || ''),
      timing: String(b.timing || ''),
    };

    let error = null;
    if (!values.sector) error = 'Pick whether this is for a home, a hotel or a mine site.';
    else if (values.title.length < 6) error = 'Give the job a short title, e.g. "Regrout shower and replace 4 cracked tiles".';
    else if (!C.tradeName[values.trade]) error = 'Pick the trade that best fits the job.';
    else if (values.sector === 'mining' && !values.requirements) error = 'Add the site requirements so tradies know what they need before quoting.';
    else if (values.description.length < 30) error = 'Describe the job in a bit more detail so tradies can price it properly.';
    else if (!values.address) error = 'Enter the address of the job. Only the suburb is shown publicly.';
    else if (!C.budgetName[values.budget]) error = 'Pick a rough budget.';
    else if (!C.timingName[values.timing]) error = 'Pick when you need it done.';

    if (!error) {
      const place = locate(values.address);
      if (place.error) error = errorMessage(place);
      else Object.assign(values, { suburb: place.suburb, postcode: place.postcode, region: values.region || place.region });
    }

    if (error) {
      removeUploads(req.files);
      return res.status(400).render('pages/job-new', { title: 'Post a job', values, error });
    }

    const id = db.transaction(() => {
      const jobId = Number(q.insertJob.run(values).lastInsertRowid);
      for (const f of req.files || []) q.insertPhoto.run(jobId, f.filename);
      return jobId;
    })();

    flash(req, 'success', "Your job is live. We'll show quotes here as they come in.");
    res.redirect(`/jobs/${id}`);
  },
);

// Live preview on the job form: shows what will be public before the job is posted.
router.get('/api/locate', (req, res) => {
  const place = locate(String(req.query.address || '').slice(0, 200));
  if (place.error) return res.json({ ok: false, message: place.error === 'empty' ? '' : errorMessage(place) });
  res.json({ ok: true, suburb: place.suburb, region: place.region, regionName: C.regionName[place.region] });
});

// ---- Job page ----

router.get('/jobs/:id', loadJob, (req, res) => {
  const job = req.job;
  const user = req.user;
  const isOwner = user && (req.account.ownerId === job.customer_id || user.role === 'admin');
  const isTradie = user && user.role === 'tradie';

  if (job.status === 'cancelled' && !isOwner) {
    return res.status(404).render('pages/error', { title: 'Job closed', message: 'This job has been closed by the customer.' });
  }

  const quotes = isOwner ? q.quotesForJob.all(job.id) : [];
  const myQuote = isTradie ? q.myQuote.get(job.id, req.account.ownerId) : null;
  const accepted = job.accepted_quote_id ? q.quote.get(job.accepted_quote_id) : null;
  const isAwardedTradie = Boolean(accepted && user && accepted.tradie_id === req.account.ownerId);

  // Workers see their jobs in the Work area, which leaves out prices.
  if (isTradie && !can(req, 'quote')) {
    const work = isAwardedTradie && db.prepare('SELECT id FROM work_orders WHERE job_id = ?').get(job.id);
    return res.redirect(work ? `/work/${work.id}` : '/work');
  }

  // Only the job owner, the winning tradie and admins see anything past "taking quotes".
  if (job.status !== 'open' && !isOwner && !isAwardedTradie) {
    return res.render('pages/error', { title: 'Job filled', message: 'This job has been awarded to another tradie.' });
  }

  let awardedTradie = null;
  if (accepted && isOwner) awardedTradie = quotes.find((x) => x.id === accepted.id) || null;

  // Only open jobs are useful to searchers. Awarded, paid or closed ones drop out of the index.
  if (job.status !== 'open') res.locals.robots = 'noindex, nofollow';
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Jobs', path: '/jobs' },
    { name: C.tradeName[job.trade], path: `/trades/${job.trade}` },
    { name: `#${String(job.id).padStart(4, '0')}`, path: `/jobs/${job.id}` },
  ];
  res.render('pages/job', {
    title: `${job.title}, ${job.suburb}`,
    description: seo.truncate(`${C.tradeName[job.trade]} job in ${job.suburb}. ${job.description}`),
    breadcrumbs: job.trade === 'other' ? null : crumbs,
    jsonld: job.trade === 'other' ? [] : [seo.breadcrumbList(crumbs)],
    job,
    photos: q.photos.all(job.id),
    quotes,
    myQuote,
    accepted,
    awardedTradie,
    isOwner,
    isTradie,
    canAccept: Boolean(isOwner && allowed(req, 'accept')),
    canPay: Boolean(isOwner && allowed(req, 'pay')),
    isAwardedTradie,
    payment: payments.paymentForJob(job.id),
    review: q.review.get(job.id),
    paymentsAvailable: payments.available,
    simulatedPayments: payments.simulated,
    justPaid: req.query.paid === '1',
  });
});

router.post('/jobs/:id/cancel', requireLogin, loadJob, ownsJob, requireJobAction('accept', MANAGER_ONLY), (req, res) => {
  const payment = payments.paymentForJob(req.job.id);
  if (payment && payment.status !== 'pending') {
    flash(req, 'error', `This job has been paid. Email ${config.supportEmail} and we'll sort out a refund.`);
    return res.redirect(`/jobs/${req.job.id}`);
  }
  db.transaction(() => {
    q.cancelJob.run(req.job.id);
    q.declineAll.run(req.job.id);
  })();
  flash(req, 'success', 'Job closed. Tradies can no longer see it.');
  res.redirect('/dashboard');
});

// ---- Quotes ----

router.post('/jobs/:id/quotes', requireRole('tradie'), requireCan('quote'), requireApprovedTradie, loadJob, (req, res) => {
  const job = req.job;
  if (job.status !== 'open') {
    flash(req, 'error', 'This job is no longer taking quotes.');
    return res.redirect(`/jobs/${job.id}`);
  }
  const amount = parseDollars(req.body.amount);
  const message = String(req.body.message || '').trim().slice(0, 3000);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(req.body.start_date || '') ? req.body.start_date : null;

  if (!amount) {
    flash(req, 'error', 'Enter your price in dollars, e.g. 850 or 1,250.');
  } else if (message.length < 20) {
    flash(req, 'error', "Add a short note about what's included so the customer can compare quotes.");
  } else {
    q.insertQuote.run(job.id, req.account.ownerId, amount, message, start);
    flash(req, 'success', 'Quote sent. The customer will see it on their job page.');
  }
  res.redirect(`/jobs/${job.id}#quote`);
});

router.post('/quotes/:id/withdraw', requireRole('tradie'), requireCan('quote'), (req, res) => {
  const quote = q.quote.get(Number(req.params.id));
  if (quote && quote.tradie_id === req.account.ownerId) {
    q.withdrawQuote.run(quote.id);
    flash(req, 'success', 'Quote withdrawn.');
    return res.redirect(`/jobs/${quote.job_id}`);
  }
  res.redirect('/dashboard');
});

router.post('/quotes/:id/accept', requireLogin, (req, res, next) => {
  const quote = q.quote.get(Number(req.params.id));
  const job = quote && q.job.get(quote.job_id);
  if (!job) return next();
  if (job.customer_id !== req.account.ownerId && req.user.role !== 'admin') return res.redirect('/dashboard');
  if (!allowed(req, 'accept')) {
    flash(req, 'error', MANAGER_ONLY);
    return res.redirect(`/jobs/${job.id}`);
  }

  if (job.status !== 'open' || quote.status !== 'pending') {
    flash(req, 'error', 'That quote can no longer be accepted.');
    return res.redirect(`/jobs/${job.id}`);
  }
  db.transaction(() => {
    q.awardJob.run(quote.id, job.id);
    q.acceptQuote.run(quote.id);
    q.declineOthers.run(job.id, quote.id);
  })();
  flash(req, 'success', 'Quote accepted. Pay now to lock it in. We hold the money until you confirm the job is done.');
  res.redirect(`/jobs/${job.id}#payment`);
});

// ---- Payment ----

router.post('/jobs/:id/pay', requireLogin, loadJob, ownsJob, requireJobAction('pay', MANAGER_ONLY), async (req, res, next) => {
  const job = req.job;
  if (job.status !== 'awarded') return res.redirect(`/jobs/${job.id}`);
  try {
    const url = await payments.startCheckout(job, q.quote.get(job.accepted_quote_id), req.user);
    res.redirect(303, url);
  } catch (err) {
    next(err);
  }
});

router.get('/jobs/:id/paid', requireLogin, loadJob, ownsJob, async (req, res, next) => {
  try {
    if (req.query.session_id) await payments.confirmCheckoutSession(String(req.query.session_id));
    res.redirect(`/jobs/${req.job.id}?paid=1`);
  } catch (err) {
    next(err);
  }
});

router.post('/jobs/:id/release', requireLogin, loadJob, ownsJob, requireJobAction('pay', MANAGER_ONLY), async (req, res, next) => {
  const job = req.job;
  const payment = payments.paymentForJob(job.id);
  if (!payment || payment.status !== 'held') return res.redirect(`/jobs/${job.id}`);

  const quote = q.quote.get(job.accepted_quote_id);
  const profile = q.profile.get(quote.tradie_id);
  if (!profile.stripe_account_id || !profile.payouts_enabled) {
    flash(req, 'error', "The tradie hasn't finished setting up payouts yet. The money is safe with us. Try again once they're set up.");
    return res.redirect(`/jobs/${job.id}`);
  }
  try {
    await payments.release(payment, profile);
    flash(req, 'success', 'Payment released. Thanks for using us. Leave a review below to help the next person pick a tradie.');
    res.redirect(`/jobs/${job.id}#review`);
  } catch (err) {
    next(err);
  }
});

// ---- Review ----

router.post('/jobs/:id/review', requireLogin, loadJob, ownsJob, (req, res) => {
  const job = req.job;
  const rating = Number(req.body.rating);
  if (job.status !== 'completed' || q.review.get(job.id)) return res.redirect(`/jobs/${job.id}`);
  if (!(rating >= 1 && rating <= 5)) {
    flash(req, 'error', 'Pick a star rating.');
    return res.redirect(`/jobs/${job.id}#review`);
  }
  const quote = q.quote.get(job.accepted_quote_id);
  q.insertReview.run(job.id, quote.tradie_id, job.customer_id, rating, String(req.body.comment || '').trim().slice(0, 2000) || null);
  flash(req, 'success', 'Thanks, your review is up.');
  res.redirect(`/jobs/${job.id}`);
});

module.exports = router;
