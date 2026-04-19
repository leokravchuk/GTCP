# GTCP — Sprint 21 Report
**Период:** 19.04.2026 | **Дата отчёта:** 19.04.2026

---

## ✅ Выполнено

| User Story | SP | Status |
|---|---|---|
| US-2106 · Backend bids.js (3 reporting endpoints) | 2 | ✅ DONE |
| US-2101 · Раздел «Заявка» — sidebar + tabs + Available Capacity | 3 | ✅ DONE |
| US-2102 · Product-Type Auction Lists (read-only) | 3 | ✅ DONE |
| US-2103 · RBP Platform panel (sync + auctions + trades + log) | 4 | ✅ DONE |
| US-2104 · My Bids portfolio tab | 4 | ✅ DONE |
| US-2105 · Reports tab + export CSV/XLSX | 5 | ✅ DONE |
| — · CAM NC Auction Compliance Report | — | ✅ DONE |

## ⚠️ Изменено по ходу спринта

| Что планировалось | Что сделано | Причина |
|---|---|---|
| Bid modals (GTCP + WD) с live fee preview | **Убрано** | CAM NC Art.17-18 требует ascending clock, sealed-bid некорректен |
| Кнопки «Подать заявку» / «Забронировать» | Заменены на info labels | Compliance report показал 4 CRITICAL gap'а |

---

## 📊 Метрики

| Метрика | Baseline | Result |
|---|---|---|
| Tests | 600 | **607** (+7 bids) |
| Endpoints | 107 | **110** (+3 bids) |
| OpenAPI | 107/107 | **110/110** |
| NC Coverage | ~92% | ~92% (compliance gaps documented) |

---

## Deliverables

### Backend
- `src/routes/bids.js` — 3 endpoints: `/bids/my`, `/bids/report`, `/bids/export`
- `tests/bids.test.js` — 7 tests
- Column fix: `auction_id`, `bid_price_eur_kwh_h_yr`, `booking_type`

### Frontend (GTCP_MVP.html)
- Новый раздел **«Заявка»** в sidebar (page-bids)
- 4 таба: Доступные мощности / Подать заявку / Мои заявки / Отчёты
- Available Capacity: Physical IPs (3) + CR IPs (3) + WD with tariffs
- GTCP auctions list (read-only, status badges)
- RBP Platform: status, sync capacity/credit, auctions, trades, sync log
- Portfolio: merged auction_bids + WD bookings, filters, lifecycle
- Reports: KPI cards + product breakdown + CSV/XLSX export

### Documentation
- **CAM_NC_AUCTION_COMPLIANCE_REPORT.md** — ascending clock vs sealed-bid, 10 gaps, diploma recommendations
- **TZ_AUCTION_BOOKING_UI.md** v2.0
- **SPRINT_21_PLAN.md** v2.0

---

## 📈 Кумулятивные метрики (Sprint 1–21)

| Метрика | Значение |
|---|---|
| SP доставлено | ~730 |
| Спринтов | 21 |
| Migrations | 23 |
| Tests | 607 (41 suites) |
| Endpoints | 110 |
| OpenAPI | 110/110 (100%) |
| NC Coverage | ~92% |

---

*Sprint 21 CLOSED · 19.04.2026*
