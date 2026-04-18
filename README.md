# GTCP — Gas Trading & Commercial Platform

Коммерческая платформа для газотранспортного оператора **Gastrans d.o.o.** (Republic of Serbia).
Реализует требования **Network Code 2020** (NC) и тарифных решений **АЭРС 05-145 (17.07.2025)**.

> ⚠️ **Confidential.** Репозиторий содержит коммерчески чувствительные материалы.
> Публикация и использование вне этой машины запрещены (см. [CLAUDE.md](CLAUDE.md)).

---

## Быстрый старт

```powershell
cd C:\Users\leokr\ETRM\backend
docker compose up -d
```

Полная инструкция по окружению, портам, миграциям и проверке: [reports/LOCAL_RUN.md](reports/LOCAL_RUN.md).

---

## Структура репозитория

| Путь | Что там |
|---|---|
| [backend/](backend/) | Node.js API (Express + PostgreSQL), миграции `src/db/migrations/`, сиды `src/db/seeds/` |
| [backend/frontend/](backend/frontend/) | Frontend (http-server), статические страницы |
| [reports/](reports/) | Документация, спринт-отчёты, User Guide, аналитика |
| [NC-Gastrans-2020-ENG.pdf](NC-Gastrans-2020-ENG.pdf) | Network Code — **источник истины** по правилам |
| [CLAUDE.md](CLAUDE.md) | Проектные правила для Claude Code: IP, routes, тарифы, формулы |

---

## Источники истины (порядок консультации)

1. **NC** — [NC-Gastrans-2020-ENG.pdf](NC-Gastrans-2020-ENG.pdf) — что система **должна** делать (юридические и операционные правила).
2. **GTCP_Artifacts.md** — [reports/GTCP_Artifacts.md](reports/GTCP_Artifacts.md) — что система **уже делает** (реестр миграций, API, тестов, NC-compliance).
3. **CLAUDE.md** — [CLAUDE.md](CLAUDE.md) — **как** это делать (правила реализации, домены, формулы).

Если любой из трёх источников противоречит остальным — остановиться и спросить у пользователя.

---

## Ключевые документы

### Операционные
- [reports/LOCAL_RUN.md](reports/LOCAL_RUN.md) — локальный запуск (Docker / нативно), миграции, сиды, проверка
- [reports/GTCP_UserGuide_v3.3.md](reports/GTCP_UserGuide_v3.3.md) — текущий User Guide (actual)
- [reports/GTCP_Artifacts.md](reports/GTCP_Artifacts.md) — реестр артефактов, API surface, миграции, покрытие тестами

### Аналитика
- [reports/Gastrans_Capacity_Analysis.pdf](reports/Gastrans_Capacity_Analysis.pdf) — разбор Technical Capacity по IP
- [reports/Gastrans_formula_Analysis.pdf](reports/Gastrans_formula_Analysis.pdf) — разбор биллинговых формул (period-aware)
- [reports/Gastrans_code_Analysis.pdf](reports/Gastrans_code_Analysis.pdf) — разбор кодбазы
- [reports/RBP_Integration_Analysis.md](reports/RBP_Integration_Analysis.md) — интеграция с Regional Booking Platform (SOAP)
- [reports/CAM_NC_Auction_Calendar_2025-2026.xlsx](reports/CAM_NC_Auction_Calendar_2025-2026.xlsx) — календарь аукционов GY 2025/2026

### Планирование
- [reports/actionplan.md](reports/actionplan.md) — активные задачи
- [reports/roadmap.md](reports/roadmap.md) — roadmap и бэклог
- `reports/SPRINT_*_PLAN.md` / `reports/SPRINT_*_REPORT.md` — планы и отчёты по спринтам (Sprint 5 → 17)

---

## Текущее состояние (Sprint 17 closed, Sprint 18 planned — 17.04.2026)

| Метрика | Значение |
|---|---|
| **Миграции** | 000 → 020 (`capacity_kwh_h`, OBA, FG election, adjacent TSO matching) |
| **API endpoints** | 90 actual (`npm run count-endpoints`) |
| **Jest тесты** | 535 (527 passed / 8 failed / 33 suites) |
| **Спринтов завершено** | 17 |
| **Всего SP доставлено** | ~594 SP |
| **NC compliance** | Art. 3, 5, 6, 7, 10–13 (100%), 15 (OBA read-only), 17, 18, 20 |

**Sprint 17 (closed Day 3, 29/33 SP):** FG Art.18 hotfix, NC Art.13 matching (67%→100%), Analytics, CSV export, +85 тестов, UserGuide v3.4

**Sprint 18 (planned, 27.04–08.05.2026, 27 SP):** Diploma Assembly, OpenAPI sync, VTP NC Art.11, Excel export, k6 load testing, FG-invoice split

**Последние релизы:**
- Sprint 17 — FG Art.18 hotfix, NC Art.13 matching, Analytics, CSV export
- Sprint 16 — OBA Settlement (NC Art.15) + `capacity_kwh_h` (migration 017) + UI cleanup
- Sprint 15 — Auction Calendar endpoints

Подробнее: [reports/SPRINT_17_REPORT.md](reports/SPRINT_17_REPORT.md), [reports/SPRINT_18_PLAN.md](reports/SPRINT_18_PLAN.md).

---

## Домен — критичные правила (из CLAUDE.md)

- **3 физических IP:** `KIREVO-ENTRY`, `HORGOS-EXIT`, `EXIT-SERBIA` (+ виртуальные reverse-варианты).
- **7 маршрутов** (`flow_direction`): physical × 3, commercial reverse full × 2, commercial reverse half × 2.
- **Ёмкость всегда в kWh/h**, авторитетная колонка — `capacity_kwh_h` (миграция 017).
- **Tariff period-aware formulas** — раздельно Entry и Exit (`cap_entry ≠ cap_exit`).
- **Shippers всегда сбалансированы** (NC Art.12.3) — OBA только TSO-to-TSO (read-only).
- **Yearly Firm auction** — ТОЛЬКО по surrendered LT (NC Art.7.1.2); ST 10% идёт через Q/M/D/WD.

Полные определения, таблицы тарифов и формулы — в [CLAUDE.md](CLAUDE.md).
