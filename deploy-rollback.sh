#!/usr/bin/env bash
# =============================================================
#  GTCP — Rollback to previous release
#
#  Usage : bash deploy-rollback.sh
#
#  Хранит последние 3 релиза в /opt/gtcp/releases/
#  Текущий релиз — симлинк /opt/gtcp/app → releases/TIMESTAMP
# =============================================================
set -euo pipefail

# ─── CONFIG (должен совпадать с deploy.sh) ────────────────────
VPS_HOST="TODO_YOUR_VPS_IP"
VPS_USER="root"
VPS_KEY="$HOME/.ssh/id_gtcp"
VPS_PORT=22
VPS_PATH="/opt/gtcp"
API_PORT=3000

SSH="ssh -i ${VPS_KEY} -p ${VPS_PORT} -o StrictHostKeyChecking=no"

if [[ "$VPS_HOST" == "TODO_YOUR_VPS_IP" ]]; then
  echo "❌  Заполни VPS_HOST в deploy-rollback.sh перед запуском!"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   GTCP — Rollback                               ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

${SSH} "${VPS_USER}@${VPS_HOST}" bash << 'REMOTE'
set -e
VPS_PATH="/opt/gtcp"
API_PORT=3000

echo "Доступные релизы:"
ls -lt ${VPS_PATH}/releases/ 2>/dev/null | grep "^d" | head -5 || {
  echo "Нет сохранённых релизов. Rollback недоступен."
  exit 1
}

echo ""
CURRENT=$(readlink ${VPS_PATH}/app 2>/dev/null || echo "нет")
echo "Текущий: $CURRENT"

# Берём предыдущий релиз
RELEASES=($(ls -dt ${VPS_PATH}/releases/*/))
if [[ ${#RELEASES[@]} -lt 2 ]]; then
  echo "❌ Недостаточно релизов для rollback (нужно минимум 2)."
  exit 1
fi

PREV="${RELEASES[1]}"
echo "Откат на: $PREV"
echo ""
read -rp "Подтверди откат [y/N]: " ans
[[ "$ans" =~ ^[Yy]$ ]] || { echo "Отменено."; exit 0; }

echo "  → Переключаю симлинк..."
ln -sfn "$PREV" ${VPS_PATH}/app

echo "  → Перезапускаю контейнеры..."
cd ${VPS_PATH}/app
docker compose down --timeout 30 2>/dev/null || true
docker compose up -d

sleep 3
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${API_PORT}/api/v1/health || echo "000")
echo ""
if [[ "$HTTP" == "200" ]]; then
  echo "  ✅ Rollback успешен. GET /health → HTTP $HTTP"
else
  echo "  ⚠️  GET /health → HTTP $HTTP"
fi
REMOTE

echo ""
echo "Rollback завершён."
echo ""
