# DOQ: Production Deployment (Ubuntu 24.04 VPS)

One command deploys the whole stack: **MySQL + Node/Express app + cron worker + Caddy (automatic HTTPS with Let's Encrypt)**, with daily backups, monitoring and automatic restart after reboot.

```
Internet ──80/443──► caddy ──► app:3000 (Express + EJS, /m mobile API) ──► mysql:3306 (internal only)
                      │             └─ uploads volume (/app/public/upload)
                      └─ caddy_data volume (certificates)      cron worker (tasks/cron.js)
```

| File | Purpose |
|---|---|
| `server-bootstrap.sh` | fresh server: installs Node.js/npm/Docker, git identity, deploy key, clone, secrets, runs `deploy.sh` |
| `deploy.sh` | first deployment (safe to re-run) |
| `update.sh` | pull + rebuild + backup + migrate + restart, automatic rollback |
| `docker-compose.prod.yml` | the production stack |
| `Caddyfile` | reverse proxy, HTTPS, security headers |
| `deployment/env.production.example` | template for `.env.production` |
| `deployment/backup/` | `backup.sh`, `restore.sh`, `database-health.sh` |
| `deployment/scripts/` | `status.sh`, `rollback.sh`, `monitor.sh`, `bootstrap-admin.sh`, `ssh-hardening-check.sh` |

## 1. Before you start
- VPS with **Ubuntu 24.04**, ≥ 2 GB RAM (4 GB+ recommended), amd64 or arm64, SSH key added.
- Provider/cloud firewall allows inbound **22, 80, 443** (TCP) and **443/UDP** (HTTP/3, optional).
- DNS: an **A record** `DOMAIN → server IPv4` (and `www` if `INCLUDE_WWW=true`). Check: `dig +short DOMAIN`.
- Cloudflare: easiest is **DNS only (grey cloud)**. With the orange cloud set `CLOUDFLARE_PROXY=true` and SSL/TLS mode **Full (strict)**.

## 2. Deploy (one command)
```bash
ssh root@SERVER_IP
curl -fsSL https://raw.githubusercontent.com/mahmudmahmod519-code/DOQ/main/server-bootstrap.sh -o server-bootstrap.sh
sudo bash server-bootstrap.sh --domain doq.example.com --email you@example.com
```
Private repository: copy the script with `scp server-bootstrap.sh root@SERVER_IP:~` instead of `curl`; it prints a deploy key to add under **GitHub → Settings → Deploy keys** and waits.

Already cloned in `/opt/doq`? Just run `sudo ./deploy.sh` there (it creates `.env.production` from the template; set `DOQ_DOMAIN` and `LETSENCRYPT_EMAIL`).

`deploy.sh` does: system checks → Docker → `.env.production` (missing secrets generated, never printed, never overwritten) → UFW + fail2ban → validates compose + Caddyfile → builds the image → MySQL → backup (if data exists) → migrations → app + cron → **Caddy** (gets the certificate automatically) → systemd timers → verification.

**HTTPS:** Caddy requests the Let's Encrypt certificate as soon as the domain points to the server, redirects HTTP → HTTPS and renews automatically. If DNS is not ready yet, the deployment still finishes with a warning; Caddy keeps retrying on its own, so nothing has to be re-run after fixing DNS. Certificates live in the `doq_caddy_data` volume.

Testing many times? Set `LETSENCRYPT_STAGING=true` (no rate limits, untrusted certificate), then `false` and `sudo ./update.sh --no-pull`.

First admin account:
```bash
nano .env.production    # fill ADMIN_BOOTSTRAP_EMAIL/PASSWORD/FIRST_NAME/LAST_NAME/PHONE/TOTP_SECRET
sudo ./deployment/scripts/bootstrap-admin.sh
nano .env.production    # then clear the ADMIN_BOOTSTRAP_* values
```

## 3. Access
| What | URL |
|---|---|
| Website / landing | `https://DOMAIN/` |
| Admin | `https://DOMAIN/admin` |
| Kitchen dashboard | `https://DOMAIN/users/dashboard` |
| Delivery dashboard | `https://DOMAIN/delivery` |
| Customer web app | `https://DOMAIN/m` |
| Mobile API (Flutter app) | `https://DOMAIN/m/api/v1/...` (build the APK with `DOQ_API_URL=https://DOMAIN`) |
| Health | `https://DOMAIN/health`, `/health/ready`, `/api/v1/health` |

## 4. Status and logs
```bash
cd /opt/doq
alias dcp='sudo docker compose -p doq -f docker-compose.prod.yml --env-file .env.production'
sudo ./deployment/scripts/status.sh      # containers, resources, health, certificate expiry, timers
dcp logs -f app                          # also: caddy, mysql, cron
ls /var/log/doq/                         # deploy-*.log, update-*.log, monitor.log
```

## 5. Update
```bash
cd /opt/doq && sudo ./update.sh          # or: sudo ./update.sh --no-pull
```
New image (old one kept as `doq-app:previous`) → backup → migrations → restart → Caddyfile reloaded without downtime → health checks → **automatic rollback** on failure. Manual: `sudo ./deployment/scripts/rollback.sh`.

## 6. Backups and restore
- Daily 03:15 UTC (`doq-backup.timer`) → `/var/backups/doq/` (database dump + uploads), retention `BACKUP_RETENTION_DAYS` (min `BACKUP_MIN_KEEP`).
- Manual: `sudo ./deployment/backup/backup.sh --reason manual`
- Off-server (recommended): install `rclone`, set `BACKUP_RCLONE_REMOTE`; files are encrypted with `BACKUP_ENCRYPTION_PASSPHRASE` first.
- Restore: `sudo ./deployment/backup/restore.sh /var/backups/doq/<file>.sql.gz [--uploads <file>-uploads.tar.gz]` (asks you to type `RESTORE DOQ`, takes a safety backup first).

## 7. After the first deploy (checklist)
- [ ] `https://DOMAIN/` shows a valid padlock; `http://` redirects to `https://`
- [ ] `https://DOMAIN/api/v1/health` → `"status":"ok"`
- [ ] First admin created and `ADMIN_BOOTSTRAP_*` cleared
- [ ] Test order: customer (app) → kitchen → delivery → completed
- [ ] Copy `/root/doq-secrets/` (or `.env.production`) to a password manager
- [ ] `sudo reboot` → everything is back after ~1 minute (`status.sh`)
- [ ] Off-server backups configured and one restore tested on a copy server
- [ ] `sudo ./deployment/scripts/ssh-hardening-check.sh` reviewed (SSH is never changed automatically)

## Security summary
- Public ports: 80/443 (Caddy) + SSH. MySQL has **no published port**; the app is internal.
- UFW default-deny inbound; fail2ban on SSH (temporary bans).
- Caddy: TLS 1.2/1.3, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy (CSP comes from the app), 10 MB request limit, real client IP (Cloudflare ranges trusted only with `CLOUDFLARE_PROXY=true`). Rate limiting is done by the app (`middlware/security.js`).
- App runs as non-root `node`, `no-new-privileges`, memory limits per service.

## Never
`docker compose down -v`, deleting volumes (`doq_mysql_data`, `doq_uploads`, `doq_caddy_data`), overwriting `.env.production`, dropping tables. MySQL passwords cannot be regenerated once the data volume exists: keep `.env.production` backed up.
