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
PROJECT_DIR="/opt/doq"
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
BACKUP_DIR="/opt/doq/backups"
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
$COMPOSE_CMD exec -T db mysqldump -u doq_user -p"${DB_PASSWORD}" DOQ > "${DB_BACKUP}"
gzip "${DB_BACKUP}"
success "Database backup: ${DB_BACKUP}.gz"

# 2. Uploads backup
step "2/3 Backing up uploads"
if [[ -d "/opt/doq/uploads" ]]; then
    UPLOAD_BACKUP="${BACKUP_DIR}/uploads/uploads_${ENVIRONMENT}_${TIMESTAMP}.tar.gz"
    tar -czf "${UPLOAD_BACKUP}" -C /opt/doq uploads
    success "Uploads backup: ${UPLOAD_BACKUP}"
else
    warn "No uploads directory found, skipping"
fi

# 3. Configuration backup
step "3/3 Backing up configuration"
CONFIG_BACKUP="${BACKUP_DIR}/config_${ENVIRONMENT}_${TIMESTAMP}.tar.gz"
tar -czf "${CONFIG_BACKUP}" \
    -C /opt/doq \
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