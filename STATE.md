# DOQ current implementation state

{
  "status": "in_progress",
  "scope": "Full DOQ feature implementation in user supplied existing project",
  "database": {
    "status": "unavailable",
    "evidence": "localhost:3306 ECONNREFUSED; no DB_* configured; WSL no MySQL/MariaDB/Docker command"
  },
  "owner_decisions_pending": [
    "confirm whether the seven percent base is completed gross order value or delivery fee",
    "referral reward percent",
    "existing database runtime/location",
    "deployed website URL for a native Android or iOS client"
  ],
  "limitations": [
    "No live payment calls or sends authorized",
    "No successful DB or end-to-end verification yet"
  ],
  "checkpoint": "Delivery-company competition, atomic first accept, vehicle ownership, daily report and safe completed-order purge added; DB integration still blocked",
  "agent": "codex",
  "date": "2026-09-29"
}

agent: codex | 2026-09-29 | Prior partial source recovered; real DB unavailable; completing local implementation and focused verification


agent: codex | 2026-09-29 | Repaired auth 2FA challenge flow, signed session-bound CSRF, global rate/header middleware, public contact filtering, atomic idempotent orders, delivery assignment and pending-account reject path; added migration runner, role order views and focused tests

Security review accepted from read-only reviewer: stored XSS review remains open in legacy review templates; order retry idempotency now required in client and server and admin notification dedupe is keyed; DB-dependent confirmation unavailable; settlement assumptions intentionally not activated until owner answers commission basis and cadence

agent: codex | 2026-09-29 | Repaired six Arabic-facing views with UTF-8 integrity guard, added admin operations page for pending accounts and delivery assignment, added installable PWA shell; npm test 12 passed; database and live deployment remain unverified

agent: codex | 2026-09-29 | Added database-backed city endpoint and fixed review error HTML injection path; npm test 14 passed

agent: claude | 2026-09-29 | Phase 1 (optional 2FA, email reset) and phase 2 (orders and delivery across roles) verified on local MariaDB 11.4 with 300 chefs and 900 customers: npm test 22/22, end-to-end role walk 60/60, mobile browser walk with real clicks 10 screens and no page errors
Fixed this pass: four JS files that did not parse (app could not start), dish page 500 for logged-out visitors and three unclosed script tags that disabled the order modal, generic error text on success and failure, order name and customer address for delivery, kitchen sees no customer data, customer cancel before courier, Arabic status in notifications for every party, admin order and courier lists instead of typing IDs, forgot password page rebuilt to email link plus SMTP sender (utiles/mailer.js, nodemailer) wired to cron, OTP field only for 2FA users, service worker no longer caches personal pages or API data, catchError now passes real status codes
Guards: tests/regression.test.js (parse check, app load, placeholder text, question-mark mojibake, closed script tags, public views guard currentUser, kitchen and delivery column contracts) proven failing on the pre-fix copy
Current owner items: SMTP values are still placeholders so reset emails wait in email_outbox, PUBLIC_URL must be set in production, monthly 7% commission remains gated until the delivery base and cadence are approved, and the old secret values still need rotation if they were ever real because older Git history contained .env
Local test route: DB_HOST=127.0.0.1 DB_PORT=3307 DB_USER=doq_user DB_PASSWORD=doq_password DB_NAME=DOQ; backup of codex state at ../_backup_after_codex_2026-09-29.tar
- agent: codex | 2026-09-29 | owner corrected coupon scope: each customer account can redeem a dish coupon once, while the same coupon remains available to other customer accounts; migration and UI checks passed; live DB unavailable

agent: codex | 2026-09-29 | prepared Dockerfile, docker compose app/db/cron services, safe environment template and local runtime keys; rebuilt landing page to share dashboard theme and role-specific dashboard links; EJS compile, compose YAML contract and 16 focused tests passed; Docker CLI and live database remain unavailable
agent: codex | 2026-09-30 | fixed shared footer nesting and broken links, aligned home theme tokens with shared header, hardened database bootstrap authentication, updated runbook status, full local test suite passed 27/27; Docker, database and real browser visual check remain unavailable

agent: codex | 2026-09-30 | added multi-company delivery competition with vehicle-bound atomic accept and customer privacy after accept; added Cairo-day daily report, seven-percent preview, email outbox notification and purge-after-sent flow; made coupon redemption history survive order purge; added create-only admin bootstrap and removed admin as public signup default; npm test 31/31; Docker, database and live browser remain unavailable

agent: codex | 2026-09-30 | hardened report catch-up for missed cron days and made purge use database-formatted report dates; reran npm test 31/31 and EJS renders for delivery, admin operations and auth; Docker, database and live browser remain unavailable

agent: codex | 2026-09-30 | separated development and production environment templates, added selectable dotenv loading, production compose override with private database and Caddy HTTPS proxy, added shared website and app deployment guide; live deployment and store packages remain unverified

agent: codex | 2026-09-30 | corrected production Compose merge semantics so ports and inherited env files are explicitly reset or replaced; Compose CLI unavailable for runtime validation

agent: codex | 2026-10-01 | Added guarded test-account bootstrap for customer, chef, delivery and admin roles, removed default seed password, tightened exact payment CSRF callback path, disabled production diagnostic page, randomized upload filenames, fixed upload URLs, escaped high-risk public API HTML fields, restored guest category filters, added transfer pack script and generated transfer archive; npm test 36 passed; database-dependent role walk remains blocked because no MySQL/MariaDB runtime is available
agent: codex | 2026-10-01 | Completed the security pass for chef, admin, customer and kitchen dynamic HTML, removed inline dish JSON handlers, hardened image URL rendering, added the Arabic security review, reran all EJS compilation and npm test 38/38, reran test-dilution scan clear and rebuilt the transfer archive; live database and browser role flows remain unverified
agent: codex | 2026-10-01 | Added a regression guard against inline API JSON in chef dish handlers, reran the full suite at 39/39, test-dilution scan remained clear and transfer packaging completed without private runtime data

agent: codex | 2026-10-03 | Disabled online Paymob behind PAYMENTS_ENABLED=false with manual InstaPay instructions, strengthened chat contact filtering, verified 41/41 tests and EJS compilation, APK remains blocked because no native Android wrapper exists
agent: codex | 2026-10-03 | Added read-time masking for legacy external chat content, reran 41/41 and rebuilt transfer archive
