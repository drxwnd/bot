// Job management for tradie businesses: every job they're running, whether won on Tradebench or
// one of their own private jobs. Assign workers, schedule, notes and photos, timesheets, materials,
// and invoices for private jobs.
//
// Managers and owners see everything. Workers only see jobs assigned to them, and no prices.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');

const db = require('../db');
const config = require('../config');
const { parseDollars, feeFor } = require('../helpers');
const { oneOf } = require('../constants');
const { can } = require('../permissions');
const { flash, verifyCsrf, requireRole, requireCan } = require('../middleware');
const uploads = require('../uploads');
const { hit } = require('../ratelimit');

const router = express.Router();
router.use(['/work', '/invoices'], requireRole('tradie'), requireCan('work.view'), (req, res, next) => {
  // Everything here hangs off the business details, so those come first.
  if (req.user.profile) return next();
  flash(req, 'info', 'Add your business details first. Then you can manage jobs and invoices here.');
  res.redirect(can(req, 'profile') ? '/dashboard/profile' : '/dashboard');
});

const STATUS = {
  new: 'To schedule',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  done: 'Done',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
};
const ACTIVE = ['new', 'scheduled', 'in_progress'];

// Limits on what one account can add. Everything shares one disk with the database and its backups,
// so a script mustn't be able to fill it. Real businesses stay far below these.
const PRIVATE_JOBS_PER_DAY = 50;
// Before the business is approved, private jobs are for trying things out.
const PRIVATE_JOBS_UNAPPROVED = 20;
// Hours and materials lines on one job, and how many of those (plus invoices) an account can add an hour.
const ROWS_PER_JOB = 500;
const ROWS_PER_HOUR = 300;
const tooFast = (req) => !hit(`work-rows|a${req.account.ownerId}`, ROWS_PER_HOUR, 60 * 60 * 1000);
const SLOW_DOWN = "That's a lot added in a short time. Wait a while and try again.";

// ---- Dates (Perth time) ----

function perthToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Perth' }).format(new Date());
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return addDays(iso, -((d.getUTCDay() + 6) % 7));
}
function dayLabel(iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-AU', { ...opts, timeZone: 'UTC' });
}
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const isTime = (s) => /^\d{2}:\d{2}$/.test(s || '');

// "2.5", "2:30" or "150m" -> minutes.
function parseHours(input) {
  const s = String(input || '').trim().toLowerCase();
  let minutes = null;
  if (/^\d+:\d{2}$/.test(s)) {
    const [h, m] = s.split(':').map(Number);
    minutes = h * 60 + m;
  } else if (/^\d+m$/.test(s)) minutes = Number(s.slice(0, -1));
  else if (/^\d+(\.\d+)?h?$/.test(s)) minutes = Math.round(parseFloat(s) * 60);
  return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
}
const hoursText = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

// ---- Queries ----

const q = {
  // Every job a business has won on Tradebench gets a work order the first time they look after
  // it's paid. Not before: the customer's contact details come with it.
  syncWon: db.prepare(`
    INSERT INTO work_orders (account_id, source, job_id, title, client_name, client_phone, client_email, address,
      description, price_cents, status, created_at)
    SELECT qt.tradie_id, 'tradebench', j.id, j.title,
      CASE WHEN u.company IS NOT NULL THEN u.name || ', ' || u.company ELSE u.name END,
      u.phone, u.email, COALESCE(j.address, j.suburb || ' WA ' || j.postcode), j.description, qt.amount_cents,
      CASE WHEN j.status = 'completed' THEN 'done' ELSE 'new' END, j.created_at
    FROM jobs j JOIN quotes qt ON qt.id = j.accepted_quote_id JOIN users u ON u.id = j.customer_id
    WHERE qt.tradie_id = ? AND j.status IN ('paid', 'completed')
      AND NOT EXISTS (SELECT 1 FROM work_orders w WHERE w.job_id = j.id)`),
  syncCancelled: db.prepare(`
    UPDATE work_orders SET status = 'cancelled'
    WHERE account_id = ? AND source = 'tradebench' AND status != 'cancelled'
      AND job_id IN (SELECT id FROM jobs WHERE status = 'cancelled')`),
  list: db.prepare(`
    SELECT w.*, a.name AS assigned_name, p.status AS payment_status,
      (SELECT COALESCE(SUM(minutes), 0) FROM time_entries WHERE work_id = w.id) AS minutes,
      (SELECT id FROM invoices WHERE work_id = w.id AND status != 'void' ORDER BY id DESC LIMIT 1) AS invoice_id
    FROM work_orders w LEFT JOIN users a ON a.id = w.assigned_to LEFT JOIN payments p ON p.job_id = w.job_id
    WHERE w.account_id = @account
      AND (@mine IS NULL OR w.assigned_to = @mine)
      AND (@status = 'all' OR (@status = 'active' AND w.status IN ('new', 'scheduled', 'in_progress'))
           OR (@status = 'done' AND w.status IN ('done', 'invoiced', 'paid')))
    ORDER BY w.status = 'cancelled', w.scheduled_date IS NULL, w.scheduled_date, w.scheduled_time, w.created_at DESC`),
  week: db.prepare(`
    SELECT w.*, a.name AS assigned_name FROM work_orders w LEFT JOIN users a ON a.id = w.assigned_to
    WHERE w.account_id = @account AND w.scheduled_date BETWEEN @from AND @to AND w.status != 'cancelled'
      AND (@mine IS NULL OR w.assigned_to = @mine)
    ORDER BY w.scheduled_date, w.scheduled_time IS NULL, w.scheduled_time`),
  unscheduled: db.prepare(`
    SELECT w.*, a.name AS assigned_name FROM work_orders w LEFT JOIN users a ON a.id = w.assigned_to
    WHERE w.account_id = ? AND w.status IN ('new', 'scheduled') AND w.scheduled_date IS NULL ORDER BY w.created_at`),
  work: db.prepare(`
    SELECT w.*, a.name AS assigned_name, j.status AS job_status, p.status AS payment_status, p.amount_cents AS paid_cents,
      p.fee_cents
    FROM work_orders w LEFT JOIN users a ON a.id = w.assigned_to LEFT JOIN jobs j ON j.id = w.job_id
    LEFT JOIN payments p ON p.job_id = w.job_id WHERE w.id = ?`),
  team: db.prepare(`
    SELECT id, name FROM users WHERE id = @account
    UNION ALL
    SELECT u.id, u.name FROM team_members m JOIN users u ON u.id = m.user_id
    WHERE m.account_id = @account AND m.status = 'active'`),
  insert: db.prepare(`
    INSERT INTO work_orders (account_id, source, title, client_name, client_phone, client_email, address, description,
      price_cents, status, assigned_to, scheduled_date, scheduled_time)
    VALUES (@account_id, 'private', @title, @client_name, @client_phone, @client_email, @address, @description,
      @price_cents, @status, @assigned_to, @scheduled_date, @scheduled_time)`),
  update: db.prepare(`
    UPDATE work_orders SET status = @status, assigned_to = @assigned_to, scheduled_date = @scheduled_date,
      scheduled_time = @scheduled_time WHERE id = @id`),
  updateDetails: db.prepare(`
    UPDATE work_orders SET title = @title, client_name = @client_name, client_phone = @client_phone,
      client_email = @client_email, address = @address, description = @description, price_cents = @price_cents
    WHERE id = @id AND source = 'private'`),
  setStatus: db.prepare('UPDATE work_orders SET status = ? WHERE id = ?'),
  privateToday: db.prepare("SELECT COUNT(*) AS n FROM work_orders WHERE account_id = ? AND source = 'private' AND created_at > datetime('now', '-1 day')"),
  privateTotal: db.prepare("SELECT COUNT(*) AS n FROM work_orders WHERE account_id = ? AND source = 'private'"),
  timeCount: db.prepare('SELECT COUNT(*) AS n FROM time_entries WHERE work_id = ?'),
  costCount: db.prepare('SELECT COUNT(*) AS n FROM work_costs WHERE work_id = ?'),
  notes: db.prepare(`
    SELECT n.*, u.name AS author FROM work_notes n JOIN users u ON u.id = n.user_id WHERE n.work_id = ? ORDER BY n.created_at DESC`),
  addNote: db.prepare('INSERT INTO work_notes (work_id, user_id, body, photo) VALUES (?, ?, ?, ?)'),
  time: db.prepare(`
    SELECT t.*, u.name AS author FROM time_entries t JOIN users u ON u.id = t.user_id WHERE t.work_id = ? ORDER BY t.work_date DESC, t.id DESC`),
  addTime: db.prepare('INSERT INTO time_entries (work_id, user_id, work_date, minutes, note) VALUES (?, ?, ?, ?, ?)'),
  timeEntry: db.prepare('SELECT * FROM time_entries WHERE id = ? AND work_id = ?'),
  deleteTime: db.prepare('DELETE FROM time_entries WHERE id = ?'),
  costs: db.prepare(`
    SELECT c.*, u.name AS author FROM work_costs c JOIN users u ON u.id = c.user_id WHERE c.work_id = ? ORDER BY c.id DESC`),
  addCost: db.prepare('INSERT INTO work_costs (work_id, user_id, description, amount_cents) VALUES (?, ?, ?, ?)'),
  cost: db.prepare('SELECT * FROM work_costs WHERE id = ? AND work_id = ?'),
  deleteCost: db.prepare('DELETE FROM work_costs WHERE id = ?'),
  invoiceForWork: db.prepare("SELECT * FROM invoices WHERE work_id = ? AND status != 'void' ORDER BY id DESC LIMIT 1"),
  invoice: db.prepare('SELECT * FROM invoices WHERE id = ? AND account_id = ?'),
  invoices: db.prepare(`
    SELECT i.*, w.title, w.client_name,
      (SELECT COALESCE(SUM(ROUND(quantity * unit_price_cents)), 0) FROM invoice_lines WHERE invoice_id = i.id) AS subtotal
    FROM invoices i JOIN work_orders w ON w.id = i.work_id WHERE i.account_id = ? ORDER BY i.id DESC`),
  lines: db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY position'),
  invoiceCount: db.prepare('SELECT COUNT(*) AS n FROM invoices WHERE account_id = ?'),
  insertInvoice: db.prepare(`
    INSERT INTO invoices (account_id, work_id, number, issued_on, due_on, gst, notes)
    VALUES (@account_id, @work_id, @number, @issued_on, @due_on, @gst, @notes)`),
  insertLine: db.prepare(
    'INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price_cents, position) VALUES (?, ?, ?, ?, ?)',
  ),
  setInvoiceStatus: db.prepare('UPDATE invoices SET status = ?, paid_on = ? WHERE id = ?'),
  saveSettings: db.prepare(`
    UPDATE tradie_profiles SET hourly_rate_cents = @hourly_rate_cents, gst_registered = @gst_registered,
      invoice_prefix = @invoice_prefix, payment_details = @payment_details WHERE user_id = @user_id`),
};

// Note photos used to be saved in the public uploads folder. Move any left there into private storage,
// so they're only reachable through the team-only photo link.
(function moveOldNotePhotos() {
  for (const { photo } of db.prepare('SELECT photo FROM work_notes WHERE photo IS NOT NULL').all()) {
    for (const name of [photo, photo.replace('.jpg', '-sm.jpg')]) {
      if (!/^[a-f0-9]{24}(-sm)?\.(jpg|png|webp|heic)$/.test(name)) continue;
      const from = path.join(config.uploadDir, name);
      const to = path.join(uploads.privateDir, name);
      try {
        if (fs.existsSync(from) && !fs.existsSync(to)) fs.renameSync(from, to);
      } catch (err) {
        if (err.code === 'EXDEV') {
          fs.copyFileSync(from, to);
          fs.rmSync(from, { force: true });
        } else console.error(`Could not move note photo ${name}:`, err.message);
      }
    }
  }
})();

function sync(accountId) {
  q.syncWon.run(accountId);
  q.syncCancelled.run(accountId);
}

const isManager = (req) => can(req, 'work.manage');
const mineFilter = (req) => (isManager(req) ? null : req.user.id);

function loadWork(req, res, next) {
  const work = q.work.get(Number(req.params.id));
  const allowed = work && work.account_id === req.account.ownerId && (isManager(req) || work.assigned_to === req.user.id);
  if (!allowed) {
    return res.status(404).render('pages/error', {
      title: 'Job not found',
      message: "That job doesn't exist, or it hasn't been assigned to you.",
    });
  }
  req.work = work;
  next();
}

function totals(invoice, lines) {
  const subtotal = lines.reduce((s, l) => s + Math.round(l.quantity * l.unit_price_cents), 0);
  const gst = invoice.gst ? Math.round(subtotal * 0.1) : 0;
  return { subtotal, gst, total: subtotal + gst };
}

router.use((req, res, next) => {
  Object.assign(res.locals, { WORK_STATUS: STATUS, hoursText, dayLabel });
  next();
});

// ---- List ----

router.get('/work', (req, res) => {
  sync(req.account.ownerId);
  const status = ['active', 'done', 'all'].includes(req.query.status) ? req.query.status : 'active';
  const items = q.list.all({ account: req.account.ownerId, mine: mineFilter(req), status });
  res.render('pages/work-list', { title: 'Work', items, status, manager: isManager(req) });
});

// ---- Schedule ----

router.get('/work/schedule', (req, res) => {
  sync(req.account.ownerId);
  const from = mondayOf(isDate(req.query.week) ? req.query.week : perthToday());
  const to = addDays(from, 6);
  const items = q.week.all({ account: req.account.ownerId, from, to, mine: mineFilter(req) });
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(from, i);
    return { date, items: items.filter((w) => w.scheduled_date === date) };
  });
  res.render('pages/work-schedule', {
    title: 'Schedule',
    days,
    from,
    to,
    today: perthToday(),
    prev: addDays(from, -7),
    next: addDays(from, 7),
    unscheduled: isManager(req) ? q.unscheduled.all(req.account.ownerId) : [],
  });
});

// ---- Private jobs ----

function readJobForm(b) {
  return {
    title: String(b.title || '').trim().slice(0, 120),
    client_name: String(b.client_name || '').trim().slice(0, 120) || null,
    client_phone: String(b.client_phone || '').trim().slice(0, 40) || null,
    client_email: String(b.client_email || '').trim().slice(0, 120) || null,
    address: String(b.address || '').trim().slice(0, 200) || null,
    description: String(b.description || '').trim().slice(0, 5000) || null,
    price_cents: b.price ? parseDollars(b.price) : null,
  };
}

router.get('/work/new', requireCan('work.manage'), (req, res) => {
  res.render('pages/work-new', {
    title: 'New private job',
    values: { scheduled_date: req.query.date || '' },
    team: q.team.all({ account: req.account.ownerId }),
  });
});

router.post('/work', requireCan('work.manage'), (req, res) => {
  const b = req.body;
  const team = q.team.all({ account: req.account.ownerId });
  const values = {
    ...readJobForm(b),
    account_id: req.account.ownerId,
    assigned_to: team.some((t) => t.id === Number(b.assigned_to)) ? Number(b.assigned_to) : null,
    scheduled_date: isDate(b.scheduled_date) ? b.scheduled_date : null,
    scheduled_time: isTime(b.scheduled_time) ? b.scheduled_time : null,
  };
  values.status = values.scheduled_date ? 'scheduled' : 'new';

  const status = req.user.profile.status;
  let error = null;
  if (status === 'rejected') error = `Your business wasn't approved, so you can't add jobs. Email ${config.supportEmail} if you think that's wrong.`;
  else if (status !== 'approved' && q.privateTotal.get(req.account.ownerId).n >= PRIVATE_JOBS_UNAPPROVED) {
    error = `You can add up to ${PRIVATE_JOBS_UNAPPROVED} private jobs while your business is being checked. You can add more once it's approved.`;
  } else if (q.privateToday.get(req.account.ownerId).n >= PRIVATE_JOBS_PER_DAY) {
    error = `You've added ${PRIVATE_JOBS_PER_DAY} private jobs today, which is the daily limit. Email ${config.supportEmail} if you need more.`;
  } else if (values.title.length < 3) error = 'Give the job a title.';
  else if (!values.client_name) error = "Enter the client's name.";
  else if (b.price && !values.price_cents) error = 'Enter the price in dollars, e.g. 1,250.';
  if (error) return res.status(400).render('pages/work-new', { title: 'New private job', values, team, error });

  const id = Number(q.insert.run(values).lastInsertRowid);
  flash(req, 'success', 'Job added.');
  res.redirect(`/work/${id}`);
});

// ---- Business settings for invoices ----

router.get('/work/settings', requireCan('money'), (req, res) => {
  res.render('pages/work-settings', { title: 'Invoice settings', profile: req.user.profile });
});

router.post('/work/settings', requireCan('money'), (req, res) => {
  const b = req.body;
  q.saveSettings.run({
    user_id: req.account.ownerId,
    hourly_rate_cents: b.hourly_rate ? parseDollars(b.hourly_rate) : null,
    gst_registered: b.gst_registered ? 1 : 0,
    invoice_prefix: String(b.invoice_prefix || 'INV-').trim().slice(0, 12) || 'INV-',
    // Bank details printed on invoices can only be changed by the owner, so a manager can't
    // redirect customer payments to their own account.
    payment_details: can(req, 'payouts')
      ? String(b.payment_details || '').trim().slice(0, 500) || null
      : req.user.profile.payment_details,
  });
  flash(req, 'success', 'Settings saved.');
  res.redirect('/work/settings');
});

// ---- One job ----

router.get('/work/:id', loadWork, (req, res) => {
  const work = req.work;
  const time = q.time.all(work.id);
  const costs = q.costs.all(work.id);
  const minutes = time.reduce((s, t) => s + t.minutes, 0);
  const costTotal = costs.reduce((s, c) => s + c.amount_cents, 0);
  const profile = req.user.profile;
  const showMoney = can(req, 'money');

  let summary = null;
  if (showMoney) {
    const income = work.price_cents || 0;
    const fee = work.source === 'tradebench' && income ? feeFor(income) : 0;
    const labour = profile.hourly_rate_cents ? Math.round((minutes / 60) * profile.hourly_rate_cents) : null;
    summary = { income, fee, costTotal, labour, left: income - fee - costTotal };
  }

  res.render('pages/work-job', {
    title: work.title,
    work,
    notes: q.notes.all(work.id),
    time,
    costs,
    minutes,
    costTotal,
    summary,
    showMoney,
    manager: isManager(req),
    team: q.team.all({ account: req.account.ownerId }),
    invoice: q.invoiceForWork.get(work.id),
    today: perthToday(),
  });
});

router.post('/work/:id', requireCan('work.manage'), loadWork, (req, res) => {
  const b = req.body;
  const team = q.team.all({ account: req.account.ownerId });
  const update = {
    id: req.work.id,
    status: oneOf(STATUS, b.status, req.work.status),
    assigned_to: team.some((t) => t.id === Number(b.assigned_to)) ? Number(b.assigned_to) : null,
    scheduled_date: isDate(b.scheduled_date) ? b.scheduled_date : null,
    scheduled_time: isTime(b.scheduled_time) ? b.scheduled_time : null,
  };
  if (update.status === 'new' && update.scheduled_date) update.status = 'scheduled';
  q.update.run(update);

  if (req.work.source === 'private' && b.title !== undefined) {
    const details = readJobForm(b);
    if (details.title.length >= 3) q.updateDetails.run({ ...details, id: req.work.id });
  }
  flash(req, 'success', 'Saved.');
  res.redirect(`/work/${req.work.id}`);
});

// Workers can move their own job along.
router.post('/work/:id/status', loadWork, (req, res) => {
  const next = req.body.status;
  const allowed = isManager(req) ? Object.keys(STATUS) : ['in_progress', 'done'];
  if (allowed.includes(next)) {
    q.setStatus.run(next, req.work.id);
    flash(req, 'success', next === 'done' ? 'Marked as done. Nice work.' : `Marked as ${STATUS[next].toLowerCase()}.`);
  }
  res.redirect(`/work/${req.work.id}`);
});

// Access is checked before the photo is even read, and it's only saved once the CSRF check passes.
router.post('/work/:id/notes', loadWork, uploads.receive('photo', 1), verifyCsrf, async (req, res, next) => {
  const body = String(req.body.body || '').trim().slice(0, 3000) || null;
  let photo = null;
  if (req.file) {
    try {
      photo = await uploads.save(req.file, { isPrivate: true });
    } catch {
      flash(req, 'error', uploads.UNREADABLE);
      return res.redirect(`/work/${req.work.id}#notes`);
    }
  }
  if (req.uploadError) flash(req, 'error', req.uploadError);
  else if (body || photo) q.addNote.run(req.work.id, req.user.id, body, photo);
  else flash(req, 'error', 'Write a note or add a photo.');
  res.redirect(`/work/${req.work.id}#notes`);
});

// Note photos are private to the business. Anyone who can open the work order can see them.
router.get('/work/:id/photos/:file', loadWork, (req, res) => {
  const note = db.prepare('SELECT 1 FROM work_notes WHERE work_id = ? AND (photo = ? OR replace(photo, \'.jpg\', \'-sm.jpg\') = ?)')
    .get(req.work.id, req.params.file, req.params.file);
  // Older photos have no thumbnail, so fall back to the full-size one.
  const file = note && (uploads.privatePath(req.params.file) || uploads.privatePath(req.params.file.replace('-sm.jpg', '.jpg')));
  if (!file) return res.sendStatus(404);
  res.set('Cache-Control', 'private, max-age=86400');
  res.sendFile(file);
});

router.post('/work/:id/time', loadWork, (req, res) => {
  const minutes = parseHours(req.body.hours);
  const date = isDate(req.body.work_date) ? req.body.work_date : perthToday();
  if (!minutes) flash(req, 'error', 'Enter hours like 2.5 or 2:30.');
  else if (q.timeCount.get(req.work.id).n >= ROWS_PER_JOB) flash(req, 'error', `A job can have up to ${ROWS_PER_JOB} time entries.`);
  else if (tooFast(req)) flash(req, 'error', SLOW_DOWN);
  else q.addTime.run(req.work.id, req.user.id, date, minutes, String(req.body.note || '').trim().slice(0, 300) || null);
  res.redirect(`/work/${req.work.id}#time`);
});

router.post('/work/:id/time/:entry/delete', loadWork, (req, res) => {
  const entry = q.timeEntry.get(Number(req.params.entry), req.work.id);
  if (entry && (entry.user_id === req.user.id || isManager(req))) q.deleteTime.run(entry.id);
  res.redirect(`/work/${req.work.id}#time`);
});

router.post('/work/:id/costs', loadWork, (req, res) => {
  const amount = parseDollars(req.body.amount);
  const description = String(req.body.description || '').trim().slice(0, 200);
  if (!description || !amount) flash(req, 'error', 'Enter what it was and how much, e.g. "Tile adhesive" and 64.50.');
  else if (q.costCount.get(req.work.id).n >= ROWS_PER_JOB) flash(req, 'error', `A job can have up to ${ROWS_PER_JOB} materials and costs.`);
  else if (tooFast(req)) flash(req, 'error', SLOW_DOWN);
  else q.addCost.run(req.work.id, req.user.id, description, amount);
  res.redirect(`/work/${req.work.id}#costs`);
});

router.post('/work/:id/costs/:cost/delete', loadWork, (req, res) => {
  const cost = q.cost.get(Number(req.params.cost), req.work.id);
  if (cost && (cost.user_id === req.user.id || isManager(req))) q.deleteCost.run(cost.id);
  res.redirect(`/work/${req.work.id}#costs`);
});

// ---- Invoices (private jobs only; Tradebench jobs are paid through the site) ----

router.get('/work/:id/invoice', requireCan('money'), loadWork, (req, res) => {
  const work = req.work;
  if (work.source !== 'private') return res.redirect(`/work/${work.id}`);
  const existing = q.invoiceForWork.get(work.id);
  if (existing) return res.redirect(`/invoices/${existing.id}`);

  const profile = req.user.profile;
  const minutes = q.time.all(work.id).reduce((s, t) => s + t.minutes, 0);
  const lines = [];
  if (work.price_cents) lines.push({ description: work.title, quantity: 1, unit_price: work.price_cents / 100 });
  else if (minutes && profile.hourly_rate_cents) {
    lines.push({ description: 'Labour', quantity: Math.round((minutes / 60) * 100) / 100, unit_price: profile.hourly_rate_cents / 100 });
  }
  if (!work.price_cents) {
    for (const c of q.costs.all(work.id)) lines.push({ description: c.description, quantity: 1, unit_price: c.amount_cents / 100 });
  }
  res.render('pages/invoice-new', {
    title: 'New invoice',
    work,
    profile,
    lines,
    issued_on: perthToday(),
    due_on: addDays(perthToday(), 14),
  });
});

router.post('/work/:id/invoice', requireCan('money'), loadWork, (req, res) => {
  const work = req.work;
  if (work.source !== 'private' || q.invoiceForWork.get(work.id)) return res.redirect(`/work/${work.id}`);
  const profile = req.user.profile;
  const b = req.body;

  const descs = [].concat(b.line_description || []);
  const qtys = [].concat(b.line_quantity || []);
  const prices = [].concat(b.line_price || []);
  const lines = descs
    .map((d, i) => ({
      description: String(d || '').trim().slice(0, 200),
      quantity: Math.round(Number(qtys[i]) * 100) / 100,
      unit_price_cents: parseDollars(prices[i]),
    }))
    .filter((l) => l.description && l.quantity > 0 && l.quantity <= 10000 && l.unit_price_cents)
    .slice(0, 100);

  if (!lines.length) {
    flash(req, 'error', 'Add at least one line with a description, quantity and price.');
    return res.redirect(`/work/${work.id}/invoice`);
  }
  if (tooFast(req)) {
    flash(req, 'error', SLOW_DOWN);
    return res.redirect(`/work/${work.id}/invoice`);
  }

  const number = `${profile.invoice_prefix || 'INV-'}${String(q.invoiceCount.get(req.account.ownerId).n + 1).padStart(4, '0')}`;
  const id = db.transaction(() => {
    const invoiceId = Number(
      q.insertInvoice.run({
        account_id: req.account.ownerId,
        work_id: work.id,
        number,
        issued_on: isDate(b.issued_on) ? b.issued_on : perthToday(),
        due_on: isDate(b.due_on) ? b.due_on : addDays(perthToday(), 14),
        gst: profile.gst_registered ? 1 : 0,
        notes: String(b.notes || '').trim().slice(0, 1000) || null,
      }).lastInsertRowid,
    );
    lines.forEach((l, i) => q.insertLine.run(invoiceId, l.description, l.quantity, l.unit_price_cents, i));
    q.setStatus.run('invoiced', work.id);
    return invoiceId;
  })();
  flash(req, 'success', `Invoice ${number} created. Print it or save it as a PDF to send.`);
  res.redirect(`/invoices/${id}`);
});

router.get('/invoices', requireCan('money'), (req, res) => {
  const invoices = q.invoices.all(req.account.ownerId).map((i) => ({
    ...i,
    total: i.subtotal + (i.gst ? Math.round(i.subtotal * 0.1) : 0),
    overdue: i.status === 'sent' && i.due_on < perthToday(),
  }));
  const outstanding = invoices.filter((i) => i.status === 'sent').reduce((s, i) => s + i.total, 0);
  res.render('pages/invoices', { title: 'Invoices', invoices, outstanding });
});

router.get('/invoices/:id', requireCan('money'), (req, res, next) => {
  const invoice = q.invoice.get(Number(req.params.id), req.account.ownerId);
  if (!invoice) return next();
  const lines = q.lines.all(invoice.id);
  res.render('pages/invoice', {
    title: `Invoice ${invoice.number}`,
    invoice,
    lines,
    totals: totals(invoice, lines),
    work: q.work.get(invoice.work_id),
    profile: req.user.profile,
    owner: req.account.owner,
  });
});

router.post('/invoices/:id/status', requireCan('money'), (req, res, next) => {
  const invoice = q.invoice.get(Number(req.params.id), req.account.ownerId);
  if (!invoice) return next();
  const status = ['draft', 'sent', 'paid', 'void'].includes(req.body.status) ? req.body.status : invoice.status;
  db.transaction(() => {
    q.setInvoiceStatus.run(status, status === 'paid' ? perthToday() : null, invoice.id);
    q.setStatus.run(status === 'paid' ? 'paid' : status === 'void' ? 'done' : 'invoiced', invoice.work_id);
  })();
  flash(req, 'success', status === 'paid' ? 'Marked as paid.' : status === 'void' ? 'Invoice cancelled.' : `Marked as ${status}.`);
  res.redirect(`/invoices/${invoice.id}`);
});

module.exports = router;
module.exports.parseHours = parseHours;
