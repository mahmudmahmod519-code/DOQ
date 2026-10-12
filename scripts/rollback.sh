#!/usr/bin/env bash
# ============================================================
# DOQ Rollback Script
# Rolls back to a previous version on VPS
# Usage: ./scripts/rollback.sh [tag|previous] [environment]
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

# Arguments
TARGET="${1:-previous}"
ENVIRONMENT="${2:-production}"

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

# ============================================================
# Main
# ============================================================
clear
echo -e "${RED}"
cat << 'EOF'
╔══════════════════════════════════════════════════════════╗
║  DOQ PRODUCTION ROLLBACK                                ║
║  Rolling back to previous version                       ║
╚══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

log "Environment: ${ENVIRONMENT}"
log "Target: ${TARGET}"

# 1. Show available tags
step "Available deployment tags"
git fetch --tags >/dev/null 2>&1
echo "Recent tags:"
git tag --sort=-v:refname | head -10 | nl

# 2. Determine target tag
if [[ "$TARGET" == "previous" ]]; then
    # Get second latest tag (skip current)
    TARGET_TAG=$(git tag --sort=-v:refname | sed -n '2p')
    if [[ -z "$TARGET_TAG" ]]; then
        error "No previous tag found!"
    fi
    log "Rolling back to previous tag: ${TARGET_TAG}"
else
    # Verify tag exists
    if ! git rev-parse "$TARGET" >/dev/null 2>&1; then
        error "Tag '$TARGET' not found!"
    fi
    TARGET_TAG="$TARGET"
fi

# 3. Confirm rollback
step "Confirm rollback"
echo -e "${YELLOW}About to rollback to: ${TARGET_TAG}${NC}"
echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"
echo
read -p "Type 'rollback' to confirm: " confirm
if [[ "$confirm" != "rollback" ]]; then
    error "Rollback cancelled"
fi

# 4. Backup current state
step "Creating emergency backup"
BACKUP_DIR="/opt/doq/backups/emergency"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
$COMPOSE_CMD exec -T db mysqldump -u doq_user -p"${DB_PASSWORD}" DOQ > "${BACKUP_DIR}/pre_rollback_${TIMESTAMP}.sql"
success "Emergency backup saved to ${BACKUP_DIR}/pre_rollback_${TIMESTAMP}.sql"

# 5. Checkout target tag
step "Checking out tag: ${TARGET_TAG}"
git checkout "$TARGET_TAG"
success "Checked out ${TARGET_TAG}"

# 6. Rebuild and deploy
step "Rebuilding and deploying"
$COMPOSE_CMD build --no-cache app
success "Image rebuilt"

step "Running migrations"
$COMPOSE_CMD run --rm -T app npm run migrate
success "Migrations complete"

step "Zero-downtime deployment"
$COMPOSE_CMD up -d --no-deps --scale app=2 app
sleep 5

# Wait for health
for i in {1..30}; do
    HEALTHY_COUNT=$($COMPOSE_CMD ps --format json app 2>/dev/null | jq -r '[.[] | select(.Health == "healthy")] | length' 2>/dev/null || echo 0)
    if [[ "$HEALTHY_COUNT" -ge 2 ]]; then
        success "New containers healthy"
        break
    fi
    sleep 2
done

$COMPOSE_CMD up -d --no-deps --scale app=1 app
success "Rollback deployment complete"

# 7. Verify
step "Verifying rollback"
sleep 3
if [[ "$ENVIRONMENT" == "production" ]]; then
    DOMAIN="doq.example.com"
else
    DOMAIN="staging.doq.example.com"
fi

if curl -k -s "https://${DOMAIN}/security/csrf" | grep -q '"token"'; then
    success "Rollback verified - HTTPS endpoint responding"
else
    error "Rollback verification failed!"
fi

# 8. Cleanup
step "Cleaning up"
docker image prune -f >/dev/null 2>&1 || true
success "Cleanup complete"

# ============================================================
# Summary
# ============================================================
echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🔄 ROLLBACK COMPLETE                                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${CYAN}📋 Rollback Details:${NC}"
echo -e "  • Rolled back to: ${TARGET_TAG}"
echo -e "  • Environment: ${ENVIRONMENT}"
echo -e "  • Time: $(date)"
echo -e "  • Emergency backup: ${BACKUP_DIR}/pre_rollback_${TIMESTAMP}.sql"

echo -e "\n${CYAN}🌐 Application URLs:${NC}"
echo -e "  • Main: https://${DOMAIN}"
echo -e "  • Admin: https://${DOMAIN}/admin"

echo -e "\n${GREEN}✅ Rollback successful!${NC}"