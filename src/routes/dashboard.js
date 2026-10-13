const express = require('express');
const db = require('../db');
const C = require('../constants');
const payments = require('../payments');
const notify = require('../notify');
const { validAbn, list } = require('../helpers');
const { flash, requireLogin, requireRole, requireCan } = require('../middleware');
const { can } = require('../permissions');

const router = express.Router();

const q = {
  customerJobs: db.prepare(`
    SELECT j.*,
      (SELECT COUNT(*) FROM quotes WHERE job_id = j.id AND status != 'withdrawn') AS quote_count
    FROM jobs j WHERE j.customer_id = ? ORDER BY j.status = 'cancelled', j.created_at DESC`),
  tradieQuotes: db.prepare(`
    SELECT q.*, j.title, j.suburb, j.status AS job_status, j.accepted_quote_id,
      p.status AS payment_status
    FROM quotes q JOIN jobs j ON j.id = q.job_id LEFT JOIN payments p ON p.job_id = j.id
    WHERE q.tradie_id = ? AND q.status != 'withdrawn' ORDER BY q.created_at DESC`),
  matchingJobs: db.prepare(`
    SELECT id, sector, title, trade, suburb, region, budget, created_at FROM jobs
    WHERE status = 'open'
      AND (',' || @trades || ',') LIKE ('%,' || trade || ',%')
      AND (',' || @regions || ',') LIKE ('%,' || region || ',%')
      AND (',' || @sectors || ',') LIKE ('%,' || sector || ',%')
      AND id NOT IN (SELECT job_id FROM quotes WHERE tradie_id = @uid)
    ORDER BY created_at DESC LIMIT 10`),
  earnings: db.prepare(`
    SELECT COALESCE(SUM(p.amount_cents - p.fee_cents), 0) AS paid_out
    FROM payments p JOIN quotes q ON q.id = p.quote_id
    WHERE q.tradie_id = ? AND p.status = 'released'`),
  upsertProfile: db.prepare(`
    INSERT INTO tradie_profiles (user_id, business_name, abn, sectors, trades, regions, licence_no, tickets, insurer, insurance_expiry, years_trading, bio)
    VALUES (@user_id, @business_name, @abn, @sectors, @trades, @regions, @licence_no, @tickets, @insurer, @insurance_expiry, @years_trading, @bio)
    ON CONFLICT (user_id) DO UPDATE SET
      business_name = excluded.business_name, abn = excluded.abn, sectors = excluded.sectors, trades = excluded.trades,
      regions = excluded.regions, tickets = excluded.tickets, licence_no = excluded.licence_no, insurer = excluded.insurer,
      insurance_expiry = excluded.insurance_expiry, years_trading = excluded.years_trading, bio = excluded.bio`),
  updateUser: db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?'),
  recheck: db.prepare("UPDATE tradie_profiles SET status = 'pending' WHERE user_id = ?"),
};

// Changes to these need checking again before the tradie can keep quoting.
function needsRecheck(before, values) {
  if (!before || before.status !== 'approved') return false;
  const today = new Date().toISOString().slice(0, 10);
  const oldTrades = before.trades.split(',');
  return (
    before.business_name !== values.business_name ||
    before.abn !== values.abn ||
    (before.licence_no || null) !== values.licence_no ||
    (before.insurer || null) !== values.insurer ||
    (values.insurance_expiry !== before.insurance_expiry && (values.insurance_expiry || '') < today) ||
    values.trades.some((t) => !oldTrades.includes(t))
  );
}

router.get('/dashboard', requireLogin, (req, res) => {
  const user = req.user;
  if (user.role === 'admin') return res.redirect('/admin');

  const accountId = req.account.ownerId;
  if (user.role === 'customer') {
    return res.render('pages/dash-customer', { title: 'Your jobs', jobs: q.customerJobs.all(accountId) });
  }

  // Workers only see the jobs assigned to them.
  if (!can(req, 'quote')) return res.redirect('/work');

  const profile = user.profile;
  res.render('pages/dash-tradie', {
    title: 'Dashboard',
    profile,
    quotes: q.tradieQuotes.all(accountId),
    matches:
      profile && profile.status === 'approved'
        ? q.matchingJobs.all({ trades: profile.trades, regions: profile.regions, sectors: profile.sectors, uid: accountId })
        : [],
    paidOut: q.earnings.get(accountId).paid_out,
  });
});

// ---- Tradie business profile ----

// A new tradie's first visit uses what they told the get-started quiz.
function prefillFromQuiz(intent, base) {
  const fromQuiz = intent && intent.path === 'tradie' ? intent : {};
  return {
    ...base,
    sectors: fromQuiz.sectors && fromQuiz.sectors.length ? fromQuiz.sectors : ['housing'],
    trades: fromQuiz.trades || [],
    regions: fromQuiz.regions || [],
  };
}

router.get('/dashboard/profile', requireRole('tradie'), requireCan('profile'), (req, res) => {
  const p = req.user.profile;
  const owner = req.account.owner;
  const values = p
    ? { ...p, sectors: p.sectors.split(','), trades: p.trades.split(','), regions: p.regions.split(','), name: owner.name, phone: owner.phone }
    : prefillFromQuiz(req.session.intent, { name: owner.name, phone: owner.phone });
  res.render('pages/profile-edit', { title: 'Business details', values });
});

router.post('/dashboard/profile', requireRole('tradie'), requireCan('profile'), (req, res) => {
  const b = req.body;
  const values = {
    user_id: req.account.ownerId,
    name: String(b.name || '').trim(),
    phone: String(b.phone || '').trim(),
    business_name: String(b.business_name || '').trim().slice(0, 100),
    abn: String(b.abn || '').replace(/\s/g, ''),
    sectors: list(b.sectors).filter((s) => C.sectorName[s]),
    trades: list(b.trades).filter((t) => C.tradeName[t]),
    regions: list(b.regions).filter((r) => C.regionName[r]),
    licence_no: String(b.licence_no || '').trim().slice(0, 50) || null,
    tickets: String(b.tickets || '').trim().slice(0, 1000) || null,
    insurer: String(b.insurer || '').trim().slice(0, 100) || null,
    insurance_expiry: /^\d{4}-\d{2}-\d{2}$/.test(b.insurance_expiry || '') ? b.insurance_expiry : null,
    years_trading: Number.isInteger(Number(b.years_trading)) && b.years_trading !== '' ? Number(b.years_trading) : null,
    bio: String(b.bio || '').trim().slice(0, 1500) || null,
  };

  let error = null;
  if (!values.name) error = 'Enter your name.';
  else if (!values.business_name) error = 'Enter your business or trading name.';
  else if (!validAbn(values.abn)) error = "That ABN doesn't look right. Check it on abr.business.gov.au.";
  else if (!values.sectors.length) error = 'Pick the kinds of work you want to see: homes, hotels, mining or all three.';
  else if (!values.trades.length) error = 'Pick at least one trade.';
  else if (!values.regions.length) error = "Pick the areas you'll travel to.";
  else if (!values.insurer || !values.insurance_expiry) error = 'We need your public liability insurer and expiry date.';

  if (error) return res.status(400).render('pages/profile-edit', { title: 'Business details', values, error });

  req.session.intent = null;
  const before = req.user.profile;
  const recheck = needsRecheck(before, values);
  db.transaction(() => {
    q.updateUser.run(values.name, values.phone || null, req.account.ownerId);
    q.upsertProfile.run({
      ...values,
      sectors: values.sectors.join(','),
      trades: values.trades.join(','),
      regions: values.regions.join(','),
    });
    if (recheck) q.recheck.run(req.account.ownerId);
  })();
  if (!before || before.status !== 'approved' || recheck) notify.tradieSubmitted(req.account.ownerId);

  flash(
    req,
    'success',
    recheck
      ? "Saved. Because your business, licence, insurance or trades changed, we'll check them again before you quote on new jobs. Usually within one business day."
      : before && before.status === 'approved'
        ? 'Details saved.'
        : "Thanks. We'll check your ABN, licence and insurance, usually within one business day.",
  );
  res.redirect('/dashboard');
});

// ---- Payouts ----

router.get('/dashboard/payouts', requireRole('tradie'), requireCan('payouts'), async (req, res, next) => {
  const profile = req.user.profile;
  if (!profile) return res.redirect('/dashboard/profile');
  try {
    const ready = await payments.refreshPayoutStatus(req.user, profile);
    if (req.query.done && ready) flash(req, 'success', "Payouts are set up. You'll get paid straight to your bank.");
    if (req.query.done) return res.redirect('/dashboard/payouts');
    res.render('pages/payouts', {
      title: 'Payouts',
      profile,
      ready,
      available: payments.available,
      simulated: payments.simulated,
    });
  } catch (err) {
    next(err);
  }
});

async function startOnboarding(req, res, next) {
  const profile = req.user.profile;
  if (!profile) return res.redirect('/dashboard/profile');
  try {
    res.redirect(303, await payments.onboardingLink(req.user, profile));
  } catch (err) {
    next(err);
  }
}
router.post('/dashboard/payouts/start', requireRole('tradie'), requireCan('payouts'), startOnboarding);
// Stripe sends people back here if an onboarding link expires.
router.get('/dashboard/payouts/start', requireRole('tradie'), requireCan('payouts'), startOnboarding);

router.post('/dashboard/payouts/stripe', requireRole('tradie'), requireCan('payouts'), async (req, res, next) => {
  try {
    const url = await payments.payoutDashboardLink(req.user.profile || {});
    res.redirect(303, url || '/dashboard/payouts');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
