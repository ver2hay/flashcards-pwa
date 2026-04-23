#!/usr/bin/env sh
# Сборка PWA + выкладка на сервер без перезаписи БД и загрузок.
# Использование:
#   ./scripts/deploy-rsync.sh
# Переменные (опционально):
#   SSH_HOST  (по умолчанию serv@kzt24.duckdns.org)
#   SSH_PORT  (по умолчанию 2222)
#   REMOTE_DIR (по умолчанию /home/serv/flashcards-pwa)

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SSH_HOST="${SSH_HOST:-serv@kzt24.duckdns.org}"
SSH_PORT="${SSH_PORT:-2222}"
REMOTE_DIR="${REMOTE_DIR:-/home/serv/flashcards-pwa}"

echo "== npm run build =="
npm ci
npm run build

echo "== rsync -> ${SSH_HOST}:${REMOTE_DIR} =="
# Не трогать: база SQLite-json, env с секретами, загруженные файлы, deps на сервере
rsync -avz -e "ssh -p ${SSH_PORT}" \
  --exclude node_modules \
  --exclude .git \
  --exclude 'server/db.json' \
  --exclude 'server/uploads' \
  --exclude api.env \
  --exclude 'smtp.env' \
  --exclude 'api.env*' \
  "${ROOT}/" "${SSH_HOST}:${REMOTE_DIR}/"

echo "== restart containers (у сервера) =="
ssh -p "${SSH_PORT}" "${SSH_HOST}" <<'ENDSSH'
  set -e
  docker restart flashcards-nginx
  docker restart flashcards-api
  echo OK
ENDSSH

echo "Готово."
