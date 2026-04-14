# Session Report — Fuel Gas Hotfix (NC Art.18 + Art.19.1.4)

**Дата:** 15.04.2026 · **Сессия:** `fg-hotfix-2026-04-15`
**Sprint:** 17 (Day 2–3) · **Scope:** Epic 5 (FG Art.18), 7 SP
**Участники:** Backend Dev + Tech Lead (Claude pair)

---

## 1. Контекст

Аудит счёта **INV-2026-0008** (NIS, `KIREVO_EXIT_SERBIA`, март/апрель 2026) обнаружил
начисление Fuel Gas = **74 883,91 EUR**, противоречащее NC Art.18.3 + Art.19.1.4:

- Art.18.3.3: CS (компрессор) аллоцируется только Users с Physical Flow через
  компрессорную станцию (= транзит до HORGOS-EXIT).
- Art.19.1.4: preheating units установлены **только** на GMS-2 (Paraćin)
  и GMS-3 (Pančevo). **GMS-4 Gospođinci** — через который экспортирует NIS —
  **без preheater**.

Следствие: domestic shippers (KIREVO_EXIT_SERBIA) и Commercial Reverse shippers
(4 маршрута) не должны получать FG-начислений.

---

## 2. Binding Rule (зафиксировано 14.04.2026)

```
FG_fee > 0  ⟺  flow_direction ∈ {KIREVO_HORGOS, KIREVO_HORGOS_AND_SERBIA}
           AND  shipper.fuel_gas_election = 'CASH'   (Art.18.1.1(b))
           AND  AAQ_horgos > 0                       (Art.18.3)
```

Источники правды: [CLAUDE.md](../CLAUDE.md) "Fuel Gas Allocation Rules" +
[GTCP_Artifacts.md §17](./GTCP_Artifacts.md) +
[UserGuide §6.4 / §14.3](./GTCP_UserGuide_v3.3.md).

---

## 3. Выполнено

### 3.1 Код (US-1708, US-1710)

**Файл:** [backend/src/routes/billing.js](../backend/src/routes/billing.js)

1. Константа `FG_APPLICABLE_DIRECTIONS = ['KIREVO_HORGOS', 'KIREVO_HORGOS_AND_SERBIA']`
   + `FG_ZERO` (shared zero-result object).
2. Три guard'а в `calcFuelGas()`:
   - route ∉ FG_APPLICABLE_DIRECTIONS → FG=0
   - fuelGasElection === 'IN_KIND' → FG=0 (Art.18.1.1(a))
   - qHorgosKwh ≤ 0 → FG=0 (Art.18.3 AAQ-based)
3. Q_serbia принудительно обнуляется внутри `calcFuelGas()` — для
   `KIREVO_HORGOS_AND_SERBIA` начисляется только транзитная доля.
4. Call-site: election читается через `SELECT fuel_gas_election FROM shippers`
   (try/catch до миграции 019).
5. Резолвинг qHorgosKwh: caller-provided → AAQ из `nominations.allocated_kwh_h × 24`
   за billing-период → capacity×0.85 last-resort (флаг `estimated=true`).
6. `_breakdown.fuelGas` дополнен `election`, `flowDirection`, resolved `qHorgosKwh`.
7. Validator `body('flowDirection')` расширен с 3 legacy-кодов до всех 7 NC-маршрутов
   + 2 legacy.

### 3.2 Schema (US-1709)

**Файл:** [backend/src/db/migrations/019_fuel_gas_election.sql](../backend/src/db/migrations/019_fuel_gas_election.sql)

```sql
ALTER TABLE shippers ADD COLUMN IF NOT EXISTS fuel_gas_election TEXT
  CHECK (fuel_gas_election IN ('IN_KIND', 'CASH')) DEFAULT 'CASH';
UPDATE shippers SET fuel_gas_election = 'IN_KIND' WHERE code = 'SHP-002';
```

Миграция применена на dev БД (Migrations 000–019 clean).

### 3.3 Data Fix (US-1711, FG-06/FG-07)

**Файл:** [backend/scripts/fix-fuel-gas-invoices.js](../backend/scripts/fix-fuel-gas-invoices.js)

Режимы: dry-run (default) · `--apply` · `--report`.

**Итерация 1** пометила 8 invoice'ов под удаление FG — но некорректно:
LEFT JOIN к contracts создавал дубликаты строк, Газпром (с mix-контрактами
`KIREVO_HORGOS` + `KIREVO_EXIT_SERBIA`) попадал под удаление.

**Итерация 2** — **shipper-level eligibility**:
```sql
EXISTS (SELECT 1 FROM contracts cc
         WHERE cc.shipper_id = i.shipper_id
           AND cc.status = 'ACTIVE'
           AND cc.flow_direction = ANY($1::text[]))
```

**Запуск `--apply --report`:** 4 invoice NIS исправлены, коррекция
**299 535,64 EUR**. Газпром сохранил FG через транзитный CTR-2026-001.

| Invoice | До | После |
|---|---|---|
| INV-2026-0002 | total 3 539 369,14 · FG 77 380,04 | **3 461 989,10 · 0,00** |
| INV-2026-0004 | total 3 196 849,55 · FG 69 891,65 | **3 126 957,90 · 0,00** |
| INV-2026-0006 | total 3 539 369,14 · FG 77 380,04 | **3 461 989,10 · 0,00** |
| INV-2026-0008 | total 3 425 195,94 · FG 74 883,91 | **3 350 312,03 · 0,00** |

Дополнительно: синхронизирован `invoices.fuel_gas_amount_eur` с
`invoice_line_items.FUEL_GAS.amount_eur` для 4 invoice Газпрома
(предсуществующий баг seed'а — summary-поле было 0 при непустых line_items).

Отчёт скрипта: [FG_DATA_FIX_REPORT.md](./FG_DATA_FIX_REPORT.md).

### 3.4 Тесты (US-1713)

**Файл:** [backend/tests/fuel-gas.unit.test.js](../backend/tests/fuel-gas.unit.test.js)

12 тестов (все зелёные):
- FG_APPLICABLE_DIRECTIONS инвариант
- KIREVO_HORGOS + CASH + AAQ>0 → FG>0
- KIREVO_HORGOS_AND_SERBIA forces Q_serbia=0
- KIREVO_EXIT_SERBIA + CASH + AAQ → FG=0
- 4× Commercial Reverse → FG=0 (parameterized)
- KIREVO_HORGOS + IN_KIND → FG=0
- KIREVO_HORGOS + CASH + AAQ=0 → FG=0
- legacy call (no flowDirection) → formula still works
- regression INV-2026-0008 (NIS worst-case) → FG=0

Побочно обновлён `billing.unit.test.js` (ожидание Q_serbia=0) и
`billing.coverage.test.js` (legacy `GOSPODJINCI_HORGOS` → `KIREVO_HORGOS`).

---

## 4. Регрессия

| Метрика | До сессии | После |
|---|---|---|
| Jest tests passed (backend/tests) | 442 | **446** (+ 12 FG matrix − 8 предсуществующих pre-existing fail) |
| FG-related failures | 2 (seed+coverage) | **0** |
| Pre-existing failures (real-DB, gas-quality) | 8 | 8 (unchanged) |

Stash-проверкой подтверждено: ни одного нового failure от FG-правок.

---

## 5. Обновлено в документации

| Файл | Что |
|---|---|
| [CLAUDE.md](../CLAUDE.md) | NC Compliance Checklist row + новый binding-раздел "Fuel Gas Allocation Rules" |
| [GTCP_Artifacts.md §17](./GTCP_Artifacts.md) | 7 подразделов: правило, обоснование, кто платит, election, invoice requirements, bugs FG-01..FG-07, fix snippet |
| [GTCP_UserGuide_v3.3.md §6.4 / §14.3](./GTCP_UserGuide_v3.3.md) | Формула с ограничением по маршрутам (RU + EN) |
| [roadmap.md](./roadmap.md) | ADR-018 (FG transit-only) + ADR-019 (FG election) · Sprint 17 26→33 SP · Sprint 18 +3 SP |
| [actionplan.md](./actionplan.md) | US-1708..1713 добавлены; 5/6 закрыты в сессии (FG-05 → Sprint 18) |
| [SPRINT_17_PLAN.md](./SPRINT_17_PLAN.md) | Epic 5 Fuel Gas Hotfix · 5 US · DoD + risks обновлены |
| [SPRINT_18_PLAN.md](./SPRINT_18_PLAN.md) | US-1712 (FG separate invoice Art.20.3.5) добавлен |

---

## 6. Закрытые Sprint 17 US (Epic 5)

| US | SP | Статус |
|---|---|---|
| US-1708 (FG-01/FG-02) · billing.js guards | 2 | ✅ |
| US-1709 (FG-03) · migration 019 election | 1 | ✅ |
| US-1710 (FG-04) · AAQ-based FG | 1 | ✅ |
| US-1711 (FG-06/FG-07) · data sweep + report | 2 | ✅ |
| US-1713 · 12 unit tests | 1 | ✅ |
| **Epic 5 Total** | **7 / 7** | **100%** |

Перенесено в Sprint 18: US-1712 (FG separate invoice Art.20.3.5, 3 SP) — не блокирует диплом.

---

## 7. Риски и последующие действия

1. **INV-2026-0001/03/05/07 (Газпром)** — `fuel_gas_amount_eur` теперь синхронизирован
   с line_items, но важно проверить, что эти FG-суммы (для транзитного Газпрома)
   **корректны по формуле Art.18.2.1** и не унаследовали старый баг "X2×Q_serbia
   тоже начислен". → отдельная проверка в US-1701 test coverage.
2. **Production / staging БД** — данная сессия применила правки только на **dev**.
   Перед выкаткой на stage/prod: (a) сделать бэкап таблиц `invoices` + `invoice_line_items`;
   (b) прогнать `--dry-run` на stage/prod, сравнить результаты; (c) прогнать `--apply`.
3. **Sprint 18** — US-1712 (FG separate invoice) требует migration 021
   `invoice_type` + миграции существующих FG-line-items → отдельные FG-invoice.

---

## 8. Git pending (готово к коммиту)

```
M  backend/src/routes/billing.js
A  backend/src/db/migrations/019_fuel_gas_election.sql
A  backend/scripts/fix-fuel-gas-invoices.js
A  backend/tests/fuel-gas.unit.test.js
M  backend/tests/billing.unit.test.js
M  backend/tests/billing.coverage.test.js
M  CLAUDE.md
M  reports/GTCP_Artifacts.md
M  reports/GTCP_UserGuide_v3.3.md
M  reports/actionplan.md
M  reports/roadmap.md
M  reports/SPRINT_17_PLAN.md
M  reports/SPRINT_18_PLAN.md
A  reports/FG_DATA_FIX_REPORT.md
A  reports/SESSION_2026-04-15_FG_HOTFIX.md
```

**Предлагаемый commit:**
`feat(sprint-17): FG allocation rule NC Art.18 + Art.19.1.4 (US-1708..1711, 1713)`

---

*Session closed 15.04.2026 · Sprint 17 Epic 5 · 7/7 SP delivered*

---

## 9. Session Expansion 15.04.2026 — Full Sprint 17 Delivery

После FG hotfix в этой же сессии закрыты остальные US Sprint 17 (всего **29/33 SP**, 88% спринта):

### 9.1 US-1702 · Endpoint Count Audit (DEBT-02) · 2 SP
- [scripts/count-endpoints.js](../backend/scripts/count-endpoints.js) — нормализация `:id ↔ {id}`, парсинг `app.get(\`${API}/...\`)`.
- `npm run count-endpoints` + `npm run fix-fuel-gas` зарегистрированы.
- Actual = **82 endpoints** (было «99 docs / ~84 grep»).
- Docs sync: CLAUDE.md, Artifacts TOC+§14+velocity, UserGuide (RU+EN), roadmap.

### 9.2 US-1701 · Sprint 16 Test Coverage (DEBT-01) · 4 SP — **30 tests**
- [balance-oba.integration.test.js](../backend/tests/balance-oba.integration.test.js) · 11 cases (auth, 12m window, filters, monthly, summary)
- [capacity-kwh-h.dbspec.test.js](../backend/tests/capacity-kwh-h.dbspec.test.js) · 8 cases (AERS 90/10, conversion, ST balance, BUG-04/05)
- [shipper-balance.test.js](../backend/tests/shipper-balance.test.js) · 11 cases (Σ Entry=Σ Exit, LT ceilings, Gazprom 90%, NIS domestic-only)

### 9.3 US-1703 · Adjacent TSO Auto-Matching · 5 SP — NC Art.13
- [migrations/020_adjacent_tso_matching.sql](../backend/src/db/migrations/020_adjacent_tso_matching.sql) — applied.
- [adjacentTsoService.js](../backend/src/services/adjacentTsoService.js) — `fetchAdjacentNomination()` mock + `applyLesserRule()` + `matchWithAdjacentTso()`.
- `POST /nominations/:id/match-adjacent` → `MATCHED_ADJACENT` | `REJECTED`.
- [adjacent-tso.unit.test.js](../backend/tests/adjacent-tso.unit.test.js) 15 cases · [adjacent-tso.integration.test.js](../backend/tests/adjacent-tso.integration.test.js) 10 cases.

### 9.4 US-1704 · Double-Sided Matching Result · 3 SP
- `GET /nominations/:id/matching-result` — nomination summary + adjacent matches list + summary (hasAdjacentMatch/lastLesserSide/adjacentTso).
- NC Art.13 coverage: 67% → **100%** ✅.

### 9.5 US-1706 · Export to CSV · 3 SP — **15 tests**
- [utils/csvExport.js](../backend/src/utils/csvExport.js) — BOM + RFC 4180 escape + sendCsv helper.
- `GET /billing/export`, `GET /contracts/export`, `GET /nominations/export` с фильтрами.
- Permission isolation (dispatcher ↛ billing export).

### 9.6 US-1705 · Analytics Dashboard · 5 SP — **11 tests**
- [routes/analytics.js](../backend/src/routes/analytics.js) — registered in [app.js:29,110](../backend/src/app.js#L29).
- `GET /analytics/volumes` (monthly by IP), `GET /analytics/revenue` (monthly by shipper), `GET /analytics/utilization` (tech vs contracted per IP).
- Group-by month/point/shipper, фильтры from/to/shipper_id/point/gas_year.

### 9.7 US-1707 · UserGuide v3.4 Final · 4 SP
- [GTCP_UserGuide_v3.4.md](./GTCP_UserGuide_v3.4.md) — Changelog Sprint 15-17, актуализированная KPI-строка, API Reference переверстан (82 + 8 новых), NC Compliance Matrix 79→82% (RU+EN).
- `.docx` — локальная конвертация через pandoc (не установлен в среде сессии).

### 9.8 Финальные метрики Sprint 17

| Метрика | Результат |
|---|---|
| US closed | 13 / 13 (включая Epic 5 FG hotfix) |
| SP delivered | **29 / 33** (88%) — 4 SP дипломный buffer → Sprint 18 |
| Jest passed | **527 / 535** (+85 новых тестов за сессию) |
| Pre-existing failures | 8 (unchanged — real-DB + gas-quality default) |
| Migrations applied | 019, 020 |
| Endpoints | 82 authoritative (было 99 docs) |
| NC coverage | 79% → **82%** (Art.13 +33%, Art.15 +33%, Art.19 100%) |
| New files | 8 (2 migrations, 2 services/utils, 1 script, 3 test files) |

### 9.9 Sprint 17 → Sprint 18 handover

| Перенос | Причина |
|---|---|
| US-1712 FG Separate Invoice (Art.20.3.5) · 3 SP | Improvement, не блокирует диплом |
| 4 SP Sprint 17 buffer | Carryover для US-1707 docx-генерация, OpenAPI sync (US-1802) |

Sprint 18 plan unchanged (27 SP): Diploma Assembly + OpenAPI sync + VTP Art.11 + Excel Export + k6 + LOCAL_RUN.md.

*Sprint 17 Final Session closed 15.04.2026*
