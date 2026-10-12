require('dotenv').config({ quiet: true });

const path = require('path');

const root = path.join(__dirname, '..');

const config = {
  siteName: process.env.SITE_NAME || 'ezbuild',
  siteUrl: (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  port: Number(process.env.PORT) || 3000,
  isProd: process.env.NODE_ENV === 'production',
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',

  // Platform fee, taken from the tradie's side when payment is released.
  feePercent: Number(process.env.PLATFORM_FEE_PERCENT || 4),

  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',

  adminEmail: (process.env.ADMIN_EMAIL || '').toLowerCase(),
  supportEmail: process.env.SUPPORT_EMAIL || 'hello@ezbuild.com.au',

  dataDir: process.env.DATA_DIR || path.join(root, 'data'),
  uploadDir: process.env.UPLOAD_DIR || path.join(root, 'uploads'),
};

config.paymentsEnabled = Boolean(config.stripeSecretKey);

if (config.isProd && config.sessionSecret === 'dev-only-secret-change-me') {
  throw new Error('SESSION_SECRET must be set in production');
}

module.exports = config;
