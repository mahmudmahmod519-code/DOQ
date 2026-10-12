#!/usr/bin/env bash
# ============================================================
# DOQ VPS Initial Setup Script
# Run ONCE on a fresh VPS to prepare for deployments
# Usage: ./scripts/setup-vps.sh [production|staging]
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

# ============================================================
# Main
# ============================================================
clear
echo -e "${CYAN}"
cat << 'EOF'
╔══════════════════════════════════════════════════════════╗
║  DOQ VPS Initial Setup                                  ║
║  Prepares fresh VPS for DOQ deployments                 ║
╚══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# 1. Update system
step "1/8 Updating system packages"
apt-get update && apt-get upgrade -y
success "System updated"

# 2. Install Docker
step "2/8 Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker "$USER"
    success "Docker installed"
else
    log "Docker already installed"
fi

# 3. Install Docker Compose
step "3/8 Installing Docker Compose"
if ! command -v "docker compose" >/dev/null 2>&1; then
    apt-get install -y docker-compose-plugin
    success "Docker Compose installed"
else
    log "Docker Compose already installed"
fi

# 4. Install required tools
step "4/8 Installing required tools"
apt-get install -y \
    git \
    jq \
    curl \
    wget \
    unzip \
    htop \
    net-tools \
    dnsutils \
    certbot \
    python3-certbot-dns-cloudflare \
    fail2ban \
    ufw \
    logrotate
success "Tools installed"

# 5. Configure firewall
step "5/8 Configuring firewall (UFW)"
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow from 127.0.0.1
success "Firewall configured"

# 6. Configure fail2ban
step "6/8 Configuring fail2ban"
cat > /etc/fail2ban/jail.local << 'JAIL_EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[docker-auth]
enabled = true
filter = docker-auth
logpath = /var/log/auth.log
maxretry = 5
JAIL_EOF

systemctl enable fail2ban
systemctl restart fail2ban
success "fail2ban configured"

# 7. Create project directory and deploy user
step "7/8 Setting up project directory"
mkdir -p /opt/doq/{backups,uploads,logs}
chown -R $USER:$USER /opt/doq
chmod 755 /opt/doq
success "Project directory created at /opt/doq"

# 8. Setup log rotation
step "8/8 Setting up log rotation"
cat > /etc/logrotate.d/doq << 'LOGROTATE_EOF'
/opt/doq/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        docker compose -f /opt/doq/docker-compose.yml -f /opt/doq/docker-compose.production.yml --env-file /opt/doq/.env.production restart app > /dev/null 2>&1 || true
    endscript
}

/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
LOGROTATE_EOF
success "Log rotation configured"

# ============================================================
# Summary
# ============================================================
echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🎉 VPS SETUP COMPLETE                                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${CYAN}📋 Next Steps:${NC}"
echo -e "  1. Clone repository to /opt/doq:"
echo -e "     ${YELLOW}cd /opt/doq && git clone https://github.com/your-org/doq.git .${NC}"
echo
echo -e "  2. Configure environment file:"
echo -e "     ${YELLOW}cp .env.production.example .env.production${NC}"
echo -e "     ${YELLOW}nano .env.production${NC}"
echo
echo -e "  3. Setup DNS records for your domain pointing to this VPS IP"
echo
echo -e "  4. Run initial deployment:"
echo -e "     ${YELLOW}./scripts/deploy-vps.sh production${NC}"
echo
echo -e "${CYAN}🔗 Useful Commands:${NC}"
echo -e "  • View logs:        docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file .env.production logs -f app"
echo -e "  • Restart app:      docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file .env.production restart app"
echo -e "  • View DB logs:     docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file .env.production logs -f db"
echo -e "  • Backup DB:        ./scripts/backup.sh"
echo -e "  • Rollback:         ./scripts/rollback.sh"

echo -e "\n${GREEN}✅ VPS is ready for DOQ deployments!${NC}"