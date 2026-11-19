#!/usr/bin/env bash
# ============================================================================
# DOQ one-command production deployment (Ubuntu 24.04 LTS, amd64 or arm64)
#
#   chmod +x deploy.sh
#   sudo ./deploy.sh
#
# Idempotent: safe to run again at any time. It never deletes volumes, never
# overwrites .env.production, never drops tables, and never prints secrets.
# Stops with clear instructions when DNS / SSL prerequisites are missing.
# ============================================================================
set -Eeuo pipefail

DOQ_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DOQ_DIR
# shellcheck source=deployment/scripts/lib.sh
source "$DOQ_DIR/deployment/scripts/lib.sh"

trap 'echo; warn "Deployment stopped at line $LINENO. Nothing was deleted. Fix the problem above and run sudo ./deploy.sh again."' ERR

require_root
cd "$DOQ_DIR"
ensure_log_dir
DEPLOY_LOG="$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$DEPLOY_LOG") 2>&1
log "Deployment log: $DEPLOY_LOG"

# Only one deploy/update at a time
exec 9>/var/lock/doq-deploy.lock
flock -n 9 || die "Another deploy.sh / update.sh is already running"

# ----------------------------------------------------------------------------
step "1/12 System checks"
# ----------------------------------------------------------------------------
[[ -r /etc/os-release ]] || die "Cannot detect the operating system"
# shellcheck disable=SC1091
. /etc/os-release
case "${ID:-}" in
  ubuntu)
    [[ "${VERSION_ID:-}" == "24.04" ]] && ok "Ubuntu ${VERSION_ID}" || warn "Tested on Ubuntu 24.04; found Ubuntu ${VERSION_ID:-?}. Continuing." ;;
  debian)
    warn "Debian ${VERSION_ID:-?} detected (Ubuntu 24.04 is the tested target). Continuing." ;;
  *)
    die "Unsupported OS '${ID:-unknown}'. Use Ubuntu 24.04 LTS." ;;
esac

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ok "CPU architecture: amd64" ;;
  aarch64|arm64) ok "CPU architecture: arm64 (node, mysql, nginx and certbot images are multi-arch)" ;;
  *) die "Unsupported CPU architecture: $ARCH" ;;
esac

MEM_MB=$(( $(awk '/MemTotal/ {print $2}' /proc/meminfo) / 1024 ))
CPUS="$(nproc)"
DISK_FREE_GB=$(( $(df -Pk "$DOQ_DIR" | awk 'NR==2 {print $4}') / 1024 / 1024 ))
log "Resources: ${CPUS} CPU, ${MEM_MB} MB RAM, ${DISK_FREE_GB} GB free disk"
(( MEM_MB >= 1800 )) || die "At least 2 GB RAM is required (found ${MEM_MB} MB)"
(( MEM_MB >= 3800 )) || warn "Less than 4 GB RAM: lower MYSQL_MEMORY_LIMIT / innodb_buffer_pool_size (deployment/mysql/conf.d/doq.cnf)"
(( DISK_FREE_GB >= 10 )) || die "At least 10 GB free disk is required (found ${DISK_FREE_GB} GB)"

for f in docker-compose.prod.yml Dockerfile deployment/env.production.example database/database.sql scripts/migrate.js; do
  [[ -f "$DOQ_DIR/$f" ]] || die "Missing $f — run deploy.sh from the project root"
done

# ----------------------------------------------------------------------------
step "2/12 Base packages and Docker"
# ----------------------------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive
PKGS=(ca-certificates curl gnupg openssl dnsutils ufw jq logrotate)
MISSING=()
for p in "${PKGS[@]}"; do dpkg -s "$p" >/dev/null 2>&1 || MISSING+=("$p"); done
apt-get update -qq
if (( ${#MISSING[@]} )); then
  log "Installing: ${MISSING[*]}"
  apt-get install -y -qq "${MISSING[@]}" >/dev/null
fi
ok "Base packages present"

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  log "Installing Docker Engine + Compose plugin from download.docker.com"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
fi
systemctl enable --now docker >/dev/null 2>&1
docker info >/dev/null 2>&1 || die "Docker daemon is not running (check: systemctl status docker)"
ok "$(docker --version | cut -d, -f1), $(docker compose version --short 2>/dev/null | sed 's/^/Compose /')"

# ----------------------------------------------------------------------------
step "3/12 Environment (.env.production)"
# ----------------------------------------------------------------------------
if [[ ! -f "$ENV_FILE" ]]; then
  install -m 600 "$ENV_TEMPLATE" "$ENV_FILE"
  ok "Created .env.production from deployment/env.production.example"
else
  ok ".env.production exists (it is never overwritten)"
fi
chmod 600 "$ENV_FILE"

DOMAIN="$(env_get DOQ_DOMAIN)"
EMAIL="$(env_get LETSENCRYPT_EMAIL)"
if is_placeholder "$DOMAIN" || is_placeholder "$EMAIL"; then
  RECOVERY_HINT="set DOQ_DOMAIN and LETSENCRYPT_EMAIL in $ENV_FILE (nano $ENV_FILE), point the domain's DNS A record to this server, then run: sudo ./deploy.sh"
  die "DOQ_DOMAIN and LETSENCRYPT_EMAIL must be set before the first deployment"
fi

# Derived values (only when empty, so manual values are respected)
[[ -n "$(env_get PUBLIC_URL)" ]] || env_set PUBLIC_URL "https://${DOMAIN}"
if [[ -z "$(env_get DOQ_SERVER_NAMES)" ]]; then
  if [[ "$(env_get INCLUDE_WWW)" == "true" ]]; then env_set DOQ_SERVER_NAMES "${DOMAIN} www.${DOMAIN}"; else env_set DOQ_SERVER_NAMES "${DOMAIN}"; fi
fi

# Secrets: generated only when missing. A MySQL password cannot be (re)generated once data exists.
MYSQL_VOLUME_EXISTS=false
docker volume inspect "${COMPOSE_PROJECT}_mysql_data" >/dev/null 2>&1 && MYSQL_VOLUME_EXISTS=true
for key in DB_PASSWORD MYSQL_ROOT_PASSWORD; do
  if is_placeholder "$(env_get "$key")"; then
    if [[ "$MYSQL_VOLUME_EXISTS" == "true" ]]; then
      RECOVERY_HINT="put the ORIGINAL $key back into $ENV_FILE (the database volume already exists and was initialised with it)"
      die "$key is empty but the MySQL data volume already exists"
    fi
    env_set "$key" "$(random_hex 24)"
    ok "Generated $key"
  fi
done
JWT="$(env_get JWT_SECRET)"
if is_placeholder "$JWT" || (( ${#JWT} < 32 )); then
  env_set JWT_SECRET "$(random_hex 48)"
  ok "Generated JWT_SECRET"
fi
unset JWT
validate_env

# ----------------------------------------------------------------------------
step "4/12 Firewall and SSH protection"
# ----------------------------------------------------------------------------
SSH_PORTS="$(sshd -T 2>/dev/null | awk '/^port / {print $2}' | sort -u | tr '\n' ' ')"
SSH_PORTS="${SSH_PORTS:-22}"
for port in $SSH_PORTS; do ufw allow "${port}/tcp" comment 'SSH' >/dev/null; done
ufw allow 80/tcp comment 'HTTP (redirect + ACME)' >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
if ! ufw status | grep -q "Status: active"; then
  ufw --force enable >/dev/null
fi
ok "UFW active: SSH (${SSH_PORTS% }), 80, 443. MySQL is not published at all."

if [[ "$(env_get INSTALL_FAIL2BAN)" != "false" ]]; then
  if ! dpkg -s fail2ban >/dev/null 2>&1; then apt-get install -y -qq fail2ban >/dev/null; fi
  if [[ ! -f /etc/fail2ban/jail.d/doq-sshd.local ]]; then
    cat > /etc/fail2ban/jail.d/doq-sshd.local <<'JAIL'
[sshd]
enabled  = true
maxretry = 6
findtime = 10m
bantime  = 1h
JAIL
    systemctl restart fail2ban
  fi
  ok "fail2ban protects SSH (temporary bans only; SSH settings are not changed)"
fi
log "SSH hardening is reported, not enforced: run sudo ./deployment/scripts/ssh-hardening-check.sh"

# ----------------------------------------------------------------------------
step "5/12 Directories"
# ----------------------------------------------------------------------------
BACKUP_DIR="$(env_get BACKUP_DIR)"; BACKUP_DIR="${BACKUP_DIR:-/var/backups/doq}"
install -d -m 700 "$BACKUP_DIR"
install -d -m 755 "$DOQ_DIR/deployment/certbot/www" "$DOQ_DIR/deployment/nginx/active" "$DOQ_DIR/deployment/nginx/generated"
install -d -m 700 "$DOQ_DIR/deployment/certbot/conf"
render_realip
ok "Backups: $BACKUP_DIR | certificates: deployment/certbot/conf | logs: $LOG_DIR"

# ----------------------------------------------------------------------------
step "6/12 Validate compose configuration"
# ----------------------------------------------------------------------------
dc config -q || die "docker-compose.prod.yml is invalid"
dc --profile certbot config -q
ok "docker-compose.prod.yml is valid"

# ----------------------------------------------------------------------------
step "7/12 Build the application image"
# ----------------------------------------------------------------------------
if docker image inspect doq-app:latest >/dev/null 2>&1; then
  docker tag doq-app:latest doq-app:previous
  log "Kept the current image as doq-app:previous (rollback)"
fi
dc build --pull app
GIT_REV="$(git -C "$DOQ_DIR" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
docker tag doq-app:latest "doq-app:${GIT_REV}"
ok "Built doq-app:latest (also tagged doq-app:${GIT_REV})"

# ----------------------------------------------------------------------------
step "8/12 Database"
# ----------------------------------------------------------------------------
dc up -d mysql
wait_healthy mysql 420 || { RECOVERY_HINT="check 'sudo docker compose -p doq -f docker-compose.prod.yml --env-file .env.production logs mysql'"; die "MySQL did not become healthy"; }

TABLES="$(dc exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\"$MYSQL_DATABASE\""' 2>/dev/null | tr -d '[:space:]' || echo 0)"
if [[ "${TABLES:-0}" =~ ^[0-9]+$ ]] && (( TABLES > 0 )); then
  log "Existing database with ${TABLES} tables: taking a safety backup before migrations"
  "$DOQ_DIR/deployment/backup/backup.sh" --reason pre-deploy --skip-uploads \
    || { RECOVERY_HINT="fix the backup problem above (disk space?) and run deploy again"; die "Safety backup failed, migrations were NOT run"; }
else
  log "Fresh database (schema loaded from database/database.sql on first start)"
fi

log "Running migrations (scripts/migrate.js — additive: CREATE IF NOT EXISTS / ADD COLUMN / ADD INDEX)"
dc run --rm --no-deps -T app npm run migrate \
  || { RECOVERY_HINT="read the error above; your data is untouched (backup in $BACKUP_DIR). Restore only if needed: sudo ./deployment/backup/restore.sh <file>"; die "Migration failed"; }
ok "Migrations applied"

# ----------------------------------------------------------------------------
step "9/12 Application"
# ----------------------------------------------------------------------------
dc up -d --remove-orphans app cron
wait_healthy app 240 || {
  RECOVERY_HINT="see the logs above. To go back to the previous image: sudo ./deployment/scripts/rollback.sh"
  die "The application did not become healthy"
}

# ----------------------------------------------------------------------------
step "10/12 Nginx + SSL"
# ----------------------------------------------------------------------------
MODE="$(nginx_mode)"
use_nginx_template "$MODE"
dc up -d --force-recreate nginx
wait_healthy nginx 90 || die "Nginx did not start (sudo docker compose -p doq -f docker-compose.prod.yml --env-file .env.production logs nginx)"
dc exec -T nginx nginx -t >/dev/null 2>&1 || die "Nginx configuration test failed"
ok "Nginx running in ${MODE} mode"

STAGING_FLAG=()
[[ "$(env_get LETSENCRYPT_STAGING)" == "true" ]] && STAGING_FLAG=(--staging)
RENEWAL_CONF="$DOQ_DIR/deployment/certbot/conf/renewal/${DOMAIN}.conf"
NEED_CERT=false
if ! cert_exists; then
  NEED_CERT=true
elif [[ ${#STAGING_FLAG[@]} -eq 0 && -f "$RENEWAL_CONF" ]] && grep -q "acme-staging" "$RENEWAL_CONF"; then
  log "A Let's Encrypt STAGING certificate is installed but LETSENCRYPT_STAGING=false: replacing it with a real one"
  NEED_CERT=true
fi

if [[ "$NEED_CERT" == "true" ]]; then
  # --- DNS validation before asking Let's Encrypt (avoids rate-limit lockouts) ---
  read -r -a NAMES <<<"$(env_get DOQ_SERVER_NAMES)"
  PUBLIC_IP4="$(curl -4 -fsS --max-time 10 https://api.ipify.org 2>/dev/null || curl -4 -fsS --max-time 10 https://ifconfig.me 2>/dev/null || true)"
  PUBLIC_IP6="$(curl -6 -fsS --max-time 10 https://api64.ipify.org 2>/dev/null || true)"
  IP_HINT="${PUBLIC_IP4:-the public IPv4 of this server}"
  log "This server's public IP: ${PUBLIC_IP4:-unknown}${PUBLIC_IP6:+ / $PUBLIC_IP6}"

  TOKEN="doq-dns-check-$(random_hex 8)"
  CHALLENGE_DIR="$DOQ_DIR/deployment/certbot/www/.well-known/acme-challenge"
  install -d -m 755 "$CHALLENGE_DIR"
  echo "$TOKEN" > "$CHALLENGE_DIR/$TOKEN"
  chmod 644 "$CHALLENGE_DIR/$TOKEN"

  DNS_OK=true
  for name in "${NAMES[@]}"; do
    A_RECORDS="$(dig +short A "$name" @1.1.1.1 2>/dev/null | grep -E '^[0-9.]+$' | tr '\n' ' ' || true)"
    AAAA_RECORDS="$(dig +short AAAA "$name" @1.1.1.1 2>/dev/null | grep -E ':' | tr '\n' ' ' || true)"
    if [[ -z "$A_RECORDS$AAAA_RECORDS" ]]; then
      warn "$name has no A/AAAA record yet"
      DNS_OK=false; continue
    fi
    if [[ -n "$PUBLIC_IP4" && " $A_RECORDS " == *" $PUBLIC_IP4 "* ]]; then
      ok "$name -> $PUBLIC_IP4 (points to this server)"
      continue
    fi
    # Proxied DNS (e.g. Cloudflare orange cloud) resolves to the proxy: verify reachability over HTTP instead
    BODY="$(curl -fsS --max-time 15 "http://${name}/.well-known/acme-challenge/${TOKEN}" 2>/dev/null || true)"
    if [[ "$BODY" == "$TOKEN" ]]; then
      ok "$name resolves to ${A_RECORDS:-$AAAA_RECORDS}(proxy) and reaches this server over HTTP"
    else
      warn "$name resolves to ${A_RECORDS}${AAAA_RECORDS}but does not reach this server (expected ${IP_HINT})"
      DNS_OK=false
    fi
  done
  rm -f "$CHALLENGE_DIR/$TOKEN"

  if [[ "$DNS_OK" != "true" ]]; then
    RECOVERY_HINT="create an A record for each name in DOQ_SERVER_NAMES pointing to ${IP_HINT} (if you use Cloudflare, set the record to 'DNS only' or set CLOUDFLARE_PROXY=true with SSL mode 'Full (strict)'), wait for DNS to propagate (check: dig +short ${DOMAIN}), then run sudo ./deploy.sh again. The site is already running on HTTP inside the server; nothing needs to be undone."
    die "DNS is not pointing to this server yet, so no certificate was requested"
  fi

  CERT_ARGS=(certonly --webroot -w /var/www/certbot --cert-name "$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email --non-interactive "${STAGING_FLAG[@]}")
  # Replacing a staging certificate needs --force-renewal; otherwise keep a valid one
  if cert_exists; then CERT_ARGS+=(--force-renewal); else CERT_ARGS+=(--keep-until-expiring); fi
  for name in "${NAMES[@]}"; do CERT_ARGS+=(-d "$name"); done
  log "Requesting a Let's Encrypt certificate for: ${NAMES[*]}"
  dc --profile certbot run --rm certbot "${CERT_ARGS[@]}" \
    || { RECOVERY_HINT="read the certbot error above (DNS, port 80 blocked by a cloud firewall, or rate limit). Test with LETSENCRYPT_STAGING=true first if you retry many times."; die "Certificate request failed"; }
  cert_exists || die "Certificate files were not created"
  ok "Certificate issued"
  use_nginx_template https
  dc up -d --force-recreate nginx
  wait_healthy nginx 90 || die "Nginx did not start with HTTPS"
  dc exec -T nginx nginx -t >/dev/null 2>&1 || die "Nginx HTTPS configuration test failed"
  MODE=https
else
  ok "Certificate already present (renewed automatically by doq-certbot-renew.timer)"
fi

# ----------------------------------------------------------------------------
step "11/12 Scheduled jobs (backups, certificate renewal, monitoring) and log rotation"
# ----------------------------------------------------------------------------
for unit in "$DOQ_DIR"/deployment/systemd/*.service "$DOQ_DIR"/deployment/systemd/*.timer; do
  sed "s#__DOQ_DIR__#${DOQ_DIR}#g" "$unit" > "/etc/systemd/system/$(basename "$unit")"
done
chmod +x "$DOQ_DIR"/deploy.sh "$DOQ_DIR"/update.sh "$DOQ_DIR"/deployment/backup/*.sh "$DOQ_DIR"/deployment/scripts/*.sh "$DOQ_DIR"/deployment/certbot/*.sh
systemctl daemon-reload
systemctl enable --now doq-backup.timer doq-certbot-renew.timer doq-monitor.timer >/dev/null
cat > /etc/logrotate.d/doq <<LR
${LOG_DIR}/*.log {
    weekly
    rotate 8
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
}
LR
ok "Timers: $(systemctl list-timers --no-legend 'doq-*' | awk '{print $NF}' | tr '\n' ' ')"
ok "Docker container logs are capped at 5 x 10 MB per service"

# ----------------------------------------------------------------------------
step "12/12 Verification"
# ----------------------------------------------------------------------------
FAILED=0
for svc in mysql app cron nginx; do
  status="$(container_health "$svc")"
  if [[ "$status" == "healthy" || ( "$svc" == "cron" && "$status" == "running" ) ]]; then ok "$svc: $status"; else warn "$svc: $status"; FAILED=1; fi
done
for path in /health /health/ready /api/v1/health /m/api/v1/home /; do
  code="$(check_site "$DOMAIN" "$MODE" "$path")"
  if [[ "$code" == "200" ]]; then ok "${MODE}://${DOMAIN}${path} -> $code"; else warn "${MODE}://${DOMAIN}${path} -> $code"; FAILED=1; fi
done
if [[ "$MODE" == "https" ]]; then
  code="$(http_status -H "Host: ${DOMAIN}" "http://127.0.0.1/health")"
  [[ "$code" == "301" ]] && ok "HTTP redirects to HTTPS" || { warn "HTTP -> HTTPS redirect returned $code"; FAILED=1; }
  PUBLIC_CODE="$(http_status "https://${DOMAIN}/health")"
  [[ "$PUBLIC_CODE" == "200" ]] && ok "Public check https://${DOMAIN}/health -> 200" \
    || warn "Public check https://${DOMAIN}/health -> ${PUBLIC_CODE} (DNS cache or a provider firewall may still be in the way)"
  EXPIRY="$(openssl x509 -enddate -noout -in "$DOQ_DIR/deployment/certbot/conf/live/${DOMAIN}/fullchain.pem" | cut -d= -f2)"
  ok "Certificate valid until: $EXPIRY"
fi

echo
if (( FAILED == 0 )); then
  echo "${C_GRN}==================== DOQ is deployed ====================${C_OFF}"
else
  echo "${C_YLW}=========== DOQ deployed with warnings (see above) ===========${C_OFF}"
fi
cat <<SUMMARY
  Website         : ${MODE}://${DOMAIN}/
  Admin           : ${MODE}://${DOMAIN}/admin
  Customer (web)  : ${MODE}://${DOMAIN}/m
  Mobile API      : ${MODE}://${DOMAIN}/m/api/v1/home
  Health          : ${MODE}://${DOMAIN}/api/v1/health
  Backups         : ${BACKUP_DIR} (daily 03:15 UTC, doq-backup.timer)
  Status          : sudo ./deployment/scripts/status.sh
  Update          : sudo ./update.sh
  Deploy log      : ${DEPLOY_LOG}
  First admin     : fill ADMIN_BOOTSTRAP_* in .env.production, then sudo ./deployment/scripts/bootstrap-admin.sh
SUMMARY
exit "$FAILED"
