# Tradebench Growth Plan

*Written 24 October 2026 for the founder of Tradebench (trade-bench.com, Perth WA), and revised after two reviews.*

**How to read this.**
- Every number links to its source. Anything I worked out myself is marked **(estimate)**, and anything that rests on my opinion is marked **(judgement)**.
- Where the research couldn't confirm something, the plan says so. The evidence notes at the end list the figures to re-check before you use any of them in public.
- File and line references to the Tradebench repo were checked on 24 October 2026.
- None of this is legal, tax or financial advice. Section 4 lists the points where you need a lawyer or an accountant before you act.

**Where you are today:**
- Live for 3 days, with 0 tradies and 0 real jobs.
- Stripe is in test mode, and there's no ABN yet.
- Hosting costs about US$5 a month.

**What this plan assumes about you.** Check these on Day 1 and change the plan if any are wrong.
- **About 20 hours a week.** That's a school-term load: weekday afternoons from about 3:30 to 5pm, while agencies are still open, plus Saturdays. If you're at school, check your exam dates first. This plan treats school hours as off-limits. If you have 35+ hours a week, do the same steps faster. Don't add more steps.
- **A parent is the legal owner if you're under 18.** Stripe requires a guardian to own the account before it can accept charges ([Stripe](https://support.stripe.com/questions/age-requirement-to-create-a-stripe-account)). The parent also:
  - pays the one-off setup costs;
  - decides any dispute over $500 (judgement);
  - fronts or joins business meetings. Contracts signed by under-18s in WA may not bind them ([Youth Law Australia](https://yla.org.au/wa/topics/courts-police-and-the-law/contracts/)), so agencies may not take a pitch from a minor seriously.
- **You can get to the area you pick**, by your own car, a parent driving, or public transport. Choose the cluster with this in mind.

So the first job isn't marketing. There are three jobs, in this order:
1. Make the business able to take real money safely.
2. Find out, in a handful of conversations, which customers can actually pay this way.
3. Win one small patch of Perth by hand.

---

## 1. The one-page summary

**The plan in one sentence.** Win one small patch of Perth by hand before you spend money or expand:
- 4–6 neighbouring suburbs where your dad's tradies already work,
- 3–4 trades,
- one type of customer, chosen *after* 5–10 discovery conversations, not before.

Why so narrow:
- 16 of the 17 big marketplaces studied by Lenny Rachitsky "constrained" their start, by place or by type of work. Thumbtack was the exception ([Lenny](https://www.lennysnewsletter.com/p/how-to-kickstart-and-scale-a-marketplace)).
- Spreading early is expensive. OpenTable spread to 50 cities. It was spending about $1M a month and bringing in about $100,000 in revenue, then pulled back to 4 cities ([Fortune](https://fortune.com/2009/08/14/opentable-the-hottest-spot-in-town/)).

### This week (Mon 26 Oct – Sun 1 Nov), about 17 hours
1. **Agree who owns the business and what your parent's role is**, and write it on one page. Apply for the ABN, which is free.
2. **Start the advice you need:**
   - Email 2–3 lawyers asking for a written fixed-fee quote on the ranked question list in section 4.3.
   - Book a free SBDC session.
   - Ask an accountant one question: is your GST turnover your fees, or the whole job value (section 4.4)?
3. **Ship product fixes 1 and 2** (section 10): hold back the test checkout, and send yourself an alert for every job and sign-up.
4. **Pick your cluster** with the scoring rule in section 3.
5. **Sit down with your dad.** List 20–30 tradies he'd vouch for, check their licences, and book the first sign-ups.
6. **Book 5–10 discovery conversations** with property managers, short-stay managers and hosts (section 6.1).

### This month (November)
- Legal review under way and the live Stripe application submitted in the owner's name. Realistically, live payments land in **December**, not November **(estimate)**.
- 8–12 checked tradies signed up (2–3 per trade). Add more only when jobs go unquoted.
- 5–10 discovery conversations, then a decision on your first type of customer.
- About 30 sales conversations with that customer type.
- Every risky claim fixed: the badge, the total price, the quote caps, "pay only when it's done" in the site copy, and the fee wording on the terms page.
- 3–5 real jobs posted. Count the ones actually posted, not promises.

### This quarter (November – January)
- First paid jobs in December, run by hand from start to finish.
- The base scenario expects about **4 paid jobs in total by the end of January** (0 + 1 + 3; **estimate**, section 9). That's normal. This quarter, judge yourself on whether jobs get quotes, not on revenue.
- Release and dispute policy live (section 4.6).
- "Bring your own customer" tested with 3–5 tradies (section 5, step 11).
- Scorecard every Monday, kept as counts (section 8).
- Diary: your first ATO sharing-economy report could be due **31 January 2027** ([ATO SERR](https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/third-party-reporting/sharing-economy-reporting-regime/what-is-the-serr)).

### The 3 numbers that matter most right now

| # | Number | Why | Target |
|---|---|---|---|
| 1 | **Live tradies per trade in your cluster** (approved, with payouts connected) | A tradie who can't be paid isn't really on your marketplace yet | 2–3 per trade at launch. Add one only when a job in that trade gets fewer than 2 quotes in 48 hours **(estimate)** |
| 2 | **Jobs not quoted within 24 hours** (a count; fix every one by hand) | This is liquidity: how reliably a posted job gets quotes. Low liquidity is the main reason marketplaces die ([a16z](https://a16z.com/the-marketplace-glossary/)) | 0–1 a week in months 1–3. Once you're posting 30+ jobs a month, aim for 80% quoted within 24 hours by month 12 **(estimate)**. hipages reports that 84% of its jobs are "connected", but that means a business claimed the lead, with no time limit, so it isn't the same measure ([hipages FY26](https://announcements.asx.com.au/asxpdf/20260824/pdf/0733gw0czqcdyv.pdf)) |
| 3 | **Paid jobs per week** | Your "North Star": the one number that shows real value changing hands | 0 in month 1, about 1 a week by month 3, about 10 a week by month 12 (base scenario, **estimate**) |

**Don't do yet:** paid ads, mining work, more regions, an app, partnerships with big companies, or anything that makes the site look busier than it is.

---

## 2. How marketplaces make money, and why they die

### The money words

| Concept | Plain English | What it means for Tradebench |
|---|---|---|
| **GMV** (gross merchandise value) | The total dollar value of jobs paid through the site. It isn't your income. | A $1,000 job adds $1,000 to GMV (plus the customer fee), but only about $38 to your income (section 9.1). |
| **Take rate** | The share of GMV you keep. | You take about 6.3% of GMV gross on a typical job mix and keep about **4%** after Stripe fees (section 9; [Stripe AU](https://stripe.com/au/pricing), [Connect](https://stripe.com/au/connect/pricing)). Airtasker's take rate was 21.7% in FY26 ([Airtasker FY26](https://bulletin.webull.com/qbd/announcement/20260826/499500381/09acc31376e150e92d7a425d9f6e2ba9.pdf)). hipages says tradies pay it about 3.1% of job value, but that figure comes from a report it commissioned, so treat it as marketing ([hipages FY25](https://announcements.asx.com.au/asxpdf/20250822/pdf/06n5s617jxwy2l.pdf)). Bill Gurley argues that a low fee makes a marketplace last longer, because a high one pushes users to rivals or to deal directly ([Gurley](https://abovethecrowd.com/2013/04/18/a-rake-too-far-optimal-platformpricing-strategy/)). |
| **Liquidity** | How reliably a posted job gets quotes quickly. | One job that never gets a quote can lose you a customer for good. |
| **Chicken and egg (the cold start)** | Customers won't come without tradies, and tradies won't come without jobs. | You have neither yet, so you solve it by hand, working both sides in the same weeks. |
| **The hard side** | The scarcer side, which creates most of the value. | In Perth that's probably **tradies**. HIA's trades-availability index for Perth was −1.15 in the March quarter of 2026 ([HIA Apr 2026](https://hia.com.au/our-industry/newsroom/economic-research-and-forecasting/2026/04/strong-home-building-activity-highlights-ongoing-demand-for-skilled-trades)) and −0.79 in the June quarter ([HIA Jul 2026](https://hia.com.au/our-industry/newsroom/economic-research-and-forecasting/2026/07/tradie-shortages-remain-entrenched-despite-housing-market-uncertainty)). Regional WA was −1.54 in the March quarter. Below zero means a shortage. **Caveat:** HIA's index comes from a survey of home builders about labour for new residential building, not repair and maintenance work, so treat it as a rough signal. |
| **Atomic network** | The smallest group of users that works on its own and keeps coming back. | One cluster of suburbs × 3–4 trades × one customer type that hires repeatedly ([Andrew Chen](https://andrewchen.com/solve-a-hard-problem-cold-start-problem/)). |
| **Leakage** | Customer and tradie meet through you, then deal directly to skip your fee. | Your biggest long-term risk, and it's highest with business customers. A property manager who finds a good sparky will put them on their own preferred list after the first job. Thumbtack built payments around 2011–12 and removed them 18–24 months later; without payments it couldn't "close the loop" on which jobs happened ([TechCrunch](https://techcrunch.com/2018/05/05/how-did-thumbtack-win-the-on-demand-services-market/)). Homejoy's cleaners took clients direct, and Homejoy shut down ([Harvard D3](https://d3.harvard.edu/platform-digit/submission/homejoy-a-silicon-valley-darlings-path-to-the-grave/)). Your defences: be worth the fee, make rebooking the same tradie cheap (section 10, fix 14), and keep contact details hidden until payment. |
| **Cost to serve** | Your time per job. | A hand-run job takes about 1–3 hours of your time: calling tradies, then following up with both sides **(estimate)**. At a notional $30 an hour that's $30–90, against about $31 net on a full-fee job. So every early job loses money on a time basis. That's expected. It's why matching moves from your phone into the product once you pass about 5 jobs a week (section 10). |
| **CAC** (customer acquisition cost) | Cash (and time) spent ÷ customers gained. | Count your hours too, at a notional $30 an hour **(estimate)**, so slow channels don't look free. |
| **LTV** (lifetime value) | What a customer is worth to you over time. At your stage, use **12-month LTV**. | Net per job × jobs per year. |
| **LTV:CAC** | Worth ÷ cost. The common rule is above 3, with payback in under 12 months ([David Skok](https://www.forentrepreneurs.com/saas-metrics-2-definitions-2/)). It's a rule for software businesses, but widely used. | See the table below. |

### What different customers are worth (all **estimates**; replace them with your own numbers by month 3)

| Customer | Jobs in a year (assumption) | Worth to you in 12 months | Cost to win | LTV:CAC |
|---|---|---|---|---|
| Homeowner from Google search ads | About 1.3 | About $40 | About A$250–4,300 cash per *paying* homeowner (A$125–1,300 per posted job ÷ 30–50% of posts paid; section 7.5) | **0.16 or less**: a loss on every one |
| Property manager using you as a backup when their regular tradie is busy | 12–24 overflow jobs (1–2 a month; check in discovery) | About $400 if they keep booking through you (half new tradies at $31, half rebooks at $13); about $31 if they go direct after job 1 | 10–20 hours ≈ $300–600 of your time, about $0 cash | **About 0.05–1.3** |
| Short-stay manager with 60–140 listings | About 60 (5 a month), if discovery confirms it | About $1,300 | 10–20 hours ≈ $300–600 of your time | **About 2–4** |
| One active tradie | About 12 paid jobs (base month 12: 40 paid jobs shared across about 40 tradies) | About $330 | — | Most you should pay to recruit one: about $110 (÷3) |

**What the table teaches.**
- Business customers cost almost no cash to win, but they aren't clearly profitable once your time counts. The exceptions are business customers who post several jobs a month and keep rebooking through you.
- So this plan:
  - runs discovery conversations before committing to any segment;
  - prices rebooks low from the start (section 10, fix 14);
  - favours customers who post often.
- An earlier draft of this plan claimed an LTV:CAC of 9 for property managers. It assumed 6 jobs a month, which doesn't fit "the bench for when your regular tradie is booked out".

### Why marketplaces die, and your defence

| Cause of death | Example | Your defence |
|---|---|---|
| Empty marketplace | Airtasker signed up lots of workers with too few tasks. Its founder called it an embarrassing and costly mistake (reported via search results; the [NAB](https://business.nab.com.au/task-masters-24975) page now returns 404) | Recruit tradies to match the jobs you have. Line up customers in the same weeks |
| Expanding too early | OpenTable's 50 cities; Homejoy's 30 cities in 6 months ([First Round](https://review.firstround.com/This-Startup-Launched-in-30-Cities-in-6-Months-Heres-How-They-Did-It)) | One cluster. Expand only when the section 7.9 rule holds |
| Customers who rarely buy | Gurley: once someone finds a provider they like, they stop needing the marketplace ([Gurley](https://abovethecrowd.com/2012/11/13/all-markets-are-not-created-equal-10-factors-to-consider-when-evaluating-digital-marketplaces/)) | Look for customers who hire often, and keep repeat work on the platform with cheap rebooking |
| Leakage | Thumbtack, Homejoy | Held payment, records and licence checks worth the fee; rebooking at 2% |
| Tradies resenting fees | hipages kept only 58% of its Australian subscription revenue over 12 months ([hipages FY26](https://announcements.asx.com.au/asxpdf/20260824/pdf/0733gw0czqcdyv.pdf)) | Charge only on success, and watch the $15 minimum on small jobs |
| Buying growth with discounts | Homejoy's promo customers didn't come back at full price (secondary source) | No discount codes. Spend time, not money |
| Faking activity | ServiceSeeking paid a **$600,000** penalty over reviews its Fast Feedback tool created ([ACCC](https://www.accc.gov.au/media-release/service-seeking-to-pay-penalty-for-misleading-online-customer-reviews)) | Real jobs and real reviews only |

---

## 3. Positioning and messaging

### Pick the cluster: a scoring rule

For each candidate area (a council, or 4–6 neighbouring suburbs), score it like this (judgement):

| Factor | How to measure | Points |
|---|---|---|
| Tradies your dad vouches for who already work there, in your 3–4 trades | Your dad's list | 3 each, max 30 |
| Short-stay listings | The WA register's council-level report ([heat map](https://www.wa.gov.au/organisation/department-of-local-government-industry-regulation-and-safety/short-term-rental-accommodation-registration-data-and-heat-map)); rank your candidates | 10 for the most, scaled down for the others |
| Rental agencies with an office there | Count them on REIWA's find-an-agent search and Google Maps | 1 each, max 10 |
| Reachable in under 30 minutes by your transport | — | 5 if yes, 0 if no |

**Rule:** pick the highest score, but only if the area has at least 2 vouched-for tradies in at least 3 of your trades. Supply comes from your family network, so start where those tradies already work.

**Background numbers:**
- WA had 11,556 registered short-stay properties in July 2025, 46% of them in Perth metro ([WA Government](https://www.wa.gov.au/government/announcements/public-can-now-explore-short-stay-data)).
- Search snippets reported 11,948 statewide and 5,515 in Perth metro at 1 July 2026. That's unverified: the official data is a Power BI report, last updated 6 August 2026 ([WA register data](https://www.wa.gov.au/organisation/department-of-local-government-industry-regulation-and-safety/short-term-rental-accommodation-registration-data)).

### Trades: 3–4 frequent maintenance trades

| Trade | Why | Watch out for |
|---|---|---|
| **Electrician** | Close to balance in HIA's data: +0.03 (the only trade in surplus) in the March quarter, then −0.19 in the June quarter, when no trade was in surplus. These are probably national figures ([HIA Apr](https://hia.com.au/our-industry/newsroom/economic-research-and-forecasting/2026/04/strong-home-building-activity-highlights-ongoing-demand-for-skilled-trades), [HIA Jul](https://hia.com.au/our-industry/newsroom/economic-research-and-forecasting/2026/07/tradie-shortages-remain-entrenched-despite-housing-market-uncertainty)) | Every job needs a licence. Contractors must show their EC number on ads ([WA](https://www.wa.gov.au/organisation/service-delivery/electrical-licensing)) |
| **Handyman** | Many small, frequent jobs: $210–290 per job in Perth ([Airtasker cost guide](https://www.airtasker.com/au/costs/handyman/handyman-prices/)) | No electrical, plumbing or gas work. Painting over $1,000 needs a registered painter |
| **Plumber** | Urgent rental repairs: landlords have 24 hours to arrange essential-service repairs and 48 hours for other urgent repairs ([Consumer Protection WA](https://commerce.wa.gov.au/consumer-protection/urgent-repairs-rental-home)) | Licensed work. Don't take emergency jobs until someone can answer during the day |
| **Air-con** | Summer is starting (judgement). Start with service and repair, where the median job is $190 nationally ([Airtasker](https://www.airtasker.com/au/costs/aircon-repair/air-conditioner-repair-cost/)), plus labour-only installs at $544–726 in Perth ([Airtasker](https://www.airtasker.com/au/costs/aircon-installation/air-conditioner-installation-cost/)) | Hold off on full supply-and-install ($1,263–6,562 nationally, same source) until the platform can release money in stages: today the tradie would pay for the unit and get nothing until sign-off. Refrigerant work needs a refrigerant handling licence (from the Australian Refrigeration Council, "ARCtick"; not researched, so confirm the rule and use its public licence search). The electrical connection needs a licensed electrician |
| *Painters* (optional) | Bigger jobs | Registered painters only for work over $1,000 ([WA](https://www.wa.gov.au/government/multi-step-guides/painters-registration)) |
| *Tiling* (stretch) | Your family tiler helps | Tight supply: −1.03 in the March quarter and −0.96 in the June quarter (HIA, as above). Don't advertise tiling coverage you can't keep up |

### Customers: decide after discovery (section 6.1)

These are the candidates, with the evidence for each and the doubts about each.

1. **Short-stay hosts and the companies that manage their listings.**
   - *For:* registration is required under the STRA Act 2024 ([wa.gov.au](https://wa.gov.au/organisation/department-of-energy-mines-industry-regulation-and-safety/short-term-rental-accommodation-register)). The competitor research reported fines up to $20k for individuals and $100k for companies ([Consumer Protection](https://consumerprotection.wa.gov.au/announcements/short-stay-register-now-open-owners); re-check on the regulator's page).
   - *Against:* there are few big managers. AirROI counts only 5 companies with 10 or more Perth listings ([AirROI](https://www.airroi.com/airbnb-data/management-companies/cloudstays-management)). Airbtics lists Cloudbnb Management (about 140 listings), Let Go BNB (about 107), Easy Home Rentals (about 75), SmartStay WA (about 71) and Staycay (about 59) ([Airbtics](https://airbtics.com/top-airbnb-management-companies-in-perth-australia)). Those counts are Airbtics' own estimates, ranked by its "VRM Index" rather than size. Of the 185 "management companies" it tracks, most are individual hosts.
   - *Also against:* the competitor research notes that from 2026, unhosted Perth stays over 90 nights a year need development approval ([wa.gov.au](https://wa.gov.au/organisation/department-of-energy-mines-industry-regulation-and-safety/short-term-rental-accommodation-register)), which may shrink this segment.
   - *Untested:* whether hosts are happy to pay by card into a held payment, and whether they post often. Both are guesses until discovery.
2. **Small property-management agencies.**
   - *For:* REIWA represents 1,100–1,350 member agencies ([REIWA](https://reiwa.com.au/)), and the urgent-repair deadlines create pressure.
   - *Against:* they will probably use you only as a backup bench (1–2 jobs a month), and leakage to their preferred list is likely.
   - *Untested:* how agencies pay tradies. The only source found says money taken from an agency trust account must follow the property management agreement ([Consumer Protection WA](https://consumerprotection.wa.gov.au/announcements/6000-fine-property-manager-who-took-money-agency-trust-account-kylie-jo-anne-thomas)). Whether they pay on invoice after the owner approves, and whether they could pay a held card payment instead, is a hypothesis to test in discovery.
3. **Homeowners and landlords in your family's network.** They can pay by card easily, but they hire rarely (Gurley's point).
4. **Strata managers** (not researched). They may buy maintenance often. Talk to one in discovery.
5. **Independent motels and serviced apartments.** These usually have no in-house trades (channel research).
6. **Mining:** year 2 at the earliest (section 7.10).

**What you're really up against.** None of this was researched. Ask every discovery contact who they use today. Likely answers:
- franchise networks such as Jim's Group and Hire A Hubby;
- local maintenance contractors who invoice agencies monthly;
- a short-stay manager's own handyman;
- the agency's preferred tradie list, run through maintenance software such as Tapi (jobs, quotes, updates, and tracking of contractor compliance; [Tapi](https://tapihq.com/en-au), [PropertyMe](https://www.propertyme.com.au/blog/propertyme/integrator-spotlight-tapi)).

**If discovery doesn't settle it, start here:**
- owner-occupiers, landlords and individual short-stay hosts in your cluster;
- plus pilots with 1–2 short-stay managers.

Card payment into a held payment is easiest for this group. The product review's view that they fit the flow best is an inference from reading the code, not market evidence.

### Positioning statement

> **For** Perth homeowners, landlords, short-stay hosts and property managers who need repairs done without the risk of paying upfront and getting burned, **Tradebench is** the local job marketplace where **every tradie's licence and insurance are checked and your payment is held until the job is done.** **Unlike** lead sites that charge tradies for shared leads, or task apps where not every worker is licensed, **Tradebench** charges tradies nothing until they've been paid, and every customer gets payment protection by default.

Why this position looks open (re-check each point before using it in ads):
- **Airtasker** holds the money. CHOICE said its workers are ID-checked but "not all will be qualified, registered or insured", but that article dates from 2019 ([CHOICE](https://www.choice.com.au/shopping/shopping-for-services/services/articles/find-a-tradie-websites)).
- **hipages** lets up to 3 businesses claim each lead. It has released "Tap to Pay" and lists Payments on its roadmap ([hipages FY26](https://announcements.asx.com.au/asxpdf/20260824/pdf/0733gw0czqcdyv.pdf)), so check what that does before you compare yourselves. The same CHOICE article says hipages reviews "the qualifications of all businesses", so never claim you're the only site that checks licences.
- **ServiceSeeking**'s terms say it isn't involved in the transaction ([T&Cs](https://www.serviceseeking.com.au/terms_and_conditions)).
- **Service.com.au, Bark and Word of Mouth:** the research found no payment protection mentioned.
- **"No lead fees" alone is taken.** Service.com.au already uses it ([pricing](https://www.service.com.au/pricing)). Lead with the *combination*: held payment, licence checks and a fee you pay only when paid.

**Homepage line:** "Checked Perth tradies. Your money's held until the job's done."

### What each audience gets

| Audience | What they care about | Your value proposition | Proof you can point to |
|---|---|---|---|
| **Tradies** | Getting paid, not paying for dud leads, not being undercut | No subscription, no lead fees, no lock-in. 4% (min $15) only when you've been paid, and the customer's money is held before you start | hipages Australia's revenue per subscribing business averaged about **$2,575** in FY26 ([hipages FY26](https://announcements.asx.com.au/asxpdf/20260824/pdf/0733gw0czqcdyv.pdf)). At 4%, a tradie would need about $64,000 of jobs a year through Tradebench to pay that much **(estimate)**. HIA ran a promotional piece, compiled with Witzer, quoting an Intuit QuickBooks study that each tradie spends about 104 hours a year chasing invoices ([HIA](https://hia.com.au/our-industry/housing/in-focus/2025/05/secure-the-final-payment-upfront)) |
| **Homeowners** | Not getting burned | Checked tradies, and your money is held until the job's done | A Byford plasterer took $78,715 in deposits of up to 50% ([Consumer Protection](https://consumerprotection.wa.gov.au/announcements/warning-about-tradie-who-owes-nearly-79000-allan-jason-dean-howard-allans-plastering)). A Perth installer had 42 complaints and about $62k owed ([Consumer Protection](https://consumerprotection.wa.gov.au/announcements/commissioners-blog-how-avoid-hiring-shady-tradie)) |
| **Property managers / landlords** | Speed, paperwork, a backup when regulars are busy | Your backup bench: checked quotes when your regular tradie is booked out, with a record of each job | Works alongside agency maintenance software such as Tapi |
| **Short-stay / motels** | Fixing things between bookings | Booked around your check-ins. The tradie isn't paid until it's done | Access times and blocked-out times are already in the job form |

### Ready-to-use one-liners

**Tradies**
- "Pay when you get paid. No subscription, no lead fees, no lock-in. 4% (minimum $15) only comes out of money you've been paid."
- "The customer's money is held before you start."
- "In licensed trades, only tradies whose licence we've checked can quote."
- "hipages averaged about $2,575 per subscribing business last year. At our 4%, you'd need about $64,000 of jobs through us to pay that." Link the source wherever you use it.

**Customers**
- "Your payment's held until the job's done."
- "We check every tradie's licence and insurance certificate, the checks WA Consumer Protection tells you to do yourself, plus their ABN." Consumer Protection recommends checking the licence and a public liability certificate of currency ([blog](https://consumerprotection.wa.gov.au/announcements/commissioners-blog-how-avoid-hiring-shady-tradie)). The ABN check is your own addition.
- "Free to post. Your number stays private and the quotes come to you."

**Property managers:** "For when your regular tradie's booked out."

**Short-stay hosts:** "Booked around your next check-in. The tradie isn't paid until it's done." This only stays true if you refund the 2% fee when a tradie doesn't turn up (section 4.6).

### Claims to handle carefully (Australian Consumer Law)

You have to be able to back every claim, and a misleading *overall impression* counts even if each word is true ([ACCC](https://www.accc.gov.au/business/advertising-and-promotions/false-or-misleading-claims)).

| Don't say | Why | Say instead |
|---|---|---|
| "Pay only when the job's done" (default meta description `views/partials/head.ejs:23`, `views/pages/area.ejs:5`, `src/routes/seo.js:161` and `:190`, the flyer headline `views/pages/flyer.ejs:26`) | The card is charged into a hold *before* work starts | "Your payment is held until the job's done" (the homepage already says this) |
| "Mine sites" in the site title and meta description (`views/partials/head.ejs:21`, `:23`) | You can't serve mining yet | Drop it until you can |
| "It covers card processing" (`views/pages/terms.ejs:30`), and keeping the 2% when a job is refunded | From 1 Oct 2026 card surcharges are banned, and calling a surcharge "another type of fee" may mislead ([ACCC](https://www.accc.gov.au/business/pricing/card-surcharges)). Keeping the fee after a no-show also undercuts "the tradie isn't paid until it's done" | Describe what the fee pays for without mentioning card costs (lawyer item 3). Refund it when a job is cancelled before work starts or the tradie doesn't show |
| "2% vs Airtasker's 15.95%" | Airtasker's connection fee is 15.95%, minimum $4.90, **capped at $49.95** ([help article, via a search snippet](https://support.airtasker.com/hc/en-au/articles/360031769372)). From about $2,500, your 2% is more **(estimate)**. Airtasker members pay no connection fee: the membership launched in Feb 2026, and its price reads "$896" in the release but may be "$89" plus a footnote marker ([Airtasker FY26](https://bulletin.webull.com/qbd/announcement/20260826/499500381/09acc31376e150e92d7a425d9f6e2ba9.pdf)) | Compare the total both sides pay, for *non-members*, and show your workings. Re-check Airtasker's fees first |
| "Airtasker takes up to 20%" | Its service fee runs from 20% down to 11.9% by tier ([help article, via a search snippet](https://support.airtasker.com/hc/en-au/articles/900003895046)). Pro Pass ($1,800 + GST a year) gives 0% on up to $22,500 ex-GST of earnings ([Airtasker FY26](https://bulletin.webull.com/qbd/announcement/20260826/499500381/09acc31376e150e92d7a425d9f6e2ba9.pdf)) | "No subscription and no annual pass. 4% only when you're paid" |
| "Oneflare's closed" | Airtasker retired the Oneflare brand and moved its businesses onto Airtasker (same release) | "Oneflare's now part of Airtasker" |
| "Cheaper than hipages" | Above about $2,500–4,000 per job, your 4% can cost a tradie who wins often more than hipages does **(estimate)** | "You never pay for a lost lead, a no-show or a tyre-kicker" |
| "Save $2,575 a year" | That figure is hipages' revenue per subscriber, not what any given tradie pays | "hipages' revenue per subscribing business averaged about $2,575 in FY26" (link it) |
| "Escrow" | Stripe says it "doesn't provide escrow services" ([Stripe docs](https://docs.stripe.com/connect/manual-payouts)) | "Held payment" or "payment protection" |
| "Verified" (the email-only badge) | Customers will read it as licence and insurance checked | "Email confirmed", plus separate badges such as "WA electrical licence EC12345 checked 24 Oct 2026" |
| "Guaranteed payment" (now in `docs/OUTREACH.md`) | A guarantee has to be exactly true | "The customer's money is already held before you start" |
| "Every job and invoice kept per property" (the property-manager script and flyer) | There's no property feature yet | Remove it until it's built |
| "We've got sparkies covering [suburbs]" | Only if it's true right now | Name only the trades and suburbs you can actually cover today |

---

## 4. Phase 0: the setup gates (before you take strangers' money)

### 4.1 The order

| Step | What | Rough cost | Done when |
|---|---|---|---|
| **0.1** | **Owner, structure and a one-page parent agreement.** The options are below this table. The agreement says: who owns the business, who decides disputes over $500, how money comes in and goes out, how many hours each of you commits, and what happens if you stop. | Free SBDC advice ([SBDC](https://www.smallbusiness.wa.gov.au/)). An accountant's fee wasn't researched | Structure chosen and the agreement signed |
| **0.2** | **ABN** in the owner's name. The ABN rules set no minimum age ([ABR](https://www.abr.gov.au/business-super-funds-charities/applying-abn/abn-entitlement)). Then: **register the business name** "Tradebench" with ASIC if you trade under a name that isn't the owner's (the terms page already expects "trading as ___ (ABN ___)" at `views/pages/terms.ejs:11`); **search IP Australia's trade mark records** before printing flyers, since a trading-journal tool is also called TradeBench ([EliteTrader](https://elitetrader.com/et/resources/tradebench.421/reviews)); and open a **business bank account** for the payouts. | ABN free. Business-name, company and bank fees not researched | ABN issued, name registered, account open |
| **0.3** | **Legal review** with the ranked scope in 4.3 | Not verified. Get written quotes | Written advice in hand, terms updated |
| **0.4** | **Accountant: is your GST turnover your fees or the whole job value?** (4.4) | Not researched | Written answer |
| **0.5** | **Insurance decision** (4.5) | Not researched. Get 2 quotes | Decision made |
| **0.6** | **Release, dispute and chargeback policy** (4.6), reviewed by the lawyer | Your time | Policy on the site and in the terms |
| **0.7** | **Live Stripe account** in the owner's name (4.7) | Per-transaction fees only; no setup fee was found ([Stripe](https://stripe.com/au/pricing)) | Live keys (`sk_live_`) in production and the platform payout schedule checked |
| **0.8** | **Product safety and compliance fixes** (section 10, P0 fixes 1–11) | Your time, about 4–5 days | Shipped |
| **0.9** | **Security and operations pass** (4.8) | Your time | Checklist done |
| **0.10** | **Records:** a spreadsheet with tabs for consent, outreach, tradie pipeline, job desk, scorecard and channels. Open a Do Not Call Register account before any cold calling. The Spam Act puts the burden of proving consent on you ([ACMA](https://www.acma.gov.au/avoid-sending-spam)) | DNCR Type A: **$0 for 500 numbers a year** ([DNCR](https://www.donotcall.gov.au/industry/subscription-overview)) | Set up |
| **0.11** | **Diary dates:** SERR reports due 31 Jan and 31 Jul ([ATO](https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/third-party-reporting/sharing-economy-reporting-regime/what-is-the-serr)); collect tradie identity details at sign-up. From 10 Dec 2026, privacy policies of covered businesses must explain automated decisions ([Act](https://www.legislation.gov.au/C2024A00128/asmade/2024-12-10/text/1/epub/OEBPS/document_1/document_1.html)); ask the lawyer whether that covers you. Check the GST position monthly against the accountant's answer | $0 | In the calendar |
| **0.12** | **First real transaction:** one small real job from family or a neighbour, posted with their permission and run end to end with real money | That job's Stripe fees | Payment released and the tradie paid |

**The structure options for step 0.1:**
- **(a) A parent runs it as a sole trader** and holds the ABN and the Stripe account. Tax, chargebacks and legal liability then sit personally with that parent, without limit.
- **(b) A company with a parent as director.** Company officeholders must be 18+ ([ASIC](https://asic.gov.au/for-business-and-companies/companies/company-building-blocks/company-officeholders-directors-and-secretaries)). This limits personal liability, but ASIC charges a registration fee and an annual review fee (amounts not researched).
- **(c) Stay in test mode until you're 18.**
- *Unverified:* whether you could hold shares directly or would need a trust.

### 4.2 What Phase 0 costs, honestly
- **Free:** ABN, DNCR Type A, SBDC advice, Search Console.
- **Cash, amounts not researched:** business-name registration, ASIC fees if you choose a company, the legal review, insurance, bank fees, a business mobile, and fuel for sign-ups.
- **Legal:** the research's guess of "hundreds to low thousands" is **unverified**, and one reviewer thinks several thousand is possible for the full topic list. Don't rely on any number until you have written quotes.
- **Who pays:** the owner (your parent), as setup money. This isn't part of the budget ladder in section 9.8.

### 4.3 The legal review: a ranked, fixed scope

**Must be answered before live payments:**
1. **Holding money.** The platform charges the customer, holds the money in its own Stripe balance, and creates the transfer to the tradie at release (`src/payments.js:155` sets `transfer_group`; `:262–268` calls `transfers.create` with `source_transaction`). Does that make Tradebench a holder of client money, or need a financial services licence? The research couldn't check the payment-services licensing reforms.
2. **Terms for both sides:**
   - the release and dispute policy (4.6), including auto-release;
   - a right to recover a transfer after a card chargeback;
   - unfair contract terms with tradies ([ACCC](https://www.accc.gov.au/business/selling-products-and-services/contracts));
   - consumer guarantees ([ACCC](https://www.accc.gov.au/business/selling-products-and-services/consumer-rights-and-guarantees));
   - how far your liability as a platform goes.
3. **The 2% fee:** its name, how you describe it, and when you refund it, given the card-surcharge ban ([ACCC](https://www.accc.gov.au/business/pricing/card-surcharges)) and the single-total-price rule ([ACCC](https://www.accc.gov.au/business/pricing/price-displays)).
4. **Privacy:** your privacy policy, and consent to share contact details (section 11).

**Can wait, or be designed out for now:**

5. Whether the WA Security of Payment Act touches small repair jobs ([WA](https://www.wa.gov.au/government/multi-step-guides/subcontractor-payment-disputes-security-of-payment-act)).
6. The Home Building Contracts Act. For home building work of $7,500–$500,000, deposits are capped at 6.5% and "upfront payments… are not allowed" ([WA Building and Energy](https://www.wa.gov.au/organisation/building-and-energy/building-or-renovating-your-home)). **Design it out for now by capping every job on a home (including rentals and short-stays) at $7,499.** Ask later, before you build staged payments.
7. Extra licences for some trades, such as refrigerant handling and asbestos removal.

**Where to try first:**
1. The SBDC, which is free.
2. Then ask about the Law Society of WA's referral service, community legal centres and university law clinics (none checked in the research).
3. Then get 2–3 written fixed-fee quotes.

**Timeline:** allow **3–6 weeks** from the first email to written advice **(estimate)**.

**Fallback if the owner can't pay for it yet:** stay in test mode and keep building tradies and customers. Alternatively, and this is your parent's call, run a few small jobs only for people you know personally, under clear written terms and with no public marketing, until the review is done (judgement).

### 4.4 The GST question that could sink the model
- Because the platform charges the customer and transfers to the tradie later, the full job value runs through your Stripe account.
- **If your GST turnover is just your fees** (the research's reading), the base scenario stays under the $75,000 threshold through month 24. Year-2 fees are about $42k **(estimate)**.
- **If it's the whole job value,** the base case would cross $75,000 around month 6 on a projected basis, or month 10 on a trailing-12-month basis **(estimate)**. You'd then owe about 1/11 of every job, which is more than you earn on it.
- business.gov.au says to register once you *expect* turnover to reach $75,000 ([business.gov.au](https://business.gov.au/registrations/register-for-taxes/register-for-goods-and-services-tax-gst)).
- **Ask the accountant:** which applies under your terms, and how to write the terms so Tradebench acts as the agent rather than the seller, if that's their advice. Get the answer in writing, then have the lawyer reflect it in the terms.

### 4.5 Insurance: a decision rule
- **Get quotes.** Ask 2 brokers what cover an online marketplace like this needs (public liability, and whether professional indemnity applies) and what it costs. The cost wasn't researched.
- **Rules (judgement):**
  - Before taking strangers' money, have either cover in place or a written view from a broker or lawyer that you can operate without it for now.
  - Every $100 a month of premium needs about 3–4 more base-mix paid jobs a month to break even (section 9.4).
  - If the quotes come back well above $100 a month, the owner may decide to run only family-network jobs until volume justifies the cover.
- **What you require of tradies:** a public liability certificate of currency. $20m is a common figure in Australian contractor requirements, but it isn't WA law ([Marsh](https://www.au.marsh.com/business/real-estate/real-estate-agents/insights/public-liability-guide-real-estate-professionals.html)).

### 4.6 Release, dispute and chargeback policy
**Where you are today:**
- There's no auto-release. The customer releases the payment. The site reminds them at 7 and 14 days and alerts the admin at 21 (`src/reminders.js`).
- The terms say "we may refund the customer, release the payment to the tradie, or split it, based on the information both parties give us" (`views/pages/terms.ejs:36`). That makes you, or your parent, the judge.
- A tradie's first question will be: "What if they never sign off?"

**Draft policy (judgement; the numbers are proposals for the lawyer to review):**
1. The tradie marks the job done and adds photos. This needs a small product change (fix 8); until then, they text you.
2. The customer then has **5 days** to release the payment or raise an issue. You remind them on day 2 and day 4, and phone once.
3. If there's no response after 5 days and two attempts to reach them, the payment is released to the tradie. This needs a change to the terms.
4. If an issue is raised, both sides send evidence within **48 hours**: photos, messages in the job thread, the accepted quote and any written variation. You decide within **5 business days**: release, refund or split.
5. Decisions over **$500** are made by the owner (your parent), not by you alone.
6. If the tradie doesn't turn up, or the job is cancelled before work starts, the customer gets a full refund, **including the 2% fee**. You absorb Stripe's processing fee (about $9 on a $500 job), because Stripe doesn't return it ([Stripe](https://stripe.com/au/pricing)).
7. Either side can still go to Consumer Protection WA or the State Administrative Tribunal. The terms already say this.
8. **Variations:** any change of scope is agreed in writing in the job thread and paid into a hold *before* the extra work starts. Until a variations feature exists (fix 15), post it as a second, linked job.

**Chargebacks and fraud.**
- Because you charge the customer and transfer to the tradie later, you're the merchant of record. That means a customer can dispute their card payment *after* you've released the money to the tradie.
- Stripe charges A$25 per dispute, plus another A$25 if you contest it, refunded only if you win ([Stripe](https://stripe.com/au/pricing)). The real risk is losing the whole job value.
- The site's own alert says to "reverse the transfer to the tradie in Stripe" (`src/payments.js:320`), but nothing in the tradie terms allows that yet. That's lawyer item 2.
- **Fraud:** someone could use a stolen card, or a fake tradie and fake customer working together, to cash out through you.
- **Defences (judgement):**
  - Meet every tradie in person (already the plan).
  - Cap a new customer's first job at $2,000 until you've spoken to them.
  - Hold a new tradie's first payout until the customer has confirmed by phone.
  - Turn on Stripe's fraud screening, and ask Stripe what rules suit a held-payment marketplace (fix 16).

### 4.7 Live Stripe
- **Owner:** if you're under 18, a guardian must be the owner before the account can accept charges ([Stripe](https://support.stripe.com/questions/age-requirement-to-create-a-stripe-account)).
- **Review:** charging the full price for work done days or weeks later is a risk Stripe may look at closely. A brand-new platform with no history could face extra review, a reserve or payout delays (possible; not researched). Have ready:
  - your terms;
  - your refund and dispute policy;
  - a support contact;
  - a plain description of the hold-and-release flow.

  Don't plan your cash around instant payouts.
- **Payout schedule:** check whether the platform's automatic payouts could move held customer money into the owner's bank account before it's released. Ask Stripe, and consider switching the platform to manual payouts (judgement).
- **Hold limits:** an earlier draft cited a 90-day limit. That page covers connected accounts' own balances on manual payouts ([Stripe docs](https://docs.stripe.com/connect/manual-payouts)), not your setup. What actually applies to you is the card dispute window (not researched) and Stripe's terms for money the platform holds, so ask Stripe. Your own rule: **release or refund within 21 days.**
- **Test accounts:** tradies who set up payouts in test mode must do it again. Express accounts are created at `src/payments.js:53`.

### 4.8 Security and operations pass (before real money)

**From a quick look at the code on 24 Oct.** This isn't a full security review, which is separate from this plan. Already in place:
- security headers (`helmet` in `server.js`);
- session cookies set with `sameSite: 'lax'` and `secure` in production (`server.js:90–95`);
- CSRF tokens on forms;
- passwords hashed with bcrypt (`src/accounts.js`);
- optional two-step login with backup codes (`src/twostep.js`);
- a rate limit on uploads (`src/uploads.js`);
- signature checks on Stripe webhooks (`src/payments.js:341`);
- a daily database backup, keeping 14 days (`src/backup.js`).

**Close these gaps:**
1. **Backups live on the same disk as the database.** That's one Fly machine with the `/data` volume (`fly.toml:11–18`, `:23`), so losing the volume loses both. Copy the backups off the machine (`LAUNCH.md` suggests Litestream) and **test one restore**.
2. Turn on two-step login for every admin and staff account.
3. Keep the live keys and the webhook signing secret only in Fly secrets, never in `fly.toml` or git. Run `npm audit`.
4. Check:
   - upload limits (file types, size, how uploaded files are served);
   - rate limits on login, sign-up and password reset;
   - that the EJS templates only output user content escaped (`<%=`, not `<%-`).
5. **Write a one-page runbook** for these situations:
   - the site is down;
   - a payment is stuck;
   - a card payment is disputed;
   - a tradie's payout details change unexpectedly (phone them before any release);
   - a suspected data breach;
   - who to contact at Stripe.

---

## 5. Phase 1: your first tradies (supply), recruited to match demand

**Targets (estimate):**
- 8–12 tradies in month 1 (2–3 per trade);
- about 15 live by month 3, 20–25 by month 6, and about 40 by month 12.

**When to add one:** add a tradie in a trade only when a job in that trade gets fewer than 2 quotes within 48 hours, or when that trade's tradies turn down more than half its jobs. hipages lets up to 3 businesses claim each lead ([hipages FY26](https://announcements.asx.com.au/asxpdf/20260824/pdf/0733gw0czqcdyv.pdf)), so 2–3 good tradies per trade is a sensible start.

**Why not sign up 20–30 tradies now:**
- The base scenario has 0–1 paid jobs a month until December.
- Tradies your dad vouched for who get no work will stop answering, and that burns his network.
- Keep the rest on a call list, with their OK, for jobs that need more quotes.

**Set honest expectations:** "The first few weeks there may be no jobs. I'll ring you when one fits." **Never promise how many jobs they'll get.** HomeAdvisor was ordered to pay up to $7.2M over misleading claims about its leads ([FTC](https://www.ftc.gov/news-events/news/press-releases/2023/01/ftc-order-requires-homeadvisor-pay-72-million-stop-deceptively-marketing-its-leads-home-improvement)).

### Step by step
1. **List them.** Sit down with your dad and list 20–30 tradies he'd vouch for: trade, suburb, how you know them, phone number.
2. **Check every licence before you call**, on the [Building and Energy register](https://www.wa.gov.au/organisation/building-and-energy/building-and-energy-licence-and-registration-search). Record the number and the date you checked.
   - Electrical, plumbing and gas work need a licence.
   - Painting over $1,000 needs registration.
   - Building permit work of $20,000 or more needs a registered builder.
   - For air-con, also check their refrigerant licence.
3. **Check the numbers against the Do Not Call Register.** A sole trader's mobile can be on it if it's used personally more than 50% of the time ([ACMA](https://www.acma.gov.au/do-not-call-register)). The calling rules ([DNCR standards](https://www.donotcall.gov.au/industry/industry-overview/industry-standards)):
   - weekdays 9am–8pm and Saturday 9am–5pm, never Sundays or national public holidays;
   - say who you are and why you're calling;
   - let your number show, with a return number that works for 30 days;
   - hang up when asked.
4. **Ring them.** Start from the tradie script in `docs/OUTREACH.md`, with three changes: drop "some mine site work", don't say "guaranteed", and add the founding offer.

   > "G'day, it's [name], [dad's name]'s [son/daughter]. I've started Tradebench, a Perth site for repair and maintenance jobs. You don't pay for leads and there's no subscription. Customers post a job, you quote if you want it, and the customer's payment is held before you start. It's released to you when they sign off. Our fee is 4% of the job, minimum $15, and it only comes out of money you've been paid. Your first 2 paid jobs are fee-free. Honestly, it'll be quiet for the first few weeks, and I'll ring you when a job fits. Can I come round and set you up? It takes about 10 minutes. I'll need your ABN, licence number and insurance certificate."

   Keep the objection answers from `docs/OUTREACH.md`, but change "guaranteed payment" to "the money's already held before you start".
5. **Text the link only if they agree to it on the call.** A promotional text falls under the Spam Act. Log their "yes, text me" as consent, and include your name, your business and a way to opt out ([ACMA](https://www.acma.gov.au/avoid-sending-spam)).
6. **Sign them up in person, on their own phone.** This is Paul Graham's "do things that don't scale" ([essay](https://paulgraham.com/ds.html)). Allow 1–2 hours per tradie including travel **(estimate)**.
   - [ ] ABN, licence number and insurance certificate of currency (take a photo). **Record the certificate's expiry date.**
   - [ ] **Confirm their email on the spot.** It's needed for approval but missing from the tradie checklist, and the link expires after 3 days.
   - [ ] Trades and areas: **only the cluster**.
   - [ ] Write their profile with them and take a decent photo. This is your version of Airbnb's founders photographing hosts' listings, which doubled revenue from about $200 to $400 a week ([First Round](https://review.firstround.com/How-design-thinking-transformed-Airbnb-from-failing-startup-to-billion-dollar-business)).
   - [ ] Payouts: **only once Stripe is live.**
   - [ ] Approve within 24 hours.
   - [ ] Explain why contact details stay hidden until payment ("it protects your payment"), so it doesn't feel like a trap.
   - [ ] Explain the release policy: the 5-day sign-off and how disputes are decided (4.6).
7. **The founding tradie offer:** **no Tradebench fee on their first 2 paid jobs**, for the first 10 tradies.
   - On a $500 job, a fee-free job costs you about $20 of fee income. You net about **−$2.47** instead of **+$17.58** **(estimate, section 9.1)**.
   - If all 20 free jobs are used, the base mix costs about **$670** in total **(estimate)**.
   - Don't market it as "exclusive": NFX says scarcity tactics "almost never work" ([NFX](https://www.nfx.com/post/19-marketplace-tactics-for-overcoming-the-chicken-or-egg-problem)).
   - Until the site has a per-tradie fee override (fix 13), record the waivers by hand.
8. **Ask every tradie two questions:**
   - (a) "Which 2 tradies would you send my way?" Write them on the call list. Ring them only when a trade is short.
   - (b) "Would you try held payment with one of your own customers?" That's the test in step 11.
9. **Referral reward:** one more fee-free job (about $33 of fee income in the base mix) for each referred tradie who completes a paid job.
   - Airbnb called its host referral programme its "single most efficient and effective growth lever for consumer supply" ([Lenny, on andrewchen.com](https://andrewchen.com/grow-marketplace-supply/)). Across Lenny's 17-company study, about a third used referrals ([Lenny](https://lennysnewsletter.com/p/how-to-kickstart-and-scale-a-marketplace-911)). That's one company's best lever, not a rule.
   - Checkatrade's UK offer of up to £200 to each side ([Checkatrade](https://join.checkatrade.com/referral-may-2026/)) has expired, and cash rewards don't fit your numbers anyway.
10. **Where to find more tradies when a trade is short:**
    - **Lapsed hipages businesses.** About 16.8k Australian businesses were "serviced" by hipages at some point in FY26 but weren't on a subscription at year end (49.8k − 33.0k; [hipages FY26](https://announcements.asx.com.au/asxpdf/20260824/pdf/0733gw0czqcdyv.pdf)). Some of those still buy pay-per-lead products, and the figure is national. In one Perth cluster, for 3–4 trades, it means tens of people, not thousands **(estimate)**. Search r/AusTradies for complaints and use their exact words in your pitch.
    - **Businesses moved from Oneflare to Airtasker** who don't want a commission marketplace or a $1,800 pass.
    - **Electrical wholesaler counters.** Ask your local counter what trade nights they run. A 2025 Master Electricians page about Middy's Info Nights ([link](https://www.masterelectricians.com.au/2025/12/09/middys-info-nights-2025/)) now returns 404, and Middy's presence in WA wasn't confirmed.
    - **Plumbers:** Reece training forums ([Eventbrite](https://www.eventbrite.com.au/o/reece-australia-89555932793); ask the Jandakot and Myaree branches for WA dates) and Tradelink branch managers (Tradelink is now owned by Metal Manufactures, [Fletcher Building](https://fletcherbuilding.com/news/fletcher-building-announces-sale-of-tradelink)).
    - **The Bunnings trade desk car park,** but only after asking the store manager. Ask once at your nearest store in month 2; if the answer is no, skip it.
    - **Newly licensed tradies going solo.** Ask TAFE teachers whether you can speak to final-year classes ([North Metro TAFE](https://northmetrotafe.wa.edu.au/courses/certificate-ii-plumbing-plumbing-pre-apprenticeship-0)). Apprentices can't take jobs on their own.
    - **SBDC workshops** ([business.gov.au](https://business.gov.au/expertise-and-advice/small-business-development-corporation-sbdc)).
    - **Tradie Facebook groups,** within each group's rules.
11. **The "free job tools" wedge: what to lead with.**
    - **Lead with held payment, and treat the free tools as a reason to stay.** hipages' monthly users of its job-management tools rose from about 4% (June 2024) to about 23% (July 2026), and those users stay about 6–8 points better ([hipages FY26](https://announcements.asx.com.au/asxpdf/20260824/pdf/0733gw0czqcdyv.pdf)). So the tools help keep tradies, but take-up was slow. ServiceM8 is also free for solo operators up to 30 jobs a month ([ServiceM8](https://www.servicem8.com/au/pricing)).
    - Add one line about the tools to `/for-tradies`, `/start` and the tradie flyer. Right now none of them mention the tools.
    - **"Bring your own customer":** a tradie sends an existing customer of theirs a Tradebench quote that's paid upfront and held until sign-off.
      - Suggested fee: **1%** from the tradie plus the customer's 2%. That leaves you about **$2.54** on a $500 job **(estimate)**. It's for winning customers, not for revenue.
      - Every customer who pays this way gets a Tradebench account. Over 40% of the marketplaces Lenny studied had suppliers bringing in customers ([Lenny](https://www.lennysnewsletter.com/p/how-to-kickstart-and-scale-a-marketplace-2e5)).
      - **Test it by hand with 3–5 tradies before you build anything.** The tradie's customer posts the job using a pre-filled `/jobs/new` link (which already fills in trade, region, sector and timing), the tradie quotes, and you apply the lower fee by hand.
12. **Re-check licences and insurance on a schedule** (judgement), and publish the schedule on the site:
    - **At approval:** licence on the register, plus the certificate of currency, with both expiry dates recorded.
    - **Every 3 months:** re-check the licence on the register.
    - **Insurance:** 2 weeks before the certificate expires, ask for the new one. If it lapses, pause their new quotes (by hand until it's built into the product).
    - **To check a certificate is genuine,** phone the insurer or broker named on it.
    - **If cover lapses mid-job,** pause the job, tell the customer, and offer to cancel and refund before work continues.
    - **What to publish:** "Licences checked at approval and every 3 months. Insurance checked at approval and at each renewal."
13. **Track the supply funnel every week:** signed up → details submitted → email confirmed → approved → payouts on → first quote within 7 days → first win → first payment released.
    - Find your **"power tradies"**, the ones who quote fast. At Uber, about 20% of drivers did about 60% of trips ([Chen](https://andrewchen.com/solve-a-hard-problem-cold-start-problem/)).
    - Ring every approved tradie who hasn't quoted within 14 days.

---

## 6. Phase 2: your first jobs (demand)

**Be realistic.**
- In the base model, cumulative *paid* jobs pass 100 around **month 10** **(estimate)**.
- *Posted* jobs come sooner, because perhaps 30–50% of early posts end up paid **(estimate)**.
- The goal is jobs that end in a released payment and a happy customer, not jobs posted. Sarah Tavel calls this "happy GMV" ([via Lenny](https://www.lennysnewsletter.com/p/the-hierarchy-of-engagement-sarah)).

### 6.1 Discovery first: 5–10 conversations in weeks 1–2

You can test the riskiest assumption (can agencies pay a held card payment at all?) in about 5 conversations. Don't make 40 calls first. Each conversation is 20–30 minutes, by phone or in person, with your parent on the business ones (judgement).

**Who:** 3 small property-management agencies, 2 short-stay managers, 2–3 individual hosts, 1 strata manager and 1 independent motel. Start with family contacts, then cold calls between 3:30 and 5pm.

**Questions:**
1. Who fixes things for you today? (A preferred list, a franchise such as Jim's or Hire A Hubby, a maintenance company on monthly invoice, your own handyman?)
2. How do you pay them: trust account, invoice or card? Does the owner approve it first?
3. Could you pay by card into a held payment before the job? Who would have to approve that?
4. Would a 2% secure payment fee on top of the quote be a problem?
5. How many jobs a month go to someone outside your usual list? Which trades? When do your regulars let you down?
6. What do you need from a tradie: a certificate of currency for a set amount, after-hours response?
7. If we found you a good tradie, would you book them again through us or direct? What would keep you on the platform?

**Decision rule (judgement):**
- If 3 or more of 5 agencies say they can't pay a held card payment, drop agencies from your first segment now.
- If short-stay managers say they send 5 or more outside jobs a month and can pay by card, they come first.
- Otherwise, use the default in section 3: owner-occupiers, landlords and hosts in the cluster, plus 1–2 short-stay manager pilots.

### 6.2 The concierge job desk (things that don't scale)
1. Get a **business mobile number**, not your personal one, and publish it as the "text us a photo" job desk (fix 10).
2. A customer texts a photo and the address. You write the job post **with their OK**, because it's their real job.
3. Ring 2–3 suitable tradies **the same day**.
4. **Only promise what you can deliver around school:** "quotes within 48 hours, or I'll find someone myself". Don't take emergency repairs yet. The 24-hour essential-service deadline needs someone free during the day (judgement).
5. After the payment is released, call both sides ("all good?") and ask **every** customer for a review.

   Word of mouth was the top customer channel for over half of the marketplaces studied, and TaskRabbit got 90%+ of its early customers that way ([Lenny](https://www.lennysnewsletter.com/p/how-to-kickstart-and-scale-a-marketplace-2e5)).

### 6.3 Outreach to the segment you choose
1. **Build the list** of agencies and managers in and around the cluster, using REIWA's find-an-agent search, Google Maps and the Airbtics list. For each email address, log the URL where it was published and the date. That's your Spam Act evidence.
2. **Call first, after checking the list against the DNCR.** Business numbers usually can't be on it, but check anyway, and the calling-hours rules still apply ([ACMA](https://www.acma.gov.au/do-not-call-register)). Call windows: weekdays 3:30–5pm, or Saturday mornings if they're open. About 6 calls a session.
3. **Who fronts business sales:** your parent as the named owner, with you running the platform, or you with your parent at the first meeting (judgement).
4. **The corrected property-manager script:**

   > "Hi, my name's [name], from Tradebench, a Perth trades platform. Who looks after maintenance for your rentals? ... We help property managers get quotes from checked local tradies. We check their licence and insurance. You post the job once and our tradies quote. Your payment is held and only released to the tradie when you sign the job off. If you book the same tradie again through us, their fee drops. Could I set you up to try it with your next job? If nobody quotes within 48 hours, I'll personally find someone."

5. **Follow up by email, but only to work addresses the person published openly, and only about their role.** That's the Spam Act's "conspicuous publication" route ([Spam Act Sch 2](https://www.legislation.gov.au/C2004A01214/2016-03-10/2016-03-10/text/original/epub/OEBPS/document_1/document_1.html)).
   - Every email must carry your legal name (or name + ABN), contact details and a working unsubscribe.
   - Use the `docs/OUTREACH.md` email, but **delete "kept per property"**.
6. **Offer a pilot:** "Your next 3 jobs: quotes from checked tradies within 48 hours, or I find someone myself." Make it only in trades and suburbs you can actually cover.
7. **Offer cheap rebooking from day 1:** the same tradie booked again through Tradebench pays 2% instead of 4% (fix 14; by hand until it's built). This is how a business customer stays on the platform after job 1.
8. **After 3 good jobs,** ask for a genuine one-line testimonial (their real words, used with permission) and an introduction to another manager.
9. **Expect (estimate):** the research guessed that about 1 in 10–20 agencies reached will try it, and about a third of those keep using it. There's no stated basis for that, so replace it with your own numbers after 30 contacts.

### 6.4 Short-stay and motels
- **Managers:** every one on the Airbtics list that's in or near your cluster. **Individual hosts:** through short-stay host Facebook groups, where the group's rules allow.
- **Motels and serviced apartments:** count the independent ones in your cluster on Google Maps, talk to 2 in discovery, then use the hotel script in `docs/OUTREACH.md`.
- **Pitch:**
  - booked around turnovers;
  - access times set in the job form;
  - photos of the finished work;
  - the tradie isn't paid until it's done, and the 2% fee is refunded if they don't turn up.
- **Targets for months 1–3 (estimate):** 2 short-stay managers piloting and 5 individual hosts posting real jobs.

### 6.5 Local channels (free)
- **Facebook groups:** suburb community groups, buy/swap/sell groups, landlord and investor groups, and short-stay host groups.
  - Read the pinned rules and message the admin first.
  - Post only when it's true ("We've got checked sparkies free this week in [suburb]").
  - Never pay admins to post, and never mass-post ([Meta](https://transparency.meta.com/policies/community-standards/spam/)).
- **Nextdoor:** a 1-hour test. Join as a resident and see whether your suburb is actually active. The only data found is from 2019 ([Nextdoor](https://aublog.nextdoor.com/2019/08/07/how-nextdoor-is-helping-you-reduce-waste-in-your-neighbourhood)).
- **Flyers:**
  - Hand them to agencies in person.
  - For letterboxes, run one test of 500 in the suburb where you have the most tradies, with its own link (`/jobs/new?region=southern&utm_source=flyer&utm_campaign=<suburb-month>`).
  - Printing 500 A5 flyers costs about $100–115 ($0.20–0.23 each), and 1,000 cost about $130–150 ([Paperlust](https://printshop.paperlust.co/blog?p=5411), [MOO](https://moo.com/au/flyers/a5)).
  - If 500 produce no jobs within 3 weeks, stop.
- **Homeowners:** family, neighbours and landlord contacts, posting real jobs with their permission. Never post fake jobs.

The single day-by-day checklist for the first 30 days is in section 13.

---

## 7. Phase 3: repeatable growth (from about month 3)

### 7.1 SEO (slow, cheap, compounding)
- **Keep the current `noindex` rule.** `src/routes/seo.js:155` hides trade × area pages that have no jobs, tradies or prices. Google's spam policies name "doorway abuse" (sets of city pages that funnel to one place) and "scaled content abuse" ([Google](https://developers.google.com/search/docs/essentials/spam-policies)).
- **Tighten it** (fix 26):
  - Today one tradie who ticks 9 regions and 5 trades unlocks about 45 near-identical pages.
  - Index single trade pages and area pages only when they have at least 1 approved tradie or 1 open job.
  - Index combined trade + area pages only when they have at least 2 tradies or a job.
  - Expire stale jobs.
- **Fix the meta descriptions** that say "Pay only when it's done" (`seo.js:161`, `:190`).
- **Add real substance:**
  - a WA licensing note per trade, linking the official register;
  - a "how to check your tradie's licence in WA" guide;
  - cost guides once you have about 5 paid jobs per trade, built from your own data and clearly labelled;
  - real job photos (with consent), and FAQs.
- **Earn a few real local links:** press coverage, association event pages, council business directories.
- **Expect months, not weeks.**
  - One founder reported only about 0.9% of 287,000 thin pages indexed on a new domain ([Indie Hackers](https://www.indiehackers.com/post/we-built-hundreds-of-seo-landing-pages-with-an-ai-agent-heres-what-google-indexed-and-what-it-ignored-aaee74de7f); not re-checked).
  - Position 1 on Google gets about 27.6% of clicks and page 2 gets 0.63% ([Backlinko](https://backlinko.com/google-ctr-stats)). That data is dated: it predates Google's AI Overviews.
- **Keep IndexNow running.** Bing had 9.17% of Australian search in September 2026 ([StatCounter](https://gs.statcounter.com/search-engine-market-share/all/australia)).
- **Check Search Console weekly** ([help](https://support.google.com/webmasters/answer/7042828)):
  - pages indexed;
  - impressions on trade × suburb pages;
  - searches where you rank 8–20 (improve those pages first);
  - pages with a low click-through rate for their position (rewrite the title and description).
- **There's no kill rule for SEO.** Review it at months 3 and 6 (section 8).

### 7.2 Google Business Profile: for your tradies, not for Tradebench
- **Don't create one for Tradebench.** Google's ineligible list includes "online-only businesses" and "lead generation agents or companies" ([Google](https://support.google.com/business/answer/13763036)). `LAUNCH.md` line 163 says to set one up; ignore that line. Never create one per suburb.
- **Help each tradie polish their own profile:** one profile per business, home address hidden, their real business name with no added keywords, and a service area within about 2 hours' drive ([Google](https://support.google.com/business/answer/3038177?hl=en)).
- Google Local Services Ads **aren't available in Australia** ([Google](https://support.google.com/localservices/answer/6224841?hl=en)). Watch for them arriving.

### 7.3 Reviews
- Only customers with a **paid, completed** job can review. Never let tradies draft reviews (the ServiceSeeking case).
- **Ask everyone, not just happy customers.**
  - Google bans selective asking and all review incentives ([Google](https://support.google.com/contributionpolicy/answer/7400114)).
  - The ACCC allows incentives only if they're given whatever the rating and clearly disclosed ([ACCC](https://www.accc.gov.au/business/advertising-and-promotions/online-reviews-for-product-and-services)).
  - The simplest rule: **no incentives at all**.
- Show the count with the rating ("4.8★, 12 reviews"), publish your moderation policy, and publish negative reviews too. HealthEngine paid $2.9m for holding back and editing negative reviews (same ACCC page).
- 97% of consumers read reviews for local businesses ([BrightLocal 2026](https://www.brightlocal.com/research/local-consumer-review-survey/)). Aim for a review on 40%+ of released jobs **(estimate)**.
- Let tradies link their existing Google and Word of Mouth reviews on their profile.

### 7.4 Referral loops (no cash rewards in year 1)
1. **Tradie refers tradie:** one fee-free job once the new tradie completes a paid job.
2. **Customer refers customer:** just ask after every good job. No reward until you have repeat-rate data; a $10–20 credit would eat about half your net on a typical job (judgement).
3. **Tradie brings their own customers:** the strongest loop (section 5, step 11).

Rules for all three:
- Pay a reward only after a payment has been released.
- Cap rewards per person and block self-referrals (same card, phone or address).
- **Never tie a reward to a review.**
- A reward that depends on a referred friend *buying*, offered while making a new sale, is illegal "referral selling" ([ACCC](https://www.accc.gov.au/business/selling-products-and-services/unfair-business-practices)).
- Let users share their own link through their own channels, rather than you emailing addresses they type in.

### 7.5 Paid ads: only when the maths works

**Rule of thumb:** spend at most about **a third** of what a customer is worth to you in their first year. That's a common investor heuristic, not a sourced benchmark.

| What you'd buy | Worth to you (estimate) | Most you can pay (÷3) | What it costs | Verdict |
|---|---|---|---|---|
| One homeowner job post via Google search | $10–30 | $3–10 | $10–40 a click → about **A$125–1,300 per posted job (estimate)** from Australian cost-per-click data ([Profit Geeks](https://www.profitgeeks.com.au/blog/google-ads-cost-australia), [ClickClickMedia](https://clickclickmedia.com.au/playbooks/electricians/)). A mostly-US benchmark: US$90.92 per lead ([LocaliQ](https://localiq.com/blog/search-advertising-benchmarks/)) | **No** |
| One homeowner job post via Meta | $10–30 | $3–10 | About **$35–100 per posted job (estimate)**, at about $0.95 a click ([Superads](https://www.superads.ai/facebook-ads-costs/cpc-cost-per-click/australia)) | **No** |
| One *active* tradie | About $330 a year (base, month 12) | About $110 | About $20–80 per approved tradie **(estimate)**. With 50–60% of approved tradies becoming active, that's about $35–160 per active tradie | **Marginal.** One $100–200 test, only when a specific trade is short and tracking works |
| One business account | $31–1,300 a year (section 2) | $10–430 | Unknown. Look up "property maintenance contractor perth" in Keyword Planner | Not in year 1 |

**Before any ad dollar:**
1. Source tracking is live (fix 3).
2. The cluster has met the section 7.9 liquidity rule for 4 weeks.
3. You know your real 12-month LTV from your first groups of customers.
4. A parent owns the ad account. Google Ads requires account holders to be 18+ ([Google](https://support.google.com/google-ads/answer/1664276)). Meta's minimum advertiser age wasn't verified; your parent checks Meta's terms when setting it up.

**Getting real Perth prices for free:** in a parent's Google Ads account, choose Expert mode, skip creating a campaign, then go to Tools → Keyword Planner, set the location to Perth and read the "Top of page bid" columns. New-advertiser credits have been offered in Australia, but check your own account ([blend-ai, Nov 2024](https://blend-ai.com/post/google-ads-promo)).

### 7.6 Partnerships
- **Now:** none formal. ServiceSeeking's founder said early corporate partnerships were a distraction ([SmartCompany](https://www.smartcompany.com.au/entrepreneurs/class-2007-serviceseeking-co-founder-jeremy-levitt-early-stage-corporate-partnerships-stink-new-businesses/)). Use associations and suppliers as places to meet tradies.
- **Once you have traction:** offer associations such as NECA WA ([fees](https://www.neca.asn.au/branch/membership/membership-fees?cstate=WA)) a member benefit, such as a lower fee.

### 7.7 Content and short video (judgement)
- **Where:** TikTok and Instagram Reels, posting the same clip to both.
- **How often:** 2 posts a week, each 20–45 seconds.
- **Formats:**
  - a founder diary ("building a Perth tradie marketplace");
  - "how to check your tradie's licence in WA";
  - "what WA Consumer Protection warned about this month" (link [their announcements](https://consumerprotection.wa.gov.au/));
  - before-and-after jobs, **with the tradie's and customer's consent**.
- **Measure:** put a tagged link in your bio (`utm_source=social`) and count visits and tradie sign-ups from it. **Kill rule:** after 8 weeks with no tagged visits, stop.
- **Using AI:** fine for drafting scripts and captions. Check every fact and number before posting (section 11).
- **The law still applies.** Your posts follow the same rules as ads, and you're responsible for misleading comments other people post on your page ([ACCC](https://www.accc.gov.au/business/advertising-and-promotions/social-media-promotions)).

### 7.8 Local PR (after 3–5 paid jobs)
- **Angles:**
  - a young Perth founder;
  - Perth's tradie shortage (the HIA figures, with their caveat);
  - "your money's held until the job's done", tied to Consumer Protection prosecutions ([example](https://commerce.wa.gov.au/announcements/pretend-painters-brush-law-alex-mazloomi-arios-painting-and-decorating)).
- **Outlets:**
  - PerthNow local papers ([B&T](https://www.bandt.com.au/seven-west-media-to-relaunch-community-newspapers-under-perthnow-brand/));
  - the Fremantle Herald group;
  - WAtoday;
  - Business News WA startup news ([link](https://www.businessnews.com.au/Company/Startup-News)).
  - Startup News WA's submissions page no longer loads, so check the outlet still exists before pitching it.
- **Sample headline:** "[Age]-year-old Perth founder launches tradie site that holds your money until the job's done."
- **Sample pitch email (about 120 words):**

  > "Hi [name], I'm [name], [age], from [suburb]. I've started Tradebench, a Perth site where every tradie's licence and insurance is checked and the customer's payment is held until the job's done. WA Consumer Protection keeps warning about tradies who take big deposits and disappear (one Byford case was $78,715). Last month [host/property manager, who's happy to talk] used us to [real job] in [suburb]. I can send photos and put you in touch with them and the tradie. Happy to chat any afternoon. [phone]"

- **Steps:**
  1. Find the one journalist at each outlet who covers small business or property.
  2. Send the pitch.
  3. Follow up once.
  4. Track sign-ups tagged `source=pr`.

### 7.9 When to expand
Add the next suburbs, then one more trade, **only when all of these hold for 4 straight weeks in the current cluster, with at least 30 jobs posted in those 4 weeks.** Targets are **estimates**. In the base scenario that's month 6 at the earliest and more likely months 7–9.
- jobs with no quote after 48 hours: under 10%;
- median time to first quote: under 24 hours;
- an average of 2+ quotes per job, with at least half of jobs getting 2 or more;
- posted → paid: 40% or more;
- at least 5 customers who have paid for 2 or more jobs;
- approved tradies who quoted in the last 14 days: 60% or more;
- word-of-mouth and referral arrivals rising month on month.

Report every metric **per cluster**, not for "Perth". Local networks start from zero in each new area ([a16z](https://a16z.com/13-metrics-for-marketplace-companies/)).

### 7.10 Mining: not in year 1
- **What won't work:** big miners posting jobs on a consumer marketplace. Rio Tinto outsourced maintenance of 2,900 houses and 19,000+ rooms to Sodexo on a 7-year contract ([Rio Tinto](https://www.riotinto.com/en/news/releases/2026/sodexo-awarded-contract-to-manage-riotintos-pilbara-facilities)).
- **What it would take later:**
  - Contractors need prequalification on platforms such as Avetta ([Avetta](https://www.avetta.com/en-au/suppliers-contractors)), the MARCSTA induction (about 8 hours; [CivilSafety](https://civilsafety.edu.au/blog/how-to-get-a-job-in-the-mines-qld-wa)), site inductions and insurance certificates.
  - Joining ICN Gateway is free ([CCIWA](https://cciwa.com/industry-capability-network-wa/)).
  - BHP's Local Buying Program, run by C-Res, has paid $1.74bn since 2012 to small, local and Indigenous businesses, with 1,045 approved suppliers and an average payment time of 7 days since 1 July 2021 (stats as at 23 Oct 2026; [C-Res](https://www.c-res.com.au/)).
  - Mining buyers use vendor onboarding, purchase orders and 30-day terms, so card payments and your quote caps don't fit.
- **Decision:** revisit at the month-12 review, and only if the Perth cluster has tipped. Pilbara work is about 1,500 km away and has no travel budget.

---

## 8. Indicators: the weekly scorecard

### Leading vs lagging
- **Leading indicators move first, and you control them.** Outreach conversations, tradies made live, jobs posted, hours to first quote, quotes per job, Search Console impressions. **Manage these every week.**
- **Lagging indicators are the results.** Paid jobs, GMV, net revenue, repeat customers, LTV, NPS. **Judge yourself on these monthly.** A lagging number usually turns 4–8 weeks after the leading ones.

### The small-numbers rule
Until you have about **30 jobs a month** (around month 10 in the base scenario), percentages mislead. For example, 1 unpaid job out of 2 reads as "50% leakage".
- **Until then:** use counts plus a job-by-job log, and look at every job individually.
- **After that:** switch to percentages.
- **NPS:** ask "how likely are you to recommend us?" after every job, but only calculate the score once you have 20+ answers.
- **All the targets below are guesses.** Revise them after month 1 and again after month 3.

### The 15-number scorecard (every Monday, about 30 minutes)

Targets follow the base scenario and are all **estimates**.

| # | Metric | Formula | M1 | M3 | M6 | M12 |
|---|---|---|---|---|---|---|
| 1 | Outreach conversations (leading) | Real conversations this week; accounts that have posted so far | 8/wk; 0 | 8/wk; 2 | 6/wk; 4 | 4/wk; 8 |
| 2 | Live tradies (leading) | Approved AND payouts on, per trade in the cluster | 8–12 signed (payouts once live) | 15 | 20–25 | ~40 |
| 3 | Inactive tradies (leading) | Approved tradies with no quote in 14 days (count); later ÷ approved | count, ring each | count | count | <45% |
| 4 | Real jobs posted (leading) | New jobs this month, excluding tests | 3–5 | 6–10 | 22–37 | 80–130 |
| 5 | Jobs not quoted in 24h (liquidity) | Count this week; from 30+ jobs a month, the % quoted within 24h | ≤1/wk | ≤1/wk | ≤1/wk | 80%+ quoted |
| 6 | Quotes per job at 72 hours | Mean, counting only jobs at least 72h old | 1–2 | 2 | 2 | 2.5 |
| 7 | Median hours to first quote | median(first quote time − post time) | <48h | <24h | <12h | <6h |
| 8 | Award rate | Jobs accepted ÷ jobs posted at least 7 days ago | log each | log each | log each | 40% |
| 9 | Accepted but unpaid after 3 days (leakage signal) | Count; later paid ÷ accepted | call each | call each | call each | 80%+ paid |
| 10 | **Paid jobs (North Star)** | Jobs moved to held or released | 0 | 3 a month | 11 a month | 40 a month |
| 11 | Net revenue | Fees − Stripe card, payout and active-account fees − fixed costs (month) | −$60 | −$157 | +$91 | +$948 |
| 12 | Held-payment health | Median days paid → released; number held >14 days; disputes | <10d; 0; 0 | same | same | same |
| 13 | Repeat customers | Customers with 2+ paid jobs (count); later the % of first-time payers who pay again within 90 days | 0 | 0–1 | 3 | 25% |
| 14 | Reviews and NPS | Reviews ÷ released jobs; NPS once 20+ answers (% scoring 9–10 minus % scoring 0–6) | ask every one | ask every one | 40%; — | 45%; 40+ (construction benchmark 42, [Retently](https://www.retently.com/blog/good-net-promoter-score/)) |
| 15 | Search Console | Weekly impressions, clicks, pages indexed | indexed >50%; ~0 clicks | 1k impressions, 20 clicks | 5k, 75 | 20k, 300 |

### Where each number comes from, and what to do when it's bad

| # | Where to get it today | What's missing | If it's bad |
|---|---|---|---|
| 1 | Spreadsheet: outreach log (date, who, channel, outcome, next step) | — | Use the scripts. Narrow to one area and one customer type. Walk in rather than email |
| 2 | `/admin` → `tradies_live`, `tradies_payouts`; a trade × suburb grid in the spreadsheet | A coverage grid in `/admin` (fix 33) | Ring the call list for that trade. Approve within 24h |
| 3 | Spreadsheet: tradie pipeline | `tradie_profiles.submitted_at` (fix 12) | Ring each one. Check their trades and areas match the jobs, and check email delivery in `/admin` → Recent emails |
| 4 | `/admin` → `jobs_30d` (subtract your tests) | A view by sector, trade, area and source (fixes 3, 12) | It's a demand problem: more outreach in your chosen segment. **Don't buy ads** |
| 5 | Spreadsheet: job desk log | `quotes.first_sent_at`, because editing a quote currently resets `created_at` (fix 12) | Phone tradies about every unquoted job the same day. Add supply in that trade |
| 6 | `/admin` → `quotes_per_job` | It counts jobs posted today, which drags it down. Count only jobs at least 72h old | Same as #5. Check tradies can see the job's photos and details |
| 7 | Job desk log | `first_sent_at` (fix 12) | Text tradies by hand. Recruit tradies known for answering fast |
| 8 | Job desk log | `jobs.awarded_at` (fix 12) | Check the quotes are clear and the profiles show reviews. The 24-hour reminder is already built |
| 9 | Job desk log + Stripe Dashboard → Payments | `awarded_at` | Ask the customer why. Check Stripe for checkout errors. Make "contact details unlock on payment" clearer |
| 10 | `/admin` → `paid_30d`, "volume" (which is GMV *excluding* the customer fee; pick one definition and keep it); Stripe | A weekly count | Walk the funnel from #4 to #9 and fix the first weak step |
| 11 | Stripe Dashboard (fees, Connect fees) + spreadsheet for fixed costs | An admin money view (fix 33) | If lots of jobs earn about $12.50, go after bigger ones |
| 12 | `/admin` → `disputes`; Stripe → Disputes, Refunds | An alert at 14 days held | Phone the customer. Read the job thread for any dispute the same day. Follow the policy in 4.6 |
| 13 | Spreadsheet by month of first payment | A cohort query | After each job, ask "Anything else on the list?" Offer the 2% rebook |
| 14 | Admin review list + a 1-question survey after release | A review-reminder email (fix 17) | Read every answer of 0–6 and fix the cause |
| 15 | Search Console → Performance and Page indexing | — | Not indexed: check the sitemap and page quality. Impressions but no clicks: rewrite titles. No impressions: write deeper pages for one trade × area |

### A worked example (made-up numbers for a week in December)

> Outreach: 7 conversations, 1 new host posted. Live tradies: 9 (3 electrical, 3 handyman, 2 plumbing, 1 air-con). Jobs posted: 3. Not quoted in 24h: 1 (an air-con service). Median first quote: 9 hours. Accepted: 1. Paid: 1 ($380, a founding fee-free job, net −$2.40). Held >14 days: 0. Reviews: 0 (no payments released yet).

**How to read it:**
- One job missed, in air-con, and air-con has only 1 tradie. Ring the call list and add 1–2 air-con techs.
- Demand is fine for this stage, and the money is as expected for a founding job.
- There's nothing to judge as a percentage yet.
- Write down why the air-con job missed (only one tech, and he was busy?) and fix that.

### Channel scorecard (one row per channel, monthly)

| Channel | Cash spent | Hours | Tradies gained (signed → approved → payouts → first quote) | Jobs (posted → 2+ quotes in 48h → paid → released) | Net revenue | CAC = cash ÷ results | Loaded CAC = (cash + hours × $30) ÷ results |
|---|---|---|---|---|---|---|---|

The $30 an hour is a notional value for your time **(estimate)**.

**Kill rules, per channel (judgement):**

| Channel | Judge after | Stop if |
|---|---|---|
| Warm-network tradie sign-ups | — | Never: it's the core |
| Outreach to business customers | 60 real conversations or 8 weeks | 0 jobs posted. Change the pitch or the segment first |
| Each Facebook group | 4 weeks or 10 hours | 0 jobs and 0 tradies |
| Flyers | One test of 500 | 0 jobs in 3 weeks |
| Short video | 8 weeks at 2 posts a week | 0 tagged visits |
| Meta ads (tradie recruiting) | $100–200 or 4 weeks | 0 approved tradies |
| SEO | Review at months 3 and 6 | No kill. If cluster pages have no impressions by month 6, rethink the pages and keep effort low |

Until source tracking (fix 3) ships, use the required "How did you hear about us?" dropdown plus a tagged link per channel: `utm_source=flyer&utm_campaign=<suburb-month>`, `utm_source=fb-group&utm_campaign=<group>`, `utm_source=outbound`.

### Diagnosis when things go bad
- **Many jobs with no quotes** → a supply problem. Stop adding demand in that trade.
- **Quotes but no acceptances** → a price or trust problem. Look at the quotes, profiles and reviews.
- **Acceptances but no payment** → checkout trouble or leakage.
- **Paid jobs but no repeat posts** → a bad experience, or leakage. Ask "Have you booked this tradie directly since?"

**Act the same week if:** any dispute goes unresolved for more than 5 business days, any payment is held more than 21 days, or 2 or more accepted jobs in a month go unpaid.

---

## 9. Money

### 9.1 What you keep per job (estimate)

**Assumptions:**
- Card fee **1.7% + A$0.30**, charged on the quote plus the 2% fee. Stripe's two Australian pages disagree: 1.65% on [pricing](https://stripe.com/au/pricing) against 1.7% on [Connect pricing](https://stripe.com/au/connect/pricing). The higher one is used to be safe.
- Payout fee 0.25% + A$0.25.
- A$2 per tradie paid in a month (worst case: every job goes to a different tradie).
- No GST yet.

| Job | Tradie fee | Customer fee | Card | Payout | Active account | **You keep** | Net % |
|---|---|---|---|---|---|---|---|
| $150 | $15 | $3 | $2.90 | $0.59 | $2 | **$12.51** | 8.3% |
| $250 | $15 | $5 | $4.64 | $0.84 | $2 | **$12.53** | 5.0% |
| $500 | $20 | $10 | $8.97 | $1.45 | $2 | **$17.58** | 3.5% |
| $1,000 | $40 | $20 | $17.64 | $2.65 | $2 | **$37.71** | 3.8% |
| $1,500 | $60 | $30 | $26.31 | $3.85 | $2 | **$57.84** | 3.9% |
| $5,000 | $200 | $100 | $87.00 | $12.25 | $2 | **$198.75** | 4.0% |
| $7,499 (cap for jobs on homes) | $299.96 | $149.98 | $130.33 | $18.25 | $2 | **$299.36** | 4.0% |
| $19,999 (cap for other jobs) | $799.96 | $399.98 | $347.08 | $48.25 | $2 | **$802.61** | 4.0% |
| $500, founding fee-free | $0 | $10 | $8.97 | $1.50 | $2 | **−$2.47** | — |
| $500, rebook at 2% | $10 | $10 | $8.97 | $1.48 | $2 | **$7.56** | 1.5% |
| $500, bring your own customer at 1% | $5 | $10 | $8.97 | $1.49 | $2 | **$2.54** | 0.5% |

**Notes:**
- Stripe also lists a 0.25% "funds routing" row, and it's unclear whether that applies on top. If it does, net on a $1,000 job drops to about $35.31.
- **Rule of thumb: net revenue ≈ 4% of GMV on full-fee jobs.**
- **Disputes:** A$25 each, plus A$25 if you contest, refunded only if you win ([Stripe](https://stripe.com/au/pricing)). The bigger risk is losing the job value itself (section 4.6).
- **Refunds:** Stripe doesn't return the original processing fee, so every refund costs you that fee.

### 9.2 The small-job problem
- `feeFor()` charges the greater of 4% and $15, capped at half the job, and the minimum quote is $20.
- So a $20 quote pays **50%**, a $150 call-out pays **10%**, and a $200 job pays **7.5%**. The fee only falls to 4% at about $375.
- The tradie only sees what they'll receive *after* sending the quote.
- **Fixes:**
  - show "You'll receive $X" live as they type (fix 11);
  - raise the minimum quote to about $80–100;
  - consider a lower minimum fee for founding tradies **(estimate)**.

### 9.3 Fixed costs
- **Hosting:** about US$5 a month.
- **Resend (email):** US$20 a month once you pass about 20 tradies (`LAUNCH.md`).
- **Domain, business mobile and fuel:** not researched.
- **Planning figure:** about **A$60 a month for months 1–2, then about A$150 a month (estimate)**. This *excludes* insurance and one-off setup costs.

### 9.4 Break-even (estimate)
**Average net per job by job mix.** The mixes are defined in 9.5.

| Mix | Average job | Full fee | Fee-free | Rebook at 2% | Blend (65% full, 35% rebook) |
|---|---|---|---|---|---|
| Pessimistic | $420 | $18.57 | −$2.48 | $5.94 | $14.15 |
| Base | $773 | $31.06 | −$2.43 | $13.06 | $24.76 |
| Stretch | $1,620 | $63.72 | −$2.29 | $30.19 | $51.99 |

- **Cash break-even** (A$150 a month): about **5** base-mix full-fee jobs a month, or **7** with 35% rebooks. If every job is small (about $12.50 net), it's **12** a month.
- **Insurance:** every $100 a month of premium adds about 3–4 base-mix jobs a month to break-even.
- **Counting your time** (20 hours a week ≈ 87 hours a month × $30 = $2,600, plus $150): about **89** full-fee jobs a month, or **111** with rebooks. In the base scenario that's around **month 22**. Until then, this business pays you less than $30 an hour.

### 9.5 Paid jobs a month for each income target (estimate)

Net income before income tax and before paying yourself, with about A$150 a month of fixed costs.

| Net a month | Pessimistic (full fee / with 35% rebooks) | **Base** | Stretch |
|---|---|---|---|
| **$1,000** | 62 / 82 | **38 / 47** (GMV about $36k with rebooks) | 19 / 23 |
| **$5,000** | 278 / 364 | **166 / 209** (about $161k) | 81 / 100 |
| **$10,000** | 547 / 718 | **327 / 410** (about $317k) | 160 / 196 |
| $10,000 after GST registration | 601 / 789 | **360 / 451** | 175 / 215 |

**The job mixes (estimates, built from Airtasker cost guides: [handyman](https://www.airtasker.com/au/costs/handyman/handyman-prices/), [air-con repair](https://www.airtasker.com/au/costs/aircon-repair/air-conditioner-repair-cost/), [air-con install](https://www.airtasker.com/au/costs/aircon-installation/air-conditioner-installation-cost/)):**
- **Pessimistic:** 60% $200, 30% $500, 10% $1,500.
- **Base:** 50% $250, 35% $650, 12% $2,000, 3% $6,000.
- **Stretch:** 35% $300, 35% $900, 20% $2,500, 10% $7,000. Its biggest jobs are now capped below $7,500, because holding the full amount for home building work over that may break the Home Building Contracts Act until a lawyer says otherwise.

**The "after GST" row** assumes you can claim input tax credits on your costs (estimate; check with the accountant). It only applies if your GST turnover is your fees (section 4.4).

**The biggest lever is average job size, not the fee percentage.** Moving the average job from $420 to $1,620 cuts the full-fee jobs needed for $10k a month from 547 to 160.

**Is $10k a month realistic? A sanity check (estimate):**
- hipages handled 706k jobs in six months across Australia and New Zealand ([H1 FY25](https://announcements.asx.com.au/asxpdf/20250220/pdf/06fq8w9gtbrmn4.pdf)).
- Greater Perth has 2,452,765 people ([ABS](https://www.abs.gov.au/statistics/people/population/regional-population/latest-release)), about 8.8% of Australia. So hipages probably sees about 10k Perth jobs *posted* a month (a little high, because NZ is included).
- $10k a month net needs 327–410 *paid* jobs. At 30–50% of posts paid, that's 650–1,370 *posted* jobs, about **7–14% of the market leader's Perth volume**. hipages spends $21.6m a year on marketing ([hipages FY26](https://announcements.asx.com.au/asxpdf/20260824/pdf/0733gw0czqcdyv.pdf)).
- **That's a very hard target, not a plan.**

### 9.6 24-month scenarios (estimate)

**What's built in:**
- 0 paid jobs in month 1, because Stripe isn't live.
- The first 20 paid jobs are founding fee-free jobs.
- Rebooks at 2%: 0% of jobs in months 1–6, 20% in months 7–12, 35% from month 13.
- Fixed costs: A$60 a month, then A$150.

**What's left out:**
- insurance;
- GST;
- bring-your-own-customer jobs (which would add a little);
- tax, and paying yourself.

**Paid jobs per month, months 1–24:**
- **Pessimistic** (homeowners only, small jobs): 0,0,1,2,3,4,5,6,7,8,10,12, 13,14,15,17,18,20,22,24,25,27,28,30
- **Base** (2 business accounts by month 3, 4 by month 6, 8 by month 12, SEO from months 6–9): 0,1,3,5,8,11,14,18,22,27,33,40, 45,51,57,63,70,77,84,92,100,108,115,120
- **Stretch** (a large account early, bigger jobs, and help you'd need to hire): 0,3,8,15,25,35,48,60,75,90,105,120, 140,160,180,205,230,260,290,320,350,375,390,400

| Month | Pessimistic: jobs / net / running total | **Base: jobs / GMV / net / running total** | Stretch: jobs / GMV / net / running total |
|---|---|---|---|
| 1 | 0 / −$60 / −$60 | 0 / $0 / −$60 / −$60 | 0 / $0 / −$60 / −$60 |
| 3 | 1 / −$152 / −$272 | 3 / $2.3k / −$157 / −$280 | 8 / $13k / −$168 / −$295 |
| 6 | 4 / −$160 / −$745 | 11 / $8.5k / +$91 / −$520 | 35 / $57k / $2,080 / $3.4k |
| 9 | 7 / −$38 / −$1,091 | 22 / $17k / $454 / $513 | 75 / $122k / $4,126 / $13.4k |
| 12 | 12 / $43 / −$1,060 | **40 / $31k / $948 / $2.8k** | 120 / $194k / $6,692 / $30.9k |
| 18 | 20 / $133 / −$588 | 77 / $59k / $1,756 / $10.9k | 260 / $421k / $13,367 / $91k |
| 24 | 30 / $274 / $720 | **120 / $93k / $2,821 / $25.3k** | 400 / $648k / $20,645 / $201k |

**What the scenarios mean:**
- **Pessimistic:** year 1 is about **−$1,060**, and year 2 about **+$1,780**.
- **Base:**
  - About **$2.8k net in year 1** (about **$1.8k** if insurance costs $100 a month).
  - About **$22.5k in year 2**, on about $759k of GMV.
  - It crosses $1k a month around month 13.
  - Year-2 fees are about $42k, so it stays under the GST threshold *if* GST turnover is just fees.
- **Stretch:** it needs an early large account, staged payments cleared by a lawyer, and help you'd have to hire. It would also need GST registration around month 9 on a projected basis, cutting net by about 9%. That isn't modelled here. Don't plan your life on it.

### 9.7 Where the money goes on a typical $500 job (estimate)
Of the $30 in fees:
- $8.97 card fee
- $1.45 payout fee
- $2.00 active-account fee
- **$17.58 kept**, before fixed costs, tax and your time, and before the 1–3 hours of your time a hand-run job takes.

### 9.8 The budget ladder: $0 → $100 → $500 a month

**One-off setup costs** (legal review, insurance, ASIC or business-name fees, a business mobile, a bank account) come from the owner. They aren't rungs on the ladder.

**Rule for moving up a rung (judgement):** your average net revenue over the last 3 months covers the rung, tracking works (fix 3), and the rung below produced results on the scorecard. In the base scenario that means the $100 rung around **month 8** and the $500 rung around **month 11**. In the pessimistic scenario, the $100 rung comes around month 18 and the $500 rung not within 24 months. Never pay more per result than a third of what it's worth (section 7.5).

| Rung | When (base) | What to buy | Cost |
|---|---|---|---|
| **$0 a month** | Now until about month 8 | ABN; DNCR Type A; Search Console; IndexNow; Keyword Planner (in a parent's account, no campaign); SBDC advice; Facebook groups; a Nextdoor test; one 500-flyer test; your time | ABN free; DNCR $0 for 500 numbers a year ([DNCR](https://www.donotcall.gov.au/industry/subscription-overview)); hosting about US$5 |
| **About $100 a month** | About month 8 | Resend once past 20 tradies; texts to tradies about new jobs; 1,000 flyers for a proven suburb, delivered yourself; "Pay securely via Tradebench" QR stickers for tradies' quotes | Resend US$20 a month (`LAUNCH.md`); printing about $0.13–0.23 each ([Paperlust](https://printshop.paperlust.co/blog?p=5411), [MOO](https://moo.com/au/flyers/a5)); texts about AU$0.05–0.10 each (product review); stickers not researched |
| **About $500 a month** | About month 11 | A Meta test aimed at tradies in a short trade; paid flyer delivery for proven suburbs; DNCR Type B when your lists pass 500 numbers; trade event costs | Meta $100–200 per test; delivery $75–120 per 1,000 ([Flyer Squad](https://www.flyingsolo.com.au/forums/topic/leaflet-flyer-distribution-perth-wa/), [Airtasker](https://www.airtasker.com/courier-services/flyer-distribution/perth/)); DNCR Type B $126 a year for 20,000 numbers |

**Skip:** car magnets (from $59.31, [BannerBuzz](https://www.bannerbuzz.com.au/car-signs)), homeowner search ads, cash referral rewards and discount codes.

---

## 10. Product changes that would move the numbers (prioritised)

Effort: XS = under an hour, S = half a day, M = 1–3 days, L = 1–2 weeks.

### P0: before real money (weeks 1–6; fixes 1–4 come before any marketing)

| # | Change | Where | Moves | Effort |
|---|---|---|---|---|
| 1 | **Hold back payments until Stripe is live.** If the key isn't `sk_live_`, show "Payments switch on shortly, we'll contact you" instead of Checkout, and alert the admin when a quote is accepted. Hide the payouts step and the payouts reminder until live | `src/payments.js`, `views/pages/job.ejs`, `src/routes/dash.js`, `src/reminders.js` | Stops broken first experiences | S |
| 2 | **Instant founder alerts:** an email for every job (customer phone, company, number of matched tradies, "0 MATCHES" in the subject) and every sign-up. Cut the no-quotes alert from 3 days to 24 hours, or 4 hours when no tradie matched | `src/routes/jobs.js`, `src/notify.js`, `src/reminders.js` | #5, #7 | XS |
| 3 | **Record where people come from.** Store UTM tags, `ref`, referrer and landing page on the first visit; save them to the user and the job; tag email links; add an admin table by source; add a required "How did you hear about us?" field | middleware, `src/db.js`, `src/routes/auth.js`, `src/routes/jobs.js`, `src/emails.js` | Every CAC number | S |
| 4 | **Claims and copy:** see the list below this table | views, `src/helpers.js`, `src/routes/seo.js`, `docs/OUTREACH.md` | Avoids ACL and WA building-law problems | S |
| 5 | **Licence gating:** electrical, plumbing, gas, painting over $1,000, building, and air-con refrigerant work only for tradies with a checked register entry. Show EC and registration numbers on profiles: builders and painters must show them in ads, with penalties up to $25,000 ([WA](https://www.wa.gov.au/government/multi-step-guides/information-and-obligations-registered-building-services-providers/information-and-obligations-registered-builders)). Store licence and certificate expiry dates and pause quoting when they expire | profile, admin approval | Trust; legal | S |
| 6 | **Fix the email-confirmation trap.** Make "Confirm your email (needed for approval)" step 2 of the checklist, resend the link at 24h and 72h, and let the admin mark a tradie verified after a phone call | `src/routes/dash.js`, `src/reminders.js`, `src/routes/admin.js` | #2 | XS |
| 7 | **Security and operations pass** (section 4.8): backups off the machine plus a restore test, two-step login for admins, secrets check, `npm audit`, upload, rate-limit and escaping checks, runbook | `src/backup.js`, Fly config | Protects held money and data | S |
| 8 | **Release and disputes:** a "Mark job done" button with photos; the 5-day release policy text on the job page and in the terms; an alarm at 14 days held (21 already exists). Auto-release only after the lawyer approves the terms change | `src/routes/jobs.js`, `src/reminders.js`, `views/pages/terms.ejs` | #12; tradie trust | M |
| 9 | **Consent and marketing emails:** consent when a job is posted to share contact details ("When you pay, we share your name, phone and address with the tradie you hire"); treat "new jobs near you" alerts as marketing (consent at sign-up plus an unsubscribe); keep payment and job-status emails purely factual | `src/emails.js`, forms | Privacy; Spam Act | S |
| 10 | **Replace empty states that make the site look dead:** customer pages get a named 48-hour concierge promise with the business mobile number; hide empty "Open jobs" blocks; tradie-facing pages pitch the founding offer | `jobs.ejs`, `trade.ejs`, `area.ejs`, `sector-jobs.ejs` | #4 | S |
| 11 | **Show "You'll receive $X (fee $Y)" live under the quote price**, and raise the minimum quote to about $80–100 | `job.ejs`, `src/routes/jobs.js` | Tradie trust, average job size | XS |

**What fix 4 covers:**
- Rename the "Verified" badge to "Email confirmed".
- Show **one total price including the 2%** ([ACCC](https://www.accc.gov.au/business/pricing/price-displays)).
- Put "(min $15)" next to "4%".
- **Cap quotes at $7,499 for jobs on homes** (including rentals and short-stays) **and $19,999 for everything else.** A registered builder is needed for permit work of "$20,000 or more" ([WA](https://www.wa.gov.au/government/multi-step-guides/builders-registration)).
- Replace "pay only when it's done" in `head.ejs:23`, `area.ejs:5`, `seo.js:161` and `:190`, and `flyer.ejs:26`.
- Drop "mine sites" from the site title and description (`head.ejs:21`, `:23`).
- Say contact details unlock on payment, not on acceptance, in `how.ejs` and `sector-housing.ejs`.
- Remove the "look in person first" promise until site visits exist.
- Remove the "per property" claims from `docs/OUTREACH.md` and the flyer.
- Add the painters' registration rule (over $1,000) to the licence hint.
- **Rewrite the fee wording in `terms.ejs:30`** and refund the fee when a job is cancelled before work starts or the tradie doesn't show. Update the matching text in `job.ejs:56` and `admin.ejs:138`.

### P1: weeks 3–10

| # | Change | Moves | Effort |
|---|---|---|---|
| 12 | **Funnel timestamps:** `tradie_profiles.submitted_at`, `jobs.awarded_at`, `jobs.cancelled_at`, `jobs.matched_tradies`, `quotes.first_sent_at`, `users.last_seen_at` | #3, #5, #7, #8, #9 | S |
| 13 | **Founding tradie fee override** (first 2 paid jobs) plus a badge | #2 | S |
| 14 | **"Rebook this tradie" at a 2% tradie fee, no minimum.** It follows StyleSeat, where the new-client fee doesn't apply to returning appointments, though standard processing fees still do ([StyleSeat](https://www.styleseat.com/blog/how-much-does-styleseat-cost/)). Moved up from later because business customers leak after the first job | #13; leakage | M |
| 15 | **Variations:** the tradie proposes extra work on the same job, and the customer approves and pays it into the hold before the work starts | Trust on real jobs | M |
| 16 | **Fraud guards:** cap a new customer's first job at $2,000; hold a new tradie's first payout until the customer confirms; Stripe fraud screening | Chargeback risk | XS–S |
| 17 | **Lifecycle emails.** Customer: job posted (with your name and next steps), 24-hour no-quote update, review reminder at 3 days, "next job" 14 days after release. Tradie: welcome while pending (mention the tools), weekly digest, "you got a review", 30-day inactivity nudge | #13, #14 | S each |
| 18 | **Job Q&A** (reusing the contact-details filter) plus a **"Site visit" quote type**: a small call-out fee, paid and held, that reveals the address for the visit while the follow-up quote stays on the platform | #8, #9 | M–L |
| 19 | **"Invite a tradie to quote" link**, with priority approval for invited tradies | #2 | M |
| 20 | **Text alerts to tradies** (about AU$0.05–0.10 each). Text by hand until there are more than 5 jobs a week | #7 | M |
| 21 | **Easier job posting:** an email login link instead of a password, or a 2-step form; ask for a mobile number; count form starts | #4 | M |
| 22 | **Auto-expire open jobs** at 21–30 days, with a "still need it?" email 3 days before | SEO quality, #5 | S |

**When matching moves into the product:** once you pass about 5 jobs a week (base, around month 8–9), fixes 17–20 replace your phone calls. That's what brings the cost to serve each job below its net.

### P2: months 3–6

| # | Change | Moves | Effort |
|---|---|---|---|
| 23 | **"Get paid upfront for your own jobs"** (bring your own customer) at 1%, built only after the manual test with 3–5 tradies | Customers via tradies | L |
| 24 | **Invoices:** email with a pay-by-card link, a "Sent with Tradebench" footer and overdue reminders; Xero CSV export | Retention, word of mouth | M |
| 25 | **Fit for property managers** (only if discovery says so): a property field with per-property history and CSV export (S); later, pay-on-invoice for verified agencies (L, compliance check first) | Business segment | S–L |
| 26 | **SEO quality thresholds** (section 7.1), cost guides from real prices, FAQs, real photos | #15 | M, ongoing |
| 27 | **Tradie referral link** `/r/<code>` | #2 | M |
| 28 | **Tradie profile as a free website:** name-based URLs, a QR share card | Backlinks, trust | S–M |
| 29 | **Visitor counts:** count page views yourself in SQLite (path, referrer host, day; no cookies) or turn on Plausible | Attribution | XS–S |
| 30 | **Quick fixed-price "estimate" for small jobs.** hipages jobs with quick SMS estimates were 144% more likely to be marked hired ([hipages FY26](https://announcements.asx.com.au/asxpdf/20260824/pdf/0733gw0czqcdyv.pdf)) | #8 | M |
| 31 | **Staged releases:** a materials release on delivery, then completion. Needed for supply-and-install jobs. For home building work of $7,500+, only after legal advice (deposit of 6.5% or less) | Bigger jobs | M–L |
| 32 | **Consider capping the tradie fee on large jobs** | Tradie retention on big jobs | XS |
| 33 | **Admin coverage grid** (trade × suburb, flagging cells under 2) **and money view** | #2, #11 | S |

**Don't build yet:** an app, mining features, more regions, or ad integrations.

---

## 11. Rules: the marketing compliance checklist

*Not legal advice. Penalties are listed so you can see why each rule matters.*

### Email, SMS and direct messages (Spam Act 2003)
- **DO:** log consent for every address. Consent is either express (a tick box) or, for cold outreach, "conspicuous publication". That route needs all of these:
  - the address was openly published;
  - it reaches that person or their role;
  - there's no "no unsolicited messages" note next to it;
  - your message is relevant to their work ([Spam Act Sch 2](https://www.legislation.gov.au/C2004A01214/2016-03-10/2016-03-10/text/original/epub/OEBPS/document_1/document_1.html)).

  Record the URL, the date and a screenshot.
- **DO:** put your legal name (or name + ABN), contact details valid for 30 days, and a free one-click unsubscribe in every marketing message. Honour unsubscribes within 5 working days ([ACMA](https://www.acma.gov.au/avoid-sending-spam)).
- **DO:** keep job-status and payment emails purely factual. Lululemon paid **$702,900** for service emails that contained promotions without an unsubscribe ([ACMA](https://www.acma.gov.au/articles/2026-03/lululemon-penalised-702k-spam-breaches)).
- **DON'T:** use email-finder or scraper tools, buy lists, or send "can I email you?" messages. Asking for consent by email is itself a marketing message ([ACMA](https://www.acma.gov.au/avoid-sending-spam)).
- **DON'T:** ask people to "reply STOP" to a named SMS sender they can't reply to, or use an unregistered sender name after 1 Jul 2026. Registering a sender name needs an ABN ([ACMA](https://www.acma.gov.au/sms-sender-id-register)).
- **Penalties:**
  - One unsolicited message: 20 penalty units for an individual or 100 for a company (Spam Act s25). 2+ on one day: 400 (individual) or 2,000 (company) units per day.
  - At $330 a unit (the value from 7 Nov 2024), that's $6,600 / $33,000 per message and $132,000 / $660,000 per day.
  - The rules research read the ACCC page as giving $364 a unit from 1 Jul 2026, which would make it $7,280 / $36,400 and $145,600 / $728,000. Check the current unit value.

### Calls and door-knocking
- **DO:** check lists against the DNCR first (free for 500 numbers). Call weekdays 9am–8pm and Saturdays 9am–5pm, never Sundays or national public holidays. Identify yourself, show your number, and hang up when asked ([DNCR](https://www.donotcall.gov.au/industry/industry-overview/industry-standards)).
- **DO:** door-knock only on weekdays 9am–6pm and Saturdays 9am–5pm, and respect "Do not knock" signs. If someone asks you to leave, don't contact them again for 30 days. A sale of $100+ from an unsolicited approach carries cooling-off rules ([ACCC](https://www.accc.gov.au/business/selling-products-and-services/telemarketing-and-door-to-door-sales)).
- **Penalties:** up to $250,000 per breach of the standard ([DNCR](https://www.donotcall.gov.au/industry/industry-overview/compliance-and-breaches)). TAB paid $2.7m in July 2026 ([ACMA](https://www.acma.gov.au/articles/2026-07/tab-pays-27m-telemarketing-and-spam-breaches)).

### Advertising claims (Australian Consumer Law)
- **DO:** say exactly what you checked and when, and publish your re-check schedule (section 5, step 12).
- **DO:** describe held payment precisely: who decides a dispute, and when money is released or refunded (section 4.6). Never suggest customers lose their consumer guarantees, which "can't be taken away" ([ACCC](https://www.accc.gov.au/business/selling-products-and-services/consumer-rights-and-guarantees)).
- **DON'T:** say "guaranteed", "fully insured", "licensed" or "verified" unless it's true for every listing. Don't say "pay only when it's done" while the card is charged before work starts.
- **DON'T:** advertise suburbs or trades you can't cover. The ACCC says not to offer services you know you can't supply, and Google Ads bans "unavailable offers" ([Google](https://support.google.com/adspolicy/answer/6020955?hl=en)).
- **DON'T:** compare yourself with competitors on fees without checking their current prices, including memberships and passes.
- **DON'T:** post fake jobs, or create tradie profiles without the tradie's consent.
- **Penalties:** companies face the greater of $100m, 3× the benefit, or 30% of turnover; individuals face $2.5m ([ACCC](https://www.accc.gov.au/business/compliance-and-enforcement/fines-and-penalties)).

### Reviews
- **DO:** let only customers with a paid, completed job review. Show the count with the rating, publish a moderation policy, and disclose family or employee relationships.
- **DON'T:**
  - let tradies draft reviews (ServiceSeeking, $600k);
  - hide negative reviews (HealthEngine, $2.9m);
  - offer review incentives (banned by Google);
  - ask only happy customers ([ACCC](https://www.accc.gov.au/business/advertising-and-promotions/online-reviews-for-product-and-services), [Google](https://support.google.com/contributionpolicy/answer/7400114?hl=en)).

### Prices and fees
- **DO:** show one total price that includes every unavoidable fee ("$1,000 quote → **$1,020 total**"), with all fees shown at the start, not dripped in at checkout ([ACCC](https://www.accc.gov.au/business/pricing/price-displays)). Show "(min $15)" as prominently as "4%".
- **DON'T:** describe or justify the 2% as a card fee, including on the terms page. From 1 Oct 2026 card surcharges are banned, and calling a surcharge "another type of fee" may mislead ([ACCC](https://www.accc.gov.au/business/pricing/card-surcharges)).

### Tradie terms
- **DON'T:** use one-sided terms, such as changing fees whenever you like, suspending tradies without reason, or big penalties for dealing off-platform. Unfair terms in standard contracts with small businesses are banned ([ACCC](https://www.accc.gov.au/business/selling-products-and-services/contracts)). Don't plan to sue tradies over off-platform deals.
- **DO:** have the lawyer draft a fair clause for recovering a transfer after a chargeback (section 4.6).

### Privacy
- **DO:** get consent before sharing a customer's contact details with a tradie. Sharing them for a commission may count as "trading in personal information", which removes the small-business exemption ([OAIC](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/trading-in-personal-information)).
- **DO:** publish a proper privacy policy that names any Meta Pixel or Google tags, collect as little as possible through them, and offer an opt-out from targeted ads ([OAIC](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/tracking-pixels-and-privacy-obligations)).
- **Note:** a right to sue for serious invasions of privacy has applied since 10 Jun 2025, and small businesses aren't exempt from it ([Act](https://www.legislation.gov.au/C2024A00128/asmade/2024-12-10/text/1/epub/OEBPS/document_1/document_1.html)).

### Using AI tools safely (judgement, applying the rules above)
- **Fine:** drafting scripts, emails, posts, page copy and summaries of your discovery notes.
- **Check every number and claim** before it goes public. The ACL applies whoever wrote the words.
- **Send outreach one by one**, to addresses you logged by hand. Never let a tool find, scrape or bulk-send to addresses.
- **Never** generate reviews, testimonials, job photos or "example jobs" that look real.
- **Don't mass-generate SEO pages.** Every page needs real tradies, jobs or prices behind it (Google's "scaled content abuse").
- **Keep personal information out of AI tools** (customers' names, phones, addresses) unless your privacy policy covers it.

### Platform rules
- **Meta:** don't post at very high frequency, pay group admins for permission to post, or run like-for-prize giveaways ([Meta](https://transparency.meta.com/policies/community-standards/spam/)). Each group's own rules apply on top.
- **Google Business Profile:** none for Tradebench and none per suburb. Tradies can have their own.
- **Google Ads:** disclose full pricing, make no unreliable claims and advertise no unavailable offers. Account holders must be 18+.

### WA licensing (applies to what you list and advertise)
- Electrical, plumbing and gas work: licence holders only. Electrical contractors show their EC number on ads.
- Painting over $1,000: registered painter.
- Building permit work of $20,000 or more: registered builder. The threshold is $50,000+ for Class 10a buildings "such as a private garage, shed or carport" ([WA](https://www.wa.gov.au/government/multi-step-guides/builders-registration)).
- Home building work of $7,500–$500,000: written contract, deposit of 6.5% or less, no further upfront payments, and variations in writing ([WA](https://www.wa.gov.au/government/multi-step-guides/information-and-obligations-registered-building-services-providers)). Your $7,499 cap on jobs on homes keeps you out of this for now.
- Air-con refrigerant work: a refrigerant handling licence (ARC; not researched, so confirm the rule).
- Builder and painter registration applies only inside the Building Services Board's mapped area, so check before advertising regional building or painting.
- Don't split jobs to get under a threshold. That's a caution only; no specific anti-splitting rule was confirmed.

### Minors
If you're under 18:
- A parent owns the live Stripe account, Google Ads and Analytics, and any company directorship.
- A parent guarantees any significant contract.
- A parent decides disputes over $500.

### Tax and reporting
- SERR reports to the ATO, due 31 Jan and 31 Jul. Collect tradie identity details at sign-up.
- Get the accountant's written answer on whether GST turnover is fees or job value (section 4.4).

### Ask a lawyer about these (unverified in the research)
- payment-services licensing reforms;
- the proposed ban on unfair trading practices;
- extra licences for some trades (refrigerant handling, asbestos);
- whether "tranche 2" privacy reform has removed the small-business exemption.

---

## 12. Risks, kill and pivot signals, and what "funding your future" really looks like

### The main risks

| Risk | Early signal | Response |
|---|---|---|
| **Customers can't or won't pay a held card payment** | Discovery: 3 or more of 5 say no | Drop that segment now. Lean on homeowners and hosts, or scope pay-on-invoice for verified agencies (compliance check first) |
| **Business customers leak after the first job** | Pairs that go quiet after one job; "I just call them direct now" | Rebook at 2% from early on (fix 14). Accept that revenue from those customers may be first-job only |
| **GST counted on job value** | The accountant's answer (section 4.4) | Rewrite the terms (agent model) before volume grows. If that isn't possible, the model needs rethinking |
| **Chargebacks and fraud** | A dispute after release; a new pair with an odd pattern | The policy and guards in section 4.6; fix 16 |
| **Stripe reserve or review at activation** | Stripe asks for more information or holds payouts | Answer quickly with your terms and policy. Don't plan cash around fast payouts |
| **Parent's personal liability** (sole-trader option) | Any dispute or claim | Consider a company (section 4.1). Have insurance or a written view on cover (section 4.5) |
| **Held payment versus WA building law** | Legal advice | Jobs on homes capped at $7,499; staged payments only after advice |
| **Tradies are scarce** | Jobs with no quotes, especially tiling, roofing and carpentry | Recruit electricians and handymen first. Don't market trades you can't cover |
| **Losing the database** | No off-machine backup; a restore never tested | Section 4.8, gap 1 |
| **The fee looks bad on tiny and huge jobs** | Complaints about $15 on $150 jobs, or 4% on $10k jobs | Raise the minimum quote, lower the minimum fee, cap the fee on big jobs |
| **SEO pages treated as doorway spam** | Pages not indexed, or a manual action in Search Console | Keep the thresholds; `noindex` empty pages |
| **A local rival with traction** | Trade Heroes ([press release, Mar 2025](https://www.financialcontent.com/article/abnewswire-2025-3-28-why-finding-a-reliable-tradesperson-is-still-a-massive-headache-and-how-to-fix-it)), CallOut ([So Perth](https://soperth.com.au/perth-starup-callout-app-launches-find-local-business-book-pay-app-10060)) or Jobs and Services ([SmartCompany, 2014](https://www.smartcompany.com.au/startupsmart/how-social-media-and-persistence-on-the-phone-helped-to-build-an-online-tradie-marketplace/)) is active. None was confirmed active in 2026 | Check their sites and ABNs. If one is winning your cluster, pick another |
| **Incumbents move** | hipages has already released Tap to Pay and lists Payments on its roadmap; Airtasker Pro Pass and customer membership; Google LSA arriving in Australia | Watch hipages' half-year results (late Feb 2027) and [Google's LSA country list](https://support.google.com/localservices/answer/6224841?hl=en). Every hipages price rise is a recruiting moment |
| **Brand confusion** | "TradeBench" is also a trading-journal tool ([EliteTrader](https://elitetrader.com/et/resources/tradebench.421/reviews)) | Do the trade mark search (section 4.1). Always pair the name with "Perth tradies" |
| **Founder burnout, school clash or cash drain** | Losing weeks to channels with no results; missed school work | The 20-hour-a-week cap, the kill rules, the budget ladder, the parent agreement |

**How to spend the 20 hours (judgement):** in months 1–2, about 6 hours a week on product and setup and 14 on conversations, sign-ups and matching jobs. From month 3, about 3 hours on product and 17 on conversations and matching.

### Kill and pivot signals (thresholds are judgement)

| Decision | Signal | What to do |
|---|---|---|
| **Kill a channel** | The per-channel rule in section 8 | Stop it and move the hours to what works |
| **Drop a trade** | Can't reach 2 live tradies in that trade within the cluster after 4 weeks of recruiting | Remove it from marketing in that cluster |
| **Change segment (agencies)** | 3 or more of 5 discovery agencies can't pay a held card payment, **or** 0 jobs after 60 conversations | Shift to short-stay and homeowners, or build pay-on-invoice after a compliance check |
| **Change segment (short-stay)** | Every manager on the list plus 30+ hosts contacted, and no job posted in 4 weeks | Ask why. Try homeowners or agencies in the same cluster |
| **Fix supply before demand** | 2 or more unquoted jobs a week for 4 weeks | Pause demand outreach in that trade and recruit |
| **Change fees** | 3 or more of your first 10 tradies refuse or quit over the fee, or most jobs earn about $12.50 | Test a lower minimum, a cap on big jobs and cheaper rebooks, and push bigger jobs |
| **Change the model** | Accepted-but-unpaid jobs stay common after Q&A and site visits ship | Make bring-your-own-customer held payments and the job tools the main product |
| **Big checkpoint, month 6** | At or below the pessimistic line (about 4 paid jobs a month) even though jobs are getting quotes | Narrow further, to one segment, such as short-stay maintenance only. Thumbtack stepped back into less-crowded niches ([TechCrunch](https://techcrunch.com/2018/05/05/how-did-thumbtack-win-the-on-demand-services-market/)) |
| **Big checkpoint, month 12** | Still at or below the pessimistic line (about 12 paid jobs a month) | Seriously consider pivoting to the tradie payments and tools product, or stopping. The skills carry over either way |

### What "funding your future" realistically looks like

All figures are pre-tax, before you pay yourself, and **estimates** from section 9, assuming about 20 hours a week (about 1,000 hours a year).

| Scenario | Year 1 | Year 2 | Per hour of your time |
|---|---|---|---|
| Pessimistic | About −$1,060 | About +$1,780 | Below zero in year 1; about $1–2 an hour in year 2 |
| **Base** | About **$2.8k** (about $1.8k with $100/month insurance) | About **$22.5k** | About **$2–3 an hour** in year 1; about $15–22 an hour in year 2 |
| Stretch | About $31k | About $170k | Needs hired help, an early large account and legal clearance. Don't plan on it |

**The honest summary.**
- In the base case, year 1 pays less than almost any part-time job. Year 2 *might* reach a solid part-time income.
- Even then, the business only pays you $30 an hour for 20 hours a week around **month 22**.
- It all rests on business customers who keep booking through you, and on bigger jobs.
- **Nothing here guarantees income.**

**What success looked like elsewhere:** hipages bought Builderscrack, a trades marketplace in New Zealand, for $11.8m in December 2021 (currency not labelled). At the time it had 95,000+ jobs posted a year and about NZ$67m of job value ([iTnews](https://www.itnews.com.au/digitalnation/news/builderscrack-attracts-aussie-tradies-site-573791)). That took many years.

**What failure looked like:** Homejoy raised money, spread fast and shut down ([Harvard D3](https://d3.harvard.edu/platform-digit/submission/homejoy-a-silicon-valley-darlings-path-to-the-grave/)).

**My judgement on how this can fund your future:**
- Keep your cash risk tiny: no spending beyond what revenue covers, and setup paid by the owner.
- Treat years 1–2 as building real skills (sales, product, payments, compliance) and a small real asset.
- Let the month-6 and month-12 checkpoints, not hope, decide whether to keep going.
- Protect your schooling and your parent's finances first.

---

## 13. The 12-month calendar and the 30-day checklist

### 12-month calendar

"Base" is the base scenario's paid jobs that month **(estimate)**.

| Month | Focus | Key actions | Base paid jobs |
|---|---|---|---|
| **M1: Nov 2026** | Setup, discovery, first supply | ABN; legal quotes and booking; the accountant's GST question; Stripe application; P0 fixes 1–7, 10, 11; 5–10 discovery conversations; segment chosen; 8–12 tradies; about 30 outreach conversations; 3–5 real jobs posted | 0 |
| **M2: Dec 2026** | Live and run by hand | Legal advice in, terms updated (fee wording, release policy, chargeback clause); fixes 8 and 9; Stripe live; tradies connect payouts again; first paid jobs; bring-your-own-customer test with 3–5 tradies; job-posted and 24-hour emails. Diary: **10 Dec**, privacy policies must explain automated decisions (ask the lawyer whether this covers you). School holidays may free up time | 1 |
| **M3: Jan 2027** | Measure | Count-based scorecard; founding fee override (fix 13); **SERR report due 31 Jan 2027** if any payouts happened Jul–Dec; first case study | 3 |
| **M4: Feb 2027** | Supply loops | Invite-a-tradie link; fraud guards; watch hipages' half-year results (late Feb) | 5 |
| **M5: Mar 2027** | Repeat business | Rebook at 2% (fix 14); variations (fix 15); first PR pitch once 3–5 jobs have been paid and released | 8 |
| **M6: Apr 2027** | **Checkpoint** | Compare against the scenarios; segment and fee decisions (section 12); earliest check of the expansion rule; SEO thresholds | 11 |
| **M7: May 2027** | Content and SEO | Licence-check guide, first cost guides, short video at 2 a week; lifecycle emails | 14 |
| **M8: Jun 2027** | Bigger jobs, automation | Registered painters, labour-only air-con installs; text alerts as you pass 5 jobs a week; $100 budget rung if the 3-month average allows | 18 |
| **M9: Jul 2027** | Expand if the rule holds | Neighbouring suburbs; **SERR report due 31 Jul 2027** | 22 |
| **M10: Aug 2027** | Second cluster, or go deeper | Copy the playbook to a second cluster only if the first has "tipped" (repeat customers and word-of-mouth share rising); otherwise go deeper in the first | 27 |
| **M11: Sep 2027** | Paid test, maybe | $500 rung if the 3-month average allows; one Meta test aimed at tradies in a short trade | 33 |
| **M12: Oct 2027** | **Year-one review** | The month-12 checkpoint; GST check with the accountant; decide whether mining is worth exploring in year 2 | 40 |

### 30-day checklist (Day 1 = Monday 26 Oct 2026)

It's built for about 20 hours a week: weekday afternoons (calls between 3:30 and 5pm) plus Saturdays. **Sundays have no sales calls.** Check public holidays before calling.

**Week 1: decide and start (about 17 hours)**
- [ ] **Day 1 (Mon 26 Oct):** Read this plan with your parent. Agree the owner, the structure, your weekly hours, who fronts business meetings, and the $500 dispute rule, then write the one-page agreement. Create the spreadsheet tabs (outreach, consent, tradie pipeline, job desk, scorecard, channels).
- [ ] **Day 2 (Tue 27):** Apply for the ABN. Book a free SBDC session. Email 2–3 lawyers for written fixed-fee quotes on the ranked list (section 4.3). Email an accountant the GST question (section 4.4).
- [ ] **Day 3 (Wed 28):** Ship fix 1 (hold back the test checkout) and fix 2 (founder alerts).
- [ ] **Day 4 (Thu 29):** Score candidate clusters (section 3) using your dad's draft list, the short-stay data and agency counts. Search IP Australia for the trade mark and check the business name.
- [ ] **Day 5 (Fri 30):** Open a DNCR Type A account and check your first numbers. Book 5–10 discovery conversations, family contacts first.
- [ ] **Day 6 (Sat 31):** Sit down with your dad. List 20–30 tradies and check every licence on the register. Choose 8–12 for the first sign-ups (2–3 per trade). Ring them between 9am and 5pm and book sign-ups for the next two Saturdays.
- [ ] **Day 7 (Sun 1 Nov):** No calls. Baseline scorecard. Draft the release and dispute policy (section 4.6). Plan week 2.

**Week 2: fix the claims, discovery, first sign-ups**
- [ ] **Day 8 (Mon 2 Nov):** Ship fix 4 (claims and copy, including the terms page).
- [ ] **Day 9 (Tue 3):** Two discovery conversations (3:30–5pm).
- [ ] **Day 10 (Wed 4):** Two discovery conversations. Ask 2 insurance brokers for quotes.
- [ ] **Day 11 (Thu 5):** Ship fix 3 (source tracking and the "How did you hear about us?" field).
- [ ] **Day 12 (Fri 6):** 1–2 discovery conversations. Write up the answers in the spreadsheet.
- [ ] **Day 13 (Sat 7):** 3–4 tradie sign-ups in person: profile, photo, licence, insurance certificate and its expiry date, email confirmed. Payouts wait until live. Ask each the two questions.
- [ ] **Day 14 (Sun 8):** No calls. **Discovery decision:** first segment and pitch (rule in section 6.1). Scorecard.

**Week 3: lawyer, Stripe, outreach**
- [ ] **Day 15 (Mon 9):** Accept a legal quote (your parent pays), or use the SBDC fallback (section 4.3). Start the live Stripe application in the owner's name and ask Stripe about the platform payout schedule (section 4.7).
- [ ] **Day 16 (Tue 10):** 6 outreach calls to your chosen segment. Follow-up emails only to published addresses, each logged.
- [ ] **Day 17 (Wed 11):** Get the business mobile and put the "text us a photo" job desk on the site (fix 10).
- [ ] **Day 18 (Thu 12):** 6 outreach calls. Ask family and neighbours about real jobs coming up.
- [ ] **Day 19 (Fri 13):** Security pass (fix 7): backups off the machine and a restore test, two-step login for admins, secrets check.
- [ ] **Day 20 (Sat 14):** 3–4 tradie sign-ups (8–12 in total). Join 5 Facebook groups, read the rules and message the admins. Don't post yet.
- [ ] **Day 21 (Sun 15):** No calls. Scorecard. Count jobs actually posted by interested customers, not promises.

**Week 4: run it by hand (still in test mode)**
- [ ] **Day 22 (Mon 16):** 6 outreach calls. Check in with every interested customer: "Send me your next job; here's the text-a-photo number."
- [ ] **Day 23 (Tue 17):** Post the first real jobs, with the customer's OK. Quotes can come in before Stripe is live; the payment step shows the "switching on shortly" message. Ring 2–3 tradies for each job the same day.
- [ ] **Day 24 (Wed 18):** Ship fix 6 (email-confirmation trap) and fix 11 (live "You'll receive $X").
- [ ] **Day 25 (Thu 19):** 6 outreach calls. One in-person visit with your parent if your segment is business customers.
- [ ] **Day 26 (Fri 20):** Chase the legal advice and the Stripe application. Start fix 5 (licence gating).
- [ ] **Day 27 (Sat 21):** Ring the call list only for trades where a job got fewer than 2 quotes. Follow up with tradies on bring-your-own-customer. Optional: the 500-flyer test in your best-covered suburb, with its own link.
- [ ] **Day 28 (Sun 22):** No calls. 4-week review against the M1 targets. Apply the per-channel kill rules.
- [ ] **Day 29 (Mon 23):** 6 outreach calls. Follow up with silent customers and ask why they haven't posted.
- [ ] **Day 30 (Tue 24):** **30-day decision.**
  - **Targets:**
    - 8–12 tradies signed and checked;
    - 5–10 discovery conversations done and a segment chosen;
    - about 30 outreach conversations;
    - legal review under way and the Stripe application submitted;
    - P0 fixes 1–4, 6, 7, 10 and 11 shipped;
    - 3–5 real jobs posted, with paid jobs once Stripe is live (likely December).
  - Choose the segment, trades and channels for the next 30 days and write them at the top of the spreadsheet.

---

*Evidence notes:*
- Figures come from the linked sources, fetched 23–24 October 2026. Repo references were checked on 24 October 2026.
- **Secondary, dated or from search snippets:**
  - the Airtasker help-centre fee pages (15.95% / $4.90 / $49.95; 20%–11.9%);
  - the Airtasker customer membership price ("$896" may be "$89" plus a footnote marker);
  - the NAB Airtasker quote (page now 404);
  - CHOICE (2019);
  - Backlinko (before AI Overviews);
  - the HIA invoice figure (promotional);
  - the WA short-stay counts for 2026 (search snippets; Power BI only);
  - the STRA fines and the 90-night rule (competitor research; re-check on the regulator's page);
  - REIWA's 1,100–1,350 agencies;
  - Indie Hackers' 0.9%;
  - Flyer Squad prices;
  - the Middy's page (404).
- **Pages a reviewer couldn't open for a second check:** the ATO SERR page, ACCC pages (surcharge-ban date, ServiceSeeking $600k, HealthEngine $2.9m, price displays) and ACMA pages (Lululemon, TAB, the SMS sender ID rule). Re-check these before publishing any of them.
- **Not researched at all:**
  - costs: legal, insurance, ASIC, business name, bank, business mobile;
  - the refrigerant licence rule;
  - the Law Society referral service, community legal centres and university clinics;
  - franchise and maintenance-contractor competitors;
  - strata managers;
  - school term dates;
  - card dispute windows;
  - whether Stripe would apply a reserve;
  - Meta's advertiser age;
  - Bunnings' flyer policy;
  - how WA agencies actually pay tradies;
  - whether Perth rivals are active.
- **The model:** the scenario and per-job figures were recalculated for this revision with the assumptions stated in section 9.
- **Re-check any competitor price before quoting it in public.**