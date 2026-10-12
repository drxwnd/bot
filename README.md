# ezbuild

Marketplace for repair, maintenance and building jobs in Perth, WA.

Customers post jobs for free and checked tradies send quotes. The customer pays the accepted quote by card and the money is held until the customer signs the job off. The tradie is then paid the quote minus a 4% platform fee.

## Run it locally

```
npm install
npm run seed      # test accounts and jobs, password: password123
npm run dev       # http://localhost:3000
npm test          # end-to-end test of the whole job flow
```

Without `STRIPE_SECRET_KEY`, payments are simulated so you can click through everything. Seeded logins: `admin@test.local`, `customer@test.local`, `tiler@test.local`, `plumber@test.local`, `pending@test.local`.

## How the money works

Uses Stripe Connect (Express accounts) with separate charges and transfers:

1. Tradies connect their bank through Stripe from **Dashboard → Payouts**.
2. The customer accepts a quote and pays through Stripe Checkout. The funds sit in the platform's Stripe balance.
3. The customer clicks **release**. The quote amount minus 4% is transferred to the tradie, and the 4% stays in your account.
4. Admins can release or refund held payments from `/admin`.

Stripe's card fee (about 1.7% + 30c for Australian cards) comes out of the platform's share, so you keep about 2.3% on a typical job.

Before going live, set up Stripe:

1. Turn on **Connect**, choosing Express accounts with the platform in Australia.
2. Add the webhook endpoint described in `.env.example`.
3. Swap the test keys for live keys.

## Deploying

Any host that runs Node 20+ with a persistent disk works (Render, Railway, Fly.io or a small VPS).

1. Set the variables from `.env.example`.
2. Point `DATA_DIR` and `UPLOAD_DIR` at the persistent disk.
3. Run `npm install`, then `npm start`.
4. Point your domain at the host.

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
