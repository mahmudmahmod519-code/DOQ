# 📚 Reviews API Documentation

> توثيق كامل لـ APIs التقييمات (Reviews)  
> مشروع: منصة مطابخ / أطباق  
> آخر تحديث: 2026-08-30

---

## 1. نظرة عامة (Overview)

نظام التقييمات يتيح للعملاء تقييم الأطباق، وللشيف والأدمن متابعة التقييمات والإحصائيات، مع نظام ترتيب عادل (Fair Ranking) يعتمد على **Bayesian Average** حتى لا يتظلم أصحاب الأطباق/المطابخ ذات عدد التقييمات القليل.

### الأدوار (Roles)
| Role       | الوصف                          |
|------------|--------------------------------|
| `customer` | عميل يقيّم الأطباق             |
| `chef`     | صاحب مطابخ / أطباق             |
| `admin`    | مدير النظام                    |

### المصادقة
كل الـ routes محمية بـ:
```js
auth → for_main('user', true, false) → req.user = req.my
```
ثم يتم التحقق من الـ role عبر middleware `roles(...)`.

---

## 2. Base Path

```
/reviews
```

جميع الـ endpoints التالية تبدأ من هذا المسار (حسب كيفية تركيب الـ router في التطبيق).

---

## 3. Render Routes (صفحات)

| Method | Path              | Roles              | الوصف                                      | متى تستخدمه |
|--------|-------------------|--------------------|--------------------------------------------|-------------|
| GET    | `/dashboard`      | `admin`, `chef`    | صفحة الـ Dashboard (HTML)                  | لما الشيف أو الأدمن يفتح صفحة إدارة التقييمات |
| GET    | `/reviews`        | `customer`         | صفحة عرض التقييمات لطبق أو مطبخ            | لما العميل يضغط "عرض كل التقييمات" |

**ملاحظات:**
- `/reviews` يعتمد على query `type=dish|kitchen` + الـ id من الـ frontend.
- هذه routes للـ **render** فقط (صفحات)، مش APIs بيانات.

### صفحات Render إضافية مقترحة
| Method | Path              | Roles       | الصفحة                         | الوصف |
|--------|-------------------|-------------|-------------------------------|-------|
| GET    | `/my-reviews`     | `customer`  | `./reviews/my_reviews`        | كل تقييمات العميل |
| GET    | `/review-form`    | `customer`  | `./reviews/review_form`       | فورم إضافة/تعديل تقييم |

---

## 4. كيفية استخدام الـ APIs داخل الصفحات (Frontend Integration)

هذا القسم يوضح **أي API تستدعيه من أي صفحة**، ومتى، ولماذا.

---

### 4.1 صفحة العميل: عرض تقييمات طبق / مطبخ
**Route:** `GET /reviews`  
**Template:** `./reviews/reviews`  
**Query متوقع:** `?type=dish&id=15` أو `?type=kitchen&id=3`

| الحدث في الصفحة              | الـ API اللي تستدعيه                      | ملاحظات |
|-----------------------------|-------------------------------------------|---------|
| تحميل الصفحة (طبق)          | `GET /v1/api/dish/:id`                    | تجيب آخر 10 تقييمات + `summary` (متوسط + fair_score + توزيع النجوم) |
| تحميل الصفحة (مطبخ)         | `GET /v1/api/kitchen/:id`                 | نفس الفكرة للمطبخ |
| الضغط على "تحميل المزيد"    | نفس الـ API (لو ضفت pagination لاحقاً)    | حالياً بيرجع 10 فقط |
| عرض النجوم / المتوسط        | استخدم `data.summary` من الـ response     | `average_rating` و `fair_score` و `rating_distribution` |

**مثال fetch:**
```js
// لو type=dish
const res = await fetch(`/reviews/v1/api/dish/${id}`);
const json = await res.json();
// json.data.reviews  → قائمة التقييمات
// json.data.summary  → المتوسط + fair_score + التوزيع
```

---

### 4.2 صفحة العميل: تقييماتي
**Route المقترح:** `GET /my-reviews`  
**Template:** `./reviews/my_reviews`

| الحدث في الصفحة              | الـ API اللي تستدعيه                      | ملاحظات |
|-----------------------------|-------------------------------------------|---------|
| تحميل الصفحة                | `GET /v1/api/my`                          | كل تقييماتي |
| فلترة حسب طبق               | `GET /v1/api/my?id=15`                    | تقييماتي على طبق معين |
| بحث / فلتر نجوم / pagination| `GET /v1/api/my?q=...&rating=5&page=2`    | يدعم كل الفلاتر |
| حذف تقييم                   | `DELETE /v1/api/:id`                      | بعد التأكيد |
| تعديل تقييم                 | يفتح فورم التعديل ثم `PATCH /v1/api/:id`  | - |

---

### 4.3 صفحة العميل: فورم إضافة / تعديل تقييم
**Route المقترح:** `GET /review-form?dish_id=15`  
**Template:** `./reviews/review_form`

| الحدث في الصفحة              | الـ API اللي تستدعيه                      | ملاحظات |
|-----------------------------|-------------------------------------------|---------|
| إرسال تقييم جديد            | `POST /v1/api`                            | Body: `{ rating, comment, dish_id }` |
| تعديل تقييم موجود           | `PATCH /v1/api/:id`                       | Body: `{ rating?, comment? }` |
| معرفة لو قيّمت الطبق قبل كده| `GET /v1/api/my?id=15`                    | لو رجع تقييم → وضع تعديل بدل إضافة |

**مثال إضافة:**
```js
await fetch('/reviews/v1/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dish_id: 15,
    rating: 5,
    comment: 'ممتاز جداً'
  })
});
```

---

### 4.4 صفحة الشيف: Dashboard التقييمات
**Route:** `GET /dashboard`  
**Template:** `./reviews/reviews_chef_dashboard`

| الحدث في الصفحة              | الـ API اللي تستدعيه                                      | ملاحظات |
|-----------------------------|-----------------------------------------------------------|---------|
| تحميل قائمة التقييمات       | `GET /v1/api/chef/dashboard?page=1&limit=10`              | بدون stats عشان أخف |
| تحميل الرسوم البيانية       | `GET /v1/api/chef/dashboard?include_stats=true`           | مرة واحدة عند فتح الصفحة أو تبويب الإحصائيات |
| فلتر حسب مطبخ               | `?kitchen_id=5&include_stats=true`                        | لو الشيف عنده أكتر من مطبخ |
| فلتر نجوم / بحث             | `?rating=5&q=جيد`                                         | - |
| عرض أعلى الأطباق            | استخدم `data.top_dishes` من نفس الـ response              | مترتبة بـ fair_score |
| رسم Pie Chart (توزيع النجوم)| `data.stats.rating_distribution`                          | `{5: 180, 4: 95, ...}` |
| رسم Line Chart (آخر 30 يوم)| `data.stats.reviews_over_time`                            | `[{date, count}, ...]` |

**مثال:**
```js
// عند فتح الـ Dashboard
const res = await fetch('/reviews/v1/api/chef/dashboard?include_stats=true&page=1&limit=10');
const json = await res.json();

// قائمة التقييمات
const reviews = json.data.reviews;

// الإحصائيات
const stats = json.data.stats;
// stats.total_reviews
// stats.average_rating
// stats.rating_distribution
// stats.reviews_over_time

// أعلى الأطباق
const topDishes = json.data.top_dishes;
```

---

### 4.5 صفحة الأدمن: Dashboard التقييمات
**Route:** `GET /dashboard`  
**Template:** `./admin/reviews`

| الحدث في الصفحة              | الـ API اللي تستدعيه                                      | ملاحظات |
|-----------------------------|-----------------------------------------------------------|---------|
| تحميل كل التقييمات          | `GET /v1/api/?page=1&limit=20`                            | مع pagination من middleware |
| تحميل الإحصائيات + الترتيب  | `GET /v1/api/?include_stats=true`                         | مرة واحدة |
| عرض أعلى المطابخ            | `data.top_kitchens`                                       | حسب fair_score |
| عرض أعلى الأطباق            | `data.top_dishes`                                         | حسب fair_score |
| حذف أي تقييم                | `DELETE /v1/api/:id`                                      | - |
| تعديل أي تقييم              | `PATCH /v1/api/:id`                                       | - |
| رسم الرسوم البيانية         | نفس `data.stats`                                          | زي الشيف |

**مثال:**
```js
const res = await fetch('/reviews/v1/api/?include_stats=true&page=1&limit=20');
const json = await res.json();

const reviews = json.data.reviews;
const stats = json.data.stats;
const topKitchens = json.data.top_kitchens;
const topDishes = json.data.top_dishes;
```

---

### 4.6 ملخص سريع: الصفحة → الـ APIs

| الصفحة                         | APIs الأساسية                                      | APIs إضافية (اختياري) |
|--------------------------------|----------------------------------------------------|------------------------|
| `reviews` (عميل - طبق/مطبخ)    | `GET /v1/api/dish/:id` أو `kitchen/:id`            | - |
| `my_reviews` (عميل)            | `GET /v1/api/my`                                   | `DELETE`, `PATCH` |
| `review_form` (عميل)           | `POST /v1/api` أو `PATCH /v1/api/:id`              | `GET /v1/api/my?id=` للتحقق |
| `reviews_chef_dashboard`       | `GET /v1/api/chef/dashboard`                       | `?include_stats=true` |
| `admin/reviews`                | `GET /v1/api/`                                     | `?include_stats=true` + `DELETE` + `PATCH` |

---

### 4.7 نصائح للـ Frontend

1. **لا تطلب `include_stats=true` في كل request** → استخدمه مرة عند تحميل لوحة الإحصائيات فقط.
2. **اعرض `fair_score` مش المتوسط العادي** في قوائم الترتيب.
3. **اعرض `average_rating` + عدد التقييمات** بجانب بعض (مثلاً: 4.6 ★ من 87 تقييم).
4. استخدم `rating_distribution` لعمل Progress bars أو Pie chart.
5. استخدم `reviews_over_time` لعمل Line chart لآخر 30 يوم.
6. بعد `POST` أو `PATCH` أو `DELETE` → أعد جلب البيانات أو حدّث الـ UI مباشرة.

---

## 5. API Routes (بيانات JSON)

### 4.1 تقييمات طبق معين

```
GET /v1/api/dish/:id
```

| العنصر        | القيمة                          |
|---------------|---------------------------------|
| **Roles**     | `customer`, `admin`             |
| **Params**    | `id` → رقم الطبق                |
| **Query**     | لا يوجد حالياً                  |
| **Response**  | `{ reviews: [], summary: {} }`  |

**ماذا تفعل؟**
- تجلب آخر 10 تقييمات للطبق.
- تجلب ملخص إحصائي: متوسط التقييم، عدد التقييمات، توزيع النجوم، و **fair_score**.

**متى تستخدمه؟**
- في صفحة تفاصيل الطبق (عرض بعض التقييمات + المتوسط).
- عند الضغط على "عرض المزيد" للطبق.

**مثال Response:**
```json
{
  "status": "success",
  "data": {
    "reviews": [
      {
        "id": 12,
        "rating": 5,
        "comment": "ممتاز",
        "created_at": "2026-08-28T10:00:00.000Z",
        "first_name": "أحمد",
        "last_name": "محمد"
      }
    ],
    "summary": {
      "total_reviews": 45,
      "average_rating": 4.65,
      "fair_score": 4.58,
      "rating_distribution": {
        "5": 28,
        "4": 12,
        "3": 3,
        "2": 1,
        "1": 1
      }
    }
  }
}
```

---

### 4.2 تقييمات مطبخ معين

```
GET /v1/api/kitchen/:id
```

| العنصر        | القيمة                          |
|---------------|---------------------------------|
| **Roles**     | `customer`, `admin`             |
| **Params**    | `id` → رقم المطبخ               |
| **Response**  | `{ reviews: [], summary: {} }`  |

**ماذا تفعل؟**
- تجلب آخر 10 تقييمات لكل أطباق المطبخ.
- تجلب ملخص إحصائي للمطبخ بالكامل + fair_score.

**متى تستخدمه؟**
- في صفحة المطبخ.
- عند عرض تقييمات المطبخ ككل.

---

### 4.3 تقييمات الشيف (Dashboard الشيف)

```
GET /v1/api/chef/dashboard
```

| العنصر        | القيمة                                      |
|---------------|---------------------------------------------|
| **Roles**     | `chef`                                      |
| **Query**     | `page`, `limit`, `q`, `rating`, `sort_by`, `sort_order`, `kitchen_id`, `include_stats` |

**Query Parameters:**

| Param           | Type    | Default      | الوصف                              |
|-----------------|---------|--------------|------------------------------------|
| `page`          | number  | 1            | رقم الصفحة                         |
| `limit`         | number  | 10           | عدد العناصر في الصفحة              |
| `q`             | string  | -            | بحث في نص التعليق                  |
| `rating`        | number  | -            | فلتر حسب النجوم (1-5)              |
| `sort_by`       | string  | `created_at` | `created_at` \| `rating` \| `id`   |
| `sort_order`    | string  | `DESC`       | `ASC` \| `DESC`                    |
| `kitchen_id`    | number  | -            | فلتر لمطبخ معين (يجب أن يملكه الشيف) |
| `include_stats` | string  | -            | `true` أو `1` لإرجاع الإحصائيات والترتيب |

**ماذا تفعل؟**
- تجلب تقييمات كل مطابخ الشيف (مع pagination وفلاتر).
- لو `include_stats=true`:
  - `stats`: إجمالي التقييمات، المتوسط، توزيع النجوم، تقييمات آخر 30 يوم.
  - `top_dishes`: أعلى 10 أطباق حسب **fair_score**.

**متى تستخدمه؟**
- في Dashboard الشيف لعرض قائمة التقييمات.
- لرسم الرسوم البيانية (Pie / Line / Bar).
- لعرض أعلى الأطباق أداءً بشكل عادل.

**مثال استخدام:**
```
GET /v1/api/chef/dashboard?page=1&limit=10&include_stats=true
GET /v1/api/chef/dashboard?kitchen_id=5&include_stats=true&rating=5
```

---

### 4.4 كل التقييمات (Dashboard الأدمن)

```
GET /v1/api/
```

| العنصر        | القيمة                          |
|---------------|---------------------------------|
| **Roles**     | `admin`                         |
| **Middleware**| `allRows('review')` → pagination|
| **Query**     | `include_stats` + أي query من الـ middleware |

**ماذا تفعل؟**
- تجلب كل التقييمات في النظام مع pagination.
- لو `include_stats=true`:
  - `stats` عامة للنظام.
  - `top_kitchens` حسب fair_score.
  - `top_dishes` حسب fair_score.

**متى تستخدمه؟**
- في Dashboard الأدمن.
- لرسم الرسوم البيانية العامة.
- لمعرفة أعلى المطابخ والأطباق في المنصة.

**مثال:**
```
GET /v1/api/?include_stats=true&page=1&limit=20
```

---

### 4.5 تقييماتي كعميل

```
GET /v1/api/my
```

| العنصر        | القيمة                                      |
|---------------|---------------------------------------------|
| **Roles**     | `customer`                                  |
| **Query**     | `page`, `limit`, `q`, `rating`, `sort_order`, `id` (dish_id) |

**ماذا تفعل؟**
- تجلب كل تقييمات العميل الحالي.
- لو `id` موجود → تقييمات العميل على طبق معين فقط.
- يدعم البحث والفلترة والترتيب والـ pagination.

**متى تستخدمه؟**
- في صفحة "تقييماتي".
- عند فتح طبق معين لمعرفة إذا كان العميل قيّمه من قبل (أو عرض تقييمه).

---

### 4.6 إضافة تقييم

```
POST /v1/api
```

| العنصر        | القيمة                |
|---------------|-----------------------|
| **Roles**     | `customer`            |
| **Body**      | `{ rating, comment, dish_id }` |

**قواعد:**
- العميل يقيّم الطبق **مرة واحدة فقط**.
- الطبق يجب أن يكون موجوداً.
- `rating` عادة من 1 إلى 5.

**متى تستخدمه؟**
- عند الضغط على "إرسال التقييم" في صفحة الطبق.

**Response نجاح:**
```json
{
  "status": "success",
  "message": "تم إضافة التقييم بنجاح"
}
```

---

### 4.7 تعديل تقييم

```
PATCH /v1/api/:id
```

| العنصر        | القيمة                          |
|---------------|---------------------------------|
| **Roles**     | `customer`, `admin`             |
| **Params**    | `id` → رقم التقييم              |
| **Body**      | `{ rating?, comment? }`         |

**قواعد:**
- العميل يقدر يعدل **تقييمه فقط**.
- الأدمن يقدر يعدل أي تقييم.
- لازم يبعت على الأقل حقل واحد للتعديل.

**متى تستخدمه؟**
- عند تعديل تقييم سابق من العميل أو الأدمن.

---

### 4.8 حذف تقييم

```
DELETE /v1/api/:id
```

| العنصر        | القيمة                |
|---------------|-----------------------|
| **Roles**     | `customer`, `admin`   |
| **Params**    | `id` → رقم التقييم    |

**قواعد:**
- العميل يحذف تقييمه فقط.
- الأدمن يحذف أي تقييم.

**متى تستخدمه؟**
- عند حذف تقييم من قائمة التقييمات أو من صفحة "تقييماتي".

---

## 6. نظام الترتيب العادل (Fair Score)

### لماذا؟
المتوسط العادي يظلم الأطباق/المطابخ ذات عدد التقييمات القليل.  
مثال: طبق عليه 3 تقييمات كلهم 5 → متوسط 5، بينما طبق عليه 200 تقييم متوسطه 4.7 يظهر أقل.

### الصيغة المستخدمة (Bayesian Average)

\[
\text{fair\_score} = \frac{(n \times \bar{r}) + (C \times m)}{n + C}
\]

| الرمز | المعنى                              | القيمة الحالية |
|-------|-------------------------------------|----------------|
| \( n \) | عدد التقييمات                     | من الداتابيز   |
| \( \bar{r} \) | متوسط التقييمات                | من الداتابيز   |
| \( C \) | ثابت الثقة (Confidence)           | **20**         |
| \( m \) | المتوسط العام للنظام              | **4.2**        |

- كل ما زاد `C` → محتاج تقييمات أكتر عشان يطلع لفوق.
- `m` يُفضل حسابه ديناميكياً من متوسط كل التقييمات لاحقاً.

### أين يظهر؟
- `summary.fair_score` في `/v1/api/dish/:id` و `/v1/api/kitchen/:id`
- `top_dishes` في Dashboard الشيف
- `top_kitchens` و `top_dishes` في Dashboard الأدمن

---

## 7. ملخص سريع: متى تستخدم أي API؟

| السيناريو                              | الـ API المناسب                              |
|----------------------------------------|----------------------------------------------|
| عرض تقييمات طبق + المتوسط              | `GET /v1/api/dish/:id`                       |
| عرض تقييمات مطبخ + المتوسط             | `GET /v1/api/kitchen/:id`                    |
| Dashboard الشيف + رسوم بيانية          | `GET /v1/api/chef/dashboard?include_stats=true` |
| Dashboard الأدمن + رسوم بيانية         | `GET /v1/api/?include_stats=true`            |
| قائمة تقييماتي كعميل                   | `GET /v1/api/my`                             |
| تقييماتي على طبق معين                  | `GET /v1/api/my?id=15`                       |
| إضافة تقييم جديد                       | `POST /v1/api`                               |
| تعديل تقييمي                           | `PATCH /v1/api/:id`                          |
| حذف تقييمي / حذف أي تقييم (أدمن)       | `DELETE /v1/api/:id`                         |
| صفحة HTML للشيف/أدمن                   | `GET /dashboard`                             |
| صفحة HTML للتقييمات (عميل)             | `GET /reviews`                               |

---

## 8. هيكل الـ Response الموحد

### نجاح
```json
{
  "status": "success",
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "total_pages": 10
  }
}
```

### خطأ
```json
{
  "status": "error",
  "message": "وصف الخطأ بالعربية أو الإنجليزية"
}
```

---

## 9. ملاحظات مهمة للمطور / للـ AI

1. **الأمان:** كل الـ queries تستخدم Prepared Statements (لا يوجد SQL Injection).
2. **الصلاحيات:** العميل لا يستطيع تعديل أو حذف تقييم غيره.
3. **التقييم مرة واحدة:** العميل لا يستطيع تقييم نفس الطبق مرتين.
4. **Fair Score:** استخدمه دائماً في الترتيب وليس المتوسط العادي.
5. **include_stats:** لا تطلبه إلا عند الحاجة (لوحة التحكم) لتقليل الحمل على الداتابيز.
6. **الـ middleware `allRows('review')`:** مسؤول عن الـ pagination في endpoint الأدمن.
7. **الـ role field:** تحقق من `req.user.role` أو `req.user.roles` حسب ما يخزنه نظام المصادقة عندك.

---

## 10. قائمة الـ Routes الكاملة (للـ Router)

```js
// Render
GET  /dashboard                          → roles('admin','chef')
GET  /reviews                            → roles('customer')
GET  /my-reviews                         → roles('customer')        // مقترح
GET  /review-form                        → roles('customer')        // مقترح

// APIs
GET  /v1/api/chef/dashboard              → roles('chef')
GET  /v1/api/kitchen/:id                 → roles('customer','admin')
GET  /v1/api/dish/:id                    → roles('customer','admin')
GET  /v1/api/my                          → roles('customer')
GET  /v1/api/                            → roles('admin') + allRows('review')
POST /v1/api                             → roles('customer')
PATCH /v1/api/:id                        → roles('customer','admin')
DELETE /v1/api/:id                       → roles('customer','admin')
```

---

## 11. اقتراحات مستقبلية (اختياري)

- جعل قيم `C` و `m` قابلة للتهيئة من الإعدادات أو حساب `m` ديناميكياً.
- إضافة pagination حقيقي لـ `/v1/api/dish/:id` و `/v1/api/kitchen/:id`.
- إضافة endpoint منفصل للإحصائيات فقط لو احتجت أداء أعلى.
- دعم فلترة حسب التاريخ في الـ stats.

---

**هذا الملف يُستخدم كـ:**
- توثيق رسمي للـ APIs
- Prompt لأي AI يعمل على المشروع
- مرجع للمطورين في الـ Frontend والـ Backend
