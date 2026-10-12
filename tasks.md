understand code(dockerfile,dockercompose,envfiles and what env need it and what i don't need it,scripts what use it) -> create doc apis understand it


create missing pages with frontend(done)->testand&debugging(customer,admin,kitchn,deilvery)->hidden apis from git it & landing page button sign have error i sign in it alreade 
->backup->create mobile and how upload it->create banners->speack with kitchens and create vedios
->get domain->deploying



# errors

8. as customer when make device is mobile in page spcific kitchen show space in ui ux in latest page remove this space without fail design and functionalty for page  

13. notification is good work but not notitfy me as deilvery or admin or customer or chef by any thing must notify me in all pages show as float message and add sound to know i have notification and tell me it change this code to mobile app this notification will add sound or not.


as deilvery have spenner must show data as all accounts the same and all orders he is sign it
/user/portfolio








---

---





---
اعلانات
https://www.facebook.com/logy.mostafa.148/ 
https://www.facebook.com/yahyaibrahim55/
https://www.facebook.com/groups/1135791784116965
وغيره كتير من الجروبات























2. 
header=portfolio image+fqs+about+contentus+auth
dashboard admin
dashboard chef
setting=update portfolio+reset+forget+logout
not found page404
server internal error page500
payment_pages


perhabes not remove all phone_number from all response to all kitchens and users but not 
apis show for admin



3.
commpreison for images
in upload middleware add other paramter name file to spcific is portfolio or portfolio kitchen or image dish 
or in upload can create more then middleware


function replace this code in function for loop to array then return update and params to use it in all apis:
    if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
    }
    if (price !== undefined) {
        updates.push('price = ?');
        params.push(price);
    }
    if (image_url !== undefined) {
        updates.push('image_url = ?');
        params.push(image_url);
    }

==========================================

create middleware to pass roles only add it 
check categories api to scraping



spcific kitchen deisgn and create it with prompt : kitchen-profile.ejs check apis in page



📋 TEST ACCOUNTS (all use password: TestAccount123!)
┌──────────────┬──────────────────────────────────────┬────────────┬──────────┐
│ Role         │ Email                                │ Phone      │ Status   │
├──────────────┼──────────────────────────────────────┼────────────┼──────────┤
│ Admin (Boot)  │ admin@doq.local                    │ 01012345678 │ Approved │
├──────────────┼──────────────────────────────────────┼────────────┼──────────┤
│ Customer    │ doq-test-customer@example.test       │ 01000000001 │ Approved │
│ Chef       │ doq-test-chef@example.test           │ 01000000002 │ Pending* │
│ Delivery    │ doq-test-delivery@example.test       │ 01000000003 │ Pending* │
│ Admin      │ doq-test-admin@example.test          │ 01000000004 │ Approved │
└──────────────┴──────────────────────────────────────┴────────────┴──────────┘





senario order
customer click on order -> order notfification for customer and the kitchen for dish -> show all orders for kitchen for this order on his dish -> ready the dish and click on accepted-> notification for all deilverys and show this order in ./deilvery/dashboard -> click on accepted get notification for customer and chef :deilvery take order and will take you-> chef send for deilvery dish ->chef click on button this order from accepted to is arrive -> send notification for customer your order with deilvery -> customer take order from deilvery chef click on button order complited 




## final depug
1. remove all passwords to user from for_main to send it or any data done
2. add cacheing headers for apis get and public folder with remove css and js from ejs in public
7. cron backup data for database every day
8. ازاي هعمل نسخ احدث والنسخ الجديدة شغالة من غير ميحصل اي خسارة للبيانات او العملاء وهل تخزين الصور على السرفر هيأثر علي حاجة
9. uuid to void ddos or idor or get any data



## markting
2. create automation to show mails and data in google sheet







## 📌 **المتطلبات العامة:**

- **الاتجاه:** RTL (من اليمين إلى اليسار) مع دعم كامل للغة العربية.
- **الخط:** Tajawal (من Google Fonts).
- **نظام الألوان (نفس هوية دوق):**
  - **الأساسي:** `#9e2016` (أحمر عنابي غامق)
  - **الثانوي:** `#fc7127` (برتقالي دافئ)
  - **الخلفيات:** `#fff8f6` (أبيض كريمي) و `#ffe9e6` (بيج فاتح)
  - **النصوص:** `#261816` (رمادي غامق دافئ)
- **التجاوب:** تعمل بشكل مثالي على جميع الأجهزة (جوال، جهاز لوحي، سطح مكتب).

---

## 📄 **مكونات الصفحة المطلوبة:**

### **1. الشريط الجانبي (Sidebar) - التنقل:**

شريط جانبي ثابت على اليمين (أو قابل للطي) يحتوي على:

| # | العنصر | الأيقونة | المسار |
|---|--------|----------|--------|
| 1 | **لوحة التحكم** | `dashboard` | `/admin/dashboard` |
| 2 | **المستخدمين** | `group` | `/users/dashboard` |
| 3 | **المطابخ** | `storefront` | `/admin/kitchens` |
| 4 | **الأطباق** | `restaurant_menu` | `/admin/dishes` |
| 5 | **التصنيفات** | `category` | `/admin/categories` |
| 6 | **التقييمات** | `star` | `/admin/reviews` |
| 7 | **الإعدادات** | `settings` | `/admin/settings` |
| 8 | **تسجيل الخروج** | `logout` | `/logout` |

**تصميم الشريط الجانبي:**
- خلفية داكنة (أو لون العلامة التجارية).
- العنصر النشط مميز بلون ثانوي أو خط سفلي.
- أيقونات بجانب كل عنصر.
- في الجوال: يتحول إلى درر (Drawer) يظهر عند النقر على أيقونة الهامبرغر.

---

### **2. الشريط العلوي (Top Navbar):**

- **شعار دوق** (على اليمين).
- **أيقونة الهامبرغر** (لطي/فتح الشريط الجانبي في الجوال).
- **أيقونة الإشعارات** (مع عداد).
- **صورة المستخدم + الاسم** (مع قائمة منسدلة: الملف الشخصي، الإعدادات، تسجيل الخروج).

---

### **3. قسم الإحصائيات (Stats Cards):**

في أعلى الصفحة، 4 بطاقات تعرض إحصائيات عامة:

| البطاقة | الأيقونة | اللون | القيمة (مثال) |
|---------|----------|-------|---------------|
| **إجمالي المستخدمين** | `people` | أساسي | `1,234` |
| **إجمالي المطابخ** | `storefront` | ثانوي | `89` |
| **إجمالي الأطباق** | `restaurant_menu` | أخضر | `567` |
| **إجمالي التقييمات** | `star` | أصفر | `2,341` |

**كل بطاقة تحتوي على:**
- أيقونة كبيرة.
- قيمة رقمية (مع تأثير عد تنازلي عند التحميل).
- عنوان وصفي.
- نسبة تغيير (مقارنة بالشهر الماضي) - اختياري.

---

### **4. مخططات بيانية (Charts):**

#### **أ. مخطط أعمدة:**
- **العنوان:** "عدد المستخدمين الجدد خلال الـ 7 أيام الماضية".
- **بيانات:** 7 أعمدة (لكل يوم).

#### **ب. مخطط دائري:**
- **العنوان:** "توزيع المستخدمين حسب الأدوار".
- **بيانات:** customer, chef, admin.

#### **ج. مخطط خطي:**
- **العنوان:** "عدد الطلبات خلال الشهر الماضي".
- **بيانات:** 30 نقطة (لكل يوم).

**ملاحظة:** استخدم مكتبة `Chart.js` أو `ECharts` لعرض المخططات (مع CDN).

---

### **5. جداول الإدارة (Management Tables):**

#### **أ. جدول المستخدمين (Users Table):**
- **العنوان:** "آخر المستخدمين المسجلين".
- **الأعمدة:** #, الاسم, البريد, الهاتف, الدور, تاريخ التسجيل, حالة (نشط/محظور), إجراءات (تعديل/حذف).
- **إجراءات:** زر "عرض الكل" → `/users/dashboard`.

#### **ب. جدول المطابخ (Kitchens Table):**
- **العنوان:** "آخر المطابخ المسجلة".
- **الأعمدة:** #, اسم المطبخ, الشيف, المدينة, عدد الأطباق, التقييم, الحالة, إجراءات.
- **إجراءات:** زر "عرض الكل" → `/admin/kitchens`.

#### **ج. جدول الأطباق (Dishes Table):**
- **العنوان:** "آخر الأطباق المضافة".
- **الأعمدة:** #, اسم الأكلة, المطبخ, التصنيف, السعر, التقييم, إجراءات.
- **إجراءات:** زر "عرض الكل" → `/admin/dishes`.

---

### **6. إدارة التصنيفات (Categories Management):**

**العنوان:** "إدارة التصنيفات".

**المكونات:**
- **زر إضافة:** "+ إضافة تصنيف جديد" (يفتح مودال).
- **جدول التصنيفات:**
  - الأعمدة: #, اسم التصنيف, الوصف, عدد الأطباق, تاريخ الإنشاء, إجراءات (تعديل/حذف).
- **مودال الإضافة/التعديل:**
  - حقل: اسم التصنيف (text).
  - حقل: الوصف (textarea).
  - أزرار: حفظ / إلغاء.

---

### **7. إدارة التقييمات (Reviews Management):**

**العنوان:** "آخر التقييمات".

**المكونات:**
- **جدول التقييمات:**
  - الأعمدة: #, المستخدم, الأكلة, التقييم (نجوم), التعليق, التاريخ, إجراءات (حذف).
- **فلترة:** تقييم (1-5 نجوم).

---

### **8. النشاطات الأخيرة (Recent Activity):**

**العنوان:** "آخر النشاطات".

**المكونات:**
- قائمة عمودية (Timeline) تعرض آخر 5 نشاطات:
  - "قام [المستخدم] بإضافة أكلة جديدة: [اسم الأكلة]".
  - "قام [المستخدم] بالتسجيل في المنصة".
  - "قام [المستخدم] بإضافة تقييم: [تقييم] نجوم".

---

### **9. البحث السريع (Quick Search):**

- شريط بحث في أعلى الصفحة (بجانب الإشعارات).
- عند الكتابة، تظهر نتائج البحث (مستخدمين، مطابخ، أطباق، تصنيفات).

---

### **10. إعدادات الأدمن (Admin Settings):**

- **زر "الإعدادات":** في الشريط الجانبي.
- **المحتوى:**
  - إعدادات عامة (اسم المنصة، الشعار، إلخ).
  - إعدادات البريد الإلكتروني (SMTP).
  - إعدادات الدفع (اختياري).

---

## 🔧 **المتطلبات التقنية:**

### **الـ APIs المستخدمة:**

| الـ API | الطريقة | الوظيفة |
|---------|---------|---------|
| `/admin/stats` | GET | جلب الإحصائيات العامة |
| `/users/dashboard` | GET | جلب جميع المستخدمين (مع Pagination) |
| `/admin/kitchens` | GET | جلب جميع المطابخ |
| `/admin/dishes` | GET | جلب جميع الأطباق |
| `/admin/categories` | GET, POST, PUT, DELETE | إدارة التصنيفات |
| `/admin/reviews` | GET, DELETE | إدارة التقييمات |
| `/admin/activity` | GET | جلب آخر النشاطات |
| `/logout` | GET | تسجيل الخروج |

### **المكتبات والأدوات:**
- **Tailwind CSS** عبر CDN.
- **Chart.js** أو **ECharts** للمخططات البيانية.
- **Material Symbols** أو **Font Awesome** للأيقونات.
- **JavaScript نقي (Vanilla JS)** مع `fetch` للتعامل مع الـ APIs.
- **SweetAlert2** أو مودالات مخصصة للتأكيد.
- الكود مكتوب في **ملف واحد متكامل (HTML + CSS مدمج + JavaScript مدمج)** بصيغة **EJS** ليتكامل مع مشروع Express.js.

---


## 🚀 **المخرجات المطلوبة:**

ملف واحد **جاهز للاستخدام** في مشروع Express.js مع محرك EJS، يحتوي على:
1. هيكل HTML كامل (مع تضمين المتغيرات من الـ Backend).
2. أنماط CSS مدمجة (عبر Tailwind).
3. JavaScript للتعامل مع الـ APIs:
   - جلب الإحصائيات (`GET /admin/stats`)
   - جلب التصنيفات (`GET /admin/categories`)
   - إضافة تصنيف (`POST /admin/categories`)
   - تعديل تصنيف (`PUT /admin/categories/:id`)
   - حذف تصنيف (`DELETE /admin/categories/:id`)
   - جلب النشاطات (`GET /admin/activity`)
4. جميع المحتويات النصية والمخططات البيانية المذكورة أعلاه.

---

## 💡 **ملاحظات إضافية:**

- **لا يتم إعادة تحميل الصفحة** عند تنفيذ أي عملية (استخدام Fetch API).
- **رسائل الخطأ والنجاح** تظهر في أعلى الصفحة وتختفي تلقائياً بعد 5 ثواني.
- **مؤشر التحميل** يظهر أثناء جلب البيانات أو حفظها.
- **تأكيد الحذف** يتم عبر SweetAlert2 أو Confirm Dialog مخصص.
- **جميع الجداول** تدعم Pagination والبحث والفلترة.

---

## 📊 **هيكل البيانات المتوقعة:**

### **الإحصائيات (`/admin/stats`):**
```json
{
    "total_users": 1234,
    "total_kitchens": 89,
    "total_dishes": 567,
    "total_reviews": 2341,
    "new_users_weekly": [12, 15, 8, 20, 18, 25, 30],
    "users_by_role": { "customer": 800, "chef": 400, "admin": 34 },
    "monthly_orders": [45, 52, 38, 65, 70, 55, ...]
}
```
التجميع والمعالجة المتوازية (Process Management):
تشغيل التطبيق باستخدام مدير عمليات مثل PM2 أو في بيئة Docker لضمان إعادة تشغيل التطبيق تلقائيًا عند الانهيار وتوزيع الحمل على أنوية المعالج (Cluster Mode).

التعامل مع الإغلاق الآمن (Graceful Shutdown):
الاستجابة لإشارات النظام (SIGTERM, SIGINT) لإغلاق اتصالات قاعدة البيانات والإنهاء التدريجي للطلبات الحالية قبل إيقاف السيرفر.










```sql
-- جدول طلبات إعادة تعيين كلمة المرور
CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    reset_code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_code (email, reset_code),
    INDEX idx_expires_at (expires_at)
);

-- تنظيف تلقائي للرموز المنتهية (يمكن تشغيله كـ Cron Job)
-- DELETE FROM password_resets WHERE expires_at < NOW() OR used = 1;
```