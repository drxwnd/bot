const config = require('./config');
const C = require('./constants');

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

function money(cents) {
  return aud.format((cents || 0) / 100);
}

// "250", "250.50", "$1,200" -> cents. Returns null when it isn't a sensible amount.
function parseDollars(input) {
  const cleaned = String(input || '').replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(parseFloat(cleaned) * 100);
  return cents > 0 && cents <= 100_000_000 ? cents : null;
}

function feeFor(cents) {
  return Math.round((cents * config.feePercent) / 100);
}

// SQLite stores UTC as "YYYY-MM-DD HH:MM:SS".
function toDate(s) {
  return new Date(String(s).replace(' ', 'T') + 'Z');
}

function ago(s) {
  const mins = Math.round((Date.now() - toDate(s).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  return shortDate(s);
}

function shortDate(s) {
  return toDate(s).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Australia/Perth',
  });
}

function formatAbn(abn) {
  const d = String(abn || '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : abn;
}

// Official ABN checksum (ATO algorithm).
function validAbn(abn) {
  const d = String(abn || '').replace(/\s/g, '');
  if (!/^\d{11}$/.test(d)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = d.split('').map(Number);
  digits[0] -= 1;
  return digits.reduce((sum, n, i) => sum + n * weights[i], 0) % 89 === 0;
}

function list(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

const STATUS_LABEL = {
  open: 'Taking quotes',
  awarded: 'Quote accepted',
  paid: 'Paid, funds held',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

module.exports = {
  money,
  parseDollars,
  feeFor,
  ago,
  shortDate,
  formatAbn,
  validAbn,
  list,
  STATUS_LABEL,
  locals: { money, feeFor, ago, shortDate, formatAbn, STATUS_LABEL, ...C },
};
