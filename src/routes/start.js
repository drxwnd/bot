// "Get started" quiz for first-time visitors. A few quick questions work out who they are and
// what they need, then send them to a filled-in job form or tradie sign-up.
//
// Each answer is a plain link or GET form, so the quiz works without JavaScript and the back
// button behaves. Answers are kept in the URL until the end, then saved to the session so the
// job form, sign-up and business details form can be pre-filled.

const express = require('express');
const db = require('../db');
const C = require('../constants');
const { TRADE_INFO } = require('../seo-content');
const { list } = require('../helpers');

const router = express.Router();

const WHO = [
  { slug: 'home', name: 'Homeowner or renter', hint: 'Work on the place you live', sector: 'housing' },
  { slug: 'landlord', name: 'Landlord or property manager', hint: 'Repairs and maintenance on rentals', sector: 'housing' },
  { slug: 'hotel', name: 'Hotel, motel or short-stay', hint: 'Rooms, common areas and grounds', sector: 'hotels' },
  { slug: 'mining', name: 'Mining company or contractor', hint: 'Camps, workshops, site offices', sector: 'mining' },
];
const WHO_BY = Object.fromEntries(WHO.map((w) => [w.slug, w]));

// Trades people in each sector most often need, shown first.
const POPULAR = {
  housing: ['plumbing', 'electrical', 'tiling', 'painting', 'roofing', 'aircon', 'handyman', 'carpentry'],
  hotels: ['aircon', 'plumbing', 'electrical', 'tiling', 'painting', 'locksmith', 'appliances', 'handyman'],
  mining: ['aircon', 'electrical', 'plumbing', 'welding', 'fitting', 'scaffolding', 'carpentry', 'concreting'],
};

const PATHS = { need: true, tradie: true };
const TIMING_HINTS = {
  urgent: "We'll flag it as urgent to tradies.",
  'two-weeks': '',
  month: '',
  flexible: 'Good for getting a few prices to compare.',
};

const q = {
  tradiesFor: db.prepare(`
    SELECT COUNT(*) AS n FROM tradie_profiles
    WHERE status = 'approved'
      AND (',' || trades || ',') LIKE ('%,' || @trade || ',%')
      AND (',' || regions || ',') LIKE ('%,' || @region || ',%')
      AND (',' || sectors || ',') LIKE ('%,' || @sector || ',%')`),
  openJobs: db.prepare(`
    SELECT id, sector, title, trade, suburb, region, budget, created_at,
      (SELECT COUNT(*) FROM quotes WHERE job_id = jobs.id AND status != 'withdrawn') AS quote_count
    FROM jobs WHERE status = 'open' ORDER BY created_at DESC LIMIT 200`),
};

// Reads the answers so far from the query string, dropping anything that isn't a valid option.
function readState(query) {
  const pick = (value, valid) => (valid[value] ? value : '');
  const many = (value, valid) => [...new Set(String(value || '').split(','))].filter((v) => valid[v]);
  return {
    path: pick(query.path, PATHS),
    who: pick(query.who, WHO_BY),
    trade: pick(query.trade, C.tradeName),
    timing: pick(query.timing, C.timingName),
    region: pick(query.region, C.regionName),
    trades: many(query.trades, C.tradeName).filter((t) => t !== 'other'),
    sectors: many(query.sectors, C.sectorName),
    regions: many(query.regions, C.regionName),
  };
}

function toQuery(state) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    const v = Array.isArray(value) ? value.join(',') : value;
    if (v) params.set(key, v);
  }
  const s = params.toString();
  return s ? `/start?${s}` : '/start';
}

const CUSTOMER_STEPS = ['who', 'trade', 'timing', 'region'];
const TRADIE_STEPS = ['trades', 'sectors', 'regions'];

function currentStep(state) {
  if (!state.path) return 'path';
  const steps = state.path === 'need' ? CUSTOMER_STEPS : TRADIE_STEPS;
  return steps.find((s) => !(Array.isArray(state[s]) ? state[s].length : state[s])) || 'result';
}

function progress(state, step) {
  const steps = state.path === 'need' ? CUSTOMER_STEPS : state.path === 'tradie' ? TRADIE_STEPS : [];
  const total = steps.length + 1;
  const at = step === 'path' ? 1 : step === 'result' ? total : steps.indexOf(step) + 2;
  return { at, total };
}

// The link for "Back": the same state with the most recent answer removed.
function backLink(state, step) {
  if (step === 'path') return null;
  const steps = ['path', ...(state.path === 'need' ? CUSTOMER_STEPS : TRADIE_STEPS)];
  const idx = step === 'result' ? steps.length - 1 : steps.indexOf(step) - 1;
  const back = { ...state };
  for (const s of steps.slice(idx)) back[s] = Array.isArray(back[s]) ? [] : '';
  return toQuery(back);
}

router.get('/start', (req, res) => {
  if (req.query.path === 'look') return res.redirect('/how-it-works');

  const state = readState(req.query);
  const step = currentStep(state);
  const sector = state.who ? WHO_BY[state.who].sector : null;
  res.locals.robots = 'noindex, follow';

  const view = {
    title: 'Get started',
    description: 'Answer a few quick questions and we will point you to the right place.',
    state,
    step,
    sector,
    progress: progress(state, step),
    back: backLink(state, step),
    link: (changes) => toQuery({ ...state, ...changes }),
    WHO,
    WHO_BY,
    TIMING_HINTS,
  };

  if (step === 'trade') {
    const popular = POPULAR[sector];
    view.popularTrades = popular.map((slug) => C.TRADES.find((t) => t.slug === slug));
    view.otherTrades = C.TRADES.filter((t) => !popular.includes(t.slug) && t.slug !== 'other');
  }

  if (step === 'region') {
    // Mining work is mostly regional, so show those areas first.
    view.groups = sector === 'mining' ? [...C.REGION_GROUPS].reverse() : C.REGION_GROUPS;
  }

  if (step === 'result' && state.path === 'need') {
    const jobUrl = `/jobs/new?${new URLSearchParams({
      sector,
      trade: state.trade,
      timing: state.timing,
      region: state.region,
    })}`;
    req.session.intent = { path: 'need', who: state.who, sector, trade: state.trade, timing: state.timing, region: state.region };
    view.jobUrl = jobUrl;
    view.matches = state.trade === 'other' ? null : q.tradiesFor.get({ trade: state.trade, region: state.region, sector }).n;
    view.info = TRADE_INFO[state.trade] || null;
  }

  if (step === 'result' && state.path === 'tradie') {
    req.session.intent = { path: 'tradie', trades: state.trades, sectors: state.sectors, regions: state.regions };
    view.jobs = q.openJobs
      .all()
      .filter((j) => state.trades.includes(j.trade) && state.sectors.includes(j.sector) && state.regions.includes(j.region));
  }

  res.render('pages/start', view);
});

// Multi-select steps (tradie path) submit checkboxes; fold them into the URL state.
router.get('/start/pick', (req, res) => {
  const state = readState(req.query);
  for (const key of ['trades', 'sectors', 'regions']) {
    const picked = list(req.query[`pick_${key}`]).join(',');
    if (picked) state[key] = readState({ [key]: picked })[key];
  }
  res.redirect(toQuery(state));
});

module.exports = router;
module.exports.WHO_BY = WHO_BY;
