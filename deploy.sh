#!/usr/bin/env bash
# ============================================================================
# DOQ one-command production deployment (Ubuntu 24.04 LTS, amd64 or arm64)
#
#   chmod +x deploy.sh
#   sudo ./deploy.sh
#
# Idempotent: safe to run again at any time. It never deletes volumes, never
# overwrites .env.production, never drops tables, and never prints secrets.
# HTTPS: Caddy gets and renews the Let's Encrypt certificate by itself.
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
  aarch64|arm64) ok "CPU architecture: arm64 (node, mysql and caddy images are multi-arch)" ;;
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
ufw allow 443/udp comment 'HTTP/3' >/dev/null
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
render_caddy_env
ok "Backups: $BACKUP_DIR | certificates: docker volume doq_caddy_data | logs: $LOG_DIR"

# ----------------------------------------------------------------------------
step "6/12 Validate compose configuration"
# ----------------------------------------------------------------------------
dc config -q || die "docker-compose.prod.yml is invalid"
ok "docker-compose.prod.yml is valid"
dc pull -q caddy || warn "Could not pull the Caddy image (using the local one if present)"
caddy_validate || { RECOVERY_HINT="read the Caddy error above and fix Caddyfile or DOQ_SERVER_NAMES / LETSENCRYPT_EMAIL in $ENV_FILE"; die "Caddyfile is invalid"; }
ok "Caddyfile is valid"

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
step "10/12 Caddy + HTTPS (Let's Encrypt)"
# ----------------------------------------------------------------------------
retire_nginx

# DNS check (information only: Caddy keeps retrying and gets the certificate as soon as DNS is right)
read -r -a NAMES <<<"$(env_get DOQ_SERVER_NAMES)"
PUBLIC_IP4="$(curl -4 -fsS --max-time 10 https://api.ipify.org 2>/dev/null || curl -4 -fsS --max-time 10 https://ifconfig.me 2>/dev/null || true)"
IP_HINT="${PUBLIC_IP4:-the public IPv4 of this server}"
DNS_OK=true
for name in "${NAMES[@]}"; do
  A_RECORDS="$(dig +short A "$name" @1.1.1.1 2>/dev/null | grep -E '^[0-9.]+$' | tr '\n' ' ' || true)"
  if [[ -z "$A_RECORDS" ]]; then
    warn "$name has no A record yet (it must point to ${IP_HINT})"; DNS_OK=false
  elif [[ -n "$PUBLIC_IP4" && " $A_RECORDS " == *" $PUBLIC_IP4 "* ]]; then
    ok "$name -> $PUBLIC_IP4 (this server)"
  elif [[ "$(env_get CLOUDFLARE_PROXY)" == "true" ]]; then
    ok "$name -> ${A_RECORDS% }(Cloudflare proxy)"
  else
    warn "$name -> ${A_RECORDS% }but this server is ${IP_HINT}"; DNS_OK=false
  fi
done

dc up -d caddy
wait_healthy caddy 90 || die "Caddy did not start (sudo docker compose -p doq -f docker-compose.prod.yml --env-file .env.production logs caddy)"
ok "Caddy is running"

CERT_OK=false
if [[ "$DNS_OK" == "true" ]]; then
  log "Waiting for the Let's Encrypt certificate (usually under a minute)"
  for _ in $(seq 1 40); do
    if cert_trusted "$DOMAIN"; then CERT_OK=true; break; fi
    if [[ "$(env_get LETSENCRYPT_STAGING)" == "true" && -n "$(cert_expiry "$DOMAIN")" ]]; then CERT_OK=true; break; fi
    sleep 3
  done
fi
if [[ "$CERT_OK" == "true" ]]; then
  ok "HTTPS certificate is active"
else
  warn "No certificate yet. Caddy keeps trying on its own; nothing needs to be re-run once DNS is correct."
  warn "Check: dig +short ${DOMAIN}  (must show ${IP_HINT}) and: sudo docker compose -p doq -f docker-compose.prod.yml --env-file .env.production logs caddy"
fi

# ----------------------------------------------------------------------------
step "11/12 Scheduled jobs (backups, monitoring) and log rotation"
# ----------------------------------------------------------------------------
for unit in "$DOQ_DIR"/deployment/systemd/*.service "$DOQ_DIR"/deployment/systemd/*.timer; do
  sed "s#__DOQ_DIR__#${DOQ_DIR}#g" "$unit" > "/etc/systemd/system/$(basename "$unit")"
done
chmod +x "$DOQ_DIR"/deploy.sh "$DOQ_DIR"/update.sh "$DOQ_DIR"/deployment/backup/*.sh "$DOQ_DIR"/deployment/scripts/*.sh
systemctl daemon-reload
systemctl enable --now doq-backup.timer doq-monitor.timer >/dev/null
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
for svc in mysql app cron caddy; do
  status="$(container_health "$svc")"
  if [[ "$status" == "healthy" || ( "$svc" == "cron" && "$status" == "running" ) ]]; then ok "$svc: $status"; else warn "$svc: $status"; FAILED=1; fi
done
for path in /health /health/ready /api/v1/health /m/api/v1/home /; do
  code="$(check_site "$DOMAIN" "$path")"
  if [[ "$code" == "200" ]]; then ok "https://${DOMAIN}${path} -> $code"; else warn "https://${DOMAIN}${path} -> $code"; FAILED=1; fi
done
code="$(http_status -H "Host: ${DOMAIN}" "http://127.0.0.1/health")"
[[ "$code" == "308" || "$code" == "301" ]] && ok "HTTP redirects to HTTPS" || { warn "HTTP -> HTTPS redirect returned $code"; FAILED=1; }
if [[ "$CERT_OK" == "true" ]]; then
  PUBLIC_CODE="$(http_status "https://${DOMAIN}/health")"
  [[ "$PUBLIC_CODE" == "200" ]] && ok "Public check https://${DOMAIN}/health -> 200" \
    || warn "Public check https://${DOMAIN}/health -> ${PUBLIC_CODE} (DNS cache or a provider firewall may still be in the way)"
  ok "Certificate valid until: $(cert_expiry "$DOMAIN") (renewed automatically by Caddy)"
else
  FAILED=1
fi

echo
if (( FAILED == 0 )); then
  echo "${C_GRN}==================== DOQ is deployed ====================${C_OFF}"
else
  echo "${C_YLW}=========== DOQ deployed with warnings (see above) ===========${C_OFF}"
fi
cat <<SUMMARY
  Website         : https://${DOMAIN}/
  Admin           : https://${DOMAIN}/admin
  Customer (web)  : https://${DOMAIN}/m
  Mobile API      : https://${DOMAIN}/m/api/v1/home
  Health          : https://${DOMAIN}/api/v1/health
  Backups         : ${BACKUP_DIR} (daily 03:15 UTC, doq-backup.timer)
  Status          : sudo ./deployment/scripts/status.sh
  Update          : sudo ./update.sh
  Deploy log      : ${DEPLOY_LOG}
  First admin     : fill ADMIN_BOOTSTRAP_* in .env.production, then sudo ./deployment/scripts/bootstrap-admin.sh
SUMMARY
exit "$FAILED"
