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
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook failed:', err);
    res.sendStatus(500);
  }
});

module.exports = router;
