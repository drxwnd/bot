// Daily copy of the database to DATA_DIR/backups, one file per (Perth) day, keeping the last 14 days.
// SQLite's online backup is safe to run while the site is live. This guards against mistakes and
// corruption; for losing the whole disk, also turn on your host's volume snapshots (Fly does daily
// snapshots by default). Uploaded photos aren't in here: the volume snapshots cover those.

const fs = require('fs');
const path = require('path');
const config = require('./config');
const db = require('./db');

const dir = path.join(config.dataDir, 'backups');
const KEEP = 14;

// Today's date in Perth (UTC+8, no daylight saving), as YYYYMMDD.
const perthDay = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '');

// Writes today's backup, or skips it if today's already exists (unless `force`). Restarting the
// site many times in a day used to make a backup each time and push older days out.
async function backup({ force = false } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `tradebench-${perthDay()}.db`);
  if (!force && fs.existsSync(file)) return null;
  // Leftovers from a backup that failed part way.
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'))) fs.rmSync(path.join(dir, f), { force: true });
  // The backups share the disk with the live database. If a copy won't fit with room to spare, skip it
  // rather than fill the disk and stop the site saving anything.
  const { bavail, bsize } = fs.statfsSync(dir);
  const needed = 2 * fs.statSync(db.name).size;
  if (bavail * bsize < needed) {
    throw new Error(`Not enough free disk space for a backup (${Math.round((bavail * bsize) / 1e6)}MB free, ${Math.round(needed / 1e6)}MB wanted). Run fly volumes extend.`);
  }
  // Write to a temporary name first, so a crash half way never leaves a broken file under today's name.
  try {
    await db.backup(`${file}.tmp`);
  } catch (err) {
    fs.rmSync(`${file}.tmp`, { force: true });
    throw err;
  }
  fs.renameSync(`${file}.tmp`, file);
  const old = fs.readdirSync(dir).filter((f) => /^tradebench-\d+\.db$/.test(f)).sort().slice(0, -KEEP);
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
  return file;
}

function start() {
  const run = () => backup().then((f) => f && console.log(`Backup saved: ${f}`)).catch((err) => console.error('Backup failed:', err));
  const first = setTimeout(run, 5 * 60 * 1000);
  // Hourly check; it only does anything once a day.
  const every = setInterval(run, 60 * 60 * 1000);
  first.unref();
  every.unref();
}

module.exports = { backup, start };

// `npm run backup` always writes a fresh copy of today's backup.
if (require.main === module) backup({ force: true }).then((f) => console.log(`Backup saved: ${f}`));
