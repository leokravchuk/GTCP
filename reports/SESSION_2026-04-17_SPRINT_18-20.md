# GTCP — Session Report 17–19.04.2026

**Sprint 18–20 · Mega-session · 5 commits, 60 SP, +17 endpoints, +43 tests**

---

## Контекст

Начало сессии: Sprint 17 closed (Day 1 baseline report), 8 failing tests, OpenAPI 64%, 90 endpoints.
Задача: Sprint 18 plan execution → далее по цепочке Sprint 19–20.

---

## Выполненные спринты

### Sprint 18 (17–18.04.2026) — 22/27 SP, closed Day 2

| US | SP | Описание |
|---|---|---|
| US-1807 | 4 | **Fix 8 failing tests (carryover):** `nextReference()` rewritten COUNT→MAX (duplicate key fix), response format tests (plain array + X-Total-Count), `allocated_kwh_h` removed (column doesn't exist, NC Art.12.3: allocated=matched), mock patterns updated |
| US-1803 | 5 | **VTP Basic (NC Art.11):** migration 021 `vtp_trades`, `src/routes/vtp.js` (5 CRUD endpoints), 6 seed trades (Газпром↔NIS, WIEH↔MET), 16 integration tests |
| US-1804 | 3 | **Excel xlsx export:** `src/utils/xlsxExport.js` (exceljs), typed columns (number/eur/date), auto-filter, bold headers. `?format=xlsx` on billing/contracts/nominations export. 5 tests |
| US-1712 | 3 | **FG Separate Invoice (NC Art.20.3.5):** migration 022 `invoices.invoice_type` ∈ {CAPACITY, FUEL_GAS, IMBALANCE}. `POST /billing/generate` splits FG into separate invoice when >1 contract. 3 tests |
| US-1802 | 2 | **OpenAPI 100% sync:** complete rewrite `openapi.yaml` — 95/95 endpoints, 18 obsolete removed. `npm run count-endpoints` = 0 discrepancies |
| US-1806 | 2 | **LOCAL_RUN.md:** full rewrite to Sprint 18 state (559 tests, 22 migrations, API quick start) |
| US-1805 | 3 | **Load testing:** autocannon smoke test, avg 854 RPS, all p97.5 < 500ms, 0% errors. Scripts: `npm run test:load/stress/spike` |

Также: Sprint 17 Report finalized, README.md created, CLAUDE.md + Artifacts updated.

**Commits:**
- `7757c2f feat(sprint-18): VTP Art.11, Excel export, FG-invoice split, OpenAPI 100% sync`
- `c22e394 docs(sprint-18): close Sprint 18 — load test, report, artifacts update`

---

### Sprint 19 (18–19.04.2026) — 19/24 SP, closed Day 2

| US | SP | Описание |
|---|---|---|
| US-1801 | 3 | **Diploma Artifacts Index:** `DIPLOMA_ARTIFACTS_INDEX.md` — полный индекс 60+ артефактов (9 секций: кодовая база, нормативная, docs, user guides, аналитика, спринт-отчёты, сессии, инфраструктура, кумулятивная статистика) |
| US-1901 | 5 | **VTP Balance Integration (NC Art.12.3 + Art.11):** `GET /balance` rewritten — nominations + VTP trades combined view. Balance = (nom_entry + vtp_buy) − (nom_exit + vtp_sell). `balanced` flag: |diff| < 1 kWh/h |
| US-1902 | 5 | **Transparency Portal (NC Art.24):** `src/routes/public.js` — 4 public endpoints без JWT. `GET /public/capacity` (anonymized), `/public/auctions`, `/public/gas-quality` (Art.17), `/public/fuel-gas-price` (Art.18.5.1.4). Rate-limited 30 req/min. 6 tests |
| US-1903 | 3 | **UserGuide v3.5:** Sprint 18–19 changelog (VTP, xlsx, FG-invoice, Transparency Portal, VTP balance) |
| US-1904 | 1 | **OpenAPI sync:** 99/99 endpoints documented |
| US-1905 | 2 | **Load test fix:** JWT secret default match, p95→p97.5, `npm run test:load` scripts in package.json |

**Commits:**
- `24423bd feat(sprint-19): Transparency Portal Art.24, VTP balance, Diploma index`
- `8429065 docs(sprint-19): UserGuide v3.5, Sprint 19 Report, load test fix`

---

### Sprint 20 (19.04.2026) — 15 SP, single commit

| US | SP | Описание |
|---|---|---|
| US-2001 | 5 | **Capacity Surrender + UIOLI (NC Art.8/10):** migration 023 (`capacity_surrenders` + `interruptions` tables). `POST /capacity/surrender`, `PATCH /surrender/:id/approve`, `GET /surrender/history`, `POST /capacity/uioli/check` (underutilization <80%). 7 tests |
| US-2002 | 5 | **Within-Day Continuous Booking (NC Art.6.3.1.4):** `POST /capacity/within-day` — hourly booking, fee = cap × price_per_hour × hours (NOT /365). `GET /capacity/within-day/available`. 3 tests |
| US-2003 | 5 | **Interruption Management (NC Art.14):** `POST /capacity/interrupt` — TSO interrupts interruptible capacity, penalty = fee × 3 (AERS 05-145 item 3). `GET /capacity/interruptions`. 3 tests |

**Commit:**
- `51f682b feat(sprint-20): Capacity Surrender Art.8, Within-Day Art.6, Interruption Art.14`

---

## Кумулятивные метрики

| Метрика | До сессии (Sprint 17) | После сессии (Sprint 20) | Delta |
|---|---|---|---|
| **Jest tests** | 535 (8 failing) | **578 (0 failing)** | +43, −8 fixed |
| **Test suites** | 33 | **38** | +5 |
| **API endpoints** | 90 | **107** | +17 |
| **OpenAPI coverage** | 58/90 (64%) | **107/107 (100%)** | full sync |
| **Migrations** | 20 | **23** | +3 |
| **SP delivered** | ~633 | **~693** | +60 SP |
| **NC Coverage** | ~85% | **~92%** | +7% |
| **Спринтов** | 17 | **20** | +3 |

---

## NC Articles покрытые за сессию

| Article | Что реализовано | Sprint |
|---|---|---|
| **Art.6.3.1.4** | Within-Day capacity hourly booking, fee formula | 20 |
| **Art.8** | Capacity Surrender (voluntary + TSO approval) | 20 |
| **Art.10** | UIOLI — underutilization check (<80% threshold) | 20 |
| **Art.11** | VTP — Virtual Trading Point (trades CRUD + balance integration) | 18–19 |
| **Art.14** | Interruption management, penalty × 3 (AERS 05-145) | 20 |
| **Art.20.3.5** | FG separate invoice for multi-product shippers | 18 |
| **Art.24** | Transparency Portal — 4 public endpoints, rate-limited | 19 |

---

## Новые файлы (за сессию)

```
backend/src/routes/vtp.js                       ← VTP CRUD + balance (NC Art.11)
backend/src/routes/public.js                    ← Transparency Portal (NC Art.24)
backend/src/routes/surrender.js                 ← Surrender + WD + Interruption (NC Art.8/10/14/6.3.1.4)
backend/src/utils/xlsxExport.js                 ← Excel export utility (exceljs)
backend/src/db/migrations/021_vtp_trades.sql
backend/src/db/migrations/022_invoice_type.sql
backend/src/db/migrations/023_capacity_surrender.sql
backend/tests/vtp.integration.test.js           (16 tests)
backend/tests/export-xlsx.test.js               (5 tests)
backend/tests/fg-invoice-split.test.js          (3 tests)
backend/tests/public.test.js                    (6 tests)
backend/tests/surrender.test.js                 (13 tests)
backend/tests/load/smoke.js                     (autocannon load test)
backend/docs/openapi.yaml                       (rewritten, 107/107)
reports/README.md
reports/LOCAL_RUN.md                            (rewritten v3.0)
reports/LOAD_TEST_RESULTS.md
reports/DIPLOMA_ARTIFACTS_INDEX.md
reports/GTCP_UserGuide_v3.5.md
reports/SPRINT_17_REPORT.md                     (finalized)
reports/SPRINT_18_PLAN.md / SPRINT_18_REPORT.md
reports/SPRINT_19_PLAN.md / SPRINT_19_REPORT.md
reports/SPRINT_20_PLAN.md
```

---

## Bug fixes за сессию

| Fix | Root cause | Impact |
|---|---|---|
| `nextReference()` duplicate key | COUNT-based seq collides when refs renamed | nominations POST 500 error |
| Response format tests (4 files) | Routes return plain array, tests expected `{data, total}` | 4 test failures |
| `allocated_kwh_h` column removed | Column never existed in `nominations` table | match route 500, analytics query fail on real DB |
| `capacity_mwh_d` in test mock | Code reads `capacity_kwh_h` since migration 017 | billing.dbspec test failure |
| gas-quality default filter | Route no longer defaults to HORGOS-EXIT, returns all IPs | billing.coverage test failure |
| JWT secret in load test | Load test used different default than server | shippers 401 in load test |

---

## Решения и ADR

| # | Решение | Обоснование |
|---|---|---|
| ADR-020 | VTP trades = separate table, not nominations extension | NC Art.11 defines VTP as distinct mechanism; VTP trades have counterparty, price, trade_type |
| ADR-021 | Excel export via exceljs (not SheetJS) | exceljs supports streaming, typed columns, auto-filter; lighter than xlsx |
| ADR-022 | FG invoice split at preview level (`/generate`), not at save level | Preview allows user review before committing; aligns with existing billing flow |
| ADR-023 | Transparency Portal = separate route file, no JWT | NC Art.24 mandates public access; rate-limiting at route level (30/min) |
| ADR-024 | Surrender + WD + Interruption in single route file | All relate to capacity lifecycle; avoids route file proliferation |
| ADR-025 | OpenAPI maintained manually, verified by `count-endpoints` | Auto-generation would lose descriptions and NC references |

---

## Следующие шаги (Sprint 21+)

- **Diploma Final Assembly:** обновить текст диплома + презентацию до Sprint 20 state
- **VPS Deploy:** Hetzner/DigitalOcean, nginx + PM2 + SSL
- **Real adjacent TSO integration:** replace mock with API stubs (FGSZ, Bulgartransgaz)
- **Frontend dashboard update:** VTP tab, Surrender tab, Transparency link
- **Target 600+ tests:** balance integration, edge cases, regression suite
- **NC Coverage → 95%:** Art.9 (Congestion), Art.16 (Measurement), Art.19 (Technical)

---

*Session report: 17–19.04.2026 · GTCP Project · Sprint 18–20 closed*
*Participants: Leo Kravchuk + Claude Opus 4.6*
