# DOQ Mobile (Android APK)

A minimal Android **WebView wrapper** around the DOQ website. The APK has no business logic of its own — it loads your running DOQ server, so the app always shows the same data/features as the website.

The **server URL is configurable at runtime** (first-launch dialog + overflow menu), so one APK works with:

- A laptop hotspot / LAN: `http://192.168.x.x:8080`
- ngrok: `https://xxxx.ngrok-free.app`
- Cloudflare Tunnel: `https://xxxx.trycloudflare.com`
- A cloud deployment: `https://doq.fly.dev` (or your domain)

---

## 1. Build the APK with GitHub Actions

1. Commit and push the `mobile/` folder + `.github/workflows/android-apk.yml` to `main`.
2. Open your repository on GitHub → **Actions** → **Build DOQ Mobile APK** → **Run workflow**.
3. (Optional) Fill **Default server URL** — e.g. `http://192.168.1.10:8080`. You can still change it inside the app.
4. Wait ~3–6 minutes for the green run.
5. Open the run → **Artifacts** → download **`doq-mobile-debug-apk`** → unzip → `app-debug.apk`.

The workflow also runs automatically on pushes that change `mobile/**`.

### Install on the phone

- Copy `app-debug.apk` to the phone and open it, allowing **"Install unknown apps"** for your file manager/browser.
- Or over USB: `adb install -r app-debug.apk`
- The APK is **debug-signed**, which is fine for testing. For Play Store distribution you would add a release keystore.

---

## 2. Run the server so the phone can reach it

### Option A — Laptop hotspot / same Wi-Fi (recommended for quick testing)

1. Start MySQL and the app on the laptop:
   ```bash
   npm start
   ```
   The `.env` uses `PORT=8080`, so the site is on `http://localhost:8080`.
2. Find the laptop's LAN IP:
   - Linux: `hostname -I` or `ip addr`
   - Windows: `ipconfig` (a Windows hotspot is often `192.168.137.1`)
   - macOS: `ipconfig getifaddr en0`
3. Connect the phone to the same hotspot/Wi-Fi.
4. In the app, enter: `http://<LAPTOP_IP>:8080`
   Example: `http://192.168.137.1:8080`
5. If it does not connect, allow port **8080** through the laptop firewall.

> Express listens on all interfaces by default, so no code change is needed. Make sure `NODE_ENV=development` in `.env` while testing over plain HTTP — production mode sets `Secure` cookies, which browsers/WebView reject over HTTP.

### Option B — ngrok

```bash
ngrok http 8080
```

Use the generated `https://....ngrok-free.app` URL in the app. On the free plan ngrok may show a one-time "You are about to visit…" warning page — tap **Visit Site**; the WebView keeps the cookie afterwards.

### Option C — Cloudflare Tunnel (no interstitial)

```bash
cloudflared tunnel --url http://localhost:8080
```

Use the generated `https://....trycloudflare.com` URL.

### Option D — Cloud deployment (Fly.io)

The repo already has `fly.toml` (app `doq`, internal port `8080`, HTTPS enforced). Deploy with `fly deploy`, then use your public URL (e.g. `https://doq.fly.dev`) in the app.

> Note: if by "cloudinary" you meant the image CDN — you don't need it for the APK. The APK only needs a reachable DOQ server (Node.js + MySQL). Uploaded images are served by the app itself from `/uploads`.

---

## 3. Test data / accounts

The app shows whatever is in your database. For local testing:

```bash
npm run bootstrap:test-accounts
```

This creates the dev-only accounts (see `scripts/bootstrap-test-accounts.js`), e.g.:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@doq.local` | `TestAccount123!` |
| Customer | `doq-test-customer@example.test` | `TestAccount123!` |
| Chef | `doq-test-chef@example.test` | `TestAccount123!` |
| Delivery | `doq-test-delivery@example.test` | `TestAccount123!` |
| Admin | `doq-test-admin@example.test` | `TestAccount123!` |

Chef/delivery accounts may start as **Pending** — approve them from **Admin → Operations** (`/admin/operations`) before testing their dashboards.

If you need demo kitchens/dishes, run the seed script (requires `DOQ_SEED_PASSWORD` to be set):

```bash
node scripts/seed_data.js
```

---

## 4. Using the app

- **First launch:** a dialog asks for the server URL (e.g. `http://192.168.1.10:8080`). It is saved on the device.
- **⋮ menu:** Reload, Home, **Change server URL**.
- **Back button:** navigates WebView history, then exits.
- **File uploads** (kitchen/dish images, profile photos): the system file picker opens; selected files are uploaded through the normal website forms.
- **Connection errors:** an Arabic dialog offers retry or changing the server URL.
- Cookies, sessions, CSRF, 2FA, and notifications work exactly as in the browser.

---

## 5. Troubleshooting

| Symptom | Fix |
|---|---|
| "تعذر الاتصال بالسيرفر" | Server not running, wrong IP, phone on a different network, or firewall blocking port 8080 |
| Works on laptop, not on phone | Use the laptop's LAN IP (not `localhost`/`127.0.0.1`), same hotspot/Wi-Fi, allow the port in the firewall |
| Login fails over HTTP | Set `NODE_ENV=development` (production sets `Secure` cookies) or use an HTTPS tunnel |
| Images/uploads fail | Check `public/upload` permissions and that `DOQ_...` upload env/config is valid |
| App shows old page | ⋮ → Reload (or clear app data to reset the saved URL) |
| ngrok warning page | Tap "Visit Site"; the cookie is kept for later requests |
| Build fails in Actions | Check the run log; Gradle/AGP versions are pinned in `mobile/` |

---

## 6. Project layout

```
mobile/
  settings.gradle            # Gradle modules + repositories
  build.gradle               # AGP plugin version
  gradle.properties
  app/
    build.gradle             # app config + DEFAULT_SERVER_URL buildConfig field
    src/main/
      AndroidManifest.xml    # INTERNET permission, cleartext HTTP for testing
      java/com/doq/app/MainActivity.java
      res/values/strings.xml
      res/drawable/ic_launcher.xml
.github/workflows/android-apk.yml
```

### Changing the app

- **Default URL:** edit the `server_url` workflow input, or pass `-PdoqServerUrl="..."` to Gradle.
- **Behavior:** edit `MainActivity.java` (WebView settings, menus, dialogs).
- **Package name / version:** `mobile/app/build.gradle` (`applicationId`, `versionCode`, `versionName`).

---

## 7. Security notes (test build)

- `android:usesCleartextTraffic="true"` is enabled so plain `http://` works on a hotspot. Prefer HTTPS tunnels/cloud URLs when possible.
- The APK is **debug-signed** and intended for testing, not public distribution.
- The WebView does **not** bypass TLS errors; a self-signed HTTPS certificate will fail.
- All authentication, CSRF, and role checks still happen on the server — the wrapper adds no security surface beyond the browser.
