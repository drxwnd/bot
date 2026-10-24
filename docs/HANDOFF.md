# Handoff: where Tradebench is up to (24 Oct 2026)

Read this first when picking the project up on a new computer or in a new Claude Code session.

## What it is

Tradebench is a Perth/WA marketplace for repair, maintenance and building jobs: customers post jobs, checked tradies quote, the customer pays into a held Stripe payment and releases it when the work is done. Node 22+ / Express 5 / SQLite (better-sqlite3) / EJS / cookie-session / Stripe Connect / Resend.

- Repo: https://github.com/drxwnd/bot, branch `claude/job-marketplace-platform-apy73w` (the only branch; it's the default).
- Live: https://trade-bench.com (www redirects to it), on one Fly.io machine in Sydney, app name `trade-bench`.
- `LAUNCH.md`: launch checklist. `docs/GROWTH_PLAN.md`: the full growth and marketing plan. `docs/SECURITY_AUDIT.md`: audit findings still to fix or check. `docs/OUTREACH.md` and `docs/LAUNCH_POSTS.md`: scripts and draft posts.

## Set up a new computer (Windows)

1. Install **Node.js 22 LTS or newer** (better-sqlite3 13 needs 22+), **Git** and the **GitHub CLI**. Then `gh auth login` (GitHub.com, HTTPS, browser).
2. Clone and install:
   ```
   git clone https://github.com/drxwnd/bot.git tradebench
   cd tradebench
   npm install
   ```
   If `npm install` fails on better-sqlite3 (it compiles from source), install Python 3 and the Visual Studio Build Tools "Desktop development with C++" workload, then run it again.
3. Run it locally with demo data (password for all demo logins: `password123`, e.g. admin@demo.local, sarah@demo.local, dan@demo.local):
   ```
   $env:DATA_DIR='demo-data'; npm run demo     # once, into an empty folder
   $env:DATA_DIR='demo-data'; npm run dev      # http://localhost:3000
   ```
   Locally, two-step login isn't required for admin pages (set `ADMIN_TWO_STEP=1` to try it).
4. Tests: `npm test` (82 passing with the email gaps, C1–C5 and the first money findings fixed).
5. Pushing: if `git push` says "Invalid username or token", either run `gh auth setup-git` once (makes git use the GitHub CLI login), or push with
   `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin claude/job-marketplace-platform-apy73w`.
6. Deploying needs the Fly CLI: install it with `iwr https://fly.io/install.ps1 -useb | iex`, then `fly auth login` (the Fly account is the owner's Gmail). Deploy from the repo folder:
   ```
   ~\.fly\bin\flyctl.exe deploy --remote-only --app trade-bench
   ```
   Fly builds on its own servers, so Docker isn't needed locally. Check it afterwards: `https://trade-bench.com/healthz` should answer `ok`.

## Live setup (nothing secret here)

- **Fly:** one always-on machine (`fly.toml`), volume `tradebench_data` (3 GB) mounted at `/data` for the database, uploads and daily backups. The app runs as the `node` user.
- **Secrets on Fly** (names only; values are never in git): SESSION_SECRET, SITE_URL, REDIRECT_HOSTS, ADMIN_EMAIL, SUPPORT_EMAIL, EMAIL_FROM, MIN_FEE_DOLLARS (15), CUSTOMER_FEE_PERCENT (2), MAX_QUOTE_DOLLARS (20000), STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, INDEXNOW_KEY. The owner enters Stripe/Resend keys with `scripts/set-fly-keys.ps1` (hidden typing, straight to Fly). **Never change SESSION_SECRET casually:** two-step login secrets are encrypted with a key made from it, so changing it switches two-step off for everyone.
- **Domain (GoDaddy DNS):** A/AAAA `@` to Fly; `www` CNAME to the apex; CAA `0 issue "letsencrypt.org"`; Resend sending records (`resend._domainkey` TXT, `send` and `rsend` CNAMEs); ImprovMX MX (`mx1`/`mx2.improvmx.com`) plus SPF `v=spf1 include:spf.improvmx.com ~all`; Google Search Console verification TXT; GoDaddy's own `_dmarc` (p=quarantine).
- **Email:** the site sends from `Tradebench <support@trade-bench.com>` through Resend. Mail to any @trade-bench.com address forwards to the owner's Gmail through ImprovMX (catch-all). Gmail "Send mail as" support@ uses smtp.resend.com, port 587, TLS, user `resend`.
- **Search:** Search Console domain property verified and sitemap submitted (47 pages read). IndexNow is on for Bing. Bing Webmaster Tools isn't set up yet (it can import from Search Console).
- **Stripe:** still **test mode**, in the sandbox of an existing account named "Semantically AI", with a webhook "Tradebench (trade-bench.com)" sending 6 events to `/stripe/webhook`. Before real money: a live Stripe account in Tradebench's (owner's) name with Connect on, and new keys + webhook secret (see `docs/GROWTH_PLAN.md` section 4).
- **Admin:** the owner's Gmail account is the site admin (made with `scripts/make-admin.js`). On the live site, admin pages require two-step login (Account > Two-step login).

## What was done recently

- Email gaps filled (after 7279e75): founder alerts (every sign-up; every new job with matched-tradie count and "0 MATCHES"; no-quotes alert at 24h, or 4h with no match; unpaid accepted quote at 3 days), "updated their quote" emails, job-closed emails to quoting tradies, review-received emails, pay reminder at 1 day, confirm-email reminders for tradies at 1 and 3 days, and List-Unsubscribe one-click headers. Tests in `test/emails.test.js`.

- Pre-launch fixes, Dockerfile build fix, domain/email/search setup (commits up to 8dd4ca8).
- Security tightening (c77465c): logout revokes the session, checkout de-dup lock, full auto-refunds, upload caps, stricter headers, Dependabot.
- Email verification, Verified badges, two-step login with backup codes (7279e75).

## Open work, in order

1. **Fix the 5 confirmed findings** in `docs/SECURITY_AUDIT.md` (C1–C5), with tests, then deploy.
2. **Check the 36 unreviewed findings** (U1–U36): for each, trace the code or reproduce it locally and decide real or not; fix the real ones. Several touch money (U5, U6, U21–U24) and should come first.
3. **Growth plan P0 product fixes** (`docs/GROWTH_PLAN.md` section 10): hold back checkout until Stripe is live, source tracking, claims/copy fixes (e.g. "pay only when it's done", "mine sites" in the title, the 2% fee wording on the terms page given the card-surcharge ban), the email-confirmation step in the tradie checklist, empty states, live "You'll receive $X" on quotes. Some of these are business decisions (fee refunds, quote caps of $7,499 on homes): confirm with the owner first.
4. **Owner-only steps** (accounts, money, legal): turn on two-step for the admin account; confirm the admin email; two-step on GitHub, Fly, GoDaddy (and Domain Lock), Stripe, Resend, ImprovMX, Google; ABN; legal and accountant questions; live Stripe account; backups copied off the Fly machine.

## How the owner likes to work

- Plain English, short and honest updates. Say what was verified and what wasn't.
- At most **3 agents running at once** (so usage lasts).
- Never type or see keys/passwords; the owner enters them. Don't create accounts or sign in for them.
- Ask before anything public (posts, emails to people, DNS or account changes). Draft posts live in `docs/LAUNCH_POSTS.md` and need the owner's OK on the exact text and the place.
- Commit, push and deploy when asked, then check the live site.
