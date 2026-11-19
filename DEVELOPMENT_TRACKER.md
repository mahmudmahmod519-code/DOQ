# DOQ Development Tracker

## Completed
- Task 1: customer mobile app separated (`/m` web + Flutter app `mobile_flutter/`), cursor pagination APIs `/m/api/v1/*`
- Task 2: order lifecycle fixes (handoff after delivery accepts, completion rules, cancel rules), logout POST, /auth redirect, delivery dashboard spinner, XSS-safe escaping
- Task 3: admin reports per kitchen/delivery + suspend/ban (verified; open offers of suspended kitchens hidden)
- Task 4: health API `/health`, `/health/ready`, `/api/v1/health`
- Global floating notifications with sound (web) + system notifications with sound (Flutter)
- Flutter APK GitHub Actions workflow (`.github/workflows/flutter-apk.yml`)
- Production deployment: `docker-compose.prod.yml`, multi-stage `Dockerfile`, Nginx + Certbot, `deploy.sh`, `update.sh`, backups/restore/health, systemd timers, docs
- Graceful SIGTERM shutdown in `index.js`

## Verified locally (this environment)
- `docker compose config` for the production stack (valid; only 80/443 published; missing secrets rejected)
- Bash syntax of every script; env helpers (create/derive/generate/validate, `$` and length checks)
- Nginx templates rendered + structural check (no `nginx -t`: image registry not reachable here)
- Node syntax checks and test suite (`tests/mobile.test.js` 14/14)

## Pending — needs a real VPS
- Full `sudo ./deploy.sh` run on Ubuntu 24.04 (Docker install, image build on arm64, MySQL 8.4 init, Let's Encrypt)
- `nginx -t` inside the container, HTTPS + redirect, certificate renewal dry run
- Backup → restore round trip, reboot test
- First Flutter APK build on GitHub Actions

## Blocked / decisions for the owner
- MySQL 8.4 is the default for new servers. If you move an existing 8.0 database, keep `MYSQL_IMAGE=mysql:8.0` until you have a verified backup (upgrade is one-way).
- Legacy deployment files kept untouched: `.env.production.example` (old template — the new one is `deployment/env.production.example`), `docker-compose.production.yml`, `Caddyfile*`, `scripts/deploy-vps.sh`, `scripts/setup-vps.sh`, `scripts/rollback.sh`, `fly.toml`. Delete them once the new stack is live if you no longer need them.
