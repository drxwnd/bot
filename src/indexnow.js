// IndexNow: tells Bing (and other search engines that use it) when a page is new or has changed, so new
// jobs show up in search within hours instead of waiting to be crawled, and filled jobs drop out.
// Google doesn't use IndexNow; it reads the sitemap instead.
//
// Only runs on the live site with INDEXNOW_KEY set. The key is also served at /<key>.txt, which is how
// the search engine checks the request came from us. Pinging never throws or slows a page down.

const config = require('./config');

const enabled = Boolean(config.indexNowKey) && config.isProd;

function submit(...paths) {
  if (!enabled || !paths.length) return Promise.resolve();
  const host = new URL(config.siteUrl).host;
  return fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host,
      key: config.indexNowKey,
      keyLocation: `${config.siteUrl}/${config.indexNowKey}.txt`,
      urlList: paths.map((p) => config.siteUrl + p),
    }),
  })
    .then((res) => {
      if (!res.ok && res.status !== 202) console.warn(`IndexNow answered ${res.status} for ${paths.join(', ')}`);
    })
    .catch((err) => console.warn('IndexNow ping failed:', err.message));
}

module.exports = { submit, enabled };
