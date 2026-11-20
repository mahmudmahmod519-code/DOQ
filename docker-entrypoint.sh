#!/bin/sh
set -eu

DB_HOST="${DB_HOST:-${MYSQLHOST:-db}}"
DB_PORT="${DB_PORT:-${MYSQLPORT:-3306}}"
DB_USER="${DB_USER:-${MYSQLUSER:-doq_user}}"
DB_PASSWORD="${DB_PASSWORD:-${MYSQLPASSWORD:-${MYSQL_ROOT_PASSWORD:-}}}"
DB_NAME="${DB_NAME:-${MYSQLDATABASE:-DOQ}}"

if [ "${WAIT_FOR_DB:-true}" = "true" ]; then
  echo "Waiting for MySQL at ${DB_HOST}:${DB_PORT}..."
  i=0
  until MYSQL_PWD="${DB_PASSWORD}" mysql --protocol=tcp -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -D "${DB_NAME}" -N -e 'SELECT 1' >/dev/null 2>&1; do
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
