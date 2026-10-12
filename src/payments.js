// Money flow ("separate charges and transfers"):
//   1. Customer pays the accepted quote by card. Funds land in the platform's Stripe balance (status: held).
//   2. Customer confirms the job is done. We transfer the quote amount minus our fee to the tradie's
//      connected Stripe account (status: released). The fee stays with the platform.
//   3. If something goes wrong before release, an admin can refund the customer.
//
// Without STRIPE_SECRET_KEY (local development only) payments are simulated so the flow can be tested.

const config = require('./config');
const db = require('./db');
const { feeFor } = require('./helpers');

const stripe = config.paymentsEnabled ? require('stripe')(config.stripeSecretKey) : null;
const simulated = !stripe && !config.isProd;

const q = {
  paymentForJob: db.prepare('SELECT * FROM payments WHERE job_id = ?'),
  paymentById: db.prepare('SELECT * FROM payments WHERE id = ?'),
  insertPayment: db.prepare(
    'INSERT INTO payments (job_id, quote_id, amount_cents, fee_cents) VALUES (?, ?, ?, ?)',
  ),
  setSession: db.prepare('UPDATE payments SET stripe_session_id = ? WHERE id = ?'),
  markHeld: db.prepare(`
    UPDATE payments SET status = 'held', paid_at = datetime('now'),
      stripe_payment_intent = ?, stripe_charge_id = ?
    WHERE id = ? AND status = 'pending'`),
  markReleased: db.prepare(`
    UPDATE payments SET status = 'released', released_at = datetime('now'), transfer_id = ?
    WHERE id = ? AND status = 'held'`),
  markRefunded: db.prepare(`UPDATE payments SET status = 'refunded' WHERE id = ? AND status = 'held'`),
  jobPaid: db.prepare(`UPDATE jobs SET status = 'paid' WHERE id = ? AND status = 'awarded'`),
  jobCompleted: db.prepare(`UPDATE jobs SET status = 'completed' WHERE id = ? AND status = 'paid'`),
  jobCancelled: db.prepare(`UPDATE jobs SET status = 'cancelled' WHERE id = ?`),
  setStripeAccount: db.prepare('UPDATE tradie_profiles SET stripe_account_id = ? WHERE user_id = ?'),
  setPayouts: db.prepare('UPDATE tradie_profiles SET payouts_enabled = ? WHERE user_id = ?'),
};

// ---- Tradie payouts (Stripe Connect Express) ----

async function onboardingLink(user, profile) {
  if (!stripe) {
    if (!simulated) throw new Error('Payments are not configured');
    q.setStripeAccount.run('acct_simulated_' + user.id, user.id);
    q.setPayouts.run(1, user.id);
    return '/dashboard/payouts?done=1';
  }

  let accountId = profile.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'AU',
      email: user.email,
      capabilities: { transfers: { requested: true } },
      business_profile: {
        name: profile.business_name,
        product_description: 'Building, repair and maintenance work in Western Australia',
      },
      metadata: { user_id: String(user.id) },
    });
    accountId = account.id;
    q.setStripeAccount.run(accountId, user.id);
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: `${config.siteUrl}/dashboard/payouts/start`,
    return_url: `${config.siteUrl}/dashboard/payouts?done=1`,
  });
  return link.url;
}

async function refreshPayoutStatus(user, profile) {
  if (!stripe || !profile.stripe_account_id) return Boolean(profile.payouts_enabled);
  const account = await stripe.accounts.retrieve(profile.stripe_account_id);
  const ready = account.payouts_enabled && account.capabilities?.transfers === 'active';
  q.setPayouts.run(ready ? 1 : 0, user.id);
  return ready;
}

async function payoutDashboardLink(profile) {
  if (!stripe || !profile.stripe_account_id) return null;
  const link = await stripe.accounts.createLoginLink(profile.stripe_account_id);
  return link.url;
}

// ---- Customer payment ----

async function startCheckout(job, quote, customer) {
  let payment = q.paymentForJob.get(job.id);
  if (!payment) {
    const info = q.insertPayment.run(job.id, quote.id, quote.amount_cents, feeFor(quote.amount_cents));
    payment = q.paymentById.get(info.lastInsertRowid);
  }
  if (payment.status !== 'pending') throw new Error('This job has already been paid');

  if (!stripe) {
    if (!simulated) throw new Error('Payments are not configured');
    markHeld(payment.id, 'pi_simulated', 'ch_simulated');
    return `/jobs/${job.id}?paid=1`;
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: customer.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'aud',
          unit_amount: quote.amount_cents,
          product_data: { name: `Job #${job.id}: ${job.title}`.slice(0, 250) },
        },
      },
    ],
    payment_intent_data: {
      transfer_group: `job_${job.id}`,
      metadata: { job_id: String(job.id), payment_id: String(payment.id) },
    },
    metadata: { job_id: String(job.id), payment_id: String(payment.id) },
    success_url: `${config.siteUrl}/jobs/${job.id}/paid?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.siteUrl}/jobs/${job.id}`,
  });
  q.setSession.run(session.id, payment.id);
  return session.url;
}

function markHeld(paymentId, paymentIntent, chargeId) {
  const payment = q.paymentById.get(paymentId);
  if (!payment) return false;
  const changed = q.markHeld.run(paymentIntent, chargeId, paymentId).changes > 0;
  if (changed) q.jobPaid.run(payment.job_id);
  return changed;
}

// Called from both the webhook and the success redirect, so it must be idempotent.
async function confirmCheckoutSession(sessionOrId) {
  if (!stripe) return false;
  const session =
    typeof sessionOrId === 'string'
      ? await stripe.checkout.sessions.retrieve(sessionOrId)
      : sessionOrId;
  if (session.payment_status !== 'paid') return false;

  const paymentId = Number(session.metadata?.payment_id);
  const payment = q.paymentById.get(paymentId);
  if (!payment || payment.stripe_session_id !== session.id) return false;

  const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
  return markHeld(paymentId, pi.id, pi.latest_charge);
}

// ---- Release / refund ----

async function release(payment, tradieProfile) {
  if (payment.status !== 'held') throw new Error('Nothing to release');
  const payout = payment.amount_cents - payment.fee_cents;
  let transferId = 'tr_simulated';

  if (stripe) {
    if (!tradieProfile.stripe_account_id) throw new Error('The tradie has not set up payouts yet');
    const transfer = await stripe.transfers.create(
      {
        amount: payout,
        currency: 'aud',
        destination: tradieProfile.stripe_account_id,
        transfer_group: `job_${payment.job_id}`,
        source_transaction: payment.stripe_charge_id,
        metadata: { job_id: String(payment.job_id), payment_id: String(payment.id) },
      },
      { idempotencyKey: `release-${payment.id}` },
    );
    transferId = transfer.id;
  }

  q.markReleased.run(transferId, payment.id);
  q.jobCompleted.run(payment.job_id);
}

async function refund(payment) {
  if (payment.status !== 'held') throw new Error('Only held payments can be refunded');
  if (stripe) {
    await stripe.refunds.create(
      { payment_intent: payment.stripe_payment_intent },
      { idempotencyKey: `refund-${payment.id}` },
    );
  }
  q.markRefunded.run(payment.id);
  q.jobCancelled.run(payment.job_id);
}

function constructWebhookEvent(rawBody, signature) {
  return stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
}

module.exports = {
  stripe,
  simulated,
  available: Boolean(stripe) || simulated,
  onboardingLink,
  refreshPayoutStatus,
  payoutDashboardLink,
  startCheckout,
  confirmCheckoutSession,
  release,
  refund,
  constructWebhookEvent,
  paymentForJob: (jobId) => q.paymentForJob.get(jobId),
};
