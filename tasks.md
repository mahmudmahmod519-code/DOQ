understand code(dockerfile,dockercompose,envfiles and what env need it and what i don't need it,scripts what use it) -> create doc apis understand it


create missing pages with frontend(done)->testand&debugging(customer,admin,kitchn,deilvery)->hidden apis from git it & landing page button sign have error i sign in it alreade 
->backup->create mobile and how upload it->create banners->speack with kitchens and create vedios
->get domain->deploying



# errors
1. error number on in page dashboard as chef in page /chef/dashboard must when not have kitchen in dashboard show button in page only button have create kitchen use /kitchens/api/v1/ceate POST
2. in orders in /chef/orders.ejs this page must have the same theme dashboard chef page with navbar and make it responsive
3. page dashboard and dishes and kitchen and orders and payment and reviews must be f not have kitchen show button name انشاء مطبخ 
4. in payment for chef show this
```bash 
verified
حالة الحساب
?حالة الحساب???? ?????

???حالة الحساب ??? ???????? ??? ??????? ?? ???????
payments ???حالة الحساب ??? ???????? 
```
remove this ?? and make it data or date

5. fix chef my kitchen from this error : Error fetching dashboard data: Error: حصل عطل عندنا. جرب تاني بعد شوية
    fetchKitchenDashboardData http://localhost:3000/kitchens/my:633
    async* http://localhost:3000/kitchens/my:661
    EventListener.handleEvent* http://localhost:3000/kitchens/my:658

and 
19:28:05.623 XHR GET
http://localhost:3000/reviews/v1/api/chef?include_stats=true&limit=5&kitchen_id=1501
[HTTP/1.1 500 Internal Server Error 4ms]

	
GET
	http://localhost:3000/reviews/v1/api/chef?include_stats=true&limit=5&kitchen_id=1501
Status
500
Internal Server Error
VersionHTTP/1.1
Transferred1 kB (88 B size)
Referrer Policystrict-origin-when-cross-origin
DNS ResolutionSystem

    	
    Cache-Control
    	no-store
    Connection
    	keep-alive
    Content-Length
    	88
    Content-Security-Policy
    	default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self'; frame-src https://accept.paymob.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
    Content-Type
    	application/json; charset=utf-8
    Date
    	Sun, 04 Oct 2026 16:28:05 GMT
    ETag
    	W/"58-aetrSqQ5XgwF1Oidv8fBUtyMHVE"
    Keep-Alive
    	timeout=5
    Permissions-Policy
    	camera=(), microphone=(), geolocation=()
    Referrer-Policy
    	strict-origin-when-cross-origin
    X-Content-Type-Options
    	nosniff
    X-Frame-Options
    	DENY
    	
    Accept
    	*/*
    Accept-Encoding
    	gzip, deflate, br, zstd
    Accept-Language
    	en-US,en;q=0.9
    Connection
    	keep-alive
    Cookie
    	next-auth.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..ozcid_1TyOKhl5ds.WN_mtnoG_Ioyn_OjacHHf2cHMFJQlsTpJ64rG45G7PNkdFOeuncTZ_btLvBbzXyq9udsXCBtTO-fS7ngfutBV9s0LYlNq7pJOXUXYQ104UNGpMNo31ZrUw8BgRbCkB5cfG9hp7QPKwwqCUaB49-4-KZfMSF2HYMT3awGILMo_T4-AGCij_k9EaXb5W-Qb8his3SO1xHgCvTXdgMRamw04U3QzA2R_uzE379zryyk05mXOEUlvR3OIWAZ3VQoKXuCM_YAo5DAFGqBWIQPWsjtLixsJ-z04GgB9QAHyulA2K0ncMaLJlT1sP6J92lHhARyTtL9QFFzDGC8zmwu9xxkleXoM0XeGR8gyqpVMv0cKv2SqWn8zCKWZ7b61iCqWTzyI3o2m7t25rHEiodOT3glwt0JDtpEE5IoK8DUkU6ULTRXom…AEkTnbrFqA-M3AhhUltUTx4gMNFluWpIB7OIxAwcmUd7f5diwsQpZ-tOh2NXKhJUyDnN-KjGxWo82cY1VkAt2THxKYp6fr65p-AxMXKdObfL0ymjXzyg6PlYEh2OGq6VxA.2AMxS2FBR7snVSg8OkIEGw; opencode_session_49374=1793620554.VrvcQRcZrX5FQ6ymBlKYKxBmze3SbYTVt6MDFXJtbp4; oc_locale=en; doq_csrf_seed=be5120fe3870ca8cdb4f56517b26e843153e9d5b2935a70fc8f6c57843382d7f; session_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywic3YiOjAsInR5cGUiOiJzZXNzaW9uIiwiaWF0IjoxNzkxMTMwNjM5LCJleHAiOjE3OTE3MzU0Mzl9.ywdwBbNwkBz0irsDSPvNlERB9IYwTNaAUyhOW-PJNmg
    Host
    	localhost:3000
    Priority
    	u=4
    Referer
    	http://localhost:3000/kitchens/my
    Sec-Fetch-Dest
    	empty
    Sec-Fetch-Mode
    	cors
    Sec-Fetch-Site
    	same-origin
    User-Agent
    	Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:156.0) Gecko/20100101 Firefox/156.0

make if not have data in kitchen show you don't have data in kitchen

6. as customer in dishes reviews not show and status

7. the discount not show when enter copunt valid and click on it and add order not show my discount in the form

8. as customer when make device is mobile in page spcific kitchen show space in ui ux in latest page remove this space without fail design and functionalty for page  

9. page delivery must make theme same like anthor pages this page is /delivery/dashboard and add for this page button payment the same page payment in chef/payment

10. some pages create ejs for it but is not have render analysis this page and what is propuse it then tell me propse and i will tell you need it or not render

11. tell me routes don't used it and propse each route in project

12. make code in landing page not online because i will make this application mobile if open page not show ui ux without style

13. notification is good work but not notitfy me as deilvery or admin or customer or chef by any thing must notify me in all pages show as float message and add sound to know i have notification and tell me it change this code to mobile app this notification will add sound or not.

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








## final depug
1. remove all passwords to user from for_main to send it or any data
2. add cacheing headers for apis get and public folder with remove css and js from ejs in public
3. check design done
4. check apis done
5. check links done
6. connect all pages by self done
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