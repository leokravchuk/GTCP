# GTCP — Sprint 18 Report
**Период:** 17–18.04.2026 (closed Day 2) | **Дата отчёта:** 18.04.2026

> Sprint 18 закрыт досрочно на Day 2.
> Commit: `7757c2f feat(sprint-18): VTP Art.11, Excel export, FG-invoice split, OpenAPI 100% sync`

---

## ✅ Выполнено

| User Story | Epic | SP | Status | Ключевые артефакты |
|---|---|---|---|---|
| US-1807 · Sprint 17 Carryover (8 failing tests) | Debt | 4 | ✅ DONE | `nextReference()` rewritten, response format tests, `allocated_kwh_h` fix |
| US-1803 · VTP Basic (NC Art.11) | VTP | 5 | ✅ DONE | Migration 021, `vtp.js` (5 endpoints), 6 seed trades, 16 tests |
| US-1804 · Excel xlsx Export | Export | 3 | ✅ DONE | `xlsxExport.js`, exceljs, 3 endpoints `?format=xlsx`, 5 tests |
| US-1712 · FG Separate Invoice (Art.20.3.5) | Billing | 3 | ✅ DONE | Migration 022 (`invoice_type`), `/generate` split, 3 tests |
| US-1802 · OpenAPI Final Sync | API | 2 | ✅ DONE | `openapi.yaml` 95/95 endpoints, 18 obsolete removed |
| US-1806 · LOCAL_RUN.md + Docs | Docs | 2 | ✅ DONE | Full rewrite (559 tests, 22 migrations, API quick start) |
| US-1805 · Load Testing | Performance | 3 | ✅ DONE | autocannon smoke test, `LOAD_TEST_RESULTS.md` |
| — · CLAUDE.md + Artifacts update | Docs | — | ✅ DONE | Endpoint count 95, migrations 022, velocity chart Sprint 17-18 |
| — · README.md | Docs | — | ✅ DONE | Project entry point created |
| — · Sprint 17 Report | Docs | — | ✅ DONE | Finalized from Day 1 baseline to closed state |

---

## ⚠️ Partially Done

| User Story | Notes |
|---|---|
| US-1801 · Diploma Final Assembly | Not started — requires manual document work (text, presentation). Defer to Sprint 19. |

---

## 📊 Метрики спринта

| Метрика | Baseline (Start) | Результат (Day 2) |
|---|---|---|
| Запланировано SP | 27 | 27 |
| Выполнено SP | 0 | **22** (27 − 5 US-1801 deferred) |
| Velocity | 0% | **81%** |
| Новых тестов | 0 | **+24** (535 → 559) |
| Jest total | 535 (8 failing) | **559 (0 failing)** |
| Миграций | 20 | **22** (+021 VTP, +022 invoice_type) |
| API Endpoints | 90 | **95** (+5 VTP) |
| OpenAPI coverage | 58/90 (64%) | **95/95 (100%)** |
| Test suites | 33 | **36** (+vtp, +xlsx, +fg-split) |

### Load Test Results (autocannon, 10 connections × 10s)

| Endpoint | p50 | p97.5 | RPS | Errors |
|---|---|---|---|---|
| health | 2ms | 7ms | 2,928 | 0% |
| nominations | 15ms | 20ms | 636 | 0% |
| billing | 13ms | 19ms | 708 | 0% |
| capacity/available | 136ms | 281ms | 68 | 0% |
| vtp/trades | 14ms | 21ms | 671 | 0% |
| analytics/volumes | 8ms | 13ms | 1,114 | 0% |

All endpoints p97.5 < 500ms, 0% error rate. Details: [LOAD_TEST_RESULTS.md](LOAD_TEST_RESULTS.md).

### New Test Suites (Sprint 18)

| Файл | Тестов | Scope |
|---|---|---|
| `vtp.integration.test.js` | 16 | VTP CRUD, balance, confirm, validation |
| `export-xlsx.test.js` | 5 | Excel format, headers, numeric types, empty result |
| `fg-invoice-split.test.js` | 3 | Art.20.3.5 multi-product split, single-product, in-kind |

### Bug Fixes (Sprint 18)

| Fix | Files | Impact |
|---|---|---|
| `nextReference()` duplicate key | `nominations.js` | COUNT→MAX prevents collision when refs renamed |
| Response format tests | 4 test files | Plain array + X-Total-Count header (not `{data, total}`) |
| `allocated_kwh_h` column removed | `nominations.js`, `analytics.js` | Column doesn't exist; NC Art.12.3 says allocated=matched |
| Mock patterns updated | 3 test files | `COUNT` → `MAX` for new `nextReference` SQL |
| `capacity_mwh_d` in test mock | `billing.dbspec.test.js` | Code reads `capacity_kwh_h` since migration 017 |

---

## 🔍 Ретроспектива

### Что прошло хорошо
- **Sprint закрыт за 2 дня** — 22/27 SP (81%)
- **OpenAPI 100% sync** — впервые docs = actual = 0 discrepancies
- **8 failing tests полностью починены** — root cause: `nextReference()` race + schema drift
- **VTP delivered end-to-end** — migration → route → seed → tests (16 tests)
- **Excel export clean integration** — exceljs + typed columns + auto-filter
- **Load test** подтвердил: все endpoints < 500ms при p97.5, avg 854 RPS

### Что можно улучшить
- **US-1801 Diploma Assembly** не сделана — требует ручной работы с документами
- **Load test** проводился на localhost — нужен VPS для реалистичных результатов
- **`shippers` endpoint** вернул 401 в load test — нужно проверить JWT permission routing

### Действия на Sprint 19
- **US-1801 Diploma Assembly** — P0 carryover
- **VPS Deploy** — если доступен Hetzner/DigitalOcean
- **VTP Integration** — учёт VTP trades в Balance view
- **Load test на VPS** — реалистичные p95/p99 с network latency

---

## 📋 Sprint 18 Deliverables

### Миграции
| # | Файл | Описание |
|---|---|---|
| 021 | `021_vtp_trades.sql` | VTP trades table + seed 6 trades (NC Art.11) |
| 022 | `022_invoice_type.sql` | `invoices.invoice_type` ∈ {CAPACITY, FUEL_GAS, IMBALANCE} |

### Новые endpoints (Sprint 18)

| Method | Path | NC Ref |
|---|---|---|
| GET | `/api/v1/vtp/trades` | Art.11 |
| POST | `/api/v1/vtp/trades` | Art.11 |
| GET | `/api/v1/vtp/trades/:id` | Art.11 |
| PATCH | `/api/v1/vtp/trades/:id/confirm` | Art.11 |
| GET | `/api/v1/vtp/balance` | Art.11 |

### Новые файлы
```
backend/src/routes/vtp.js
backend/src/utils/xlsxExport.js
backend/src/db/migrations/021_vtp_trades.sql
backend/src/db/migrations/022_invoice_type.sql
backend/tests/vtp.integration.test.js
backend/tests/export-xlsx.test.js
backend/tests/fg-invoice-split.test.js
backend/tests/load/smoke.js
backend/docs/openapi.yaml (rewritten)
reports/README.md
reports/LOCAL_RUN.md (rewritten)
reports/LOAD_TEST_RESULTS.md
reports/SPRINT_17_REPORT.md (finalized)
reports/SPRINT_18_REPORT.md
```

### Изменённые файлы
```
backend/src/app.js (+vtpRouter)
backend/src/routes/billing.js (+xlsx, +FG split)
backend/src/routes/contracts.js (+xlsx)
backend/src/routes/nominations.js (+xlsx, nextReference fix, allocated_kwh_h fix)
backend/src/routes/analytics.js (allocated_kwh_h fix)
backend/package.json (+exceljs, +autocannon)
CLAUDE.md (endpoints 95, migrations 022, FG bugs resolved)
reports/GTCP_Artifacts.md (v1.4, endpoint map 95, velocity Sprint 17-18)
```

---

## 🔗 Следующий спринт

Sprint 19 scope (предварительный):
- US-1801 Diploma Assembly (5 SP carry)
- VTP Integration — VTP trades в Balance view
- Transparency Portal (NC Art.24) — public endpoints
- Real FGSZ/Bulgartransgaz integration stubs
- VPS Deploy (Hetzner)
- Load test на VPS

---

## 📈 Кумулятивные метрики проекта (после Sprint 18)

| Метрика | Значение |
|---|---|
| Всего SP доставлено (Sprint 1–18) | ~655 SP |
| Спринтов завершено | 18 |
| Миграций | 22 (000–022) |
| Jest тестов | 559 (0 failing, 36 suites) |
| API Endpoints (actual) | 95 (`npm run count-endpoints`) |
| OpenAPI coverage | 95/95 (100%) |
| NC Coverage | ~87% |
| Avg RPS (smoke test) | 854 |

---

*Отчёт: 18.04.2026 · GTCP Project · Sprint 18 CLOSED (Day 2)*
*Предыдущий: [SPRINT_17_REPORT.md](SPRINT_17_REPORT.md) · План: [SPRINT_18_PLAN.md](SPRINT_18_PLAN.md)*
