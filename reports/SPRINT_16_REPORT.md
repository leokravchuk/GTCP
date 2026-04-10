# GTCP — Sprint 16 Report (Retrospective Close)
**Gas Trading & Commercial Platform · NC Art.15 re-interpretation + capacity_kwh_h + UI cleanup**

---

## Overview

| Параметр | Значение |
|---|---|
| **Sprint** | Sprint 16 |
| **Период** | 06.04.2026 — 10.04.2026 (закрыт раньше срока) |
| **Planned velocity** | 35 SP (9 US) |
| **Actual velocity** | ~13 SP (3 US, из них 1 из оригинального плана, 2 незапланированных) |
| **Sprint Goal (план)** | NC compliance 79% → 87%+, analytics, exports, UserGuide v3.4, k6 |
| **Sprint Goal (факт)** | NC Art.15 переинтерпретирован, capacity_kwh_h как authoritative unit, UI/data cleanup |
| **Статус** | ✅ CLOSED (RESCOPED) |

---

## Что изменилось vs SPRINT_16_PLAN.md

Исходный план от 06.04 (P0 = Adjacent TSO Matching, Shipper Imbalance Charge) **был отменён** после пересмотра NC Art.12.3 / Art.15 в ходе спринта. Приоритеты перестроились вокруг двух открытий:

1. **NC Art.12.3 binding rule:** шипперы всегда сбалансированы (`nominated = allocated = matched`). Это отменяет всю логику per-shipper imbalance charge (US-1603 в оригинальной трактовке).
2. **АЕРС 05-145 unit mismatch:** тарифы в EUR/kWh/h, но `capacity_bookings` хранит `capacity_mwh_d`. Runtime conversions `× 1000 / 24` приводили к ошибкам округления и unit-mismatch в over-nomination (BUG-04/05).

Новая трактовка зафиксирована в [CLAUDE.md](../CLAUDE.md) как binding rule и в [GTCP_Artifacts.md §16](GTCP_Artifacts.md#16-balancing--oba).

---

## ✅ Выполнено (факт)

### US-1603b · OBA Settlement (TSO-to-TSO) — НЕ был в плане, 5 SP
**Замена оригинального US-1603.** NC Art.15 теперь делится на два scope:

- **Level 1 (shipper):** Δ=0 by design, enforced в `nominations.js` (`UPDATE SET allocated_kwh_h = matched_kwh_h`)
- **Level 2 (TSO-to-TSO):** OBA между соседними TSO (Bulgartransgaz / FGSZ / TRANSPORTGAS SRBIJA), read-only informational

**Артефакты:**
- ✅ Migration 018: [`backend/src/db/migrations/018_oba_imbalances.sql`](../backend/src/db/migrations/018_oba_imbalances.sql)
  - `oba_daily_imbalances` таблица с `total_imbalance_kwh` (GENERATED column)
  - `nominations.allocated_kwh_h` column + backfill `allocated = volume_kwh_h`
  - 3 индекса (`gas_day`, `point_code`, `adjacent_tso`)
- ✅ Seed: 1098 mock records (366 дней × 3 точки × 12 месяцев), breakdown 70% metering / 20% linepack / 10% GCV, variance ±0.2%
- ✅ 3 новых endpoints в [`backend/src/routes/balance.js`](../backend/src/routes/balance.js):
  - `GET /api/v1/balance/oba/daily` — фильтруемые daily records, 12-month rolling window
  - `GET /api/v1/balance/oba/monthly/:month` — monthly aggregation per point/TSO
  - `GET /api/v1/balance/oba/summary` — 12-month KPI summary
- ✅ UI: OBA Settlement section на Balance page в [`Soft/GTCP_MVP.html`](../Soft/GTCP_MVP.html) (25 упоминаний `oba`, 3 summary-карточки KIREVO/HORGOS/SERBIA, daily table с фильтрами)

**NC coverage Art.15:** 50% → **83%** (2/3 применимых sub-articles; Art.15.8 Balancing Neutrality — N/A).

---

### Незапланированный блок · capacity_kwh_h migration (09.04), ~5 SP
Приводит модель данных в соответствие с АЕРС (EUR/kWh/h) без runtime конверсий.

- ✅ Migration 017: [`backend/src/db/migrations/017_capacity_kwh_h.sql`](../backend/src/db/migrations/017_capacity_kwh_h.sql) — `capacity_bookings.capacity_kwh_h NUMERIC(18,2)` как native unit
- ✅ Backfill: `capacity_kwh_h = capacity_mwh_d × 1000 / 24` для исторических записей
- ✅ 12 runtime conversions заменены на прямое чтение `capacity_kwh_h` в 6 файлах (`billing.js`, `nominations.js`, `capacity.js`, `contracts.js`, `auctions.js`, `reservePrices.js`)
- ✅ `capacity_mwh_d` сохранён для backward compatibility (DEPRECATED, не использовать в новом коде)
- ✅ Bug fix: `nominations.js` over-nomination check теперь корректно сравнивает `nominated_kwh_h` с `contracted_kwh_h` в одних единицах (BUG-04 / BUG-05)
- ✅ Session log: [`reports/session-sprint16-capacity-kwh-h-2026-04-09.md`](session-sprint16-capacity-kwh-h-2026-04-09.md)

### LT Booking Rules — binding (зафиксировано 09.04)
| Rule | Значение | Источник |
|---|---|---|
| Газпром HORGOS-EXIT = 90% Tech | 9,216,209 kWh/h (не выше) | Final Exemption Act + NC Art.7.1.2 |
| LT total per IP ≤ 90% Tech | Газпром + NIS combined | АЕРС 90/10 split |
| ST = 10% fully free | No ST pre-bookings | NC Art.7.1.1 |
| Shipper balance Σ Entry = Σ Exit | Per shipper | NC Art.12.3 |

Seed данные приведены в соответствие: Газпром `KIREVO 9,752,230 = HORGOS 9,216,209 + SERBIA 536,021`, NIS `KIREVO 4,000,209 = SERBIA 4,000,209`.

---

### Незапланированный блок · UI + Data Cleanup (10.04), ~3 SP
- ✅ Billing tariff SQL: `reserve_prices.tariff_eur` → `price_eur` (реальное имя колонки), contract_type mapping `FIRM → FIRM_YEARLY`
- ✅ Contracts UI: использует `capEntryKwhH` / `capExitKwhH` + AERS lookup по `flow_direction` (раньше было bundled)
- ✅ Credit modal: NC Art.5.1.6 exempt rule — rated shippers (Газпром BBB-) отображаются как «ОСВОБОЖДЁН» вместо minimum
- ✅ Gas quality UI: корректные имена колонок `wobbe_kwh_nm3`, `methane_pct`, `density_kg_nm3`
- ✅ Billing table: `total_amount_eur`, `line_items_count`, `due_date` вместо legacy `volume × tariff`
- ✅ Data cleanup: 7 stale invoices + 3 orphan ST contracts удалены
- ✅ 8 monthly invoices Jan-Apr 2026 сгенерированы из чистой базы

---

## ❌ НЕ сделано (перенесено в Sprint 17)

| US | Причина | Куда перенесено |
|---|---|---|
| **US-1601** Adjacent TSO Auto-Matching | Времени нет после pivot на OBA. Mock-интерфейс FGSZ/Bulgartransgaz не начат | Sprint 17 · Epic NC Art.13 |
| **US-1602** Double-Sided Matching Result | Зависит от US-1601 | Sprint 17 · Epic NC Art.13 |
| ~~**US-1603** Shipper Imbalance Charge~~ | **ОТМЕНЕНО** — противоречит NC Art.12.3 (shippers always balanced) | ❌ Закрыто навсегда. Binding rule в CLAUDE.md: «DO NOT add shipper imbalance charge calculation» |
| **US-1604** Analytics Dashboard | Времени нет | Sprint 17 · Epic Analytics |
| **US-1605** Export CSV/Excel | Времени нет | Sprint 17 · Epic Analytics |
| **US-1606** k6 Load Testing | Времени нет | Sprint 17 · Epic Performance |
| **US-1607** UserGuide v3.4 | v3.3 остаётся актуальной; v3.4 будет включать Sprint 16–17 | Sprint 17 · Epic Documentation |
| **US-1608** Artifacts + CLAUDE.md update | ⚠️ Частично — CLAUDE.md обновлён (binding rules), endpoint count не сверен | Закрывается этим отчётом |
| **US-1609** VTP Basic | P2 stretch goal, не критично для диплома | Sprint 18+ (depends on Art.11) |

---

## Метрики Sprint 16

| Метрика | План | Факт |
|---|---|---|
| Story Points | 35 | ~13 (37%) |
| Новых migrations | 1 (016) | 2 (017, 018) |
| Новых endpoints | +12 (до 108) | +3 OBA |
| Total endpoints (docs) | 108 | 99 (incremental: 96 + 3) |
| Total endpoints (actual grep) | — | **84** (drift from docs: −15, reconcile в Sprint 17) |
| Новых тестов | +48 (до 490+) | 0 новых (надо добавить OBA + capacity_kwh_h тесты в Sprint 17) |
| Bug fixes | — | +2 (BUG-04/05 over-nomination) |
| Bugs created | — | 0 |
| NC Art.15 coverage | 50% → 75% | 50% → 83% (пересмотр scope) |
| NC overall coverage | 79% → 87% | 79% (Art.15 переинтерпретирован, Art.13 не тронут) |

---

## Ретроспектива

### Что прошло хорошо
- **Binding rule discovery:** Pivot на NC Art.12.3 (shippers always balanced) поймал fundamental architectural mistake до того, как US-1603 начал писать imbalance charge таблицы.
- **Migration 017 (capacity_kwh_h):** Устранил 12 runtime конверсий одним заходом + поймал BUG-04/05. Чистый win.
- **UI cleanup:** Замена legacy SQL (`tariff_eur`) на реальные колонки устранила тихие ошибки в Billing и Contracts модулях.
- **Data consistency:** Сида теперь соответствует LT Booking Rules (Σ Entry = Σ Exit per shipper), Газпром HORGOS = 90% Tech.

### Что можно улучшить
- **Scope discipline.** Оригинальный план (35 SP, 9 US) был слишком амбициозным для короткого спринта. Реально сделали ~13 SP.
- **Тесты отстают.** OBA endpoints и migration 017 не покрыты Jest тестами. Должно быть +15 тестов как минимум.
- **Endpoint count drift:** В [GTCP_Artifacts.md](GTCP_Artifacts.md) указано 93/96 endpoints, в CLAUDE.md — 96, фактически по grep — 84. Нужен аудит в Sprint 17.
- **NC re-interpretation должна происходить до sprint planning**, а не в середине. Sprint 16 Plan от 06.04 был уже устаревшим к 10.04.

### Действия на Sprint 17
1. Перенести US-1601, US-1602, US-1604, US-1605, US-1606, US-1607 (см. [SPRINT_17_PLAN.md](SPRINT_17_PLAN.md))
2. **Добавить тесты** для OBA endpoints (≥8) и capacity_kwh_h invariants (≥6)
3. **Endpoint audit:** сверить `openapi.yaml` + `app.js` с grep-счётом, обновить единый счётчик
4. **Fresh NC review перед Sprint 17 planning** — чтобы не повторить pivot

---

## Связи со Sprint 17

Sprint 17 разблокируется следующим:
- **NC Art.15 closed** — balancing scope финализирован
- **capacity_kwh_h authoritative** — новый код должен использовать только kWh/h
- **LT Booking Rules** зафиксированы — новые тесты могут полагаться на invariants
- **Billing/Contracts UI работают на реальных колонках** — Analytics dashboard может строиться поверх

Sprint 17 фокус: NC Art.13 Matching (US-1601/1602), Analytics (US-1604/1605), UserGuide v3.4, тесты для Sprint 16 deliverables.

---

## Definition of Done (фактический)

- [x] Migration 017 `capacity_kwh_h` применена на `gtcp` и `gtcp_test`
- [x] Migration 018 `oba_daily_imbalances` применена + 1098 seed records
- [x] 3 OBA endpoints работают и возвращают данные
- [x] OBA UI section видна на Balance page
- [x] CLAUDE.md обновлён: OBA binding rule, LT Booking Rules, capacity_kwh_h note
- [x] [GTCP_Artifacts.md §16 Balancing & OBA](GTCP_Artifacts.md#16-balancing--oba) написан
- [x] [SPRINT_16_REPORT.md](SPRINT_16_REPORT.md) (этот документ)
- [x] [SPRINT_17_PLAN.md](SPRINT_17_PLAN.md) с перенесёнными US
- [ ] **Jest tests для Sprint 16 deliverables** — перенос в Sprint 17 (DEBT-01)
- [ ] **Endpoint count audit** — перенос в Sprint 17 (DEBT-02)
- [ ] **UserGuide v3.4** — перенос в Sprint 17 (US-1607)

---

*Документ сформирован ретроспективно: 2026-04-10 · GTCP Project · Sprint 16 Closed*
