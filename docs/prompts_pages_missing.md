# DOQ - Missing Pages Prompts for Google Stitch

## 1. Customer Favorites Page

**Path:** `views/customer/favourites.ejs`

```markdown
# DOQ - Customer Favorites Page

Build a complete favorites/wishlist page for customers with RTL Arabic layout (dir="rtl" lang="ar"). Use DOQ design system: primary color #9e2016, secondary #fc7127, surface #fff8f6, Cairo font for headings, Tajawal for body. Grid of dish cards (responsive: 1/2/3/4 columns). Each card: dish image, name, kitchen, city, price, rating, favorite button (active state), View Details and Quick Order buttons. Empty state with "No favorites yet" message. Pagination at bottom. Loading skeletons while fetching. Error message display. Remove from favorites button with confirmation. Quick Order redirects to dish page. Use DOQ.escape() for text, DOQ.safeImage() for images, DOQ.api() for API calls with CSRF. Consistent with existing DOQ design.
```

---

## 2. Customer Referral Dashboard

**Path:** `views/customer/referrals.ejs`

```markdown
# DOQ - Customer Referral Dashboard

Build a referral dashboard page for customers to create and manage referral links. RTL Arabic, DOQ design system. Top: Stats cards (Total Referrals, Total Signups, Total Rewards). "Create New Referral" button opens modal. Modal: Select dish from user's dishes, show reward % and discount %. List of created referrals with: Dish image, name, kitchen, Status (Active/Expired), Expiry date, Signups count, total rewards, Copy Link and Share buttons. Empty state. Pagination. Use DOQ.api() for requests, DOQ.escape() and DOQ.safeImage(). Consistent with DOQ theme.
```

---

## 3. Referral Landing Page

**Path:** `views/referral/landing.ejs`

```markdown
# DOQ - Public Referral Landing Page

Public page when someone clicks a referral link. RTL Arabic, DOQ design system. Header with DOQ logo and Login button. Hero section with dish image background. Card showing: Dish name, description, price, kitchen, Discount badge (e.g., "20% off"), Expiry date, "Sign up to claim" button → /auth?ref=TOKEN, "Login" button → /auth?ref=TOKEN. Footer. Reads token from URL query params. Sets doq_referral cookie (30 days). Fetches referral details and displays them. Default state if token invalid.
```

---

## 4. Order Chat System

**Path:** `views/chat/order.ejs`

```markdown
# DOQ - Order Chat System

Real-time chat between customer, chef, and delivery for each order. RTL Arabic, DOQ design system. Header: Order code, status chip. Messages container (scrollable): System messages centered amber background, User messages right-aligned primary color bubble, Other user messages left-aligned surface background. Each message: sender name, role badge, timestamp, body. Typing indicator. Message input form: Textarea max 1000 chars, Character count, Send button (Enter to send), Privacy notice. Order details section. Real-time polling every 5 seconds. Pause polling when tab hidden. Auto-scroll to bottom. Use DOQ.api() with credentials.
```

---

## 5. Admin Categories Management

**Path:** `views/admin/categories.ejs`

```markdown
# DOQ - Admin Categories CRUD Page

Admin page for managing dish categories. RTL Arabic, DOQ admin theme (sidebar, header). Page header with Add Category button. Table: Name, Description, Dishes Count, Created At, Actions. Add Modal: Name required, Description optional. Edit Modal: Pre-filled form. Delete: SweetAlert2 confirmation. Toast notifications. Loading state, empty state. XSS protection. No page reload on CRUD operations. Consistent with DOQ admin pages.
```

---

## 6. User Settings Bug Fix

**Path:** `views/user/setting.ejs`

```markdown
# DOQ - User Settings Page (Fix)

Fix the profile image upload endpoint path. Current code calls /users/api/v1/my/profile but correct endpoint is /user/api/v1/my/profile (singular /user). Find line ~240 in views/user/setting.ejs and change: /users/api/v1/my/profile → /user/api/v1/my/profile. Also fix line ~291: /users/api/v1 → /user/api/v1.
```

---

## 7. Chef Orders API Path Fix

**Path:** `views/chef/orders.ejs`

```markdown
# DOQ - Chef Orders Page (Fix)

Fix the API endpoint path for fetching chef's orders. Current code calls /users/orders/api but correct endpoint is /user/orders/api (singular /user). Find line ~38 in views/chef/orders.ejs and change: /users/orders/api → /user/orders/api.
```
