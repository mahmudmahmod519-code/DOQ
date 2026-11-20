#!/usr/bin/env bash
# ============================================================================
# DOQ — fresh server bootstrap (Ubuntu 24.04, amd64/arm64), one command:
#
#   curl -fsSL https://raw.githubusercontent.com/mahmudmahmod519-code/DOQ/main/server-bootstrap.sh -o server-bootstrap.sh
#   sudo bash server-bootstrap.sh --domain doq.example.com --email you@example.com
#
# What it does (safe to run again):
#   1. Installs base packages, Node.js 22 + npm, Docker Engine + Compose
#   2. Configures git (user.name / user.email)
#   3. Creates an SSH deploy key for GitHub (used only if the repo is private)
#   4. Clones (or updates) https://github.com/mahmudmahmod519-code/DOQ.git into /opt/doq
#   5. Creates .env.production with the domain/email and freshly generated secrets
#      (DB passwords, root password, JWT secret, backup encryption passphrase)
#   6. Runs ./deploy.sh (MySQL, app, Caddy with Let's Encrypt HTTPS, backups, timers, checks)
#
# Secrets are never printed. A copy of .env.production is saved to /root/doq-secrets/.
# ============================================================================
set -Eeuo pipefail

# ---------------- settings (override with flags or environment) ----------------
REPO_HTTPS="${REPO_HTTPS:-https://github.com/mahmudmahmod519-code/DOQ.git}"
REPO_SSH="${REPO_SSH:-git@github.com:mahmudmahmod519-code/DOQ.git}"
GIT_NAME="${GIT_NAME:-mahmudmahmod519-code}"
GIT_EMAIL="${GIT_EMAIL:-mahmudmahmod519-code@github.com}"
APP_DIR="${APP_DIR:-/opt/doq}"
BRANCH="${BRANCH:-}"
DOMAIN="${DOQ_DOMAIN:-}"
EMAIL="${LETSENCRYPT_EMAIL:-}"
INCLUDE_WWW="${INCLUDE_WWW:-}"
NODE_MAJOR=22
SKIP_DEPLOY=false
DEPLOY_KEY="/root/.ssh/doq_github_ed25519"

usage() {
  cat <<USAGE
Usage: sudo bash $0 --domain <domain> --email <letsencrypt-email> [options]
  --domain DOMAIN      your domain, e.g. doq.example.com (DNS A record -> this server)
  --email EMAIL        email for Let's Encrypt notices
  --www                also serve www.DOMAIN
  --branch NAME        git branch to deploy (default: repository default branch)
  --dir PATH           install directory (default: /opt/doq)
  --no-deploy          prepare everything but do not run deploy.sh
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --www) INCLUDE_WWW=true; shift ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --dir) APP_DIR="$2"; shift 2 ;;
    --no-deploy) SKIP_DEPLOY=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

if [[ -t 1 ]]; then G=$'\033[0;32m'; Y=$'\033[1;33m'; R=$'\033[0;31m'; C=$'\033[0;36m'; N=$'\033[0m'; else G=""; Y=""; R=""; C=""; N=""; fi
step() { echo; echo "${C}==> $*${N}"; }
ok()   { echo "${G}[ OK ]${N} $*"; }
warn() { echo "${Y}[WARN]${N} $*" >&2; }
die()  { echo "${R}[FAIL]${N} $*" >&2; exit 1; }
trap 'warn "Stopped at line $LINENO. Nothing was deleted; fix the problem above and run the same command again."' ERR

[[ $EUID -eq 0 ]] || die "Run as root: sudo bash $0 ..."
[[ -r /etc/os-release ]] && . /etc/os-release
[[ "${ID:-}" == "ubuntu" || "${ID:-}" == "debian" ]] || die "Ubuntu 24.04 is required (found ${ID:-unknown})"
[[ "${VERSION_ID:-}" == "24.04" ]] || warn "Tested on Ubuntu 24.04 (found ${PRETTY_NAME:-unknown})"
export DEBIAN_FRONTEND=noninteractive

# Ask for domain / email when not given (interactive runs only)
if [[ -z "$DOMAIN" && -t 0 ]]; then read -r -p "Domain (e.g. doq.example.com): " DOMAIN; fi
if [[ -z "$EMAIL" && -t 0 ]]; then read -r -p "Email for Let's Encrypt: " EMAIL; fi
DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%%/*}"
[[ "$DOMAIN" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]] || die "Give a valid domain with --domain (got '${DOMAIN}')"
[[ "$EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || die "Give a valid email with --email (got '${EMAIL}')"

# ----------------------------------------------------------------------------
step "1/6 System packages"
# ----------------------------------------------------------------------------
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git openssl jq ufw dnsutils logrotate unattended-upgrades openssh-client >/dev/null
# Automatic security updates
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true
# Swap file on small servers (helps image builds; skipped when swap already exists)
if [[ -z "$(swapon --show --noheadings)" ]] && (( $(awk '/MemTotal/ {print $2}' /proc/meminfo) < 4000000 )); then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "2 GB swap file created"
fi
ok "Base packages installed"

# ----------------------------------------------------------------------------
step "2/6 Node.js ${NODE_MAJOR} + npm, Docker Engine + Compose"
# ----------------------------------------------------------------------------
CURRENT_NODE="$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || true)"
if [[ "${CURRENT_NODE:-0}" != "$NODE_MAJOR" ]]; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs >/dev/null
fi
ok "Node.js $(node -v), npm $(npm -v)"

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
fi
systemctl enable --now docker >/dev/null 2>&1
ok "$(docker --version | cut -d, -f1), Compose $(docker compose version --short)"

# ----------------------------------------------------------------------------
step "3/6 Git identity"
# ----------------------------------------------------------------------------
git config --global user.name "$GIT_NAME"
git config --global user.email "$GIT_EMAIL"
git config --global pull.ff only
git config --global init.defaultBranch main
ok "git user: $GIT_NAME <$GIT_EMAIL>"

# ----------------------------------------------------------------------------
step "4/6 Security key for GitHub + clone the repository"
# ----------------------------------------------------------------------------
install -d -m 700 /root/.ssh
if [[ ! -f "$DEPLOY_KEY" ]]; then
  ssh-keygen -t ed25519 -N "" -C "doq-deploy@$(hostname)" -f "$DEPLOY_KEY" >/dev/null
  ok "Created SSH deploy key $DEPLOY_KEY"
else
  ok "SSH deploy key already exists ($DEPLOY_KEY)"
fi
chmod 600 "$DEPLOY_KEY"
if ! grep -q "doq_github_ed25519" /root/.ssh/config 2>/dev/null; then
  cat >> /root/.ssh/config <<SSHCFG

Host github.com
    HostName github.com
    User git
    IdentityFile $DEPLOY_KEY
    IdentitiesOnly yes
SSHCFG
  chmod 600 /root/.ssh/config
fi
ssh-keyscan -t ed25519 github.com 2>/dev/null >> /root/.ssh/known_hosts
sort -u -o /root/.ssh/known_hosts /root/.ssh/known_hosts

BRANCH_ARGS=()
[[ -n "$BRANCH" ]] && BRANCH_ARGS=(--branch "$BRANCH")

if [[ -d "$APP_DIR/.git" ]]; then
  if [[ -n "$(git -C "$APP_DIR" status --porcelain --untracked-files=no)" ]]; then
    die "$APP_DIR has local changes in tracked files. Commit/stash them (git -C $APP_DIR status) and run again."
  fi
  [[ -n "$BRANCH" ]] && git -C "$APP_DIR" checkout -q "$BRANCH"
  git -C "$APP_DIR" pull --ff-only
  ok "Repository updated: $APP_DIR ($(git -C "$APP_DIR" rev-parse --short HEAD))"
else
  [[ -e "$APP_DIR" && -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]] && die "$APP_DIR exists and is not empty (and not a git clone). Move it away or use --dir."
  if GIT_TERMINAL_PROMPT=0 git clone -q "${BRANCH_ARGS[@]}" "$REPO_HTTPS" "$APP_DIR" 2>/dev/null; then
    ok "Cloned $REPO_HTTPS -> $APP_DIR"
  else
    echo
    warn "The repository is private (or not reachable over HTTPS). Add this server's key to GitHub:"
    echo "   GitHub -> DOQ repository -> Settings -> Deploy keys -> Add deploy key"
    echo "   Title: doq-server-$(hostname)   |  leave 'Allow write access' unchecked"
    echo
    cat "${DEPLOY_KEY}.pub"
    echo
    if [[ -t 0 ]]; then
      read -r -p "Press Enter after adding the key on GitHub... " _
    else
      die "Add the key above as a Deploy key, then run this command again."
    fi
    SSH_OUT="$(ssh -o BatchMode=yes -T git@github.com 2>&1 || true)"   # exits 1 even on success
    grep -q "successfully authenticated" <<<"$SSH_OUT" \
      || die "GitHub did not accept the key yet. Check the Deploy key and run this command again."
    git clone -q "${BRANCH_ARGS[@]}" "$REPO_SSH" "$APP_DIR"
    ok "Cloned $REPO_SSH -> $APP_DIR"
  fi
fi
cd "$APP_DIR"
for f in deploy.sh docker-compose.prod.yml Caddyfile deployment/env.production.example deployment/scripts/lib.sh; do
  [[ -f "$f" ]] || die "$f is missing in the repository. Push the deployment files (deploy.sh, deployment/, docker-compose.prod.yml) first."
done
chmod +x deploy.sh update.sh deployment/backup/*.sh deployment/scripts/*.sh 2>/dev/null || true

# ----------------------------------------------------------------------------
step "5/6 Production environment and generated secrets"
# ----------------------------------------------------------------------------
ENV_FILE="$APP_DIR/.env.production"
set_env() {   # set_env KEY VALUE  (value is never printed)
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    awk -v k="$key" -v v="$value" 'BEGIN{d=0} $0 ~ "^"k"=" { if(!d){print k"="v; d=1}; next } {print}' "$ENV_FILE" > "$tmp"
  else
    cp "$ENV_FILE" "$tmp"; printf '%s=%s\n' "$key" "$value" >> "$tmp"
  fi
  cat "$tmp" > "$ENV_FILE"; rm -f "$tmp"
}
get_env() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true; }
empty_or_placeholder() { local v="$1"; [[ -z "$v" || "$v" == CHANGE_ME* || "$v" == *example.com* ]]; }

if [[ ! -f "$ENV_FILE" ]]; then
  install -m 600 deployment/env.production.example "$ENV_FILE"
  ok "Created .env.production"
else
  ok ".env.production already exists — only empty values are filled"
fi
chmod 600 "$ENV_FILE"

set_env DOQ_DOMAIN "$DOMAIN"
set_env LETSENCRYPT_EMAIL "$EMAIL"
[[ "$INCLUDE_WWW" == "true" ]] && set_env INCLUDE_WWW true
empty_or_placeholder "$(get_env PUBLIC_URL)" && set_env PUBLIC_URL "https://${DOMAIN}"
if empty_or_placeholder "$(get_env DOQ_SERVER_NAMES)"; then
  if [[ "$(get_env INCLUDE_WWW)" == "true" ]]; then set_env DOQ_SERVER_NAMES "${DOMAIN} www.${DOMAIN}"; else set_env DOQ_SERVER_NAMES "$DOMAIN"; fi
fi

DB_VOLUME_EXISTS=false
docker volume inspect doq_mysql_data >/dev/null 2>&1 && DB_VOLUME_EXISTS=true
for key in DB_PASSWORD MYSQL_ROOT_PASSWORD; do
  if empty_or_placeholder "$(get_env "$key")"; then
    [[ "$DB_VOLUME_EXISTS" == "true" ]] && die "$key is empty but the database already exists. Put the original value back in $ENV_FILE (see /root/doq-secrets/)."
    set_env "$key" "$(openssl rand -hex 24)"
    ok "Generated $key"
  fi
done
JWT="$(get_env JWT_SECRET)"
if empty_or_placeholder "$JWT" || (( ${#JWT} < 32 )); then set_env JWT_SECRET "$(openssl rand -hex 48)"; ok "Generated JWT_SECRET"; fi
unset JWT
if [[ -z "$(get_env BACKUP_ENCRYPTION_PASSPHRASE)" ]]; then
  set_env BACKUP_ENCRYPTION_PASSPHRASE "$(openssl rand -hex 32)"
  ok "Generated BACKUP_ENCRYPTION_PASSPHRASE (used for encrypted off-server backups)"
fi

# Keep a private copy of the secrets on the server (root only) — copy it to a password manager too
install -d -m 700 /root/doq-secrets
cp "$ENV_FILE" "/root/doq-secrets/env.production.$(date +%Y%m%d-%H%M%S)"
chmod 600 /root/doq-secrets/*
ok "Secrets saved (not printed): $ENV_FILE and a copy in /root/doq-secrets/"

# DNS hint before deploy.sh does the strict check
SERVER_IP="$(curl -4 -fsS --max-time 10 https://api.ipify.org 2>/dev/null || true)"
DNS_IP="$(dig +short A "$DOMAIN" @1.1.1.1 2>/dev/null | tail -n1 || true)"
if [[ -n "$SERVER_IP" && "$DNS_IP" != "$SERVER_IP" ]]; then
  warn "$DOMAIN resolves to '${DNS_IP:-nothing}', this server is $SERVER_IP."
  warn "Create an A record $DOMAIN -> $SERVER_IP (Cloudflare: 'DNS only'). Caddy issues the HTTPS certificate automatically once it matches."
fi

# ----------------------------------------------------------------------------
step "6/6 Production deployment"
# ----------------------------------------------------------------------------
if [[ "$SKIP_DEPLOY" == "true" ]]; then
  ok "Ready. Run: cd $APP_DIR && sudo ./deploy.sh"
  exit 0
fi
trap - ERR
./deploy.sh
