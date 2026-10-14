// Email templates. Each returns { subject, text, html }. Keep the wording plain and short: people
// read these on their phone between jobs.

const crypto = require('crypto');
const config = require('./config');
const C = require('./constants');
const { money, formatAbn } = require('./helpers');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const url = (path) => config.siteUrl + path;

// Signed link for turning off job alerts and reminders, so it works without logging in.
function unsubscribeToken(userId) {
  return crypto.createHmac('sha256', config.sessionSecret).update(`unsubscribe:${userId}`).digest('base64url').slice(0, 24);
}
const unsubscribeUrl = (userId) => url(`/unsubscribe?u=${userId}&t=${unsubscribeToken(userId)}`);

// lines: strings (paragraphs) or { rows: [[label, value], ...] } for a small table.
function layout({ subject, heading, lines, button, footer, unsubscribe }) {
  const textParts = [heading, ''];
  const htmlParts = [];
  for (const line of lines) {
    if (typeof line === 'string') {
      textParts.push(line, '');
      htmlParts.push(`<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#3d3b36">${esc(line)}</p>`);
    } else if (line.rows) {
      for (const [k, v] of line.rows) textParts.push(`${k}: ${v}`);
      textParts.push('');
      htmlParts.push(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-top:1px solid #d9d4c8">` +
          line.rows
            .map(
              ([k, v], i) =>
                `<tr><td style="padding:10px 0;border-bottom:1px solid #d9d4c8;font-size:14px;color:#6e6b63">${esc(k)}</td>` +
                `<td style="padding:10px 0;border-bottom:1px solid #d9d4c8;font-size:14px;text-align:right;color:#1c1b18;${i === line.rows.length - 1 && line.total ? 'font-weight:700' : ''}">${esc(v)}</td></tr>`,
            )
            .join('') +
          `</table>`,
      );
    }
  }
  if (button) {
    textParts.push(`${button.label}: ${button.href}`, '');
    htmlParts.push(
      `<p style="margin:24px 0 8px"><a href="${esc(button.href)}" style="display:inline-block;background:#c8461b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:3px">${esc(button.label)}</a></p>`,
    );
  }
  const abn = config.businessAbn ? ` ABN ${formatAbn(config.businessAbn)}.` : '';
  const foot = [(footer ? footer + ' ' : '') + `${config.siteName}, Perth, Western Australia.${abn} Reply to this email if you need a hand.`];
  if (unsubscribe) foot.push(`Don't want these? Turn them off: ${unsubscribeUrl(unsubscribe)}`);
  textParts.push('--', ...foot);

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f5f3ee">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ee"><tr><td align="center" style="padding:28px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Helvetica,Arial,sans-serif">
<tr><td style="padding:0 4px 16px;font-size:18px;font-weight:700;color:#1c1b18;letter-spacing:-0.02em">${esc(config.siteName.toLowerCase())}</td></tr>
<tr><td style="background:#fffefb;border:1px solid #d9d4c8;border-radius:4px;padding:28px 28px 20px">
<h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:#1c1b18">${esc(heading)}</h1>
${htmlParts.join('\n')}
</td></tr>
<tr><td style="padding:16px 4px;font-size:12px;line-height:1.5;color:#6e6b63">${esc(foot[0])}${
    unsubscribe ? `<br><a href="${esc(unsubscribeUrl(unsubscribe))}" style="color:#6e6b63">Turn off job alerts and reminders</a>` : ''
  }</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text: textParts.join('\n'), html };
}

const jobNo = (job) => `#${String(job.id).padStart(4, '0')}`;
const place = (job) => `${job.suburb} ${job.postcode}`;

const T = {
  newJob: (tradie, job) =>
    layout({
      subject: `New ${C.tradeName[job.trade].toLowerCase()} job in ${job.suburb}: ${job.title}`,
      heading: job.title,
      lines: [
        { rows: [['Trade', C.tradeName[job.trade]], ['Where', place(job)], ['Budget', C.budgetName[job.budget]], ['When', C.timingName[job.timing]], ['For', C.sectorName[job.sector]]] },
        job.description.length > 400 ? job.description.slice(0, 400) + '…' : job.description,
        'Quoting is free. The first good quotes usually win, so get in early.',
      ],
      button: { label: 'See the job and quote', href: url(`/jobs/${job.id}`) },
      footer: `You're getting this because you do ${C.tradeName[job.trade].toLowerCase()} in ${C.regionName[job.region]} on ${config.siteName}.`,
      unsubscribe: tradie.id,
    }),

  quoteReceived: (customer, job, quote, business, count) =>
    layout({
      subject: `New quote for your job: ${money(quote.amount_cents)} from ${business}`,
      heading: `${business} quoted ${money(quote.amount_cents)}`,
      lines: [
        `For your job "${job.title}" in ${job.suburb}. ${count > 1 ? `You now have ${count} quotes to compare.` : "It's your first quote. More usually follow within a day or two."}`,
        quote.message.length > 300 ? quote.message.slice(0, 300) + '…' : quote.message,
        "You don't have to accept any quote. When you do, you pay and we hold the money until the job's done.",
      ],
      button: { label: 'Compare quotes', href: url(`/jobs/${job.id}`) },
    }),

  quoteAccepted: (tradie, job, quote) =>
    layout({
      subject: `You won the job: ${job.title}`,
      heading: 'Your quote was accepted',
      lines: [
        `The customer accepted your quote of ${money(quote.amount_cents)} for "${job.title}" in ${job.suburb}.`,
        "They've been asked to pay now. We'll email you as soon as the money is held, so wait for that before you start.",
      ],
      button: { label: 'View the job', href: url(`/jobs/${job.id}`) },
    }),

  quoteDeclined: (tradie, job) =>
    layout({
      subject: `Job filled: ${job.title}`,
      heading: 'The customer went with another quote',
      lines: [
        `Thanks for quoting on "${job.title}" in ${job.suburb}. The customer picked someone else this time.`,
        'New jobs come in every day. Keep your profile up to date, as customers look at it when comparing quotes.',
      ],
      button: { label: 'Browse open jobs', href: url('/jobs') },
    }),

  paidToTradie: (tradie, job, payment, payout) =>
    layout({
      subject: `Paid: ${money(payment.amount_cents)} held for ${job.title}`,
      heading: "The customer has paid. You're good to go.",
      lines: [
        `${money(payment.amount_cents)} is held for "${job.title}" in ${job.suburb}. The customer's contact details and the full address are on the job page.`,
        { rows: [['Quote', money(payment.amount_cents)], ['Our fee', `−${money(payment.fee_cents)}`], ['You get', money(payout)]], total: true },
        "When the customer signs the job off, it's paid out to your bank. Make sure your payouts are set up so there's no delay.",
      ],
      button: { label: 'Open the job', href: url(`/jobs/${job.id}`) },
    }),

  paymentReceipt: (customer, job, payment, business) =>
    layout({
      subject: `Payment received for ${job.title}`,
      heading: 'Payment received and held',
      lines: [
        `Thanks. We're holding ${money(payment.amount_cents + payment.customer_fee_cents)} for "${job.title}". ${business} has been told to go ahead, and now has your contact details to arrange a time.`,
        { rows: [
          ['Job', `${jobNo(job)} ${job.title}`],
          ['Tradie', business],
          ...(payment.customer_fee_cents
            ? [['Quote', money(payment.amount_cents)], ['Secure payment fee', money(payment.customer_fee_cents)]]
            : []),
          ['Paid', money(payment.amount_cents + payment.customer_fee_cents)],
        ], total: true },
        "Nothing goes to the tradie until you tell us the job's done. If something goes wrong, reply to this email before you release the payment.",
        ...(payment.customer_fee_cents ? ["If the job is refunded, the quote amount comes back to you. The secure payment fee isn't refundable."] : []),
      ],
      button: { label: 'View the job', href: url(`/jobs/${job.id}`) },
    }),

  releasedToTradie: (tradie, job, payment, payout) =>
    layout({
      subject: `${money(payout)} is on its way to you`,
      heading: `${money(payout)} is on its way`,
      lines: [
        `The customer signed off "${job.title}". We've sent your payout to Stripe, and it usually lands in your bank within 2 business days.`,
        { rows: [['Quote', money(payment.amount_cents)], ['Our fee', `−${money(payment.fee_cents)}`], ['Paid out', money(payout)]], total: true },
        'Good reviews win more work. If they leave one, it shows on your profile straight away.',
      ],
      button: { label: 'View the job', href: url(`/jobs/${job.id}`) },
    }),

  reviewRequest: (customer, job, business) =>
    layout({
      subject: `How did ${business} go?`,
      heading: `How did ${business} go?`,
      lines: [
        `You've released the payment for "${job.title}". A quick review helps the next person pick a good tradie, and helps good tradies win more work.`,
      ],
      button: { label: 'Leave a review', href: url(`/jobs/${job.id}#review`) },
    }),

  refunded: (customer, job, payment) =>
    layout({
      subject: `Refund for ${job.title}`,
      heading: "We've refunded your payment",
      lines: [
        `${money(payment.refunded_cents ?? payment.amount_cents)} has been refunded to your card for "${job.title}". It usually shows up within 5 to 10 business days, depending on your bank.`,
        ...(payment.customer_fee_cents && (payment.refunded_cents ?? payment.amount_cents) < payment.amount_cents + payment.customer_fee_cents
          ? [`The ${money(payment.customer_fee_cents)} secure payment fee isn't refundable, as it covers card costs that were already paid.`]
          : []),
      ],
      button: { label: 'Post another job', href: url('/jobs/new') },
    }),

  tradieApproved: (tradie, business) =>
    layout({
      subject: `${business} is approved. Start quoting.`,
      heading: "You're approved",
      lines: [
        `We've checked your ABN and insurance, and ${business} can now quote on jobs. We'll email you when a job comes up that matches your trades and areas.`,
        "One more step so you get paid without delay: connect your bank through Stripe. It takes about 5 minutes.",
      ],
      button: { label: 'Set up payouts', href: url('/dashboard/payouts') },
    }),

  tradieRejected: (tradie, business) =>
    layout({
      subject: `About your ${config.siteName} application`,
      heading: "We couldn't approve your account yet",
      lines: [
        `We weren't able to confirm everything for ${business}. Usually it's an ABN that doesn't match the business name, or insurance that's expired or missing.`,
        "Check your details and save them again, or reply to this email and we'll tell you what's missing.",
      ],
      button: { label: 'Update your details', href: url('/dashboard/profile') },
    }),

  newTradieForReview: (admin, tradie, profile) =>
    layout({
      subject: `New tradie to check: ${profile.business_name}`,
      heading: `${profile.business_name} wants to join`,
      lines: [
        { rows: [['Name', tradie.name], ['Email', tradie.email], ['ABN', formatAbn(profile.abn)], ['Trades', profile.trades.split(',').map((t) => C.tradeName[t]).join(', ')], ['Licence', profile.licence_no || 'None given'], ['Insurer', `${profile.insurer || '?'} (expires ${profile.insurance_expiry || '?'})`]] },
        'Check the ABN on abr.business.gov.au and the licence with Building and Energy WA before approving.',
      ],
      button: { label: 'Review in admin', href: url('/admin#tradies') },
    }),

  disputeOpened: (admin, job, payment) =>
    layout({
      subject: `Card dispute on job ${jobNo(job)}: action needed`,
      heading: 'A customer has disputed a card payment',
      lines: [
        `The payment of ${money(payment.amount_cents + payment.customer_fee_cents)} for "${job.title}" has been disputed with the customer's bank. Release is blocked until it's sorted.`,
        'Respond in the Stripe dashboard (Payments > Disputes) before the deadline, with the quote, messages and any photos of the finished work.',
      ],
      button: { label: 'Open Stripe disputes', href: 'https://dashboard.stripe.com/disputes' },
    }),

  teamInvite: (invite, businessName, link) =>
    layout({
      subject: `${businessName} has added you on ${config.siteName}`,
      heading: `Join ${businessName} on ${config.siteName}`,
      lines: [`Hi ${invite.name}, you've been added to the ${businessName} team. Set a password to get started.`],
      button: { label: 'Accept the invite', href: link },
    }),

  passwordReset: (user, link) =>
    layout({
      subject: `Reset your ${config.siteName} password`,
      heading: 'Reset your password',
      lines: [
        'Someone asked to reset the password for this account. If it was you, use the button below. The link works for one hour.',
        "If it wasn't you, ignore this email. Your password won't change.",
      ],
      button: { label: 'Choose a new password', href: link },
    }),

  // ---- Reminders ----

  quotesWaiting: (customer, job, count) =>
    layout({
      subject: `${count} quote${count === 1 ? '' : 's'} waiting on your job`,
      heading: `You have ${count} quote${count === 1 ? '' : 's'} to look at`,
      lines: [
        `Tradies have quoted on "${job.title}". Good tradies book up fast, so have a look while the prices still stand.`,
        "Not going ahead? Close the job so tradies aren't left waiting.",
      ],
      button: { label: 'Compare quotes', href: url(`/jobs/${job.id}`) },
      unsubscribe: customer.id,
    }),

  releaseReminder: (customer, job, payment, business) =>
    layout({
      subject: `Is the job done? ${job.title}`,
      heading: `Is ${business} finished?`,
      lines: [
        `We're still holding ${money(payment.amount_cents)} for "${job.title}". If the work's done and you're happy, release the payment so ${business} gets paid.`,
        "If something isn't right, reply to this email and tell us. Don't release it until it's sorted.",
      ],
      button: { label: 'Release payment', href: url(`/jobs/${job.id}#payment`) },
    }),

  finishProfile: (tradie) =>
    layout({
      subject: 'Finish your business details to start quoting',
      heading: "You're one step from quoting",
      lines: [
        "You've made an account but we don't have your business details yet. Add your ABN, trades, areas and insurance, and we'll check you over, usually within a business day.",
      ],
      button: { label: 'Add your details', href: url('/dashboard/profile') },
      unsubscribe: tradie.id,
    }),

  setUpPayouts: (tradie) =>
    layout({
      subject: 'Set up payouts so you can get paid',
      heading: 'Connect your bank to get paid',
      lines: [
        "You're approved to quote, but payouts aren't set up yet. Customers can't release payment to you until they are. It takes about 5 minutes through Stripe.",
      ],
      button: { label: 'Set up payouts', href: url('/dashboard/payouts') },
      unsubscribe: tradie.id,
    }),

  noQuotes: (admin, job, days) =>
    layout({
      subject: `No quotes after ${days} days: ${job.title}`,
      heading: `Nobody has quoted on job ${jobNo(job)}`,
      lines: [
        { rows: [['Job', job.title], ['Trade', C.tradeName[job.trade]], ['Where', `${place(job)} (${C.regionName[job.region]})`], ['Posted', `${days} days ago`]] },
        "Early on, this is where you win or lose customers. Ring a few tradies who do this work and ask them to quote, or let the customer know you're on it.",
      ],
      button: { label: 'Open the job', href: url(`/jobs/${job.id}`) },
    }),

  adminAlert: (admin, text) =>
    layout({
      subject: `Needs a look: ${text.slice(0, 70)}`,
      heading: 'Something needs a look',
      lines: [text],
      button: { label: 'Open admin', href: url('/admin#payments') },
    }),

  heldTooLong: (admin, job, payment, days) =>
    layout({
      subject: `Payment held ${days} days on job ${jobNo(job)}`,
      heading: `A payment has been held for ${days} days`,
      lines: [
        `${money(payment.amount_cents)} for "${job.title}" hasn't been released. Check in with the customer and the tradie and sort it out from the admin page.`,
      ],
      button: { label: 'Open admin', href: url('/admin#payments') },
    }),
};

module.exports = { ...T, unsubscribeToken, unsubscribeUrl };
