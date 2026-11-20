# دوق (DOQ)

منصة مصرية لطلب الأكل البيتي: العميل يطلب من تطبيق الموبايل، والمطبخ والدليفري والإدارة يشتغلوا من الويب.

## مكونات المشروع

| الجزء | المكان |
|---|---|
| السيرفر (Express 5 + EJS + MySQL) | `index.js`، `routes/`، `controller/`، `rendering/`، `views/`، `middlware/`، `utiles/`، `database/` |
| واجهة العميل على الويب و API الموبايل | `/m` و `/m/api/v1/*` (`routes/mobile.js`، `controller/mobile.js`) |
| المهام الدورية (تقارير، تسويات، تذكيرات) | `tasks/cron.js` |
| ترحيلات قاعدة البيانات | `scripts/migrate.js` (`npm run migrate`) |
| تطبيق الموبايل (Flutter) | `mobile_flutter/` (الـ APK والـ AAB بيتبنوا على GitHub Actions) |
| النشر على السيرفر | `server-bootstrap.sh`، `deploy.sh`، `update.sh`، `docker-compose.prod.yml`، `Caddyfile`، `deployment/` |

## النشر

أمر واحد على سيرفر Ubuntu 24.04 جديد. التفاصيل كلها في [DEPLOYMENT.md](DEPLOYMENT.md)، والمشاكل وحلولها في [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

```bash
sudo bash server-bootstrap.sh --domain your-domain.com --email you@example.com
```

بعد كده أي تحديث: `cd /opt/doq && sudo ./update.sh`

## الاختبارات

```bash
npm ci
npm test
```

## GitHub Actions

| الملف | بيعمل إيه |
|---|---|
| `.github/workflows/ci.yml` | اختبارات السيرفر وبناء صورة Docker والتأكد من ملفات النشر |
| `.github/workflows/flutter-apk.yml` | APK جاهز للتجربة |
| `.github/workflows/flutter-play-release.yml` | AAB موقّع لجوجل بلاي |
