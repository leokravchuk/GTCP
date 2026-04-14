# GTCP — Sprint 17 Plan
**Gas Trading & Commercial Platform · NC Art.13 + Analytics + Sprint 16 Debt + Diploma Prep + FG Art.18 Hotfix**

> **Обновлено 14.04.2026 v2:** добавлен Epic 5 — Fuel Gas Hotfix (NC Art.18 + Art.19.1.4), +7 SP. Обнаружено при аудите INV-2026-0008.

---

## Sprint Overview

| Параметр | Значение |
|---|---|
| **Sprint** | Sprint 17 |
| **Период** | 13.04.2026 — 24.04.2026 |
| **Команда** | Backend Dev, Frontend Dev, QA, Tech Lead |
| **Velocity (цель)** | **33 SP** (26 базовый план + 7 FG hotfix; US-1712 FG-invoice split → Sprint 18) |
| **Sprint Goal** | Закрыть NC Art.13 Matching (67% → 100%), Analytics + Export, Sprint 16 test debt, UserGuide v3.4, **исправить FG начисление (правильно только транзит KIREVO_HORGOS)** |
| **Приоритет** | P0 — NC Art.13 + Sprint 16 debt + **FG hotfix (US-1708/1711)**; P1 — Analytics, Export, UserGuide, FG election/tests |
| **Статус** | 🔄 IN PROGRESS (Day 2) |

---

## Sprint Goal

> **«К концу Sprint 17 Art.13 Matching полностью реализован через Adjacent TSO mock, Analytics dashboard показывает реальные объёмы/revenue/utilization, Export CSV работает для Billing/Contracts/Nominations, Sprint 16 OBA + capacity_kwh_h покрыты тестами, и UserGuide v3.4 готов как приложение к дипломной работе.»**

### Критерии успеха Sprint

- [ ] NC Art.13 coverage = 100% (Adjacent TSO matching + Lesser Rule + Double-Sided)
- [ ] Analytics dashboard работает с реальными данными из API (volumes / revenue / utilization)
- [ ] Export CSV работает из UI для 3 модулей
- [ ] Sprint 16 test debt погашен: ≥15 новых тестов (OBA endpoints + capacity_kwh_h invariants)
- [ ] Endpoint count audit завершён — docs = actual
- [ ] UserGuide v3.4 (.md + .docx) готов к защите
- [ ] **FG Art.18 hotfix: KIREVO_EXIT_SERBIA + 4× CR → FG=0; INV-2026-0008 исправлен; migration 019 election; ≥6 FG-тестов**
- [ ] Jest total ≥ 466 (было 442; +18 Sprint 16 debt, +6 FG matrix)

---

## Sprint Backlog

### Epic 1: Sprint 16 Debt

#### US-1701 · Sprint 16 Test Coverage (DEBT-01)
**Как** QA, **я хочу** покрыть Sprint 16 deliverables тестами, **чтобы** миграция 017/018 и OBA endpoints не регрессировали.

| | |
|---|---|
| **Story Points** | 4 |
| **Assignee** | QA + Backend Dev |
| **Priority** | 🔴 P0 |

**Задачи:**
- [ ] `DEBT-01.1` Создать `tests/balance-oba.integration.test.js` — ≥8 cases (daily filter, monthly aggregation, summary, 12-month window, empty result, invalid month format, point_code filter, adjacent_tso filter)
- [ ] `DEBT-01.2` Создать `tests/capacity-kwh-h.dbspec.test.js` — ≥6 cases (migration 017 backfill correctness, `capacity_kwh_h` vs `capacity_mwh_d * 1000 / 24` consistency, over-nomination BUG-04/05 regression, null handling, rounding ±1 kWh/h tolerance, new insert uses `capacity_kwh_h`)
- [ ] `DEBT-01.3` Создать `tests/shipper-balance.test.js` — ≥4 cases (Газпром Σ Entry = Σ Exit, NIS balance, LT total ≤ 90% Tech, Art.12.3 enforcement)
- [ ] `DEBT-01.4` Jest total ≥ 460

**DoD:** 18+ новых тестов зелёные в CI; coverage для `balance.js` ≥ 90%.

---

#### US-1702 · Endpoint Count Audit (DEBT-02)
**Как** Tech Lead, **я хочу** единый источник правды для количества API endpoints, **чтобы** документация (CLAUDE.md, GTCP_Artifacts.md, UserGuide, OpenAPI) не расходилась.

| | |
|---|---|
| **Story Points** | 2 |
| **Assignee** | Tech Lead |
| **Priority** | 🔴 P0 |

**Задачи:**
- [ ] `DEBT-02.1` Сгенерировать список всех `router.*` вызовов из `backend/src/routes/` + `app.*` из `app.js`
- [ ] `DEBT-02.2` Сверить с `backend/docs/openapi.yaml` — найти расхождения
- [ ] `DEBT-02.3` Обновить endpoint count в CLAUDE.md, GTCP_Artifacts.md (header + §14 + velocity chart), UserGuide
- [ ] `DEBT-02.4` Добавить `npm run count-endpoints` script в `package.json` для автоматической сверки в будущем

**DoD:** Единое число endpoints во всех трёх источниках правды; script для сверки существует.

---

### Epic 2: NC Art.13 — Matching Completion

#### US-1703 · Adjacent TSO Auto-Matching (перенос US-1601)
**Как** TSO-оператор, **я хочу** автоматический матчинг номинаций с соседними TSO (FGSZ, Bulgartransgaz, TRANSPORTGAS SRBIJA), **чтобы** соответствовать NC Art.13.5.

| | |
|---|---|
| **Story Points** | 5 |
| **Assignee** | Backend Dev |
| **Priority** | 🔴 P0 |

**Задачи:**
- [ ] `MATCH-01` Реализовать `matchWithAdjacentTso(nomId)` в `nominations.js` — сравнение по `gas_day`, `point_code`, `shipper_id`
- [ ] `MATCH-02` Mock Adjacent TSO service: `src/services/adjacentTsoMock.js` — возвращает reasonable data (85–100% от shipper nom)
- [ ] `MATCH-03` Endpoint `POST /api/v1/nominations/:id/match-adjacent` — вручную запустить Adjacent matching
- [ ] `MATCH-04` Lesser Rule (NC Art.13.2.3): `confirmed = MIN(shipper_nom, adjacent_tso_nom)`
- [ ] `MATCH-05` Статус `MATCHED_ADJACENT` в nomination lifecycle
- [ ] `MATCH-06` Migration 019: `nominations.adjacent_tso_nom_kwh_h`, `adjacent_tso_confirmed_kwh_h`, `matching_rule TEXT`
- [ ] `MATCH-07` Jest тесты: ≥12 cases (Lesser Rule, timeout, mismatch, partial match, VTP exemption, multi-shipper)

**DoD:** Номинации автоматически сверяются с mock adjacent TSO; Lesser Rule применяется; NC Art.13 coverage 67% → 100%.

---

#### US-1704 · Double-Sided Matching Result (перенос US-1602)
**Как** шиппер, **я хочу** видеть результат двустороннего матчинга, **чтобы** знать confirmed объёмы до начала Gas Day.

| | |
|---|---|
| **Story Points** | 3 |
| **Assignee** | Backend Dev + Frontend Dev |
| **Priority** | 🔴 P0 |

**Задачи:**
- [ ] `MATCH-08` Endpoint `GET /api/v1/nominations/:id/matching-result` — returns `confirmed_kwh_h`, `shipper_nom`, `counterparty_nom`, `applied_rule`, `matching_timestamp`
- [ ] `MATCH-09` Frontend: Matching Result panel в nomination detail modal (✅ matched / ⏳ pending / ❌ mismatch)
- [ ] `MATCH-10` Jest тесты: ≥6 cases (matched, unmatched, partial, VTP, missing adjacent, timeout)

**DoD:** UI показывает результат матчинга с применённым правилом; Art.13.3 = 100%.

---

### Epic 3: Analytics & Export

#### US-1705 · Analytics Dashboard (перенос US-1604)
**Как** TSO-менеджер, **я хочу** графики объёмов и revenue, **чтобы** принимать оперативные решения.

| | |
|---|---|
| **Story Points** | 5 |
| **Assignee** | Frontend Dev + Backend Dev |
| **Priority** | 🟡 P1 |

**Задачи:**
- [ ] `ANAL-01` Backend: новый router `src/routes/analytics.js`
- [ ] `ANAL-02` `GET /api/v1/analytics/volumes?period=monthly&point=KIREVO-ENTRY` — агрегация из `nominations` (GROUP BY gas_day, point, shipper)
- [ ] `ANAL-03` `GET /api/v1/analytics/revenue?period=monthly` — SUM из `invoices.total_amount_eur` BY shipper / product_type
- [ ] `ANAL-04` `GET /api/v1/analytics/utilization` — % утилизации = `SUM(allocated_kwh_h) / Technical` BY IP
- [ ] `ANAL-05` Frontend: Chart.js via CDN, новая вкладка Analytics в `GTCP_MVP.html`
- [ ] `ANAL-06` Line chart (volumes monthly trend) + Bar chart (revenue by shipper stacked) + Gauge (utilization 3 IPs)
- [ ] `ANAL-07` Period selector (месяц/квартал/год) + shipper filter
- [ ] `ANAL-08` Jest тесты: ≥6 cases (volumes, revenue, utilization, period filter, empty result, invalid period)

**DoD:** Dashboard показывает 3 типа графиков с реальными данными; фильтры работают; Chart.js подключён через CDN.

---

#### US-1706 · Export to CSV (перенос US-1605, упрощено)
**Как** бухгалтер TSO, **я хочу** экспортировать Billing/Contracts/Nominations в CSV, **чтобы** загрузить в ERP.

| | |
|---|---|
| **Story Points** | 3 |
| **Assignee** | Frontend Dev + Backend Dev |
| **Priority** | 🟡 P1 |

**Задачи:**
- [ ] `EXP-01` Backend: `GET /api/v1/billing/export?format=csv&from=&to=` (stream CSV via `csv-stringify`)
- [ ] `EXP-02` Backend: `GET /api/v1/contracts/export?format=csv`
- [ ] `EXP-03` Backend: `GET /api/v1/nominations/export?format=csv&gas_day=`
- [ ] `EXP-04` Frontend: кнопка "📥 Export CSV" в Billing, Contracts, Nominations модулях (вызов с текущими фильтрами)
- [ ] `EXP-05` Jest тесты: ≥5 cases (CSV format, date range filter, empty result, escaping, large dataset ≥1000 rows)

**Note:** Excel/xlsx формат отложен до Sprint 18 — CSV достаточно для диплома.

**DoD:** 3 кнопки Export работают; CSV заголовки на EN; данные соответствуют фильтрам UI.

---

### Epic 4: Documentation & Diploma

#### US-1707 · UserGuide v3.4 — Final Diploma Version (перенос US-1607)
**Как** дипломант, **я хочу** финальную версию UserGuide, **чтобы** приложить к дипломной работе.

| | |
|---|---|
| **Story Points** | 4 |
| **Assignee** | Tech Lead |
| **Priority** | 🟡 P1 |

**Задачи:**
- [ ] `DOC-01` UserGuide v3.4.md: добавить секции Sprint 15 (NC consistency), Sprint 16 (capacity_kwh_h + OBA + UI cleanup), Sprint 17 (Matching + Analytics)
- [ ] `DOC-02` Обновить API section: новые endpoints (Analytics, Export, match-adjacent, matching-result, OBA)
- [ ] `DOC-03` Обновить cumulative stats: ~600 SP, ~460 tests, 19 migrations, NC 79% + Art.15 83% sub-coverage
- [ ] `DOC-04` Секция «Architecture Decisions»: NC Art.12.3 binding (shippers always balanced), `capacity_kwh_h` authoritative unit
- [ ] `DOC-05` Секция «Testing & QA»: mock/DB/CI команды, coverage stats
- [ ] `DOC-06` Генерация `.docx` из `.md` (pandoc)

**DoD:** [`GTCP_UserGuide_v3.4.md`](GTCP_UserGuide_v3.4.md) + `.docx` в [reports/](.); покрывает Sprint 1–17.

---

## Sprint Backlog Summary

| User Story | Epic | SP | Assignee | Priority | Status |
|---|---|---|---|---|---|
| US-1701 · Sprint 16 Test Coverage | Debt | 4 | QA + Backend | 🔴 P0 | 🔲 TODO |
| US-1702 · Endpoint Count Audit | Debt | 2 | Tech Lead | 🔴 P0 | 🔲 TODO |
| US-1703 · Adjacent TSO Auto-Matching | NC Art.13 | 5 | Backend | 🔴 P0 | 🔲 TODO |
| US-1704 · Double-Sided Matching Result | NC Art.13 | 3 | Backend + Frontend | 🔴 P0 | 🔲 TODO |
| US-1705 · Analytics Dashboard | Analytics | 5 | Frontend + Backend | 🟡 P1 | 🔲 TODO |
| US-1706 · Export to CSV | Analytics | 3 | Frontend + Backend | 🟡 P1 | 🔲 TODO |
| US-1707 · UserGuide v3.4 Final | Documentation | 4 | Tech Lead | 🟡 P1 | 🔲 TODO |
| **ИТОГО** | | **26 SP** | | | |

*(2 SP reserve на risks и unplanned bugs → целевая velocity 28 SP)*

---

## Отменено / не включено в Sprint 17

| US из Sprint 16 | Причина |
|---|---|
| ~~US-1603 Shipper Imbalance Charge~~ | **Отменено навсегда** — противоречит NC Art.12.3 binding rule (shippers always balanced). Замещено US-1603b OBA в Sprint 16. |
| US-1606 k6 Load Testing | Отложено в Sprint 18 — не критично для диплома (performance стенд условный, без VPS). |
| US-1609 VTP Basic | Отложено в Sprint 18+ — P2 stretch goal, полный NC Art.11 требует отдельного эпика. |
| US-1605 Excel (xlsx) export | Упрощено до CSV (US-1706). SheetJS в Sprint 18, если останется время. |

---

## Технический стек Sprint 17

### Новые файлы

```
backend/
├── src/routes/
│   └── analytics.js             ← GET /analytics/{volumes,revenue,utilization}
├── src/services/
│   └── adjacentTsoMock.js       ← Mock FGSZ/Bulgartransgaz/TRANSPORTGAS SRBIJA
├── src/db/migrations/
│   └── 019_adjacent_matching.sql ← nominations.adjacent_tso_*, matching_rule
├── tests/
│   ├── balance-oba.integration.test.js    ← US-1701 DEBT-01 (≥8 tests)
│   ├── capacity-kwh-h.dbspec.test.js      ← US-1701 (≥6 tests)
│   ├── shipper-balance.test.js            ← US-1701 (≥4 tests)
│   ├── matching-adjacent.test.js          ← US-1703 (≥12 tests)
│   ├── matching-result.test.js            ← US-1704 (≥6 tests)
│   ├── analytics.test.js                  ← US-1705 (≥6 tests)
│   └── export.test.js                     ← US-1706 (≥5 tests)
scripts/
└── count-endpoints.js           ← US-1702 DEBT-02 автосверка

reports/
├── GTCP_UserGuide_v3.4.md       ← Final diploma version
├── GTCP_UserGuide_v3.4.docx     ← Word version
└── SPRINT_17_REPORT.md          ← Закрытие Sprint 17
```

### Изменяемые файлы

```
backend/src/routes/nominations.js   ← +matchWithAdjacentTso(), +/:id/match-adjacent, +/:id/matching-result
backend/src/routes/billing.js       ← +/export endpoint (CSV stream)
backend/src/routes/contracts.js     ← +/export endpoint
backend/src/app.js                  ← +analyticsRouter
Soft/GTCP_MVP.html                  ← +Analytics tab, +Export buttons, +Matching Result panel, +Chart.js CDN
CLAUDE.md                           ← Endpoint count (DEBT-02), Sprint 17 notes
reports/GTCP_Artifacts.md           ← Sprint 17 velocity line, §14 endpoint map update
package.json                        ← +"count-endpoints" script
```

### Новые API endpoints (Sprint 17)

| # | Method | Path | Description | NC Ref |
|---|---|---|---|---|
| 100 | POST | /api/v1/nominations/:id/match-adjacent | Adjacent TSO matching | Art.13.5 |
| 101 | GET | /api/v1/nominations/:id/matching-result | Matching result detail | Art.13.3 |
| 102 | GET | /api/v1/analytics/volumes | Aggregated volumes | — |
| 103 | GET | /api/v1/analytics/revenue | Revenue breakdown | — |
| 104 | GET | /api/v1/analytics/utilization | Capacity utilization % | Art.7 |
| 105 | GET | /api/v1/billing/export | CSV billing export | — |
| 106 | GET | /api/v1/contracts/export | CSV contracts export | — |
| 107 | GET | /api/v1/nominations/export | CSV nominations export | — |

**Total API endpoints после Sprint 17: ~107** (docs; после DEBT-02 audit цифра может быть скорректирована)

---

## Sprint Events

| Событие | Дата | Время | Участники |
|---|---|---|---|
| Sprint Planning | 13.04.2026 (Пн) | 10:00–11:00 | All |
| Daily Standup | 14–23.04 (Пн–Пт) | 09:30–09:45 | All |
| Mid-Sprint Review | 20.04.2026 (Пн) | 14:00–15:00 | Backend Dev, Tech Lead |
| Sprint Review | 24.04.2026 (Пт) | 14:00–15:30 | All + Stakeholders |
| Sprint Retrospective | 24.04.2026 (Пт) | 15:30–16:00 | All |

---

## Риски Sprint 17

| # | Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|---|
| R-1 | Adjacent TSO mock не покрывает реальные edge cases (timeout, partial response) | Средняя | Среднее | Задокументировать mock поведение; оставить TODO для real FGSZ integration Sprint 18 |
| R-2 | Chart.js CDN блокируется в сети (как Turbopack в Apple Hill проекте) | Низкая | Низкое | Fallback: локальная копия Chart.js в `Soft/vendor/` |
| R-3 | Повторный scope drift — обнаружится ещё одна NC inconsistency | Средняя | Высокое | **Fresh NC review перед Sprint Planning** (обязательное действие из Sprint 16 retro) |
| R-4 | DEBT-02 endpoint audit откроет крупные расхождения с OpenAPI | Средняя | Среднее | Если расхождение >20 endpoints — отдельный эпик в Sprint 18, в Sprint 17 только baseline |
| R-5 | UserGuide v3.4 не успевает к защите | Низкая | Высокое | P0 приоритет; черновик на Mid-Sprint Review; docx к 23.04 |
| R-6 | FG sweep-скрипт затронет корректные транзитные invoice | Низкая | Среднее | Dry-run mode обязателен; проверка `flow_direction NOT IN (...)` filter в SQL перед apply; бэкап таблицы invoices |
| R-7 | FG hotfix +7 SP перегружает Sprint 17 (33 vs 28 базовая velocity) | Средняя | Среднее | FG-05 (отдельный invoice Art.20.3.5) вынесен в Sprint 18 (US-1712, 3 SP); US-1706 Export CSV при перегрузке → Sprint 18 |

---

## Definition of Done (Sprint 17)

- [ ] Все P0 US завершены (US-1701, 1702, 1703, 1704, **US-1708, US-1711**)
- [ ] NC Art.13 = 100% coverage
- [ ] Sprint 16 test debt погашен (≥18 новых тестов)
- [ ] Endpoint count audited, единое число в CLAUDE.md / Artifacts / UserGuide
- [ ] Analytics dashboard работает с real-data
- [ ] Export CSV работает для 3 модулей
- [ ] UserGuide v3.4 (.md + .docx) готов
- [ ] **FG hotfix: billing.js ограничен транзитом; migration 019 election; INV-2026-0008 fixed (FG=0, total=3 350 312,03); ≥6 FG-тестов; FG_DATA_FIX_REPORT.md**
- [ ] Jest tests: ≥466 зелёные в CI (442 baseline + 18 Sprint 16 debt + 6 FG matrix)
- [ ] Git: коммит `feat(sprint-17)` + тег `sprint-17`
- [ ] SPRINT_17_REPORT.md написан (включая FG retrospective)

---

## Epic 5: Fuel Gas Hotfix (NC Art.18 + Art.19.1.4) — P0 · добавлено 14.04.2026

**Источник обнаружения:** аудит INV-2026-0008 (NIS, `KIREVO_EXIT_SERBIA`) показал line FUEL_GAS = 74 883,91 EUR при корректном значении 0,00 EUR.

**Binding rule** (записан в [CLAUDE.md "Fuel Gas Allocation Rules"](../CLAUDE.md) + [GTCP_Artifacts.md §17](./GTCP_Artifacts.md)):

```
FG_fee > 0  ⟺  flow_direction ∈ {KIREVO_HORGOS, KIREVO_HORGOS_AND_SERBIA}
           AND  shipper.fuel_gas_election = 'CASH'
           AND  AAQ_horgos > 0
```

Обоснование: Art.18.3.3 (CS только через компрессор → только транзит к Horgoš); Art.19.1.4 (preheating только GMS-2 и GMS-3, GMS-4 Gospođinci БЕЗ preheater → domestic NIS и CR-shippers не получают аллокацию).

---

#### US-1708 · Billing Fix: FG applicable directions only (FG-01/FG-02) 🔴 P0

**Как** Billing Engineer, **я хочу** чтобы `calcFuelGas()` применялся только к транзитным маршрутам, **чтобы** domestic и CR-shippers не получали ошибочных FG-начислений.

| | |
|---|---|
| **Story Points** | 2 |
| **Assignee** | Backend Dev |
| **Priority** | 🔴 P0 |

**Задачи:**
- [ ] `FG-01.1` В [billing.js:535-568](../backend/src/routes/billing.js#L535-L568) добавить константу `FG_APPLICABLE_DIRECTIONS = ['KIREVO_HORGOS', 'KIREVO_HORGOS_AND_SERBIA']`.
- [ ] `FG-01.2` Early return `{fuelGasKwh: 0, ...}` если `!FG_APPLICABLE_DIRECTIONS.includes(resolvedDirection)`.
- [ ] `FG-02.1` Удалить fallback-ветку `estFlowKwh = cap × 24 × days × 0.85` или ограничить её только транзитными маршрутами.
- [ ] `FG-02.2` Для `KIREVO_HORGOS_AND_SERBIA`: `qSerbiaKwh = 0` всегда (domestic exit освобождён от FG).

**DoD:** Unit-тест показывает FG=0 для всех non-transit маршрутов; FG>0 для транзита при election=CASH.

---

#### US-1709 · Migration 019: shippers.fuel_gas_election (FG-03) 🟡 P1

| | |
|---|---|
| **Story Points** | 1 |
| **Assignee** | Backend Dev |
| **Priority** | 🟡 P1 |

**Задачи:**
- [ ] `FG-03.1` `ALTER TABLE shippers ADD COLUMN fuel_gas_election TEXT CHECK (fuel_gas_election IN ('IN_KIND','CASH')) DEFAULT 'CASH'`.
- [ ] `FG-03.2` Seed: Газпром (SHP-001)='CASH', NIS (SHP-002)='IN_KIND' (domestic supplier с собственным газом).
- [ ] `FG-03.3` В `calcFuelGas()` добавить проверку `shipper.fuel_gas_election === 'IN_KIND' → FG=0` (edge-case Art.18.4.2 → P3 later).
- [ ] `FG-03.4` OpenAPI: обновить schema `Shipper` + `POST /shippers` validation.

**DoD:** Миграция чистая, backfill 2 shipper'а корректный, billing использует поле.

---

#### US-1710 · AAQ-based FG (no capacity fallback) (FG-04) 🟡 P1

| | |
|---|---|
| **Story Points** | 1 |
| **Assignee** | Backend Dev |
| **Priority** | 🟡 P1 |

**Задачи:**
- [ ] `FG-04.1` `calcFuelGas()`: брать `qHorgosKwh` из `SELECT SUM(allocated_kwh_h) FROM nominations WHERE shipper_id=$1 AND period=$2 AND exit_point='HORGOS-EXIT'`.
- [ ] `FG-04.2` Early return `0` если AAQ=0 (Art.18.3 требует Allocated Quantities, не estimation).
- [ ] `FG-04.3` Удалить `cap × 0.85` fallback (или оставить только для dry-run mode за флагом).

**DoD:** Integration test: создать invoice без nominations → FG=0; с nominations → FG>0 пропорционально.

---

#### US-1711 · Data Fix INV-2026-0008 + historical sweep (FG-06/FG-07) 🔴 P0

| | |
|---|---|
| **Story Points** | 2 |
| **Assignee** | Data Engineer |
| **Priority** | 🔴 P0 |

**Задачи:**
- [ ] `FG-06.1` Обновить INV-2026-0008: `UPDATE invoice_line_items SET amount_eur=0 WHERE invoice_id=... AND line_type='FUEL_GAS'`; пересчитать `total_amount_eur = 3 350 312,03 EUR`.
- [ ] `FG-07.1` Скрипт `scripts/fix-fuel-gas-invoices.js`: идентифицировать все invoice где shipper.flow_direction ∉ {KIREVO_HORGOS, KIREVO_HORGOS_AND_SERBIA} И line_type='FUEL_GAS' И amount>0 → обнулить + пересчитать total.
- [ ] `FG-07.2` Dry-run вывод в консоль; apply после ревью.
- [ ] `FG-07.3` Отчёт в `reports/FG_DATA_FIX_REPORT.md` — сколько invoice затронуто, суммарная коррекция EUR.

**DoD:** INV-2026-0008 корректен (FG=0, total=3 350 312,03); нет исторических invoice для NIS/CR с ненулевым FG.

---

#### US-1713 · FG Test Matrix 🟡 P1

| | |
|---|---|
| **Story Points** | 1 |
| **Assignee** | QA |
| **Priority** | 🟡 P1 |

**Задачи:**
- [ ] `FG-T.1` `tests/fuel-gas.spec.test.js` — matrix:
  - KIREVO_HORGOS + CASH + AAQ>0 → FG>0 ✅
  - KIREVO_HORGOS_AND_SERBIA + CASH + AAQ_horgos>0 → FG на Q_horgos, Q_serbia zeroed ✅
  - KIREVO_EXIT_SERBIA + CASH + any AAQ → FG=0 ✅
  - HORGOS_KIREVO / EXIT_SERBIA_KIREVO / HORGOS_EXIT_SERBIA / EXIT_SERBIA_HORGOS → FG=0 ✅
  - KIREVO_HORGOS + IN_KIND → FG=0 ✅
  - KIREVO_HORGOS + CASH + AAQ=0 → FG=0 ✅
- [ ] `FG-T.2` Regression: INV-2026-0008 reproduction через POST /billing → assert FG=0.

**DoD:** ≥6 новых тестов зелёные; Jest total ≥ 466.

---

## Связи со Sprint 18

Sprint 17 разблокирует для Sprint 18:
- **Excel (xlsx) export** — SheetJS поверх US-1706 CSV base
- **k6 Load Testing** — на стабильном API после DEBT-02 audit
- **VTP Basic (Art.11)** — требует analytics baseline для balance impact
- **Real FGSZ integration** — поверх US-1703 mock интерфейса
- **Transparency Portal (Art.24)** — публичные эндпоинты из analytics
- **Diploma Final Assembly** — компиляция всех артефактов Sprint 1–17 + UserGuide v3.4

---

*Документ сформирован: 2026-04-10 · GTCP Project · Sprint 17 Planning*
*Предыдущий спринт: [SPRINT_16_REPORT.md](SPRINT_16_REPORT.md)*
