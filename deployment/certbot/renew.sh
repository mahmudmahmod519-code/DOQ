#!/usr/bin/env bash
# Renews Let's Encrypt certificates (only those close to expiry) and reloads nginx.
# Run by doq-certbot-renew.timer twice a day.
set -Eeuo pipefail
DOQ_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export DOQ_DIR
# shellcheck source=../scripts/lib.sh
source "$DOQ_DIR/deployment/scripts/lib.sh"
require_root

cert_exists || { log "No certificate yet (run sudo ./deploy.sh); nothing to renew"; exit 0; }
dc --profile certbot run --rm certbot renew --webroot -w /var/www/certbot --quiet --no-random-sleep-on-renew
# nginx keeps the old certificate in memory until reloaded
if [[ "$(container_health nginx)" == "healthy" ]]; then
  dc exec -T nginx nginx -s reload
fi
EXPIRY="$(openssl x509 -enddate -noout -in "$DOQ_DIR/deployment/certbot/conf/live/$(env_get DOQ_DOMAIN)/fullchain.pem" | cut -d= -f2)"
ok "Certificate valid until $EXPIRY"
