#!/usr/bin/env bash
# DOQ database health report (read-only).  sudo ./deployment/backup/database-health.sh
set -Eeuo pipefail
DOQ_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export DOQ_DIR
# shellcheck source=../scripts/lib.sh
source "$DOQ_DIR/deployment/scripts/lib.sh"
require_root

STATUS=0
health="$(container_health mysql)"
[[ "$health" == "healthy" ]] && ok "mysql container: $health" || { warn "mysql container: $health"; exit 1; }

q() { dc exec -T mysql sh -c "MYSQL_PWD=\"\$MYSQL_ROOT_PASSWORD\" mysql -uroot -N -B -e \"$1\""; }

ok "Version: $(q 'SELECT VERSION()')"
ok "Uptime: $(( $(q "SHOW GLOBAL STATUS LIKE 'Uptime'" | awk '{print $2}') / 3600 )) h"
ok "Connections: $(q "SHOW GLOBAL STATUS LIKE 'Threads_connected'" | awk '{print $2}') / $(q 'SELECT @@max_connections')"
DB="$(env_get DB_NAME)"; DB="${DB:-DOQ}"
ok "Database '$DB': $(q "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB'") tables, $(q "SELECT ROUND(SUM(data_length+index_length)/1024/1024,1) FROM information_schema.tables WHERE table_schema='$DB'") MB"
ok "Charset: $(q "SELECT CONCAT(default_character_set_name,' / ',default_collation_name) FROM information_schema.schemata WHERE schema_name='$DB'")"

for t in users kitchens dishes categories reviews orders notifications; do
  n="$(q "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB' AND table_name='$t'")"
  if [[ "$n" == "1" ]]; then ok "table $t: $(q "SELECT COUNT(*) FROM \\\`$DB\\\`.\\\`$t\\\`") rows"; else warn "table $t is missing"; STATUS=1; fi
done

BACKUP_DIR="$(env_get BACKUP_DIR)"; BACKUP_DIR="${BACKUP_DIR:-/var/backups/doq}"
LATEST="$(find "$BACKUP_DIR" -maxdepth 1 -name 'doq-*.sql.gz' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -n1 | awk '{print $2}')"
if [[ -n "$LATEST" ]]; then
  AGE_H=$(( ( $(date +%s) - $(stat -c %Y "$LATEST") ) / 3600 ))
  (( AGE_H <= 26 )) && ok "Latest backup: $(basename "$LATEST") (${AGE_H} h ago)" || { warn "Latest backup is ${AGE_H} h old: $(basename "$LATEST")"; STATUS=1; }
else
  warn "No backup found in $BACKUP_DIR"; STATUS=1
fi
exit "$STATUS"
