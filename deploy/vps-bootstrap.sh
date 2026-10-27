#!/usr/bin/env bash
# Первичная установка на Ubuntu VPS. Не трогает чужие docker-контейнеры (wg-easy, amnezia и т.д.).
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/recipe-ai/app}"
WEB_ROOT="${WEB_ROOT:-/var/www/recipe-ai/web}"
REPO="${REPO:-https://github.com/ars000/Recipe-AI.git}"
# Публичный URL без домена (IP или http://...)
PUBLIC_BASE="${PUBLIC_BASE:-http://141.98.166.150}"

echo "==> существующие контейнеры (не останавливаем)"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}' || true

if ! command -v git >/dev/null; then
  apt-get update -qq
  apt-get install -y git curl ca-certificates rsync nginx
fi

if ! command -v node >/dev/null || [[ "$(node -p "process.versions.node.split('.')[0]")" -lt 20 ]]; then
  echo "==> Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

command -v nginx >/dev/null || apt-get install -y nginx
command -v rsync >/dev/null || apt-get install -y rsync

mkdir -p "$(dirname "$APP_ROOT")" "$WEB_ROOT"
if [[ ! -d "$APP_ROOT/.git" ]]; then
  git clone "$REPO" "$APP_ROOT"
else
  git -C "$APP_ROOT" pull --ff-only
fi

cd "$APP_ROOT"

echo "==> PostgreSQL (отдельный compose-проект recipe-ai, порт только 127.0.0.1:5432)"
docker compose up -d postgres

ENV_FILE="$APP_ROOT/apps/api/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "$APP_ROOT/apps/api/.env.example" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://recipe:recipe@127.0.0.1:5432/recipe_manager?schema=public|" "$ENV_FILE"
  sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=${PUBLIC_BASE}|" "$ENV_FILE"
  sed -i "s|^PUBLIC_UPLOAD_BASE=.*|PUBLIC_UPLOAD_BASE=${PUBLIC_BASE}/uploads|" "$ENV_FILE"
fi

if [[ -n "${RECIPE_OPENROUTER_API_KEY:-}" ]]; then
  if grep -q '^OPENROUTER_API_KEY=' "$ENV_FILE"; then
    sed -i "s|^OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=${RECIPE_OPENROUTER_API_KEY}|" "$ENV_FILE"
  else
    echo "OPENROUTER_API_KEY=${RECIPE_OPENROUTER_API_KEY}" >> "$ENV_FILE"
  fi
fi

if ! grep -q '^OPENROUTER_API_KEY=sk-' "$ENV_FILE" 2>/dev/null; then
  echo ""
  echo "!!! Добавьте OPENROUTER_API_KEY в $ENV_FILE (nano), затем снова: RUN_SEED=1 bash deploy/vps-bootstrap.sh"
  echo ""
fi

echo "==> npm install & build"
npm ci
npm run build

echo "==> prisma migrate deploy"
cd "$APP_ROOT/apps/api"
npx prisma migrate deploy
cd "$APP_ROOT"

if [[ "${RUN_SEED:-0}" == "1" ]]; then
  npm run seed
fi

rsync -a --delete "$APP_ROOT/apps/web/dist/web/browser/" "$WEB_ROOT/"

echo "==> systemd recipe-api"
install -m 644 "$APP_ROOT/deploy/recipe-api.service.example" /etc/systemd/system/recipe-api.service
sed -i "s|/var/www/recipe-ai/app|${APP_ROOT}|g" /etc/systemd/system/recipe-api.service
systemctl daemon-reload
chown www-data:www-data "$ENV_FILE"
chmod 640 "$ENV_FILE"
mkdir -p "$APP_ROOT/apps/api/uploads"
chown -R www-data:www-data "$APP_ROOT/apps/api/uploads"

systemctl enable recipe-api
systemctl restart recipe-api

NGINX_SITE="/etc/nginx/sites-available/recipe-ai"
install -m 644 "$APP_ROOT/deploy/nginx-recipe-ai-ip.conf.example" "$NGINX_SITE"
sed -i "s|YOUR_PUBLIC_BASE|${PUBLIC_BASE}|g" "$NGINX_SITE"
sed -i "s|/var/www/recipe-ai/web|${WEB_ROOT}|g" "$NGINX_SITE"
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/recipe-ai
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t
systemctl reload nginx

echo ""
echo "Готово: ${PUBLIC_BASE}"
echo "Проверка API: curl -sS ${PUBLIC_BASE}/api/health"
systemctl --no-pager status recipe-api | head -15
