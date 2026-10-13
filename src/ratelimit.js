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

// Express middleware: `limit(name, 10, 60 * 60 * 1000, render)` allows 10 requests an hour per IP.
// `onLimit(req, res)` renders the friendly "slow down" response.
function limit(name, max, windowMs, onLimit) {
  return (req, res, next) => {
    if (req.method !== 'POST') return next();
    if (hit(`${name}|${req.ip}`, max, windowMs)) return next();
    res.status(429);
    if (onLimit) return onLimit(req, res);
    res.render('pages/error', { title: 'Slow down', message: 'Too many tries in a short time. Wait a while and try again.' });
  };
}

module.exports = { hit, clear, limit };
