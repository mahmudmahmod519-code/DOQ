# DOQ Deployment Checklist

## Before deploying
- [ ] VPS created with Ubuntu 24.04, ≥ 2 GB RAM (8 GB recommended), SSH key added
- [ ] Provider/cloud firewall allows 22, 80, 443
- [ ] DNS A record `DOQ_DOMAIN` → VPS IPv4 (and `www` if `INCLUDE_WWW=true`); `dig +short DOMAIN` shows it
- [ ] Cloudflare: grey cloud, or `CLOUDFLARE_PROXY=true` + SSL mode "Full (strict)"
- [ ] Project cloned/uploaded to `/opt/doq` (no `node_modules`, no local `.env`)

## Configuration (`.env.production`)
- [ ] `DOQ_DOMAIN` and `LETSENCRYPT_EMAIL` set
- [ ] No `$` character in any value
- [ ] `SMTP_*` set (password-reset emails) — recommended
- [ ] `.env.production` copied to a safe place (password manager) after the first deploy (it holds the DB passwords)

## Deploy
- [ ] `sudo ./deploy.sh` finished with "DOQ is deployed"
- [ ] `https://DOMAIN/` loads, padlock valid
- [ ] `http://DOMAIN/` redirects to https
- [ ] `https://DOMAIN/api/v1/health` → `"status":"ok"` and database ok
- [ ] `https://DOMAIN/m/api/v1/home` → JSON (mobile API)
- [ ] First admin created (`deployment/scripts/bootstrap-admin.sh`), `ADMIN_BOOTSTRAP_*` cleared
- [ ] Log in as admin, kitchen, delivery; place a test order from the mobile app (server URL `https://DOMAIN`)
- [ ] Upload a dish image, then `sudo docker compose -p doq -f docker-compose.prod.yml --env-file .env.production restart app` — image still shows

## Operations
- [ ] `systemctl list-timers 'doq-*'` shows backup, certbot-renew, monitor
- [ ] `sudo ./deployment/backup/backup.sh --reason manual` works, files in `/var/backups/doq`
- [ ] Off-server encrypted backups configured (`BACKUP_ENCRYPTION_PASSPHRASE` + `BACKUP_RCLONE_REMOTE`)
- [ ] Restore tested once on a copy/staging server
- [ ] `sudo reboot` → after ~1 minute everything is back (`sudo ./deployment/scripts/status.sh`)
- [ ] `sudo ./deployment/scripts/ssh-hardening-check.sh` reviewed; key login confirmed before disabling passwords
- [ ] `sudo certbot`-style dry run: `sudo docker compose -p doq -f docker-compose.prod.yml --env-file .env.production --profile certbot run --rm certbot renew --dry-run`
