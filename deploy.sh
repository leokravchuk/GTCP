#!/usr/bin/env bash
# =============================================================
#  GTCP — Gas Trading & Commercial Platform
#  Deploy to VPS (Ubuntu 22.04 + Docker)
#
#  Usage : bash deploy.sh [--skip-build] [--migrate]
#
#  Requires: ssh, scp, tar, docker (remote)
#  SSH auth: key-based. Set up with:
#            ssh-keygen -t ed25519 -f ~/.ssh/id_gtcp
#            ssh-copy-id -i ~/.ssh/id_gtcp VPS_USER@VPS_HOST
# =============================================================
set -euo pipefail

# ─── CONFIG — заполни перед первым деплоем ────────────────────
VPS_HOST="TODO_YOUR_VPS_IP"          # Hetzner / DigitalOcean IP
VPS_USER="root"                      # SSH user (обычно root или ubuntu)
VPS_KEY="$HOME/.ssh/id_gtcp"         # SSH ключ
VPS_PORT=22                          # SSH порт
VPS_PATH="/opt/gtcp"                 # Путь на сервере
API_PORT=3000                        # Порт API (и nginx слушает 80 → 3000)

CONTAINER_API="gtcp_api"
CONTAINER_DB="gtcp_db"
CONTAINER_NGINX="gtcp_nginx"
IMAGE="gtcp-api"
ARCHIVE="gtcp-backend.tar.gz"

# ─── Флаги ───────────────────────────────────────────────────
SKIP_BUILD=false
RUN_MIGRATE=false
for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=true ;;
    --migrate)    RUN_MIGRATE=true ;;
  esac
done

SSH="ssh -i ${VPS_KEY} -p ${VPS_PORT} -o StrictHostKeyChecking=no"
SCP="scp -i ${VPS_KEY} -P ${VPS_PORT} -O -o StrictHostKeyChecking=no"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${PROJECT_DIR}/backend"

cd "$PROJECT_DIR"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   GTCP Backend — Deploy to VPS                  ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  Host : ${VPS_USER}@${VPS_HOST}:${VPS_PORT}"
echo "║  Path : ${VPS_PATH}"
echo "║  Port : ${API_PORT}"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ─── Проверка конфига ────────────────────────────────────────
if [[ "$VPS_HOST" == "TODO_YOUR_VPS_IP" ]]; then
  echo "❌  Заполни VPS_HOST в deploy.sh перед запуском!"
  exit 1
fi

if [[ ! -f "$VPS_KEY" ]]; then
  echo "❌  SSH ключ не найден: $VPS_KEY"
  echo "    Создай: ssh-keygen -t ed25519 -f $VPS_KEY"
  exit 1
fi

if [[ ! -f "${BACKEND_DIR}/.env.production" ]]; then
  echo "⚠️   Файл backend/.env.production не найден."
  echo "    Скопируй backend/.env.example → backend/.env.production и заполни!"
  echo ""
  read -rp "    Продолжить без .env.production? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || exit 1
fi

# ─── 1. Синтаксис / lint ─────────────────────────────────────
echo "[1/7] Checking syntax..."
cd "$BACKEND_DIR"
find src -name "*.js" | xargs node --check
find tests -name "*.js" | xargs node --check 2>/dev/null || true
echo "      ✅ All files OK"
cd "$PROJECT_DIR"

# ─── 2. Архив исходников ─────────────────────────────────────
echo "[2/7] Packaging backend source..."
rm -rf deploy_package && mkdir deploy_package

# Копируем всё кроме node_modules, .env (секреты), coverage, logs
rsync -a \
  --exclude='node_modules/' \
  --exclude='.env' \
  --exclude='coverage/' \
  --exclude='*.log' \
  --exclude='.git/' \
  "${BACKEND_DIR}/" deploy_package/

# .env.production → .env на сервере
if [[ -f "${BACKEND_DIR}/.env.production" ]]; then
  cp "${BACKEND_DIR}/.env.production" deploy_package/.env
  echo "      ✅ .env.production → .env"
fi

# Фронтенд (один HTML)
mkdir -p deploy_package/static
if [[ -f "${PROJECT_DIR}/Soft/GTCP_MVP.html" ]]; then
  cp "${PROJECT_DIR}/Soft/GTCP_MVP.html" deploy_package/static/index.html
  echo "      ✅ GTCP_MVP.html → static/index.html"
fi

tar -czf "$ARCHIVE" -C deploy_package .
ARCHIVE_SIZE=$(du -sh "$ARCHIVE" | cut -f1)
echo "      Archive: ${ARCHIVE} (${ARCHIVE_SIZE})"

# ─── 3. Загрузка на сервер ───────────────────────────────────
echo "[3/7] Uploading to VPS..."
${SCP} "$ARCHIVE" "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"
echo "      ✅ Uploaded"

# ─── 4. Деплой по SSH ────────────────────────────────────────
echo "[4/7] Deploying on VPS..."

RELEASE_TS=$(date +%Y%m%d_%H%M%S)

${SSH} "${VPS_USER}@${VPS_HOST}" bash << REMOTE
set -e

RELEASE_DIR="${VPS_PATH}/releases/${RELEASE_TS}"

echo "  → Unpacking release ${RELEASE_TS}..."
mkdir -p "\$RELEASE_DIR"
tar -xzf ${VPS_PATH}/${ARCHIVE} -C "\$RELEASE_DIR"

# Симлинк текущего релиза
ln -sfn "\$RELEASE_DIR" ${VPS_PATH}/app
echo "  → Symlink: ${VPS_PATH}/app → \$RELEASE_DIR"

# ─── 5. Остановить старые контейнеры ─────────────────────────
echo "  → Stopping old containers..."
cd ${VPS_PATH}/app
docker compose down --timeout 30 2>/dev/null || true

# ─── 6. Поднять новые ────────────────────────────────────────
echo "  → Building & starting containers..."
docker compose up --build -d

# Удалить старые релизы (оставить последние 3)
ls -dt ${VPS_PATH}/releases/*/ 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
echo "  → Kept last 3 releases"

# ─── 7. Ждём healthy ─────────────────────────────────────────
echo "  → Waiting for API health check..."
for i in \$(seq 1 30); do
  STATUS=\$(docker inspect --format='{{.State.Health.Status}}' ${CONTAINER_API} 2>/dev/null || echo "starting")
  if [[ "\$STATUS" == "healthy" ]]; then
    echo "  ✅ API is healthy (attempt \$i)"
    break
  fi
  echo "     [\$i/30] Status: \$STATUS — waiting..."
  sleep 3
done

# ─── Health check ─────────────────────────────────────────────
echo ""
HTTP=\$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${API_PORT}/api/v1/health || echo "000")
if [[ "\$HTTP" == "200" ]]; then
  echo "  ✅ GET /api/v1/health → HTTP \$HTTP"
else
  echo "  ⚠️  GET /api/v1/health → HTTP \$HTTP"
fi

echo ""
docker compose ps

REMOTE

# ─── Миграции (опционально) ──────────────────────────────────
if [[ "$RUN_MIGRATE" == "true" ]]; then
  echo "[5/7] Running migrations..."
  ${SSH} "${VPS_USER}@${VPS_HOST}" bash << REMOTE
set -e
cd ${VPS_PATH}/app
docker compose exec api node src/db/migrate.js
echo "  ✅ Migrations done"
REMOTE
fi

# ─── Локальная очистка ───────────────────────────────────────
echo "[6/7] Cleaning up locally..."
rm -rf deploy_package "$ARCHIVE"

# ─── Итог ────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   ✅ Deploy complete!                            ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  API   : http://${VPS_HOST}/api/v1              ║"
echo "║  Docs  : http://${VPS_HOST}/docs                ║"
echo "║  UI    : http://${VPS_HOST}/                    ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
