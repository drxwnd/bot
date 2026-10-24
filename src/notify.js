// Who gets told what, and when. Routes call these after the database change has gone through.
// Each function looks up what it needs, so callers only pass ids.

const db = require('./db');
const config = require('./config');
const mailer = require('./mailer');
const E = require('./emails');

const q = {
  user: db.prepare('SELECT * FROM users WHERE id = ?'),
  job: db.prepare('SELECT * FROM jobs WHERE id = ?'),
  quote: db.prepare('SELECT * FROM quotes WHERE id = ?'),
  profile: db.prepare('SELECT * FROM tradie_profiles WHERE user_id = ?'),
  payment: db.prepare('SELECT * FROM payments WHERE job_id = ?'),
  liveQuotes: db.prepare("SELECT COUNT(*) AS n FROM quotes WHERE job_id = ? AND status != 'withdrawn'"),
  declined: db.prepare(`
    SELECT u.* FROM quotes q JOIN users u ON u.id = q.tradie_id
    WHERE q.job_id = ? AND q.status = 'declined'`),
  // Approved tradies who cover the job's trade, area and sector, and haven't turned alerts off.
  matching: db.prepare(`
    SELECT u.* FROM tradie_profiles p JOIN users u ON u.id = p.user_id
    WHERE p.status = 'approved' AND u.email_alerts = 1
      AND (',' || p.trades || ',') LIKE ('%,' || @trade || ',%')
      AND (',' || p.regions || ',') LIKE ('%,' || @region || ',%')
      AND (',' || p.sectors || ',') LIKE ('%,' || @sector || ',%')
    LIMIT 300`),
  admins: db.prepare("SELECT * FROM users WHERE role = 'admin' AND (admin_level IS NULL OR admin_level = 'owner')"),
  setAlerted: db.prepare('UPDATE jobs SET alerted = ? WHERE id = ?'),
  review: db.prepare('SELECT * FROM reviews WHERE id = ?'),
};

const send = (to, kind, msg) => mailer.send({ to: to.email || to, kind, ...msg });

function admins() {
  const list = q.admins.all();
  if (!list.length && config.adminEmail) return [{ email: config.adminEmail }];
  return list;
}

function businessOf(tradieId) {
  const p = q.profile.get(tradieId);
  return p ? p.business_name : q.user.get(tradieId).name;
}

// A job that's "something else" goes to handymen, who take on a bit of everything.
// Emails the matching tradies, then tells the admin how many it reached, so a job nobody will see
// gets a phone call the same day. `newAccount` when the customer signed up with this job.
function jobPosted(jobId, { newAccount = false } = {}) {
  const job = q.job.get(jobId);
  if (!job) return;
  const trade = job.trade === 'other' ? 'handyman' : job.trade;
  const tradies = q.matching.all({ trade, region: job.region, sector: job.sector }).filter((t) => t.id !== job.customer_id);
  for (const t of tradies) send(t, 'new_job', E.newJob(t, job));
  q.setAlerted.run(tradies.length, job.id);
  const customer = q.user.get(job.customer_id);
  for (const a of admins()) send(a, 'admin_new_job', E.newJobForAdmin(a, job, customer, tradies.length, newAccount));
  return tradies.length;
}

// `updated` when the tradie changed a quote they'd already sent.
function quoteReceived(quoteId, { updated = false } = {}) {
  const quote = q.quote.get(quoteId);
  const job = q.job.get(quote.job_id);
  const customer = q.user.get(job.customer_id);
  send(customer, 'quote_received', E.quoteReceived(customer, job, quote, businessOf(quote.tradie_id), q.liveQuotes.get(job.id).n, updated));
}

// The customer closed a job. Everyone who'd quoted hears, including a tradie whose quote was accepted
// but not yet paid for. `quotes` are the quotes as they were just before it closed.
function jobClosed(jobId, quotes) {
  const job = q.job.get(jobId);
  for (const qt of quotes) {
    const tradie = q.user.get(qt.tradie_id);
    if (tradie) send(tradie, 'job_closed', E.jobClosed(tradie, job, qt.status === 'accepted'));
  }
}

function reviewReceived(reviewId) {
  const review = q.review.get(reviewId);
  const job = q.job.get(review.job_id);
  const tradie = q.user.get(review.tradie_id);
  const customer = q.user.get(review.customer_id);
  send(tradie, 'review_received', E.reviewReceived(tradie, job, review, customer.name.split(' ')[0]));
}

function newSignup(userId) {
  const user = q.user.get(userId);
  if (!user || !['customer', 'tradie'].includes(user.role)) return;
  for (const a of admins()) send(a, 'admin_signup', E.newSignup(a, user));
}

function quoteAccepted(quoteId) {
  const quote = q.quote.get(quoteId);
  const job = q.job.get(quote.job_id);
  const tradie = q.user.get(quote.tradie_id);
  send(tradie, 'quote_accepted', E.quoteAccepted(tradie, job, quote));
  for (const t of q.declined.all(job.id)) send(t, 'quote_declined', E.quoteDeclined(t, job));
}

function paymentHeld(jobId) {
  const job = q.job.get(jobId);
  const payment = q.payment.get(jobId);
  const quote = q.quote.get(payment.quote_id);
  const tradie = q.user.get(quote.tradie_id);
  const customer = q.user.get(job.customer_id);
  const business = businessOf(tradie.id);
  send(tradie, 'paid_to_tradie', E.paidToTradie(tradie, job, payment, payment.amount_cents - payment.fee_cents));
  send(customer, 'payment_receipt', E.paymentReceipt(customer, job, payment, business));
}

function paymentReleased(jobId) {
  const job = q.job.get(jobId);
  const payment = q.payment.get(jobId);
  const quote = q.quote.get(payment.quote_id);
  const tradie = q.user.get(quote.tradie_id);
  const customer = q.user.get(job.customer_id);
  send(tradie, 'released', E.releasedToTradie(tradie, job, payment, payment.amount_cents - payment.fee_cents));
  send(customer, 'review_request', E.reviewRequest(customer, job, businessOf(tradie.id)));
}

function refunded(jobId) {
  const job = q.job.get(jobId);
  const payment = q.payment.get(jobId);
  send(q.user.get(job.customer_id), 'refunded', E.refunded(null, job, payment));
}

function tradieReviewed(tradieId, status) {
  const tradie = q.user.get(tradieId);
  const business = businessOf(tradieId);
  if (status === 'approved') send(tradie, 'tradie_approved', E.tradieApproved(tradie, business));
  else send(tradie, 'tradie_rejected', E.tradieRejected(tradie, business));
}

function tradieSubmitted(tradieId) {
  const tradie = q.user.get(tradieId);
  const profile = q.profile.get(tradieId);
  for (const a of admins()) send(a, 'admin_new_tradie', E.newTradieForReview(a, tradie, profile));
}

function disputeOpened(jobId) {
  const job = q.job.get(jobId);
  const payment = q.payment.get(jobId);
  for (const a of admins()) send(a, 'admin_dispute', E.disputeOpened(a, job, payment));
}

function adminAlert(text) {
  console.warn('Admin alert:', text);
  for (const a of admins()) send(a, 'admin_alert', E.adminAlert(a, text));
}

function teamInvite(invite, businessName, link) {
  send(invite.email, 'team_invite', E.teamInvite(invite, businessName, link));
}

function passwordReset(user, link) {
  send(user, 'password_reset', E.passwordReset(user, link));
}

function verifyEmail(user, link) {
  send(user, 'verify_email', E.verifyEmail(q.user.get(user.id) || user, link));
}

// A notification failing (bad data, a template bug) must never break the request that caused it.
function safe(fn) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (err) {
      console.error(`Notification ${fn.name} failed:`, err);
    }
  };
}

module.exports = {
  ...Object.fromEntries(
    Object.entries({
      jobPosted, quoteReceived, jobClosed, reviewReceived, newSignup, quoteAccepted, paymentHeld, paymentReleased, refunded,
      tradieReviewed, tradieSubmitted, disputeOpened, teamInvite, passwordReset, verifyEmail, adminAlert,
    }).map(([k, fn]) => [k, safe(fn)]),
  ),
  admins,
  businessOf,
  send,
};
