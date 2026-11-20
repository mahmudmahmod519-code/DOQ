# رفع تطبيق دوق على Google Play

الـ workflow `.github/workflows/flutter-play-release.yml` بيطلع **ملف `.aab` موقّع بمفتاح الرفع (upload key)** وجاهز يترفع على Play Console. وكمان بيطلع APK موقّع بنفس المفتاح للتجربة، وملفات الـ symbols والـ mapping.

مواصفات النسخة:
- **targetSdk 36 (Android 16):** ده المطلوب لأي تطبيق جديد أو تحديث على Play من 31 أغسطس 2026.
- **HTTPS فقط:** الاتصال بـ http مقفول (`usesCleartextTraffic=false`).
- **عنوان السيرفر ثابت جوه النسخة** (`DOQ_LOCK_SERVER`)، والعميل مش هيشوف إعداد "عنوان السيرفر".
- **حذف الحساب من جوه التطبيق:** حسابي ← حذف الحساب نهائياً. وفيه صفحة ويب للحذف: `https://DOMAIN/police/delete-account`. الاتنين شرط من Google لأي تطبيق فيه تسجيل حساب.
- **الكود متعمّله obfuscate**، والـ symbols بتتحفظ مع كل build.
- **رقم الإصدار (versionCode) بيزيد لوحده** مع كل تشغيل: 1000 + رقم التشغيل.

---

## 1) مرة واحدة: مفتاح الرفع (Upload key)
على جهازك (محتاج Java/JDK):
```bash
cd mobile_flutter
./tool/create-upload-key.sh          # بيعمل ~/doq-upload-keystore.jks ويطبع القيم
```
احفظ ملف `.jks` وكلمة السر في مكان آمن، يعني password manager ونسخة offline. **ماترفعوش على GitHub أبداً.**
مع Play App Signing، جوجل هي اللي بتحتفظ بمفتاح التوقيع النهائي. لو مفتاح الرفع ضاع تقدر تطلب Reset من Play Console.

## 2) مرة واحدة: إعدادات GitHub
Repository ← Settings ← Secrets and variables ← Actions:

| النوع | الاسم | القيمة |
|---|---|---|
| Secret | `ANDROID_KEYSTORE_BASE64` | محتوى ملف `doq-upload-keystore.jks.base64.txt` (امسح الملف بعد ما تنسخه) |
| Secret | `ANDROID_KEYSTORE_PASSWORD` | كلمة سر الـ keystore |
| Secret | `ANDROID_KEY_ALIAS` | `upload` |
| Secret | `ANDROID_KEY_PASSWORD` | نفس كلمة السر |
| Variable | `DOQ_API_URL` | `https://دومينك` (لازم HTTPS، وهو اللي اتنشر بـ deploy.sh) |
| Variable | `DOQ_APPLICATION_ID` | اسم الباكدج. الافتراضي `com.doq.doq_customer`. **مينفعش يتغير بعد أول رفع** |
| Secret (اختياري) | `PLAY_SERVICE_ACCOUNT_JSON` | للرفع الأوتوماتيك (الخطوة 6) |

## 3) بناء النسخة
GitHub ← Actions ← **DOQ Customer – Google Play release (AAB)** ← Run workflow:
- `version_name`: مثلاً `1.0.0`
- سيب `upload_to_play` مقفول أول مرة.

أو بـ tag:
```bash
git tag play-v1.0.0 && git push origin play-v1.0.0
```
لما يخلص: افتح الـ run ← Artifacts ← `doq-customer-play-1.0.0-10xx`. جواه:
- `doq-customer-1.0.0-10xx.aab` ← **ده اللي بيترفع على Play**
- `doq-customer-1.0.0-10xx.apk` ← نفس النسخة لو عايز تجربها على موبايلك
- `debug-symbols-*.zip` و `mapping-*.txt` ← ارفعهم في Play Console (App bundle explorer) عشان تقارير الأعطال تبقى مقروءة

الـ workflow بيفشل ويقولك السبب بوضوح في الحالات دي:
- secret ناقص
- كلمة السر أو الـ alias غلط
- `DOQ_API_URL` مش HTTPS
- الملف اتوقّع بمفتاح debug

## 4) أول رفع على Play Console (لازم يكون يدوي)
1. اعمل حساب مطور على https://play.google.com/console. الحساب الشخصي محتاج **التحقق من الهوية**.
2. Create app: الاسم **دوق**، اللغة الافتراضية العربية، App، Free.
3. **Testing ← Internal testing ← Create new release**، فعّل **Play App Signing** (موصى بيه)، وارفع ملف `.aab`.
4. **حساب شخصي اتعمل بعد نوفمبر 2023؟** لازم الأول **Closed testing بـ 12 مختبِر على الأقل لمدة 14 يوم متواصلة**، وبعدها تقدر تطلب Production access.

## 5) بيانات صفحة المتجر والسياسات (Main store listing + App content)
- **App icon:** `mobile_flutter/store/play-icon-512.png`
- **Feature graphic:** `mobile_flutter/store/feature-graphic-1024x500.png`
- **Screenshots:** من موبايل حقيقي، على الأقل 2 (الرئيسية، الطبق، تتبع الطلب).
- **الاسم:** دوق - أكل بيتي
- **وصف قصير (80 حرف):** اطلب أكل بيتي من مطابخ قريبة منك وتابع طلبك لحظة بلحظة
- **وصف كامل:**
  > دوق بيوصلك بمطابخ بيتي قريبة منك. اختار الطبق، حدد الكمية واكتب كود الخصم لو معاك، وتابع طلبك خطوة بخطوة من أول ما المطبخ يقبله لحد ما يوصلك مع المندوب.
  > • تصفح المطابخ والأطباق حسب التصنيف والمدينة
  > • تقييمات حقيقية من العملاء
  > • إشعارات فورية بحالة الطلب
  > • المفضلة وإعادة الطلب بضغطة
- **Privacy policy:** `https://DOMAIN/police/privacy-policy`
- **Data deletion (Data safety ← Delete account URL):** `https://DOMAIN/police/delete-account`
- **App access:** اكتب حساب تجربة (إيميل وكلمة سر) عشان فريق المراجعة يدخل.
- **Ads:** No ads.
- **Content rating:** املأ الاستبيان. الفئة Food & Drink، ومفيش محتوى حساس.
- **Target audience:** 18+.
- **Data safety:**

  | البيانات | تتجمع؟ | الغرض | ملاحظات |
  |---|---|---|---|
  | Name, Email, Phone, Address | نعم | App functionality, Account management | مطلوبة لتوصيل الطلب |
  | Purchase history (orders) | نعم | App functionality | |
  | App interactions (reviews/favourites) | نعم | App functionality | |
  | Location (GPS) | لا | | التطبيق مش بيستخدم GPS |
  - البيانات **مشفرة أثناء النقل** (HTTPS)
  - المستخدم **يقدر يطلب حذف بياناته**
  - **مفيش مشاركة بيانات مع أطراف تانية** (المطبخ والمندوب بيشوفوا بيانات التوصيل لتنفيذ الطلب فقط، ودي تتعد App functionality)

## 6) الرفع الأوتوماتيك (اختياري، بعد أول رفع يدوي)
1. Play Console ← Users and permissions ← Invite **service account** من Google Cloud، وادّيه صلاحية Release لتطبيق دوق.
2. حط ملف الـ JSON بتاعه في Secret اسمه `PLAY_SERVICE_ACCOUNT_JSON`.
3. شغّل الـ workflow مع `upload_to_play = true` واختار الـ track. النسخة بتترفع **Draft**، وانت اللي بتعمل Review وRollout من Play Console.

## ملاحظات
- كل تحديث: شغّل الـ workflow برقم إصدار أعلى، زي `1.0.1`. الـ versionCode بيزيد لوحده.
- الإشعارات بتشتغل والتطبيق مفتوح أو في الخلفية لفترة قصيرة (polling). عشان إشعارات والتطبيق مقفول محتاج Firebase Cloud Messaging، ودي خطوة منفصلة.
- workflow الـ APK القديم (`flutter-apk.yml`) لسه موجود للتجربة السريعة، وموقّع بمفتاح debug ومسموح فيه http. **ماترفعش ملفاته على Play.**
