# دوق — تطبيق العميل (Flutter)

تطبيق Android أصلي للعميل اللي بيطلب الأكل. بيكلم نفس سيرفر دوق على `/m/api/v1` (Cursor pagination) و APIs الطلب والكوبون والمفضلة والتقييم والإشعارات.

## المميزات
- الرئيسية: بحث + تصنيفات + مطابخ جديدة + كل الأطباق بـ infinite scroll (cursor).
- المطابخ (بحث + فلتر مدينة)، صفحة المطبخ والمنيو.
- صفحة الطبق: تفاصيل، مكونات، تقييمات (cursor)، تقييمك، طلب (اسم الطلب + الكمية + كوبون + ملخص) مع Idempotency-Key.
- طلباتي (الحالية / السابقة) + تتبع الطلب لحظياً بخط زمني + إلغاء قبل قبول المطبخ.
- المفضلة، الإشعارات (قراءة الكل)، حسابي (البيانات وعنوان التوصيل وتقييماتي) وتسجيل الخروج.
- دخول / حساب جديد للعميل + المصادقة الثنائية (2FA) لو مفعلة.
- إشعارات: كل 10 ثواني بيسأل السيرفر، وأي إشعار جديد بيطلع **إشعار نظام بصوت** + Banner جوه التطبيق + اهتزاز.
- عنوان السيرفر بيتغير من جوه التطبيق (أول تشغيل أو من حسابي).

## البناء على GitHub Actions
1. اعمل push لفولدر `mobile_flutter/` والـ workflow `.github/workflows/flutter-apk.yml`.
2. GitHub → Actions → **Build DOQ Customer APK (Flutter)** → Run workflow (ممكن تكتب Server URL).
3. بعد ما يخلص: افتح الـ run → Artifacts → `doq-customer-apk` → فك الضغط → ثبّت الـ APK.
4. لو عملت tag زي `mobile-v1.0.0` الـ APK بيتنشر في GitHub Release.

> فولدر `android/` مش متخزن في الريبو؛ الـ workflow بيولّده بـ `flutter create` وبعدين `tool/patch_android.py` بيضيف الصلاحيات والاسم والأيقونة و `MainActivity` الخاص بالإشعارات.

## تشغيل محلي
```bash
cd mobile_flutter
flutter create --project-name doq_customer --org com.doq --platforms android .
python3 tool/patch_android.py
flutter pub get
flutter run --dart-define=DOQ_API_URL=http://192.168.1.10:8080
```
