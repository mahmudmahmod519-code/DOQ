#!/usr/bin/env bash
# ============================================================================
# DOQ backup: consistent MySQL dump (structure + data, InnoDB --single-transaction)
# + uploaded images, compressed and timestamped, stored on the host (BACKUP_DIR).
# Optional: AES256 encryption (gpg) + off-server copy (rclone).
#
#   sudo ./deployment/backup/backup.sh                 # daily backup (timer)
#   sudo ./deployment/backup/backup.sh --reason manual
#   sudo ./deployment/backup/backup.sh --skip-uploads  # database only
# ============================================================================
set -Eeuo pipefail
DOQ_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export DOQ_DIR
# shellcheck source=../scripts/lib.sh
source "$DOQ_DIR/deployment/scripts/lib.sh"
require_root

REASON="manual"; SKIP_UPLOADS=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reason) REASON="${2//[^a-zA-Z0-9_-]/}"; shift 2 ;;
    --skip-uploads) SKIP_UPLOADS=true; shift ;;
    *) die "Unknown option $1" ;;
  esac
done

BACKUP_DIR="$(env_get BACKUP_DIR)"; BACKUP_DIR="${BACKUP_DIR:-/var/backups/doq}"
RETENTION_DAYS="$(env_get BACKUP_RETENTION_DAYS)"; RETENTION_DAYS="${RETENTION_DAYS:-14}"
MIN_KEEP="$(env_get BACKUP_MIN_KEEP)"; MIN_KEEP="${MIN_KEEP:-3}"
(( MIN_KEEP >= 1 )) || MIN_KEEP=1
PASSPHRASE="$(env_get BACKUP_ENCRYPTION_PASSPHRASE)"
REMOTE="$(env_get BACKUP_RCLONE_REMOTE)"
install -d -m 700 "$BACKUP_DIR"

exec 8>/var/lock/doq-backup.lock
flock -w 600 8 || die "Another backup is running"

[[ "$(container_health mysql)" == "healthy" ]] || die "MySQL container is not healthy; backup skipped"

FREE_MB=$(( $(df -Pk "$BACKUP_DIR" | awk 'NR==2 {print $4}') / 1024 ))
(( FREE_MB > 1024 )) || die "Less than 1 GB free in $BACKUP_DIR"

TS="$(date -u +%Y%m%d-%H%M%S)"
BASE="$BACKUP_DIR/doq-${TS}-${REASON}"
DB_FILE="${BASE}.sql.gz"
UP_FILE="${BASE}-uploads.tar.gz"
trap 'rm -f "${DB_FILE}.partial" "${UP_FILE}.partial"' EXIT

step "Database dump -> $DB_FILE"
dc exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --quick --routines --triggers --events --hex-blob --set-gtid-purged=OFF --default-character-set=utf8mb4 --databases "$MYSQL_DATABASE"' \
  | gzip -6 > "${DB_FILE}.partial"
gzip -t "${DB_FILE}.partial" || die "Compressed dump is corrupt"
zcat "${DB_FILE}.partial" | tail -n 1 | grep -q "Dump completed" || die "Dump is incomplete (no 'Dump completed' marker)"
mv "${DB_FILE}.partial" "$DB_FILE"
chmod 600 "$DB_FILE"
ok "Database: $(du -h "$DB_FILE" | cut -f1)"

FILES=("$DB_FILE")
if [[ "$SKIP_UPLOADS" != "true" ]]; then
  step "Uploaded images -> $UP_FILE"
  if docker volume inspect "${COMPOSE_PROJECT}_uploads" >/dev/null 2>&1; then
    docker run --rm --network none --entrypoint tar -v "${COMPOSE_PROJECT}_uploads:/data:ro" doq-app:latest czf - -C /data . > "${UP_FILE}.partial"
    gzip -t "${UP_FILE}.partial" || die "Uploads archive is corrupt"
    mv "${UP_FILE}.partial" "$UP_FILE"; chmod 600 "$UP_FILE"
    FILES+=("$UP_FILE")
    ok "Uploads: $(du -h "$UP_FILE" | cut -f1)"
  else
    warn "Uploads volume not found yet; skipped"
  fi
fi

# Optional encrypted off-server copy (local files stay unencrypted for fast restore)
if [[ -n "$PASSPHRASE" ]]; then
  command -v gpg >/dev/null || { apt-get install -y -qq gnupg >/dev/null; }
  for f in "${FILES[@]}"; do
    gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 --symmetric --cipher-algo AES256 -o "${f}.gpg" "$f" 3<<<"$PASSPHRASE"
    chmod 600 "${f}.gpg"
  done
  ok "Encrypted copies created (*.gpg)"
  if [[ -n "$REMOTE" ]]; then
    command -v rclone >/dev/null || { apt-get install -y -qq rclone >/dev/null; }
    for f in "${FILES[@]}"; do
      rclone copy --quiet "${f}.gpg" "$REMOTE" || warn "Upload of $(basename "$f").gpg to $REMOTE failed"
    done
    ok "Encrypted copies uploaded to $REMOTE"
  fi
  # local .gpg files are only a transfer artefact
  for f in "${FILES[@]}"; do rm -f "${f}.gpg"; done
elif [[ -n "$REMOTE" ]]; then
  warn "BACKUP_RCLONE_REMOTE is set but BACKUP_ENCRYPTION_PASSPHRASE is empty: off-server copy skipped (never upload unencrypted)"
fi

# Retention: delete sets older than RETENTION_DAYS, but always keep the MIN_KEEP newest sets
step "Retention (${RETENTION_DAYS} days, keep at least ${MIN_KEEP})"
mapfile -t SETS < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'doq-*.sql.gz' -printf '%T@ %p\n' | sort -rn | awk '{print $2}')
INDEX=0
for db in "${SETS[@]}"; do
  INDEX=$((INDEX + 1))
  (( INDEX <= MIN_KEEP )) && continue
  if [[ -n "$(find "$db" -mtime +"$RETENTION_DAYS" -print 2>/dev/null)" ]]; then
    rm -f "$db" "${db%.sql.gz}-uploads.tar.gz"
    log "Removed old backup $(basename "$db")"
  fi
done
ok "Backups kept: $(find "$BACKUP_DIR" -maxdepth 1 -name 'doq-*.sql.gz' | wc -l) (latest: $(basename "$DB_FILE"))"
date -u +%FT%TZ > "$BACKUP_DIR/.last-success"
