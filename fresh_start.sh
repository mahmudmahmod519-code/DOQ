#!/usr/bin/env bash
# ============================================================
# DOQ Complete Fresh Start Script
# Wipes database, runs migrations, creates accounts, seeds data
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

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# ============================================================
# Configuration (edit these if needed)
# ============================================================
ADMIN_EMAIL="admin@doq.local"
ADMIN_PASS="AdminLocal123!"
ADMIN_TOTP="JBSWY3DPEHPK3PXP"
ADMIN_FIRST="DOQ"
ADMIN_LAST="LocalAdmin"
ADMIN_PHONE="01012345678"

TEST_PASSWORD="TestAccount123!"

# ============================================================
# Main
# ============================================================
clear
echo -e "${CYAN}"
cat << 'EOF'
╔═══════════════════════════════════════════════════════════╗
║  DOQ Complete Fresh Start                                 ║
║  Wipes DB → Migrations → Admin → Test Accounts → Seed     ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# 1. Stop and remove everything (including DB volume)
step "1/7 Stopping containers and wiping database volume"
docker compose down -v 2>/dev/null || true
success "Containers stopped, database volume removed"

# 2. Start MySQL only
step "2/7 Starting MySQL container"
docker compose up -d db
success "MySQL container started"

# 3. Wait for MySQL to be healthy
step "3/7 Waiting for MySQL to be ready"
for i in {1..60}; do
    health=$(docker inspect --format='{{.State.Health.Status}}' doq_project-db-1 2>/dev/null || echo "starting")
    if [[ "$health" == "healthy" ]]; then
        success "MySQL is healthy"
        break
    fi
    echo -n "."
    sleep 2
done
[[ "$health" == "healthy" ]] || error "MySQL did not become healthy"

# 4. Run migrations
step "4/7 Running database migrations"
npm run migrate
success "Migrations complete"

# 5. Create admin account
step "5/7 Creating admin account"
export ADMIN_BOOTSTRAP_EMAIL="$ADMIN_EMAIL"
export ADMIN_BOOTSTRAP_PASSWORD="$ADMIN_PASS"
export ADMIN_BOOTSTRAP_FIRST_NAME="$ADMIN_FIRST"
export ADMIN_BOOTSTRAP_LAST_NAME="$ADMIN_LAST"
export ADMIN_BOOTSTRAP_PHONE="$ADMIN_PHONE"
export ADMIN_BOOTSTRAP_TOTP_SECRET="$ADMIN_TOTP"
npm run bootstrap:admin
success "Admin account created"

# 6. Create test accounts
step "6/7 Creating test accounts (customer, chef, delivery, admin)"
export DOQ_ALLOW_TEST_ACCOUNTS=true
export DOQ_TEST_PASSWORD="$TEST_PASSWORD"
npm run bootstrap:test-accounts
success "Test accounts created"

# 7. Seed database with massive data
step "7/7 Seeding database with full dataset"
export DOQ_SEED_PASSWORD="$TEST_PASSWORD"
export DOQ_ALLOW_SEED=true
node seed_data.js
success "Database seeded with full dataset"

# ============================================================
# Summary
# ============================================================
echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    🎉 FRESH START COMPLETE 🎉                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${CYAN}📋 TEST ACCOUNTS (all use password: ${TEST_PASSWORD})${NC}"
echo -e "${CYAN}┌──────────────┬──────────────────────────────────────┬────────────┬──────────┐${NC}"
echo -e "${CYAN}│ Role         │ Email                                │ Phone      │ Status   │${NC}"
echo -e "${CYAN}├──────────────┼──────────────────────────────────────┼────────────┼──────────┤${NC}"
echo -e "${CYAN}│ ${YELLOW}Admin (Boot)${CYAN}  │ ${ADMIN_EMAIL}                    │ ${ADMIN_PHONE} │ Approved │${NC}"
echo -e "${CYAN}├──────────────┼──────────────────────────────────────┼────────────┼──────────┤${NC}"
echo -e "${CYAN}│ ${YELLOW}Customer${CYAN}    │ doq-test-customer@example.test       │ 01000000001 │ Approved │${NC}"
echo -e "${CYAN}│ ${YELLOW}Chef${CYAN}       │ doq-test-chef@example.test           │ 01000000002 │ Pending* │${NC}"
echo -e "${CYAN}│ ${YELLOW}Delivery${CYAN}    │ doq-test-delivery@example.test       │ 01000000003 │ Pending* │${NC}"
echo -e "${CYAN}│ ${YELLOW}Admin${CYAN}      │ doq-test-admin@example.test          │ 01000000004 │ Approved │${NC}"
echo -e "${CYAN}└──────────────┴──────────────────────────────────────┴────────────┴──────────┘${NC}"
echo
echo -e "${YELLOW}* Chef & Delivery accounts need admin approval:${NC}"
echo -e "  1. Login as admin: http://localhost:3000/admin"
echo -e "  2. Email: ${ADMIN_EMAIL}"
echo -e "  3. Password: ${ADMIN_PASS}"
echo -e "  4. 2FA: Use authenticator app with secret: ${ADMIN_TOTP}"
echo -e "  5. Go to Operations → Pending Accounts → Approve"
echo
echo -e "${CYAN}🔗 KEY URLs:${NC}"
echo -e "  • Home:        http://localhost:3000"
echo -e "  • Admin:       http://localhost:3000/admin"
echo -e "  • Customer:    http://localhost:3000/my-orders"
echo -e "  • Chef:        http://localhost:3000/users/dashboard"
echo -e "  • Delivery:    http://localhost:3000/delivery"
echo -e "  • Auth:        http://localhost:3000/auth"
echo
echo -e "${GREEN}✅ Ready! Start the app with: npm start${NC}"
echo -e "${GREEN}   Then open http://localhost:3000 in your browser${NC}"