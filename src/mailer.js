// Sends email through Resend or Postmark (whichever has a key set), using their HTTP APIs.
// Without a key, emails are logged instead, which is what you want locally and in tests.
//
// Every email is written to the emails table first, so there's a record of what went out even if
// the provider is down. Sending never throws: a failed email must not break the page that caused it.

const config = require('./config');
const db = require('./db');

const q = {
  insert: db.prepare('INSERT INTO emails (to_email, kind, subject, body_text) VALUES (?, ?, ?, ?)'),
  done: db.prepare("UPDATE emails SET status = ?, error = ?, sent_at = datetime('now') WHERE id = ?"),
};

const quiet = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);
const pending = new Set();

// Outside production, the last few emails are kept in memory with their links intact, for tests
// and local testing. Never in production, where links are only ever in the email itself.
const outbox = [];

async function deliver(message) {
  if (config.resendApiKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${config.resendApiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: config.emailFrom,
        to: [message.to],
        reply_to: config.supportEmail,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return 'sent';
  }
  if (config.postmarkToken) {
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'x-postmark-server-token': config.postmarkToken,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        From: config.emailFrom,
        To: message.to,
        ReplyTo: config.supportEmail,
        Subject: message.subject,
        TextBody: message.text,
        HtmlBody: message.html,
        MessageStream: 'outbound',
      }),
    });
    if (!res.ok) throw new Error(`Postmark ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return 'sent';
  }
  if (!quiet) console.log(`[email not sent, no provider] to ${message.to}: ${message.subject}`);
  return 'logged';
}

// message: { to, kind, subject, text, html }
function send(message) {
  if (!message || !message.to) return Promise.resolve();
  // Reset and invite links are live passwords, so they're blanked out in the log.
  const logged = message.text.replace(/\/(reset|invite)\/[A-Za-z0-9_-]+/g, '/$1/[link removed]');
  const id = q.insert.run(message.to, message.kind, message.subject, logged).lastInsertRowid;
  if (!config.isProd) {
    outbox.push(message);
    if (outbox.length > 100) outbox.shift();
  }
  const p = deliver(message)
    .then((status) => q.done.run(status, null, id))
    .catch((err) => {
      console.error(`Email ${id} to ${message.to} failed:`, err.message);
      q.done.run('failed', err.message.slice(0, 500), id);
    })
    .finally(() => pending.delete(p));
  pending.add(p);
  return p;
}

// For tests and shutdown: wait until every email in flight has finished.
function flush() {
  return Promise.all([...pending]);
}

module.exports = { send, flush, outbox };
