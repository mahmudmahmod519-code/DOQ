#!/usr/bin/env bash
# ============================================================
# DOQ - Automated Backup Script
# Creates a 'backup' folder on Desktop with DB (.sql) & Uploads (.tar.gz)
# ============================================================

set -euo pipefail

# الألوان للتنسيق
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_BACKUP_DIR="${HOME}/Desktop/backup"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# اختيار ملف البيئة المناسب
if [[ -f "${PROJECT_DIR}/.env.production.local" ]]; then
    ENV_FILE="${PROJECT_DIR}/.env.production.local"
elif [[ -f "${PROJECT_DIR}/.env.production" ]]; then
    ENV_FILE="${PROJECT_DIR}/.env.production"
else
    ENV_FILE="${PROJECT_DIR}/.env"
fi

COMPOSE_FILES="-f ${PROJECT_DIR}/docker-compose.yml -f ${PROJECT_DIR}/docker-compose.production.yml"
COMPOSE_CMD="docker compose ${COMPOSE_FILES} --env-file ${ENV_FILE}"

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}       DOQ - Starting Automated Backup Process      ${NC}"
echo -e "${BLUE}====================================================${NC}"

# 1. إنشاء مجلد backup على Desktop إذا لم يكن موجوداً
mkdir -p "${DESKTOP_BACKUP_DIR}"

# 2. قراءة بيانات قاعدة البيانات من ملف .env
DB_NAME=$(grep -E '^DB_NAME=' "${ENV_FILE}" | cut -d '=' -f2 | tr -d '\r' || echo "DOQ")
MYSQL_ROOT_PASSWORD=$(grep -E '^MYSQL_ROOT_PASSWORD=' "${ENV_FILE}" | cut -d '=' -f2 | tr -d '\r')

if [[ -z "${MYSQL_ROOT_PASSWORD}" ]]; then
    echo -e "${RED}❌ Error: MYSQL_ROOT_PASSWORD not found in ${ENV_FILE}${NC}"
    exit 1
fi

# 3. أخذ نسخة من قاعدة البيانات (.sql)
SQL_FILENAME="db_backup_${DB_NAME}_${TIMESTAMP}.sql"
SQL_PATH="${DESKTOP_BACKUP_DIR}/${SQL_FILENAME}"

echo -e "\n${BLUE}[1/2]${NC} Exporting MySQL database to ${SQL_PATH}..."
$COMPOSE_CMD exec -T db mysqldump \
  -u root \
  -p"${MYSQL_ROOT_PASSWORD}" \
  --single-transaction \
  --quick \
  --lock-tables=false \
  "${DB_NAME}" > "${SQL_PATH}"

echo -e "${GREEN}✅ Database backup created!${NC}"

# 4. أخذ نسخة مضغوطة من مجلد Uploads
UPLOADS_FILENAME="uploads_backup_${TIMESTAMP}.tar.gz"
UPLOADS_PATH="${DESKTOP_BACKUP_DIR}/${UPLOADS_FILENAME}"

echo -e "\n${BLUE}[2/2]${NC} Archiving Uploads folder to ${UPLOADS_PATH}..."
$COMPOSE_CMD exec -T app tar -czf - -C /app/public/upload . > "${UPLOADS_PATH}"

echo -e "${GREEN}✅ Uploads backup created!${NC}"

# 5. ملخص النتيجة
echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN} 🎉 BACKUP COMPLETED SUCCESSFULLY!                   ${NC}"
echo -e "${GREEN} 📂 Desktop Folder: ${DESKTOP_BACKUP_DIR}          ${NC}"
echo -e "${GREEN} 📄 SQL File:       ${SQL_FILENAME}                 ${NC}"
echo -e "${GREEN} 📁 Uploads Zip:    ${UPLOADS_FILENAME}             ${NC}"
echo -e "${GREEN}====================================================${NC}"