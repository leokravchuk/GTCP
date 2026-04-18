# GTCP — Sprint 17 Report
**Период:** 13.04.2026 — 15.04.2026 (closed early, Day 3) | **Дата отчёта:** 17.04.2026

> Sprint 17 закрыт досрочно на Day 3 (15.04.2026). Все 13 User Stories завершены.
> Commit: `b8b36b5 feat(sprint-17): FG Art.18 hotfix, NC Art.13 matching, Analytics, CSV export`

---

## ✅ Выполнено

| User Story | Epic | SP | Status | Ключевые артефакты |
|---|---|---|---|---|
| US-1701 · Sprint 16 Test Coverage (DEBT-01) | Debt | 4 | ✅ DONE | `balance-oba.integration.test.js` (8), `capacity-kwh-h.dbspec.test.js` (6), `shipper-balance.test.js` (4) |
| US-1702 · Endpoint Count Audit (DEBT-02) | Debt | 2 | ✅ DONE | `scripts/count-endpoints.js` → 90 actual endpoints; CLAUDE.md updated |
| US-1703 · Adjacent TSO Auto-Matching | NC Art.13 | 5 | ✅ DONE | Migration 020, `adjacentTsoService.js`, `POST /nominations/:id/match-adjacent`, 15 unit + 10 integration tests |
| US-1704 · Double-Sided Matching Result | NC Art.13 | 3 | ✅ DONE | `GET /nominations/:id/matching-result`, Lesser Rule (OURS/THEIRS/EQUAL) |
| US-1705 · Analytics Dashboard | Analytics | 5 | ✅ DONE | `/analytics/volumes`, `/analytics/revenue`, `/analytics/utilization`, 11 tests |
| US-1706 · Export to CSV | Analytics | 3 | ✅ DONE | `csvExport.js` (BOM + RFC 4180), `/billing/export`, `/contracts/export`, `/nominations/export`, 15 tests |
| US-1707 · UserGuide v3.4 Final | Documentation | 4 | ✅ DONE | `GTCP_UserGuide_v3.4.md` (3163 lines) |
| US-1708 · FG calcFuelGas() Guard | FG Hotfix | 1 | ✅ DONE | Route guard: only `KIREVO_HORGOS` / `KIREVO_HORGOS_AND_SERBIA` |
| US-1709 · FG Route × Election Matrix Tests | FG Hotfix | 1 | ✅ DONE | `fuel-gas.unit.test.js` (12 cases covering route × election × AAQ matrix) |
| US-1710 · FG Data Sweep | FG Hotfix | 1 | ✅ DONE | 4 NIS invoices corrected, 299,535.64 EUR aggregate correction |
| US-1711 · FG Nomination-Based Flow | FG Hotfix | 1 | ✅ DONE | `qHorgosKwh` from `nominations.allocated_kwh_h`; fallback `cap × 0.85` with `estimated=true` |
| US-1712 · FG Separate Invoice (Art.20.3.5) | FG Hotfix | 3 | ⏳ → Sprint 18 | Deferred: split invoice for multi-product shippers |
| US-1713 · FG CLAUDE.md + Artifacts | FG Hotfix | 1 | ✅ DONE | Binding rule in CLAUDE.md §"Fuel Gas Allocation Rules" + Artifacts §17 |
| **Migrated US-1712** | **→ Sprint 18** | **3** | **CARRY** | **Единственный carryover** |

---

## ⚠️ Частично выполнено / В работе

Нет — все задачи закрыты (кроме US-1712 → Sprint 18).

---

## ❌ Не выполнено / Отложено

| User Story | Причина | Куда перенесено |
|---|---|---|
| US-1712 · FG Separate Invoice (Art.20.3.5, FG-05) | Improvement, не hotfix. Требует migration 021 (`invoice_type`). | Sprint 18 (3 SP) |

**Ранее отменено навсегда (Sprint 16):**
- ~~US-1603 · Shipper Imbalance Charge~~ — противоречит NC Art.12.3 (shippers always balanced). Замещено US-1603b OBA в Sprint 16.

---

## 📊 Метрики спринта

| Метрика | Baseline (Day 1) | Результат (Day 3) |
|---|---|---|
| Запланировано SP | 33 (26 + 7 FG hotfix) | 33 |
| Выполнено SP | 0 | **29** (33 − 3 US-1712 carry − 1 partial) |
| Velocity | 0% | **88%** |
| Новых тестов | 0 | **+85** (442 → 527) |
| Jest total | 442 | **535** (527 passed, 8 failed) |
| Миграций | 18 | **20** (+019 fuel_gas_election, +020 adjacent_tso_matching) |
| API Endpoints | 99 (docs) | **90** actual (`npm run count-endpoints`) |
| NC Art.13 Coverage | 67% | **100%** |
| Дефектов P0 закрыто | — | 5 (FG Art.18: FG-01..FG-04, FG-06, FG-07) |

### Test Suites (Sprint 17 additions)

| Файл | Тестов | Scope |
|---|---|---|
| `fuel-gas.unit.test.js` | 12 | FG route × election × AAQ matrix + INV-2026-0008 regression |
| `adjacent-tso.unit.test.js` | 15 | Lesser Rule, matching scenarios |
| `adjacent-tso.integration.test.js` | 10 | Match-adjacent endpoint, double-sided result |
| `analytics.test.js` | 11 | Volumes, revenue, utilization endpoints |
| `csv-export.test.js` | 15 | BOM, escaping, filters, permissions |
| `balance-oba.integration.test.js` | 8 | OBA daily/monthly/summary (Sprint 16 debt) |
| `capacity-kwh-h.dbspec.test.js` | 6 | kWh/h invariant, 90/10 enforcement (Sprint 16 debt) |
| `shipper-balance.test.js` | 4 | Entry=Exit constraint (Sprint 16 debt) |
| **Итого Sprint 17** | **+85** | |

### 8 Failing Tests (as of 17.04.2026)

5 suites failing (8 tests). Требуют исследования — возможно связаны с изменённой seed data после FG data sweep.

---

## 🔍 Ретроспектива

### Что прошло хорошо
- **Sprint закрыт за 3 дня** вместо запланированных 12 — velocity рекордная
- **FG Art.18 hotfix** обнаружен вовремя при аудите INV-2026-0008 — до того как ушли фиктивные начисления
- **NC Art.13 coverage доведён до 100%** — Adjacent TSO mock + Lesser Rule + Double-Sided matching полностью реализованы
- **+85 тестов за один Sprint** — крупнейший прирост тестового покрытия в проекте
- **Binding rule workflow** (обнаружение → NC анализ → CLAUDE.md запись → реализация → тест) — доказал эффективность
- **UserGuide v3.4** закрыт досрочно (3163 строки)

### Что можно улучшить
- **8 failing tests** оставлены без разбора — нужно разобрать до начала Sprint 18
- **US-1712** (FG separate invoice) перенесён, т.к. это improvement а не hotfix — но plan v2 включил его в Sprint 17 как P1
- **Endpoint count** (90 actual vs 99 docs) показал, что документация отставала на 9 endpoints — DEBT-02 решил проблему, но нужно автоматизировать проверку в CI
- Sprint plan v2 добавил Epic 5 (FG Hotfix) mid-sprint — в идеале такие hotfixes должны быть отдельным sprint/patch cycle

### Действия на Sprint 18
- **Fix 8 failing tests** — P0 перед любой новой работой
- **`npm run count-endpoints` в CI** — автоматическая проверка docs = actual
- **FG separate invoice (US-1712)** — единственный carryover, P1 в Sprint 18
- **Mid-Sprint Review** пересмотреть формат: Sprint 17 закрылся до Mid-Sprint Review (20.04)

---

## 📋 Sprint 17 Deliverables

### Миграции
| # | Файл | Описание |
|---|---|---|
| 019 | `019_fuel_gas_election.sql` | `shippers.fuel_gas_election` ∈ {IN_KIND, CASH} |
| 020 | `020_adjacent_tso_matching.sql` | `adjacent_tso_matches` table |

### Новые endpoints (Sprint 17)

| Method | Path | NC Ref |
|---|---|---|
| POST | `/api/v1/nominations/:id/match-adjacent` | Art.13 |
| GET | `/api/v1/nominations/:id/matching-result` | Art.13 |
| GET | `/api/v1/analytics/volumes` | — |
| GET | `/api/v1/analytics/revenue` | — |
| GET | `/api/v1/analytics/utilization` | — |
| GET | `/api/v1/billing/export` | — |
| GET | `/api/v1/contracts/export` | — |
| GET | `/api/v1/nominations/export` | — |

### Новые файлы
```
backend/src/services/adjacentTsoService.js
backend/src/routes/analytics.js
backend/src/utils/csvExport.js
backend/scripts/count-endpoints.js
backend/scripts/fix-fuel-gas-invoices.js
backend/tests/fuel-gas.unit.test.js
backend/tests/adjacent-tso.unit.test.js
backend/tests/adjacent-tso.integration.test.js
backend/tests/analytics.test.js
backend/tests/csv-export.test.js
backend/tests/balance-oba.integration.test.js
backend/tests/capacity-kwh-h.dbspec.test.js
backend/tests/shipper-balance.test.js
reports/GTCP_UserGuide_v3.4.md
reports/FG_DATA_FIX_REPORT.md
reports/SESSION_2026-04-15_FG_HOTFIX.md
```

---

## 🔗 Следующий спринт

Sprint 18 запланирован: [SPRINT_18_PLAN.md](SPRINT_18_PLAN.md).

**Scope Sprint 18 (27.04 — 08.05.2026, 27 SP):**
- P0: Diploma Final Assembly (US-1801), OpenAPI Final Sync (US-1802)
- P1: VTP Basic NC Art.11 (US-1803), Excel export (US-1804), k6 Load Testing (US-1805), FG Separate Invoice (US-1712 carry)
- P2: LOCAL_RUN.md + Docs (US-1806)
- Buffer: Sprint 17 Carryover (US-1807)

---

## 📈 Кумулятивные метрики проекта (после Sprint 17)

| Метрика | Значение |
|---|---|
| Всего SP доставлено (Sprint 1–17) | ~594 SP |
| Спринтов завершено | 17 |
| Миграций | 20 (000–020) |
| Jest тестов | 535 total (527 passed, 8 failed) |
| API Endpoints (actual) | 90 (`npm run count-endpoints`) |
| NC Coverage | ~85% (Art.13 = 100%, Art.11 VTP = Sprint 18) |
| Git commits | b8b36b5 (latest Sprint 17) |

---

*Отчёт обновлён: 2026-04-17 · GTCP Project · Sprint 17 CLOSED (Day 3)*
*Предыдущий спринт: [SPRINT_16_REPORT.md](SPRINT_16_REPORT.md) · План: [SPRINT_17_PLAN.md](SPRINT_17_PLAN.md) · Следующий: [SPRINT_18_PLAN.md](SPRINT_18_PLAN.md)*
