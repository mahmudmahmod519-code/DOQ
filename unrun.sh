#!/usr/bin/env bash
# ============================================================
# DOQ - Stop All Containers & Remove Volumes (Nuclear Option)
# Use this to completely reset the local production environment
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILES="-f ${PROJECT_DIR}/docker-compose.yml -f ${PROJECT_DIR}/docker-compose.production.yml"
ENV_FILE="${PROJECT_DIR}/.env.production.local"

echo -e "${RED}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  DOQ - COMPLETE ENVIRONMENT DESTRUCTION                   ║${NC}"
echo -e "${RED}║  This will STOP containers and DELETE all data volumes    ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════════╝${NC}"
echo

read -p "Are you sure? This cannot be undone. Type 'yes' to confirm: " confirm
if [[ "$confirm" != "yes" ]]; then
    echo -e "${YELLOW}Aborted.${NC}"
    exit 1
fi

echo -e "\n${BLUE}[1/4]${NC} Stopping and removing containers..."
docker compose ${COMPOSE_FILES} --env-file ${ENV_FILE} down -v --remove-orphans 2>/dev/null || true

echo -e "${BLUE}[2/4]${NC} Removing named volumes..."
docker volume rm doq_project_mysql_data doq_project_doq_backups doq_project_doq_uploads doq_project_caddy_data doq_project_caddy_config 2>/dev/null || true

echo -e "${BLUE}[3/4]${NC} Removing any dangling containers..."
docker container prune -f 2>/dev/null || true

echo -e "${BLUE}[4/4]${NC} Removing any dangling networks..."
docker network prune -f 2>/dev/null || true

echo
echo -e "${GREEN}✅ Complete destruction finished.${NC}"
echo -e "${YELLOW}To start fresh: ./run.sh${NC}"