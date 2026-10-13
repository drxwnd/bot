// Daily copy of the database to DATA_DIR/backups, keeping the last 14. SQLite's online backup is
// safe to run while the site is live. This guards against mistakes and corruption; for losing the
// whole disk, also turn on your host's volume snapshots (Fly does daily snapshots by default).

const fs = require('fs');
const path = require('path');
const config = require('./config');
const db = require('./db');

const dir = path.join(config.dataDir, 'backups');
const KEEP = 14;

async function backup() {
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const file = path.join(dir, `tradebench-${stamp}.db`);
  await db.backup(file);
  const old = fs.readdirSync(dir).filter((f) => /^tradebench-\d+\.db$/.test(f)).sort().slice(0, -KEEP);
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
  return file;
}

function start() {
  const run = () => backup().then((f) => console.log(`Backup saved: ${f}`)).catch((err) => console.error('Backup failed:', err));
  const first = setTimeout(run, 5 * 60 * 1000);
  const every = setInterval(run, 24 * 60 * 60 * 1000);
  first.unref();
  every.unref();
}

module.exports = { backup, start };

if (require.main === module) backup().then((f) => console.log(`Backup saved: ${f}`));
