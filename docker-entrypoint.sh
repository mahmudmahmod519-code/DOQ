#!/bin/sh
set -eu

if [ "${WAIT_FOR_DB:-true}" = "true" ]; then
  echo "Waiting for MySQL..."
  i=0
  until MYSQL_PWD="${DB_PASSWORD:-}" mysql --protocol=tcp -h "${DB_HOST:-db}" -P "${DB_PORT:-3306}" -u "${DB_USER:-doq_user}" -D "${DB_NAME:-DOQ}" -N -e 'SELECT 1' >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -ge "${DB_WAIT_ATTEMPTS:-60}" ]; then
      echo "database_unavailable"
      exit 1
    fi
    sleep 2
  done
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  npm run migrate
fi

exec "$@"
