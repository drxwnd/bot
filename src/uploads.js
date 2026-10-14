// Photo uploads. Every image is decoded and re-saved by sharp, which:
//   - strips EXIF data (phone photos carry GPS coordinates, which would give away the exact address),
//   - rotates it the right way up,
//   - shrinks it to a sensible size and makes a small thumbnail for lists,
//   - and rejects anything that isn't really an image, whatever its name says.
//
// Public photos (job photos, tradie work photos) live in UPLOAD_DIR and are served at /uploads.
// Private photos (notes on a tradie's work orders) live outside it and are only served to people
// on that business's team.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const config = require('./config');

const privateDir = path.join(config.dataDir, 'private-uploads');
fs.mkdirSync(config.uploadDir, { recursive: true });
fs.mkdirSync(privateDir, { recursive: true });

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif']);
const MAX_MB = 12;
// Biggest image we'll decode, in pixels. A 48 megapixel phone photo fits; a small file that claims to be
// a huge image (which would need gigabytes of memory to open) is refused before it's decoded.
const MAX_PIXELS = 60_000_000;
// Uploads held in memory at once. The server has 512MB, and each request can carry up to 6 photos.
const MAX_ACTIVE = 4;
let active = 0;

// One image at a time, and nothing kept in sharp's cache between them, to keep memory steady.
sharp.concurrency(1);
sharp.cache(false);

// Files are held in memory until the route has checked the CSRF token and permissions, so a
// rejected request never leaves anything on disk.
function receive(field, maxFiles) {
  const m = multer({
    storage: multer.memoryStorage(),
    // The text fields on these forms are short, so cap how many there are and how big.
    limits: { fileSize: MAX_MB * 1024 * 1024, files: maxFiles, fields: 40, fieldSize: 64 * 1024, parts: maxFiles + 40 },
    fileFilter: (req, file, cb) => cb(null, TYPES.has(file.mimetype)),
  });
  const handler = maxFiles === 1 ? m.single(field) : m.array(field, maxFiles);
  return (req, res, next) => {
    if (active >= MAX_ACTIVE) {
      res.set('Retry-After', '10');
      return res.status(503).render('pages/error', { title: 'Busy right now', message: 'A lot of photos are being uploaded at the moment. Wait a few seconds, then go back and try again.' });
    }
    active += 1;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      active -= 1;
    };
    res.once('finish', finish);
    res.once('close', finish);
    handler(req, res, (err) => {
      if (!err) return next();
      req.uploadError =
        err.code === 'LIMIT_FILE_SIZE'
          ? `Each photo can be up to ${MAX_MB}MB. Try a smaller one.`
          : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
            ? `You can add up to ${maxFiles} photo${maxFiles === 1 ? '' : 's'} at a time.`
            : "That upload didn't work. Try again.";
      req.files = [];
      req.file = null;
      req.body = req.body || {};
      next();
    });
  };
}

// Re-encode and save one image. Returns the file name (the thumbnail is name-sm.jpg).
async function save(file, { isPrivate = false, maxSide = 1800 } = {}) {
  const dir = isPrivate ? privateDir : config.uploadDir;
  const name = crypto.randomBytes(12).toString('hex');
  const img = sharp(file.buffer, { failOn: 'error', limitInputPixels: MAX_PIXELS }).rotate();
  await img.clone().resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(dir, `${name}.jpg`));
  await img.clone().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true }).toFile(path.join(dir, `${name}-sm.jpg`));
  return `${name}.jpg`;
}

// Save several; anything that isn't a readable image is skipped and counted.
async function saveAll(files, opts) {
  const saved = [];
  let skipped = 0;
  for (const f of files || []) {
    try {
      saved.push(await save(f, opts));
    } catch {
      skipped += 1;
    }
  }
  return { saved, skipped };
}

function remove(filename, { isPrivate = false } = {}) {
  if (!/^[a-f0-9]{24}\.jpg$/.test(filename || '')) return;
  const dir = isPrivate ? privateDir : config.uploadDir;
  for (const f of [filename, filename.replace('.jpg', '-sm.jpg')]) fs.rm(path.join(dir, f), { force: true }, () => {});
}

// The thumbnail if there is one (older uploads don't have one).
function thumb(filename) {
  if (!/^[a-f0-9]{24}\.jpg$/.test(filename || '')) return filename;
  const sm = filename.replace('.jpg', '-sm.jpg');
  return fs.existsSync(path.join(config.uploadDir, sm)) ? sm : filename;
}

// Path to a private photo, or null if the name isn't one of ours.
function privatePath(filename) {
  if (!/^[a-f0-9]{24}(-sm)?\.(jpg|png|webp|heic)$/.test(filename || '')) return null;
  const p = path.join(privateDir, filename);
  return fs.existsSync(p) ? p : null;
}

const UNREADABLE = "Some photos couldn't be read. Use JPG or PNG. On an iPhone, set Settings > Camera > Formats to Most Compatible.";

module.exports = { receive, save, saveAll, remove, thumb, privatePath, privateDir, UNREADABLE, MAX_MB };
