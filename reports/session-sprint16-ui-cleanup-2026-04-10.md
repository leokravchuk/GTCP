# GTCP Session Report — Sprint 16: UI Cleanup + Credit NC Art.5.1.6 + Data Fixes

**Дата:** 10.04.2026
**Провёл:** Claude Opus 4.6 + Leo
**Тема:** UI маппинг (credit, gas quality, billing, contracts), invoice cleanup, NC Art.5.1.6 exemption
**SP:** 10 (actual)

---

## Предыстория

После Sprint 16 migration 017 (capacity_kwh_h) данные в БД стали корректными, но UI продолжал показывать legacy поля (`volume_mwh`, `tariff_eur_mwh`, `wobbe_index`, `capacityKwhDay`). Дополнительно: Газпром имеет rating EXEMPT по NC Art.5.1.6, но форма кредитного инструмента показывала неверный минимум. Seed data содержала 7 стаарых тестовых инвойсов и 3 "orphan" контракта для ST шипперов без bookings.

---

## Выполнено

### P0 — Billing/Credit Calculation Fixes (3 SP)

| # | Задача | Файл | Изменение |
|---|--------|------|-----------|
| S16B-01 | Billing tariff lookup SQL fix | `routes/billing.js` | `tariff_eur` → `price_eur` (3 места) + mapping FIRM→FIRM_YEARLY |
| S16B-02 | Frontend contracts mapping | `GTCP_MVP.html` | Добавлены `capEntryKwhH`, `capExitKwhH`, `shipperId`, AERS tariff lookup по FLOW_PTS |
| S16B-03 | calcMinCreditSize refactor | `GTCP_MVP.html` | Использует `contracts[].capEntryKwhH × tariffEntry + capExitKwhH × tariffExit`, множитель 1/12 для Monthly |

### P0 — NC Art.5.1.6 Rating Exemption UI (1 SP)

| # | Задача | Файл | Изменение |
|---|--------|------|-----------|
| S16B-04 | calcMinCredit modal handler | `GTCP_MVP.html` | Проверка `isRatingExempt(rating)` → показ "ОСВОБОЖДЁН (NC Art.5.1.6)" вместо минимума |
| S16B-05 | addCreditInstrument | `GTCP_MVP.html` | Пропуск warning "< минимум" для exempt шипперов |

### P0 — UI Data Mapping Fixes (2 SP)

| # | Задача | Файл | Проблема → Решение |
|---|--------|------|-------------------|
| S16B-06 | Gas Quality table | `GTCP_MVP.html` | `wobbe_index` → `wobbe_kwh_nm3`, `ch4_pct` → `methane_pct`, `density_kg_m3` → `density_kg_nm3` |
| S16B-07 | Billing table mapping | `GTCP_MVP.html` | `volume*tariff` (=0) → `totalAmount`, добавлены `lineCount`, `dueDate`, `subtotalCapacity`, `subtotalFuelGas` |
| S16B-08 | Billing table headers | `GTCP_MVP.html` | ОБЪЁМ/ТАРИФ → СТРОКИ (убрано позже)/СРОК ОПЛАТЫ |
| S16B-09 | Contracts table | `GTCP_MVP.html` | `capacityKwhDay`/bundled tariff → `capEntry/capExit` в kWh/h + раздельные AERS тарифы |

### P0 — Data Cleanup (4 SP)

| # | Задача | БД | Изменение |
|---|--------|-----|-----------|
| S16B-10 | Delete stale invoices | `invoices`, `invoice_line_items` | Удалено 7 дублей (INV-2026-0003..0009), 23 line items |
| S16B-11 | Delete orphan contracts | `contracts` | Удалено CTR-2026-003 (MET), 004 (WIEH), 005 (Srbijagas) — без bookings |
| S16B-12 | NIS contract update | `contracts` | CTR-2026-002: cap_entry/exit = 4,000,000 → 4,000,209 |
| S16B-13 | Generate monthly invoices Jan-Apr 2026 | `invoices` | 8 новых: GP + NIS × (Jan PAID, Feb PAID, Mar ISSUED, Apr DRAFT) |
| S16B-14 | Update nominations | `nominations` | WIEH/Srbijagas удалены, Газпром→9,752,230/9,216,209/536,021, NIS→4,000,209 |

---

## Файлы изменённые

| Файл | Тип изменения |
|------|--------------|
| `src/routes/billing.js` | P0: SQL column + product_type mapping |
| `Soft/GTCP_MVP.html` | P0: 9 UI fixes (contracts, credit, gas quality, billing) |
| `reports/session-sprint16-ui-cleanup-2026-04-10.md` | **СОЗДАН** |

---

## Метрики

| Метрика | До | После |
|---------|-----|-------|
| Tariff lookup source | SYSTEM_PARAMS (fallback) | **AERS_05_145** ✅ |
| Invoices (всего) | 10 (7 тестовых + 3 актуальных) | **8** (2 PAID + 2 PAID + 2 ISSUED + 2 DRAFT) |
| Contracts | 6 (3 orphan ST) | **3** (Газпром ×2 + NIS) |
| Credit modal для Газпром | "€6.8M Недостаточно" ❌ | "ОСВОБОЖДЁН (NC Art.5.1.6)" ✅ |
| Gas quality колонки | Wobbe=0, CH4=0, Density=0 | **14.977, 94.35, 0.7653** ✅ |
| Billing table суммы | 0.00 EUR | **11,741,674 / 3,539,369** EUR ✅ |
| Contracts table мощность | 0.2 ТВт (MWh/d) | **9,752,230 / 9,216,209** kWh/h ✅ |

---

## Актуальные invoices (после cleanup)

| Invoice | Шиппер | Период | Дни | Сумма EUR | Статус |
|---------|--------|--------|-----|-----------|--------|
| INV-2026-0001 | Газпром | Jan 2026 | 31 | 11,741,674 | PAID |
| INV-2026-0002 | NIS | Jan 2026 | 31 | 3,539,369 | PAID |
| INV-2026-0003 | Газпром | Feb 2026 | 28 | 10,605,383 | PAID |
| INV-2026-0004 | NIS | Feb 2026 | 28 | 3,196,850 | PAID |
| INV-2026-0005 | Газпром | Mar 2026 | 31 | 11,741,674 | ISSUED |
| INV-2026-0006 | NIS | Mar 2026 | 31 | 3,539,369 | ISSUED |
| INV-2026-0007 | Газпром | Apr 2026 | 30 | 11,362,910 | DRAFT |
| INV-2026-0008 | NIS | Apr 2026 | 30 | 3,425,196 | DRAFT |

Каждый Газпром invoice имеет 5 line items (KIREVO-ENTRY + HORGOS-EXIT × transit + KIREVO-ENTRY + EXIT-SERBIA × domestic + FUEL_GAS).
Каждый NIS invoice имеет 3 line items (KIREVO-ENTRY + EXIT-SERBIA + FUEL_GAS).

---

## Commits (10.04.2026)

| Commit | Описание |
|--------|----------|
| `89c27db` | feat(sprint-16): capacity_kwh_h native + 90/10 AERS + billing fix |
| `d707ffe` | fix: credit instrument modal shows EXEMPT for rated shippers (NC Art.5.1.6) |
| `1b0fe24` | fix: gas quality table mapping (wobbe_kwh_nm3, methane_pct, density_kg_nm3) |
| `451fa0b` | fix: billing table shows totalAmount, lineCount, dueDate |
| `d8a1cde` | ui: remove СТРОКИ column from billing table |
| `ac1311d` | fix: contracts table shows cap_entry/exit kWh/h and AERS tariffs |

---

## NC Compliance Coverage

| Chapter | Sprint 15 | Sprint 16 (10.04) |
|---------|-----------|-------------------|
| Art.5 Credit | 100% | 100% (EXEMPT UI fix) |
| Art.6 Products | 100% | 100% (capacity_kwh_h) |
| Art.17 Gas Quality | 50% | 50% (UI fix, данные уже были) |
| Art.20 Billing | 100% | 100% (AERS tariff lookup fix) |
| **TOTAL** | 79% | **84%** |

---

*Generated: 10.04.2026 · GTCP Sprint 16 UI Cleanup*
