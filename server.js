const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieSession = require('cookie-session');
const helmet = require('helmet');
const compression = require('compression');

const config = require('./src/config');
const { locals, formatAbn } = require('./src/helpers');
const { loadSession, verifyCsrf } = require('./src/middleware');
const seo = require('./src/seo');
const { TRADE_INFO, REGION_INFO } = require('./src/seo-content');
const { PHOTOS } = require('./src/photos');
const db = require('./src/db');
const mailer = require('./src/mailer');
const uploads = require('./src/uploads');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
Object.assign(app.locals, locals, {
  siteName: config.siteName,
  supportEmail: config.supportEmail,
  feePercent: config.feePercent,
  TRADE_INFO,
  REGION_INFO,
  PHOTOS,
  plausibleDomain: config.plausibleDomain,
  businessAbn: config.businessAbn ? formatAbn(config.businessAbn) : '',
  legalName: config.legalName,
  maxQuoteCents: config.maxQuoteCents,
  thumb: uploads.thumb,
  jsonForScript: seo.jsonForScript,
});

app.use(compression());

// For the host's health checks. Checks the database is answering, not just that Node is up.
app.get('/healthz', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.type('text').send('ok');
  } catch (err) {
    res.status(503).type('text').send('database unavailable');
  }
});

// Send old or alternate hostnames (www., the .com.au) to the main one so Google sees one site.
const redirectHosts = (process.env.REDIRECT_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
app.use((req, res, next) => {
  if (redirectHosts.includes(req.hostname)) return res.redirect(301, config.siteUrl + req.originalUrl);
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'style-src': ["'self'", 'https://fonts.googleapis.com'],
        'style-src-attr': ["'unsafe-inline'"],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'script-src': ["'self'", ...(config.plausibleDomain ? ['https://plausible.io'] : [])],
        'connect-src': ["'self'", ...(config.plausibleDomain ? ['https://plausible.io'] : [])],
        'form-action': ["'self'", 'https://checkout.stripe.com', 'https://connect.stripe.com'],
        // No page is ever shown inside a frame, ours or anyone else's (stops clickjacking).
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': config.isProd ? [] : null,
      },
    },
    frameguard: { action: 'deny' },
    // Two years, every subdomain, and eligible for the browsers' built-in HTTPS-only list.
    strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
  }),
);
// The site never needs the camera, microphone, location or payment APIs, so pages can't ask for them.
app.use((req, res, next) => {
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  next();
});

// Stripe needs the raw body to verify webhook signatures, so this is mounted before the body parsers.
app.use('/stripe', require('./src/routes/webhook'));

app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(
  cookieSession({
    name: 'tb',
    secret: config.sessionSecret,
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  }),
);
app.use(loadSession);
app.use(seo.seoDefaults);

app.use(express.static(path.join(__dirname, 'public'), { maxAge: config.isProd ? '7d' : 0 }));
fs.mkdirSync(config.uploadDir, { recursive: true });
app.use('/uploads', express.static(config.uploadDir, { maxAge: '30d' }));

// Multipart forms are parsed inside their route (multer), which then runs verifyCsrf itself. Only
// the routes that really take files are let through here; any other multipart POST is refused, so
// it can't be used to skip the CSRF check.
const MULTIPART_ROUTES = [/^\/jobs$/, /^\/work\/\d+\/notes$/, /^\/dashboard\/profile\/photos$/];
app.use((req, res, next) => {
  // Mail apps' one-click unsubscribe can't carry a form token; its signed link is checked in the route.
  if (req.method === 'POST' && req.path === '/unsubscribe/one-click') return next();
  if (!req.is('multipart/form-data')) return verifyCsrf(req, res, next);
  if (req.method === 'POST' && MULTIPART_ROUTES.some((re) => re.test(req.path))) return next();
  res.status(403).render('pages/error', { title: 'Form expired', message: 'That form timed out. Go back, refresh the page and try again.' });
});

app.use(require('./src/routes/seo'));
app.use(require('./src/routes/start'));
app.use(require('./src/routes/team'));
app.use(require('./src/routes/work'));
app.use(require('./src/routes/public'));
app.use(require('./src/routes/auth'));
app.use(require('./src/routes/jobs'));
app.use(require('./src/routes/dash'));
app.use(require('./src/routes/dashboard'));
app.use('/admin', require('./src/routes/admin'));

app.use((req, res) => {
  res.locals.robots = 'noindex, follow';
  res.status(404).render('pages/error', {
    title: 'Page not found',
    message: "We couldn't find that page. It may have been moved or the job may have been taken down.",
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.locals.robots = 'noindex, nofollow';
  res.status(500).render('pages/error', {
    title: 'Something went wrong',
    message: `Sorry, that didn't work. Try again, or email ${config.supportEmail} if it keeps happening.`,
  });
});

if (require.main === module) {
  const server = app.listen(config.port, () => {
    console.log(`${config.siteName} running at ${config.siteUrl}`);
  });
  require('./src/reminders').start();
  require('./src/backup').start();

  // Deploys send SIGTERM. Finish requests in flight and any emails being sent, then close the database cleanly.
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await mailer.flush();
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = app;
