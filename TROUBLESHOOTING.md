# DOQ Troubleshooting

Shortcut used below:
```bash
cd /opt/doq
alias dcp='sudo docker compose -p doq -f docker-compose.prod.yml --env-file .env.production'
```

| Symptom | Cause / check | Fix |
|---|---|---|
| deploy stops: "DOQ_DOMAIN and LETSENCRYPT_EMAIL must be set" | first run | `nano .env.production`, set both, re-run `sudo ./deploy.sh` |
| deploy stops: "DNS is not pointing to this server" | `dig +short DOMAIN @1.1.1.1` ≠ server IP | fix the A record, wait for propagation, re-run. Cloudflare orange cloud → `CLOUDFLARE_PROXY=true` |
| "Certificate request failed" | port 80 blocked by provider firewall, wrong DNS, or Let's Encrypt rate limit (5 failures/hour) | open port 80, verify DNS, test with `LETSENCRYPT_STAGING=true`, then set it back to `false` and re-run (staging cert is replaced automatically) |
| "DB_PASSWORD is empty but the MySQL data volume already exists" | `.env.production` lost/edited after first deploy | put the original passwords back. If truly lost: restore from a backup on a new volume (ask before deleting anything) |
| MySQL not healthy | `dcp logs mysql` | disk full (`df -h`), memory (`free -h`, lower `innodb_buffer_pool_size` in `deployment/mysql/conf.d/doq.cnf`) |
| App not healthy | `dcp logs app` | `database_unavailable` → MySQL; missing env → `.env.production`; code error → `sudo ./deployment/scripts/rollback.sh` |
| Migration failed | read the error in the deploy/update log (`/var/log/doq`) | data is untouched and a backup was taken first; fix code and re-run |
| 502 Bad Gateway | nginx up, app down | `dcp ps`, `dcp logs app`, `dcp restart app` |
| Login does not stay logged in | cookies are `Secure` in production → site must be HTTPS | open `https://`, check `PUBLIC_URL` uses https |
| Real client IP shows Cloudflare IPs / rate limit hits everyone | proxied but `CLOUDFLARE_PROXY=false` | set `true`, `sudo ./update.sh --no-pull` |
| 429 Too Many Requests | nginx `/auth/` 20/min/IP or app limiter | wait a minute; adjust `limit_req_zone` in `deployment/nginx/nginx.conf` |
| 413 Request Entity Too Large | file > 10 MB (app max is 5 MB images) | compress the image |
| Uploaded images missing | check volume `docker volume inspect doq_uploads` | never run `down -v`; restore uploads archive with `restore.sh --uploads` |
| Certificate expired | `systemctl status doq-certbot-renew.service` | `sudo ./deployment/certbot/renew.sh`; check port 80 reachable |
| Disk full | `df -h`, `docker system df` | `docker image prune` (dangling only), move old backups off-server, lower `BACKUP_RETENTION_DAYS` |
| Locked out by fail2ban | 6 failed SSH logins | wait 1 hour or use the provider console: `fail2ban-client set sshd unbanip YOUR_IP` |
| Mobile app cannot connect | server URL in the app | use `https://DOMAIN` (no trailing path); test `https://DOMAIN/m/api/v1/home` in a browser |

Useful commands:
```bash
sudo ./deployment/scripts/status.sh
sudo ./deployment/backup/database-health.sh
dcp exec mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$MYSQL_DATABASE"'   # SQL shell (no password printed)
dcp exec nginx nginx -t && dcp exec nginx nginx -s reload
dcp run --rm --no-deps app npm run migrate
journalctl -u doq-backup -u doq-certbot-renew -u doq-monitor -n 50
```

Never run: `docker compose down -v`, `docker volume rm doq_mysql_data`, `docker system prune --volumes`.
