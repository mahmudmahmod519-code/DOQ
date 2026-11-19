#!/usr/bin/env bash
# ============================================================
# DOQ Backup Script
# Creates database and file backups
# Usage: ./scripts/backup.sh [production|staging]
# ============================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success(){ echo -e "${GREEN}[OK]${NC} $*"; }
warn()   { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()   { echo -e "\n${CYAN}=== $* ===${NC}\n"; }

ENVIRONMENT="${1:-production}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Files
if [[ "$ENVIRONMENT" == "production" ]]; then
    COMPOSE_FILES="-f docker-compose.yml -f docker-compose.production.yml"
    ENV_FILE=".env.production"
else
    COMPOSE_FILES="-f docker-compose.yml -f docker-compose.staging.yml"
    ENV_FILE=".env.staging"
fi

COMPOSE_CMD="docker compose ${COMPOSE_FILES} --env-file ${ENV_FILE}"

# Backup configuration
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# ============================================================
# Main
# ============================================================
step "Starting backup for ${ENVIRONMENT}"

# Create backup directory
mkdir -p "${BACKUP_DIR}/database"
mkdir -p "${BACKUP_DIR}/uploads"

# 1. Database backup
step "1/3 Creating database backup"
DB_BACKUP="${BACKUP_DIR}/database/doq_${ENVIRONMENT}_${TIMESTAMP}.sql"
# Credentials come from the db container's own environment; no shell secrets needed.
$COMPOSE_CMD exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysqldump --single-transaction --quick -u "$MYSQL_USER" "$MYSQL_DATABASE"' > "${DB_BACKUP}"
if [[ ! -s "${DB_BACKUP}" ]]; then
    error "Database backup is empty: ${DB_BACKUP}"
fi
gzip -f "${DB_BACKUP}"
success "Database backup: ${DB_BACKUP}.gz"

# 2. Uploads backup (stored in the doq_uploads docker volume)
step "2/3 Backing up uploads"
UPLOAD_BACKUP="${BACKUP_DIR}/uploads/uploads_${ENVIRONMENT}_${TIMESTAMP}.tar.gz"
if $COMPOSE_CMD exec -T app tar -czf - -C /app/public upload > "${UPLOAD_BACKUP}" 2>/dev/null && [[ -s "${UPLOAD_BACKUP}" ]]; then
    success "Uploads backup: ${UPLOAD_BACKUP}"
else
    rm -f "${UPLOAD_BACKUP}"
    warn "Uploads volume not available, skipping"
fi

# 3. Configuration backup
step "3/3 Backing up configuration"
CONFIG_BACKUP="${BACKUP_DIR}/config_${ENVIRONMENT}_${TIMESTAMP}.tar.gz"
tar -czf "${CONFIG_BACKUP}" \
    -C "$PROJECT_DIR" \
    .env.production .env.staging docker-compose.yml docker-compose.production.yml docker-compose.staging.yml \
    2>/dev/null || true
success "Configuration backup: ${CONFIG_BACKUP}"

# 4. Cleanup old backups
step "Cleaning up backups older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -type f -mtime +${RETENTION_DAYS} -delete
success "Old backups cleaned"

# 5. Verify backups
step "Verifying backups"
for backup in "${DB_BACKUP}.gz" "${UPLOAD_BACKUP}" "${CONFIG_BACKUP}"; do
    if [[ -f "$backup" && -s "$backup" ]]; then
        SIZE=$(du -h "$backup" | cut -f1)
        success "Verified: $backup ($SIZE)"
    else
        warn "Backup missing or empty: $backup"
    fi
done

# Summary
echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  💾 BACKUP COMPLETE                                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${CYAN}📁 Backup Location: ${BACKUP_DIR}${NC}"
echo -e "${CYAN}📅 Timestamp: ${TIMESTAMP}${NC}"
echo -e "${CYAN}🗂️  Files Created:${NC}"
echo -e "  • Database: ${DB_BACKUP}.gz"
echo -e "  • Uploads: ${UPLOAD_BACKUP:-N/A}"
echo -e "  • Config: ${CONFIG_BACKUP}"

# Show disk usage
echo -e "\n${CYAN}💽 Disk Usage:${NC}"
df -h /opt/doq | tail -1
echo
du -sh "${BACKUP_DIR}" 2>/dev/null || true