#!/usr/bin/env bash
# Creates the first admin account from ADMIN_BOOTSTRAP_* in .env.production (create-only,
# uses the project's scripts/bootstrap-admin.js). Clear those values afterwards.
set -Eeuo pipefail
DOQ_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export DOQ_DIR
# shellcheck source=lib.sh
source "$DOQ_DIR/deployment/scripts/lib.sh"
require_root
[[ -n "$(env_get ADMIN_BOOTSTRAP_EMAIL)" && -n "$(env_get ADMIN_BOOTSTRAP_PASSWORD)" ]] \
  || die "Fill ADMIN_BOOTSTRAP_* in .env.production first"
dc run --rm --no-deps -T app node scripts/bootstrap-admin.js
ok "Done. Now remove the ADMIN_BOOTSTRAP_* values from .env.production"
