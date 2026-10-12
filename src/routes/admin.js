const express = require('express');
const db = require('../db');
const payments = require('../payments');
const { flash, requireRole } = require('../middleware');

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
      COALESCE(SUM(CASE WHEN status = 'released' THEN fee_cents END), 0) AS fees_earned,
      COALESCE(SUM(CASE WHEN status = 'held' THEN amount_cents END), 0) AS held,
      COALESCE(SUM(CASE WHEN status = 'released' THEN amount_cents END), 0) AS volume
    FROM payments`),
  setStatus: db.prepare(`
    UPDATE tradie_profiles SET status = ?, approved_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE approved_at END
    WHERE user_id = ?`),
  payment: db.prepare('SELECT * FROM payments WHERE id = ?'),
  tradieForPayment: db.prepare(`
    SELECT tp.* FROM payments p JOIN quotes q ON q.id = p.quote_id
    JOIN tradie_profiles tp ON tp.user_id = q.tradie_id WHERE p.id = ?`),
};

router.get('/', (req, res) => {
  res.render('pages/admin', {
    title: 'Admin',
    tradies: q.tradies.all(),
    jobs: q.jobs.all(),
    payments: q.payments.all(),
    totals: q.totals.get(),
  });
});

router.post('/tradies/:id/:action', (req, res, next) => {
  if (!['approve', 'reject'].includes(req.params.action)) return next();
  const status = req.params.action === 'approve' ? 'approved' : 'rejected';
  q.setStatus.run(status, status, Number(req.params.id));
  flash(req, 'success', `Tradie ${status}.`);
  res.redirect('/admin#tradies');
});

router.post('/payments/:id/:action', async (req, res, next) => {
  if (!['release', 'refund'].includes(req.params.action)) return next();
  const payment = q.payment.get(Number(req.params.id));
  if (!payment) return res.redirect('/admin');
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
