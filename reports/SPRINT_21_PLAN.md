# GTCP — Sprint 21 Plan
**Gas Trading & Commercial Platform · Раздел «Заявка» — Capacity Bid & Booking + RBP**

---

## Sprint Overview

| Параметр | Значение |
|---|---|
| **Sprint** | Sprint 21 |
| **Период** | 19.04.2026 — 01.05.2026 |
| **Velocity (цель)** | 25 SP |
| **Sprint Goal** | Новый раздел «Заявка» в sidebar: просмотр доступных мощностей, подача заявок (GTCP + RBP + WD), портфель заявок, отчёты с экспортом |
| **Baseline** | 600 tests, 107 endpoints, 23 migrations, NC 92% |
| **ТЗ** | [TZ_AUCTION_BOOKING_UI.md](TZ_AUCTION_BOOKING_UI.md) v2.0 |

---

## Sprint Goal

> **"К концу Sprint 21 shipper может через новый раздел «Заявка» просмотреть доступные мощности по всем IP, подать заявку на GTCP-аукцион или через RBP платформу (FGSZ), забронировать Within-Day мощность, отслеживать портфель заявок и выгружать отчёты в CSV/XLSX."**

---

## Sprint Backlog

### US-2101 · Раздел «Заявка» — Навигация + Available Capacity
**SP:** 3 | **Priority:** P0

- [ ] Новый пункт **«Заявка»** в sidebar (между Аукционы и Аудит)
- [ ] `page-bids` — новая страница в HTML
- [ ] 4 таба: Доступные мощности / Подать заявку / Мои заявки / Отчёты
- [ ] Таб «Доступные мощности»:
  - Physical IPs: Technical / LT 90% / ST Free 10% (из `GET /capacity/available`)
  - Commercial Reverse IPs: CR Available
  - Within-Day: available + тариф AERS + fee preview за 100K × remaining hours
- [ ] Auto-refresh кнопка

**DoD:** Раздел «Заявка» появляется в sidebar, Available Capacity загружается из API.

---

### US-2102 · Подача заявки — GTCP Internal (Scheduled + WD)
**SP:** 5 | **Priority:** P0

Подканал «GTCP Internal» для прямых аукционов Gastrans.

- [ ] Выбор типа: Yearly / Quarterly / Monthly / Daily / Within-Day
- [ ] Для Scheduled: список OPEN аукционов из `GET /auctions?status=OPEN` → кнопка «Подать заявку»
- [ ] Модалка Bid:
  - Auction info (ID, product, IP, period, reserve price)
  - Volume kWh/h (max = available)
  - Price EUR (min = reserve)
  - **Live fee preview**: `volume × price`
  - **Credit check**: `GET /credits/:shipperId` → available credit vs deposit 10%
  - Submit: `POST /auctions/bids` + `POST /auctions/bids/:id/submit`
- [ ] Для Within-Day: список IP с available → кнопка «Забронировать»
- [ ] Модалка WD Booking:
  - IP, direction (предзаполнены)
  - Volume, Hours (авто: remaining Gas Day hours, editable), Tariff (AERS, readonly)
  - **Live fee**: `volume × tariff × hours`
  - Submit: `POST /capacity/within-day`
- [ ] Success toast с booking/bid ID

**DoD:** Заявки на GTCP аукционы и WD бронирование работают end-to-end.

---

### US-2103 · Подача заявки — RBP Platform (Bundled)
**SP:** 4 | **Priority:** P0

Подканал «RBP» для bundled аукционов через FGSZ.

- [ ] RBP status badge: `GET /rbp/status` → Connected / Disconnected / Mock
- [ ] Кнопки: «Sync Capacity → RBP», «Sync Credit → RBP», «Refresh»
- [ ] Таблица bundled auctions: `GET /rbp/auctions` (product, period, reserve, status)
- [ ] Модалка RBP Bid:
  - Auction info + warning «One Auction — Two Contracts (Gastrans + FGSZ)»
  - Volume, Price (Gastrans side)
  - Fee preview (Gastrans side only, FGSZ fee на RBP platform)
  - Submit: `POST /rbp/bilateral`
- [ ] Таблица My RBP Trades: `GET /rbp/trades`
- [ ] RBP Sync Log: `GET /rbp/sync-log` (последние 10 операций)

**DoD:** RBP auctions отображаются, заявки подаются через `POST /rbp/bilateral`, sync capacity/credit работает.

---

### US-2104 · Мои заявки (портфель)
**SP:** 4 | **Priority:** P0

Единый портфель всех заявок shipper'а.

- [ ] Таблица: Bid#, Канал (GTCP/RBP/WD), Product, IP, Volume, Price, Fee, Status, Date
- [ ] Фильтры: канал, статус, product type
- [ ] Lifecycle кнопки:
  - DRAFT → «Отправить» / «Удалить»
  - WON → «Создать контракт» (`POST /auctions/bids/:id/create-contract`)
  - ACTIVE (WD) → информационно
- [ ] Backend: `GET /bids/my` — новый endpoint (aggregate auction_bids + WD bookings)
- [ ] Пагинация

**DoD:** Shipper видит все заявки (GTCP + RBP + WD), может управлять lifecycle.

---

### US-2105 · Отчёты по заявкам
**SP:** 5 | **Priority:** P1

- [ ] **История заявок**: таблица с фильтрами (период, product type, канал, статус, IP)
- [ ] **Сводка KPI**: подано / выиграно / проиграно / pending / total volume / total fee / WD bookings
- [ ] **По продуктам**: breakdown по Yearly/Q/M/D/WD — кол-во, объём, средняя цена, win rate %
- [ ] **Экспорт**: CSV + XLSX кнопки
- [ ] Backend: `GET /bids/report` (KPI aggregation), `GET /bids/export?format=csv|xlsx`

**DoD:** Отчёты работают, экспорт CSV/XLSX скачивается.

---

### US-2106 · Backend: Bid Reporting Endpoints
**SP:** 2 | **Priority:** P1

Новые API endpoints для отчётов:

- [ ] `GET /bids/my` — все заявки текущего shipper'а (auction_bids + capacity_bookings WHERE product_type='WITHIN_DAY')
- [ ] `GET /bids/report` — KPI aggregation (count by status, sum volume/fee)
- [ ] `GET /bids/export?format=csv|xlsx` — экспорт (переиспользуем csvExport + xlsxExport)
- [ ] ≥6 tests

**DoD:** 3 новых endpoints, 110 endpoints total, tests ≥606.

---

### US-2107 · Sprint 20 Close + Docs
**SP:** 2 | **Priority:** P2

- [ ] Sprint 20 Report
- [ ] CLAUDE.md update (endpoints, migrations, NC coverage)
- [ ] Commit Sprint 20 docs

---

## Sprint Backlog Summary

| User Story | Epic | SP | Priority |
|---|---|---|---|
| US-2101 · Navigation + Available Capacity | UI | 3 | P0 |
| US-2102 · GTCP Bid (Scheduled + WD) | UI + API | 5 | P0 |
| US-2103 · RBP Bid (Bundled) | UI | 4 | P0 |
| US-2104 · My Bids Portfolio | UI + API | 4 | P0 |
| US-2105 · Reports + Export | UI + API | 5 | P1 |
| US-2106 · Backend Reporting Endpoints | API | 2 | P1 |
| US-2107 · Sprint 20 Close + Docs | Docs | 2 | P2 |
| **ИТОГО** | | **25 SP** | |

---

## Архитектура

### Frontend (GTCP_MVP.html)

```
page-bids (новая страница)
├── bids-tab-available     → renderBidsAvailable()
├── bids-tab-submit        → renderBidsSubmit()
│   ├── GTCP Internal      → gtcpBidList() + модалка modal-gtcp-bid
│   ├── RBP Platform       → rbpBidList() + модалка modal-rbp-bid
│   └── Within-Day         → wdBookingList() + модалка modal-wd-booking
├── bids-tab-portfolio     → renderBidsPortfolio()
└── bids-tab-reports       → renderBidsReports()
```

### Backend (новые endpoints)

```
backend/src/routes/bids.js (новый файл)
├── GET  /bids/my           → auction_bids + WD bookings merge
├── GET  /bids/report       → KPI aggregation
└── GET  /bids/export       → CSV/XLSX
```

### Изменяемые файлы

| Файл | Изменение |
|---|---|
| `Soft/GTCP_MVP.html` | +page-bids, +sidebar item, +4 tabs, +3 modals, +JS functions |
| `backend/src/routes/bids.js` | Новый файл: 3 endpoints |
| `backend/src/app.js` | +bidsRouter |
| `backend/tests/bids.test.js` | ≥6 tests |
| `backend/docs/openapi.yaml` | +3 endpoints |

---

## Definition of Done (Sprint 21)

- [ ] Раздел «Заявка» в sidebar (не трогая «Аукционы»)
- [ ] 4 таба: Доступные мощности / Подать заявку / Мои заявки / Отчёты
- [ ] GTCP Internal: bid на scheduled auction + WD booking
- [ ] RBP Platform: sync + view auctions + bid + trades + sync-log
- [ ] Live fee preview в обеих модалках
- [ ] Credit check перед submit
- [ ] Портфель: GTCP + RBP + WD с lifecycle
- [ ] Отчёты: история, сводка, по продуктам, экспорт CSV/XLSX
- [ ] Backend: 3 новых endpoints (bids/my, bids/report, bids/export)
- [ ] Jest ≥ 606
- [ ] OpenAPI sync
- [ ] Git commit `feat(sprint-21)`

---

## Риски

| # | Риск | Митигация |
|---|---|---|
| R-1 | GTCP_MVP.html > 5000 строк | Модульные функции, минимум inline HTML |
| R-2 | RBP mock mode — нет реальных аукционов | Показать mock status badge, seed demo RBP data |
| R-3 | Credit check может вернуть 0 для demo users | Fallback: показать warning, не блокировать submit |

---

*Sprint 21 Plan v2.0 · 19.04.2026 · GTCP Project*
*ТЗ: [TZ_AUCTION_BOOKING_UI.md](TZ_AUCTION_BOOKING_UI.md) v2.0*
