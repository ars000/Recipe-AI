#!/usr/bin/env bash
# Запуск на VPS из корня клонированного репозитория (после настройки .env).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> install dependencies"
npm ci

echo "==> build shared, api, web"
npm run build

echo "==> prisma migrate (apps/api)"
npm run prisma:migrate -w @recipe-manager/api

echo "==> optional seed"
if [[ "${RUN_SEED:-0}" == "1" ]]; then
  npm run seed
fi

WEB_OUT="${WEB_OUT:-/var/www/recipe-ai/web}"
mkdir -p "$WEB_OUT"
rsync -a --delete apps/web/dist/web/browser/ "$WEB_OUT/"

echo "==> done. Restart API: sudo systemctl restart recipe-api"
