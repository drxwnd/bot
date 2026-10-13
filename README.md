# Tradebench

Marketplace for repair, maintenance and building jobs for homes, hotels and mine sites across WA.

Customers post jobs for free and checked tradies send quotes. The customer pays the accepted quote by card and the money is held until the customer signs the job off. The tradie is then paid the quote minus a 4% platform fee.

## Run it locally

```
npm install
npm run seed      # test accounts and jobs, password: password123
npm run dev       # http://localhost:3000
npm test          # end-to-end test of the whole job flow
```

To show the site off with realistic sample businesses, jobs, quotes and reviews, load the demo data into an empty folder:

```
DATA_DIR=./demo-data npm run demo
DATA_DIR=./demo-data npm run dev
```

Without `STRIPE_SECRET_KEY`, payments are simulated so you can click through everything. Seeded logins: `admin@test.local`, `customer@test.local`, `tiler@test.local`, `plumber@test.local`, `pending@test.local`.

## How the money works

Uses Stripe Connect (Express accounts) with separate charges and transfers:

1. Tradies connect their bank through Stripe from **Dashboard → Payouts**.
2. The customer accepts a quote and pays through Stripe Checkout. The funds sit in the platform's Stripe balance.
3. The customer clicks **release**. The quote amount minus 4% is transferred to the tradie, and the 4% stays in your account.
4. Admins can release or refund held payments from `/admin`.

Stripe's fees come out of the platform's share. `MIN_FEE_DOLLARS` and `CUSTOMER_FEE_PERCENT` let you set a minimum fee per job and a small customer-side payment fee. See [LAUNCH.md](LAUNCH.md) for the numbers.

Customer and tradie contact details are only shown to each other once the job is paid, so work stays on the platform.

## Emails and reminders

`src/notify.js` decides who gets told what. Templates are in `src/emails.js`, and sending (Resend or Postmark) is in `src/mailer.js`. Every email is logged in the `emails` table and shown in `/admin`. Without a provider key, emails are logged but not sent.

`src/reminders.js` runs hourly and nudges people when things stall: quotes waiting, payments held, unfinished sign-ups, missing payouts. `src/backup.js` copies the database daily.

## Deploying

**[LAUNCH.md](LAUNCH.md) has the full step-by-step**, including Stripe, email, domain and Fly.io. The short version: the repo has a `Dockerfile` and `fly.toml`. Create the volume, set the secrets from `.env.example`, and run `fly deploy`. The app refuses to start in production if a required setting is missing, and `/healthz` reports whether it's up.

## Job locations

Customers type one address. `src/locality.js` finds the suburb or town in it, along with the postcode and area tag. Only the suburb is shown publicly. The full address is shown to the customer and to the tradie whose quote they accept.

The WA suburb list (`src/data/wa-localities.json`) is built from the community-maintained [australianpostcodes](https://github.com/matthewproctor/australianpostcodes) list. Each suburb gets the area of its nearest reference town. To refresh it, download `australian_postcodes.csv` from that repo and run `node scripts/build-localities.js australian_postcodes.csv`.

## SEO

- Every page has its own title, description, canonical URL and social share tags (`views/partials/head.ejs`).
- Landing pages for each trade (`/trades/plumbing`), each area (`/areas/pilbara`) and each trade in each area (`/trades/plumbing/pilbara`). Their copy lives in `src/seo-content.js`.
- Trade + area pages are only indexed once they have an open job or a tradie covering them, so Google doesn't see hundreds of empty pages.
- Structured data for Google: organisation, breadcrumbs, services, FAQs and tradie ratings.
- `/sitemap.xml` updates itself as jobs and tradies are added. `/robots.txt` keeps private pages out.
- After launch, add the site to [Google Search Console](https://search.google.com/search-console), put the verification code in `GOOGLE_SITE_VERIFICATION`, and submit the sitemap.

## Running the site

- Sign up with the `ADMIN_EMAIL` address to get the admin account.
- New tradies appear in `/admin` as pending. Before approving one, check their ABN (the admin page links to it), their licence on the relevant WA register, and their insurance.
- The terms and privacy pages are drafts. Have a lawyer review them before launch.

## Code

- `server.js`: app setup and security headers
- `src/routes/`: pages and actions (jobs, quotes, payments, dashboards, admin, Stripe webhook)
- `src/payments.js`: all Stripe logic
- `src/db.js`: SQLite schema
- `views/`: EJS templates
- `public/css/style.css`: all styles
