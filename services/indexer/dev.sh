#!/usr/bin/env bash
# Local development: starts Docker containers + indexer, tears down on exit.
# Replaces `envio dev` which hangs in headless environments (TUI has no off switch).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/generated/docker-compose.yaml"
INDEXER_PID=""

# Load .env
set -a; source "$SCRIPT_DIR/.env"; set +a

cleanup() {
  echo ""
  echo "Stopping indexer..."
  [ -n "$INDEXER_PID" ] && kill "$INDEXER_PID" 2>/dev/null && wait "$INDEXER_PID" 2>/dev/null
  echo "Stopping containers..."
  docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null
  echo "Done."
  exit 0
}
trap cleanup EXIT INT TERM

# Start containers
echo "Starting PostgreSQL (port ${ENVIO_PG_PORT:-5433}) + Hasura (port ${HASURA_EXTERNAL_PORT:-8080})..."
docker compose -f "$COMPOSE_FILE" up -d

# Wait for Hasura healthy
echo -n "Waiting for Hasura..."
for i in $(seq 1 30); do
  status=$(docker inspect generated-graphql-engine-1 --format '{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
  if [ "$status" = "healthy" ]; then
    echo " ready."
    break
  fi
  echo -n "."
  sleep 2
done

HASURA_PORT="${HASURA_EXTERNAL_PORT:-8080}"
echo ""
echo "GraphQL:  http://localhost:${HASURA_PORT}/v1/graphql"
echo "Console:  http://localhost:${HASURA_PORT}/console"
echo "Secret:   ${HASURA_GRAPHQL_ADMIN_SECRET:-testing}"
echo ""

# Start indexer in background, wait for it (trap fires on signal)
cd "$SCRIPT_DIR"
export TUI_OFF=true
npx envio start "$@" &
INDEXER_PID=$!
wait $INDEXER_PID || true
