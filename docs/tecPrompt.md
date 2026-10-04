# DOQ (دوق) – منصة عربيات أكل الشارع

**DOQ** هي منصة رقمية مصرية متخصصة في ربط العملاء بـ **عربيات أكل الشارع** (Street Food Carts) في المدن المصرية.  
الهدف: تمكين أصحاب العربيات من عرض وبيع أكلهم الشارعي الأصيل، وتمكين العملاء من اكتشاف أفضل عربيات الأكل القريبة منهم بسهولة وشفافية.

---

## الفكرة الأساسية (Business Overview)

بدل ما العميل يدور على عربيات الأكل بالصدفة أو يعتمد على كلام الناس، المنصة بتجمع كل العربيات في مكان واحد مع:

- صور واضحة للعربيات والأكل
- قائمة أطباق مع أسعار ومكونات
- تقييمات حقيقية من العملاء
- نظام تقييم عادل (Fair Score) عشان العربيات الجديدة متتضررش
- فلترة حسب المدينة والتصنيف والسعر

المنصة بتدعم **عربيات الشارع** مش المطابخ المنزلية.  
التركيز على الأكل الشارعي المصري والعربي (كفتة، شاورما، كشري، فلافل، مشويات، حلويات شارع، أكل بحري سريع...).

---

## الأدوار في المنصة

### 1. الزائر (غير مسجل)
- يشوف الصفحة الرئيسية والعربيات والأطباق
- يدخل صفحات About و FAQs و Contact Us
- يشوف التفاصيل العامة
- أي حاجة محتاجة حساب → بيتحول لصفحة التسجيل / الدخول

### 2. العميل (Customer)
- يسجل حساب (اسم، إيميل، رقم موبايل مصري، كود تحقق، باسورد قوي)
- يسجل دخول
- يدور ويفلتر العربيات والأطباق (مدينة – تصنيف – سعر – بحث)
- يشوف صفحة طبق كامل (وصف + مكونات + سعر + تقييمات + Fair Score)
- يضيف تقييم مرة واحدة بس لكل طبق
- يعدل أو يحذف تقييمه
- يشوف "تقييماتي"
- يعدل بياناته الشخصية ويغير الباسورد

### 3. صاحب العربية (Chef)
- نفس صلاحيات العميل +
- يعمل عربية واحدة (حالياً)
- يضيف ويعدل ويحذف أطباقه
- يرفع صور للعربية (خلفية + بروفايل) وللأطباق
- يشوف تقييمات أطباقه + إحصائيات + أفضل أطباقه حسب Fair Score
- يعدل بيانات العربيته

### 4. الأدمن (Admin)
- صلاحيات كاملة:
  - إدارة المستخدمين (عرض – تعديل – تغيير دور – حذف)
  - إدارة التصنيفات
  - إدارة العربيات
  - إدارة الأطباق
  - إدارة التقييمات + إحصائيات عامة
- لوحات تحكم منفصلة لكل قسم

---

## الميزات الرئيسية

### نظام التقييمات الذكي
- تقييم من 1 لـ 5 نجوم + تعليق
- **Fair Score** (Bayesian Average) بمعاملات C=20 و m=4.2  
  → بيمنع إن عربية جديدة أو طبق جديد يتظلم بسبب قلة التقييمات

### الفلترة والبحث
- بحث نصي
- حسب المدينة
- حسب التصنيف (مشويات، حلويات، مأكولات بحرية، وجبات سريعة...)
- حسب نطاق السعر
- ترتيب حسب السعر / الاسم / التاريخ

### إدارة الصور
- رفع صور للأطباق
- صورة خلفية + صورة بروفايل للعربية
- حد أقصى لحجم الصورة 5 ميجا

### الأمان
- كلمات مرور مشفرة بـ bcrypt
- JWT داخل Cookie (HttpOnly)
- صلاحيات حسب الدور
- التحقق من ملكية الموارد (صاحب العربية بس يقدر يعدل عربيته وأطباقه)

---

## الصفحات العامة المطلوبة

1. **About Us** – عن المنصة ورؤيتها
2. **FAQs** – الأسئلة الشائعة
3. **Contact Us** – تواصل معنا
4. **الصفحات القانونية**:
   - Privacy Policy
   - Terms of Service
   - Cookie Policy
   - (ممكن لاحقاً Refund / Cancellation Policy)

---

## النبرة والأسلوب المطلوب في أي محتوى

- ودّي ومهني في نفس الوقت
- مصري بسيط وواضح
- يركز على:
  - دعم أصحاب عربيات الشارع
  - الأكل الشارعي الأصيل والطازة
  - الشفافية والثقة
  - سهولة الاكتشاف للعميل
- مفيش مبالغة ولا وعود وهمية

---

# Technical Documentation

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL (mysql2/promise pool)
- **Authentication**: JWT stored in HttpOnly cookie (`session_token`)
- **Password Hashing**: bcrypt
- **Validation**: Joi
- **File Upload**: Multer (images only, max 5MB)
- **Templating**: EJS
- **Other**: cookie-parser, dotenv, swagger-autogen (partial)

## Project Structure

```bash
├── controller/          # Business logic
├── routes/              # Express routers
├── middlware/           # Auth, roles, ownership, pagination, upload, error
├── rendering/           # EJS render functions
├── utiles/              # validation, checker, catchError, isAuthenticated, etc.
├── database/            # pool.js
├── public/upload/       # Uploaded images
└── views/               # EJS templates
```


## Database Schema (Key Tables)

### users
- id, first_name, last_name, phone_number, email, password_hash, code, roles (`customer` | `chef` | `admin`)

### kitchens
- تمثل عربيات أكل الشارع (title, description, city, address, image_url, portfolio_url, phone_number, user_id, status)

### categories
- name, description

### dishes
- name, description, ingredients, price, image_url, category_id, kitchen_id

### reviews
- user_id, dish_id, rating (1-5), comment  
- UNIQUE (user_id, dish_id)

## Core Middlewares
- `auth` → checks JWT cookie, attaches `req.user`
- `roles(...allowedRoles)` → role-based access control
- `isOwner(resourceType)` → ownership check (`kitchen` | `dish` | `review`)
- `for_main(resource, pass, withPagination)` → loads current user’s own data into `req.my`
- `allRows(resource, relationType)` → generic paginated listing + filtering + caching
- `upload` → Multer config for images
- `catchError` → async error wrapper
- `checker(schema, data, res)` → Joi validation helper

## Important Business Rules
1. الشيف يقدر يعمل عربية واحدة بس حالياً.
2. العميل يقدر يقيم الطبق مرة واحدة بس.
3. Fair Score = Bayesian Average  
   `(count * avg + C * m) / (count + C)`  
   حيث `C = 20` و `m = 4.2`
4. مسارات الصور أحياناً `/uploads/` وأحياناً `/upload/` (فيه عدم تناسق).
5. معظم الصفحات Server-side rendered بـ EJS + Client-side fetch للبيانات.
6. مسارات الـ API فيها عدم تناسق (`/v1/api` و `/api/v1`).

## Roles & Permissions

| Action                        | Guest | Customer | Chef | Admin |
|------------------------------|-------|----------|------|-------|
| Browse carts & dishes        | ✓     | ✓        | ✓    | ✓     |
| Create account / login       | ✓     | ✓        | ✓    | ✓     |
| Add / edit / delete review   | ✗     | ✓ (own)  | ✗    | ✓     |
| Create / manage own cart     | ✗     | ✗        | ✓    | ✗     |
| Manage own dishes            | ✗     | ✗        | ✓    | ✗     |
| Full CRUD on everything      | ✗     | ✗        | ✗    | ✓     |

## Known Technical Debt
- الجدول اسمه `kitchens` لكن بيمثل عربيات أكل شارع.
- عدم تناسق في مسارات الـ API (`/api/v1` vs `/v1/api`).
- عدم تناسق في مسارات الصور (`/uploads/` vs `/upload/`).
- استخدام مختلط بين `req.user` و `req.my`.
- رسائل الخطأ أحياناً عربي وأحياناً إنجليزي.
- Swagger مُعد جزئياً فقط (معظمها على الـ Auth).

## Coding Conventions
- استخدم `catchError` على كل الـ async handlers.
- استخدم Joi schemas من `utiles/validation.js`.
- استخدم `checker()` للتحقق داخل الـ controllers.
- شكل الردود المفضل:
  ```json
  {
    "status": "success" | "error",
    "message": "...",
    "data": {},
    "pagination": {}
  }


## Routes
```bash
// ===== Auth =====
GET    /auth
GET    /auth/forgetpassword
GET    /auth/resetpassword
POST   /auth/signin
POST   /auth/signup
GET    /auth/logout
POST   /auth/forgetpassword
POST   /auth/resetpassword

// ===== Categories =====
GET    /categories/dashboard
GET    /categories/all
GET    /categories
GET    /categories/:id
POST   /categories
PUT    /categories/:id
DELETE /categories/:id

// ===== Kitchens =====
GET    /kitchens
GET    /kitchens/my
GET    /kitchens/:id
GET    /kitchens/api/v1
GET    /kitchens/api/v1/:id
GET    /kitchens/api/v1/my
POST   /kitchens/api/v1/
PUT    /kitchens/api/v1/my
POST   /kitchens/api/v1/my/background
POST   /kitchens/api/v1/my/profile
DELETE /kitchens/api/v1/:id

// ===== Dishes =====
GET    /dishes
GET    /dishes/:id
GET    /dishes/v1/api/
GET    /dishes/v1/api/:id
GET    /dishes/v1/api/category/:id
GET    /dishes/v1/api/kitchen/:id
GET    /dishes/v1/api/my
GET    /dishes/v1/api/my/:id
GET    /dishes/v1/api/kitchen/:id/my
GET    /dishes/v1/api/dashboard
POST   /dishes/v1/api/
PUT    /dishes/v1/api/:id
POST   /dishes/v1/api/:id/upload_image
DELETE /dishes/v1/api/:id
DELETE /dishes/v1/api/my/:id

// ===== Reviews =====
GET    /reviews
GET    /reviews/my-reviews
GET    /reviews/v1/api/list
GET    /reviews/v1/api/my
GET    /reviews/v1/api/chef
GET    /reviews/v1/api/dashboard
POST   /reviews/v1/api
PATCH  /reviews/v1/api/:id
DELETE /reviews/v1/api/:id

// ===== Users =====
GET    /users
GET    /users/dashboard
GET    /users/:id
PUT    /users
PUT    /users/:id
DELETE /users/:id

// ===== Home =====
GET    /
GET    /about
GET    /faqs
GET    /contect-us
```

- رسائل المستخدم النهائية تكون بالعربي (المنصة Arabic-first).
- حافظ على ترتيب الـ middleware الحالي إلا لو طُلب تغييره صراحة.