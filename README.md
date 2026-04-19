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
- [reports/GTCP_UserGuide_v3.5.md](reports/GTCP_UserGuide_v3.5.md) — текущий User Guide (actual)
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
- [reports/CAM_NC_AUCTION_COMPLIANCE_REPORT.md](reports/CAM_NC_AUCTION_COMPLIANCE_REPORT.md) — CAM NC ascending clock vs sealed-bid
- [reports/DIPLOMA_FINAL_SUMMARY.md](reports/DIPLOMA_FINAL_SUMMARY.md) — итоговая сводка для дипломной защиты
- `reports/SPRINT_*_PLAN.md` / `reports/SPRINT_*_REPORT.md` — планы и отчёты по спринтам (Sprint 5 → 22)

---

## Текущее состояние (Sprint 22 closed — 19.04.2026)

| Метрика | Значение |
|---|---|
| **Миграции** | 000 → 025 |
| **API endpoints** | 110 (`npm run count-endpoints`) |
| **OpenAPI** | 110/110 (100% sync) |
| **Jest тесты** | 612 passed (42 suites, 0 failing) |
| **Спринтов завершено** | 22 |
| **Всего SP доставлено** | ~750 SP |
| **NC compliance** | ~93% (Art.3,5,6,7,8,10-15,17-18,20,24) |

**Sprint 20–22 highlights:**
- Capacity Surrender (Art.8), UIOLI (Art.10), WD (Art.6.3.1.4), Interruption (Art.14)
- Раздел «Заявка» (Available Capacity, RBP panel, Portfolio, Reports)
- CAM NC Compliance Report (ascending clock vs sealed-bid)
- Clearing price + auction premium auto-calculation (Art.17-18)

**Local deploy:** `http://localhost:3003/GTCP_MVP.html` (admin / admin123)

Подробнее: [reports/DIPLOMA_FINAL_SUMMARY.md](reports/DIPLOMA_FINAL_SUMMARY.md), [reports/SPRINT_21_REPORT.md](reports/SPRINT_21_REPORT.md).

---

## Домен — критичные правила (из CLAUDE.md)

- **3 физических IP:** `KIREVO-ENTRY`, `HORGOS-EXIT`, `EXIT-SERBIA` (+ виртуальные reverse-варианты).
- **7 маршрутов** (`flow_direction`): physical × 3, commercial reverse full × 2, commercial reverse half × 2.
- **Ёмкость всегда в kWh/h**, авторитетная колонка — `capacity_kwh_h` (миграция 017).
- **Tariff period-aware formulas** — раздельно Entry и Exit (`cap_entry ≠ cap_exit`).
- **Shippers всегда сбалансированы** (NC Art.12.3) — OBA только TSO-to-TSO (read-only).
- **Yearly Firm auction** — ТОЛЬКО по surrendered LT (NC Art.7.1.2); ST 10% идёт через Q/M/D/WD.

Полные определения, таблицы тарифов и формулы — в [CLAUDE.md](CLAUDE.md).
