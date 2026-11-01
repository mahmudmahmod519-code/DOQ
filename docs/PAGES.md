# DOQ Pages — Complete Page Reference for AI Agents

## Purpose of this document

This file is the **single reference for every page (view) in the DOQ app**, including:

- Which **route(s)** render the page (HTTP method + path + mount prefix).
- Which **view file** (EJS template) renders it.
- Which **layout / partials** the page uses.
- **Purpose** — what the page is for and what it does.
- **Key locals (variables)** passed from controllers / render dispatchers / middleware.

It exists so any AI agent (or developer) can quickly find, understand, or modify any page without re-reading all source files.

---

## 1. Page architecture map

### 1.1 Route mounting (from `index.js`)

| Mount prefix | Router file | Notes |
|---|---|---|
| `/auth` | `routes/auth.js` | Auth pages + auth APIs + 2FA |
| `/categories` | `routes/categories.js` | Category admin pages + category APIs |
| `/dishes` | `routes/dish.js` | Dish pages (menu / chef mgmt / admin mgmt) + dish APIs + uploads |
| `/` | `routes/home.js` | Landing, about, faqs, contact |
| `/admin` | `routes/admin.js` | Admin dashboard, operations, admin APIs |
| `/kitchens` | `routes/kitchen.js` | Kitchen pages + kitchen APIs + uploads |
| `/reviews` | `routes/review.js` | Review pages + review APIs |
| `/users` | `routes/user.js` | Chef/admin dashboard, chef orders, user mgmt, settings, profile |
| `/police` | `routes/police.js` | Legal pages (privacy, terms, cookies, refund) |
| `/payment` | `routes/payment.js` | Chef/delivery payment & subscription pages + payment APIs |
| `/orders` | `routes/orders.js` | Order APIs (create, chef accept/handoff, delivery accept, status) |
| `/my-orders` | `routes/customer-orders.js` | Customer orders page + customer orders API |
| `/delivery` | `routes/delivery.js` | Delivery dashboard + delivery payment page |
| `/platform` | `routes/platform.js` | Coupons, referrals, favourites, notifications, chat APIs |
| `/notifications` | `routes/notifications.js` | Notifications page + notifications APIs |
| `/share` | `routes/share.js` | Referral/discount share link handling (redirects) |

### 1.2 Rendering pattern

- Most pages go through **rendering dispatchers** in `rendering/*.js` (e.g. `rendering/home.js` exports `getLandingPage_render`, `about_render`, ...).
- Dispatchers build the locals and call `res.render(viewPath, locals)`.
- Some simple pages are rendered **directly inside route handlers** with inline locals (e.g. `routes/notifications.js`, `routes/admin.js`, `routes/customer-orders.js`).

### 1.3 Views folder organization

```
views/
  index.ejs, about.ejs, fqs.ejs, contect-us.ejs      # public/marketing (mounted at /)
  partials/                                          # shared layouts
  auth/                                              # auth pages (login, signup2, forget/reset, recovery, 2fa)
  admin/                                            # admin pages (dashboard, operations, users, kitchens, dishes, reviews, cateogries)
  chef/                                             # chef pages (dashboard, dishes, orders, kitchen, reviews, payment)
  customer/                                         # customer pages (dishes, kitchens, orders, reviews, myreviews)
  delivery/                                         # delivery pages (dashboard, payment)
  dish/                                             # dish detail (single dish)
  kitchen/                                          # kitchen profile (customer-facing)
  chat/                                             # chat order (⚠️ currently has NO route — orphan)
  errors/                                           # page_404, page_403, page_500
  notifications.ejs                                 # notifications page (mounted /notifications)
  police/                                           # legal pages
  referral/                                         # referral landing (⚠️ currently has NO route — orphan)
  user/                                             # user pages: portfolio, setting
```

### 1.4 Shared layout partials

| Partial | File | Used by | Required props / locals |
|---|---|---|---|
| Site header/nav | `views/partials/header.ejs` | Public + customer-facing pages (15 files) | `login`, `currentUser` (derived role → dashboard link); accepts optional extras |
| Site footer | `views/partials/footer.ejs` | Public + customer-facing pages (15 files) | – |
| Admin sidebar | `views/partials/admin_sidebar.ejs` | Admin pages (dashboard, users, kitchens, dishes, reviews, categories, operations) | `activePage` (values: `admin`, `users`, `kitchens`, `dishes`, `categories`, `reviews`) |
| Chef sidebar | `views/partials/chef_sidebar.ejs` | Chef pages (dashboard, dishes, orders, kitchen, reviews, payment) | `activePage` (values: `dashboard`, `orders`, `dishes`, `my-kitchen`, `reviews`, `payment`) |
| Role bar (top sub-nav) | `views/partials/role_bar.ejs` | Admin operations + several chef pages | `links` array (`{ href, label, active }`) |
| No-kitchen state | `views/partials/no_kitchen_state.ejs` | Chef pages when user has no kitchen | optional: `title`, `description`, `ctaHref`, `ctaText` (defaults provided) |

### 1.5 Common view locals (`utiles/checkLogin`)

`require('../utiles/checkLogin')(req, res)` returns:

```js
{ currentUser: <sanitized user or undefined>, status: 'success', login: Boolean(req.user) }
```

- `currentUser` is sanitized via `utiles/remove_password` (password_hash / two_factor_secret stripped).
- Pages that need `pageTitle` add it explicitly (e.g. `'طلباتي | دوق'`).

---

## 2. Page catalog

### 2.1 Public / Marketing pages

#### Landing Page
- **Route:** `GET /` (`routes/home.js` → `rendering/home.js` → `getLandingPage_render`)
- **View:** `views/index.ejs`
- **Layout:** `partials/header.ejs`, `partials/footer.ejs`
- **Purpose:** Main entry page of DOQ ("اطلب أكلك من مطبخك المفضل"). Loads categories (with dish counts) + featured kitchens and renders the landing with per-role dashboard CTA.
- **Key locals:** `...checkLogin(req, res)` → `{ currentUser, status, login }`, plus `categories`, `kitchens` (from `getCategoriesWithCount()` / `getFeaturedKitchens()`).

#### About Page
- **Route:** `GET /about`
- **View:** `views/about.ejs`
- **Layout:** header + footer
- **Purpose:** "من نحن" — company/about content.
- **Key locals:** checkLogin result.

#### FAQ Page
- **Route:** `GET /faqs`
- **View:** `views/fqs.ejs`
- **Layout:** header + footer
- **Purpose:** Public FAQ ("الأسئلة الشائعة").
- **Key locals:** checkLogin result.

#### Contact Page
- **Route:** `GET /contect-us`
- **View:** `views/contect-us.ejs`
- **Layout:** header + footer
- **Purpose:** Contact page ("اتصل بنا").
- **Key locals:** checkLogin result.

#### Referral Landing (⚠️ no confirmed route)
- **View:** `views/referral/landing.ejs`
- **Status:** No route/controller found that renders it → likely orphaned / planned.

#### Legal pages (public)
| Page | Route | View | Purpose |
|---|---|---|---|
| Privacy Policy | `GET /police/privacy` | `views/police/privacy.ejs` | Privacy policy content |
| Terms of Service | `GET /police/terms-of-service` | `views/police/terms.ejs` | Terms of use |
| Cookies Policy | `GET /police/cookies-policy` | `views/police/cookies.ejs` | Cookie policy |
| Refund Policy | `GET /police/refund-policy` | `views/police/refund.ejs` | Refund/cancellation policy |

---

### 2.2 Authentication pages

#### Login
- **Route:** `GET /auth` → `auth_render` → `views/auth/auth.ejs`
- **Layout:** auth page (self-contained; no site header include found)
- **Purpose:** Login page (email + password + MFA).
- **Key locals:** checkLogin result.

#### Signup Step 2 (2FA enrollment)
- **Route:** `GET /auth/signup2` → `authSignUp2_render` → `views/auth/signup2.ejs`
- **Layout:** auth page
- **Purpose:** Second signup step — TOTP 2FA enrollment; validates `pending_token` from cookie or Authorization header.
- **Key locals:** checkLogin result; pending token handling internal.

#### Forgot Password
- **Route:** `GET /auth/forgetpassword` → `forgetPassword_render` → `views/auth/forgetpassword.ejs`
- **Purpose:** Request password reset code (email).
- **Key locals:** checkLogin result.

#### Reset Password
- **Route:** `GET /auth/resetpassword` → requires auth → `resetPassword_render` → `views/auth/resetpassword.ejs`
- **Purpose:** Set new password (authenticated).
- **Key locals:** checkLogin result.

#### Recovery (token-based reset)
- **Route:** `GET /auth/recovery` → `views/auth/recovery.ejs`
- **Purpose:** Password reset via token from `req.query.token`.
- **Key locals:** `{ token: String(req.query.token || '') }`.

#### 2FA Management
- **Route:** `GET /auth/2fa` → requires auth → `views/auth/2fa.ejs`
- **Purpose:** Manage 2FA (enable/disable) for logged-in user.
- **Key locals:** `currentUser` (from checkLogin).

---

### 2.3 Customer-facing pages

#### Dish Menu (customer)
- **Route:** `GET /dishes` → `Dishes_render` (template chosen by `req.user.roles`)
- **Views:** `views/customer/dishes.ejs` (customer), `views/admin/dishes.ejs` (admin), `views/chef/dishes.ejs` (chef)
- **Layout:** header + footer (customer) / admin_sidebar (admin) / chef_sidebar (chef)
- **Purpose:** Customer: browse dish menu. Admin/chef: dish management dashboard.
- **Key locals:** checkLogin result (`{ currentUser, status, login }`).

#### Dish Detail
- **Route:** `GET /dishes/:id` → `dish_get_id` + `SpecificDish_render` → `views/dish/dish.ejs`
- **Layout:** header + footer
- **Purpose:** Single dish detail with order modal (order-coupon, coupon_code wiring, single `openOrderModal` implementation, Idempotency-Key header), ingredients split (`，`).
- **Key locals:** `dish` (`req.my` — populated by `dish_get_id`), `currentUser`, `login`.

#### Kitchen List (customer / admin)
- **Route:** `GET /kitchens` → `kitchens_render` (template by `req.user.roles`: customer default, admin → `admin/kitchens`)
- **Views:** `views/customer/kitchens.ejs`, `views/admin/kitchens.ejs`
- **Purpose:** Browse/search kitchens or admin-manage kitchens.
- **Key locals:** checkLogin result.

#### Kitchen Profile (customer-facing)
- **Route:** `GET /kitchens/:id` → `getKitchenById_middleware` + `kitchenProfile_render` → `views/kitchen/kitchen.ejs`
- **Layout:** header + footer
- **Purpose:** Public kitchen profile; **strips customer phone data** (`delete publicKitchen.phone_number`); no `wa.me` / `tel:` links.
- **Key locals:** `kitchen` (`req.kitchen`), checkLogin result.

#### Chef Kitchen Management
- **Route:** `GET /kitchens/my` → requires chef → `myKitchen_render` → `views/chef/kitchen.ejs`
- **Purpose:** Chef manages own kitchen (profile/background image, menu); uses first kitchen from `req.my` (populated by `for_main('kitchen', true, false)`).
- **Key locals:** `kitchen` (`req.my[0]`), checkLogin result.

#### Customer Orders
- **Route:** `GET /my-orders` → requires customer → render `./customer/orders` with checkLogin + `pageTitle: 'طلباتي | دوق'`
- **Purpose:** Customer order history.
- **Key locals:** checkLogin result, pageTitle.

#### Reviews
- **Route:** `GET /reviews` → `reviews_render` (template by role: customer → `customer/reviews`, admin → `admin/reviews`, chef → `chef/reviews`)
- **Route:** `GET /reviews/my-reviews` → requires customer → `views/customer/myreviews.ejs`
- **Purpose:** View/manage reviews; supports `type` + `id` query filters (customer only).
- **Key locals:** `type`, `id` (from `req.query`), checkLogin result.

#### Notifications
- **Route:** `GET /notifications` → requires auth (`admin, chef, customer, delivery`) → `views/notifications.ejs`
- **Purpose:** Notification inbox page.
- **Key locals:** `currentUser`, `pageTitle`.

---

### 2.4 Chef pages

#### Chef Dashboard
- **Route:** `GET /users/dashboard` → `dashboard_render` → `dashboard_render` in `rendering/user.js`
- **Views:** `views/chef/dashboard.ejs` (chef) or `views/admin/dashboard.ejs` (admin)
- **Layout:** chef_sidebar (chef) / admin_sidebar (admin)
- **Purpose:** Unified dashboard; chef uses `req.dashboard` (from `getUnifiedChefDashboard` middleware) + `csrfToken`; admin gets pageTitle only.
- **Key locals:** chef: `{ dashboard: req.dashboard || {}, csrfToken: req.csrfToken }`; admin: `{ ...checkLogin, pageTitle }`.

#### Chef Orders
- **Route:** `GET /users/orders` (also `GET /orders` via `routes/user.js`) → renders `views/chef/orders.ejs`
- **Purpose:** Chef sees incoming orders for their dishes; **kitchen order query must not expose customer data** (see regression tests).
- **Key locals:** checkLogin result + `pageTitle: 'طلبات المطبخ | دوق'`.

#### Chef Dishes Management
- **Route:** `GET /dishes` (chef branch) → `views/chef/dishes.ejs`
- **Purpose:** Chef dish cards; no inline JSON interpolation (`dishesById`, `openEditModalById`, `openCouponModalById`).
- **Key locals:** checkLogin result.

#### Chef Kitchen Management
- **Route:** `GET /kitchens/my` → `views/chef/kitchen.ejs`
- **Purpose:** Manage kitchen (profile/background image, menu data).
- **Key locals:** `kitchen`, checkLogin result.

#### Chef Reviews
- **Route:** via `GET /reviews` (chef branch) → `views/chef/reviews.ejs`.

#### Chef Payment / Subscription
- **Route:** `GET /payment` → `payment_render` → `views/chef/payment.ejs` (chef) or `views/delivery/payment.ejs` (delivery)
- **Purpose:** Subscription/payment settings; locals: `paymentsEnabled` (`paymentsEnabled()` from controller/payment), `payoutLink` (`process.env.PAYOUT_LINK`).

---

### 2.5 Delivery pages

#### Delivery Dashboard
- **Route:** `GET /delivery` → `delivery_dashboard_render` → `views/delivery/dashboard.ejs`
- **Purpose:** Delivery courier sees assigned orders (must carry needed fields: customer_phone, order_name, kitchen_phone, kitchen_address, dish_name, unit_price, total_price).
- **Key locals:** checkLogin result + `pageTitle: 'مكتب التوصيل | دوق'`.

#### Delivery Payment / Subscription
- **Route:** `GET /delivery/payment` → via `GET /payment` dispatcher branch → `views/delivery/payment.ejs`
- **Purpose:** Delivery subscription/payment management.

---

### 2.6 Admin pages

| Page | Route | View | Purpose | Key locals |
|---|---|---|---|---|
| Admin Dashboard | `GET /admin` | `views/admin/dashboard.ejs` | Stats dashboard | checkLogin + `pageTitle: 'لوحة التحكم \| دوق DOQ'` |
| Admin Operations | `GET /admin/operations` | `views/admin/operations.ejs` | Pending account approval + delivery assignment UI | `currentUser`, `pageTitle` |
| Admin Users | `GET /users` (admin) | `views/admin/users.ejs` | User management listing | checkLogin |
| Admin Kitchens | `GET /kitchens` (admin role) | `views/admin/kitchens.ejs` | Kitchen management | checkLogin |
| Admin Dishes | `GET /dishes` (admin role) | `views/admin/dishes.ejs` | Dish management | checkLogin |
| Admin Categories | `GET /categories` | `views/admin/cateogries.ejs` | Category management (⚠️ filename typo `cateogries`) | checkLogin |
| Admin Reviews | `GET /reviews` (admin role) | `views/admin/reviews.ejs` | Review moderation | `type`, `id` optional, checkLogin |

---

### 2.7 Order / Chat pages

- **Customer orders page:** `GET /my-orders` → `views/customer/orders.ejs`.
- **Chef orders:** `GET /users/orders` → `views/chef/orders.ejs`.
- **Delivery orders:** `GET /delivery` → `views/delivery/dashboard.ejs`.
- **Chat:** `views/chat/order.ejs` — **no route renders it** (see §4 orphans).

---

### 2.8 Error pages

| Page | Route trigger | View | Purpose |
|---|---|---|---|
| 404 | unmatched route → `notFound` middleware | `views/errors/page_404.ejs` | 404 page (with checkLogin) |
| 403 | error middleware (status 403) | `views/errors/page_403.ejs` | Forbidden page |
| 500 | error middleware (status 5xx) | `views/errors/page_500.ejs` | Server error page (uses Arabic friendly message) |

---

## 3. Quick page → file cheat sheet (most-asked targets)

| Page | View file | Dispatcher / route | Layout partials |
|---|---|---|---|
| Landing | `views/index.ejs` | `GET /` → `rendering/home.js` | header, footer |
| Dish menu (customer) | `views/customer/dishes.ejs` | `GET /dishes` → `rendering/dishes.js` | header, footer |
| Dish detail | `views/dish/dish.ejs` | `GET /dishes/:id` → `rendering/dishes.js` | header, footer |
| Kitchen list | `views/customer/kitchens.ejs` | `GET /kitchens` → `rendering/kitchen.js` | header, footer |
| Kitchen profile | `views/kitchen/kitchen.ejs` | `GET /kitchens/:id` → `rendering/kitchen.js` | header, footer |
| Chef kitchen | `views/chef/kitchen.ejs` | `GET /kitchens/my` → `rendering/kitchen.js` | chef_sidebar |
| Chef dashboard | `views/chef/dashboard.ejs` | `GET /users/dashboard` → `rendering/user.js` | chef_sidebar |
| Admin dashboard | `views/admin/dashboard.ejs` | `GET /admin` → `rendering/admin.js` | admin_sidebar |
| Customer orders | `views/customer/orders.ejs` | `GET /my-orders` → `routes/customer-orders.js` | header, footer |
| Chef orders | `views/chef/orders.ejs` | `GET /users/orders` → `routes/user.js` | chef_sidebar |
| Delivery dashboard | `views/delivery/dashboard.ejs` | `GET /delivery` → `rendering/delivery.js` | – (self-contained) |
| Notifications | `views/notifications.ejs` | `GET /notifications` → `routes/notifications.js` | – (self-contained) |
| Admin operations | `views/admin/operations.ejs` | `GET /admin/operations` → `routes/admin.js` | role_bar |
| Admin users | `views/admin/users.ejs` | `GET /users` → `rendering/user.js` | admin_sidebar |
| Admin dishes | `views/admin/dishes.ejs` | `GET /dishes` → `rendering/dishes.js` | admin_sidebar |
| Admin categories | `views/admin/cateogries.ejs` | `GET /categories` → `rendering/category.js` | admin_sidebar |
| Admin reviews | `views/admin/reviews.ejs` | `GET /reviews` → `rendering/reviews.js` | admin_sidebar |
| Customer reviews | `views/customer/reviews.ejs` | `GET /reviews` → `rendering/reviews.js` | header, footer |
| My reviews | `views/customer/myreviews.ejs` | `GET /reviews/my-reviews` → `rendering/reviews.js` | header, footer |
| Chef reviews | `views/chef/reviews.ejs` | `GET /reviews` → `rendering/reviews.js` | chef_sidebar |
| Chef dishes | `views/chef/dishes.ejs` | `GET /dishes` → `rendering/dishes.js` | chef_sidebar |
| Auth pages | `views/auth/*.ejs` | `routes/auth.js` + `rendering/auth.js` | self-contained |
| Legal pages | `views/police/*.ejs` | `routes/police.js` | self-contained / header? |

---

## 4. Known orphans / unrendered views (important for AI agents)

- `views/chat/order.ejs` — chat conversation page. **No route renders it** (chat is currently API-only via `/platform/chat/:publicId`).
- `views/referral/landing.ejs` — referral landing page. **No route found** rendering it.
- `views/reviews/reviews.ejs` and `views/reviews/reviews_chef_dashboard.ejs` — not obviously wired via found dispatchers (reviews use `customer/`, `chef/`, `admin/` subfolders).

Always verify with `grep -rn "render('..." routes rendering controller` before assuming a view is live.

---

## 5. Conventions checklist for AI agents adding / modifying pages

1. **New page:** create EJS in the right folder, add a `<thing>_render` in the matching `rendering/*.js` (or render inline in the route), mount the route if new.
2. **Layout:** include partials via `<%- include('...') %>` with correct relative paths (e.g. `../partials/header.ejs` from subfolders).
3. **Auth:** use middleware `auth`, `roles('customer'|'chef'|'delivery'|'admin')`, `checkLogin`, `for_main`, `isOwner` as needed.
4. **Security:** CSRF on mutations (`csrfProtection`), webhook exemption exact path `/payment/webhook`, no customer PII to kitchens (except delivery needs), Arabic text must not become `???`/mojibake.
5. **Tests:** guards live in `tests/*.test.js` (regression/implementation/security). New behavior may need test updates.
6. **Naming:** some files intentionally use English/Arabic titles; keep RTL + Arabic copy consistent.
7. **Run tests:** `npm test`; suite currently **green 41/41** (after the two fixes documented in the handcheck).

---

## 6. Quick reference — most edited areas (from repo history)

- Order flow: `routes/orders.js`, `controller/orders.js`, `views/customer/orders.ejs`, `views/chef/orders.ejs`, `views/delivery/dashboard.ejs`.
- Dish flow: `routes/dish.js`, `controller/dishes.js`, `rendering/dishes.js`, `views/dish/dish.ejs`, `views/chef/dishes.ejs`, `views/admin/dishes.ejs`, `views/customer/dishes.ejs`.
- Auth/2FA: `routes/auth.js`, `controller/auth.js`, `rendering/auth.js`, `views/auth/*.ejs`, `utiles/authentcator2FA.js`.
- Notifications: `routes/notifications.js`, `controller/platform.js`, `views/notifications.ejs`.
- Payments: `routes/payment.js`, `controller/payment.js`, `rendering/payment.js`, `views/chef/payment.ejs`, `views/delivery/payment.ejs`.
