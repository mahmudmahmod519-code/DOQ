# 📚 Admin API Documentation

> توثيق رسمي لـ APIs لوحة تحكم الأدمن  
> مشروع: **DOQ (دوق)** – منصة عربيات أكل الشارع  
> آخر تحديث: 2026-09-12

---

## 1. Overview

لوحة تحكم الأدمن توفر إدارة كاملة لكل موارد المنصة:

| المورد | الإمكانيات |
|--------|-----------|
| Users | عرض – بحث – تعديل دور – حذف |
| Kitchens (عربيات) | عرض – بحث – تعديل – حذف كامل (cascade) |
| Dishes | عرض – بحث – حذف + تقييماته |
| Reviews | عرض – فلترة – حذف أي تقييم |
| Categories | CRUD كامل |
| Dashboard | إحصائيات + أحدث البيانات + Top by Fair Score |

### Authentication
```js
auth → roles('admin')
```
- `auth`: يتحقق من JWT في الـ cookie (`session_token`) ويضع `req.user`
- `roles('admin')`: يسمح فقط لدور `admin`

### Base Path
```js
app.use('/admin', require('./routes/admin.js'));
```

كل الـ APIs تبدأ من: `/admin/api/v1/...`

---

## 2. Complete Routes Map

```
GET    /admin/                              → Render Dashboard (EJS)

GET    /admin/api/v1/dashboard              → Full dashboard data

GET    /admin/api/v1/users                  → List users
GET    /admin/api/v1/users/:id              → Get user + kitchen
PUT    /admin/api/v1/users/:id              → Update user
DELETE /admin/api/v1/users/:id              → Delete user

GET    /admin/api/v1/kitchens               → List kitchens
GET    /admin/api/v1/kitchens/:id           → Get kitchen
PUT    /admin/api/v1/kitchens/:id           → Update kitchen
DELETE /admin/api/v1/kitchens/:id           → Delete kitchen + dishes + reviews

GET    /admin/api/v1/dishes                 → List dishes
DELETE /admin/api/v1/dishes/:id             → Delete dish + reviews

GET    /admin/api/v1/reviews                → List reviews
DELETE /admin/api/v1/reviews/:id            → Delete review

GET    /admin/api/v1/categories             → List categories
POST   /admin/api/v1/categories             → Create category
PUT    /admin/api/v1/categories/:id         → Update category
DELETE /admin/api/v1/categories/:id         → Delete category
```

---

## 3. API Details

### 3.1 Dashboard
```
GET /admin/api/v1/dashboard
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "stats": {
      "totalUsers": 14820,
      "totalCustomers": 12000,
      "totalChefs": 2800,
      "totalAdmins": 20,
      "newUsersThisMonth": 340,
      "newUsersThisWeek": 85,
      "totalCarts": 348,
      "newCartsThisWeek": 8,
      "newCartsThisMonth": 27,
      "totalDishes": 1940,
      "newDishesThisMonth": 45,
      "totalReviews": 8650,
      "averageRating": 4.8,
      "ratingDistribution": {
        "5": 5200,
        "4": 2100,
        "3": 900,
        "2": 300,
        "1": 150
      }
    },
    "latestCarts": [
      {
        "id": 12,
        "title": "عربية أبو أحمد",
        "city": "القاهرة",
        "chef_name": "أحمد محمد",
        "dishes_count": 8,
        "reviews_count": 45,
        "avg_rating": 4.7,
        "fair_score": "4.58",
        "created_at": "2026-09-01T10:00:00.000Z"
      }
    ],
    "latestReviews": [ ... ],
    "topCartsByFairScore": [ ... ],
    "charts": {
      "cartsGrowthLast6Months": [
        { "month": "2026-04", "count": 12 },
        { "month": "2026-05", "count": 18 }
      ],
      "usersByRole": {
        "customer": 12000,
        "chef": 2800,
        "admin": 20
      }
    }
  }
}
```

**Use when:** Loading the main admin dashboard page.

---

### 3.2 Users

#### List Users
```
GET /admin/api/v1/users
```

| Query | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | رقم الصفحة |
| `limit` | number | 20 | عدد العناصر (max 50) |
| `q` | string | - | بحث في الاسم / الإيميل / الموبايل |
| `role` | string | - | `customer` \| `chef` \| `admin` |

#### Get Single User
```
GET /admin/api/v1/users/:id
```
يرجع بيانات المستخدم + بيانات العربيته لو كان `chef`.

#### Update User
```
PUT /admin/api/v1/users/:id
```
**Body (أي حقل اختياري):**
```json
{
  "first_name": "أحمد",
  "last_name": "محمد",
  "phone_number": "01012345678",
  "roles": "chef"
}
```

#### Delete User
```
DELETE /admin/api/v1/users/:id
```

**Business Rules:**
- لا يمكن حذف الحساب الحالي للأدمن.
- لا يمكن إزالة دور `admin` من الحساب الحالي.
- لا يمكن حذف مستخدم يمتلك عربية (يجب حذف العربية أولاً).

---

### 3.3 Kitchens (العربيات)

#### List Kitchens
```
GET /admin/api/v1/kitchens
```

| Query | Type | Description |
|-------|------|-------------|
| `page` | number | رقم الصفحة |
| `limit` | number | عدد العناصر |
| `q` | string | بحث في العنوان / الوصف / اسم الشيف |
| `city` | string | فلتر بالمدينة |

كل عربية ترجع معها:
- `dishes_count`
- `reviews_count`
- `avg_rating`
- `fair_score`

#### Get / Update / Delete
```
GET    /admin/api/v1/kitchens/:id
PUT    /admin/api/v1/kitchens/:id
DELETE /admin/api/v1/kitchens/:id
```

**عند الحذف (Cascade):**
1. حذف كل التقييمات المرتبطة بأطباق العربية
2. حذف كل الأطباق
3. حذف العربية نفسها

---

### 3.4 Dishes

```
GET    /admin/api/v1/dishes
DELETE /admin/api/v1/dishes/:id
```

**Query Parameters (List):**
| Query | Description |
|-------|-------------|
| `q` | بحث في اسم/وصف الطبق |
| `category` | اسم التصنيف |
| `kitchen` | عنوان العربية |
| `page` / `limit` | pagination |

**عند الحذف:** يتم حذف الطبق + كل تقييماته.

---

### 3.5 Reviews

```
GET    /admin/api/v1/reviews
DELETE /admin/api/v1/reviews/:id
```

**Query Parameters (List):**
| Query | Description |
|-------|-------------|
| `rating` | فلتر نجوم (1-5) |
| `q` | بحث في التعليق / اسم الطبق / اسم العربية |
| `page` / `limit` | pagination |

---

### 3.6 Categories

```
GET    /admin/api/v1/categories
POST   /admin/api/v1/categories
PUT    /admin/api/v1/categories/:id
DELETE /admin/api/v1/categories/:id
```

**Body (Create / Update):**
```json
{
  "name": "مشويات",
  "description": "لحوم مشوية على الفحم"
}
```

**Business Rule:**  
لا يمكن حذف تصنيف يحتوي على أطباق مرتبطة به.

---

## 4. Fair Score

```
fair_score = (count × avg + 20 × 4.2) / (count + 20)
```

| Parameter | Value | Meaning |
|-----------|-------|---------|
| C | 20 | Confidence constant |
| m | 4.2 | Prior mean |

يظهر في:
- `latestCarts`
- `topCartsByFairScore`
- قائمة العربيات
- قائمة الأطباق

---

## 5. Standard Response Format

### Success
```json
{
  "status": "success",
  "message": "تم ... بنجاح",
  "data": {},
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

### Error
```json
{
  "status": "error",
  "message": "رسالة الخطأ بالعربي"
}
```

---

## 6. Frontend Integration Guide

| UI Section | API Call |
|------------|----------|
| بطاقات الإحصائيات | `GET /admin/api/v1/dashboard` → `data.stats` |
| جدول أحدث العربيات | `data.latestCarts` |
| جدول أحدث التقييمات | `data.latestReviews` |
| أفضل 5 عربيات | `data.topCartsByFairScore` |
| رسم نمو العربيات | `data.charts.cartsGrowthLast6Months` |
| توزيع المستخدمين | `data.charts.usersByRole` |
| صفحة المستخدمين | `GET /admin/api/v1/users` |
| صفحة العربيات | `GET /admin/api/v1/kitchens` |
| صفحة الأطباق | `GET /admin/api/v1/dishes` |
| صفحة التقييمات | `GET /admin/api/v1/reviews` |
| صفحة التصنيفات | `GET /admin/api/v1/categories` |

### Recommended Fetch Pattern
```js
// Dashboard load
const res = await fetch('/admin/api/v1/dashboard');
const json = await res.json();

if (json.status === 'success') {
  const { stats, latestCarts, latestReviews, topCartsByFairScore, charts } = json.data;
  // render UI
}
```

---

## 7. Important Business Rules

1. الأدمن لا يستطيع حذف حسابه الحالي.
2. الأدمن لا يستطيع إزالة دور `admin` من حسابه.
3. لا يمكن حذف مستخدم يمتلك عربية.
4. حذف عربية → يحذف أطباقها وتقييماتها تلقائياً.
5. حذف طبق → يحذف تقييماته تلقائياً.
6. لا يمكن حذف تصنيف يحتوي على أطباق.
7. الجدول اسمه `kitchens` لكنه يمثل **عربيات أكل الشارع**.

---

## 8. File Locations

| File | Path |
|------|------|
| Controller | `controller/admin.js` |
| Router | `routes/admin.js` |
| Render (EJS) | `rendering/admin.js` → `Dashboard_render` |

---

## 9. How to use this file as a Prompt

عند التعامل مع أي AI أو مطور بخصوص لوحة الأدمن:

1. أرسل هذا الملف كاملاً.
2. أو أرسل القسم المطلوب فقط (Users / Kitchens / ...).
3. هذا الملف هو **المصدر الرسمي** لـ Admin APIs.

---

## 10. Relation to other project docs

| File | Content |
|------|---------|
| `businessPrompt.md` | وصف الفكرة والأدوار والنبرة |
| `tecPrompt.md` | الهيكل التقني العام + كل Routes المشروع |
| `README_REVIEWS_API` | توثيق تفصيلي للتقييمات |
| **This file** | توثيق تفصيلي كامل لـ Admin APIs |

---

**DOQ Admin** – تحكم كامل وشفاف في عربيات أكل الشارع.
