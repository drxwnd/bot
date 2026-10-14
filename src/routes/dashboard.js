const express = require('express');
const db = require('../db');
const C = require('../constants');
const payments = require('../payments');
const notify = require('../notify');
const { validAbn, list, hasContactDetails, oneLine } = require('../helpers');
const { flash, requireLogin, requireRole, requireCan, verifyCsrf } = require('../middleware');
const uploads = require('../uploads');
const { can } = require('../permissions');

const router = express.Router();

const q = {
  upsertProfile: db.prepare(`
    INSERT INTO tradie_profiles (user_id, business_name, abn, sectors, trades, regions, licence_no, tickets, insurer, insurance_expiry, years_trading, bio)
    VALUES (@user_id, @business_name, @abn, @sectors, @trades, @regions, @licence_no, @tickets, @insurer, @insurance_expiry, @years_trading, @bio)
    ON CONFLICT (user_id) DO UPDATE SET
      business_name = excluded.business_name, abn = excluded.abn, sectors = excluded.sectors, trades = excluded.trades,
      regions = excluded.regions, tickets = excluded.tickets, licence_no = excluded.licence_no, insurer = excluded.insurer,
      insurance_expiry = excluded.insurance_expiry, years_trading = excluded.years_trading, bio = excluded.bio`),
  updateUser: db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?'),
  recheck: db.prepare("UPDATE tradie_profiles SET status = 'pending' WHERE user_id = ?"),
};

// A real calendar date in YYYY-MM-DD form.
const isRealDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;

// Changes to these need checking again before the tradie can keep quoting.
function needsRecheck(before, values) {
  if (!before || before.status !== 'approved') return false;
  const today = new Date().toISOString().slice(0, 10);
  const oldTrades = before.trades.split(',');
  return (
    before.business_name !== values.business_name ||
    before.abn !== values.abn ||
    (before.licence_no || null) !== values.licence_no ||
    (before.insurer || null) !== values.insurer ||
    (values.insurance_expiry !== before.insurance_expiry && (values.insurance_expiry || '') < today) ||
    values.trades.some((t) => !oldTrades.includes(t))
  );
}

// A new tradie's first visit uses what they told the get-started quiz.
function prefillFromQuiz(intent, base) {
  const fromQuiz = intent && intent.path === 'tradie' ? intent : {};
  return {
    ...base,
    sectors: fromQuiz.sectors && fromQuiz.sectors.length ? fromQuiz.sectors : ['housing'],
    trades: fromQuiz.trades || [],
    regions: fromQuiz.regions || [],
  };
}

// ---- Logo and photos of past work, shown on the public profile ----

const MAX_WORK_PHOTOS = 24;
const photoQ = {
  list: db.prepare('SELECT * FROM tradie_photos WHERE user_id = ? ORDER BY id DESC'),
  count: db.prepare('SELECT COUNT(*) AS n FROM tradie_photos WHERE user_id = ?'),
  add: db.prepare('INSERT INTO tradie_photos (user_id, filename, caption) VALUES (?, ?, ?)'),
  one: db.prepare('SELECT * FROM tradie_photos WHERE id = ? AND user_id = ?'),
  remove: db.prepare('DELETE FROM tradie_photos WHERE id = ?'),
  setLogo: db.prepare('UPDATE tradie_profiles SET logo = ? WHERE user_id = ?'),
};

router.get('/dashboard/profile/photos', requireRole('tradie'), requireCan('profile'), (req, res) => {
  if (!req.user.profile) return res.redirect('/dashboard/profile');
  res.render('pages/profile-photos', {
    title: 'Logo and photos',
    dashNav: 'photos',
    profile: req.user.profile,
    photos: photoQ.list.all(req.account.ownerId),
    max: MAX_WORK_PHOTOS,
  });
});

router.post(
  '/dashboard/profile/photos',
  requireRole('tradie'),
  requireCan('profile'),
  uploads.receive('photos', 8),
  verifyCsrf,
  async (req, res, next) => {
    const id = req.account.ownerId;
    if (!req.user.profile) return res.redirect('/dashboard/profile');
    if (req.uploadError) {
      flash(req, 'error', req.uploadError);
      return res.redirect('/dashboard/profile/photos');
    }
    try {
      if (req.body.kind === 'logo') {
        if (!req.files || !req.files.length) throw Object.assign(new Error(), { friendly: 'Choose an image for your logo.' });
        const name = await uploads.save(req.files[0], { maxSide: 600 });
        if (req.user.profile.logo) uploads.remove(req.user.profile.logo);
        photoQ.setLogo.run(name, id);
        flash(req, 'success', 'Logo updated.');
      } else {
        const room = MAX_WORK_PHOTOS - photoQ.count.get(id).n;
        const files = (req.files || []).slice(0, Math.max(0, room));
        if (!files.length) throw Object.assign(new Error(), { friendly: room <= 0 ? `You can have up to ${MAX_WORK_PHOTOS} photos. Remove some first.` : 'Choose some photos to add.' });
        const caption = oneLine(req.body.caption, 120) || null;
        if (hasContactDetails(caption)) throw Object.assign(new Error(), { friendly: 'Leave phone numbers, emails and web links out of the caption.' });
        const { saved, skipped } = await uploads.saveAll(files);
        for (const f of saved) photoQ.add.run(id, f, caption);
        flash(req, skipped ? 'info' : 'success', skipped ? uploads.UNREADABLE : `${saved.length} photo${saved.length === 1 ? '' : 's'} added to your profile.`);
      }
    } catch (err) {
      if (!err.friendly) return next(err);
      flash(req, 'error', err.friendly);
    }
    res.redirect('/dashboard/profile/photos');
  },
);

router.post('/dashboard/profile/photos/:id/delete', requireRole('tradie'), requireCan('profile'), (req, res) => {
  const photo = photoQ.one.get(Number(req.params.id), req.account.ownerId);
  if (photo) {
    photoQ.remove.run(photo.id);
    uploads.remove(photo.filename);
    flash(req, 'success', 'Photo removed.');
  }
  res.redirect('/dashboard/profile/photos');
});

router.post('/dashboard/profile/logo/delete', requireRole('tradie'), requireCan('profile'), (req, res) => {
  if (req.user.profile && req.user.profile.logo) {
    uploads.remove(req.user.profile.logo);
    photoQ.setLogo.run(null, req.account.ownerId);
  }
  res.redirect('/dashboard/profile/photos');
});

router.get('/dashboard/profile', requireRole('tradie'), requireCan('profile'), (req, res) => {
  const p = req.user.profile;
  const owner = req.account.owner;
  const values = p
    ? { ...p, sectors: p.sectors.split(','), trades: p.trades.split(','), regions: p.regions.split(','), name: owner.name, phone: owner.phone }
    : prefillFromQuiz(req.session.intent, { name: owner.name, phone: owner.phone });
  res.render('pages/profile-edit', { title: 'Business details', values });
});

router.post('/dashboard/profile', requireRole('tradie'), requireCan('profile'), (req, res) => {
  const b = req.body;
  const owner = req.account.owner;
  // The name and phone are the owner's own. Customers get that phone once they pay, so only the
  // owner can change it, not a manager.
  const isOwner = req.account.role === 'owner';
  const values = {
    user_id: req.account.ownerId,
    name: isOwner ? oneLine(b.name, 80) : owner.name,
    phone: isOwner ? oneLine(b.phone, 30) : owner.phone || '',
    business_name: oneLine(b.business_name, 100),
    abn: String(b.abn || '').replace(/\s/g, ''),
    sectors: list(b.sectors).filter((s) => C.sectorName[s]),
    trades: list(b.trades).filter((t) => C.tradeName[t]),
    regions: list(b.regions).filter((r) => C.regionName[r]),
    licence_no: String(b.licence_no || '').trim().slice(0, 50) || null,
    tickets: String(b.tickets || '').trim().slice(0, 1000) || null,
    insurer: String(b.insurer || '').trim().slice(0, 100) || null,
    insurance_expiry: isRealDate(b.insurance_expiry) ? b.insurance_expiry : null,
    years_trading: Number.isInteger(Number(b.years_trading)) && b.years_trading !== '' ? Number(b.years_trading) : null,
    bio: String(b.bio || '').trim().slice(0, 1500) || null,
  };

  let error = null;
  if (!values.name) error = 'Enter your name.';
  else if (!values.business_name) error = 'Enter your business or trading name.';
  else if (!validAbn(values.abn)) error = "That ABN doesn't look right. Check it on abr.business.gov.au.";
  else if (!values.sectors.length) error = 'Pick the kinds of work you want to see: homes, hotels, mining or all three.';
  else if (!values.trades.length) error = 'Pick at least one trade.';
  else if (!values.regions.length) error = "Pick the areas you'll travel to.";
  else if (!values.insurer || !values.insurance_expiry) error = 'We need your public liability insurer and expiry date.';
  else if (hasContactDetails(values.business_name, values.bio, values.tickets)) {
    error = 'Take out phone numbers, emails and web links. Customers get your contact details as soon as they pay.';
  }

  if (error) return res.status(400).render('pages/profile-edit', { title: 'Business details', values, error });

  req.session.intent = null;
  const before = req.user.profile;
  const recheck = needsRecheck(before, values);
  db.transaction(() => {
    q.updateUser.run(values.name, values.phone || null, req.account.ownerId);
    q.upsertProfile.run({
      ...values,
      sectors: values.sectors.join(','),
      trades: values.trades.join(','),
      regions: values.regions.join(','),
    });
    if (recheck) q.recheck.run(req.account.ownerId);
  })();
  if (!before || before.status !== 'approved' || recheck) notify.tradieSubmitted(req.account.ownerId);

  flash(
    req,
    'success',
    recheck
      ? "Saved. Because your business, licence, insurance or trades changed, we'll check them again before you quote on new jobs. Usually within one business day."
      : before && before.status === 'approved'
        ? 'Details saved.'
        : "Thanks. We'll check your ABN, licence and insurance, usually within one business day.",
  );
  res.redirect('/dashboard');
});

// ---- Payouts ----

router.get('/dashboard/payouts', requireRole('tradie'), requireCan('payouts'), async (req, res, next) => {
  const profile = req.user.profile;
  if (!profile) return res.redirect('/dashboard/profile');
  try {
    const ready = await payments.refreshPayoutStatus(req.user, profile);
    if (req.query.done && ready) flash(req, 'success', "Payouts are set up. You'll get paid straight to your bank.");
    if (req.query.done) return res.redirect('/dashboard/payouts');
    res.render('pages/payouts', {
      title: 'Payouts',
      profile,
      ready,
      available: payments.available,
      simulated: payments.simulated,
    });
  } catch (err) {
    next(err);
  }
});

async function startOnboarding(req, res, next) {
  const profile = req.user.profile;
  if (!profile) return res.redirect('/dashboard/profile');
  try {
    res.redirect(303, await payments.onboardingLink(req.user, profile));
  } catch (err) {
    next(err);
  }
}
router.post('/dashboard/payouts/start', requireRole('tradie'), requireCan('payouts'), startOnboarding);
// Stripe sends people back here if an onboarding link expires.
router.get('/dashboard/payouts/start', requireRole('tradie'), requireCan('payouts'), startOnboarding);

router.post('/dashboard/payouts/stripe', requireRole('tradie'), requireCan('payouts'), async (req, res, next) => {
  try {
    const url = await payments.payoutDashboardLink(req.user.profile || {});
    res.redirect(303, url || '/dashboard/payouts');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
