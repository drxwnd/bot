const express = require('express');
const db = require('../db');
const payments = require('../payments');
const notify = require('../notify');
const { flash, requireRole } = require('../middleware');
const { can } = require('../permissions');
const config = require('../config');
const QRCode = require('qrcode');
const { feeFor, money, feeLabel, lastMonths } = require('../helpers');

const router = express.Router();
router.use(requireRole('admin'));

const q = {
  tradies: db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.created_at, p.*
    FROM tradie_profiles p JOIN users u ON u.id = p.user_id
    ORDER BY p.status = 'pending' DESC, u.created_at DESC`),
  jobs: db.prepare(`
    SELECT j.id, j.title, j.suburb, j.status, j.created_at, u.name AS customer_name,
      (SELECT COUNT(*) FROM quotes WHERE job_id = j.id AND status != 'withdrawn') AS quote_count
    FROM jobs j JOIN users u ON u.id = j.customer_id ORDER BY j.created_at DESC LIMIT 200`),
  payments: db.prepare(`
    SELECT p.*, j.title, tp.business_name, tp.user_id AS tradie_id
    FROM payments p JOIN jobs j ON j.id = p.job_id
    JOIN quotes q ON q.id = p.quote_id JOIN tradie_profiles tp ON tp.user_id = q.tradie_id
    WHERE p.status != 'pending' ORDER BY p.created_at DESC LIMIT 200`),
  totals: db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'released' THEN fee_cents + customer_fee_cents
        WHEN status = 'refunded' THEN MAX(0, amount_cents + customer_fee_cents - COALESCE(refunded_cents, amount_cents + customer_fee_cents)) END), 0) AS fees_earned,
      COALESCE(SUM(CASE WHEN status = 'held' THEN amount_cents + customer_fee_cents END), 0) AS held,
      COALESCE(SUM(CASE WHEN status = 'released' THEN amount_cents END), 0) AS volume
    FROM payments`),
  setStatus: db.prepare(`
    UPDATE tradie_profiles SET status = ?, approved_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE approved_at END
    WHERE user_id = ?`),
  payment: db.prepare('SELECT * FROM payments WHERE id = ?'),
  emails: db.prepare('SELECT id, to_email, kind, subject, status, error, created_at FROM emails ORDER BY id DESC LIMIT 40'),
  health: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM jobs WHERE created_at > datetime('now', '-30 days')) AS jobs_30d,
      (SELECT COUNT(*) FROM jobs j WHERE status = 'open'
        AND NOT EXISTS (SELECT 1 FROM quotes WHERE job_id = j.id AND status != 'withdrawn')) AS open_no_quotes,
      (SELECT ROUND(AVG(n), 1) FROM (SELECT COUNT(q.id) AS n FROM jobs j LEFT JOIN quotes q ON q.job_id = j.id AND q.status != 'withdrawn'
        WHERE j.created_at > datetime('now', '-30 days') GROUP BY j.id)) AS quotes_per_job,
      (SELECT COUNT(*) FROM payments WHERE status IN ('held', 'released') AND paid_at > datetime('now', '-30 days')) AS paid_30d,
      (SELECT COUNT(*) FROM tradie_profiles WHERE status = 'approved') AS tradies_live,
      (SELECT COUNT(*) FROM tradie_profiles WHERE status = 'approved' AND payouts_enabled = 1) AS tradies_payouts,
      (SELECT COUNT(*) FROM payments WHERE disputed = 1) AS disputes`),
  // People with a login, split by what they are. An account owner is a customer or a tradie business;
  // team logins act on someone else's account. Removed team logins ('!') aren't counted.
  users: db.prepare(`
    WITH owners AS (
      SELECT u.* FROM users u
      WHERE u.password_hash != '!'
        AND NOT EXISTS (SELECT 1 FROM team_members m WHERE m.user_id = u.id AND m.status = 'active')
    )
    SELECT
      (SELECT COUNT(*) FROM users WHERE password_hash != '!') AS logins,
      (SELECT COUNT(*) FROM owners WHERE role = 'customer') AS customers,
      (SELECT COUNT(DISTINCT j.customer_id) FROM jobs j JOIN owners o ON o.id = j.customer_id WHERE o.role = 'customer') AS customers_posted,
      (SELECT COUNT(*) FROM owners WHERE role = 'tradie') AS tradies,
      (SELECT COUNT(*) FROM owners o JOIN tradie_profiles p ON p.user_id = o.id WHERE p.status = 'approved') AS tradies_approved,
      (SELECT COUNT(*) FROM owners o JOIN tradie_profiles p ON p.user_id = o.id WHERE p.status = 'pending') AS tradies_pending,
      (SELECT COUNT(*) FROM owners o JOIN tradie_profiles p ON p.user_id = o.id WHERE p.status = 'rejected') AS tradies_rejected,
      (SELECT COUNT(*) FROM owners o WHERE o.role = 'tradie' AND NOT EXISTS (SELECT 1 FROM tradie_profiles p WHERE p.user_id = o.id)) AS tradies_unfinished,
      (SELECT COUNT(*) FROM team_members m JOIN users u ON u.id = m.user_id
        WHERE m.status = 'active' AND u.password_hash != '!' AND u.role != 'admin') AS team,
      (SELECT COUNT(*) FROM users WHERE role = 'admin' AND password_hash != '!') AS staff,
      (SELECT COUNT(*) FROM owners WHERE role IN ('customer', 'tradie') AND created_at > datetime('now', '-7 days')) AS new_7d,
      (SELECT COUNT(*) FROM owners WHERE role IN ('customer', 'tradie') AND created_at > datetime('now', '-30 days')) AS new_30d`),
  signupsByMonth: db.prepare(`
    SELECT strftime('%Y-%m', u.created_at) AS month, u.role, COUNT(*) AS n FROM users u
    WHERE u.role IN ('customer', 'tradie') AND u.password_hash != '!'
      AND NOT EXISTS (SELECT 1 FROM team_members m WHERE m.user_id = u.id AND m.status = 'active')
      AND u.created_at >= date('now', 'start of month', '-11 months')
    GROUP BY month, u.role`),
  newestUsers: db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.company, u.created_at, p.business_name, p.status AS profile_status,
      (SELECT COUNT(*) FROM jobs WHERE customer_id = u.id) AS jobs
    FROM users u LEFT JOIN tradie_profiles p ON p.user_id = u.id
    WHERE u.role IN ('customer', 'tradie') AND u.password_hash != '!'
      AND NOT EXISTS (SELECT 1 FROM team_members m WHERE m.user_id = u.id AND m.status = 'active')
    ORDER BY u.created_at DESC, u.id DESC LIMIT 10`),
  tradieForPayment: db.prepare(`
    SELECT tp.* FROM payments p JOIN quotes q ON q.id = p.quote_id
    JOIN tradie_profiles tp ON tp.user_id = q.tradie_id WHERE p.id = ?`),
};

// New customer and tradie accounts in each of the last 12 months, for the chart.
function signupMonths() {
  const rows = q.signupsByMonth.all();
  const count = (key, role) => (rows.find((r) => r.month === key && r.role === role) || { n: 0 }).n;
  return lastMonths(12).map((m) => {
    const customers = count(m.key, 'customer');
    const tradies = count(m.key, 'tradie');
    const n = customers + tradies;
    return {
      ...m,
      n,
      tip: `${m.long}: ${n} new account${n === 1 ? '' : 's'} (${customers} customer${customers === 1 ? '' : 's'}, ${tradies} tradie${tradies === 1 ? '' : 's'})`,
    };
  });
}

router.get('/', (req, res) => {
  res.render('pages/admin', {
    title: 'Admin',
    users: q.users.get(),
    signups: signupMonths(),
    newestUsers: q.newestUsers.all(),
    tradies: q.tradies.all(),
    jobs: q.jobs.all(),
    payments: q.payments.all(),
    totals: q.totals.get(),
    health: q.health.get(),
    emails: q.emails.all(),
    setup: [
      ['Card payments', config.stripeSecretKey ? (config.stripeSecretKey.startsWith('sk_live_') ? 'Live' : 'Test mode, no real money') : 'Not set up (simulated)', config.stripeSecretKey.startsWith('sk_live_')],
      ['Stripe webhook', config.stripeWebhookSecret ? 'Set' : 'Not set', Boolean(config.stripeWebhookSecret)],
      ['Email', config.resendApiKey ? 'Resend' : config.postmarkToken ? 'Postmark' : 'Not set up, emails are only logged below', config.emailEnabled],
      ['Tradie fee', `${config.feePercent}%${config.minFeeCents ? `, minimum $${config.minFeeCents / 100}` : ', no minimum'}`, true],
      ['Customer payment fee', config.customerFeePercent ? `${config.customerFeePercent}%` : 'Off', true],
      ['Visitor stats', config.plausibleDomain ? `Plausible (${config.plausibleDomain})` : 'Off', Boolean(config.plausibleDomain)],
    ],
  });
});

// Printable A4 flyers with a QR code, for handing out to tradies and to property managers.
// Open in a browser and print, or "Save as PDF".
const FLYERS = {
  tradies: { path: '/for-tradies', source: 'flyer-tradies' },
  customers: { path: '/jobs/new', source: 'flyer-customers' },
};

router.get('/flyer/:who', async (req, res, next) => {
  const flyer = Object.hasOwn(FLYERS, req.params.who) ? FLYERS[req.params.who] : null;
  if (!flyer) return next();
  const target = `${config.siteUrl}${flyer.path}?utm_source=${flyer.source}`;
  const qr = await QRCode.toString(target, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1c1b18', light: '#0000' } });
  res.locals.robots = 'noindex, nofollow';
  res.render('pages/flyer', {
    title: 'Flyer',
    who: req.params.who,
    qr,
    shortUrl: config.siteUrl.replace(/^https?:\/\//, '') + flyer.path,
    example: { quote: 150000, fee: feeFor(150000) },
    money,
    feeLabel,
  });
});

router.post('/tradies/:id/:action', (req, res, next) => {
  if (!['approve', 'reject'].includes(req.params.action)) return next();
  const status = req.params.action === 'approve' ? 'approved' : 'rejected';
  const id = Number(req.params.id);
  if (q.setStatus.run(status, status, id).changes) notify.tradieReviewed(id, status);
  flash(req, 'success', `Tradie ${status}. We've emailed them.`);
  res.redirect('/admin#tradies');
});

router.post('/payments/:id/:action', async (req, res, next) => {
  if (!['release', 'refund'].includes(req.params.action)) return next();
  if (!can(req, 'money')) {
    flash(req, 'error', "Support accounts can't release or refund payments. Ask the account owner.");
    return res.redirect('/admin#payments');
  }
  const payment = q.payment.get(Number(req.params.id));
  if (!payment) return res.redirect('/admin');
  if (req.params.action === 'release' && payment.disputed) {
    flash(req, 'error', 'This payment is under a card dispute. Sort it out in Stripe before releasing.');
    return res.redirect('/admin#payments');
  }
  try {
    if (req.params.action === 'release') await payments.release(payment, q.tradieForPayment.get(payment.id));
    else await payments.refund(payment);
    flash(req, 'success', `Payment ${req.params.action === 'release' ? 'released' : 'refunded'}.`);
  } catch (err) {
    flash(req, 'error', err.message);
  }
  res.redirect('/admin#payments');
});

module.exports = router;
