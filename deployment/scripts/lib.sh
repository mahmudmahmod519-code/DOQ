#!/usr/bin/env bash
# Shared helpers for DOQ deployment scripts. Source it; do not run it.
# Never echo secret values from these helpers.

DOQ_DIR="${DOQ_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ENV_FILE="${ENV_FILE:-$DOQ_DIR/.env.production}"
ENV_TEMPLATE="$DOQ_DIR/deployment/env.production.example"
COMPOSE_FILE="$DOQ_DIR/docker-compose.prod.yml"
COMPOSE_PROJECT="doq"
LOG_DIR="${LOG_DIR:-/var/log/doq}"

if [[ -t 1 ]]; then
  C_RED=$'\033[0;31m'; C_GRN=$'\033[0;32m'; C_YLW=$'\033[1;33m'; C_BLU=$'\033[0;34m'; C_CYN=$'\033[0;36m'; C_OFF=$'\033[0m'
else
  C_RED=""; C_GRN=""; C_YLW=""; C_BLU=""; C_CYN=""; C_OFF=""
fi

log()  { echo "${C_BLU}[INFO]${C_OFF} $*"; }
ok()   { echo "${C_GRN}[ OK ]${C_OFF} $*"; }
warn() { echo "${C_YLW}[WARN]${C_OFF} $*" >&2; }
step() { echo; echo "${C_CYN}==> $*${C_OFF}"; }
die()  {
  echo "${C_RED}[FAIL]${C_OFF} $*" >&2
  [[ -n "${RECOVERY_HINT:-}" ]] && echo "       How to fix: ${RECOVERY_HINT}" >&2
  exit 1
}

require_root() { [[ $EUID -eq 0 ]] || die "Run as root: sudo $0"; }

# Where public traffic enters (EDGE_MODE in .env.production):
#   caddy  (default) Caddy on ports 80/443 with Let's Encrypt
#   tunnel           Cloudflare Tunnel (cloudflared), no public web ports
edge_mode() {
  local m=""
  [[ -f "$ENV_FILE" ]] && m="$(grep -E '^[[:space:]]*EDGE_MODE=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr -d '"\r ' || true)"
  [[ "$m" == "tunnel" ]] && echo tunnel || echo caddy
}

# Container that receives public traffic in the current mode
edge_service() { [[ "$(edge_mode)" == "tunnel" ]] && echo cloudflared || echo caddy; }

# docker compose for the production stack (with the profile of the current edge mode)
dc() {
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile "$(edge_mode)" "$@"
}

# Read KEY from .env.production without sourcing it (values may contain spaces/quotes)
env_get() {
  local key="$1" line value
  [[ -f "$ENV_FILE" ]] || return 0
  line="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 || true)"
  value="${line#*=}"
  value="${value%$'\r'}"
  if [[ "$value" =~ ^\"(.*)\"$ ]] || [[ "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
  printf '%s' "$value"
}

# Set KEY=value in .env.production (value must not contain newlines). Never prints the value.
env_set() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  if grep -qE "^[[:space:]]*${key}=" "$ENV_FILE"; then
    awk -v k="$key" -v v="$value" 'BEGIN{done=0} $0 ~ "^[[:space:]]*"k"=" { if(!done){print k"="v; done=1}; next } {print}' "$ENV_FILE" > "$tmp"
  else
    cp "$ENV_FILE" "$tmp"
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
  fi
  cat "$tmp" > "$ENV_FILE"
  rm -f "$tmp"
}

# True when a value is empty or still a template placeholder
is_placeholder() {
  local v="$1"
  [[ -z "$v" || "$v" == CHANGE_ME* || "$v" == *example.com* || "$v" == GENERATE* ]]
}

random_hex() { openssl rand -hex "${1:-32}"; }

container_health() {
  local id
  id="$(dc ps -q "$1" 2>/dev/null | head -n 1)"
  [[ -z "$id" ]] && { echo "missing"; return; }
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || echo "unknown"
}

wait_healthy() {
  local service="$1" timeout="${2:-180}" waited=0 status
  while (( waited < timeout )); do
    status="$(container_health "$service")"
    [[ "$status" == "healthy" ]] && { ok "$service is healthy"; return 0; }
    if [[ "$status" == "exited" || "$status" == "dead" ]]; then break; fi
    sleep 3; waited=$((waited + 3))
  done
  warn "$service is not healthy (status: $(container_health "$service")). Last log lines:"
  dc logs --tail 40 "$service" >&2 || true
  return 1
}

# HTTP status of a URL (000 when unreachable)
http_status() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@" || echo "000"
}

ensure_log_dir() { mkdir -p "$LOG_DIR"; chmod 750 "$LOG_DIR"; }

# ---------------------------------------------------------------------------
# Environment validation shared by deploy.sh and update.sh (read-only checks)
# ---------------------------------------------------------------------------
validate_env() {
  local errors=0 key value
  [[ -f "$ENV_FILE" ]] || die "$ENV_FILE not found"
  local mode; mode="$(stat -c '%a' "$ENV_FILE")"
  [[ "$mode" == "600" ]] || { chmod 600 "$ENV_FILE"; warn "Fixed permissions of .env.production to 600"; }

  for key in DOQ_DOMAIN LETSENCRYPT_EMAIL DB_NAME DB_USER DB_PASSWORD MYSQL_ROOT_PASSWORD JWT_SECRET PUBLIC_URL DOQ_SERVER_NAMES; do
    value="$(env_get "$key")"
    if is_placeholder "$value"; then warn "$key is missing or still a placeholder"; errors=$((errors + 1)); fi
  done

  local domain; domain="$(env_get DOQ_DOMAIN)"
  if [[ ! "$domain" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]]; then
    warn "DOQ_DOMAIN must be a plain domain name like doq.example.org (no http://, no slash)"; errors=$((errors + 1))
  fi
  local email; email="$(env_get LETSENCRYPT_EMAIL)"
  [[ "$email" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || { warn "LETSENCRYPT_EMAIL is not a valid email"; errors=$((errors + 1)); }

  local jwt; jwt="$(env_get JWT_SECRET)"
  (( ${#jwt} >= 32 )) || { warn "JWT_SECRET must be at least 32 characters"; errors=$((errors + 1)); }
  for key in DB_PASSWORD MYSQL_ROOT_PASSWORD; do
    value="$(env_get "$key")"
    (( ${#value} >= 16 )) || { warn "$key should be at least 16 characters"; errors=$((errors + 1)); }
  done
  if grep -qE '^[^#]*=.*\$' "$ENV_FILE"; then
    warn "A value in .env.production contains '\$' — docker compose would interpolate it. Remove or escape it as \$\$."
    errors=$((errors + 1))
  fi
  if [[ -n "$(env_get DATABASE_URL)$(env_get MYSQL_URL)" ]]; then
    warn "DATABASE_URL / MYSQL_URL is set: database/pool.js would prefer it over the bundled MySQL. Remove it."
    errors=$((errors + 1))
  fi
  [[ -n "$(env_get SMTP_HOST)" && -n "$(env_get SMTP_USER)" ]] || warn "SMTP is not configured: password-reset emails will not be sent (optional)."

  (( errors == 0 )) || { RECOVERY_HINT="edit $ENV_FILE (nano $ENV_FILE), then run the script again"; die "$errors problem(s) in .env.production"; }
  ok ".env.production is valid"
}

# Settings Caddy reads from .env.production: Let's Encrypt CA and trusted proxy ranges
render_caddy_env() {
  if [[ "$(env_get LETSENCRYPT_STAGING)" == "true" ]]; then
    env_set DOQ_ACME_CA "https://acme-staging-v02.api.letsencrypt.org/directory"
  else
    env_set DOQ_ACME_CA "https://acme-v02.api.letsencrypt.org/directory"
  fi
  local ranges=""
  if [[ "$(env_get CLOUDFLARE_PROXY)" == "true" ]]; then
    ranges="$(curl -fsS --max-time 10 https://www.cloudflare.com/ips-v4 2>/dev/null; echo; curl -fsS --max-time 10 https://www.cloudflare.com/ips-v6 2>/dev/null)" || true
    grep -qE '^[0-9a-f:.]+/[0-9]+' <<<"$ranges" || ranges="$(cat "$DOQ_DIR/deployment/caddy/cloudflare-ips.txt")"
    ranges="$(grep -E '^[0-9a-f:.]+/[0-9]+' <<<"$ranges" | tr '\n' ' ' | sed 's/ *$//')"
    env_set DOQ_TRUSTED_PROXIES "$ranges"
  else
    env_set DOQ_TRUSTED_PROXIES "private_ranges"
  fi
}

# Check the Caddyfile with the real environment before (re)starting Caddy
caddy_validate() {
  dc run --rm --no-deps -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
}

# Servers first deployed with the old nginx + certbot setup: free ports 80/443 and retire the renew timer
retire_nginx() {
  local old
  old="$(docker ps -aq --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" --filter label=com.docker.compose.service=nginx)"
  if [[ -n "$old" ]]; then
    docker rm -f $old >/dev/null
    log "Removed the old nginx container (Caddy replaces it)"
  fi
  if [[ -f /etc/systemd/system/doq-certbot-renew.timer ]]; then
    systemctl disable --now doq-certbot-renew.timer >/dev/null 2>&1 || true
    rm -f /etc/systemd/system/doq-certbot-renew.service /etc/systemd/system/doq-certbot-renew.timer
    systemctl daemon-reload
  fi
  return 0
}

# Start / refresh the edge container of the current mode, and stop the other one
caddy_apply() {
  if [[ "$(edge_mode)" == "tunnel" ]]; then
    [[ -n "$(env_get TUNNEL_TOKEN)" ]] || die "EDGE_MODE=tunnel but TUNNEL_TOKEN is empty: run sudo ./deployment/cloudflare/setup.sh first"
    retire_caddy
    dc up -d cloudflared
    return 0
  fi
  docker rm -f $(docker ps -aq --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" --filter label=com.docker.compose.service=cloudflared) >/dev/null 2>&1 || true
  if [[ "$(container_health caddy)" == "healthy" ]]; then
    dc exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 \
      || dc up -d --force-recreate caddy
  fi
  retire_nginx
  # Recreates the container only when its image/environment changed
  dc up -d caddy
}

# Tunnel mode: remove the Caddy container (its certificate volume is kept)
retire_caddy() {
  local old
  old="$(docker ps -aq --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" --filter label=com.docker.compose.service=caddy)"
  if [[ -n "$old" ]]; then
    docker rm -f $old >/dev/null
    log "Stopped Caddy (Cloudflare Tunnel serves the site now; the doq_caddy_data volume is kept)"
  fi
  return 0
}

# True when the edge container is up (cloudflared has no healthcheck: "running" is enough)
edge_ready() {
  local s; s="$(container_health "$(edge_service)")"
  [[ "$s" == "healthy" || ( "$(edge_mode)" == "tunnel" && "$s" == "running" ) ]]
}

# Wait for the edge container of the current mode
wait_edge() {
  local timeout="${1:-90}" waited=0
  while (( waited < timeout )); do
    edge_ready && { ok "$(edge_service) is up"; return 0; }
    sleep 3; waited=$((waited + 3))
  done
  warn "$(edge_service) is not up. Last log lines:"
  dc logs --tail 40 "$(edge_service)" >&2 || true
  return 1
}

# Local end-to-end check (independent from public DNS).
#   caddy:  through Caddy over HTTPS (-k: also while Caddy still uses its temporary certificate)
#   tunnel: straight to the app container, with the public Host header
check_site() {
  local domain="$1" path="$2"
  if [[ "$(edge_mode)" == "tunnel" ]]; then
    dc exec -T app node -e "require('http').get({host:'127.0.0.1',port:3000,path:process.argv[1],headers:{host:process.argv[2],'x-forwarded-proto':'https'}},r=>{console.log(r.statusCode);process.exit(0)}).on('error',()=>{console.log('000');process.exit(0)})" "$path" "$domain" 2>/dev/null || echo "000"
    return 0
  fi
  http_status -k --resolve "${domain}:443:127.0.0.1" "https://${domain}${path}"
}

# Cloudflare R2 (S3 API) as the rclone remote "r2" for backups and the uploads copy.
# Written from R2_* values in .env.production to a root-only file; never printed.
RCLONE_CONFIG_FILE="/etc/doq/rclone.conf"
[[ -f "$RCLONE_CONFIG_FILE" ]] && export RCLONE_CONFIG="$RCLONE_CONFIG_FILE"
r2_configured() {
  [[ -n "$(env_get R2_ACCOUNT_ID)" && -n "$(env_get R2_ACCESS_KEY_ID)" && -n "$(env_get R2_SECRET_ACCESS_KEY)" && -n "$(env_get R2_BUCKET)" ]]
}
write_rclone_config() {
  r2_configured || return 1
  install -d -m 700 /etc/doq
  : > "$RCLONE_CONFIG_FILE" && chmod 600 "$RCLONE_CONFIG_FILE"
  cat > "$RCLONE_CONFIG_FILE" <<RCLONE
[r2]
type = s3
provider = Cloudflare
access_key_id = $(env_get R2_ACCESS_KEY_ID)
secret_access_key = $(env_get R2_SECRET_ACCESS_KEY)
endpoint = https://$(env_get R2_ACCOUNT_ID).r2.cloudflarestorage.com
acl = private
no_check_bucket = true
RCLONE
  chmod 600 "$RCLONE_CONFIG_FILE"
  export RCLONE_CONFIG="$RCLONE_CONFIG_FILE"
}

# Expiry date of the certificate Caddy serves for the domain (empty if none yet)
cert_expiry() {
  local domain="$1"
  echo | timeout 10 openssl s_client -connect 127.0.0.1:443 -servername "$domain" 2>/dev/null \
    | openssl x509 -noout -enddate -issuer 2>/dev/null | sed -n 's/^notAfter=//p'
}

# True when Caddy serves a publicly trusted certificate (not the temporary/staging one)
cert_trusted() {
  local domain="$1"
  [[ "$(http_status --resolve "${domain}:443:127.0.0.1" "https://${domain}/health")" == "200" ]]
}
