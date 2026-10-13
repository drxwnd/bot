# Launching Tradebench

The site is built. What's left is accounts, settings and getting the first tradies and customers on. Work through this top to bottom. Most of it is a one-off afternoon; the last section is the part that makes money.

## 1. Paperwork (free or cheap)

- **ABN: free.** Apply at [abr.gov.au](https://www.abr.gov.au/business-super-funds-/applying-abn). It costs nothing and often comes through straight away. You need one for Stripe in your business's name, for the `.com.au` domain, and to look legitimate to tradies.
- **Business name: about $45 a year** with ASIC, only if you trade under a name that isn't your own (you will: "Tradebench").
- **`tradebench.com.au`**: once you have the ABN you can register it. Point it at the same site and add it to `REDIRECT_HOSTS` so it forwards to the main address.
- **GST**: you don't need to register until your fee income passes $75,000 a year. When you do, GST comes out of your fee (1/11 of it).
- **Stripe** must be in the name of someone 18 or over. If that's not you yet, it can be a parent, with you running the business.
- **Insurance**: get public liability and professional indemnity for the platform itself. A broker can quote both together.
- **Terms and privacy**: `/terms` and `/privacy` are solid drafts, but get a lawyer to read them once before you take real money. Ask them specifically about: holding customer funds through Stripe, the 12-month no-going-around-us clause, and WA home building rules (below).

**WA rules worth knowing:**
- Residential building work over $20,000 needs a registered building contractor, and usually home indemnity insurance.
- Plumbers, gasfitters and electricians must be licensed for almost everything.

When you approve tradies, check their licence on the right register. Their job alerts only go to the trades they listed, so if you approve someone you're vouching for them.

## 2. Accounts to set up

| What | Where | Cost to start |
|---|---|---|
| Hosting | [fly.io](https://fly.io) | About US$5 to 7 a month |
| Card payments and payouts | [Stripe](https://dashboard.stripe.com) with Connect turned on | Per transaction only, see section 4 |
| Email | [resend.com](https://resend.com) | Free up to 3,000 a month (100 a day) |
| Search | [Google Search Console](https://search.google.com/search-console) | Free |
| Visitor stats (optional) | [plausible.io](https://plausible.io) | About US$9 a month |

### Stripe

1. Finish activating your Stripe account (business details, bank account, ID).
2. Go to **Connect** and get started. Choose **Platform or marketplace**, **Express** accounts, platform country **Australia**. Fill in the platform profile: you collect payments from customers and pay out service providers.
3. **Developers > API keys**: copy the secret key. Start with the `sk_test_` one.
4. **Developers > Webhooks > Add endpoint**: `https://tradebench.au/stripe/webhook`, with these events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `account.updated`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`.
   Copy the signing secret (`whsec_...`).

### Email (Resend)

1. Sign up and add your domain (`tradebench.au`).
2. Resend shows you a few DNS records. Add them where your domain is (GoDaddy > DNS). They let your emails land in inboxes instead of junk.
3. Create an API key.

Without email the site still works, but nobody gets job alerts, quote alerts or password resets, and that's most of what brings people back.

## 3. Put it online (Fly.io)

```
# once
brew install flyctl          # or see fly.io/docs/flyctl/install
fly auth signup
fly launch --no-deploy       # keep the existing fly.toml; pick a unique app name
fly volumes create tradebench_data --region syd --size 3

# settings (use your real values)
fly secrets set \
  SITE_URL=https://tradebench.au \
  SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
  ADMIN_EMAIL=you@yourmail.com \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  RESEND_API_KEY=re_... \
  EMAIL_FROM="Tradebench <hello@tradebench.au>" \
  SUPPORT_EMAIL=hello@tradebench.au \
  REDIRECT_HOSTS=www.tradebench.au

fly deploy
fly certs add tradebench.au
fly certs add www.tradebench.au
```

`fly certs add` tells you which DNS records to add at GoDaddy. Once they're in, the site is live on your domain with HTTPS.

The site won't start in production if something important is missing, like the session secret, Stripe keys or admin email. It prints exactly what's missing in `fly logs`.

**Then:**
- Sign up on the live site with your `ADMIN_EMAIL`. That account is the admin.
- Open `/admin`. The **Set-up** panel shows green or amber for payments, webhook, email and fees.

**Backups:**
- The site copies the database to `/data/backups` every day and keeps 14 days.
- Fly also snapshots the whole volume daily.
- For extra safety later, add [Litestream](https://litestream.io) to stream the database to cheap cloud storage.

**Scaling:** the site runs as one machine on purpose, because the database lives on its disk. That's fine for thousands of jobs a month. Don't add a second machine without moving to a shared database first.

## 4. Pricing: do the maths before you launch

Stripe's costs come out of your fee, not the tradie's. They're roughly:
- 1.7% + 30c per Australian card payment (international cards about 3.5% + 30c)
- about 0.25% + 25c per payout
- about $2 a month for each tradie paid that month

Check the current figures at [stripe.com/au/pricing](https://stripe.com/au/pricing) and [stripe.com/au/connect/pricing](https://stripe.com/au/connect/pricing).

What you keep per job, roughly, after Stripe:

| Job | 4% only | 4% with $15 minimum | 4% + 2% customer fee |
|---|---|---|---|
| $200 | $3.60 | $10.60 | $7.50 |
| $500 | $9.80 | $9.80 | $19.60 |
| $1,500 | $30.30 | $30.30 | $59.80 |
| $5,000 | $102 | $102 | $201 |

On 4% alone you keep about 2% of every job. Two settings change that, and both are off until you turn them on:
- `MIN_FEE_DOLLARS=15`: no job earns you less than $15. Tradies still pay far less than buying leads elsewhere, where they pay whether they win or not.
- `CUSTOMER_FEE_PERCENT=2`: adds a "secure payment fee" at checkout. It's shown clearly before they pay, refunded with any refund, and covered in the terms. This roughly doubles what you keep.

**My suggestion:** launch with both, `MIN_FEE_DOLLARS=15` and `CUSTOMER_FEE_PERCENT=2`. Set them with `fly secrets set` and the site's wording updates itself.

## 5. Test with fake money, then switch to real

In Stripe test mode, run one job all the way through on the live site:
1. A tradie account signs up and adds business details. You approve it in `/admin`.
2. The tradie connects payouts using Stripe's test details.
3. A customer account posts a job. The tradie quotes, the customer accepts and pays with card `4242 4242 4242 4242` (any future date, any CVC).
4. The customer releases payment. Check Stripe shows the payment and the transfer, and that every email arrived (`/admin` > Recent emails).
5. Refund a test job from `/admin` and check it shows in Stripe.

Then swap in the live keys: `fly secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...`. Create a live-mode webhook endpoint too, because test and live have separate secrets.

## 6. What the site now does for you automatically

- **Job alerts:** emails every approved tradie whose trades, areas and work types match a new job. This is the main thing that gets quotes in fast.
- **Quote and payment emails:** the customer hears about every quote. The tradie hears when they win, when the money is held, and when it's paid out. Losing quoters get a polite "job filled".
- **Contact details** only appear once the customer has paid. Both sides get each other's phone and email at that point, not before. That keeps the job (and your fee) on the platform.
- **Reminders, checked every hour:**
  - quotes waiting a day: nudges the customer
  - payment held 7 and 14 days: asks the customer if the job's done
  - held 21 days: alerts you
  - tradie hasn't finished sign-up: nudges them
  - tradie approved but no payouts: nudges them
- **Alerts to you:** a new tradie to check, a job with no quotes after 3 days (ring someone), and card disputes, which also block release until resolved.
- **Account basics:** password reset by email, and an unsubscribe link on alert emails (required under the Spam Act).

## 7. Getting the first 100 jobs

A marketplace makes money when a job gets three good quotes fast. Everything below is about that.

**Weeks 1 to 2: tradies first.**
- Sit down with your dad and list every tradie he'd vouch for.
- Aim for 20 to 30 across tiling, plumbing, electrical, handyman, painting and air con, in two or three areas close to home.
- Sign them up in person on their phone: profile, licence, insurance, payouts. It takes 10 minutes each.
- The pitch: no lead fees, paid before they start, and the money's guaranteed.

**Weeks 2 to 6: one kind of customer.**
- Don't market to "everyone in Perth". Pick property managers and short-stay or small hotel operators in those same areas.
- They post jobs every week, they're not price-shopping for the cheapest, and one good relationship is dozens of jobs.
- Ring or walk into 30 agencies. Offer: "Post your next maintenance job and you'll have three quotes from checked local tradies within 48 hours, and you only pay when it's done."
- Keep that promise by hand. When `/admin` emails you about a job with no quotes, ring a tradie.

**All along:**
- **Google:** set up a Google Business Profile, and submit `https://tradebench.au/sitemap.xml` in Search Console. The trade and area pages are built to rank for searches like "tiler Bayswater" over the following months.
- **Reviews:** ask every happy customer for a review. The site emails them a link after they release payment.
- **Groups:** post in local Facebook community groups when you can honestly say "we've got tilers and plumbers free this week in [suburb]".
- **Metrics:** watch the **Last 30 days** numbers in `/admin`. The ones that matter are quotes per job (aim for 3+), jobs with no quotes (aim for 0), and jobs paid.

When those numbers hold up in your first areas, add the next area, then the next trade. That's the business.
