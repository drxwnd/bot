// Makes an existing account the site admin (owner level). In production this is the only way to
// create the first admin, so nobody can claim it by signing up with the admin address first.
//
//   node scripts/make-admin.js you@example.com
//   fly ssh console -C "node scripts/make-admin.js you@example.com"
//
// Sign up on the site with that email first, then run this.

const db = require('../src/db');

const email = String(process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/make-admin.js you@example.com');
  process.exit(1);
}
const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
if (!user) {
  console.error(`No account with ${email}. Sign up on the site with that email first.`);
  process.exit(1);
}
if (db.prepare("SELECT 1 FROM tradie_profiles WHERE user_id = ?").get(user.id)) {
  console.error('That account has a tradie business on it. Use a separate email for the admin account.');
  process.exit(1);
}
db.prepare("UPDATE users SET role = 'admin', admin_level = 'owner', session_key = lower(hex(randomblob(16))) WHERE id = ?").run(user.id);
console.log(`${email} is now the admin. Log in again to see /admin.`);
