#!/bin/bash
# ==============================================================================
# Health Monitoring Script
# ==============================================================================
# Monitors all services and sends alerts if unhealthy
# Run every minute via cron: * * * * * /path/to/health-monitor.sh
# ==============================================================================

set -euo pipefail

# Configuration
API_URL="${API_URL:-https://api.tradingroom.io}"
SIGNALING_URL="${SIGNALING_URL:-https://signaling.tradingroom.io}"
ALERT_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
LOG_FILE="/var/log/trading-room/health-monitor.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

alert() {
    local service=$1
    local status=$2
    local message=$3

    log "${RED}ALERT${NC}: $service is $status - $message"

    # Send to Slack if webhook configured
    if [ -n "$ALERT_WEBHOOK" ]; then
        curl -X POST "$ALERT_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"⚠️ *$service* is *$status*\n$message\"}" \
            --silent --output /dev/null
    fi
}

check_service() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}

    log "Checking $name..."

    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" || echo "000")

    if [ "$response" = "$expected_status" ]; then
        log "${GREEN}✓${NC} $name is healthy (HTTP $response)"
        return 0
    else
        alert "$name" "UNHEALTHY" "Expected HTTP $expected_status, got $response"
        return 1
    fi
}

# Check API backend
check_service "API Backend" "$API_URL/health"

# Check signaling server
check_service "Signaling Server" "$SIGNALING_URL/health"

# Check database connectivity
log "Checking database..."
if docker exec tradingroom-backend php artisan tinker --execute="DB::select('SELECT 1');" >/dev/null 2>&1; then
    log "${GREEN}✓${NC} Database is healthy"
else
    alert "Database" "UNHEALTHY" "Cannot execute query"
fi

# Check Redis
log "Checking Redis..."
if docker exec tradingroom-redis redis-cli ping | grep -q "PONG"; then
    log "${GREEN}✓${NC} Redis is healthy"
else
    alert "Redis" "UNHEALTHY" "Cannot ping Redis"
fi

# Check disk space
log "Checking disk space..."
disk_usage=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$disk_usage" -gt 90 ]; then
    alert "Disk Space" "WARNING" "Disk usage is at ${disk_usage}%"
elif [ "$disk_usage" -gt 80 ]; then
    log "${YELLOW}⚠${NC} Disk usage is at ${disk_usage}%"
else
    log "${GREEN}✓${NC} Disk space is healthy (${disk_usage}% used)"
fi

# Check memory usage
log "Checking memory..."
mem_usage=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
if [ "$mem_usage" -gt 90 ]; then
    alert "Memory" "WARNING" "Memory usage is at ${mem_usage}%"
else
    log "${GREEN}✓${NC} Memory is healthy (${mem_usage}% used)"
fi

log "Health check complete"
