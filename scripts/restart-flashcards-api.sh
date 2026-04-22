#!/usr/bin/env sh
# Recreate flashcards-api with env from api.env (same dir as the project on the host).
# Usage: restart-flashcards-api.sh [PROJECT_DIR]
# Example (on server):  sh /home/serv/flashcards-pwa/scripts/restart-flashcards-api.sh

set -eu

PROJECT_DIR="${1:-/home/serv/flashcards-pwa}"
ENV_FILE="${PROJECT_DIR}/api.env"
CONTAINER_NAME="flashcards-api"
NETWORK="web"
IMAGE="node:20-alpine"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing ${ENV_FILE}. Copy api.env.example to api.env and fill JWT_SECRET (+ optional SMTP_*)" >&2
  exit 1
fi

echo "Removing old container (if any)…"
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

echo "Starting ${CONTAINER_NAME} with --env-file ${ENV_FILE}…"
docker run -d --name "$CONTAINER_NAME" --restart unless-stopped \
  --network "$NETWORK" \
  --dns 8.8.8.8 --dns 8.8.4.4 \
  -v "${PROJECT_DIR}:/app" -w /app \
  --env-file "$ENV_FILE" \
  "$IMAGE" sh -c 'exec node server/index.js'

echo "OK. Logs: docker logs -f $CONTAINER_NAME"
docker logs --tail 15 "$CONTAINER_NAME" || true
