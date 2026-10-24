# Security and bug audit (24 Oct 2026)

Run against commit 7279e75. Six independent auditors each took one area (sign-in and two-step login, payments, access control, input handling, business logic, deployment), then two more hunted for what they missed. That produced 41 distinct findings.

Each finding then goes to reviewers who try to disprove it: one traces the code path (or reproduces it), one is a skeptic who looks for the guard that already prevents it. A usage limit stopped the run part way, so:

- **5 confirmed**: both reviewers reproduced or traced them. Fix these first.
- **36 not yet reviewed**: plausible, with file and line, but nobody has tried to disprove them yet. Some will turn out to be wrong. Check each one (trace the code; reproduce with a local server) before fixing it.

Line numbers are as of 7279e75 and will drift as the code changes.

## Confirmed

**Status (24 Oct 2026): C1 to C5 are fixed in code, with tests in `test/audit.test.js`. Not deployed yet.**

- C1: uploads stream to the machine's temp folder instead of memory; only one image is decoded at a time; each person (account, or address, with IPv6 counted per /64) can have 2 uploads open, with 20 for the whole site; an upload that sends under 32KB in 10 seconds is dropped; the server allows 30s for headers and 5 minutes per request.
- C2: login cuts emails to 200 characters; the throttle map is swept every 5 minutes and capped at 50,000 entries.
- C3: a login attempt is counted before the password check, and given back if it's right; at most 4 password checks run at once (others get "busy, try again"); rate limits count IPv6 per /64.
- C4: private jobs are capped at 20 while a business is being checked, 50 a day once approved, and none if rejected; 500 time entries and 500 costs per job; 300 time/cost/invoice additions an hour per account; backups are skipped (with a logged error) when free space is under twice the database size, and leftover temp files are cleaned up.
- C5: team invites need a confirmed email; a password reset on an account whose email wasn't confirmed removes all its team logins and invites; on a confirmed account the reset (and password change / log out everywhere) points the owner at the Team page instead of silently logging staff out.

### C1. Two slow anonymous uploads use up the global upload cap (MAX_ACTIVE=2) and block every job post and photo upload site-wide

- **Severity:** high (first reported as high)
- **Where:** `src/uploads.js:205`
- **Area:** availability

receive() allows only MAX_ACTIVE=2 uploads at once across the whole process (src/uploads.js:166). It takes a slot before multer reads the body (lines 190-217) and frees it only when the response finishes or the connection closes (res 'finish'/'close'). So a slot stays held for the whole request, including the time spent reading a slowly sent multipart body, not just the sharp processing. While both slots are held, every other upload request site-wide (job posts, tradie logo and work photos, work-order note photos) gets HTTP 503 'Busy right now' (lines 190-192). On POST /jobs, receive() runs before verifyCsrf (src/routes/jobs.js:171-175), so a request with no cookie or CSRF token still gets a slot. The job form is always multipart (views/pages/job-new.ejs:10), so every job post goes through this check, with or without photos. The counter is global, not per account or IP. Node's default server.requestTimeout of about 300s is the only thing that frees a stalled slot, and server.js sets nothing lower.

**How it goes wrong:** Tested locally. An attacker opens two connections every ~5 minutes: `POST /jobs` with `Content-Type: multipart/form-data`, `Content-Length: 10000000`, then sends a byte now and then. No login, cookie or CSRF token is needed. Done anonymously this uses 24 signupLimit hits an hour (12 per hour per IP, so two IPs). A free customer account avoids signupLimit completely (key `u<id>`, 20 per 10 minutes), and the same works on authenticated routes such as POST /work/:id/notes. While the slots are held, every customer trying to post a job (the marketplace's main funnel) and every photo upload gets a 503. Posting worked again once those connections closed.

**Fix:** Check the CSRF token before taking a slot: send it in the multipart URL or a header and check it before multer, or require a session cookie with a valid csrf. Add a per-request body deadline (req.setTimeout, or destroy the request if the upload doesn't finish within e.g. 30-60s or falls below a minimum rate), and lower server.requestTimeout / headersTimeout in server.js. Free the slot once the parsed body is in hand rather than when the response ends. Only count requests that actually contain a file part toward MAX_ACTIVE. Key the limit per account or IP instead of one global counter, and queue requests (with a bounded queue and a higher MAX_ACTIVE, since peak memory per decode measured about 135MB) instead of returning 503. Consider setting fly.toml [http_service.concurrency] explicitly too.

**Reviewer notes on the fix:** The finding's fix list is correct but over-broad; the core mistake is that the MAX_ACTIVE slot exists to cap concurrent sharp DECODES (~135MB each, uploads.js:28-30) yet is held across the whole request including the slow body read. Minimal, correct fix: (1) Verify CSRF and finish parsing the multipart body BEFORE acquiring any decode slot — move the `active` guard out of receive() and wrap it only around the sharp work in save()/saveAll(), releasing immediately after each decode; a parsed, CSRF-valid request then can't be starved by slow senders. (2) Defend the slow-body vector separately from the decode cap: in server.js set server.headersTimeout and server.requestTimeout low (e.g. 30-60s) and add req.setTimeout / a socket idle timeout so a trickled upload is destroyed quickly instead of holding a connection ~300s. (3) Count only requests that actually carry a file part toward the decode limit, and key the per-person upload rate limit so a single account/IP can't monopolize. (4) Consider a small bounded queue with a modestly higher MAX_ACTIVE rather than a bare 503 at concurrency 2. Also set fly.toml [http_service.concurrency] so the single 512MB machine sheds load predictably. Items (1) and (2) together close the exploit; the rest harden it. The proposed fix is largely correct but note that checking CSRF before taking a slot only closes the anonymous vector; a logged-in customer with a valid CSRF token can still hold both slots, so CSRF-before-slot is not sufficient on its own. The load-bearing changes are: (1) add a per-request body/read deadline (req.setTimeout plus a minimum throughput check, destroying the request if the body is not received within ~30-60s) and lower server.requestTimeout/headersTimeout in server.js so a stalled upload cannot hold a slot for ~5 minutes; (2) stop using one process-global counter — key the concurrency limit per IP/account, or raise MAX_ACTIVE and bound by measured peak memory, and only count requests that actually carry a file part; optionally queue (bounded) instead of returning 503, and set fly.toml [http_service.concurrency] explicitly. Freeing the slot once the parsed body is in hand rather than on response end also shortens the hold.

### C2. Login throttle map stores whole, unlimited-length emails and is almost never cleared: memory exhaustion

- **Severity:** medium (first reported as high)
- **Where:** `src/routes/auth.js:66`
- **Area:** availability

POST /login builds two in-memory throttle keys from the raw email: `${req.ip}|${email}` and `email|${email}`. Login never caps the email's length (signup's accounts.read cuts it to 200 characters), so under the 200kb urlencoded body limit each key can be about 200KB. Entries are only removed when `attempts.size > 10000` (lines 25-27), and then only if they are older than 15 minutes. At about 400KB per failed attempt, 10,000 entries would be about 4GB, so the 512MB machine runs out of memory long before the sweep ever runs. Tested locally: 200 failed logins from 5 addresses (40 each, under loginLimit) left 80.5MB of heap after GC, and RSS went from 85MB to 215MB.

**How it goes wrong:** An attacker with a few IPv4 addresses (or one IPv6 /64, see the rate-limit key finding) GETs /login for a CSRF token, then sends 40 POST /login per IP per 15 minutes, each with a different ~199,000-character email. Each failure keeps about 400KB in `attempts` for good. One IP adds about 64MB an hour, so the single 512MB Fly machine runs out of memory in a few hours, or in minutes with about 20 IPs. Fly restarts it and the attacker repeats. The whole site goes down, and pending email retries are lost on each crash.

**Fix:** Cut the email before using it in any key, e.g. `.slice(0, 200)` as accounts.read does, or key on a hash of it. Sweep `attempts` on a timer as ratelimit.js does, deleting entries whose window has passed, instead of only when size > 10000. Put a hard cap on the map size.

**Reviewer notes on the fix:** The finding's fix is correct and I confirmed the mechanics. Prioritise it as: (1) The single most effective change is to cap the email before it ever enters a key — slice to 200 (as accounts.js:18 already does) or hash it. This drops per-entry cost from ~200KB to ~200 bytes, so even a full 10,000-entry map is only a few MB and the exhaustion vector is gone on its own. (2) Add a timer-based sweep for `attempts` like ratelimit.js's (delete entries whose 15-min window has passed), since the current size>10000 trigger never runs before OOM and skips fresh entries. (3) Add a hard cap on the map (evict oldest / reject when full) as a backstop. Also note two things the finding only implies: the `email|${email}` key is never deleted even on successful login (auth.js:91 deletes only the ip|email key), so fix the delete to clear both; and the root enabler for cheap IP rotation is that loginLimit/throttle key on the exact req.ip (an IPv6 /64 defeats it) — worth keying rate limits on the IPv6 /64, tracked as the separate rate-limit-key finding. Proposed fix is correct and sufficient. Minimal single change that closes the memory-exhaustion vector: slice the email to 200 chars (matching accounts.js) before building either throttle key, e.g. `const ekey = email.slice(0,200);` then key on `${req.ip}|${ekey}` and `email|${ekey}`. That caps every Map key to a few hundred bytes, so even at the existing 10,000-entry sweep threshold the map stays a few MB. For defence in depth, also add a timer sweep like ratelimit.js (setInterval + unref, delete entries whose 15-min window has passed) and/or a hard cap on map size, so the cleanup no longer depends on the unreachable size>10000 condition.

### C3. Login failure counters are incremented after the awaited bcrypt compare, so concurrent requests bypass the per-email cap and saturate the single CPU

- **Severity:** medium (first reported as high)
- **Where:** `src/routes/auth.js:79`
- **Area:** auth-bypass-dos

In POST /login the throttle gate is read at line 69 (`rec.n >= 8 || forEmail.n >= EMAIL_FAILURES`), but the counters are only bumped at lines 81-82 AFTER `await bcrypt.compare(...)` at line 79. Because better-sqlite3 and the counter reads are synchronous, every request that arrives while others are still awaiting bcrypt sees the pre-increment value and passes the gate, so a burst of simultaneous attempts all run bcrypt. This defeats the intended '30 failures per email per 15 minutes' and '8 per IP+email' limits under concurrency, and because bcryptjs (cost 11, pure-JS) runs on the one shared vCPU of the 512MB Fly machine, the pile of hashes starves the event loop for everyone. It compounds with the per-/128 IPv6 rate-limit gap (src/ratelimit.js:32): an attacker with an IPv6 /64 has effectively unlimited source addresses and can keep an unbounded number of bcrypt hashes in flight. Reproduced locally: 120 simultaneous wrong-password POSTs against one email ran bcrypt on ~98 of them (should have been <=30) and tied the server up for ~15s.

**How it goes wrong:** An attacker fires a few hundred concurrent POST /login requests for victim@example.com (rotating IPv6 addresses to also dodge the per-IP limit). Far more than 30 password guesses per window actually reach bcrypt, and while those hashes run the single production CPU is pinned, so real users' page loads, checkouts and webhooks stall or time out.

**Fix:** Increment and check the counters atomically before awaiting bcrypt (reserve a slot: bump rec.n/forEmail.n up front, reject when over the cap, and only decrement on a non-attempt), or gate concurrent in-flight bcrypt per email/IP with a small semaphore. Also cap the number of simultaneous bcrypt operations process-wide so a login burst cannot monopolise the CPU.

**Reviewer notes on the fix:** The finding's fix is correct and sufficient for the race; order it by impact for this single small machine: (1) Add a process-wide cap on concurrent bcrypt operations (a small semaphore, e.g. 2-4 in flight) so any login burst can never monopolise the one vCPU — this is the single most effective mitigation for the DoS and is independent of the race. (2) Reserve the throttle slot atomically before awaiting bcrypt: bump rec.n/forEmail.n up front (synchronously, before `await`), reject when over the cap, and decrement only on the no-op/success paths that shouldn't count. Because Node is single-threaded and the bump+check happen before any await, this closes the TOCTOU window completely. (3) Normalise src/ratelimit.js (and the auth.js throttle keys) to group IPv6 by /64 instead of the full /128, otherwise an attacker rotating addresses in a /64 still bypasses the per-IP 40 and 8 caps and reaches the semaphore/queue from "unlimited" sources. Doing only (2) fixes the race but leaves the IPv6-driven flood; doing (1)+(3) bounds CPU even under the race. All three together are the complete fix. Reserve the slot synchronously before the wait, and give it back on success:

```js
if (rec.n >= 8 || forEmail.n >= EMAIL_FAILURES) return 429 ...;
rec.n += 1; forEmail.n += 1;            // count the attempt before awaiting
const user = findByEmail.get(email);
const ok = await bcrypt.compare(password.slice(0, 200), user ? user.password_hash : DUMMY_HASH);
if (!ok || !user) return res.status(401).render(...);
forEmail.n = Math.max(0, forEmail.n - 1);
attempts.delete(`${req.ip}|${email}`);
```

That closes the race only. The CPU-load concern needs two independent fixes:
- In src/ratelimit.js (and the `${req.ip}|email` throttle key), key IPv6 clients by their /64 prefix.
- Add a small process-wide limit on bcrypt calls running at once (for example 4). Beyond that, reply 429/503 straight away instead of queueing, so floods with random emails and rotating addresses can't take over the single vCPU.

Optionally, set [http_service.concurrency] with a hard_limit in fly.toml.

### C4. Unbounded private work-order creation lets any unapproved tradie fill the single /data volume and take the site (and its backups) down

- **Severity:** medium (first reported as high)
- **Where:** `src/routes/work.js:275`
- **Area:** resource-exhaustion

POST /work creates a private work order with only requireRole('tradie') + requireCan('work.manage') + an existing (not necessarily approved or email-verified) profile. Unlike public job posting, which is deliberately capped at JOBS_PER_DAY=10 (src/routes/jobs.js:209) precisely to stop abuse, this route and the sibling write routes (/work/:id/notes, /work/:id/time, /work/:id/costs) have no rate limit and accept descriptions up to 5000 chars. On the single Fly machine the SQLite DB, its WAL, uploads, the forever-growing email log and 14 daily backups all share one 3GB /data volume, so once it fills, every write fails, the site goes down, AND src/backup.js can no longer write a backup. Reproduced locally from a brand-new tradie account whose profile was merely saved (status 'pending', email unverified): ~666 rows/sec, ~3.55 MB/sec of DB growth, which fills 3GB in roughly 14 minutes.

**How it goes wrong:** Someone creates a free tradie account (a valid ABN checksum is easy to generate), saves a profile so req.user.profile exists, and scripts POST /work with a 5KB description in a tight loop. Within about a quarter of an hour /data is full; customer job posts, photo uploads, payments and the daily backup all start failing, and recovery requires manually clearing rows/disk on the box.

**Fix:** Rate-limit the /work write routes the way job posting is limited (a per-account daily/hourly cap via src/ratelimit.js), and/or require an approved+verified tradie before private work orders and their notes/time/costs can be created. Add a cap on total work orders per account, and alert/guard on volume usage so a single account cannot exhaust shared disk.

**Reviewer notes on the fix:** Add a per-account cap keyed on req.account.ownerId with ratelimit.hit, not the IP-keyed limit() helper. Apply it to POST /work, /work/:id/time, /work/:id/costs and /work/:id/invoice, and add a daily count check on work_orders created per account, like JOBS_PER_DAY. Make the /work router gate require profile.status !== 'rejected'. Also consider requiring a verified email before private work orders can be created. Defensively, have backup.js check free space with fs.statfs before copying and delete the .tmp file on failure, and log a warning when /data usage passes a threshold. Drop /work/:id/notes from the fix list, since it is already limited. 1) Gate private work orders behind an approved profile, or cap them while the profile is pending: add requireApprovedTradie to POST /work, or allow e.g. 20 private work orders until the profile is approved.
2) Add per-ACCOUNT limits (not per-IP, because ratelimit.limit() keys on req.ip) using hit(`work-new|a${req.account.ownerId}`, 100, 60*60*1000) on POST /work, and similar per-account hits on /work/:id/time, /work/:id/costs and /work/:id/invoice. Also put a hard cap on child rows per work order (e.g. 500 time entries or costs) and per account (e.g. 5000 work orders), checked with a COUNT before insert.
3) Make backups safe in src/backup.js: before db.backup, check free space on the volume (fs.statfsSync(config.dataDir)) and skip with a loud log if it is under about 2x the DB size; wrap the backup in try/catch and fs.rmSync(`${file}.tmp`, {force:true}) on failure; widen the cleanup to remove stale *.tmp files.
4) Optionally, have the /healthz check (or a cron log line) warn when free space on /data drops below a threshold, so the owner can run `fly volumes extend` before writes start failing. Leave /work/:id/notes as it is; it is already limited by uploads.receive.

### C5. Password reset does not log out attacker-planted team-member logins, so an account takeover survives recovery

- **Severity:** medium (first reported as high)
- **Where:** `src/routes/auth.js:270`
- **Area:** authentication

Signup is open and logs the new user in at once (auth.js:166-193, logIn before any email verification), so an attacker can pre-register a victim's email and fully control that account. While in control, they invite a second address of their own as a 'manager' (a customer manager can post, accept and pay; a tradie manager can quote, work, handle money and edit the profile) and accept the invite. That creates a SEPARATE users row with its own password_hash and session_key that acts on the victim's account. When the victim later reclaims the account via /forgot -> /reset, the reset runs logOutEverywhere(req.reset.user_id) (auth.js:270). logOutEverywhere (middleware.js:75-77) only rotates the session_key of that ONE user id. The attacker's team-member row is untouched, so the attacker's cookie keeps working AND the attacker can log in again with their own password whenever they like. The comment at auth.js:269 ('Anyone else logged in to this account ... is logged out') is therefore false. The same gap applies to password change (dash.js:442) and 'log out of every other device' (dash.js:450).

**How it goes wrong:** The attacker signs up with victim@corp.com before the victim does, invites atk@evil.com as a 'manager', and accepts that invite in a second browser. The victim sees 'account already exists', does a password reset, and believes they now control the account alone. Measured: after the reset the attacker's owner session dies (302 -> /login), but the attacker's manager session stays logged in and GET /dashboard returns 200. The manager can still post jobs, accept quotes and release held Stripe payments on a customer account, or see payments and change the profile on a tradie account. The victim only regains sole control if they notice and remove the member on the Team page.

**Fix:** On password reset, password change and 'log out everywhere', rotate or revoke the sessions of every team member that acts on the account, not just the acting user. For example, in logOutEverywhere also rotate session_key for all users in team_members WHERE account_id = <ownerId> AND status='active' (for the owner), and have reset call that account-wide version. Also don't treat an unverified pre-registered account as fully usable: require email verification before an account can create team invites, so an attacker cannot add team logins to an email they don't own.

**Reviewer notes on the fix:** 1) Block the pre-hijack path. Require a verified email before an owner can send team invites (team.js:59, e.g. `if (!req.account.owner.email_verified_at)` flash and redirect). Also consider the same check for other lasting changes, such as Stripe payout connect.

2) In POST /reset/:token, read email_verified_at before calling markVerified. If the account was unverified until this reset, nobody had proven they owned the address, so in one transaction:
   - set team_members.status='removed' and token=NULL for every row with account_id = user.id;
   - set password_hash='!' and rotate session_key for each member user_id.
   This is the same thing team.js:95-107 does when an owner removes a member.

3) For an already-verified owner (the stolen-password case), don't log out legitimate staff silently. After a reset, send the owner to /team with a flash listing active members and pending invites, so they can review and remove anyone unexpected. Optionally offer a "remove all team logins" button.

4) Fix the comment at auth.js:269. Rotating members' session_key alone is not enough, because the attacker can log back in with the member's own password. Fix the root cause, not the reset.

1) In POST /team/invite (src/routes/team.js:59), refuse the invite when `!req.account.owner.email_verified_at`, with a message like "Confirm your email before adding a team." Consider the same gate on Stripe Connect payout onboarding for tradies, so a pre-registered account cannot attach an attacker's bank either.

2) In POST /reset/:token (src/routes/auth.js:260-270), read user.email_verified_at before markVerified. If it was NULL, the reset is the first real proof of ownership. In the same transaction, treat everything set up before then as untrusted:
- For every active team member, set status='removed', user_id=NULL, and set users.password_hash='!' and rotate the session key for each user_id. This mirrors POST /team/:id/remove, since rotating keys alone does not work: the member can log in again with their own password.
- Mark pending invites removed.
- Clear any two-step login the attacker set.
- Flash the owner a note that earlier team logins were removed.

3) After any reset or "log out everywhere", list current team members on the confirmation page so the owner can review them.

The finding's first suggestion (rotate every member's session_key on the owner's reset) is not enough. It is also a usability regression for real teams, where a password change by the owner would log out every employee.

## Not yet reviewed (most severe first)

**Review status (24 Oct 2026), money findings first.** Each was traced in the code; tests are in `test/money.test.js` and fail on the code before the fix. Not deployed yet.

- **U5: real, fixed.** A release or refund is written down (`payments.pending_action`) before it goes to Stripe. If Stripe errors, the opposite action first checks Stripe (transfers by transfer group, refunds by payment intent): if the money moved it's recorded and the opposite is refused; if not, it's allowed once 2 minutes have passed. Retrying the same action is safe. The admin gets an email when this happens.
- **U6: part real, part fixed.** Fixed: paying needs the tradie to still be approved with insurance in date, and a rejected tradie isn't paid out from the customer's Release button (admin release still works). **Open, owner to decide:** a minimum hold before release (e.g. 3 to 7 days, longer for new tradies), requiring a confirmed customer email before paying, and Stripe payout delays for new tradies. Contact details already shown to a tradie who is rejected later stay visible.
- **U21: real (only if bank debits are switched on in Stripe), fixed.** Checkout is card only, and a finished checkout whose payment then failed gets a new one; one still going through doesn't.
- **U22: real, not fixed: owner to decide.** A $20 quote on a $10k+ job unlocks the customer's contacts, and the fee cap of half the job overrides the advertised $15 minimum. Needs a pricing rule (minimum quote per budget band, a warning to the customer, or both).
- **U23: real, fixed.** The accept form carries a fingerprint of the price, message and start date, and accepting is refused if any changed.
- **U24: real, fixed.** Invites already needed a confirmed email (C5). Now the invite subject is fixed text, and names, company names and invitee names with phone numbers, emails or links are refused.

### U1. Two-step can be switched on without the password or a verified email, and a password reset can't remove it: squatted or hijacked accounts are locked to the attacker for good

- **Reported severity:** high
- **Where:** `src/routes/dash.js:356`
- **Area:** account-takeover

(Merges two reports with the same root cause: email pre-emption plus two-step, and session-based two-step enrollment.) GET /dashboard/account/two-step (dash.js:344-349) creates a pending TOTP secret for any logged-in session, and POST /dashboard/account/two-step/enable (dash.js:356-366, twostep.confirm) switches it on after one code from that secret. Neither step asks for the current password or a recent login, and neither requires the account's email to be verified. Sign-up never checks that the person owns the email (accounts.problem only checks the format and that it isn't taken) and logs them in at once. Enabling then calls logOutEverywhere and re-logs only the session that made the request, and the new backup codes are shown only to that session. Recovery fails: the password-reset POST branches on the account's CURRENT TOTP (`if (twostep.isOn(user)) return askForCode(...)`, auth.js:275-277), so a reset sets the new password but then needs the attacker's code. Admins have no screen to clear two-step and there is no 'lost authenticator, no backup codes' flow, so the lockout is permanent short of editing the DB. Turning two-step OFF needs password plus code (dash.js:384-385), but turning it ON needs neither. The reset and backup-codes routes (dash.js:368, 395) accept a code with only the per-IP codeLimit and no per-account cap, unlike /login/2step.

**How it would go wrong:** (a) Email pre-emption, reproduced locally: an attacker registers accounts@somebuilder.com.au (or a known tradie's or competitor's email) before that business joins, and enables two-step with their own phone on the still-unverified account. The business's later sign-up is refused ('already an account', which sign-up also discloses per the enumeration finding). Their /forgot + /reset succeeds (302 to /login/2step) and even sets email_verified_at, but the next step demands a six-digit code only the attacker holds, and /dashboard then redirects to /login. (b) Hijacked session, reproduced locally: a victim with no two-step (most accounts) stays logged in on a shared office PC at a hotel or mining customer, or their cookie is copied. The attacker uses that session to GET /dashboard/account/two-step, scans the key and POSTs /two-step/enable with a code. The victim's session redirects to /login, the attacker's keeps working (200), and after the victim does forgot-password and resets, they land on /login/2step and can't get past it. On a tradie account with no payouts set up yet, the attacker can also finish Stripe onboarding with their own bank. In both cases support has no in-product way to undo it.

**Suggested fix:** Ask for the current password (and the current code when two-step is already on) before starting or confirming setup in /two-step and /two-step/enable, and don't allow enrollment until the account's email is verified, so a reset by the proven email owner is always enough to regain access. Email the account when two-step is switched on. In the reset flow, if two-step was enabled while the email was unverified, let the completed reset disable it. Add an admin action, behind an identity check, to clear a user's two-step. Add a per-user failure counter (like the 2step|uid throttle) to /two-step/enable, /reset and /backup-codes.

### U2. Open redirect in safeNext via dot-segment next= parameter

- **Reported severity:** medium
- **Where:** `src/routes/auth.js:45`
- **Area:** open-redirect

safeNext (auth.js:41-51) guards against protocol-relative targets by rejecting values that start with '//' or contain backslashes or control characters. It then resolves the value with new URL(next, siteUrl) and returns u.pathname + u.search + u.hash. A value like '/.//evil.com' starts with '/.', so it passes the '//' check at line 42, and it contains no backslash or control character, so it passes line 43. new URL('/.//evil.com', 'https://trade-bench.com') normalizes the '.' segment to the pathname '//evil.com' and keeps the site's origin, so the origin check at line 46 passes and the function returns '//evil.com'. The route then calls res.redirect('//evil.com'), which the browser treats as a protocol-relative URL and follows to https://evil.com.

**How it would go wrong:** An attacker sends a victim a trusted-looking link, https://trade-bench.com/login?next=%2F.%2F%2Fevil.com (it also works on /signup and the reset flow). The hidden next field is rendered and posted back, and after a successful login the server responds 302 Location: //evil.com, so the browser lands on evil.com. Verified in-process (login and signup both send Location: //evil.com -> host evil.com), and confirmed that new URL() normalizes this way on the live Node runtime. This allows convincing credential phishing and post-login redirection from a trade-bench.com URL. The existing test (security.test.js:162) only covers '//evil.com', '/\evil.com', '/%5Cevil.com' and 'https://evil.com', none of which use dot segments.

**Suggested fix:** Check the final string again after building it, and reject it if it starts with '//' (or '/\'). Simplest: `const dest = u.pathname + u.search + u.hash; return dest.startsWith('//') ? '/dashboard' : dest;`. Or skip URL() entirely and only accept next values matching /^\/[^\/\\][^\x00-\x1f\x7f]*$/. Add a dot-segment case to the test.

### U3. "Two-step required for admins" protects nothing until enrollment: a password-only login can self-enroll an attacker's authenticator and reach /admin

- **Reported severity:** medium
- **Where:** `src/routes/admin.js:16`
- **Area:** auth-bypass

The admin area is gated by `if (!config.requireAdminTwoStep || req.user.totp_enabled_at) return next()` (admin.js:16), but the login flow only demands a code when `twostep.isOn(user)` is already true (auth.js:92). An admin or support account that has a password but has not yet set up TOTP therefore logs in with the password alone, is redirected to /dashboard/account/two-step, and can enroll a fresh secret from its own authenticator (dash.js:344-366) and gain full /admin access. So the 'admin accounts must use two-step' control gives zero protection against a stolen/known password during the window before the legitimate holder enrolls - which is exactly the threat two-step is meant to cover. This is the bootstrap gap in the two-step x admin x support-account interaction: support logins are created by invite (team.js) with a member-chosen password and no forced out-of-band enrollment, so each one carries this window.

**How it would go wrong:** A newly made owner admin (via make-admin.js) or a freshly invited support account has not yet opened /admin. An attacker who has the account's password logs in (no code is requested because none is enrolled), is sent to the two-step setup page, scans the QR with their own phone, confirms, and now holds an admin session protected by their own 2FA - defeating the production 'admins must use two-step' guarantee.

**Suggested fix:** Force second-factor enrollment through a path that proves control of the account before it is usable (e.g. require the enrollment to be confirmed from the same email-verified owner, or email a one-time enrollment link), and/or require email verification before an admin can enroll TOTP. Treat an admin account with no enrolled factor as not-yet-active rather than letting a password-only session reach the enrollment page.

### U4. Backup (recovery) codes are 40-bit and stored as unsalted single-round SHA-256

- **Reported severity:** medium
- **Where:** `src/twostep.js:171`
- **Area:** cryptography

newBackupCodes (twostep.js:169-172) makes each code with crypto.randomBytes(5).toString('hex'), which is 5 bytes or 40 bits of entropy. hashCode (twostep.js:119) stores each one as a single unsalted sha256('recovery:' + normalizedCode). A backup code fully replaces the second factor: twostep.check() accepts one instead of a TOTP code at /login/2step. TOTP secrets are AES-GCM sealed with a key derived from SESSION_SECRET (an env var, not in the DB), so a leak of the database alone leaves them safe. The recovery_codes hashes have no such key, cover only a 40-bit space and use a fast hash.

**How it would go wrong:** If the SQLite DB leaks without SESSION_SECRET (a volume snapshot, a backup file under /data/backups, or SQL injection reaching the table), an attacker can brute-force every recovery_codes.code_hash offline. 2^40 is about 1.1e12 candidates; at about 1e10 SHA-256 per second on a commodity GPU, that is a minute or two per code, and with no salt one search covers every user. Recovered codes let the attacker bypass the second factor for every 2FA user, including admins, whose accounts can move money and approve tradies, even though the TOTP secrets stayed encrypted.

**Suggested fix:** Raise code entropy to at least about 80 bits (e.g. crypto.randomBytes(10)), and protect the stored codes the way TOTP secrets are protected: seal them with the SESSION_SECRET-derived key, or at least use a slow, salted KDF (bcrypt/scrypt) per code instead of raw SHA-256, so a leak of the DB alone can't be cracked offline.

### U5. If the Stripe call errors after the transfer was made, the payment stays 'held' with nothing recorded, so a later refund also goes through (tradie paid AND customer refunded)

- **Reported severity:** medium
- **Where:** `src/payments.js:262`
- **Area:** payments-consistency

doRelease() calls stripe.transfers.create() and only writes to the DB afterwards (markReleased at line 276). Nothing is saved before the call: no 'releasing' state and no transfer id. If the call throws after Stripe has already made the transfer (a timeout, a dropped connection, or a 5xx after processing), the exclusive() lock is released and the row is still status='held', transfer_id=NULL. The idempotency key 'release-<id>' only protects a retry of the same release. The webhook does not handle transfer.* events, so the app never finds out. From then on, doRefund() (an admin refund, or the full auto-refund in markHeld) sees a normal held payment and refunds the customer, because a refund is a different operation that the idempotency key doesn't cover.

**How it would go wrong:** Confirmed with a mocked Stripe (throwaway harness, temp DATA_DIR). The customer clicks 'Job's done, release payment'. transfers.create creates tr_X for $185 at Stripe, but the client gets ETIMEDOUT, so the customer sees the 500 page and the payment stays 'held'. The admin sees a held payment and a customer complaining that the release 'failed', and presses Refund in /admin; refunds.create sends $200 back. Final DB state: status='refunded', transfer_id=NULL, refunded_cents=20000. Calls made: transfer 18500 (release-5) and refund 20000 (refund-5). The platform has paid out $185 and also refunded it, and nothing in the DB or the admin page shows the transfer.

**Suggested fix:** Record the intent atomically before calling Stripe, e.g. UPDATE payments SET status='releasing' WHERE id=? AND status='held'. Make doRefund (and refundedInStripe) refuse 'releasing'. On error, don't flip back to 'held' blindly: look up transfers by transfer_group or metadata.payment_id (stripe.transfers.list({transfer_group})) and either finish the release or roll it back. Handle transfer.created / transfer.reversed webhooks so the DB can be reconciled. Use the same pattern for refunds (a 'refunding' state).

### U6. Pay and release never re-check the tradie's approval and have no minimum hold: rejected tradies are paid and see customer contacts, and stolen cards can be cashed out

- **Reported severity:** medium
- **Where:** `src/routes/jobs.js:494`
- **Area:** fraud / access-control

The approval check exists only when a quote is accepted (jobs.js:441-445: 'the tradie must still be approved, with insurance that hasn't run out'). Nothing after that looks at the tradie's status again. POST /jobs/:id/pay (lines 460-469) starts checkout whatever tradie_profiles.status is. Once the job is paid, isAwardedTradie (line 293) and contactsVisible (line 347) show the customer's phone, email and full street address (job.ejs:173-176), and /work syncWon copies them into a work order (work.js:81-90). POST /jobs/:id/release (lines 480-507) only checks stripe_account_id and payouts_enabled (lines 494-499), then transfers the money. So the admin's 'reject' action (admin.js:162-178) does not stop a tradie it has just rejected, e.g. over fake insurance, and neither does a profile edit sending an approved tradie back to 'pending' (dashboard.js:181/190). The customer is never told the tradie is no longer approved. Separately, under separate charges and transfers the platform is the merchant of record and bears every chargeback, and for Express accounts it is also liable for negative balances. Yet the release route lets a transfer go out seconds after the charge succeeds: paid_at is never checked (no minimum hold), and the customer needn't have verified their email (an account is created on the fly in POST /jobs). The only self-dealing check is jobs.js:387, which compares account ids.

**How it would go wrong:** (a) Tested locally: a customer accepts Terry's quote, then the admin calls POST /admin/tradies/<terry>/reject, so the status becomes 'rejected'. The customer calls POST /jobs/1/pay, which returns 303 and sets the job to 'paid'. Terry's GET /jobs/1 now shows '1 Secret St' and casey@test.local. Terry sets up payouts, the customer calls POST /jobs/1/release, and the payment is 'released' to the rejected tradie. (b) A fraudster gets one tradie profile approved (ABNs are public, and the admin checks documents by hand). From a second browser they post a job as a new customer with no email verification, quote $20,000 from the tradie account, accept, and pay with a stolen card. They click release at once, and payments.js:262 transfers $19,200 to their Express account, which pays out on Stripe's normal rolling schedule. The real cardholder's chargeback lands weeks later. disputeClosed only emails the admin to 'reverse the transfer', which fails if the connected account has already been drained. The platform loses $20,400 plus the dispute fee, and rejecting the tradie in /admin during that time does not stop the release.

**Suggested fix:** In POST /jobs/:id/pay, POST /jobs/:id/release and payments.doRelease, load the accepted tradie's profile and refuse unless status === 'approved' (for pay, also require insurance not expired). Show the customer a notice instead of the Pay or Release button. Gate isAwardedTradie and contactsVisible on the tradie being approved, or at least on the job having been paid while they were approved. For admin release, add an explicit warning or confirmation. Enforce a minimum hold after paid_at (e.g. 3-7 days, longer for a tradie's first jobs or for customers with no verified email). Require email_verified_at on the customer before /pay. Consider setting the connected account's payout delay_days for new tradies and turning on Radar rules for high-value first payments.

### U7. Contact details are hidden until payment, but the free-text name and company fields shown before payment skip the contact-details check

- **Reported severity:** medium
- **Where:** `views/pages/job.ejs:41`
- **Area:** business logic / revenue leak

The site keeps the job on-platform by hiding phone, email and address until the money is held (job.ejs:42 `contactsVisible`). It runs hasContactDetails on titles, descriptions, quotes, bios, captions, reviews and replies. But job.ejs:41 shows the awarded tradie's user `name` to the customer, and job.ejs:171-172 show the customer's `name` and `company` to the awarded tradie, both while the job is still 'awarded' (unpaid). None of these fields are checked: POST /dashboard/account saves name and company with only oneLine (dash.js:412-420), the tradie profile saves the owner name unchecked (dashboard.js:150), and signup or post-a-job saves name and company unchecked (accounts.js:155-158).

**How it would go wrong:** Reproduced locally. An approved tradie renames themselves on /dashboard/account to 'Dan ring 0412 345 678 skip the fees'. A customer signs up with company 'Call me 0499 888 777'. As soon as the customer accepts the quote (job status 'awarded', nothing paid), the customer's job page shows the tradie's number and the tradie's job page shows the customer's number. They arrange the job off-site, the checkout is never used, and the platform earns neither the 4% (min $15) nor the 2% fee.

**Suggested fix:** Run hasContactDetails on name and company in accounts.problem, POST /dashboard/account, POST /dashboard/profile (owner name) and the invite form, and reject matches. Better still, show only the business name (already checked) and a first name before payment, and leave the customer's company out of the awarded tradie's pre-payment view.

### U8. Team invite links are not secret to the invitee: any free account can mint 'verified' logins for any email and permanently lock that address out

- **Reported severity:** medium
- **Where:** `src/routes/team.js:155`
- **Area:** access-control / email-verification

POST /team/invite (team.js:59-82) puts the token in the inviter's session, and the team page shows the full link to the owner (team.ejs:18 readonly 'Copy link' input, and team.ejs:49 for every pending invite). The owner can invite any email they like. POST /invite/:token (team.js:155-188) creates a login for invite.email for whoever submits the form, then calls verification.markVerified(userId, invite.email) (line 188) on the assumption that 'The invite link was emailed to this address, so opening it proves they get mail there', which is not true here. That (1) sets users.email_verified_at for an address nobody proved they own, defeating the verification signal used by verification.isVerified, the 'Verified'/'confirmed' badges and the admin and tradie confirmed-email checks. And (2) if the inviter then removes the member (team.js:95-108), the password is set to '!'. After that, auth.js:232 and :245 refuse password resets for '!' logins, and accounts.problem (accounts.js:31) and team.js:69/:175 refuse that email because a users row exists. The address can never be used for signup, reset or a new invite. Even without the removal step, the real owner of the address can only get in by resetting into a team login under the attacker's account, and can never own an account of their own.

**How it would go wrong:** Tested locally against a throwaway server. Mallory signs up free as a customer (signup on the live site is open: GET https://trade-bench.com/signup returns 200). She calls POST /team/invite {email: 'victim@test.local', role: 'staff'}, copies the /invite/<token> link from /team, opens it in a second browser and sets a password. The users row is created with email_verified_at set (confirmed: timestamp written). She then calls POST /team/<id>/remove. Result: the real victim's POST /signup returns 400 'There is already an account with that email', POST /forgot sends 0 emails, and logging in fails. With 20 invites per day per account and free signups (12 per hour per IP), an attacker can lock out a competing tradie's business address, or a hotel or mine procurement address, before they join. An operator can also mint accounts whose 'confirmed' addresses (e.g. ceo@bigcorp.example) they don't control.

**Suggested fix:** Make acceptance prove ownership of the inbox. Option 1: stop showing the raw invite URL to the inviter and deliver it only by email. Option 2: keep the copyable link, but don't call markVerified on acceptance; create the member with email_verified_at NULL, send a normal verification link to the address, and keep the login unusable until it is confirmed. Keep markVerified for flows where the link demonstrably went only to that address (e.g. password reset). When a member is removed and never verified their own email, delete the user row (or null out and rename its email) so the address is free again. Let signup and invites reclaim an address held only by a disabled ('!') team login that never verified.

### U9. Quadratic ReDoS in the AU-phone contact-detail regex stalls the single-CPU event loop

- **Reported severity:** medium
- **Where:** `src/helpers.js:99`
- **Area:** regex-dos

CONTACT_PATTERNS[0] (the Australian phone matcher) contains `(?:[\s.\-]*\d){8}(?!\d)` after an unanchored `0[\s.\-]*` branch. On a string of a digit followed by many separators it backtracks in polynomial (O(n^2)) time. Local timing of hasContactDetails on `'0' + '-'.repeat(n)`: n=1000: 2.1ms, n=2000: 6.6ms, n=4000: 46ms, n=5000: 116ms (cleanly quadratic). hasContactDetails runs synchronously on the request thread. It is reached with a 5000-character `description` in src/routes/jobs.js:208 (also the 3000-character quote message, and review and profile fields), so one call takes up to about 116ms. On the 512MB shared-cpu-1x Fly machine that blocks the whole event loop. The logged-in POST /jobs path (src/routes/jobs.js:171, guard `mayPost` at lines 166-169) has NO per-request rate limit, and the hasContactDetails check at line 208 runs BEFORE the JOBS_PER_DAY cap at line 209, so the regex runs on every request whatever the daily limit.

**How it would go wrong:** A logged-in customer submits POST /jobs with a valid address, budget and timing, and description = `0` followed by about 4999 `-` characters. Each request burns about 116ms of pure CPU before any job is saved, and the daily cap rejects it only after the regex has run. Looping about 9 requests per second from one logged-in session saturates the single CPU and stalls page rendering, logins and payments for everyone else; a handful of parallel loops makes the site unresponsive. The quote form (message, src/routes/jobs.js:382/401, 60 per hour) and profile and review fields are slower extra routes for the same attack.

**Suggested fix:** Replace the hand-written, backtracking-prone phone/email/URL regexes with linear-time matching: strip separator runs first (remove all `[\s.\-()]` before testing digit sequences), or bound the separator quantifier, e.g. `[\s.\-]{0,3}`. Also cap the text actually scanned (e.g. only the first 500 characters) or reject inputs with implausible digit-plus-separator density. Move the hasContactDetails check after the cheap validation and the daily cap, and add a per-request rate limit to the logged-in POST /jobs path (src/routes/jobs.js:166-171) to match the quote and forgot endpoints.

### U10. Free accounts can burn the platform's shared Stripe rate limit with no app-side throttle; double-clicking 'Set up payouts' makes duplicate Connect accounts

- **Reported severity:** medium
- **Where:** `src/routes/dashboard.js:238`
- **Area:** denial of service / race condition

Several routes make one or more Stripe API calls per request with no rate limit. GET and POST /dashboard/payouts/start (dashboard.js:236-238) call accountLinks.create, plus accounts.create the first time. GET /dashboard/payouts calls accounts.retrieve. GET /jobs/:id/paid?session_id=<anything> (jobs.js:473) calls checkout.sessions.retrieve for any string a job owner sends. Stripe limits requests per platform account (25 per second in the test mode the site uses now, 100 per second live), so one free account's requests eat the budget every customer's checkout and every release transfer also needs. Separately, onboardingLink checks `profile.stripe_account_id` from the start of the request (payments.js:51-52) and only then awaits accounts.create, with no in-flight lock like startCheckout has. Concurrent requests each create a new Express account, and the last one written wins in the DB.

**How it would go wrong:** An attacker signs up as a tradie and submits any profile with a checksum-valid ABN; approval isn't needed. They then loop GET /dashboard/payouts/start at about 30 requests per second, or a customer loops GET /jobs/<own job>/paid?session_id=x. Stripe starts returning 429 to the platform, so POST /jobs/:id/pay (checkout create) and /jobs/:id/release (transfers.create) fail with 500s for everyone while it runs. Separately, a real tradie who double-clicks 'Set up payouts' can get two Connect accounts: they finish onboarding on one while the DB stores the other, so payouts_enabled never turns on and customers see 'The tradie hasn't finished setting up payouts yet'.

**Suggested fix:** Add per-user rate limits (for example a few per minute) to /dashboard/payouts, /dashboard/payouts/start, /dashboard/payouts/stripe and /jobs/:id/paid. In /jobs/:id/paid, only call Stripe when session_id equals the payment's stored stripe_session_id. Give onboardingLink a per-user in-flight lock (like checkingOut), or create the account with an idempotencyKey such as `acct-${user.id}`, and re-read stripe_account_id after the lock.

### U11. The expired-insurance block clears itself: a tradie just types a new expiry date, with no re-check and no admin notice

- **Reported severity:** medium
- **Where:** `src/routes/dashboard.js:38`
- **Area:** business-logic

needsRecheck() only sends an approved tradie back to 'pending' when the new insurance_expiry is in the past: `(values.insurance_expiry !== before.insurance_expiry && (values.insurance_expiry || '') < today)`. Moving the date into the future (with the same insurer) leaves the status 'approved'. tradieSubmitted() only runs when `!before || before.status !== 'approved' || recheck` (line 192), so admins are never told. The quote gate at src/routes/jobs.js:391-392 even tells the tradie to do exactly this: "Update the expiry date in your business details to keep quoting." The public profile still says 'Insurance: Checked' (views/pages/tradie-profile.ejs:63), and every quote card says 'Insured' (views/pages/job.ejs:133). The accept-time check in jobs.js:442 trusts the same self-entered date.

**How it would go wrong:** Verified locally. An approved tradie's insurance_expiry was 2026-09-30, so their quote was blocked with 'insurance has expired'. They saved the profile with insurance_expiry=2027-09-30 and nothing else changed. The status stayed 'approved' and 0 admin_new_tradie emails were sent. The next quote was stored (status 'pending'), and /tradies/:id still showed 'Insurance: Checked'. An uninsured tradie can keep winning jobs while customers are told the cover was checked.

**Suggested fix:** Treat any change to insurance_expiry as needing review. Either set status='pending', or add an insurance_review flag that blocks quoting and accepting until an admin confirms the date (ideally against an uploaded certificate). Call notify.tradieSubmitted in this case. Until the new date is reviewed, don't show 'Insurance: Checked' or 'Insured'.

### U12. Jobs from unverified, brand-new accounts go straight out as job alerts and to IndexNow

- **Reported severity:** medium
- **Where:** `src/routes/jobs.js:249`
- **Area:** abuse / notifications

POST /jobs creates the customer account and the job in one request. It then calls notify.jobPosted(id) and indexnow.submit() for every job, even though the poster's email was only just sent a verification link and is unverified. jobPosted (src/notify.js:44-54) emails up to 300 matching approved tradies per job. The only limits are signupLimit (12 per hour per IP) and JOBS_PER_DAY=10 per account, and a new account's first post skips that check because customer_id is null at line 209. The email-verification system exists, but nothing about posting jobs depends on it. Every later quote also emails the unverified address (quote_received), which may belong to someone who never signed up.

**How it would go wrong:** Verified locally. A logged-out visitor posted a job using someone-else@example.com, which stayed email_verified_at = NULL, and the matching approved tradie got a new_job alert at once. An attacker rotating IPs can create 12 accounts an hour per IP, each posting 10 fake jobs a day, and each job emails every matching tradie. That fills tradies' inboxes with fake work and can use up the Resend sending quota, after which password-reset, verification and payment emails fail. A victim's address can also be used as the 'customer', so they get verification and quote emails.

**Suggested fix:** Hold alerts and IndexNow until the poster's email is verified. Record alerted_at on jobs. In the /verify-email handler, after verification.use() succeeds, call notify.jobPosted for that user's open jobs that haven't been alerted yet. Optionally keep unverified jobs off the public board, or limit unverified accounts to one live job.

### U13. Refunds and cancellations never email the awarded tradie, who was told 'You're good to go'

- **Reported severity:** medium
- **Where:** `src/notify.js:92`
- **Area:** notifications / job lifecycle

notify.refunded() only emails the customer. It is used by the admin refund (payments.js doRefund, lines 293-296), refunds made in the Stripe dashboard (refundedInStripe, lines 330-333) and the auto-refund, and each of these sets the job to 'cancelled'. The tradie already received paid_to_tradie ('The customer has paid. You're good to go.') and has the customer's contact details. They get no email saying the job is off and the money won't be released. The job page now returns 404 'closed by the customer' for them, and the work order only flips to 'cancelled' the next time they open /work (syncCancelled).

**How it would go wrong:** Verified locally with simulated payments. The customer pays (job 'paid') and the admin clicks Refund on /admin. The job becomes 'cancelled' and the payment 'refunded'. The customer's emails were [..., 'payment_receipt', 'refunded']; new emails to the tradie: []. The tradie, following the earlier 'start work' email, may buy materials or turn up on site for a job that will never pay out.

**Suggested fix:** In notify.refunded (or a new notify.jobCancelled), also email the accepted quote's tradie: say the payment was refunded, the job is cancelled, nothing will be released, and to stop any work and contact support if they've started. Add the matching template to emails.js.

### U14. Logged-out session cookies work again once their revocation row is pruned (the server never expires sessions)

- **Reported severity:** medium
- **Where:** `src/middleware.js:101`
- **Area:** session-management

Sessions are cookie-session cookies signed with SESSION_SECRET (server.js:89-98). The signed value has no timestamp, so the server never expires a session; the 30-day maxAge only tells the browser when to drop it. logOut() records the sid in revoked_sessions with `expires_at = now + 31 days`, and every later logout runs pruneRevoked (line 102), which deletes expired rows. After that, isRevoked() no longer matches and loadSession (line 55) accepts the old cookie again, because uid/sk still match unless the password was changed or 'log out everywhere' was used. Tested locally: signed up, copied the tb/tb.sig cookies, logged out (replay -> 302 /login), set the revocation row's expires_at to the past, had another user log out (which prunes), and replaying the copied cookie returned 200 with the victim's dashboard.

**How it would go wrong:** An attacker gets a victim's cookie once (a shared or borrowed computer, browser sync, malware, a log). The victim notices and clicks Log out, believing the copy is now useless. 31 days later anyone's logout prunes the revocation row, and the copied cookie signs the attacker in as the victim again, with full account access (jobs, payments, customer contact details), with no further compromise needed.

**Suggested fix:** Put an issued-at time in the session at logIn, and in loadSession reject sessions older than a fixed lifetime (e.g. 30 days absolute, plus an idle timeout). Only prune revoked_sessions rows once a cookie with that sid would be rejected anyway, i.e. keep each row at least as long as the server-enforced lifetime. Or store sessions on the server.

### U15. Every per-IP rate limit is per IPv6 address (/128), and the live site is reachable over IPv6

- **Reported severity:** medium
- **Where:** `src/ratelimit.js:32`
- **Area:** rate-limiting

limit() keys buckets on `${name}|${req.ip}`. The login throttle (src/routes/auth.js:66, `${req.ip}|${email}`), forgot (auth.js:224) and anonymous uploads (src/uploads.js:202) also key on the full req.ip. trade-bench.com has an AAAA record (2a09:8280:1::1c0:276e:0, Fly dedicated IPv6), so IPv6 clients reach the app and req.ip is their full 128-bit address. Ordinary VPS and home connections get a /64, which is 2^64 source addresses, so every limiter (login 40/15min, signup 12/hour, forgot 10/hour, invite 20/hour, upload 20/10min) can be bypassed by changing the source address for each request.

**How it would go wrong:** From one IPv6 VPS the attacker binds a new address in its /64 for each request. That gives unlimited sign-ups, each logged in and able to post 10 jobs a day; every job emails up to 300 matching tradies through Resend and stores up to 6 photos on the 3GB volume. Password guessing across many accounts is no longer limited per IP. The memory and upload-slot attacks in the other findings need only a single machine.

**Suggested fix:** Normalise the key before using it: for IPv6 use the /64 prefix (e.g. `req.ip.includes(':') ? first four hextets + '::/64' : req.ip`), and unwrap ::ffff: IPv4-mapped addresses. Use the same helper in ratelimit.js, auth.js and uploads.js. Add a site-wide limit on sign-ups and job posts per hour (with an admin alert) so rotating addresses can't flood email or disk.

### U16. The email log keeps full bodies forever, plus 14 full backups on the same 3GB volume: unbounded disk growth and retention the privacy page doesn't cover

- **Reported severity:** medium
- **Where:** `src/mailer.js:119`
- **Area:** privacy/availability

Every email is inserted into the `emails` table with its full text body (src/db.js:233-244): job descriptions, quote messages, customer and tradie names, payment amounts, admin review emails with the tradie's name, email, ABN, licence and insurer, and unsubscribe tokens. Only reset, invite and verify links are blanked. Nothing ever deletes from `emails` (the only DELETE statements in src are for revoked_sessions, tradie_photos, stripe_events, time/cost entries and recovery codes). src/backup.js keeps 14 full daily copies of the database on the same /data volume (3GB per fly.toml), so each byte in the DB uses about 15 bytes of volume. Rows are keyed by address, not user id, so they also survive account closure. Job and work-note photos have no storage quota either (10 jobs a day x 6 photos per account; work-note photos are only limited to 20 uploads per 10 minutes per account).

**How it would go wrong:** Normal use (each job alert goes to up to 300 tradies at about 1-2KB each), or deliberate job and sign-up spam using the IPv6 rate-limit bypass, steadily grows `emails` and the uploads folder. Fifteen copies of the database plus the photos fill the 3GB volume. SQLite writes then fail with SQLITE_FULL: Stripe webhooks can't record payments as held, jobs and quotes can't be saved, and backups stop. Separately, personal details of people who closed their accounts stay in the email log and in every backup, while privacy.ejs:28 promises data is kept only while needed.

**Suggested fix:** Store only metadata (to, kind, subject, status), or delete body_text after e.g. 30 days with an hourly prune in reminders.js. Delete or anonymise emails rows when an account is closed. Keep backups on separate storage (or keep fewer, compressed copies), and alert when the volume passes e.g. 70%. Add per-account storage limits for uploads.

### U17. Sign-up (and team invites) reveal which emails already have an account, undoing the anti-enumeration work on login and forgot

- **Reported severity:** low
- **Where:** `src/accounts.js:31`
- **Area:** account-enumeration

The login and forgot-password flows are deliberately built not to reveal whether an email has an account (DUMMY_HASH timing equalisation at auth.js:31-33, identical responses at auth.js:237-238, and forgot always renders sent:true). Two other endpoints give a distinct answer when an email exists. accounts.problem() returns TAKEN ('There is already an account with that email. Try logging in.', accounts.js:13/31) once the name, email format and password length pass. POST /signup (src/routes/auth.js:179-190) and POST /jobs for visitors (src/routes/jobs.js:217/240) show it unchanged, with no login needed. /team/invite returns 'That email already has its own Tradebench account.' (team.js:69); it needs a logged-in account, but any free user can probe any email.

**How it would go wrong:** An attacker scripts POST /signup with a target list of emails and any 8-character password, and reads the 'already an account' message to confirm which addresses (e.g. a property manager or mine-site contact) are registered Tradebench users. That is 12 tries per IP per hour, unlimited with rotating IPs or IPv6 rotation, plus more through /team/invite from a free account. It gives a valid-user list for phishing ('your Tradebench payment is held...') and credential stuffing, which the login and forgot endpoints were specifically hardened to prevent.

**Suggested fix:** Make sign-up give the same answer either way, the way /forgot does: for an existing email, show the normal 'check your email to confirm' screen and email the owner a 'someone tried to sign up with your address, log in or reset here' notice instead of saying the account exists. Do the same in the job-posting flow. For team invites, avoid confirming that an account exists anywhere on the site, or limit the check to the owner's own account.

### U18. Webhook refund/dispute handlers skip the exclusive lock and markReleased doesn't re-check, so a release can complete on a disputed or refunded payment and still report success

- **Reported severity:** low
- **Where:** `src/payments.js:276`
- **Area:** race-condition

exclusive() (line 232) only serialises release() against refund(). refundedInStripe() (line 325) and disputeOpened() (line 307) run from the webhook with no lock. doRelease checks disputed and refunded_cents once at the start (lines 253-256), then awaits transfers.create. markReleased (lines 30-32) only requires status='held'; it doesn't check disputed=0 or refunded_cents IS NULL/0. When it changes 0 rows (line 276), nothing is logged, no alert is sent, the caller isn't told, and the transfer id is thrown away.

**How it would go wrong:** Confirmed with a mocked Stripe. (a) While the transfer call is in flight, a charge.refunded webhook for a full refund made in the Stripe dashboard arrives. refundedInStripe marks the payment 'refunded' and cancels the job. The transfer then succeeds, markReleased changes 0 rows, release() resolves without error, and the customer sees the flash 'Payment released'. Result: a $185 transfer made, $204 refunded, status='refunded', transfer_id=NULL, no admin alert. (b) While the transfer call is in flight, charge.dispute.created arrives. The result is status='released', disputed=1, so money goes to the tradie on a charge already under chargeback. Both need the webhook to arrive within the roughly 1s of the transfer call. That is unlikely but possible: the admin is told to settle partial refunds in the Stripe dashboard, and disputes arrive on their own schedule.

**Suggested fix:** Add the guards to the UPDATE: markReleased ... WHERE id=? AND status='held' AND disputed=0 AND COALESCE(refunded_cents,0)=0. If it changes 0 rows after a successful transfer, call stripe.transfers.createReversal(transferId), or at least notify.adminAlert with the transfer id, and throw so the user isn't told it worked. Better still, use the 'releasing' state from the release-error finding so the webhook handlers can see that a release is in progress.

### U19. An inquiry (dispute status 'warning_closed') is treated as a lost chargeback and freezes the payout for good, with no in-app way to clear it

- **Reported severity:** low
- **Where:** `src/payments.js:317`
- **Area:** payments-logic

disputeOpened sets disputed=1 for every charge.dispute.created, and Stripe sends that event for inquiries and retrievals too (status warning_needs_response). disputeClosed only clears the flag when status === 'won'. Every other status, including 'warning_closed' (an inquiry closed with no chargeback and no money taken), goes to the else branch. That branch tells the admin the bank 'has taken the money back' and leaves disputed=1. Both release paths then refuse for good: jobs.js:484, admin.js:188 and doRelease at payments.js:253. Nothing in the app ever resets disputed.

**How it would go wrong:** Confirmed with a mocked Stripe. disputeOpened({charge}) followed by disputeClosed({status:'warning_closed'}) leaves {status:'held', disputed:1}, and release() throws 'This payment is under a card dispute...'. A customer only has to query the charge with their bank. The tradie then can't be paid through the platform, the admin gets a false 'money taken back' alert, and the only options are a refund or editing the DB by hand.

**Suggested fix:** In disputeClosed, clear disputed for 'won' and 'warning_closed', and only treat 'lost' as funds withdrawn. Word the alert to match each status. Better still, record dispute.status in a column so the admin page can show it and an owner-level admin can clear the flag.

### U20. confirmCheckoutSession marks a payment held without checking whether the charge was already refunded or disputed; earlier refund and dispute events for it were dropped

- **Reported severity:** low
- **Where:** `src/payments.js:209`
- **Area:** webhook-ordering

refundedInStripe and disputeOpened find the payment through stripe_charge_id / stripe_payment_intent (paymentForStripe, line 303), and only markHeld fills those columns in. If charge.refunded or charge.dispute.created is handled before the payment is confirmed, the handler finds no row and returns normally. The event is stored as handled in stripe_events, so Stripe's retries are ignored. When checkout.session.completed is processed later (a webhook retry after an earlier failure, the /jobs/:id/paid redirect, or a second click on Pay through doStartCheckout's 'complete' branch), markHeld runs after checking only session.payment_status. It never looks at the PaymentIntent's charge (amount_refunded / disputed), so the payment becomes 'held' with refunded_cents=NULL and disputed=0.

**How it would go wrong:** The checkout.session.completed webhook fails (a Stripe API hiccup, so it waits hours for Stripe's retry). The customer tells support 'I paid but it still says Pay now', and the admin refunds the charge in the Stripe dashboard. charge.refunded arrives, matches no payment, and is dropped. The customer then clicks Pay again, and the 'complete' branch confirms the session. The job becomes 'paid', contact details are revealed, and the customer (or a colluding pair) can release $185 to the tradie for money that has already been returned.

**Suggested fix:** In confirmCheckoutSession, retrieve the charge (expand latest_charge) and either refuse to mark the payment held, or mark it held with refunded_cents and disputed set from charge.amount_refunded and charge.disputed, so the existing release guards apply. In the refund and dispute webhook handlers, when no row matches, fall back to looking up the payment by the PaymentIntent's metadata.payment_id instead of dropping the event.

### U21. After a failed async payment the job can never be paid again: startCheckout keeps returning '?paid=1' and never makes a new session

- **Reported severity:** low
- **Where:** `src/payments.js:118`
- **Area:** payments-logic

Sessions are created without payment_method_types, so whatever the Stripe dashboard enables is offered, which can include async methods such as BECS Direct Debit for AUD. With an async method the session becomes status='complete' with payment_status='unpaid'. If the debit later fails (checkout.session.async_payment_failed, which webhook.js doesn't handle), the session stays 'complete'. Every later Pay click takes the existing.status === 'complete' branch: confirmCheckoutSession returns false, the code returns `/jobs/${id}?paid=1`, and no new session is ever created. The stored stripe_session_id is never cleared.

**How it would go wrong:** Confirmed with a mocked Stripe: with the stored session at {status:'complete', payment_status:'unpaid'}, two startCheckout calls both return '/jobs/4?paid=1', 0 sessions are created, and the payment stays 'pending'. The customer sees 'Pay by card', clicks it, and is sent back to the job page every time. The job is stuck 'awarded' until they cancel and post it again. This only applies if an async method is enabled in the Stripe account.

**Suggested fix:** In doStartCheckout's 'complete' branch, only return the paid URL when existing.payment_status is 'paid' or the PaymentIntent is processing. If the PaymentIntent has failed (requires_payment_method / canceled), fall through and create a new session. Handle checkout.session.async_payment_failed in webhook.js by clearing stripe_session_id. Or pin payment_method_types: ['card'] if async methods aren't wanted.

### U22. A $20 'deposit' quote buys the customer's phone, email and full address while the real job is paid off-site

- **Reported severity:** low
- **Where:** `src/routes/jobs.js:32`
- **Area:** business logic / revenue leak

Quotes only have to be at least MIN_QUOTE_CENTS = $20 (jobs.js:32, :395), whatever the job's budget. feeFor caps the fee at half the job (helpers.js:22), which overrides the $15 minimum the live site advertises. Once any accepted quote is paid, the tradie gets the customer's phone, email and street address (job.ejs:174-176, plus the work order copy in work.js:81-90).

**How it would go wrong:** Reproduced locally. A customer posts 'Retile whole bathroom' with a $10k-$50k budget. The tradie quotes $20 with the message 'Booking deposit to lock in a site visit, balance arranged on site', which passes the contact-details filter. The customer accepts and pays $20.40. The payment is held with fee_cents=1000, and the tradie's job page now shows the customer's email and address. The rest of a $15,000 job is paid in cash. The platform keeps $10.40 instead of about $900 (4% plus 2%).

**Suggested fix:** Tie the minimum quote to the job's budget band (for example at least the bottom of the band, or a share of it). Or warn the customer when a quote is far below the budget they gave, and don't let the half-the-job cap push the fee below the advertised minimum.

### U23. Accepting a quote only pins the price: the tradie can rewrite what's included after the customer has read it

- **Reported severity:** low
- **Where:** `src/routes/jobs.js:436`
- **Area:** race condition / TOCTOU

POST /jobs/:id/quotes with an existing pending quote replaces message and start_date in place (ON CONFLICT DO UPDATE, jobs.js:76-80). POST /quotes/:id/accept only checks that amount_cents matches what the customer's page showed (jobs.js:436). The scope text the customer read is not part of the check, even though the comment says the point is that the quote 'must still be the one the customer was looking at'.

**How it would go wrong:** Reproduced locally. The tradie quotes $845 with 'all materials included, 5 year warranty', and the customer opens the job page. The tradie then re-sends $845 as 'Labour only. Materials extra, no warranty.' The customer clicks Accept on the open tab (hidden amount_cents=84500) and it goes through: the accepted quote stored is the labour-only one.

**Suggested fix:** Put a quote version (for example updated_at, or a hash of amount, message and start_date) in the accept form and refuse the accept if it changed, the same way the amount is checked now.

### U24. Team invites let any new, unverified account send Tradebench-branded email with a subject it writes to any address

- **Reported severity:** low
- **Where:** `src/emails.js:241`
- **Area:** abuse / email spoofing

Any customer owner can POST /team/invite (team.js:59; requireCan('team') only, no verified email needed). The email goes from the site's verified domain to any address. Its subject is `${businessName} has added you on Tradebench` (emails.js:241), and its heading and body use the same name. businessName is the customer's free-text company or name (team.js:135), which is never checked for URLs or phone numbers. Each new signup also sends a verification email that starts 'Hi <attacker-chosen name>'.

**How it would go wrong:** An attacker signs up (12 per hour per IP, more over IPv6), sets company to 'URGENT: your Tradebench payout is on hold, call 1300 123 456 or visit tb-support.com', and invites 20 addresses a day per account. Recipients get mail from hello@trade-bench.com with valid DKIM whose subject starts with that text. Spam complaints count against the Resend account the site needs for password resets and payment notices.

**Suggested fix:** Require a verified email before /team/invite, run hasContactDetails on company, name and invite name, and keep user-supplied text out of the subject line (for example a fixed subject 'You've been invited to a team on Tradebench').

### U25. Managers can't change the bank details on invoices, but can print their own under 'How to pay' through the notes field

- **Reported severity:** low
- **Where:** `src/routes/work.js:507`
- **Area:** authorization bypass

POST /work/settings deliberately lets only the owner change payment_details, 'so a manager can't redirect customer payments to their own account' (work.js:311-315). But managers have the 'money' permission and can create invoices with free-text `notes` (work.js:474, 507). invoice.ejs:61-64 prints those notes directly under the owner's 'How to pay' block, with nothing in between.

**How it would go wrong:** A tradie business manager creates an invoice for a private job with notes 'Our bank has changed: please pay BSB 062-000 Acc 1234 5678 (J Smith) instead of the account above', then marks it sent. The client pays the invoice the site generated into the manager's account, which is the exact case the payment_details protection was written to stop.

**Suggested fix:** Only let owners (the 'payouts' permission) set invoice notes, or run a bank-details pattern check (BSB, account number, PayID) on notes from non-owners. Also print notes in a separate section, not right under 'How to pay'.

### U26. The earnings CSV and page show a 'Paid to you' amount and payout date for refunded and still-held payments, using UTC dates

- **Reported severity:** low
- **Where:** `src/routes/dash.js:241`
- **Area:** financial-reporting / dates

q.payouts (dash.js:46-49) includes payments with status 'held', 'released' and 'refunded'. The accountant CSV (dash.js:238-242) writes amount_cents - fee_cents into 'Paid to you' and a Fee for every row, and for held and refunded rows uses paid_at (the customer's card payment date) as 'Date paid out'. Only the last 'Status' column shows that nothing was paid out. The earnings page table (views/pages/dash-earnings.ejs:42) also shows the bold 'You get' amount on refunded rows. 'Date paid out' is `(p.released_at || p.paid_at).slice(0, 10)`, a UTC date, while the earnings page shows the same row in Perth time with shortDate(). Other date rules also use UTC 'today' or UTC months: the insurance-expiry checks (jobs.js:385 and 442, dashboard.js:31) allow 8 extra hours after a Perth expiry date, and tradieMoney.this_month and the monthly chart (dash.js:42 and 51) use UTC month boundaries.

**How it would go wrong:** Verified locally. A tradie has $10,000 released and a $5,000 job that was refunded; the CSV 'Paid to you' column adds up to $14,400 instead of $9,600, with dates for both. A refunded $850 job appears as '850.00,34.00,816.00,refunded'. Jobs still held at the end of the financial year show up the same way. A release at 2026-07-01 04:30 Perth (stored as '2026-06-30 20:30:00') appears in the CSV as 2026-06-30, the previous Australian financial year, while the page says '1 July 2026'. An accountant adding up 'Paid to you' for the BAS or tax return over-reports the tradie's income, possibly in the wrong year.

**Suggested fix:** Only put a fee, 'Paid to you' amount and payout date on released rows: write 0.00 and an empty date for 'held' and 'refunded' rows, or limit the CSV to status = 'released' and export held and refunded rows in a separate, clearly labelled section. Do the same on the earnings page. Format CSV dates in Australia/Perth (Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Perth' })). Use Perth dates for the insurance checks (reuse work.js perthToday), and shift by +8 hours in the SQL month buckets.

### U27. A worker can move any assigned work order, including cancelled, invoiced or paid ones, back to in_progress or done

- **Reported severity:** low
- **Where:** `src/routes/work.js:379`
- **Area:** access-control / missing state check

POST /work/:id/status lets non-managers set 'in_progress' or 'done' (line 381) and writes it with q.setStatus (line 383). It never checks the order's current status. The UI only offers these buttons while the job is new, scheduled or in progress (work-job.ejs:18), but the server allows the change from any status. A worker can therefore reopen a job the manager cancelled, or flip an invoiced or paid job back to 'done' or 'in_progress'. That breaks the manager's lists (the Done and Active filters at work.js:102-103) and goes against the rule that invoice status drives the work status (work.js:549).

**How it would go wrong:** Tested locally. The owner creates a private work order assigned to worker Wally, then cancels it. Wally sends POST /work/<id>/status with status=in_progress, and the order's status becomes 'in_progress'. A paid order can be flipped to 'done' the same way, and it then shows as unpaid work.

**Suggested fix:** For non-managers, only allow the change when req.work.status is one of ACTIVE ('new', 'scheduled', 'in_progress'), and only to the next state: new or scheduled to in_progress, and in_progress to done. Reject everything else with a 403 or a flash message.

### U28. Closing an awarded job sends no notice, and the winner's quote is relabelled 'Not chosen'

- **Reported severity:** low
- **Where:** `src/routes/jobs.js:86`
- **Area:** job lifecycle

POST /jobs/:id/cancel (lines 356-371) runs declineAll, `UPDATE quotes SET status='declined' WHERE job_id=? AND status IN ('pending','accepted')`, and sends no notifications. The winning tradie was told 'You won the job, wait for payment', and tradies with pending quotes aren't told either. Because the accepted quote is now 'declined', quoteState() in src/routes/dashboard.js:103-113 returns 'Not chosen' instead of 'Job cancelled' (the 'cancelled' branch only runs for status 'accepted').

**How it would go wrong:** Verified locally. The customer accepts Terry's quote (job 'awarded'), then clicks 'Close this job'. New emails to Terry: []. Terry's /dashboard/quotes shows the job as 'Not chosen', so it looks like the customer picked someone else, and Terry keeps waiting for a payment email that never comes.

**Suggested fix:** On cancel, decline only 'pending' quotes and leave the accepted one, so the dashboard shows 'Job cancelled'; or check job_status === 'cancelled' before the 'declined' branch in quoteState. Email the accepted tradie, and optionally the pending quoters, when a customer closes the job (this can share a notify.jobCancelled with the refund case).

### U29. Payment-release reminders ignore the 'Job alerts and reminders' opt-out and can arrive in pairs

- **Reported severity:** low
- **Where:** `src/reminders.js:218`
- **Area:** reminders

Unlike quotes_waiting (line 214), the release_7 and release_14 loop (lines 218-225) never checks customer.email_alerts. The account setting (views/pages/dash-account.ejs:14) tells customers the toggle covers 'Nudges when quotes are waiting or a payment needs releasing'. Also, q.held.all('-7 days') returns payments held 14 or more days too. When neither reminder has gone out (after downtime, or for payments already 14+ days old when this runs), both are sent in the same run.

**How it would go wrong:** Verified locally. A customer unticks alerts (email_alerts=0), and their payment has been held for 15 days. reminders.run() sent that customer 2 'Is the job done?' emails in one run.

**Suggested fix:** Add `if (!customer.email_alerts) continue;` to the release loop, or change the settings text if these reminders are meant to be transactional. Send only the latest reminder that applies: skip release_7 when the payment is 14 or more days old, or mark release_7 as sent when release_14 goes out.

### U30. 'Verified' badge (and 'Insured') shown on quotes from rejected or pending tradies

- **Reported severity:** low
- **Where:** `src/routes/jobs.js:67`
- **Area:** verification / trust

quotesForJob sets tradie_verified from u.email_verified_at alone. views/pages/job.ejs:129 shows the green 'Verified' tag from that value, and line 133 always prints 'Insured'. verification.isVerified() defines Verified as a confirmed email plus an approved tradie, but nothing calls it. Quotes stay listed after an admin rejects a tradie or a profile change sends them back to 'pending', and the accept route (line 442) then refuses them.

**How it would go wrong:** Verified locally. The customer's job page showed 2 'Verified' badges. After the admin rejected Terry, the page still showed 2 'Verified' badges, including Terry's. Terry's quote is still listed, but trying to accept it gives 'That tradie can't take new jobs right now'. Customers see a trust badge for a business the platform has just rejected.

**Suggested fix:** Select p.status in quotesForJob and show the badge only when verification.isVerified(user, profile) is true (email confirmed and status 'approved'). Hide or grey out quotes from non-approved tradies. Show 'Insured' only when insurance_expiry is today (Perth) or later.

### U31. A rejected tradie who re-saves their details (as the rejection email says) stays 'rejected', and each save emails all admins

- **Reported severity:** low
- **Where:** `src/routes/dashboard.js:182`
- **Area:** approval workflow

The upsert in POST /dashboard/profile never changes status, and needsRecheck() only handles before.status === 'approved'. A rejected tradie who follows the email ('Check your details and save them again') keeps status 'rejected' and the red 'We couldn't approve your details' notice. The admin list sorts pending first, so the resubmission sits among the rejected rows. tradieSubmitted() (line 192) emails every owner admin on every save by a pending or rejected tradie, with no rate limit.

**How it would go wrong:** Verified locally. The admin rejected Terry. Terry changed the insurer and saved, and the status was still 'rejected'. Each further save sends another 'New tradie to check' email to all admins.

**Suggested fix:** When before.status === 'rejected', set status back to 'pending' on save so the profile rejoins the review queue. Throttle tradieSubmitted, e.g. to once per profile per day.

### U32. An accepted but unpaid job stays 'awarded' forever: no reminder, no expiry, and the tradie can't withdraw

- **Reported severity:** low
- **Where:** `src/routes/jobs.js:81`
- **Area:** job lifecycle / revenue

withdrawQuote only works on status 'pending', so once a quote is accepted the tradie can't back out. Accepting declines every other quote, and there is no path back to 'open'. src/reminders.js has no query for awarded jobs (quotesWaiting needs j.status='open'), so a customer who accepts but never pays is never nudged. That missed payment is the point where the platform earns its fee.

**How it would go wrong:** Verified locally. The customer accepts Terry's quote and doesn't pay. Terry's POST /quotes/:id/withdraw leaves the quote 'accepted' and the job 'awarded'. With the job backdated 40 days, reminders.run() sent 0 reminders. Terry sees 'Won, awaiting payment' forever, the other tradies were declined, and the platform gets no fee.

**Suggested fix:** Remind the customer 1-2 days after acceptance without payment, and alert the admin after about 7 days. Let the tradie release themselves from an awarded, unpaid job (job back to 'open', customer notified), or expire the award after N days.

### U33. Quoting only checks trade: a tradie's areas and sectors (including mining) are never enforced

- **Reported severity:** low
- **Where:** `src/routes/jobs.js:389`
- **Area:** quoting rules

POST /jobs/:id/quotes checks that the job's trade is in profile.trades, plus insurance, minimum and cap. It never compares job.region with profile.regions or job.sector with profile.sectors. Alerts and the dashboard filter on all three, but anyone who opens /jobs can quote on any job. Sectors and tickets can also be changed without a re-check (needsRecheck ignores them), and the mining page promises 'get quotes from tradies who already hold the tickets'. This may be intended, but nothing tells the customer that a quote comes from outside the tradie's declared coverage.

**How it would go wrong:** Verified locally. A tradie covering only 'pilbara' and 'housing' quoted on a Bayswater (north-east) job, and the quote was stored as 'pending'. The same works for a housing-only tradie quoting on a mining-site job with induction requirements, and the quote card doesn't show it.

**Suggested fix:** Either reject quotes when job.region isn't in profile.regions or job.sector isn't in profile.sectors (at least for mining), or label the quote card 'Outside their usual area' or 'No mining work listed' so the customer can judge.

### U34. Dates are checked by regex only: impossible dates are stored, and /work/schedule?week=2026-13-01 returns 500

- **Reported severity:** low
- **Where:** `src/routes/work.js:234`
- **Area:** input validation / 500

isDate (line 56) is just /^\d{4}-\d{2}-\d{2}$/. mondayOf() and addDays() call toISOString() on an Invalid Date, which throws a RangeError and returns a 500. The same regex-only check lets '2026-99-99' into work-order scheduled_date, time entries, invoice issued_on and due_on, and quote start_date (jobs.js:383). The quote then shows the customer 'Can start Invalid Date'.

**How it would go wrong:** Verified locally. A logged-in tradie opening /work/schedule?week=2026-13-01 got a 500 (RangeError: Invalid time value at addDays, work.js:47). A quote with start_date=2026-99-99 was stored as-is.

**Suggested fix:** Use a real calendar check, like isRealDate in dashboard.js:26, for every date input: week, scheduled_date, work_date, issued_on, due_on and start_date. Fall back to perthToday() or null when the date is invalid.

### U35. Privacy page leaves out third parties and cookies the site actually uses

- **Reported severity:** low
- **Where:** `views/pages/privacy.ejs:24`
- **Area:** privacy

The page lists only Stripe and the hosting provider as recipients (line 24) and says 'We use one cookie to keep you logged in' (line 34). In fact, every page loads fonts from fonts.googleapis.com / fonts.gstatic.com (views/partials/head.ejs:53-55), which sends each visitor's IP address to Google. Every email, with names, job details and amounts, goes to Resend (src/mailer.js:74-85). Two cookies (tb and tb.sig) holding a CSRF token are set for every visitor, including logged-out ones (confirmed on the live site: GET / sets both). Plausible is also loaded when PLAUSIBLE_DOMAIN is set (head.ejs:57). The page also says passwords are 'stored encrypted' when they are hashed. It doesn't say how long the email log and backups are kept (see the email-retention finding).

**How it would go wrong:** An Australian Privacy Principles (APP 1/5) complaint or OAIC review compares the notice with what the site does and finds undisclosed overseas recipients (Google Fonts, and Resend in the US) and a cookie statement that doesn't match what is set. For a site that says it handles data under the APPs, that is a compliance gap that could be found.

**Suggested fix:** Self-host the Archivo font (and drop fonts.googleapis.com/gstatic from the CSP), or name Google Fonts in the policy. List Resend (and Plausible, if enabled) as service providers and say where data goes overseas. Describe the session/CSRF cookies accurately, say passwords are hashed, and say how long the email log and backups are kept.

### U36. Every restart logs out all users who signed up since the last restart

- **Reported severity:** low
- **Where:** `src/db.js:222`
- **Area:** session-management

New users are inserted without a session_key (src/accounts.js:10/41, team.js insertUser), so logIn stores `sk: null` in the cookie (confirmed locally: the cookie contained "sk":null). At startup, db.js:222 runs `UPDATE users SET session_key = lower(hex(randomblob(16))) WHERE session_key IS NULL`. After any deploy or restart (including the OOM restarts in the memory finding), loadSession's `req.session.sk !== req.user.session_key` check then fails for all of them, and they are logged out.

**How it would go wrong:** Customers who signed up while posting a job are logged out after each deploy, mid-checkout or between accepting a quote and paying, which hurts conversion. An attacker who can crash the machine (see the login-throttle memory finding) logs them out again with each crash.

**Suggested fix:** Set session_key when the user row is inserted (DEFAULT (lower(hex(randomblob(16)))) on new rows, or include it in the INSERTs) so logIn never stores null. Keep the startup backfill only for old rows.

