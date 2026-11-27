# دوق على Cloudflare (الخطة المجانية)

الكود بيشتغل على سيرفر مجاني، و Cloudflare قدامه بيعمل الآتي:

- يوصّل الزوار للسيرفر من غير ما يتفتح فيه أي بورت للويب (Cloudflare Tunnel).
- شهادة SSL.
- حماية من الهجمات.
- rate limit على صفحات الدخول.
- كاش للصور.
- تخزين النسخ الاحتياطية والصور في R2.

كله على الخطة المجانية.

```
الزوار / تطبيق الموبايل ──HTTPS──► Cloudflare (SSL + firewall + rate limit + cache)
                                        │  Tunnel (اتصال طالع من السيرفر)
                                        ▼
                              السيرفر: cloudflared ──► app:3000 ──► MySQL
                                                         │
                              R2: نسخ احتياطية مشفرة + نسخة من الصور
```

## ليه مش Workers مباشرة؟

سيرفر دوق مبني بـ Express و MySQL وقوالب EJS، وده مينفعش يشتغل على Workers المجانية:

- Cloudflare مفيهوش MySQL.
- EJS بتستخدم `new Function` وده ممنوع في Workers.
- كل طلب مسموحله 10ms معالجة بس.

نقل المشروع لـ Workers معناه إعادة كتابة السيرفر كله.

## المطلوب (مجاني)

1. **سيرفر:** أنسب اختيار Oracle Cloud Always Free، وفيه سيرفر ARM ببلاش (4 أنوية و 24GB رام). ملفات النشر بتشتغل على ARM.
   - ممكن يطلب كارت للتأكيد بس.
   - أحياناً يقولك مفيش سعة في المنطقة؛ جرّب منطقة تانية أو بعد شوية.
2. **دومين:** Cloudflare مبيديش دومين ببلاش. أرخص حل تشتري `.com` من Cloudflare Registrar بسعر التكلفة (حوالي 10 دولار في السنة)، أو من أي مسجّل وتضيفه لـ Cloudflare.
3. **حساب Cloudflare:** ضيف الدومين (Add a domain ثم Free)، وغيّر الـ nameservers عند المسجّل للي Cloudflare بيديهولك.

## الخطوات

### 1. API Token

من dash.cloudflare.com ← My Profile ← API Tokens ← Create Token ← Custom token، بالصلاحيات دي:

| النوع | الصلاحية | المستوى |
|---|---|---|
| Account | Cloudflare Tunnel | Edit |
| Account | Workers R2 Storage | Edit |
| Account | Account Rulesets | Edit |
| Account | Account Filter Lists | Edit |
| Zone | Zone | Read |
| Zone | DNS | Edit |
| Zone | Zone Settings | Edit |
| Zone | Zone WAF | Edit |
| Zone | Cache Rules | Edit |

وفي Zone Resources اختار الدومين بتاعك بس. الـ token بيتستخدم وقت التشغيل بس، مش بيتحفظ ولا بيتطبع.

### 2. R2 (اختياري بس مهم للنسخ الاحتياطية)

1. Dashboard ← R2 Object Storage ← فعّله. الخطة المجانية 10GB.
2. R2 ← Manage API tokens ← Create API token، بصلاحية Object Read & Write على الـ bucket `doq-storage`.
3. هتاخد Access Key ID و Secret، والسكريبت هيسألك عليهم.

### 3. على السيرفر (أمر واحد)

```bash
ssh ubuntu@SERVER_IP
curl -fsSL https://raw.githubusercontent.com/mahmudmahmod519-code/DOQ/main/server-bootstrap.sh -o server-bootstrap.sh
sudo bash server-bootstrap.sh --domain your-domain.com --email you@example.com --cloudflare
```

`--cloudflare` بيشغّل `deployment/cloudflare/setup.sh`، وده بيعمل الآتي:

| | اللي بيتعمل |
|---|---|
| Tunnel | tunnel اسمه `doq` يوصّل الدومين لـ `http://app:3000`، والـ token بيتحفظ في `.env.production` |
| DNS | سجل CNAME للدومين على الـ tunnel، والسحابة برتقالي (proxied) |
| SSL | Always HTTPS، و TLS 1.2 كحد أدنى، و TLS 1.3 |
| Firewall | حجب `/wp-*` و `*.php` و `/.env` و `/.git` و phpmyadmin. و `/admin` من برة مصر بيعدي على challenge الأول (من `CF_ADMIN_COUNTRIES`) |
| Rate limit | `/auth` (الدخول والتسجيل والـ OTP): 20 طلب كل 10 ثواني لكل IP، وبعدها حجب 10 ثواني. المجاني بيسمح بقاعدة واحدة، والتطبيق نفسه عنده حد 15 في الدقيقة كمان |
| Cache | الصور المرفوعة بتتخزن في Cloudflare 30 يوم |
| R2 | bucket اسمه `doq-storage`، فيه النسخ الاحتياطية اليومية مشفرة، ونسخة من الصور كل 15 دقيقة |

بعد كده `deploy.sh` بيشغّل كل حاجة، وبيقفل بورتات الويب في الـ firewall لأن الـ tunnel اتصال طالع من السيرفر بس.

**لو السيرفر شغال بالفعل بـ Caddy:**
```bash
cd /opt/doq
sudo ./deployment/cloudflare/setup.sh          # لو الدومين عليه سجلات قديمة: --replace-dns
sudo ./update.sh --no-pull
```

## تطبيق الموبايل

عنوان السيرفر بيتحط في مكان واحد. اختار طريقة من الاتنين:

1. **في الكود:** `mobile_flutter/lib/core/config.dart`
   ```dart
   const String kProductionServerUrl = 'https://your-domain.com';
   ```
   كل نسخة هتكلم السيرفر ده، وإعداد "عنوان السيرفر" هيختفي من التطبيق.

2. **من غير ما تعدّل الكود:** في GitHub ← Settings ← Secrets and variables ← Actions ← Variables، ضيف `DOQ_API_URL = https://your-domain.com`. الـ workflows بتمرره وقت البناء.

## ملاحظات

- **Bot Fight Mode متقفل عمداً:** بيعمل challenge لطلبات التطبيق (مش متصفح) ومينفعش يتعدّى في الخطة المجانية، فكان هيبوّظ التطبيق.
- **الـ IP الحقيقي للزائر:** في وضع الـ tunnel التطبيق بياخده من `CF-Connecting-IP`، فالـ rate limit بتاع التطبيق بيشتغل صح. ده بيتفعّل في الوضع ده بس، لأن السيرفر هنا مالوش أي بورت مفتوح.
- **Oracle Cloud:** الـ firewall بتاعه بيقفل كل البورتات افتراضياً، ومع الـ tunnel مش محتاج تفتح غير SSH.
- **الرجوع لـ Caddy:** خلّي `EDGE_MODE=caddy` في `.env.production`، ووجّه DNS للسيرفر (سجل A)، وشغّل `sudo ./update.sh --no-pull`.
- **استرجاع الصور على سيرفر جديد:** `sudo ./deployment/cloudflare/r2-sync.sh --restore`.
