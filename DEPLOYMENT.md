# DOQ — Production Deployment (Ubuntu 24.04 VPS)

One command deploys the whole stack: **MySQL + Node/Express app + cron worker + Nginx + Let's Encrypt**, with daily backups, certificate renewal, monitoring and automatic restart after reboot.

```
Internet ──80/443──► nginx ──► app:3000 (Express + EJS, /m mobile API) ──► mysql:3306 (internal only)
                        │            └─ uploads volume (/app/public/upload)
                        └─ certbot webroot (Let's Encrypt)          cron worker (tasks/cron.js)
```

## What was found in the project (inspection summary)

| Item | Finding | Decision |
|---|---|---|
| Entry point | `index.js` (Express 5, EJS views, `PORT`, `TRUST_PROXY`) | unchanged; added graceful SIGTERM shutdown |
| Runtime | Node 22, npm with `package-lock.json`, native module `bcrypt` | `node:22-bookworm-slim` multi-stage build (compiles bcrypt if no arm64 prebuild) |
| Database | MySQL (compose used 8.0), schema `database/database.sql`, additive migrations `npm run migrate` (`scripts/migrate.js`) | `mysql:8.4` LTS by default (8.0 is EOL since April 2026; configurable `MYSQL_IMAGE`). Schema loaded on first start, migrations run explicitly after a backup |
| Uploads | multer → `./public/upload`, served at `/uploads`, 5 MB images | named volume `doq_uploads`, nginx body limit 10 MB, included in backups |
| Health | `/health` (liveness), `/health/ready` + `/api/v1/health` (DB check) | used by Docker, deploy and update checks |
| Background jobs | `tasks/cron.js` | separate `cron` container from the same image |
| Existing infra | `docker-compose.yml` (dev), `docker-compose.production.yml` + Caddy, `scripts/deploy-vps.sh` | left untouched for compatibility; the new production stack is `docker-compose.prod.yml` (Nginx + Certbot as requested) |
| Secrets | `.env.production` (git-ignored, docker-ignored) | generated on first deploy when empty, never overwritten, never printed |

## 1. Create the VPS
- Hetzner Cloud **CAX21** (4 vCPU ARM64, 8 GB RAM, 80 GB) or any amd64/arm64 VPS with ≥ 2 GB RAM (4 GB+ recommended).
- Image: **Ubuntu 24.04**. Add your **SSH key** while creating it.
- If the provider has a cloud firewall, allow inbound **22, 80, 443**.

## 2. Point the domain
Create DNS records at your DNS provider (Cloudflare or other):

| Type | Name | Value |
|---|---|---|
| A | `doq.example.org` (or `@`) | the VPS IPv4 |
| A | `www` (only if `INCLUDE_WWW=true`) | the VPS IPv4 |
| AAAA (optional) | same names | the VPS IPv6 |

Cloudflare: easiest is **DNS only (grey cloud)**. If you want the orange cloud, set `CLOUDFLARE_PROXY=true` and SSL/TLS mode **Full (strict)**.
Check: `dig +short doq.example.org` must print the VPS IP (or Cloudflare IPs when proxied).

## 3. Put the project on the server
```bash
ssh root@YOUR_SERVER_IP
apt-get update && apt-get install -y git
git clone https://github.com/<you>/DOQ.git /opt/doq      # private repo: use a deploy key or a token
cd /opt/doq
```
(or upload the folder with `scp -r` / `rsync` — exclude `node_modules` and your local `.env`).

## 4. Configure the environment
```bash
sudo ./deploy.sh          # first run creates .env.production and stops, asking for the domain
nano .env.production
```
The template is `deployment/env.production.example` (all variables are documented inline). Only two values are mandatory:

| Variable | Example | Notes |
|---|---|---|
| `DOQ_DOMAIN` | `doq.example.org` | no `http://`, no slash |
| `LETSENCRYPT_EMAIL` | `you@example.org` | expiry notices |

Generated automatically when empty: `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `JWT_SECRET`, `PUBLIC_URL`, `DOQ_SERVER_NAMES`.
Recommended: `SMTP_*` (password-reset emails). Optional: `INCLUDE_WWW`, `CLOUDFLARE_PROXY`, `LETSENCRYPT_STAGING`, `BACKUP_*`, `PAYMOB_*`, `ADMIN_BOOTSTRAP_*`.
Rules: never use the `$` character in values; keep the file `chmod 600`; never commit it.

## 5. Deploy
```bash
chmod +x deploy.sh
sudo ./deploy.sh
```
The script (safe to re-run) does: OS/arch/RAM/disk checks → installs Docker + Compose → validates `.env.production` and generates missing secrets → UFW (SSH port detected, 80, 443) + fail2ban → builds the image → starts MySQL and waits for health → backup (if data exists) → `npm run migrate` → starts app + cron → nginx (HTTP) → **verifies DNS points to this server** → Let's Encrypt certificate → nginx HTTPS + redirect → installs systemd timers → verifies every service and endpoint → prints URLs.

If DNS is not ready it **stops before requesting a certificate** and tells you exactly what to fix. Re-run after fixing.

First admin account:
```bash
nano .env.production    # fill ADMIN_BOOTSTRAP_EMAIL/PASSWORD/FIRST_NAME/LAST_NAME/PHONE/TOTP_SECRET
sudo ./deployment/scripts/bootstrap-admin.sh
nano .env.production    # then clear the ADMIN_BOOTSTRAP_* values
```

## 6. Access
| What | URL |
|---|---|
| Website / landing | `https://DOMAIN/` |
| Admin | `https://DOMAIN/admin` |
| Kitchen dashboard | `https://DOMAIN/users/dashboard` |
| Delivery dashboard | `https://DOMAIN/delivery` |
| Customer web app | `https://DOMAIN/m` |
| Mobile API (Flutter app) | `https://DOMAIN/m/api/v1/...` — set the app's server URL to `https://DOMAIN` |
| Health | `https://DOMAIN/health`, `/health/ready`, `/api/v1/health` |

## 7. Verify SSL
```bash
curl -I https://DOMAIN/health                       # 200
curl -I http://DOMAIN/health                        # 301 -> https
echo | openssl s_client -connect DOMAIN:443 -servername DOMAIN 2>/dev/null | openssl x509 -noout -dates -issuer
systemctl list-timers 'doq-*'                       # doq-certbot-renew.timer twice a day
```

## 8. Logs and status
```bash
sudo ./deployment/scripts/status.sh                 # containers, resources, health, timers, images
alias dcp='sudo docker compose -p doq -f /opt/doq/docker-compose.prod.yml --env-file /opt/doq/.env.production'
dcp ps
dcp logs -f app            # also: mysql, nginx, cron
ls /var/log/doq/           # deploy-*.log, update-*.log, monitor.log
journalctl -u doq-backup.service -u doq-certbot-renew.service --since today
```
Container logs are rotated by Docker (5 × 10 MB per service); `/var/log/doq` by logrotate.

## 9. Backups
- Automatic: every day 03:15 UTC (`doq-backup.timer`) → `/var/backups/doq/doq-<timestamp>-daily.sql.gz` + `...-uploads.tar.gz`.
- Consistent InnoDB dump (`--single-transaction`, routines, triggers, events), gzip-verified, completion marker checked.
- Retention: `BACKUP_RETENTION_DAYS` (14) but always at least `BACKUP_MIN_KEEP` (3) newest sets.
- Manual: `sudo ./deployment/backup/backup.sh --reason manual`
- Off-server (recommended): `apt install rclone && rclone config` (e.g. Backblaze B2 / S3 / Google Drive), then set `BACKUP_ENCRYPTION_PASSPHRASE` and `BACKUP_RCLONE_REMOTE=remote:bucket/path` — files are encrypted with AES-256 (gpg) before upload. Store the passphrase somewhere safe outside the server.
- Copy to your computer: `scp root@SERVER:/var/backups/doq/doq-*-daily.sql.gz .`
- Health report: `sudo ./deployment/backup/database-health.sh`

## 10. Restore
```bash
ls -lt /var/backups/doq/
sudo ./deployment/backup/restore.sh /var/backups/doq/doq-20261119-031500-daily.sql.gz \
     --uploads /var/backups/doq/doq-20261119-031500-daily-uploads.tar.gz    # --uploads is optional
```
It validates the file and database name, asks you to type `RESTORE DOQ`, takes a **pre-restore safety backup**, stops the app, imports, runs migrations and restarts. Restores never happen automatically.

## 11. Update the application
```bash
cd /opt/doq
sudo ./update.sh            # git pull --ff-only, or: sudo ./update.sh --no-pull (code uploaded manually)
```
Build new image (old one kept as `doq-app:previous`) → backup → migrations → restart → health checks → **automatic rollback** to the previous image if anything fails. Manual rollback: `sudo ./deployment/scripts/rollback.sh` (or `rollback.sh <tag>`; list with `docker images doq-app`). Code rollback does not undo data; restore a backup for that.

## 12. Troubleshooting
See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) and [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md).

## Security summary
- Public ports: 80/443 (nginx) + SSH only. MySQL has **no published port**; app is internal.
- UFW default-deny inbound; fail2ban on SSH (temporary bans). SSH settings are **never changed automatically** — run `sudo ./deployment/scripts/ssh-hardening-check.sh` for safe step-by-step advice.
- App runs as non-root `node` user, `no-new-privileges`, `init` for signal handling; memory limits (MySQL 2 GB, app 1 GB, cron 512 MB, nginx 256 MB — tune in `.env.production`).
- Nginx: TLS 1.2/1.3, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy (CSP comes from the app), request rate limits (`/auth/` 20/min, rest 30/s per IP), 10 MB uploads.
- Docker restarts every service after a reboot (`restart: unless-stopped`, Docker enabled at boot).
- Monitoring: `doq-monitor.timer` every 5 min logs disk/memory/load/container problems to `/var/log/doq/monitor.log` (`systemctl status doq-monitor`).

## Important "never" rules (built into the scripts)
`docker compose down -v`, volume deletion, `.env.production` overwrite, table drops/resets and automatic restores are never performed. MySQL credentials cannot be regenerated once the data volume exists — keep `.env.production` backed up somewhere safe (e.g. a password manager).
