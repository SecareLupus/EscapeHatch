#!/bin/bash
set -e

echo "🧹 Resetting Skerry Test Environment..."
echo "======================================"

COMPOSE_FILE="docker-compose-test.yml"

# 1. Stop and remove volumes
echo "⏹️  Stopping containers and removing volumes..."
docker compose -f $COMPOSE_FILE down -v

# 2. Start fresh
echo "🚀 Starting test environment (with build)..."
docker compose -f $COMPOSE_FILE up -d --build

# 3. Wait for healthchecks
echo "⏳ Waiting for services to be healthy..."

MAX_RETRIES=60
RETRY_COUNT=0

wait_for_service() {
  local service_name=$1
  local url=$2
  echo "Checking $service_name health at $url..."
  
  until curl -s $url > /dev/null || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "[$RETRY_COUNT/$MAX_RETRIES] $service_name is not ready yet. Waiting..."
    sleep 2
  done

  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ Timeout waiting for $service_name"
    exit 1
  fi
  echo "✅ $service_name is healthy!"
  RETRY_COUNT=0
}

# Control plane health check (proxied via Caddy on 8080)
wait_for_service "control-plane" "http://localhost:8080/health"

echo "======================================"
echo "🎉 Test environment is ready!"
