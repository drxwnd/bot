const config = require('./config');

const url = (path) => config.siteUrl + path;

// Pages that shouldn't show up in search results.
const PRIVATE_PATHS = [/^\/login/, /^\/signup/, /^\/logout/, /^\/dashboard/, /^\/admin/, /^\/jobs\/new/, /^\/quotes\//, /^\/stripe\//, /^\/team/, /^\/invite\//, /^\/work/, /^\/invoices/, /^\/forgot/, /^\/reset\//, /^\/unsubscribe/];

function seoDefaults(req, res, next) {
  const isPrivate = PRIVATE_PATHS.some((re) => re.test(req.path));
  res.locals.siteUrl = config.siteUrl;
  res.locals.canonical = url(req.path === '/' ? '/' : req.path.replace(/\/$/, ''));
  res.locals.robots = isPrivate ? 'noindex, nofollow' : 'index, follow';
  res.locals.ogImage = url('/img/og.png');
  res.locals.jsonld = [];
  res.locals.breadcrumbs = null;
  res.locals.googleVerification = process.env.GOOGLE_SITE_VERIFICATION || '';
  res.locals.bingVerification = config.bingVerification;
  if (isPrivate) res.set('X-Robots-Tag', 'noindex, nofollow');

  // Error pages (not found, job closed, no access) should never be indexed.
  const render = res.render.bind(res);
  res.render = (view, options, cb) => {
    if (res.statusCode >= 400 || view === 'pages/error') res.locals.robots = 'noindex, follow';
    return render(view, options, cb);
  };
  next();
}

const organization = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': url('/#org'),
  name: config.siteName,
  url: url('/'),
  logo: url('/img/icon-512.png'),
  email: config.supportEmail,
  ...(config.legalName ? { legalName: config.legalName } : {}),
  ...(config.businessAbn ? { taxID: config.businessAbn } : {}),
  areaServed: { '@type': 'State', name: 'Western Australia' },
  address: { '@type': 'PostalAddress', addressLocality: 'Perth', addressRegion: 'WA', addressCountry: 'AU' },
});

const website = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': url('/#website'),
  name: config.siteName,
  url: url('/'),
  publisher: { '@id': url('/#org') },
  inLanguage: 'en-AU',
});

function breadcrumbList(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: url(item.path),
    })),
  };
}

function faqPage(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

function service({ name, description, path, areaServed = 'Western Australia', serviceType, prices }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    url: url(path),
    serviceType: serviceType || name,
    provider: { '@id': url('/#org') },
    areaServed: { '@type': 'AdministrativeArea', name: areaServed },
    // The typical range of real paid jobs, when there are enough of them (see priceGuide).
    ...(prices
      ? { offers: { '@type': 'AggregateOffer', priceCurrency: 'AUD', lowPrice: (prices.low / 100).toFixed(2), highPrice: (prices.high / 100).toFixed(2), offerCount: prices.jobs } }
      : {}),
  };
}

// Keeps JSON-LD from breaking out of its <script> tag.
function jsonForScript(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function truncate(text, max = 155) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : clean.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

module.exports = { url, seoDefaults, organization, website, breadcrumbList, faqPage, service, jsonForScript, truncate };
