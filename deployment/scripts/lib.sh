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

# docker compose for the production stack
dc() {
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
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

# HTTP status of a URL through nginx on this host (Host header set; TLS name via --resolve)
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

# Cloudflare real-IP snippet (or an empty file) for nginx
render_realip() {
  local out="$DOQ_DIR/deployment/nginx/generated/realip.conf" ranges=""
  mkdir -p "$(dirname "$out")"
  if [[ "$(env_get CLOUDFLARE_PROXY)" == "true" ]]; then
    ranges="$(curl -fsS --max-time 10 https://www.cloudflare.com/ips-v4 2>/dev/null; echo; curl -fsS --max-time 10 https://www.cloudflare.com/ips-v6 2>/dev/null)" || true
    if ! grep -qE '^[0-9a-f:.]+/[0-9]+' <<<"$ranges"; then
      ranges="$(cat "$DOQ_DIR/deployment/nginx/cloudflare-ips.txt")"
    fi
    {
      echo "# Generated by deploy.sh: requests come through Cloudflare"
      grep -E '^[0-9a-f:.]+/[0-9]+' <<<"$ranges" | sed 's/^/set_real_ip_from /; s/$/;/'
      echo "real_ip_header CF-Connecting-IP;"
    } > "$out"
  else
    echo "# Generated by deploy.sh: not behind Cloudflare (CLOUDFLARE_PROXY=false)" > "$out"
  fi
}

cert_exists() {
  [[ -s "$DOQ_DIR/deployment/certbot/conf/live/$(env_get DOQ_DOMAIN)/fullchain.pem" ]]
}

# Activate the nginx site template: "http" (before SSL) or "https"
use_nginx_template() {
  local mode="$1" active="$DOQ_DIR/deployment/nginx/active"
  mkdir -p "$active"
  cp "$DOQ_DIR/deployment/nginx/templates/${mode}.conf.template" "$active/doq.conf.template"
}

nginx_mode() { if cert_exists; then echo https; else echo http; fi; }

# Local end-to-end check through nginx (independent from public DNS)
check_site() {
  local domain="$1" mode="$2" path="$3"
  if [[ "$mode" == "https" ]]; then
    http_status --resolve "${domain}:443:127.0.0.1" "https://${domain}${path}"
  else
    http_status -H "Host: ${domain}" "http://127.0.0.1${path}"
  fi
}
