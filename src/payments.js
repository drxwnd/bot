// Money flow ("separate charges and transfers"):
//   1. Customer pays the accepted quote by card. Funds land in the platform's Stripe balance (status: held).
//   2. Customer confirms the job is done. We transfer the quote amount minus our fee to the tradie's
//      connected Stripe account (status: released). The fee stays with the platform.
//   3. If something goes wrong before release, an admin can refund the customer. Only the quote
//      amount goes back: the secure payment fee (customer_fee_cents) is kept, since the card costs
//      it covers have already been paid.
//
// Without STRIPE_SECRET_KEY (local development only) payments are simulated so the flow can be tested.

const config = require('./config');
const db = require('./db');
const { feeFor, customerFeeFor } = require('./helpers');
const notify = require('./notify');

const stripe = config.paymentsEnabled ? require('stripe')(config.stripeSecretKey) : null;
const simulated = !stripe && !config.isProd;

const q = {
  paymentForJob: db.prepare('SELECT * FROM payments WHERE job_id = ?'),
  paymentById: db.prepare('SELECT * FROM payments WHERE id = ?'),
  insertPayment: db.prepare(
    'INSERT INTO payments (job_id, quote_id, amount_cents, fee_cents, customer_fee_cents) VALUES (?, ?, ?, ?, ?)',
  ),
  setSession: db.prepare('UPDATE payments SET stripe_session_id = ? WHERE id = ?'),
  markHeld: db.prepare(`
    UPDATE payments SET status = 'held', paid_at = datetime('now'),
      stripe_payment_intent = ?, stripe_charge_id = ?
    WHERE id = ? AND status = 'pending'`),
  markReleased: db.prepare(`
    UPDATE payments SET status = 'released', released_at = datetime('now'), transfer_id = ?
    WHERE id = ? AND status = 'held'`),
  markRefunded: db.prepare(`UPDATE payments SET status = 'refunded', refunded_cents = ? WHERE id = ? AND status = 'held'`),
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

// A double-clicked Pay button sends two requests at once. Both would find no open checkout page and
// make one each, and the customer could pay twice, so the second waits for the first and gets its page.
const checkingOut = new Map();
function startCheckout(job, quote, customer) {
  if (checkingOut.has(job.id)) return checkingOut.get(job.id);
  const started = doStartCheckout(job, quote, customer).finally(() => checkingOut.delete(job.id));
  checkingOut.set(job.id, started);
  return started;
}

async function doStartCheckout(job, quote, customer) {
  let payment = q.paymentForJob.get(job.id);
  if (!payment) {
    const info = q.insertPayment.run(
      job.id, quote.id, quote.amount_cents, feeFor(quote.amount_cents), customerFeeFor(quote.amount_cents),
    );
    payment = q.paymentById.get(info.lastInsertRowid);
  }
  if (payment.status !== 'pending') throw new Error('This job has already been paid');

  // Reuse the checkout page already made for this job while it's still open, so two tabs (or two
  // people on the same account) can't end up paying twice. A finished one is confirmed instead.
  if (stripe && payment.stripe_session_id) {
    const existing = await stripe.checkout.sessions.retrieve(payment.stripe_session_id);
    if (existing.status === 'open' && existing.amount_total === payment.amount_cents + payment.customer_fee_cents) return existing.url;
    if (existing.status === 'complete') {
      await confirmCheckoutSession(existing);
      return `/jobs/${job.id}?paid=1`;
    }
    if (existing.status === 'open') await stripe.checkout.sessions.expire(existing.id);
  }

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
      ...(payment.customer_fee_cents
        ? [{
            quantity: 1,
            price_data: {
              currency: 'aud',
              unit_amount: payment.customer_fee_cents,
              product_data: { name: 'Secure payment fee', description: 'Card processing, and holding your money until the job is done' },
            },
          }]
        : []),
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
  if (!changed) return false;
  if (q.jobPaid.run(payment.job_id).changes) {
    notify.paymentHeld(payment.job_id);
  } else {
    // Paid for a job that isn't waiting for payment any more (it was cancelled while the
    // checkout page was open). Send the money straight back and tell the admin.
    // The customer did nothing wrong, so this one goes back in full, fee included.
    refund(q.paymentById.get(paymentId), { full: true }).catch((err) => console.error(`Auto-refund of payment ${paymentId} failed:`, err));
    notify.adminAlert(`Payment ${paymentId} came in for job ${payment.job_id} after it was closed, so it was refunded in full automatically. Check it went through in Stripe.`);
  }
  return true;
}

// Close a checkout page that hasn't been paid yet.
async function expireCheckout(payment) {
  if (!stripe || !payment || payment.status !== 'pending' || !payment.stripe_session_id) return;
  const s = await stripe.checkout.sessions.retrieve(payment.stripe_session_id);
  if (s.status === 'open') await stripe.checkout.sessions.expire(s.id);
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
  if (!payment) return false;
  // Any session we made for this payment counts, as long as it's for the right amount.
  if (session.amount_total !== payment.amount_cents + payment.customer_fee_cents) {
    notify.adminAlert(`Checkout ${session.id} for payment ${paymentId} was for ${session.amount_total} cents, not the expected amount. Check it in Stripe.`);
    return false;
  }

  const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
  if (markHeld(paymentId, pi.id, pi.latest_charge)) return true;
  // Read it again: another confirmation may have marked it paid while we waited on Stripe.
  const now = q.paymentById.get(paymentId);
  if (now.stripe_payment_intent && now.stripe_payment_intent !== pi.id) await refundDuplicate(now, pi, session);
  return false;
}

// A second payment for a job that's already paid. It's our side's doing, so all of it goes back,
// secure payment fee included.
async function refundDuplicate(payment, pi, session) {
  await stripe.refunds.create(
    { payment_intent: pi.id, amount: session.amount_total },
    { idempotencyKey: `dup-refund-${pi.id}` },
  );
  notify.adminAlert(`A second payment (${pi.id}) came in for job ${payment.job_id}, which was already paid. It was refunded in full automatically.`);
}

// ---- Release / refund ----

// Only one money action per payment at a time. Release and refund each await Stripe, so without
// this a release and a refund clicked at the same moment could both go through. One server runs
// the site, so an in-memory lock is enough.
const busy = new Set();
async function exclusive(paymentId, fn) {
  if (busy.has(paymentId)) throw new Error('That payment is already being processed. Refresh in a moment.');
  busy.add(paymentId);
  try {
    return await fn();
  } finally {
    busy.delete(paymentId);
  }
}

async function release(payment, tradieProfile) {
  return exclusive(payment.id, () => doRelease(q.paymentById.get(payment.id), tradieProfile));
}

// `full` also gives back the secure payment fee, for refunds that are our side's doing.
async function refund(payment, { full = false } = {}) {
  return exclusive(payment.id, () => doRefund(q.paymentById.get(payment.id), full));
}

async function doRelease(payment, tradieProfile) {
  if (payment.status !== 'held') throw new Error('Nothing to release');
  if (payment.disputed) throw new Error('This payment is under a card dispute and cannot be released until that is resolved');
  // Part of it went back to the customer in Stripe. Paying the tradie the full amount on top would
  // come out of the platform's pocket, so it waits for an admin to sort it out.
  if (payment.refunded_cents > 0) throw new Error('Part of this payment was refunded in Stripe, so it cannot be released. An admin needs to sort it out with the customer and tradie.');
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

  if (q.markReleased.run(transferId, payment.id).changes) {
    q.jobCompleted.run(payment.job_id);
    notify.paymentReleased(payment.job_id);
  }
}

async function doRefund(payment, full = false) {
  if (payment.status !== 'held') throw new Error('Only held payments can be refunded');
  const amount = payment.amount_cents + (full ? payment.customer_fee_cents : 0);
  // After a part refund in Stripe, only the rest of the quote amount is still to go back.
  const remaining = amount - (payment.refunded_cents || 0);
  if (stripe && remaining > 0) {
    await stripe.refunds.create(
      { payment_intent: payment.stripe_payment_intent, amount: remaining },
      { idempotencyKey: `refund-${payment.id}` },
    );
  }
  if (q.markRefunded.run(amount, payment.id).changes) {
    q.jobCancelled.run(payment.job_id);
    notify.refunded(payment.job_id);
  }
}

// ---- Things that happen in Stripe rather than on our site ----

const byCharge = db.prepare('SELECT * FROM payments WHERE stripe_charge_id = ? OR stripe_payment_intent = ?');

function paymentForStripe(chargeId, paymentIntent) {
  return byCharge.get(chargeId || '', paymentIntent || '') || null;
}

function disputeOpened(dispute) {
  const payment = paymentForStripe(dispute.charge, dispute.payment_intent);
  if (!payment) return;
  db.prepare('UPDATE payments SET disputed = 1 WHERE id = ?').run(payment.id);
  notify.disputeOpened(payment.job_id);
}

function disputeClosed(dispute) {
  const payment = paymentForStripe(dispute.charge, dispute.payment_intent);
  if (!payment) return;
  if (dispute.status === 'won') db.prepare('UPDATE payments SET disputed = 0 WHERE id = ?').run(payment.id);
  // Lost: the bank has already taken the money back. It stays blocked from release, and if it was
  // already paid out, the tradie's transfer needs reversing in Stripe.
  else notify.adminAlert(`The card dispute on payment ${payment.id} (job ${payment.job_id}) closed as "${dispute.status}". The customer's bank has taken the money back. ${payment.status === 'released' ? 'It was already paid out, so reverse the transfer to the tradie in Stripe.' : "Don't release or refund it; mark the job sorted with the customer and tradie."}`);
}

// A refund made straight from the Stripe dashboard instead of our admin page. Refunds here leave
// the payment fee behind, so Stripe doesn't call the charge "refunded": go by the amount instead.
function refundedInStripe(charge) {
  const payment = paymentForStripe(charge.id, charge.payment_intent);
  if (!payment || payment.status !== 'held') return;
  const back = charge.amount_refunded || 0;
  if (back >= payment.amount_cents) {
    if (q.markRefunded.run(back, payment.id).changes) {
      q.jobCancelled.run(payment.job_id);
      notify.refunded(payment.job_id);
    }
  } else if (back > 0) {
    db.prepare("UPDATE payments SET refunded_cents = ? WHERE id = ? AND status = 'held'").run(back, payment.id);
    notify.adminAlert(`${back} cents of payment ${payment.id} (job ${payment.job_id}) was refunded in Stripe, but not the whole quote. It's blocked from release until you sort it out: refund the rest from /admin, or settle it with the customer and tradie in Stripe.`);
  }
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
  expireCheckout,
  disputeOpened,
  disputeClosed,
  refundedInStripe,
  paymentForJob: (jobId) => q.paymentForJob.get(jobId),
};
