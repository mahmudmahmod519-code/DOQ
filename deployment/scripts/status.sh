#!/usr/bin/env bash
# Human-readable status of the DOQ production stack.  sudo ./deployment/scripts/status.sh
set -Eeuo pipefail
DOQ_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export DOQ_DIR
# shellcheck source=lib.sh
source "$DOQ_DIR/deployment/scripts/lib.sh"
require_root

step "Containers"
dc ps --format 'table {{.Service}}\t{{.Status}}\t{{.Image}}'
step "Resources"
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' $(dc ps -q) 2>/dev/null || true
free -h | sed -n '1,2p'
df -h / "$(env_get BACKUP_DIR || true)" 2>/dev/null | awk 'NR==1 || !seen[$0]++'
step "Health"
DOMAIN="$(env_get DOQ_DOMAIN)"; MODE="$(nginx_mode)"
for path in /health /health/ready /api/v1/health /m/api/v1/home; do
  echo "  ${MODE}://${DOMAIN}${path} -> $(check_site "$DOMAIN" "$MODE" "$path")"
done
if cert_exists; then
  echo "  certificate expires: $(openssl x509 -enddate -noout -in "$DOQ_DIR/deployment/certbot/conf/live/${DOMAIN}/fullchain.pem" | cut -d= -f2)"
fi
step "Timers"
systemctl list-timers --all 'doq-*' --no-pager || true
step "Images (rollback candidates)"
docker images doq-app --format 'table {{.Tag}}\t{{.CreatedSince}}\t{{.Size}}'
