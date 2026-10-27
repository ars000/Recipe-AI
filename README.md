# Recipe AI

Pet-проект: рецепты, холодильник, подбор по продуктам, AI-шеф и распознавание фото (OpenRouter). Monorepo: Angular 18 (`apps/web`), NestJS + Prisma (`apps/api`), общая логика (`libs/shared`).

Репозиторий: [github.com/ars000/Recipe-AI](https://github.com/ars000/Recipe-AI)

## Локальный запуск

1. Node.js 20+, Docker (PostgreSQL).
2. `npm ci`
3. Скопировать `apps/api/.env.example` → `apps/api/.env`, указать `OPENROUTER_API_KEY` ([OpenRouter](https://openrouter.ai/)).
4. `npm run db:up`
5. `npm run prisma:migrate`
6. `npm run seed` (опционально)
7. В двух терминалах: `npm run api` и `npm run web` → [http://localhost:4200](http://localhost:4200)

API: `http://localhost:3000/api`, статика загрузок: `http://localhost:3000/uploads/`.

## Секреты и GitHub

- В репозиторий **не** попадают `apps/api/.env` и ключи — только `.env.example`.
- Ключ OpenRouter/Groq живёт **только на сервере** (или локально у разработчика).
- Без ключа работают рецепты, match по продуктам, списки; AI-шеф и vision по фото требуют ключ на API.

## Деплой на VPS (вариант A: полное приложение)

Схема: **GitHub — код**, **VPS — runtime** (nginx + Node API + Postgres в Docker).

### 1. Сервер

- Ubuntu 22.04/24.04, порты 80/443 открыты.
- Установить: `git`, `nodejs` 20, `npm`, `nginx`, `docker`, `docker compose`, `certbot`.

```bash
sudo mkdir -p /var/www/recipe-ai
sudo git clone https://github.com/ars000/Recipe-AI.git /var/www/recipe-ai/app
cd /var/www/recipe-ai/app
```

### 2. Окружение API

```bash
cp apps/api/.env.example apps/api/.env
chmod 600 apps/api/.env
nano apps/api/.env
```

Пример для production:

```env
DATABASE_URL=postgresql://recipe:recipe@127.0.0.1:5432/recipe_manager?schema=public
PORT=3000
CORS_ORIGIN=https://YOUR_DOMAIN
OPENROUTER_API_KEY=sk-or-v1-...
AI_PROVIDER=openrouter
PUBLIC_UPLOAD_BASE=https://YOUR_DOMAIN/uploads
UPLOAD_DIR=./uploads
AI_RATE_LIMIT_PER_HOUR=20
```

Postgres: из корня репо `docker compose up -d` (порт 5432 только localhost).

### 3. Сборка и миграции

```bash
npm ci
npm run build
npm run prisma:migrate -w @recipe-manager/api
RUN_SEED=1 ./deploy/vps-deploy.sh   # seed один раз при первом деплое
```

Или вручную скопировать фронт: `apps/web/dist/web/browser/` → `/var/www/recipe-ai/web`.

### 4. systemd для API

Скопировать и отредактировать `deploy/recipe-api.service.example` → `/etc/systemd/system/recipe-api.service`, затем:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now recipe-api
```

### 5. nginx + HTTPS

Пример: `deploy/nginx-recipe-ai.conf.example` → `/etc/nginx/sites-available/recipe-ai`, заменить `YOUR_DOMAIN`, включить сайт, `certbot --nginx`.

Фронт: `root` на `/var/www/recipe-ai/web`. Прокси: `/api/` и `/uploads/` на `127.0.0.1:3000`.

### 6. Обновления

```bash
cd /var/www/recipe-ai/app
git pull
./deploy/vps-deploy.sh
sudo systemctl restart recipe-api
```

## Скрипты (корень)

| Команда | Назначение |
|---------|------------|
| `npm run web` | Angular dev |
| `npm run api` | Nest dev |
| `npm run build` | production build всего monorepo |
| `npm run db:up` / `db:down` | PostgreSQL в Docker |
| `npm run test:shared` | тесты shared |
