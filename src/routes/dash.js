// The logged-in dashboard: an overview plus separate pages, with a side menu (views/partials/dash-start.ejs).
//
// Tradie businesses: overview, find jobs, quotes, earnings, reviews.
// Customers: overview, jobs, payments, reviews.
// Everyone: account settings.

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { flash, requireLogin, requireRole, requireCan, logIn, logOutEverywhere } = require('../middleware');
const { can } = require('../permissions');
const { oneOf } = require('../constants');
const { hasContactDetails, oneLine, lastMonths } = require('../helpers');
const { limit } = require('../ratelimit');
const config = require('../config');
const twostep = require('../twostep');
const verification = require('../verification');

const router = express.Router();

const q = {
  // ---- Tradie ----
  tradieQuotes: db.prepare(`
    SELECT q.*, j.title, j.suburb, j.trade, j.sector, j.status AS job_status, j.accepted_quote_id,
      p.status AS payment_status, p.fee_cents, p.released_at
    FROM quotes q JOIN jobs j ON j.id = q.job_id LEFT JOIN payments p ON p.job_id = j.id
    WHERE q.tradie_id = ? AND q.status != 'withdrawn' ORDER BY q.created_at DESC`),
  matchingJobs: db.prepare(`
    SELECT j.id, j.sector, j.title, j.trade, j.suburb, j.region, j.budget, j.timing, j.created_at,
      (SELECT COUNT(*) FROM quotes WHERE job_id = j.id AND status != 'withdrawn') AS quote_count,
      (SELECT COUNT(*) FROM job_photos WHERE job_id = j.id) AS photo_count
    FROM jobs j
    WHERE j.status = 'open' AND j.customer_id != @uid
      AND ((',' || @trades || ',') LIKE ('%,' || j.trade || ',%') OR j.trade = 'other')
      AND (',' || @regions || ',') LIKE ('%,' || j.region || ',%')
      AND (',' || @sectors || ',') LIKE ('%,' || j.sector || ',%')
      AND j.id NOT IN (SELECT job_id FROM quotes WHERE tradie_id = @uid)
    ORDER BY j.created_at DESC LIMIT @limit`),
  tradieMoney: db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN p.status = 'released' THEN p.amount_cents - p.fee_cents END), 0) AS paid_out,
      COALESCE(SUM(CASE WHEN p.status = 'released' AND p.released_at >= date('now', 'start of month') THEN p.amount_cents - p.fee_cents END), 0) AS this_month,
      COALESCE(SUM(CASE WHEN p.status = 'held' THEN p.amount_cents - p.fee_cents END), 0) AS held,
      COALESCE(SUM(CASE WHEN p.status = 'released' THEN p.fee_cents END), 0) AS fees
    FROM payments p JOIN quotes q ON q.id = p.quote_id WHERE q.tradie_id = ?`),
  payouts: db.prepare(`
    SELECT p.*, j.title, j.suburb, j.id AS job_id FROM payments p
    JOIN quotes q ON q.id = p.quote_id JOIN jobs j ON j.id = p.job_id
    WHERE q.tradie_id = ? AND p.status IN ('held', 'released', 'refunded') ORDER BY COALESCE(p.released_at, p.paid_at) DESC`),
  monthly: db.prepare(`
    SELECT strftime('%Y-%m', p.released_at) AS month, SUM(p.amount_cents - p.fee_cents) AS cents, COUNT(*) AS jobs
    FROM payments p JOIN quotes q ON q.id = p.quote_id
    WHERE q.tradie_id = ? AND p.status = 'released' AND p.released_at >= date('now', 'start of month', '-11 months')
    GROUP BY month`),
  reviewsFor: db.prepare(`
    SELECT r.*, j.title, j.suburb, u.name AS customer_name FROM reviews r
    JOIN jobs j ON j.id = r.job_id JOIN users u ON u.id = r.customer_id
    WHERE r.tradie_id = ? ORDER BY r.created_at DESC`),
  review: db.prepare('SELECT * FROM reviews WHERE id = ? AND tradie_id = ?'),
  reply: db.prepare("UPDATE reviews SET reply = ?, reply_at = datetime('now') WHERE id = ?"),

  // ---- Customer ----
  customerJobs: db.prepare(`
    SELECT j.*,
      (SELECT COUNT(*) FROM quotes WHERE job_id = j.id AND status != 'withdrawn') AS quote_count,
      (SELECT MIN(amount_cents) FROM quotes WHERE job_id = j.id AND status = 'pending') AS lowest_quote,
      (SELECT filename FROM job_photos WHERE job_id = j.id ORDER BY id LIMIT 1) AS photo,
      p.status AS payment_status, p.amount_cents + p.customer_fee_cents AS paid_cents,
      (SELECT 1 FROM reviews WHERE job_id = j.id) AS reviewed,
      tp.business_name AS tradie_business, qa.tradie_id
    FROM jobs j
    LEFT JOIN payments p ON p.job_id = j.id
    LEFT JOIN quotes qa ON qa.id = j.accepted_quote_id
    LEFT JOIN tradie_profiles tp ON tp.user_id = qa.tradie_id
    WHERE j.customer_id = ? ORDER BY j.status = 'cancelled', j.created_at DESC`),
  customerPayments: db.prepare(`
    SELECT p.*, j.title, j.suburb, tp.business_name FROM payments p
    JOIN jobs j ON j.id = p.job_id JOIN quotes q ON q.id = p.quote_id JOIN tradie_profiles tp ON tp.user_id = q.tradie_id
    WHERE j.customer_id = ? AND p.status != 'pending' ORDER BY p.paid_at DESC`),
  customerReviews: db.prepare(`
    SELECT r.*, j.title, tp.business_name FROM reviews r
    JOIN jobs j ON j.id = r.job_id JOIN tradie_profiles tp ON tp.user_id = r.tradie_id
    WHERE r.customer_id = ? ORDER BY r.created_at DESC`),

  // ---- Account ----
  user: db.prepare('SELECT * FROM users WHERE id = ?'),
  updateUser: db.prepare('UPDATE users SET name = ?, phone = ?, company = ?, email_alerts = ? WHERE id = ?'),
  setPassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
  cancelResets: db.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL"),
};

// Last 12 months (oldest first) with what was paid out in each.
function monthSeries(rows) {
  const byMonth = Object.fromEntries(rows.map((r) => [r.month, r]));
  return lastMonths(12).map((m) => ({
    ...m,
    cents: byMonth[m.key] ? byMonth[m.key].cents : 0,
    jobs: byMonth[m.key] ? byMonth[m.key].jobs : 0,
  }));
}

// What a quote means to the tradie right now.
function quoteState(qt) {
  if (qt.status === 'accepted') {
    if (qt.job_status === 'completed') return { key: 'won', label: 'Paid out', cls: 'released' };
    if (qt.job_status === 'cancelled') return { key: 'lost', label: 'Job cancelled', cls: 'cancelled' };
    if (qt.payment_status === 'held') return { key: 'won', label: 'Paid, start work', cls: 'released', action: true };
    return { key: 'won', label: 'Won, awaiting payment', cls: 'pending' };
  }
  if (qt.status === 'declined') return { key: 'lost', label: 'Not chosen', cls: 'declined' };
  if (qt.job_status !== 'open') return { key: 'lost', label: 'Job closed', cls: 'cancelled' };
  return { key: 'open', label: 'Waiting on customer', cls: 'open' };
}

function tradieContext(req) {
  const id = req.account.ownerId;
  const profile = req.user.profile;
  const quotes = q.tradieQuotes.all(id).map((qt) => ({ ...qt, state: quoteState(qt) }));
  const decided = quotes.filter((qt) => qt.state.key !== 'open');
  const won = quotes.filter((qt) => qt.state.key === 'won');
  const reviews = q.reviewsFor.all(id);
  return {
    profile,
    quotes,
    won,
    winRate: decided.length ? Math.round((won.length / decided.length) * 100) : null,
    reviews,
    rating: reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null,
    earned: q.tradieMoney.get(id),
  };
}

function customerContext(req) {
  const jobs = q.customerJobs.all(req.account.ownerId);
  const actions = [];
  for (const j of jobs) {
    if (j.status === 'open' && j.quote_count) actions.push({ job: j, kind: 'compare', text: `${j.quote_count} quote${j.quote_count === 1 ? '' : 's'} to compare`, cta: 'Compare quotes', href: `/jobs/${j.id}#quotes` });
    else if (j.status === 'awarded') actions.push({ job: j, kind: 'pay', text: `Pay ${j.tradie_business} to lock it in`, cta: 'Pay now', href: `/jobs/${j.id}#payment` });
    else if (j.status === 'paid') actions.push({ job: j, kind: 'release', text: `Release payment once ${j.tradie_business} is done`, cta: 'Review and release', href: `/jobs/${j.id}#payment` });
    else if (j.status === 'completed' && !j.reviewed) actions.push({ job: j, kind: 'review', text: `How did ${j.tradie_business} go?`, cta: 'Leave a review', href: `/jobs/${j.id}#review` });
  }
  return {
    jobs,
    actions,
    stats: {
      open: jobs.filter((j) => j.status === 'open').length,
      quotes: jobs.filter((j) => j.status === 'open').reduce((s, j) => s + j.quote_count, 0),
      held: jobs.filter((j) => j.status === 'paid').reduce((s, j) => s + (j.paid_cents || 0), 0),
      spent: jobs.filter((j) => j.status === 'completed').reduce((s, j) => s + (j.paid_cents || 0), 0),
    },
  };
}

// ---- Overview ----

router.get('/dashboard', requireLogin, (req, res) => {
  const user = req.user;
  if (user.role === 'admin') return res.redirect('/admin');

  if (user.role === 'customer') {
    return res.render('pages/dash-customer', { title: 'Dashboard', dashNav: 'overview', ...customerContext(req) });
  }

  // Workers only see the jobs assigned to them.
  if (!can(req, 'quote')) return res.redirect('/work');

  const ctx = tradieContext(req);
  const profile = ctx.profile;
  const approved = profile && profile.status === 'approved';
  const steps = [
    { done: Boolean(profile), label: 'Add your business details', href: '/dashboard/profile' },
    { done: approved, label: 'Get checked by us (usually one business day)', href: null },
    { done: Boolean(profile && profile.payouts_enabled), label: 'Connect your bank for payouts', href: '/dashboard/payouts' },
    { done: ctx.quotes.length > 0, label: 'Send your first quote', href: '/dashboard/jobs' },
  ];
  res.render('pages/dash-tradie', {
    title: 'Dashboard',
    dashNav: 'overview',
    ...ctx,
    steps,
    matches: approved
      ? q.matchingJobs.all({ trades: profile.trades, regions: profile.regions, sectors: profile.sectors, uid: req.account.ownerId, limit: 5 })
      : [],
    months: monthSeries(q.monthly.all(req.account.ownerId)).slice(-6),
  });
});

// ---- Tradie pages ----

const tradieOnly = [requireRole('tradie'), requireCan('quote')];

router.get('/dashboard/jobs', requireLogin, (req, res, next) => {
  if (req.user.role === 'customer') return customerJobs(req, res);
  if (req.user.role !== 'tradie' || !can(req, 'quote')) return next();
  const profile = req.user.profile;
  const approved = profile && profile.status === 'approved';
  res.render('pages/dash-find', {
    title: 'Jobs for you',
    dashNav: 'jobs',
    profile,
    jobs: approved
      ? q.matchingJobs.all({ trades: profile.trades, regions: profile.regions, sectors: profile.sectors, uid: req.account.ownerId, limit: 100 })
      : [],
  });
});

router.get('/dashboard/quotes', ...tradieOnly, (req, res) => {
  const ctx = tradieContext(req);
  const tab = ['open', 'won', 'lost'].includes(req.query.tab) ? req.query.tab : 'all';
  res.render('pages/dash-quotes', {
    title: 'Your quotes',
    dashNav: 'quotes',
    ...ctx,
    tab,
    shown: tab === 'all' ? ctx.quotes : ctx.quotes.filter((qt) => qt.state.key === tab),
  });
});

router.get('/dashboard/earnings', ...tradieOnly, requireCan('money'), (req, res) => {
  const ctx = tradieContext(req);
  res.render('pages/dash-earnings', {
    title: 'Earnings',
    dashNav: 'earnings',
    ...ctx,
    months: monthSeries(q.monthly.all(req.account.ownerId)),
    payouts: q.payouts.all(req.account.ownerId),
  });
});

// Spreadsheet of payouts, for the accountant.
router.get('/dashboard/earnings.csv', ...tradieOnly, requireCan('money'), (req, res) => {
  const cell = (v) => {
    const s = String(v ?? '');
    // Quote anything with commas or quotes, and stop spreadsheet formulas being injected.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const rows = [['Date paid out', 'Job', 'Title', 'Suburb', 'Quote', 'Fee', 'Paid to you', 'Status']];
  for (const p of q.payouts.all(req.account.ownerId)) {
    rows.push([
      (p.released_at || p.paid_at || '').slice(0, 10), `#${String(p.job_id).padStart(4, '0')}`, p.title, p.suburb,
      (p.amount_cents / 100).toFixed(2), (p.fee_cents / 100).toFixed(2), ((p.amount_cents - p.fee_cents) / 100).toFixed(2), p.status,
    ]);
  }
  res.type('text/csv').attachment('tradebench-earnings.csv').send(rows.map((r) => r.map(cell).join(',')).join('\n') + '\n');
});

router.get('/dashboard/reviews', requireLogin, (req, res, next) => {
  if (req.user.role === 'customer') {
    const jobs = q.customerJobs.all(req.account.ownerId);
    return res.render('pages/dash-reviews-customer', {
      title: 'Reviews',
      dashNav: 'reviews',
      reviews: q.customerReviews.all(req.account.ownerId),
      toReview: jobs.filter((j) => j.status === 'completed' && !j.reviewed),
    });
  }
  if (req.user.role !== 'tradie' || !can(req, 'quote')) return next();
  res.render('pages/dash-reviews', { title: 'Reviews', dashNav: 'reviews', ...tradieContext(req) });
});

router.post('/dashboard/reviews/:id/reply', ...tradieOnly, requireCan('profile'), (req, res) => {
  const review = q.review.get(Number(req.params.id), req.account.ownerId);
  const reply = String(req.body.reply || '').trim().slice(0, 1000);
  if (hasContactDetails(reply)) {
    flash(req, 'error', 'Leave phone numbers, emails and web links out of your reply. It goes on your public profile.');
    return res.redirect('/dashboard/reviews');
  }
  if (review && reply) {
    q.reply.run(reply, review.id);
    flash(req, 'success', 'Reply posted. It shows under the review on your public profile.');
  }
  res.redirect('/dashboard/reviews');
});

// ---- Customer pages ----

function customerJobs(req, res) {
  const ctx = customerContext(req);
  const TABS = { active: ['open', 'awarded', 'paid'], done: ['completed'], closed: ['cancelled'] };
  const tab = oneOf(TABS, req.query.tab, 'all');
  res.render('pages/dash-customer-jobs', {
    title: 'Your jobs',
    dashNav: 'jobs',
    ...ctx,
    tab,
    shown: tab === 'all' ? ctx.jobs : ctx.jobs.filter((j) => TABS[tab].includes(j.status)),
  });
}

router.get('/dashboard/payments', requireRole('customer'), (req, res) => {
  const list = q.customerPayments.all(req.account.ownerId);
  res.render('pages/dash-payments', {
    title: 'Payments',
    dashNav: 'payments',
    payments: list,
    totals: {
      held: list.filter((p) => p.status === 'held').reduce((s, p) => s + p.amount_cents + p.customer_fee_cents, 0),
      spent: list.filter((p) => p.status === 'released').reduce((s, p) => s + p.amount_cents + p.customer_fee_cents, 0),
    },
  });
});

// ---- Account settings (everyone) ----

router.get('/dashboard/account', requireLogin, (req, res) => {
  const me = q.user.get(req.user.id);
  res.render('pages/dash-account', {
    title: 'Account',
    dashNav: 'account',
    me,
    backupCodesLeft: twostep.isOn(me) ? twostep.backupCodesLeft(me.id) : 0,
    twoStepRequired: me.role === 'admin' && config.requireAdminTwoStep,
  });
});

router.post('/dashboard/account/verify-email', requireLogin, (req, res) => {
  if (req.user.email_verified_at) flash(req, 'info', 'Your email is already confirmed.');
  else if (verification.send(req.user.id)) flash(req, 'success', `We've sent a new link to ${req.user.email}. It can take a minute to arrive; check junk too.`);
  else flash(req, 'error', "We've sent a few links in the last hour. Wait a while, then try again.");
  res.redirect('/dashboard/account');
});

// ---- Two-step login ----

function twoStepPage(res, me, { setup = null, codes = null, justEnabled } = {}) {
  res.render('pages/twostep-setup', {
    title: 'Two-step login',
    dashNav: 'account',
    me,
    setup,
    codes,
    justEnabled,
    backupCodesLeft: twostep.isOn(me) ? twostep.backupCodesLeft(me.id) : 0,
    twoStepRequired: me.role === 'admin' && config.requireAdminTwoStep,
  });
}

const codeLimit = limit('twostep-setup', 10, 15 * 60 * 1000, (req, res) => {
  flash(req, 'error', 'Too many tries. Wait 15 minutes and try again.');
  res.redirect('/dashboard/account/two-step');
});

router.get('/dashboard/account/two-step', requireLogin, async (req, res, next) => {
  try {
    const me = q.user.get(req.user.id);
    // A code waiting to be scanned (first set-up or a new phone) is shown; if it's off and there isn't
    // one, a fresh one is made. If it's on with nothing pending, there's nothing to scan.
    const setup = (await twostep.details(me.id)) || (twostep.isOn(me) ? null : await twostep.begin(me.id));
    twoStepPage(res, me, { setup });
  } catch (err) {
    next(err);
  }
});

router.post('/dashboard/account/two-step/enable', requireLogin, codeLimit, async (req, res, next) => {
  const codes = twostep.confirm(req.user.id, req.body.code);
  if (!codes) {
    flash(req, 'error', "That code didn't match. Check the time on your phone is set automatically, then try the newest code.");
    return res.redirect('/dashboard/account/two-step');
  }
  // Every other device logs in again, now with a code.
  logOutEverywhere(req.user.id);
  logIn(req, req.user.id);
  twoStepPage(res, q.user.get(req.user.id), { codes, justEnabled: true });
});

router.post('/dashboard/account/two-step/backup-codes', requireLogin, codeLimit, (req, res) => {
  const me = q.user.get(req.user.id);
  if (!twostep.isOn(me) || !twostep.check(me.id, req.body.code)) {
    flash(req, 'error', "That code didn't work. Enter the code from your app.");
    return res.redirect('/dashboard/account/two-step');
  }
  const codes = twostep.newBackupCodes(me.id);
  twoStepPage(res, me, { codes });
});

router.post('/dashboard/account/two-step/disable', requireLogin, codeLimit, async (req, res) => {
  const me = q.user.get(req.user.id);
  if (me.role === 'admin' && config.requireAdminTwoStep) {
    flash(req, 'error', 'Admin accounts must keep two-step login on. To move it to a new phone, set it up again below.');
    return res.redirect('/dashboard/account/two-step');
  }
  const passwordOk = await bcrypt.compare(String(req.body.password || '').slice(0, 200), me.password_hash);
  if (!passwordOk || !twostep.check(me.id, req.body.code)) {
    flash(req, 'error', "Your password or code wasn't right.");
    return res.redirect('/dashboard/account/two-step');
  }
  twostep.turnOff(me.id);
  flash(req, 'success', 'Two-step login is off. You can turn it back on any time.');
  res.redirect('/dashboard/account');
});

// Moving to a new phone: proves they have the current one (or a backup code), then starts a fresh setup.
router.post('/dashboard/account/two-step/reset', requireLogin, codeLimit, async (req, res, next) => {
  const me = q.user.get(req.user.id);
  if (!twostep.isOn(me) || !twostep.check(me.id, req.body.code)) {
    flash(req, 'error', "That code didn't work. Enter the code from your app, or a backup code.");
    return res.redirect('/dashboard/account/two-step');
  }
  try {
    await twostep.begin(me.id);
  } catch (err) {
    return next(err);
  }
  flash(req, 'info', 'Scan the new code with your new phone. Two-step login stays on, so you need a code to log in again.');
  res.redirect('/dashboard/account/two-step');
});

router.post('/dashboard/account', requireLogin, (req, res) => {
  const me = q.user.get(req.user.id);
  const name = oneLine(req.body.name, 80);
  const phone = oneLine(req.body.phone, 30) || null;
  // Only a customer account owner names the business; team members can't rename it.
  const company = me.role === 'customer' && can(req, 'team') ? oneLine(req.body.company, 100) || null : me.company;
  if (!name) {
    flash(req, 'error', 'Enter your name.');
    return res.redirect('/dashboard/account');
  }
  q.updateUser.run(name, phone, company, req.body.email_alerts ? 1 : 0, me.id);
  flash(req, 'success', 'Saved.');
  res.redirect('/dashboard/account');
});

const passwordLimit = limit('password', 10, 15 * 60 * 1000, (req, res) => {
  flash(req, 'error', 'Too many tries. Wait 15 minutes and try again.');
  res.redirect('/dashboard/account');
});

router.post('/dashboard/account/password', requireLogin, passwordLimit, async (req, res) => {
  const me = q.user.get(req.user.id);
  const current = String(req.body.current || '');
  const next = String(req.body.password || '');
  if (!(await bcrypt.compare(current, me.password_hash))) flash(req, 'error', "Your current password isn't right.");
  else if (next.length < 8) flash(req, 'error', 'Use at least 8 characters for the new password.');
  else if (next.length > 200) flash(req, 'error', 'Use 200 characters or fewer.');
  else {
    q.setPassword.run(await bcrypt.hash(next, 11), me.id);
    // A reset link sent before the change would otherwise still let someone set a new password.
    q.cancelResets.run(me.id);
    // Every other device is logged out; this one stays logged in.
    logOutEverywhere(me.id);
    logIn(req, me.id);
    flash(req, 'success', 'Password changed. Any other devices have been logged out.');
  }
  res.redirect('/dashboard/account');
});

router.post('/dashboard/account/logout-everywhere', requireLogin, (req, res) => {
  logOutEverywhere(req.user.id);
  logIn(req, req.user.id);
  flash(req, 'success', 'Logged out of every other device.');
  res.redirect('/dashboard/account');
});

module.exports = router;
