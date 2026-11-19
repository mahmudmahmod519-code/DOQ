#!/usr/bin/env bash
# Roll the application back to the previous image (doq-app:previous) or a given tag.
#   sudo ./deployment/scripts/rollback.sh            # previous image
#   sudo ./deployment/scripts/rollback.sh <tag>      # e.g. a git short sha from: docker images doq-app
# Database: migrations are additive, so the old code keeps working with the newer schema.
# To also go back in data, restore a backup explicitly: sudo ./deployment/backup/restore.sh <file>
set -Eeuo pipefail
DOQ_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export DOQ_DIR
# shellcheck source=lib.sh
source "$DOQ_DIR/deployment/scripts/lib.sh"
require_root
TAG="${1:-previous}"
docker image inspect "doq-app:${TAG}" >/dev/null 2>&1 || die "Image doq-app:${TAG} not found (list: docker images doq-app)"
CURRENT="$(docker image inspect -f '{{.Id}}' doq-app:latest 2>/dev/null || true)"
[[ -n "$CURRENT" ]] && docker tag doq-app:latest "doq-app:rolled-back-$(date +%Y%m%d%H%M%S)"
docker tag "doq-app:${TAG}" doq-app:latest
dc up -d --no-build app cron
wait_healthy app 240 || die "Rolled-back app is not healthy either — check: dc logs app"
ok "Running doq-app:${TAG} as doq-app:latest"
