require('dotenv').config({ quiet: true });

const path = require('path');

const root = path.join(__dirname, '..');

const config = {
  siteName: process.env.SITE_NAME || 'Tradebench',
  siteUrl: (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  port: Number(process.env.PORT) || 3000,
  isProd: process.env.NODE_ENV === 'production',
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',

  // Platform fee, taken from the tradie's side when payment is released.
  feePercent: Number(process.env.PLATFORM_FEE_PERCENT || 4),

  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',

  // Smallest fee taken on a job, in cents. Card and payout costs are partly fixed per job, so a
  // pure percentage loses money on small jobs. 0 turns it off.
  minFeeCents: Math.round(Number(process.env.MIN_FEE_DOLLARS || 0) * 100),
  // Optional fee added on top for the customer at checkout ("secure payment fee"). 0 turns it off.
  customerFeePercent: Number(process.env.CUSTOMER_FEE_PERCENT || 0),

  // Email. Set one of these to send for real. Without one, emails are logged (and kept in the
  // emails table) instead of sent.
  emailFrom: process.env.EMAIL_FROM || `${process.env.SITE_NAME || 'Tradebench'} <hello@tradebench.au>`,
  resendApiKey: process.env.RESEND_API_KEY || '',
  postmarkToken: process.env.POSTMARK_TOKEN || '',

  // Optional Plausible analytics: the domain as set up in Plausible, e.g. tradebench.au.
  plausibleDomain: process.env.PLAUSIBLE_DOMAIN || '',

  adminEmail: (process.env.ADMIN_EMAIL || '').toLowerCase(),
  supportEmail: process.env.SUPPORT_EMAIL || 'hello@tradebench.au',

  dataDir: process.env.DATA_DIR || path.join(root, 'data'),
  uploadDir: process.env.UPLOAD_DIR || path.join(root, 'uploads'),
};

config.paymentsEnabled = Boolean(config.stripeSecretKey);
config.emailEnabled = Boolean(config.resendApiKey || config.postmarkToken);

if (config.isProd) {
  const problems = [];
  if (config.sessionSecret === 'dev-only-secret-change-me' || config.sessionSecret.length < 32) {
    problems.push('SESSION_SECRET must be set to a long random string (32+ characters)');
  }
  if (!/^https:\/\//.test(config.siteUrl)) problems.push('SITE_URL must be the https:// address of the site');
  if (!config.stripeSecretKey) problems.push('STRIPE_SECRET_KEY must be set, or customers cannot pay');
  if (config.stripeSecretKey && !config.stripeWebhookSecret) problems.push('STRIPE_WEBHOOK_SECRET must be set');
  if (!config.adminEmail) problems.push('ADMIN_EMAIL must be set so someone can approve tradies');
  if (problems.length) throw new Error('Not ready for production:\n  - ' + problems.join('\n  - '));
  if (!config.emailEnabled) console.warn('Warning: no email provider set (RESEND_API_KEY or POSTMARK_TOKEN). Emails will only be logged.');
  if (config.stripeSecretKey.startsWith('sk_test_')) console.warn('Warning: Stripe is in test mode. No real money will move.');
}

module.exports = config;
