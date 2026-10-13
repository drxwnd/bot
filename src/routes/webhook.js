const express = require('express');
const config = require('../config');
const payments = require('../payments');
const db = require('../db');

const router = express.Router();

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!payments.stripe || !config.stripeWebhookSecret) return res.sendStatus(404);

  let event;
  try {
    event = payments.constructWebhookEvent(req.body, req.get('stripe-signature'));
  } catch (err) {
    console.warn('Stripe webhook signature check failed:', err.message);
    return res.sendStatus(400);
  }

  // Stripe retries and can deliver the same event twice. Handle each one once.
  const seen = db.prepare('INSERT OR IGNORE INTO stripe_events (id, type) VALUES (?, ?)').run(event.id, event.type);
  if (!seen.changes) return res.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await payments.confirmCheckoutSession(event.data.object);
        break;
      case 'account.updated': {
        const account = event.data.object;
        const ready = account.payouts_enabled && account.capabilities?.transfers === 'active';
        db.prepare('UPDATE tradie_profiles SET payouts_enabled = ? WHERE stripe_account_id = ?').run(
          ready ? 1 : 0,
          account.id,
        );
        break;
      }
      case 'charge.dispute.created':
        payments.disputeOpened(event.data.object);
        break;
      case 'charge.dispute.closed':
        payments.disputeClosed(event.data.object);
        break;
      case 'charge.refunded':
        payments.refundedInStripe(event.data.object);
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook failed:', err);
    // Forget it so Stripe's retry gets processed.
    db.prepare('DELETE FROM stripe_events WHERE id = ?').run(event.id);
    res.sendStatus(500);
  }
});

module.exports = router;
