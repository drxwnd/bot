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
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const config = require('./config');
const { hit, ipKey } = require('./ratelimit');

const privateDir = path.join(config.dataDir, 'private-uploads');
fs.mkdirSync(config.uploadDir, { recursive: true });
fs.mkdirSync(privateDir, { recursive: true });

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif']);
const MAX_MB = 12;
// Biggest image we'll decode, in pixels. A 48 megapixel phone photo fits; a small file that claims to be
// a huge image (which would need gigabytes of memory to open) is refused before it's decoded.
const MAX_PIXELS = 60_000_000;
// Incoming files are written to the machine's own temp folder (not the /data volume, and not memory)
// while they arrive, so a slow upload costs a connection, not memory. Decoding is what needs the
// memory (about 135MB for a big photo), so only one image is decoded at a time; see oneAtATime.
const incomingDir = path.join(os.tmpdir(), 'tradebench-incoming');
fs.mkdirSync(incomingDir, { recursive: true });
// Upload requests being received at once: per person, and for the whole site as a backstop.
const PER_PERSON_ACTIVE = 2;
const MAX_ACTIVE = 20;
const active = new Map();
let activeTotal = 0;
// Upload requests one account (or, logged out, one address) can make in 10 minutes.
const PER_PERSON = 20;
// An upload that sends less than this in any 10 seconds is dropped, so someone trickling a byte at a
// time can't hold a connection for minutes. 32KB per 10s is far slower than any phone connection.
const STALL_CHECK_MS = Number(process.env.UPLOAD_STALL_MS) || 10_000;
const STALL_MIN_BYTES = 32 * 1024;

// One image at a time, and nothing kept in sharp's cache between them, to keep memory steady.
sharp.concurrency(1);
sharp.cache(false);

let decoding = Promise.resolve();
function oneAtATime(fn) {
  const run = decoding.then(() => fn());
  decoding = run.catch(() => {});
  return run;
}

// Files wait in the temp folder until the route has checked the CSRF token and permissions, and are
// deleted when the response ends, so a rejected request never leaves anything behind.
function receive(field, maxFiles) {
  const m = multer({
    storage: multer.diskStorage({
      destination: incomingDir,
      filename: (req, file, cb) => {
        const name = crypto.randomBytes(12).toString('hex');
        req.incoming.push(path.join(incomingDir, name));
        cb(null, name);
      },
    }),
    // The text fields on these forms are short, so cap how many there are and how big.
    limits: { fileSize: MAX_MB * 1024 * 1024, files: maxFiles, fields: 40, fieldSize: 64 * 1024, parts: maxFiles + 40 },
    fileFilter: (req, file, cb) => cb(null, TYPES.has(file.mimetype)),
  });
  const handler = maxFiles === 1 ? m.single(field) : m.array(field, maxFiles);
  return (req, res, next) => {
    const who = req.user ? `u${req.user.id}` : ipKey(req.ip);
    if (!hit(`upload|${who}`, PER_PERSON, 10 * 60 * 1000)) {
      return res.status(429).render('pages/error', { title: 'Slow down', message: "That's a lot of uploads in a short time. Wait a few minutes, then try again." });
    }
    if (activeTotal >= MAX_ACTIVE || (active.get(who) || 0) >= PER_PERSON_ACTIVE) {
      res.set('Retry-After', '10');
      return res.status(503).render('pages/error', { title: 'Busy right now', message: 'A lot of photos are being uploaded at the moment. Wait a few seconds, then go back and try again.' });
    }
    activeTotal += 1;
    active.set(who, (active.get(who) || 0) + 1);
    req.incoming = [];

    let lastBytes = req.socket ? req.socket.bytesRead : 0;
    const stall = setInterval(() => {
      const now = req.socket ? req.socket.bytesRead : lastBytes;
      if (now - lastBytes < STALL_MIN_BYTES) req.destroy();
      lastBytes = now;
    }, STALL_CHECK_MS);
    stall.unref();

    let done = false;
    const finish = () => {
      clearInterval(stall);
      if (done) return;
      done = true;
      activeTotal -= 1;
      const n = active.get(who) - 1;
      if (n) active.set(who, n);
      else active.delete(who);
      for (const f of req.incoming) fs.rm(f, { force: true }, () => {});
    };
    res.once('finish', finish);
    res.once('close', finish);
    handler(req, res, (err) => {
      // The whole body is in; from here it's our own work, which the stall check mustn't cut short.
      clearInterval(stall);
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

// The browser's file type is only a claim, and sharp picks its decoder from the file's own bytes,
// so an SVG or TIFF renamed .jpg would reach decoders we never meant to expose. Only let through
// files that start like a JPEG, PNG, WebP or HEIC/AVIF photo.
const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1', 'avif', 'avis']);
function isPhoto(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true;
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return true;
  return buf.toString('latin1', 4, 8) === 'ftyp' && HEIF_BRANDS.has(buf.toString('latin1', 8, 12));
}

// The first bytes of an uploaded file, whether it's in memory or in the temp folder.
function head(file) {
  if (file.buffer) return file.buffer;
  const buf = Buffer.alloc(12);
  const fd = fs.openSync(file.path, 'r');
  try {
    return buf.subarray(0, fs.readSync(fd, buf, 0, 12, 0));
  } finally {
    fs.closeSync(fd);
  }
}

// Re-encode and save one image. Returns the file name (the thumbnail is name-sm.jpg).
function save(file, { isPrivate = false, maxSide = 1800 } = {}) {
  return oneAtATime(async () => {
    if (!isPhoto(head(file))) throw new Error('Not a photo');
    const dir = isPrivate ? privateDir : config.uploadDir;
    const name = crypto.randomBytes(12).toString('hex');
    const img = sharp(file.buffer || file.path, { failOn: 'error', limitInputPixels: MAX_PIXELS }).rotate();
    await img.clone().resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(dir, `${name}.jpg`));
    await img.clone().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true }).toFile(path.join(dir, `${name}-sm.jpg`));
    return `${name}.jpg`;
  });
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

module.exports = { receive, save, saveAll, remove, thumb, privatePath, privateDir, isPhoto, UNREADABLE, MAX_MB };
