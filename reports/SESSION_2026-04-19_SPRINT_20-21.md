# GTCP — Session Report 19.04.2026

**Sprint 20–21 + CAM NC Compliance + Local Deploy**

---

## Выполнено

### Sprint 20 (19.04.2026)
- **Capacity Surrender + UIOLI** (NC Art.8/10) — migration 023, 4 endpoints, 7 tests
- **Within-Day Continuous Booking** (NC Art.6.3.1.4) — 2 endpoints, 3 tests
- **Interruption Management** (NC Art.14) — penalty × 3, 2 endpoints, 3 tests
- **600 tests milestone** — balance+VTP, capacity available, WD fee, interruption penalty
- **Auction KPI fix** — UPCOMING status, current month calendar

### Local Deploy (порт 3003)
- PORT 3000→3003 в 4 файлах
- Helmet CSP: unsafe-inline + Google Fonts + connect-src localhost
- Express static: /backend/frontend/ mount для api.js
- CORS: http://localhost:3003 добавлен

### Sprint 21 (19.04.2026)
- **Раздел «Заявка»** — новый пункт sidebar, 4 таба:
  - Доступные мощности (Physical + CR + WD real-time)
  - Подать заявку (GTCP auctions read-only + RBP panel)
  - Мои заявки (портфель GTCP + RBP + WD)
  - Отчёты (KPI + breakdown + CSV/XLSX export)
- **Backend bids.js** — 3 endpoints (/bids/my, /report, /export), 7 tests
- **RBP panel** — sync capacity/credit, view auctions/trades/log

### CAM NC Compliance Analysis
- **CAM_NC_AUCTION_COMPLIANCE_REPORT.md** — 307 строк:
  - Ascending clock vs sealed-bid (4 CRITICAL gaps)
  - RBP "One Auction Two Contracts" model
  - ENTSOG auction calendar structure
  - 10 gaps identified, diploma recommendations
- **Bid modals removed** — sealed-bid модалки некорректны по CAM NC Art.17-18
- **Migration 024** — auction_rounds table, clearing_price, auction_premium
- **Clearing price auto-calc** в POST /bids/:id/result, 5 tests
- **Gaps G-02, G-07 closed** (uniform price + premium calculation)

---

## Метрики

| Метрика | Начало дня | Конец дня |
|---|---|---|
| Tests | 600 | **612** |
| Endpoints | 107 | **110** |
| Migrations | 23 | **24** |
| OpenAPI | 107/107 | **110/110** |
| NC Coverage | ~92% | ~92% + compliance documented |
| SP | ~710 | **~750** |

---

## Commits (15 за сессию)

```
6b02ba4 feat: CAM NC Art.17-18 compliance — clearing price, premium, auction rounds
b286d30 docs(sprint-21): Sprint 21 Report
cda5fe6 fix: remove simplified bid modals from Заявка section
ed05c12 docs: CAM NC Auction Compliance Report
278c2e2 fix: page-bids display:none, modals openModal/closeModal
4b8033e fix: TECH_CAP redeclaration → BIDS_TECH
7366a72 fix(sprint-21): bids.js column names match real DB schema
434377a feat(sprint-21): Раздел «Заявка» — GTCP + RBP bids, reports
5b8fb72 feat(sprint-20): 600 tests, auction KPIs fix
51f682b feat(sprint-20): Capacity Surrender Art.8, Within-Day Art.6, Interruption Art.14
824e81f fix: local deploy on port 3003 — CSP, CORS, static paths
d13a9d7 docs: session report 17-19.04
8429065 docs(sprint-19): UserGuide v3.5, Sprint 19 Report
24423bd feat(sprint-19): Transparency Portal Art.24, VTP balance
7757c2f feat(sprint-18): VTP Art.11, Excel export, FG-invoice split, OpenAPI 100%
```

---

*Session report: 19.04.2026 · GTCP Project*
