#!/usr/bin/env bash
# ============================================================================
# DOQ update: pull latest code -> validate -> build new image -> backup ->
# migrate -> restart -> health check -> automatic rollback on failure.
#
#   sudo ./update.sh              # git pull (fast-forward only) + deploy
#   sudo ./update.sh --no-pull    # use the code already on disk (uploaded manually)
#
# Uploads volume and database volume are never touched. Previous images are
# kept until the new version passes its health checks.
# ============================================================================
set -Eeuo pipefail
DOQ_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DOQ_DIR
# shellcheck source=deployment/scripts/lib.sh
source "$DOQ_DIR/deployment/scripts/lib.sh"
require_root
cd "$DOQ_DIR"

PULL=true
[[ "${1:-}" == "--no-pull" ]] && PULL=false

ensure_log_dir
UPDATE_LOG="$LOG_DIR/update-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$UPDATE_LOG") 2>&1
exec 9>/var/lock/doq-deploy.lock
flock -n 9 || die "Another deploy.sh / update.sh is already running"

[[ -f "$ENV_FILE" ]] || die "No .env.production — run sudo ./deploy.sh for the first deployment"
docker image inspect doq-app:latest >/dev/null 2>&1 || die "No running deployment found — run sudo ./deploy.sh first"

step "1/7 Code"
if [[ "$PULL" == "true" && -d .git ]]; then
  if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    RECOVERY_HINT="commit/stash the local changes (git status) or run with --no-pull"
    die "Local changes in tracked files would be overwritten"
  fi
  BEFORE="$(git rev-parse --short HEAD)"
  git pull --ff-only
  AFTER="$(git rev-parse --short HEAD)"
  ok "Code: ${BEFORE} -> ${AFTER}"
else
  AFTER="$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
  ok "Using code on disk (${AFTER})"
fi

step "2/7 Validate"
validate_env
render_caddy_env
dc config -q || die "docker-compose.prod.yml is invalid"
caddy_validate || die "Caddyfile is invalid — nothing was changed"
ok "Configuration valid (compose + Caddyfile)"

step "3/7 Build"
STAMP="$(date +%Y%m%d%H%M%S)"
docker tag doq-app:latest doq-app:previous
docker tag doq-app:latest "doq-app:before-${STAMP}"
ok "Current image kept as doq-app:previous"
dc build --pull app
docker tag doq-app:latest "doq-app:${AFTER}"

rollback() {
  warn "Rolling back to the previous image"
  docker tag doq-app:previous doq-app:latest
  dc up -d --no-build app cron || true
  if wait_healthy app 240; then
    warn "Rolled back: the previous version is running again. Data was not changed except by additive migrations."
  else
    warn "Previous version is not healthy either. See: sudo ./deployment/scripts/status.sh"
  fi
  RECOVERY_HINT="fix the problem in the code, push, and run sudo ./update.sh again. Database backup: $(env_get BACKUP_DIR)"
  die "Update failed"
}

step "4/7 Backup"
"$DOQ_DIR/deployment/backup/backup.sh" --reason pre-update || { docker tag doq-app:previous doq-app:latest; die "Backup failed — update aborted before changing anything"; }

step "5/7 Migrations"
dc run --rm --no-deps -T app npm run migrate || rollback

step "6/7 Restart"
dc up -d --no-build --remove-orphans app cron
wait_healthy app 240 || rollback
# Reload a changed Caddyfile without downtime
caddy_apply
wait_healthy caddy 90 || rollback

step "7/7 Verify"
DOMAIN="$(env_get DOQ_DOMAIN)"
for path in /health/ready /api/v1/health /m/api/v1/home /; do
  code="$(check_site "$DOMAIN" "$path")"
  [[ "$code" == "200" ]] && ok "${path} -> 200" || { warn "${path} -> ${code}"; rollback; }
done

# Keep: latest, previous, and the 3 newest dated images. Older app images are removed only now.
mapfile -t OLD < <(docker images doq-app --format '{{.Tag}} {{.CreatedAt}}' | grep -vE '^(latest|previous) ' | sort -k2,4 -r | awk 'NR>3 {print $1}')
for tag in "${OLD[@]}"; do docker rmi "doq-app:${tag}" >/dev/null 2>&1 || true; done
docker image prune -f >/dev/null
ok "Update complete (${AFTER}). Rollback if needed: sudo ./deployment/scripts/rollback.sh"
