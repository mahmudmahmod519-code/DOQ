#!/usr/bin/env bash
# Copy uploaded images (docker volume doq_uploads) to Cloudflare R2: r2:<R2_BUCKET>/uploads
# Runs every 15 minutes from doq-r2-sync.timer. It only adds/updates files: nothing is ever deleted in R2.
#
#   sudo ./deployment/cloudflare/r2-sync.sh             # copy server -> R2
#   sudo ./deployment/cloudflare/r2-sync.sh --restore   # new server: copy R2 -> server (missing files only)
set -Eeuo pipefail
DOQ_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export DOQ_DIR
# shellcheck source=../scripts/lib.sh
source "$DOQ_DIR/deployment/scripts/lib.sh"
require_root

r2_configured || { log "R2 is not configured (R2_* in .env.production): nothing to do"; exit 0; }
command -v rclone >/dev/null || apt-get install -y -qq rclone >/dev/null
write_rclone_config
SRC="$(docker volume inspect -f '{{.Mountpoint}}' "${COMPOSE_PROJECT}_uploads" 2>/dev/null || true)"
[[ -n "$SRC" && -d "$SRC" ]] || die "Docker volume ${COMPOSE_PROJECT}_uploads not found (deploy first)"
DEST="r2:$(env_get R2_BUCKET)/uploads"

if [[ "${1:-}" == "--restore" ]]; then
  rclone copy --ignore-existing --transfers 8 "$DEST" "$SRC"
  chown -R 1000:1000 "$SRC"   # the app runs as the "node" user (uid 1000)
  ok "Restored images from $DEST"
else
  rclone copy --size-only --transfers 4 --checkers 8 "$SRC" "$DEST"
  ok "Images copied to $DEST"
fi
