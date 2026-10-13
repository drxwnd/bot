const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieSession = require('cookie-session');
const helmet = require('helmet');
const compression = require('compression');

const config = require('./src/config');
const { locals } = require('./src/helpers');
const { loadSession, verifyCsrf } = require('./src/middleware');
const seo = require('./src/seo');
const { TRADE_INFO, REGION_INFO } = require('./src/seo-content');

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
  jsonForScript: seo.jsonForScript,
});

app.use(compression());

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
        'img-src': ["'self'", 'data:'],
        'form-action': ["'self'", 'https://checkout.stripe.com', 'https://connect.stripe.com'],
        'upgrade-insecure-requests': config.isProd ? [] : null,
      },
    },
  }),
);

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

// Multipart forms are parsed inside their route (multer), which then runs verifyCsrf itself.
app.use((req, res, next) => (req.is('multipart/form-data') ? next() : verifyCsrf(req, res, next)));

app.use(require('./src/routes/seo'));
app.use(require('./src/routes/start'));
app.use(require('./src/routes/team'));
app.use(require('./src/routes/work'));
app.use(require('./src/routes/public'));
app.use(require('./src/routes/auth'));
app.use(require('./src/routes/jobs'));
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
  app.listen(config.port, () => {
    console.log(`${config.siteName} running at ${config.siteUrl}`);
  });
}

module.exports = app;
