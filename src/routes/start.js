// "Get started" for first-time visitors. People who need work done go straight to the job form,
// where they make their account as they post. Tradies answer a few quick questions (trades, kinds
// of work, areas), see matching jobs, and their business details form is pre-filled from it.
//
// Each answer is a plain link or GET form, so the questions work without JavaScript and the back
// button behaves. Answers are kept in the URL until the end, then saved to the session.

const express = require('express');
const db = require('../db');
const C = require('../constants');
const { list } = require('../helpers');

const router = express.Router();

const PATHS = C.dict({ need: true, tradie: true });

// Older links to the customer questions carried who the work was for; it maps onto the job form's
// "Where's the work?" choice.
const SECTOR_FOR_WHO = C.dict({ home: 'housing', landlord: 'housing', hotel: 'hotels', mining: 'mining' });

const q = {
  openJobs: db.prepare(`
    SELECT id, sector, title, trade, suburb, region, budget, created_at,
      (SELECT COUNT(*) FROM quotes WHERE job_id = jobs.id AND status != 'withdrawn') AS quote_count
    FROM jobs WHERE status = 'open' ORDER BY created_at DESC LIMIT 200`),
};

// Reads the answers so far from the query string, dropping anything that isn't a valid option.
function readState(query) {
  const many = (value, valid) => [...new Set(String(value || '').split(','))].filter((v) => Object.hasOwn(valid, v));
  return {
    path: C.oneOf(PATHS, query.path),
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

const STEPS = ['trades', 'sectors', 'regions'];

function currentStep(state) {
  if (!state.path) return 'path';
  return STEPS.find((s) => !state[s].length) || 'result';
}

function progress(state, step) {
  const total = state.path ? STEPS.length + 1 : 1;
  const at = step === 'path' ? 1 : step === 'result' ? total : STEPS.indexOf(step) + 2;
  return { at, total };
}

// The link for "Back": the same state with the most recent answer removed.
function backLink(state, step) {
  if (step === 'path') return null;
  const steps = ['path', ...STEPS];
  const idx = step === 'result' ? steps.length - 1 : steps.indexOf(step) - 1;
  const back = { ...state };
  for (const s of steps.slice(idx)) back[s] = Array.isArray(back[s]) ? [] : '';
  return toQuery(back);
}

router.get('/start', (req, res) => {
  if (req.query.path === 'look') return res.redirect('/how-it-works');
  if (req.query.path === 'need') {
    const params = new URLSearchParams();
    const sector = C.oneOf(SECTOR_FOR_WHO, req.query.who) ? SECTOR_FOR_WHO[req.query.who] : '';
    if (sector) params.set('sector', sector);
    for (const [key, valid] of [['trade', C.tradeName], ['timing', C.timingName], ['region', C.regionName]]) {
      const v = C.oneOf(valid, req.query[key]);
      if (v) params.set(key, v);
    }
    const s = params.toString();
    return res.redirect(s ? `/jobs/new?${s}` : '/jobs/new');
  }

  const state = readState(req.query);
  const step = currentStep(state);
  res.locals.robots = 'noindex, follow';

  const view = {
    title: 'Get started',
    description: 'Post a job, or tell us about your trade business and see the jobs that match.',
    state,
    step,
    progress: progress(state, step),
    back: backLink(state, step),
    link: (changes) => toQuery({ ...state, ...changes }),
  };

  if (step === 'result') {
    req.session.intent = { path: 'tradie', trades: state.trades, sectors: state.sectors, regions: state.regions };
    view.jobs = q.openJobs
      .all()
      .filter((j) => state.trades.includes(j.trade) && state.sectors.includes(j.sector) && state.regions.includes(j.region));
  }

  view.quizStep = view.progress.at;
  res.render('pages/start', view);
});

// Multi-select steps submit checkboxes; fold them into the URL state.
router.get('/start/pick', (req, res) => {
  const state = readState(req.query);
  for (const key of STEPS) {
    const picked = list(req.query[`pick_${key}`]).join(',');
    if (picked) state[key] = readState({ [key]: picked })[key];
  }
  res.redirect(toQuery(state));
});

module.exports = router;
