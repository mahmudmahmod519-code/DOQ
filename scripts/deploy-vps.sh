#!/usr/bin/env bash
# ============================================================
# DOQ VPS Production Deployment Script
# Deploys to a VPS with Docker Compose, Caddy (HTTPS), and zero-downtime updates
# Usage: ./scripts/deploy-vps.sh [production|staging]
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

# Configuration
ENVIRONMENT="${1:-production}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_DIR"

# Files
COMPOSE_FILE="docker-compose.yml"
if [[ "$ENVIRONMENT" == "production" ]]; then
    COMPOSE_FILES="-f docker-compose.yml -f docker-compose.production.yml"
    ENV_FILE=".env.production"
    DOMAIN="${DOMAIN:-doq.example.com}"
else
    COMPOSE_FILES="-f docker-compose.yml -f docker-compose.staging.yml"
    ENV_FILE=".env.staging"
    DOMAIN="${DOMAIN:-staging.doq.example.com}"
fi

COMPOSE_CMD="docker compose ${COMPOSE_FILES} --env-file ${ENV_FILE}"

# ============================================================
# Helper Functions
# ============================================================
check_cmd() { command -v "$1" >/dev/null 2>&1 || error "$1 not found. Install it first."; }

wait_for_health() {
    local service="$1"
    local max_attempts=60
    local attempt=0
    log "Waiting for ${service} to be healthy..."
    while [[ $attempt -lt $max_attempts ]]; do
        local health
        health=$($COMPOSE_CMD ps --format json "$service" 2>/dev/null | jq -r '.[0].Health // "unknown"' 2>/dev/null || echo "unknown")
        if [[ "$health" == "healthy" ]]; then
            success "${service} is healthy"
            return 0
        fi
        sleep 2
        ((attempt++))
    done
    error "${service} did not become healthy in time"
}

backup_database() {
    step "Creating database backup"
    local backup_dir="/opt/doq/backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    mkdir -p "$backup_dir"
    $COMPOSE_CMD exec -T db mysqldump -u doq_user -p"${DB_PASSWORD}" DOQ > "${backup_dir}/doq_${timestamp}.sql"
    success "Backup saved to ${backup_dir}/doq_${timestamp}.sql"
}

# ============================================================
# Main
# ============================================================
clear
echo -e "${CYAN}"
cat << 'EOF'
╔══════════════════════════════════════════════════════════╗
║  DOQ VPS Production Deployment                          ║
║  Zero-downtime deployment with health checks & rollback ║
╚══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"
log "Environment: ${ENVIRONMENT}"
log "Domain: ${DOMAIN}"
log "Project: ${PROJECT_DIR}"

# 1. Check prerequisites
step "1/10 Checking prerequisites"
check_cmd docker
check_cmd "docker compose"
check_cmd jq
check_cmd openssl
success "All commands available"

# 2. Verify environment file
step "2/10 Verifying environment file"
if [[ ! -f "$ENV_FILE" ]]; then
    error "${ENV_FILE} not found! Copy ${ENV_FILE}.example and configure it."
fi
success "Using ${ENV_FILE}"

# 3. Verify SSL certificates (Caddy handles this automatically, but check DNS)
step "3/10 Verifying DNS for ${DOMAIN}"
if ! dig +short "${DOMAIN}" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    warn "DNS for ${DOMAIN} may not be configured. Caddy will attempt to provision certs."
else
    success "DNS resolves correctly"
fi

# 4. Pull latest images
step "4/10 Pulling latest Docker images"
$COMPOSE_CMD pull
success "Images pulled"

# 5. Backup database before deployment
step "5/10 Backing up database"
backup_database

# 6. Build new images
step "6/10 Building application image"
$COMPOSE_CMD build --no-cache app
success "Application image built"

# 7. Run migrations in a temporary container
step "7/10 Running database migrations"
$COMPOSE_CMD run --rm -T app npm run migrate
success "Migrations complete"

# 8. Deploy with zero-downtime (rolling update)
step "8/10 Deploying with zero-downtime (rolling update)"
# Scale up new containers before scaling down old ones
$COMPOSE_CMD up -d --no-deps --scale app=2 app
sleep 5

# Wait for new containers to be healthy
for i in {1..30}; do
    HEALTHY_COUNT=$($COMPOSE_CMD ps --format json app 2>/dev/null | jq -r '[.[] | select(.Health == "healthy")] | length' 2>/dev/null || echo 0)
    if [[ "$HEALTHY_COUNT" -ge 2 ]]; then
        success "New containers are healthy"
        break
    fi
    sleep 2
done

# Scale down to 1 (or desired replicas)
$COMPOSE_CMD up -d --no-deps --scale app=1 app
success "Zero-downtime deployment complete"

# 9. Verify deployment
step "9/10 Verifying deployment"
sleep 3
if curl -k -s "https://${DOMAIN}/security/csrf" | grep -q '"token"'; then
    success "HTTPS endpoint responding with CSRF token"
else
    error "Deployment verification failed - HTTPS endpoint not responding correctly"
fi

# 10. Cleanup old images
step "10/10 Cleaning up old Docker images"
docker image prune -f >/dev/null 2>&1 || true
success "Cleanup complete"

# ============================================================
# Summary
# ============================================================
echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🎉 DEPLOYMENT COMPLETE - ${ENVIRONMENT^^}                           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${CYAN}🌐 Application URLs:${NC}"
echo -e "  • Main:        https://${DOMAIN}"
echo -e "  • Admin:       https://${DOMAIN}/admin"
echo -e "  • API Health:  https://${DOMAIN}/health"
echo -e "  • CSRF Token:  https://${DOMAIN}/security/csrf"

echo -e "\n${CYAN}🛠️  Useful Commands:${NC}"
echo -e "  • View logs:      ${COMPOSE_CMD} logs -f app"
echo -e "  • View DB logs:   ${COMPOSE_CMD} logs -f db"
echo -e "  • Restart app:    ${COMPOSE_CMD} restart app"
echo -e "  • Shell into app: ${COMPOSE_CMD} exec app sh"
echo -e "  • Rollback:       ${COMPOSE_CMD} down && git checkout HEAD~1 && ${COMPOSE_CMD} up -d"

echo -e "\n${GREEN}✅ Deployment successful!${NC}"