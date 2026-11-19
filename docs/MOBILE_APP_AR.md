# تطبيق العميل على الموبايل (`/m`)

العميل اتفصل عن الموقع. الموقع بقى للإدارة والمطبخ والدليفري، والعميل بيستخدم تطبيق الموبايل اللي بيفتح على `/m` (نفس السيرفر ونفس الهوية والألوان).

## الصفحات
| المسار | الوصف |
|---|---|
| `/m` | الرئيسية: بحث + تصنيفات + مطابخ جديدة + كل الأطباق (Infinite scroll) |
| `/m/kitchens` و `/m/kitchens/:id` | المطابخ والمنيو |
| `/m/dishes/:id` | الطبق + التقييمات + الطلب (Bottom sheet مع كوبون) |
| `/m/orders` و `/m/orders/:publicId` | طلباتي + تتبع الطلب لحظياً |
| `/m/favourites` | المفضلة |
| `/m/notifications` | الإشعارات |
| `/m/account` | بياناتي وعنوان التوصيل وتقييماتي وتسجيل الخروج |
| `/m/auth` | دخول / حساب جديد (عميل فقط) |

## الـ API (Cursor pagination)
كل القوايم بترجع `{ items, next_cursor, has_more }`. الصفحة اللي بعدها: `?cursor=<next_cursor>`.

`GET /m/api/v1/home | cities | dishes | dishes/:id | dishes/:id/reviews | kitchens | kitchens/:id`
`GET /m/api/v1/me | orders?status=active|done | orders/:publicId | favourites | notifications | reviews/my` (عميل مسجل)

## التحويل من الموقع
أي زائر أو عميل يفتح `/dishes`, `/kitchens`, `/my-orders`, `/reviews/my-reviews`, `/users/profile`, `/notifications` بيتحول للصفحة المقابلة في `/m`. تطبيق الأندرويد (`com.doq.app`) لما يفتح `/` بيتحول لـ `/m` تلقائياً.

## الإشعارات والصوت
كل الصفحات (ويب وموبايل ولكل الأدوار) بتعمل poll على `/notifications/api/poll` كل 10 ثواني، وأي إشعار جديد بيظهر كرسالة عائمة مع صوت واهتزاز.
داخل الـ WebView الصوت بيشتغل بعد أول لمسة للشاشة. عشان يشتغل من غير لمسة ويطلع إشعار نظام والتطبيق في الخلفية، ضيف في `MainActivity.java`:

```java
webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
webView.addJavascriptInterface(new Object() {
    @android.webkit.JavascriptInterface
    public void notify(String title, String body) { /* NotificationCompat.Builder ... */ }
}, "DOQAndroid");
```

## تطبيق Flutter (APK أصلي)
فيه كمان تطبيق Flutter أصلي للعميل في `mobile_flutter/` بيستخدم نفس الـ APIs، ويتبني APK جاهز من GitHub Actions بالـ workflow `.github/workflows/flutter-apk.yml`. التفاصيل في `mobile_flutter/README.md`.
