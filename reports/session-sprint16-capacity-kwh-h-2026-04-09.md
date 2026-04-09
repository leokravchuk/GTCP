# GTCP Session Report — Sprint 16: capacity_kwh_h Native Column

**Дата:** 09.04.2026
**Провёл:** Claude Opus 4.6 + Leo
**Тема:** Устранение расхождения АЕРС kWh/h, миграция 017, баг-фикс over-nomination
**SP:** 8 (plan) / 8 (actual)

---

## Предыстория

Анализ мощностей (06.04.2026) выявил расхождение между данными в БД и АЕРС:
- KIREVO-ENTRY LT: 13,752,458 vs 13,752,230 (+228, 0.002%)
- EXIT-SERBIA LT: 4,536,208 vs 4,536,021 (+187, 0.004%)

Причина: `capacity_bookings` хранит `capacity_mwh_d` (MWh/сутки), все 12 мест в коде конвертируют `× 1000 / 24` в runtime → погрешность округления.

Также обнаружен **баг в nominations.js (строки 453, 489)**: over-nomination сравнивает `SUM(capacity_mwh_d)` (MWh/d) с `volume_kwh_h` (kWh/h) — несовместимые единицы.

---

## Выполнено

### P0 — Migration 017: capacity_kwh_h (5 SP)

| # | Задача | Файл | Изменение |
|---|--------|------|-----------|
| S16-01 | Migration 017 | `017_capacity_kwh_h.sql` | ADD COLUMN IF NOT EXISTS + backfill + DROP/CREATE VIEW v_capacity_available |
| S16-02 | capacity.js | `src/routes/capacity.js` | 4 замены `capacity_mwh_d * 1000.0 / 24.0` → `capacity_kwh_h` |
| S16-03 | nominations.js | `src/routes/nominations.js` | 4 замены (строки 138, 171, 453, 489) |
| S16-04 | auctions.js | `src/routes/auctions.js` | 1 замена (строка 220) |
| S16-05 | billing.js | `src/routes/billing.js` | SELECT + JS конвертация удалена (строки 1044, 1052) |
| S16-06 | shippers.js | `src/routes/shippers.js` | 1 замена (строка 182) |
| S16-07 | 015_views.sql | `migrations/015_views.sql` | v_capacity_available: `SUM(capacity_kwh_h)` |

### P0 — Баг-фикс: Over-Nomination unit mismatch (1 SP)

| # | Баг | Файл | Исправление |
|---|-----|------|-------------|
| BUG-04 | `SUM(capacity_mwh_d)` сравнивалось с `volume_kwh_h` | nominations.js:453 | → `SUM(capacity_kwh_h)` |
| BUG-05 | `SUM(capacity_mwh_d)` для shipper contracted | nominations.js:489 | → `SUM(capacity_kwh_h)` |

### P0 — Seed data АЕРС alignment (2 SP)

| # | Задача | Файл | Изменение |
|---|--------|------|-----------|
| S16-08 | seed-runner.js | `src/db/seed-runner.js` | Новый формат: `capacity_kwh_h` как primary, `capacity_mwh_d` как back-calc |
| S16-09 | DB update | Прямой UPDATE | LT-001-E=9,752,230; LT-001-XH=9,216,209; LT-001-XS=536,021 |

---

## Файлы изменённые

| Файл | Тип изменения |
|------|--------------|
| `src/db/migrations/017_capacity_kwh_h.sql` | **СОЗДАН**: ADD COLUMN + backfill + view |
| `src/routes/capacity.js` | P0: 4 замены конвертации |
| `src/routes/nominations.js` | P0: 4 замены (включая 2 баг-фикса) |
| `src/routes/auctions.js` | P0: 1 замена |
| `src/routes/billing.js` | P0: 2 замены (SELECT + JS math) |
| `src/routes/shippers.js` | P0: 1 замена |
| `src/db/migrations/015_views.sql` | P1: view обновлён для чистого re-run |
| `src/db/seed-runner.js` | P1: АЕРС-exact seed data |

---

## Метрики

| Метрика | До | После |
|---------|-----|-------|
| KIREVO-ENTRY LT kWh/h | 13,752,458 (+228) | **13,752,230** (0 delta) |
| HORGOS-EXIT LT kWh/h | 9,216,208 (−1) | **9,216,209** (0 delta) |
| EXIT-SERBIA LT kWh/h | 4,536,208 (+187) | **4,536,021** (0 delta) |
| Runtime conversions | 12 мест в 6 файлах | **0** (native column) |
| Over-nomination unit bug | MWh/d vs kWh/h | **Fixed** (kWh/h vs kWh/h) |
| Migrations | 000–016 | **000–017** |
| API /capacity/available | Rounded values | **АЕРС-exact values** |

---

## Верификация API

```json
GET /capacity/available → physical[]:
  KIREVO-ENTRY: contracted=13,752,230, availableQuarterly=1,528,258, utilization=90%
  HORGOS-EXIT:  contracted=9,216,209,  availableQuarterly=1,024,024, utilization=90%
  EXIT-SERBIA:  contracted=4,536,021,  availableQuarterly=504,235,   utilization=90%
```

Все значения = АЕРС Decision 05-145 (GY 2022/2023). Расхождение: **0.000%**.

---

*Generated: 09.04.2026 · GTCP Sprint 16 (partial)*
