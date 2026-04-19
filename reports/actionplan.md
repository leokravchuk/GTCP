# GTCP — Action Plan
**Текущие задачи, приоритеты и решения · Living Document**

> Последнее обновление: 19.04.2026 · Sprint 22 CLOSED · Версия 22.0

---

## Текущее состояние

| Метрика | Значение |
|---|---|
| Sprint | 22 (closed 19.04.2026) |
| Tests | 612 (42 suites, 0 failing) |
| Endpoints | 110 (OpenAPI 110/110 = 100%) |
| Migrations | 25 (000–025) |
| NC Coverage | ~93% |
| SP delivered | ~750 |

---

## ✅ Завершённые спринты (Sprint 17–22)

### Sprint 17 (13–15.04.2026) — 29/33 SP ✅
- [x] FG Art.18 Hotfix: route guards, election, AAQ check, data sweep (299K EUR fix)
- [x] NC Art.13 Matching: Adjacent TSO mock, Lesser Rule, 100% coverage
- [x] Analytics Dashboard: volumes/revenue/utilization endpoints
- [x] CSV Export: 3 endpoints, RFC 4180 + BOM
- [x] Sprint 16 Test Debt: +85 tests (442→527)
- [x] Endpoint Audit: `npm run count-endpoints` = 82 actual
- [x] UserGuide v3.4

### Sprint 18 (17–18.04.2026) — 22/27 SP ✅
- [x] VTP Basic (NC Art.11): migration 021, 5 endpoints, 16 tests
- [x] Excel xlsx Export: exceljs, ?format=xlsx, 5 tests
- [x] FG Separate Invoice (Art.20.3.5): migration 022, invoice_type
- [x] OpenAPI 100% Sync: 95/95 (18 obsolete removed)
- [x] LOCAL_RUN.md rewrite
- [x] Load testing: autocannon, 854 RPS avg

### Sprint 19 (18–19.04.2026) — 19/24 SP ✅
- [x] Transparency Portal (NC Art.24): 4 public endpoints, rate-limited
- [x] VTP Balance Integration: nominations + VTP combined view
- [x] Diploma Artifacts Index
- [x] UserGuide v3.5

### Sprint 20 (19.04.2026) — 22 SP ✅
- [x] Capacity Surrender + UIOLI (NC Art.8/10)
- [x] Within-Day Continuous Booking (NC Art.6.3.1.4)
- [x] Interruption Management (NC Art.14): penalty × 3
- [x] 600 tests milestone
- [x] Auction KPI fix (UPCOMING + current month)

### Sprint 21 (19.04.2026) — 21 SP ✅
- [x] Раздел «Заявка» — sidebar + 4 таба (Available, Submit, Portfolio, Reports)
- [x] RBP Platform panel (sync capacity/credit, auctions, trades, sync log)
- [x] Backend bids.js: /bids/my, /bids/report, /bids/export (7 tests)
- [x] CAM NC Compliance Report: ascending clock vs sealed-bid
- [x] Bid modals removed (NC Art.17-18 compliance)

### Sprint 22 (19.04.2026) — 5 SP ✅
- [x] CAM NC Art.17-18: clearing_price + auction_premium auto-calc
- [x] Migration 024: auction_rounds table
- [x] Migration 025: Interruptible auctions seed + auction_rounds seed (127 rows)
- [x] Diploma Final Summary

---

## 📋 Sprint 23 (Backlog — не запланирован)

### Potential scope

| # | Задача | SP | Priority | NC Ref |
|---|---|---|---|---|
| 1 | Swagger UI HTML (swagger-ui.html) | 1 | P0 | — |
| 2 | Demo bids seed для portfolio | 1 | P0 | — |
| 3 | NC Art.9 Congestion Management | 5 | P1 | Art.9 |
| 4 | NC Art.16 Measurement | 3 | P2 | Art.16 |
| 5 | NC Art.21 Force Majeure | 3 | P2 | Art.21 |
| 6 | WebSocket real-time notifications | 5 | P2 | — |
| 7 | Diploma text/presentation update | 5 | P0 | — |

---

## Решённые проблемы (Sprint 17–22)

| # | Проблема | Решение | Sprint |
|---|---|---|---|
| FG-01..07 | FG начисление не тем shipper'ам | Route guards + election + AAQ + data sweep | 17 |
| BUG-04/05 | Over-nomination MWh/d vs kWh/h | capacity_kwh_h native column | 16 |
| DEBT-01 | Sprint 16 test debt | +85 tests (OBA, capacity, balance) | 17 |
| DEBT-02 | Endpoint count docs vs actual | `npm run count-endpoints`, 82 actual | 17 |
| G-02 | No uniform price | clearing_price_eur in auction_bids | 22 |
| G-07 | No auction premium | premium = clearing − reserve | 22 |
| G-08 | No Interruptible auctions | 12 Interruptible in seed | 22 |
| CSP | Helmet blocks inline scripts | Relaxed CSP for frontend | 19 (deploy) |
| CORS | Login 500 from localhost:3003 | CORS_ORIGIN += http://localhost:3003 | 19 (deploy) |

---

*Action Plan v22.0 · 19.04.2026 · GTCP Project*
