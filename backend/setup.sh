#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# GTCP Backend Setup Script (Linux / macOS / WSL2)
# npm install → docker compose up -d → wait DB → seed → open browser
#
# Использование:
#   chmod +x setup.sh && ./setup.sh
#   ./setup.sh --skip-seed        # пропустить seed
#   ./setup.sh --skip-build       # не пересобирать образы
#   ./setup.sh --no-browser       # не открывать браузер
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Цвета ──────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; DIM='\033[2m'; RESET='\033[0m'
BOLD='\033[1m'

step()  { echo -e "\n${CYAN}[$1/5] $2${RESET}"; }
ok()    { echo -e "      ${GREEN}✓${RESET}  $1"; }
warn()  { echo -e "  ${YELLOW}[WARN]${RESET}  $1"; }
fail()  { echo -e " ${RED}[ERROR]${RESET}  $1"; exit 1; }
box()   {
    local lines=("$@")
    local maxlen=0
    for l in "${lines[@]}"; do [[ ${#l} -gt $maxlen ]] && maxlen=${#l}; done
    local w=$((maxlen + 4))
    local border=$(printf '═%.0s' $(seq 1 $w))
    echo -e "${MAGENTA}  ╔${border}╗${RESET}"
    for l in "${lines[@]}"; do
        local pad=$(printf ' %.0s' $(seq 1 $((w - ${#l} - 2))))
        echo -e "${MAGENTA}  ║  ${RESET}${l}${pad}${MAGENTA}  ║${RESET}"
    done
    echo -e "${MAGENTA}  ╚${border}╝${RESET}"
}

# ── Аргументы ─────────────────────────────────────────────────────────────────
SKIP_SEED=false; SKIP_BUILD=false; OPEN_BROWSER=true
for arg in "$@"; do
    case $arg in
        --skip-seed)   SKIP_SEED=true ;;
        --skip-build)  SKIP_BUILD=true ;;
        --no-browser)  OPEN_BROWSER=false ;;
        *) warn "Неизвестный аргумент: $arg" ;;
    esac
done

# ── Рабочая директория ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
box \
    "GTCP — Gas Trading & Commercial Platform" \
    "Sprint 4 Backend Setup  (Bash)"

echo -e "\n${DIM}[DIR] ${SCRIPT_DIR}${RESET}"

# ═════════════════════════════════════════════════════════════════════════════
# ШАГ 0: Проверка зависимостей
# ═════════════════════════════════════════════════════════════════════════════
step "0" "Проверка зависимостей"

command -v node >/dev/null 2>&1 || fail "Node.js не найден. Установите Node.js 20 LTS: https://nodejs.org"
ok "Node.js $(node -v)"

command -v docker >/dev/null 2>&1 || fail "Docker не найден. Установите Docker Desktop: https://www.docker.com"
ok "Docker $(docker -v | head -1)"

docker compose version >/dev/null 2>&1 || fail "docker compose plugin не найден. Обновите Docker Desktop."
ok "docker compose $(docker compose version --short 2>/dev/null || echo 'OK')"

# ═════════════════════════════════════════════════════════════════════════════
# ШАГ 1: .env
# ═════════════════════════════════════════════════════════════════════════════
step "1" "Проверка .env"
if [[ ! -f ".env" ]]; then
    cp .env.example .env
    ok ".env создан из .env.example"
    warn "Откройте .env и установите JWT_ACCESS_SECRET / JWT_REFRESH_SECRET"
    sleep 2
else
    ok ".env уже существует — пропуск"
fi

# ═════════════════════════════════════════════════════════════════════════════
# ШАГ 2: npm install
# ═════════════════════════════════════════════════════════════════════════════
step "2" "npm install"
if [[ -d "node_modules" ]]; then
    echo -e "      ${DIM}node_modules существует → npm ci${RESET}"
    npm ci --omit=dev --silent
else
    npm install --omit=dev --silent
fi
ok "Зависимости установлены"

# ═════════════════════════════════════════════════════════════════════════════
# ШАГ 3: docker compose up
# ═════════════════════════════════════════════════════════════════════════════
step "3" "docker compose up -d"
BUILD_FLAG=""
[[ "$SKIP_BUILD" == "false" ]] && BUILD_FLAG="--build"
# shellcheck disable=SC2086
docker compose up -d $BUILD_FLAG
ok "Контейнеры запущены"

# ═════════════════════════════════════════════════════════════════════════════
# ШАГ 4: Ожидание PostgreSQL
# ═════════════════════════════════════════════════════════════════════════════
step "4" "Ожидание PostgreSQL (до 60 сек)"
TRIES=0; MAX_TRIES=30
until docker compose exec -T db pg_isready -U gtcp_user -d gtcp >/dev/null 2>&1; do
    TRIES=$((TRIES + 1))
    [[ $TRIES -ge $MAX_TRIES ]] && fail "PostgreSQL не стартовал за $((MAX_TRIES * 2)) сек. docker compose logs db"
    printf "${DIM}.${RESET}"
    sleep 2
done
echo ""
ok "PostgreSQL готов (попыток: ${TRIES})"

# ═════════════════════════════════════════════════════════════════════════════
# ШАГ 5: Seed
# ═════════════════════════════════════════════════════════════════════════════
step "5" "Загрузка демо-данных"
if [[ "$SKIP_SEED" == "false" ]]; then
    echo -e "      ${DIM}Генерация Argon2id хешей (~10 сек)...${RESET}"
    if docker compose exec -T api node src/db/seed.js; then
        ok "Seed выполнен успешно!"
    else
        warn "Seed завершился с ошибкой (данные уже могут быть загружены — это нормально)."
    fi
else
    warn "Пропущено (--skip-seed)"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Итог
# ═════════════════════════════════════════════════════════════════════════════
echo ""
box \
    "✅  GTCP Backend запущен!" \
    "" \
    "API:      http://localhost:3000/api/v1" \
    "Frontend: http://localhost:80" \
    "Health:   http://localhost:3000/health" \
    "" \
    "ДЕМО ЛОГИНЫ:" \
    "  admin        / Admin@2026!      (admin)" \
    "  dispatcher1  / Disp@2026!       (dispatcher)" \
    "  credit1      / Credit@2026!     (credit)" \
    "  billing1     / Billing@2026!    (billing)" \
    "  contracts1   / Contracts@2026!  (contracts)" \
    "" \
    "Откройте Soft/GTCP_MVP.html — данные придут из API."
echo ""

# ── Открыть браузер ───────────────────────────────────────────────────────────
if [[ "$OPEN_BROWSER" == "true" ]]; then
    HTML_PATH="${SCRIPT_DIR}/../Soft/GTCP_MVP.html"
    if [[ -f "$HTML_PATH" ]]; then
        echo -e "${CYAN}Открываю GTCP_MVP.html...${RESET}"
        # Определяем команду для открытия браузера
        if command -v xdg-open >/dev/null 2>&1; then
            xdg-open "$HTML_PATH" 2>/dev/null &
        elif command -v open >/dev/null 2>&1; then
            open "$HTML_PATH"
        elif command -v wslview >/dev/null 2>&1; then
            # WSL2
            wslview "$(wslpath -w "$HTML_PATH")"
        else
            echo -e "      ${DIM}Откройте вручную: file://${HTML_PATH}${RESET}"
        fi
    else
        warn "GTCP_MVP.html не найден: ${HTML_PATH}"
    fi
fi

echo ""
