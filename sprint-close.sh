#!/usr/bin/env bash
# =============================================================
#  GTCP — Gas Trading & Commercial Platform
#  Sprint Close & Push Script
#
#  Usage:
#    bash sprint-close.sh                    # auto-detect sprint from actionplan.md
#    bash sprint-close.sh --sprint 6         # явно указать номер спринта
#    bash sprint-close.sh --sprint 6 --tag   # создать git tag sprint-6
#    bash sprint-close.sh --sprint 6 --dry   # dry-run (ничего не пушит)
#
#  Что делает:
#    [1/5] Проверяет наличие незакоммиченных файлов, предлагает добавить
#    [2/5] Создаёт коммит "chore: close Sprint N" с датой
#    [3/5] Тегирует sprint-N (если --tag)
#    [4/5] git push origin main
#    [5/5] git push origin --tags (если --tag)
# =============================================================
set -euo pipefail

# ─── ЦВЕТА ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${CYAN}[sprint-close]${NC} $*"; }
ok()   { echo -e "${GREEN}✔${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
die()  { echo -e "${RED}✖${NC}  $*"; exit 1; }

# ─── PARSE ARGS ───────────────────────────────────────────────
SPRINT_NUM=""
DO_TAG=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sprint) SPRINT_NUM="$2"; shift 2 ;;
    --tag)    DO_TAG=true; shift ;;
    --dry)    DRY_RUN=true; shift ;;
    -h|--help)
      sed -n '2,15p' "$0" | sed 's/^#  \?//'
      exit 0
      ;;
    *) die "Неизвестный аргумент: $1" ;;
  esac
done

# ─── АВТО-ОПРЕДЕЛЕНИЕ СПРИНТА ─────────────────────────────────
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

if [[ -z "$SPRINT_NUM" ]]; then
  ACTIONPLAN="$REPO_ROOT/reports/actionplan.md"
  if [[ -f "$ACTIONPLAN" ]]; then
    # Ищем "Sprint N" со статусом АКТИВЕН или ЗАВЕРШЁН
    SPRINT_NUM=$(grep -oP 'Sprint \K[0-9]+(?=.*АКТИВ)' "$ACTIONPLAN" 2>/dev/null | tail -1 || true)
    if [[ -z "$SPRINT_NUM" ]]; then
      SPRINT_NUM=$(grep -oP 'Sprint \K[0-9]+' "$ACTIONPLAN" 2>/dev/null | sort -n | tail -1 || true)
    fi
  fi
  [[ -z "$SPRINT_NUM" ]] && die "Не удалось определить номер спринта. Укажи --sprint N"
  log "Авто-определён спринт: ${BOLD}Sprint $SPRINT_NUM${NC}"
fi

DATE_STR=$(date '+%Y-%m-%d')
TAG_NAME="sprint-$SPRINT_NUM"
COMMIT_MSG="chore: close Sprint $SPRINT_NUM [$DATE_STR]"

# ─── DRY-RUN WARNING ──────────────────────────────────────────
if $DRY_RUN; then
  warn "DRY-RUN режим — команды git push не выполняются"
fi

echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "${BOLD} GTCP Sprint $SPRINT_NUM — Закрытие спринта${NC}"
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""

# ─── [1/5] ПРОВЕРКА СТАТУСА ───────────────────────────────────
log "[1/5] Проверка git status..."

UNTRACKED=$(git status --porcelain 2>/dev/null | grep '^??' | wc -l | tr -d ' ')
MODIFIED=$(git status --porcelain 2>/dev/null | grep -v '^??' | wc -l | tr -d ' ')

if [[ "$MODIFIED" -gt 0 ]]; then
  warn "Есть незакоммиченных изменений: $MODIFIED файл(ов)"
  echo ""
  git status --short
  echo ""
  read -rp "  Добавить все изменения в коммит? [y/N] " ANS
  if [[ "${ANS,,}" == "y" ]]; then
    git add -A
    ok "git add -A выполнен"
  else
    warn "Пропускаем — коммит будет только из уже staged файлов"
  fi
elif [[ "$UNTRACKED" -gt 0 ]]; then
  warn "Есть $UNTRACKED неотслеживаемых файлов (untracked). Используй git add вручную если нужно."
else
  ok "Рабочее дерево чистое"
fi

# ─── [2/5] КОММИТ ─────────────────────────────────────────────
log "[2/5] Создание коммита завершения спринта..."

STAGED=$(git status --porcelain | grep -v '^??' | wc -l | tr -d ' ')

if [[ "$STAGED" -gt 0 ]]; then
  if $DRY_RUN; then
    warn "[DRY] git commit -m \"$COMMIT_MSG\""
  else
    git commit -m "$COMMIT_MSG" \
      && ok "Коммит создан: $COMMIT_MSG" \
      || warn "Коммит не создан (возможно, нечего коммитить)"
  fi
else
  log "Staged файлов нет — коммит пропускается"
fi

# ─── [3/5] ТЕГИРОВАНИЕ ────────────────────────────────────────
if $DO_TAG; then
  log "[3/5] Создание тега $TAG_NAME..."
  if git tag -l | grep -q "^$TAG_NAME$"; then
    warn "Тег $TAG_NAME уже существует — пропускаем"
  else
    if $DRY_RUN; then
      warn "[DRY] git tag -a $TAG_NAME -m \"Sprint $SPRINT_NUM completed $DATE_STR\""
    else
      git tag -a "$TAG_NAME" -m "Sprint $SPRINT_NUM completed $DATE_STR"
      ok "Тег создан: $TAG_NAME"
    fi
  fi
else
  log "[3/5] Тегирование пропущено (добавь --tag чтобы включить)"
fi

# ─── [4/5] PUSH MAIN ──────────────────────────────────────────
log "[4/5] git push origin main..."

if $DRY_RUN; then
  warn "[DRY] git push origin main"
else
  git push origin main \
    && ok "Ветка main запушена в GitHub" \
    || die "Push не удался. Проверь сеть / credentials"
fi

# ─── [5/5] PUSH TAGS ──────────────────────────────────────────
if $DO_TAG; then
  log "[5/5] git push origin --tags..."
  if $DRY_RUN; then
    warn "[DRY] git push origin --tags"
  else
    git push origin --tags \
      && ok "Теги запушены" \
      || warn "Теги не запушены (не критично)"
  fi
else
  log "[5/5] Push тегов пропущен"
fi

# ─── ИТОГ ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD} Sprint $SPRINT_NUM успешно закрыт!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo ""
echo -e "  Репозиторий : https://github.com/leokravchuk/GTCP"
echo -e "  Ветка       : main"
if $DO_TAG; then
  echo -e "  Тег         : $TAG_NAME"
fi
echo ""
