// Simple in-memory rate limits, keyed by IP (or anything else). Fine for a single server.
// Old entries are swept every few minutes so the map can't grow without limit.

const buckets = new Map();

function hit(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.reset) {
    b = { n: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.n += 1;
  return b.n <= limit;
}

function clear(key) {
  buckets.delete(key);
}

const sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k);
}, 5 * 60 * 1000);
sweep.unref();

// The address to count a visitor by. One home or phone connection gets a whole IPv6 /64 (billions
// of addresses), so IPv6 is counted by its first four groups; otherwise a new address per request
// would get past every limit.
function ipKey(ip) {
  const s = String(ip || '').toLowerCase().replace(/%.*$/, '');
  if (s.startsWith('::ffff:') && s.includes('.')) return s.slice(7);
  if (!s.includes(':')) return s;
  const [h, t] = s.split('::');
  const head = h ? h.split(':') : [];
  const tail = t ? t.split(':') : [];
  const groups = t === undefined ? head : [...head, ...Array(Math.max(0, 8 - head.length - tail.length)).fill('0'), ...tail];
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

// Express middleware: `limit(name, 10, 60 * 60 * 1000, render)` allows 10 requests an hour per IP.
// `onLimit(req, res)` renders the friendly "slow down" response.
function limit(name, max, windowMs, onLimit) {
  return (req, res, next) => {
    if (req.method !== 'POST') return next();
    if (hit(`${name}|${ipKey(req.ip)}`, max, windowMs)) return next();
    res.status(429);
    if (onLimit) return onLimit(req, res);
    res.render('pages/error', { title: 'Slow down', message: 'Too many tries in a short time. Wait a while and try again.' });
  };
}

module.exports = { hit, clear, limit, ipKey };
