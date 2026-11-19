#!/usr/bin/env bash
# ============================================================================
# DOQ restore (manual only — never called by deploy/update).
#
#   sudo ./deployment/backup/restore.sh /var/backups/doq/doq-20261119-031500-daily.sql.gz
#   sudo ./deployment/backup/restore.sh <db.sql.gz> --uploads <...-uploads.tar.gz>
#   (encrypted *.gpg files are decrypted with BACKUP_ENCRYPTION_PASSPHRASE)
#
# Steps: validate file -> explicit confirmation -> safety backup -> stop app/cron ->
#        import -> run additive migrations -> start app/cron -> health check.
# ============================================================================
set -Eeuo pipefail
DOQ_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export DOQ_DIR
# shellcheck source=../scripts/lib.sh
source "$DOQ_DIR/deployment/scripts/lib.sh"
require_root

DB_ARCHIVE="${1:-}"; shift || true
UPLOADS_ARCHIVE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --uploads) UPLOADS_ARCHIVE="$2"; shift 2 ;;
    *) die "Unknown option $1" ;;
  esac
done
[[ -n "$DB_ARCHIVE" && -f "$DB_ARCHIVE" ]] || die "Usage: $0 <backup.sql.gz[.gpg]> [--uploads <uploads.tar.gz[.gpg]>]"
[[ -z "$UPLOADS_ARCHIVE" || -f "$UPLOADS_ARCHIVE" ]] || die "Uploads archive not found: $UPLOADS_ARCHIVE"

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
decrypt() {
  local src="$1" dst="$2"
  if [[ "$src" == *.gpg ]]; then
    local pass; pass="$(env_get BACKUP_ENCRYPTION_PASSPHRASE)"
    [[ -n "$pass" ]] || die "BACKUP_ENCRYPTION_PASSPHRASE is needed to decrypt $src"
    gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 -o "$dst" -d "$src" 3<<<"$pass"
  else
    cp "$src" "$dst"
  fi
}
decrypt "$DB_ARCHIVE" "$WORK/db.sql.gz"
gzip -t "$WORK/db.sql.gz" || die "Backup file is not a valid gzip archive"
zcat "$WORK/db.sql.gz" | tail -n 1 | grep -q "Dump completed" || die "Backup file is incomplete"

DB_NAME="$(env_get DB_NAME)"; DB_NAME="${DB_NAME:-DOQ}"
DUMP_DB="$(zcat "$WORK/db.sql.gz" | grep -m1 -oE '^USE `[^`]+`' | sed -E 's/^USE `([^`]+)`/\1/' || true)"
[[ "$DUMP_DB" == "$DB_NAME" ]] || die "The backup is for database '${DUMP_DB:-unknown}', but this server uses '$DB_NAME'"
[[ "$(container_health mysql)" == "healthy" ]] || die "MySQL container is not healthy"

if [[ -n "$UPLOADS_ARCHIVE" ]]; then
  decrypt "$UPLOADS_ARCHIVE" "$WORK/uploads.tar.gz"
  gzip -t "$WORK/uploads.tar.gz" || die "Uploads archive is not valid"
fi

echo
warn "This REPLACES the tables of database '$DB_NAME' with the content of:"
echo "      $(basename "$DB_ARCHIVE") ($(du -h "$DB_ARCHIVE" | cut -f1))"
[[ -n "$UPLOADS_ARCHIVE" ]] && echo "      and restores uploaded images from $(basename "$UPLOADS_ARCHIVE") (existing files are kept)"
read -r -p "Type  RESTORE ${DB_NAME}  to continue: " ANSWER
[[ "$ANSWER" == "RESTORE ${DB_NAME}" ]] || die "Cancelled — nothing changed"

step "Safety backup of the current data"
"$DOQ_DIR/deployment/backup/backup.sh" --reason pre-restore || die "Safety backup failed — restore aborted, nothing changed"

step "Stopping app and cron"
dc stop app cron nginx

step "Importing database"
if ! zcat "$WORK/db.sql.gz" | dc exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --default-character-set=utf8mb4'; then
  dc start app cron nginx || true
  die "Import failed. The pre-restore backup is in $(env_get BACKUP_DIR). Run this script with it to roll back."
fi
ok "Database imported"

if [[ -n "$UPLOADS_ARCHIVE" ]]; then
  step "Restoring uploaded images"
  docker run --rm -i --network none --user 0 --entrypoint sh -v "${COMPOSE_PROJECT}_uploads:/data" doq-app:latest \
    -c 'tar xzf - -C /data && chown -R 1000:1000 /data' < "$WORK/uploads.tar.gz"
  ok "Uploads restored"
fi

step "Migrations + restart"
dc run --rm --no-deps -T app npm run migrate
dc up -d app cron nginx
wait_healthy app 240 || die "App is not healthy after restore"
ok "Restore finished"
