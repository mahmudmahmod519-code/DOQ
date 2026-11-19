#!/usr/bin/env bash
# Basic resource / health monitor (doq-monitor.timer, every 5 minutes).
# Writes warnings to /var/log/doq/monitor.log and exits non-zero on problems
# (visible with: systemctl status doq-monitor.service / journalctl -u doq-monitor).
set -Euo pipefail
DOQ_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export DOQ_DIR
# shellcheck source=lib.sh
source "$DOQ_DIR/deployment/scripts/lib.sh"
ensure_log_dir
LOG="$LOG_DIR/monitor.log"
PROBLEMS=()

DISK=$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')
(( DISK < 85 )) || PROBLEMS+=("disk usage ${DISK}%")
MEM_AVAIL=$(( $(awk '/MemAvailable/ {print $2}' /proc/meminfo) / 1024 ))
(( MEM_AVAIL > 300 )) || PROBLEMS+=("only ${MEM_AVAIL} MB RAM available")
LOAD=$(awk '{print int($1)}' /proc/loadavg)
(( LOAD <= $(nproc) * 2 )) || PROBLEMS+=("load average ${LOAD}")
for svc in mysql app nginx; do
  s="$(container_health "$svc")"
  [[ "$s" == "healthy" ]] || PROBLEMS+=("$svc is $s")
done
[[ "$(container_health cron)" == "running" ]] || PROBLEMS+=("cron is $(container_health cron)")

if (( ${#PROBLEMS[@]} )); then
  echo "$(date -u +%FT%TZ) WARN ${PROBLEMS[*]}" >> "$LOG"
  echo "WARN: ${PROBLEMS[*]}"
  exit 1
fi
echo "$(date -u +%FT%TZ) ok disk=${DISK}% mem_avail=${MEM_AVAIL}MB load=${LOAD}" >> "$LOG"
