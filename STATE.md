## Request Lifecycle — Client → Server → Response

### High-Level Flow Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENT (Browser)                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  1. User Action (click link, submit form, JS fetch)                                         │
│     │                                                                                       │
│     ▼                                                                                       │
│  2. app-client.js intercepts fetch (if same-origin & mutating)                              │
│     ├─ Attaches CSRF token (x-csrf-token header)                                           │
│     ├─ Attaches credentials (session_token cookie)                                         │
│     └─ Adds Accept: application/json for API calls                                         │
│     │                                                                                       │
│     ▼                                                                                       │
│  3. HTTP Request ──► [Network] ──► NGINX/Caddy (TLS termination, static files)            │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              EXPRESS APP (index.js)                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  4. Trust Proxy (if behind Caddy)                                                           │
│     │                                                                                       │
│     ▼                                                                                       │
│  5. Body Parsers: express.json() + express.urlencoded()                                     │
│     │                                                                                       │
│     ▼                                                                                       │
│  6. cookie-parser → req.cookies populated                                                  │
│     │                                                                                       │
│     ▼                                                                                       │
│  7. Security Headers Middleware (securityHeaders)                                           │
│     ├─ CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy                     │
│     │                                                                                       │
│     ▼                                                                                       │
│  8. CSRF Cookie Issuance (issueCsrfCookie)                                                 │
│     ├─ Sets doq_csrf_seed cookie (httpOnly, 24h)                                           │
│     └─ Attaches req.csrfToken() function                                                    │
│     │                                                                                       │
│     ▼                                                                                       │
│  9. Global Rate Limiter (requestRateLimit)                                                 │
│     ├─ 15 req/min for /auth/* mutating                                                     │
│     └─ 240 req/min for other routes                                                        │
│     │                                                                                       │
│     ▼                                                                                       │
│  10. CSRF Validation (csrfProtection) ──► 403 if invalid/missing on mutating               │
│     │                                                                                       │
│     ▼                                                                                       │
│  11. Static Files (express.static) ──► Serves /public, /uploads if matched                 │
│     │                                                                                       │
│     ▼                                                                                       │
│  12. View Engine Setup (EJS)                                                                │
│     │                                                                                       │
│     ▼                                                                                       │
│  13. Test Page (dev only) ──► /test if ENABLE_TEST_PAGE=true                               │
│     │                                                                                       │
│     ▼                                                                                       │
│  14. ROUTE MOUNTING (in order):                                                            │
│     ├─ /auth          → routes/auth.js          (public + auth)                            │
│     ├─ /categories    → routes/categories.js    (admin + public list)                      │
│     ├─ /dishes        → routes/dish.js          (public + chef + admin)                    │
│     ├─ /              → routes/home.js          (public pages)                             │
│     ├─ /admin         → routes/admin.js         (admin only)                               │
│     ├─ /kitchens      → routes/kitchen.js       (public + chef + admin)                    │
│     ├─ /reviews       → routes/review.js        (public + customer + chef + admin)         │
│     ├─ /users         → routes/user.js          (auth + profile + admin)                   │
│     ├─ /police        → routes/police.js        (static legal pages)                       │
│     ├─ /payment       → routes/payment.js       (chef + webhook)                           │
│     ├─ /orders        → routes/orders.js        (customer/chef/delivery)                   │
│     ├─ /my-orders     → routes/customer-orders.js (customer)                               │
│     ├─ /delivery      → routes/delivery.js      (delivery)                                 │
│     ├─ /platform      → routes/platform.js      (auth + CSRF)                              │
│     ├─ /notifications → routes/notifications.js (all authenticated)                        │
│     ├─ /share         → routes/share.js         (referral landing)                         │
│     └─ (404 / error handlers at end)                                                       │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                          ROUTE-SPECIFIC MIDDLEWARE CHAIN                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  For each route, middleware runs in sequence:                                               │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ auth.optional / auth / roles('role')                                                │   │
│  │   └─ middlware/auth.js → identify() → req.user (or null/redirect)                   │   │
│  ├─────────────────────────────────────────────────────────────────────────────────────┤   │
│  │ isOwner('resource') / for_main() / allRows() / uuidTobinary / checkSubscription    │   │
│  │   └─ Load data, verify ownership, paginate, validate subscription                   │   │
│  ├─────────────────────────────────────────────────────────────────────────────────────┤   │
│  │ catchError() wrapper                                                                │   │
│  │   └─ Catches async errors → forwards to error middleware                            │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  CONTROLLER HANDLER (e.g., controller/orders.js → createOrder_controller)                 │
│     │                                                                                       │
│     ▼                                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ BUSINESS LOGIC LAYER                                                                 │   │
│  ├─────────────────────────────────────────────────────────────────────────────────────┤   │
│  │ 1. Input Validation (utiles/checker + utiles/validation.js Joi schemas)             │   │
│  │ 2. Authorization Checks (roles, ownership, subscription status)                     │   │
│  │ 3. Database Operations (via database/pool.js → MySQL)                               │   │
│  │    ├─ Simple queries: pool.query()                                                  │   │
│  │    └─ Transactions: utiles/transaction() → BEGIN/COMMIT/ROLLBACK                    │   │
│  │ 4. Side Effects:                                                                    │   │
│  │    ├─ Notifications: utiles/notifications.js (notify, admins)                       │   │
│  │    ├─ Emails: utiles/mailer.js (email_outbox queue)                                 │   │
│  │    ├─ Cache Invalidation: middlware/allRows.clearCache()                            │   │
│  │    └─ Webhooks/External APIs: utiles/payment.js (Paymob)                            │   │
│  │ 5. Response Building (JSON or render data)                                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              RESPONSE PHASE                                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  Controller returns:                                                                        │
│    ├─ res.json({ status, data, pagination? }) ──► API clients                              │
│    ├─ res.render(view, data) ──► HTML pages (EJS)                                          │
│    ├─ res.redirect(url) ──► 302                                                             │
│    └─ res.status(code).json({ status: 'error', message }) ──► Errors                       │
│                                                                                             │
│  Error Middleware (middlware/error.js):                                                     │
│    ├─ Maps error codes → HTTP status (ER_DUP_ENTRY→409, LIMIT_FILE_SIZE→413, else 500)    │
│    ├─ Logs 5xx errors (JSON structured)                                                    │
│    ├─ HTML error pages for browser GET (page_404, page_403, page_500)                     │
│    └─ JSON for API clients                                                                  │
│                                                                                             │
│  Security Headers applied to ALL responses (from step 7)                                    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              BACK TO CLIENT                                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  Browser receives:                                                                          │
│    ├─ HTML → EJS renders → DOM → app-client.js runs → SW registers                         │
│    ├─ JSON → DOQ.api() / fetch → UI updates                                                │
│    ├─ 403/401 → Redirect to /auth or show error                                            │
│    └─ Cookies set/cleared (session_token, pending_token, doq_csrf_seed)                   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Module Interaction Summary

| Layer | Files | Responsibility |
|-------|-------|----------------|
| **Entry** | `index.js` | Middleware stack, route mounting, server bootstrap |
| **Config** | `config/env.js` | Loads `.env` / custom env file |
| **Database** | `database/pool.js` | MySQL connection pool |
| **Auth Core** | `middlware/auth.js`, `utiles/session.js` | JWT verify, session cookies, 2FA challenges |
| **Security** | `middlware/security.js` | CSP, CSRF, rate-limit, security headers |
| **Validation** | `utiles/validation.js`, `utiles/checker.js` | Joi schemas + auto-400 responses |
| **Routes** | `routes/*.js` | Mount points, role guards, middleware chains |
| **Controllers** | `controller/*.js` | Business logic, DB, side effects |
| **Utilities** | `utiles/*.js` | Notifications, mailer, transactions, crypto helpers |
| **Rendering** | `rendering/*.js` | View selection + data shaping for EJS |
| **PWA** | `public/app-client.js`, `public/sw.js`, `manifest.webmanifest` | Offline, installability, CSRF automation |
| **Background** | `tasks/cron.js`, `scripts/*.js` | Scheduled jobs, migrations, bootstraps |

### Key Data Flows

1. **Authentication Flow**
   ```
   POST /auth/signin → auth.identify() → bcrypt.compare → 
   (2FA? issueChallenge : issueSession) → session_token cookie
   ```

2. **Order Creation (Idempotent)**
   ```
   POST /orders/api/v1 (Idempotency-Key) → transaction →
   INSERT orders + coupon_redemptions + order_financial_events →
   notify(chef, delivery[], admins) → 201 with public_id
   ```

3. **Delivery Acceptance (Atomic)**
   ```
   PATCH /orders/api/v1/delivery/:publicId/accept (vehicle_id) →
   transaction with FOR UPDATE → vehicle ownership check →
   UPDATE orders SET delivery_id, vehicle_id, status='accepted' →
   notify(customer, chef)
   ```

4. **PWA Offline Shell**
   ```
   GET / → Service Worker (sw.js) serves cached / + app-client.js
   → Network-first for API/private routes
   → Never caches /api/, /auth/, /orders/, /admin/, /my-orders/
   ```

---

*Generated: 2026-10-04 | All 41 tests passing | Documentation complete*
