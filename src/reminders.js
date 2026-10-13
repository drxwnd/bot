// Follow-ups that keep jobs moving. Runs every hour from server.js. Each reminder is recorded in
// reminders_sent, so it goes out once however often this runs.
//
//   - Customer has quotes sitting there for a day: nudge them to compare.
//   - Payment held 7 and 14 days: ask the customer if the job is done.
//   - Payment held 21 days: tell the admin to step in.
//   - Job open 3 days with no quotes: tell the admin, so they can ring around.
//   - Tradie signed up but never added business details: nudge after a day.
//   - Tradie approved but payouts not set up after 2 days: nudge.

const db = require('./db');
const E = require('./emails');
const notify = require('./notify');

const q = {
  already: db.prepare('SELECT 1 FROM reminders_sent WHERE kind = ? AND ref_id = ?'),
  mark: db.prepare('INSERT OR IGNORE INTO reminders_sent (kind, ref_id) VALUES (?, ?)'),

  quotesWaiting: db.prepare(`
    SELECT j.*, COUNT(qt.id) AS n FROM jobs j JOIN quotes qt ON qt.job_id = j.id AND qt.status = 'pending'
    WHERE j.status = 'open'
    GROUP BY j.id
    HAVING MIN(qt.created_at) <= datetime('now', '-1 day')`),
  held: db.prepare(`
    SELECT p.*, j.title, j.customer_id, q.tradie_id FROM payments p
    JOIN jobs j ON j.id = p.job_id JOIN quotes q ON q.id = p.quote_id
    WHERE p.status = 'held' AND p.paid_at <= datetime('now', ?)`),
  noQuotes: db.prepare(`
    SELECT j.* FROM jobs j
    WHERE j.status = 'open' AND j.created_at <= datetime('now', '-3 days') AND j.created_at > datetime('now', '-30 days')
      AND NOT EXISTS (SELECT 1 FROM quotes WHERE job_id = j.id AND status != 'withdrawn')`),
  noProfile: db.prepare(`
    SELECT u.* FROM users u LEFT JOIN tradie_profiles p ON p.user_id = u.id
    WHERE u.role = 'tradie' AND p.user_id IS NULL AND u.email_alerts = 1 AND u.password_hash != '!'
      AND u.created_at <= datetime('now', '-1 day') AND u.created_at > datetime('now', '-14 days')
      AND NOT EXISTS (SELECT 1 FROM team_members m WHERE m.user_id = u.id)`),
  noPayouts: db.prepare(`
    SELECT u.* FROM users u JOIN tradie_profiles p ON p.user_id = u.id
    WHERE p.status = 'approved' AND p.payouts_enabled = 0 AND u.email_alerts = 1
      AND p.approved_at <= datetime('now', '-2 days')`),
  user: db.prepare('SELECT * FROM users WHERE id = ?'),
  job: db.prepare('SELECT * FROM jobs WHERE id = ?'),
};

function once(kind, refId, fn) {
  if (q.already.get(kind, refId)) return false;
  q.mark.run(kind, refId);
  fn();
  return true;
}

const daysSince = (s) => Math.floor((Date.now() - new Date(String(s).replace(' ', 'T') + 'Z').getTime()) / 86400000);

function run() {
  let sent = 0;

  for (const job of q.quotesWaiting.all()) {
    const customer = q.user.get(job.customer_id);
    if (!customer.email_alerts) continue;
    sent += once('quotes_waiting', job.id, () => notify.send(customer, 'reminder_quotes', E.quotesWaiting(customer, job, job.n)));
  }

  for (const [days, kind] of [[7, 'release_7'], [14, 'release_14']]) {
    for (const p of q.held.all(`-${days} days`)) {
      if (p.disputed) continue;
      const customer = q.user.get(p.customer_id);
      const job = q.job.get(p.job_id);
      sent += once(kind, p.id, () => notify.send(customer, 'reminder_release', E.releaseReminder(customer, job, p, notify.businessOf(p.tradie_id))));
    }
  }

  for (const p of q.held.all('-21 days')) {
    const job = q.job.get(p.job_id);
    sent += once('held_21', p.id, () => {
      for (const a of notify.admins()) notify.send(a, 'admin_held', E.heldTooLong(a, job, p, daysSince(p.paid_at)));
    });
  }

  for (const job of q.noQuotes.all()) {
    sent += once('no_quotes', job.id, () => {
      for (const a of notify.admins()) notify.send(a, 'admin_no_quotes', E.noQuotes(a, job, daysSince(job.created_at)));
    });
  }

  for (const t of q.noProfile.all()) sent += once('finish_profile', t.id, () => notify.send(t, 'reminder_profile', E.finishProfile(t)));
  for (const t of q.noPayouts.all()) sent += once('set_up_payouts', t.id, () => notify.send(t, 'reminder_payouts', E.setUpPayouts(t)));

  return sent;
}

function safeRun() {
  try {
    const n = run();
    if (n) console.log(`Reminders: sent ${n}`);
  } catch (err) {
    console.error('Reminders failed:', err);
  }
}

// Called once from server.js. The first run waits a minute so a restart loop can't spam anyone.
function start() {
  const first = setTimeout(safeRun, 60 * 1000);
  const every = setInterval(safeRun, 60 * 60 * 1000);
  first.unref();
  every.unref();
}

module.exports = { run, start };
