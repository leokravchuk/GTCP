# GTCP — Action Plan
**Текущие задачи, приоритеты и решения · Living Document**

> Последнее обновление: 09.04.2026 · Sprint 16 в процессе · Версия 17.0

---

## 📋 Sprint 16 · NC Compliance Push + Data Integrity + Analytics (06–19.04.2026)

> Детали: `reports/SPRINT_16_PLAN.md`

### ✅ P0 — Выполнено (09.04.2026)

- [x] **US-1610** · Migration 017: capacity_kwh_h native column (ADD COLUMN + backfill + view) (3 SP) ✅
- [x] **US-1611** · Replace all 12 runtime MWh/d→kWh/h conversions in 6 files (2 SP) ✅
- [x] **US-1612** · BUG-04/05: Over-nomination unit mismatch fix (nominations.js:453,489) (1 SP) ✅
- [x] **US-1613** · Seed data АЕРС alignment (capacity_kwh_h exact values) (2 SP) ✅
- [x] **US-1614** · 90/10 rule enforcement: LT=90% exact, ST=10% free for auctions, shipper balance Δ=0 (3 SP) ✅
- [x] **US-1615** · Газпром HORGOS-EXIT=90% rule + CTR-2026-006 domestic contract + billing tariff lookup fix (price_eur) (2 SP) ✅
- [x] **US-1616** · CLAUDE.md + Artifacts + memory: LT Booking Rules, capacity 90/10 updated (1 SP) ✅

### 🔴 P0 — Критический путь

- [ ] **US-1601** · Adjacent TSO Auto-Matching (NC Art.13.5) — matchWithAdjacentTso(), Lesser Rule, mock FGSZ/BulgarTransgaz (5 SP)
- [ ] **US-1602** · Double-Sided Nomination Matching Result (NC Art.13.3) — matching-result endpoint + UI panel (3 SP)
- [ ] **US-1603** · Imbalance Charge Calculation (NC Art.15.3) — calcImbalanceCharge(), migration 016: daily_imbalances, balance endpoints (5 SP)

### 🟡 P1 — Важно

- [ ] **US-1604** · Analytics Dashboard — графики объёмов, revenue по шипперам, утилизация (Chart.js) (5 SP)
- [ ] **US-1605** · Export to Excel/CSV — Billing, Contracts, Nominations (SheetJS) (4 SP)
- [ ] **US-1606** · k6 Load Testing — ≥100 RPS, p95<500ms, отчёт (3 SP)
- [ ] **US-1607** · UserGuide v3.4 — финальная версия для диплома (.md + .docx) (4 SP)
- [x] **US-1608** · Artifacts + CLAUDE.md update — Sprint 16 state (2 SP) ✅

### 🟢 P2 — Перенос если нет времени

- [ ] **US-1609** · VTP Basic Implementation (NC Art.11) — VTP trades, balancing impact (4 SP)

---

## ✅ Sprint 14 — Auction Calendar + UAT (30-31.03.2026) · ЗАВЕРШЁН

> Период: 30-31.03.2026 | Target: ~30 SP | Actual: ~35 SP | Статус: ✅ ЗАВЕРШЁН

### P0 — Auction Calendar (NC Art.7 + MAR0277-24)

| # | Задача | SP | Статус |
|---|---|---|---|
| A-200 | CAM NC Calendar download + parse (MAR0277-24 ENTSOG) | 1 | ✅ |
| A-201 | seed_auctions_v2.sql: 115 аукционов (Yearly+Quarterly+Monthly+CR) | 3 | ✅ |
| A-202 | GET /auctions/calendar/grid endpoint | 2 | ✅ |
| A-203 | GET /auctions/calendar/days endpoint (Daily/WD on-the-fly) | 3 | ✅ |
| A-204 | Frontend: day-centric calendar (month grid + detail card + timeline) | 5 | ✅ |
| A-205 | NC Art.7.1.2 fix: Yearly Firm = only surrendered LT | 1 | ✅ |

### P0 — UAT Frontend Fixes

| # | Задача | SP | Статус |
|---|---|---|---|
| A-206 | auth.js: accessToken + fullName in login response | 1 | ✅ |
| A-207 | billing/auctions: res.json(rows) instead of {data:[]} | 1 | ✅ |
| A-208 | credits: /margin-calls, /:id/rating, /:id/instruments | 2 | ✅ |
| A-209 | capacity: period_from/period_to, audit: occurred_at | 1 | ✅ |
| A-210 | nominations: shipperId code→UUID resolve, PATCH /status, reference lookup | 2 | ✅ |
| A-211 | GTCP_MVP.html: shipperName(code+name), confirm/reject via API, edigas XML | 2 | ✅ |
| A-212 | Dashboard: shipper code, active filter, GTA type, capacity KPI blocks | 3 | ✅ |
| A-213 | Rate limiter: production-only guard | 1 | ✅ |

### P0 — Available Capacity Engine (NC Art.7.1.1)

| # | Задача | SP | Статус |
|---|---|---|---|
| A-219 | GET /capacity/available endpoint (real-time SQL) | 3 | ✅ |
| A-220 | Dynamic available in /auctions/calendar/days (replace hardcoded ST_FREE) | 2 | ✅ |
| A-221 | Frontend: AVAILABLE column + TECH column in auction table | 1 | ✅ |
| A-222 | Frontend: capacity_type badge (Firm/CR/Int) | 1 | ✅ |
| A-223 | CR Monthly dates fix (4th Tuesday M-1, Art.7.4.3.3) | 1 | ✅ |
| A-224 | Shippers endpoint: +status, +gta_type, +ratings | 1 | ✅ |
| A-225 | Dashboard: nominations KPI = Entry only, activeShippers filter | 1 | ✅ |

### P0 — EDIGAS v5.1 + Credit Instruments + Fixes

| # | Задача | SP | Статус |
|---|---|---|---|
| A-226 | EDIGAS v5.1 NOMINT full XML (01G/P03, sender/receiver, direction, contract, GasDay) | 3 | ✅ |
| A-227 | EDIGAS timezone fix: GasDay local date not UTC | 1 | ✅ |
| A-228 | Credit Instruments: credit_support table + 7 seed rows + frontend mapping | 2 | ✅ |
| A-229 | Matching via backend API (not in-memory), gasDay timezone fix | 2 | ✅ |
| A-230 | Balance page: filter all non-rejected nominations, active shippers only | 1 | ✅ |
| A-231 | NOMRES mock (confirmation XML from TSO) | 1 | ✅ |
| A-232 | Real-time update analysis: Polling/WebSocket/PWA comparison | 1 | ✅ (analysis only) |

### P0 — Data Integrity (Contract→Booking→Nomination)

| # | Задача | SP | Статус |
|---|---|---|---|
| A-214 | Contracts: cap_entry/exit filled for all 5 shippers | 1 | ✅ |
| A-215 | Capacity bookings: 90/10 AERS split, ST bookings WIEH+Srbijagas | 2 | ✅ |
| A-216 | Nominations: volumes ≤ contracted, Entry=Exit per shipper (Art.12.3) | 2 | ✅ |
| A-217 | Shippers: GTA types (LT/ST), ratings (S&P/Moodys/Creditreform) | 1 | ✅ |
| A-218 | DB constraints: auction_calendar +YEARLY, nominations +CONFIRMED | 1 | ✅ |

---

## ✅ Sprint 13 — Testing Infrastructure (30.03.2026) · ЗАВЕРШЁН

> Период: 30.03.2026 | Target: ~40 SP | Actual: ~45 SP | Статус: ✅ ЗАВЕРШЁН

### P0 — Backend Infrastructure (восстановление, 12 SP)

| # | Задача | SP | Статус |
|---|---|---|---|
| T-01 | package.json + npm scripts | 1 | ✅ |
| T-02 | middleware: authenticate (JWT), authorize (RBAC), errorHandler | 3 | ✅ |
| T-03 | db/index.js (pg pool + withTransaction) + logger (winston) | 2 | ✅ |
| T-04 | services: auditService, edigasService (buildNomint/Renomint/submitToTso) | 2 | ✅ |
| T-05 | routes: auth, credits, capacity, balance, audit, systemParams | 4 | ✅ |

### P0 — Integration Tests Level 1 (supertest, 10 SP)

| # | Задача | SP | Tests | Статус |
|---|---|---|---|---|
| T-06 | auth.integration.test.js | 2 | 14 | ✅ |
| T-07 | shippers.integration.test.js | 1 | 12 | ✅ |
| T-08 | contracts.integration.test.js | 1 | 12 | ✅ |
| T-09 | nominations.integration.test.js | 2 | 13 | ✅ |
| T-10 | billing.integration.test.js | 2 | 14 | ✅ |
| T-11 | auctions.integration.test.js | 2 | 10 | ✅ |

### P0 — NC Compliance Suite Level 3 (5 SP)

| # | Задача | SP | Tests | Статус |
|---|---|---|---|---|
| T-12 | nc-compliance.test.js (9 NC sections, 79 tests) | 5 | 79 | ✅ |

### P0 — Coverage Push + DB-specific (13 SP)

| # | Задача | SP | Tests | Статус |
|---|---|---|---|---|
| T-13 | billing.coverage + billing.deep + billing.unit + billing.dbspec | 5 | 72 | ✅ |
| T-14 | auctions.coverage + auctions.dbspec | 3 | 35 | ✅ |
| T-15 | nominations.coverage + nominations.deep + nominations.dbspec + nominations.realdb | 3 | 25 + 6 realdb | ✅ |
| T-16 | shippers.coverage + stubs.coverage + rbp.coverage + rbp.dbspec + edge-cases | 2 | 53 | ✅ |

### P0 — CI/CD + PostgreSQL (5 SP)

| # | Задача | SP | Статус |
|---|---|---|---|
| T-17 | .github/workflows/test.yml (2 jobs: mock + PostgreSQL 15) | 2 | ✅ |
| T-18 | docker-compose.test.yml + .env.test | 1 | ✅ |
| T-19 | 000_init.sql (19 таблиц) + migrate.js + seed-runner.js | 2 | ✅ |

### P1 — Bugfixes found by tests (0 SP — побочный результат)

| # | Баг | Файл | Статус |
|---|---|---|---|
| BUG-01 | Rounding ±€0.01 в billing (toFixed(4) → toFixed(2)) | billing.js | ✅ |
| BUG-02 | ReferenceError: pts before initialization в /generate | billing.js | ✅ |
| BUG-03 | Missing column is_over_nomination в nominations | 000_init.sql | ✅ |

### Итоги Sprint 13

| Метрика | До | После |
|---------|-----|-------|
| Test suites | 3 | **25** |
| Tests | 61 | **442** |
| billing.js coverage | 17% | **97%** |
| Модули на 100% | 2 | **8** |
| Средний coverage | ~40% | **~95%** |
| GitHub коммиты | — | `33ccf6e` + `c38c400` |

---

## 🔄 Sprint 10 — Invoice Line Items + Capacity 90/10 (27.03.2026)

### ✅ P0 — Frontend Real Data (F-1–F-7, 14 SP) ЗАВЕРШЁН

| # | Задача | Статус |
|---|---|---|
| F-1 | Balance: TECH_CAP from API (15.28M/10.24M/5.04M) | ✅ |
| F-2 | Invoice: separate entry/exit + tariffs | ✅ |
| F-3 | Reserve Prices API + api.js | ✅ |
| F-4 | Balance NC point codes | ✅ |
| F-5 | Contract filter: 9 NC routes | ✅ |
| F-6 | Fuel Gas via API.systemParams | ✅ |
| F-7 | Tracker data mapping | ✅ |

### ✅ P0 — Invoice Line Items (IL-1–IL-7, 19 SP) ЗАВЕРШЁН

| # | Задача | Статус |
|---|---|---|
| IL-1 | Migration 011: invoice_line_items + capacity_category | ✅ |
| IL-2 | POST /billing/with-lines (9 types, auto FG from EXIT) | ✅ |
| IL-3 | POST /billing/generate (auto from contracts) | ✅ |
| IL-4 | GET /billing/:id + line_items + subtotals | ✅ |
| IL-5 | Auction Premium calc | ✅ |
| IL-6 | Frontend: Invoice modal с наборными строками | ✅ |
| IL-7 | Frontend: Invoice detail popup (📋) | ✅ |

### ✅ P0 — Capacity 90/10 (C-1–C-5, 9 SP) ЗАВЕРШЁН

| # | Задача | Статус |
|---|---|---|
| C-1 | capacity_category LONG_TERM/SHORT_TERM | ✅ |
| C-2 | Tracker: Tech/LT Reserve/ST Available/ST Sold/ST Free | ✅ |
| C-3 | Auction bid ≤ Available(10%) | ✅ |
| C-4 | Balance: 3 NC points + real tech from API | ✅ |
| C-5 | Seed data LONG_TERM backfill | ✅ |

### ✅ P0 — NC Art.3: Shipper Registration (15 SP) ЗАВЕРШЁН

| # | Задача | Статус |
|---|---|---|
| A-172 | Migration 012: shipper_status enum, gta_type, 15 полей, shipper_changes | ✅ |
| A-173 | POST /shippers/apply → APPLICANT | ✅ |
| A-174 | GTA type: SHORT_TERM / LONG_TERM | ✅ |
| A-175 | Removal: contracted=0 + debt=0 (NC Art.3.7) | ✅ |
| A-176 | Audit trail: shipper_changes (old/new/reason) | ✅ |
| A-177 | Frontend: [+ Зарегистрировать], badges, lifecycle actions | ✅ |

### ✅ P1 — Documentation (5 SP) ЗАВЕРШЁН

| # | Задача | Статус |
|---|---|---|
| A-181 | UserGuide v3.0 (1873 строк, двуязычный) | ✅ |
| A-182 | OpenAPI: +7 endpoints Sprint 9–10 | ✅ |

### ⏸ Отложено — Infrastructure (11 SP) — нет VPS

| # | Задача | Статус |
|---|---|---|
| A-178 | VPS деплой (nginx + PM2 + SSL) | ⏸ |
| A-179 | WebSocket real-time | ⏸ |
| A-180 | Email-уведомления | ⏸ |

### 🔲 Перенесено в Sprint 11 — Analytics (14 SP)

| # | Задача | Статус |
|---|---|---|
| A-185 | Performance testing k6 | 🔲 |
| A-186 | Аналитический дашборд (графики) | 🔲 |
| A-187 | Экспорт Excel/CSV | 🔲 |

---

## ✅ Sprint 11 — Nominations NC Art.12-13 + RBP Core · ЗАВЕРШЁН (27.03.2026)

> Период: 01–20.05.2026 | Target: ~39 SP
> Два блока: Nominations NC compliance (19 SP) + RBP Core (20 SP)

### P0 — Nominations NC Compliance (19 SP)

| # | Задача | SP | NC Ref |
|---|---|---|---|
| N-1 | `volumeMwh` → `volume_kwh_h` (backend + frontend + migration 013) | 2 | NC §2.1 |
| N-2 | Equal Nominations check: Entry = Σ Exit + VTP | 2 | Art.12.3 |
| N-3 | Contracted Capacity lookup при подаче номинации | 3 | Art.13.2.1 |
| N-4 | Nomination ≤ Contracted validation + Over-Nomination (Art.12.8) | 3 | Art.13.2.1 + 12.8 |
| N-5 | Direction auto-select по point | 1 | UX |
| N-6 | Frontend: Entry/Exit side-by-side + Balance panel + auto Exit-Serbia | 3 | Art.12.3 |
| N-7 | Frontend: Contracted Capacity в nomination modal | 2 | UX |
| N-8 | Renomination Limitation 90/10 rule | 3 | Art.12.7.5 |

### P0 — RBP Core (20 SP)

| # | Задача | SP |
|---|---|---|
| RBP-06 | rbpClient.js (SOAP + mock toggle) | 5 |
| RBP-07 | UploadCapacityAndTariffV4 | 5 |
| RBP-08 | UploadFinanceCreditV3 | 3 |
| RBP-09 | GetAuctionsV5 | 3 |
| RBP-10 | GetTradesV4 + Bundled logic | 3 |
| RBP-12 | REST routes /api/v1/rbp/* | 1 |

## ✅ Sprint 12 — RBP Secondary + UI + Tests · ЗАВЕРШЁН (28.03.2026)

> Период: 20.05–10.06.2026 | Target: ~33 SP

| Блок | SP |
|---|---|
| RBP Secondary (surrender, bilateral, REMIT, NU sync) | 12 |
| Frontend RBP Bridge UI | 4 |
| RBP Tests | 3 |
| Analytics: дашборд + Excel export + k6 | 9 |
| Infrastructure: VPS + WebSocket + Email (если VPS готов) | 5 |

---

## ✅ Sprint 9 — NC Full Compliance + AERS Tariff Alignment (27.03.2026) · ЗАВЕРШЁН

> Источники: NC Gastrans 2020, АЕРС Decision 05-145 (17.07.2025, GY2025/26), NC Audit 26.03.2026
> Детали: `reports/SPRINT_9_PLAN.md` (25 задач, 46 SP)
> **Аудит 03.04.2026:** Все 20 задач верифицированы в codebase. Backend NC-compliant.

### P0 — Тарифы АЕРС 05-145 (12 SP) · ✅ ВСЕ РЕАЛИЗОВАНЫ

| # | Задача | Статус | Верификация (аудит 03.04.2026) |
|---|---|---|---|
| A-147 | Entry Kirevo annual tariff = **6.00** | ✅ | migration 010:45, GTCP_MVP.html:2426 |
| A-148 | Daily Entry tariff = **0.0329** | ✅ | migration 010:100, GTCP_MVP.html:2436 |
| A-149 | Quarterly тарифы — 4Q × 3 точки × 3 режима | ✅ | migration 010:53-82 (36 rows seeded) |
| A-150 | Monthly тарифы — 28/30/31 × 3 точки × 2 режима | ✅ | migration 010:83-97 |
| A-151 | Within-Day тарифы — 0.0021/0.0014/0.0023 | ✅ | migration 010:110-116, billing.js:177-189 |
| A-152 | CR тарифы 2.85/1.99/3.25 | ✅ | migration 010:49-51 |
| A-153 | Миграция 010: `reserve_prices` + KIREVO-EXIT | ✅ | `010_reserve_prices.sql` (116 строк, 69 seed rows) |

### P0 — Формулы биллинга (10 SP) · ✅ ВСЕ РЕАЛИЗОВАНЫ

| # | Задача | Статус | Верификация |
|---|---|---|---|
| A-154 | Раздельный entry/exit capacity fee | ✅ | `calcCapacityFee()` billing.js:158-218, returns `{entryFeeEur, exitFeeEur}` |
| A-155 | Within-Day hourly fee (NOT /365) | ✅ | billing.js:177-189 `cap × price/hour × hours` |
| A-156 | EURIBOR **6M** (не 3M!) | ✅ | billing.js:272, seed `euribor_6m_pct = 2.64` |
| A-157 | Invoice due 20th of month (NC Art.20.4.1) | ✅ | billing.js:573-581 (NC-correct: 20-е число, не 30 дней) |
| A-158 | Interruption penalty ×3 | ✅ | `calcInterruptionPenalty()` billing.js:282-296 |
| A-159 | Over-Nomination endpoint (NC Art.12.8) | ✅ | nominations.js:477-526 `POST /over-nominate` |

### P0 — Маршруты и точки (7 SP) · ✅ ВСЕ РЕАЛИЗОВАНЫ

| # | Задача | Статус | Верификация |
|---|---|---|---|
| A-160 | 7 NC-маршрутов в contracts/meta | ✅ | ncRoutes.js:57-128, migration 009 |
| A-161 | KIREVO-EXIT в interconnection_points | ✅ | migration 010:7-17, ncRoutes.js:30 |
| A-162 | Frontend nomination NC-коды | ✅ | GTCP_MVP.html:804 (6 NC кодов в dropdown) |
| A-163 | Capacity units кВт·ч/ч | ✅ | migration 013, весь codebase |

### P1 — Security (7 SP) · ✅ РЕАЛИЗОВАНО (express-validator вместо Joi/Zod)

| # | Задача | Статус | Верификация |
|---|---|---|---|
| A-164 | OWASP audit — SQL injection, XSS | ✅ | 100% parameterized queries ($1,$2), Helmet, CORS whitelist |
| A-165 | Input validation | ✅ | express-validator ^7.3.1 (92 правила, 9 routes). Joi/Zod не нужен — P2 |
| A-166 | Nomination deadline 14:00 CET D-1 | ✅ | nominations.js:107-126, nc-compliance.test.js подтверждает |

### P1 — Docs & Testing (10 SP)

| # | Задача | Ответственный | Срок | Статус |
|---|---|---|---|---|
| A-167 | Jest: nc-routes.test.js — target 70+ cases | QA | 10.04.2026 | ✅ Sprint 13: 79 NC compliance + 25 nc-routes = 104 tests |
| A-168 | Jest: tariffs.test.js — calcCapacityFee entry≠exit, Within-Day | QA | 10.04.2026 | ✅ Sprint 13: billing.unit.test.js — все 4 mode + 25 tariff tests |
| A-169 | UserGuide v3.2 — тестирование (mock/DB/CI команды) | Docs | 05.04.2026 | 🔲 |
| A-170 | LOCAL_RUN.md — CORS, CSP, http-server | Docs | 10.04.2026 | 🔲 |
| A-171 | Sprint 13 Review Gate — 442 tests, push ✅ | Tech Lead | 30.03.2026 | ✅ |

---

## ✅ Sprint 8 — Frontend-Backend Alignment (26.03.2026) · ЗАВЕРШЁН (partial)

| # | Задача | Статус |
|---|---|---|
| A-131 | Swagger UI CSP fix — helmet relaxation для `/docs` | ✅ |
| A-132 | CORS config — `.env` CORS_ORIGIN расширен | ✅ |
| A-133 | api.js v2.0 — 65 методов | ✅ |
| A-134 | `_refreshFromBackend()` — все модули | ✅ |
| A-135 | Credit Module — backend wiring | ✅ |
| A-136 | Auctions Module — 2-step bid flow | ✅ |
| A-137 | Capacity Module — 4 таба | ✅ |
| A-138 | Nominations — EDIGAS XML preview | ✅ |
| A-139 | Billing — Gas Quality + Statement | ✅ |
| A-140 | System Parameters page | ✅ |
| A-141 | NC Route Labels — 7 маршрутов | ✅ |
| A-142 | VPS деплой | 🔲 → Sprint 10 |
| A-144 | WebSocket | 🔲 → Sprint 10 |
| A-145 | Email-уведомления | 🔲 → Sprint 10 |

---

## ✅ Sprint 5 — Все задачи выполнены (25.03.2026)

| # | Задача | Ответственный | Срок | Статус |
|---|---|---|---|---|
| A-106 | Swagger/OpenAPI 3.0 — `openapi.yaml` 60+ endpoints + CDN Swagger UI | Backend Dev | 25.03.2026 | ✅ DONE |
| A-107 | Integration tests — Jest+Supertest: billing NC Art.18, credits NC Art.5, auctions lifecycle | Backend Dev | 25.03.2026 | ✅ DONE |
| A-108 | GitHub Actions CI/CD — lint + test (PG service) + security audit + OpenAPI validate | DevOps | 25.03.2026 | ✅ DONE |
| A-109 | Credit Support UI — витрина в GTCP_MVP.html (гарантии + рейтинг) | Frontend Dev | 10.04.2026 | 🔲 Sprint 6 |
| A-110 | Sprint 5 Review Gate — node --check все routes ✅ / миграции 001-008 верифицированы | Tech Lead | 25.03.2026 | ✅ DONE |

## ✅ Sprint 6 · Все задачи выполнены (26.03.2026)

| # | Задача | Ответственный | Срок | Статус |
|---|---|---|---|---|
| A-111 | Credit Support UI — 4 таба: Позиции, Инструменты NC Art.5, Рейтинги, MC | Frontend Dev | 15.04.2026 | ✅ DONE |
| A-116 | Auction Management UI — аукционы CAM NC, заявки, KPI, 5 статусов | Frontend Dev | 15.04.2026 | ✅ DONE |
| A-114 | 1С ERP Connector — erp-connector.js (getInvoices, syncInvoice, payments, mock) | Backend Dev | 26.04.2026 | ✅ DONE |
| A-112 | VPS конфиги — nginx.conf (SSL/proxy/gzip) + ecosystem.config.js (PM2 cluster) | DevOps | 18.04.2026 | ✅ DONE |
| A-113 | Migrations 004/007/008 fix + Jest тесты — **56/56 passing** (billing/credits/auctions) | Backend Dev | 26.03.2026 | ✅ DONE |
| A-115 | Sprint 6 Review Gate — commit `e63fceb`, тег `sprint-6`, push pending (VPS — Sprint 7) | Tech Lead | 26.03.2026 | ✅ DONE |

---

## ✅ Sprint 5 · Выполнено (25.03.2026)

### ✅ P0 — CAP-FIX (критическое исправление формулы)

- [x] **A-101** · Создать `005_capacity_entry_exit.sql` — поля cap_entry + cap_exit, EXIT-SERBIA, gas_quality_daily ✅
- [x] **A-102** · Обновить `calcCapacityFee()` в billing.js — раздельный entry/exit, 3 flow directions ✅
- [x] **A-103** · Добавить `calcFuelGas()` NC Art.18 — X1=0.42%, X2=0.08%, Annex 3A данные ✅
- [x] **A-104** · Добавить `calcLatePaymentInterest()` NC Art.20.4.2 — EURIBOR 6M + 3%, 360d basis ✅
- [x] **A-105** · Обновить contracts.js — 3 направления: GOSPODJINCI_HORGOS / HORGOS_GOSPODJINCI / KIREVO_EXIT_SERBIA ✅

> **P0 Gate Review пройден (25.03.2026):**
> Transit 31d: Entry €4,893,910 + Exit €5,361,814 = Total **€10,255,724** ✅
> Domestic 30d: Entry €2,236,942 + Exit €1,562,131 = Total **€3,799,073** ✅
> Fuel Gas Apr (X1=0.42%): 28,110,146 kWh = **€913,580** ✅

### ✅ P1 — Gas Quality & RBP Capacity Tracker

- [x] **US-505** · Horgoš quality Annex 3A Apr 2025 — 28 дней: GCV 11.523 kWh/Nm³, Wobbe 14.975, CH4 94.38%, Density 0.7656 ✅
- [x] **US-508** · Migration 006 — capacity_technical (3 IP), capacity_surrenders, 4 views, fn_create_surrender() ✅
- [x] **US-509** · capacity.js rewrite — GET /capacity/tracker, /rbp-offerings, /uioli, /tracker/:point_code ✅
- [x] **US-510** · Surrender workflow — POST /capacity/surrender, PATCH /rbp, NC Art.8.3 Uncovered Auction Premium ✅
- [x] **US-511** · UIOLI fallback — 72% utilization estimate (апр 2025 факт: 221M kWh/d vs ~330M contracted) ✅

> **Capacity Tracker проверен (inline Node.js test):**
> Surrender Premium: 500,000 kWh/h × 90d → reserve €516,575 − resale €431,507 = **€85,068** ✅

### ✅ P0 — Credit Support NC Art.5

- [x] **US-514** · Migration 007 — credit_support table, credit_rating_history, credit_support_events ✅
- [x] **US-515** · v_available_credit view — total/available/shortfall/utilization/risk_level ✅
- [x] **US-516** · v_credit_by_product view — минимальный размер по типу продукта NC Art.5.3.1 ✅
- [x] **US-517** · fn_check_rating_exempt() — BBB-/Baa3/Creditreform≤235 (IMMUTABLE function) ✅
- [x] **US-518** · fn_calc_min_credit_size() — мультипликаторы по product_type ✅
- [x] **US-518b** · credits.js rewrite — 14 endpoints NC Art.5 (instruments, ratings, eligibility, MC) ✅

> **Credit Support формулы NC Art.5.3.1 верифицированы:**
> Annual multiplier = 2/12 = 16.67% · Quarterly = 2/3 квартала = 22.22%
> Monthly = 100% месяца = 8.33% · Daily = 100% суток = 0.27%
> Rating exempt: BBB- (S&P/Fitch) ≥ Baa3 (Moody's) ≥ Creditreform ≤ 235

---

## 📋 Sprint 5 · Полный backlog (25.03 – 09.04.2026)

> Детали: `reports/SPRINT_5_PLAN.md`

### ✅ P0 — CAP-FIX (ЗАВЕРШЕНО)

- [x] **US-501** · Migration 005 — `capacity_entry_kwh_h` + `capacity_exit_kwh_h` + EXIT-SERBIA ✅
- [x] **US-502** · `calcCapacityFee()` — раздельный расчёт: entryFee + exitFee = totalFee ✅
- [x] **US-503** · Fuel Gas NC Art.18 + Late Payment NC Art.20.4.2 ✅
- [x] **US-504** · `contracts.js` — 3 flow directions + АЕРС тарифы по направлениям ✅

### ✅ P1 — Gas Quality (ЗАВЕРШЕНО)

- [x] **US-505** · Horgoš Annex 3A Apr 2025 — 28 rows gas_quality_daily seed ✅
- [x] **US-506** · GET /billing/gas-quality endpoint ✅
- [x] **US-507** · fuel_gas_kwh / fuel_gas_volume_nm3 в Invoice ✅

### ✅ P1 — RBP Capacity Tracker (ЗАВЕРШЕНО)

- [x] **US-508** · Migration 006 — capacity_technical, capacity_surrenders, 4 views, UIOLI ✅
- [x] **US-509** · capacity.js — Tracker, RBP offerings, UIOLI endpoint ✅
- [x] **US-510** · Surrender workflow + NC Art.8.3 premium ✅
- [x] **US-511** · UIOLI fallback logic ✅

### ✅ P0 — Credit Support NC Art.5 (ЗАВЕРШЕНО)

- [x] **US-514** · Migration 007 — credit_support, rating_history, support_events tables ✅
- [x] **US-515** · v_available_credit + v_credit_by_product views ✅
- [x] **US-516** · fn_check_rating_exempt() + fn_calc_min_credit_size() ✅
- [x] **US-517** · system_params seed — NC Art.5 параметры ✅
- [x] **US-518** · credits.js rewrite — NC Art.5 (14 endpoints) ✅

### ✅ P0 — Auction Management CAM NC / MAR0277-24 (ЗАВЕРШЕНО)

- [x] **US-519** · Migration 008 — auction_calendar (47 rows 2025-2026), auction_bids, fn_create_contract_from_bid() ✅
- [x] **US-520** · auctions.js — 15 endpoints: full lifecycle DRAFT→SUBMITTED→WON→CONTRACT_CREATED ✅
- [x] **US-521** · Credit check NC Art.5.3.1 pre-submission (calcCreditBlock per product_type) ✅
- [x] **US-522** · v_auction_overview + v_bid_lifecycle + v_upcoming_auctions views ✅
- [x] **US-523** · Timeline endpoint — events grouped by week (90 day window) ✅
- [x] **US-524** · capacity.js — next_auctions graceful integration от auction_calendar ✅

> **Auction seed (MAR0277-24, ENTSOG Oct 2024):**
> Annual FIRM: 07.07.2025 (Horgoš) · Quarterly: AQC-1…4 · Monthly FIRM (3rd Mon M-1) · Interruptible (4th Tue M-1)
> fn_create_contract_from_bid() → auto GTA-YYYY-NNN + АЕРС тарифы по flow_direction ✅

### ✅ P1 — Infrastructure (ЗАВЕРШЕНО)

- [x] **US-525** · Swagger/OpenAPI 3.0 — `openapi.yaml` 60+ endpoints, CDN Swagger UI (без npm) ✅
- [x] **US-526** · Integration tests — Jest+Supertest: 33 test cases (billing/credits/auctions) ✅
- [x] **US-527** · GitHub Actions CI/CD — 5 jobs: lint, test+PG, security, openapi-validate, build-check ✅
- [ ] **US-528** · WebSocket сервер (socket.io) — Sprint 6
- [ ] **US-529** · Credit alert push notifications — Sprint 6

---

## ✅ Sprint 4 · Выполнено (23.03.2026)

> Sprint 4 завершён досрочно — план 06.04–19.04.2026, факт 23.03.2026 (+14 дней опережение).

- [x] **DB-01–10** · PostgreSQL схема (8 таблиц) + миграции + seed data ✅
- [x] **AUTH-01–08** · JWT + Argon2id + RBAC middleware ✅
- [x] **NOM-01–07** · Nominations REST API (CRUD + matching + renom) ✅
- [x] **CRED-01–04** · Credit positions API + Margin Call ✅
- [x] **BILL-01–04** · Billing API + ERP sync endpoint ✅
- [x] **FE-01–08** · api.js + интеграция GTCP_MVP.html ✅
- [x] **CTR-01–02, CAP-01–02** · Contracts + Capacity + Balance API ✅
- [x] **DEV-01–05** · Docker Compose + README ✅
- [x] **CAM-01–06** · 003_contracts_nc.sql, contracts.js rewrite (CAM NC) ✅
- [x] **TAR-01–08** · 004_tariff_official.sql, billing.js (АЕРС 05-145) ✅
- [x] **UI-01–05** · GTCP_MVP.html — contracts form CAM NC, invoice capacity mode ✅
- [x] **REP-01** · Отчёт_Sprint4_FINAL.docx v3 (разд. 12 + 13) ✅
- [x] **ANA-01** · Gastrans_Capacity_Analysis.xlsx — анализ entry/exit мощностей ✅

### ⚠️ Sprint 4 Review — Критическая находка

**Дата обнаружения:** 25.03.2026

**Проблема:** Анализ реальных данных АЕРС (VOLUMES TOTAL.xlsx) показал:
- Reserved Entry Kirevo: **13 752 230 kWh/h** (≠ Reserved Exit Horgoš: **9 216 209 kWh/h**)
- Текущая формула использует единое `capacity_kWh_h` для обоих тарифов → ошибка до **±31M EUR/год**
- Также выявлена необходимость поддержки domestic exit zone (4 536 021 kWh/h reserved)

**Статус:** ✅ ИСПРАВЛЕНО в Sprint 5 (US-501–504, migration 005)

**Контрольный расчёт (31 дн., Annual Firm):** 10 255 724 EUR ✅ верифицировано

---

## ✅ Sprint 7 · Выполнено (26.03.2026)

| # | Задача | Ответственный | Срок | Статус |
|---|---|---|---|---|
| A-124 | Migration 009 — NC route alignment: 6 IP кодов, 7 маршрутов, nc_routes ref table | Backend Dev | 26.03.2026 | ✅ DONE |
| A-125 | src/utils/ncRoutes.js — константы POINTS, NC_ROUTES (7), helpers: getRoute/resolvePoints/isValid | Backend Dev | 26.03.2026 | ✅ DONE |
| A-126 | seed.sql — NC-correct: удалены 'Horgoš'/'Gospođinci' plain-text, добавлены EXIT-пары контрактов | Backend Dev | 26.03.2026 | ✅ DONE |
| A-127 | CLAUDE.md — NC compliance checklist (18 областей), Discrepancy Protocol, все IP/маршруты/продукты | Tech Lead | 26.03.2026 | ✅ DONE |
| A-128 | KIREVO-EXIT NC §2.1 — добавлена симметричная EXIT-точка для Full Reverse маршрутов | Backend Dev | 26.03.2026 | ✅ DONE |
| A-129 | GTCP_UserGuide_v1.1 (.md + .docx) — обновлено: 6 IP точек, KIREVO-EXIT, NC-correct маршруты | Tech Lead | 26.03.2026 | ✅ DONE |
| A-130 | SPRINT_7_REPORT.md — итоговый отчёт спринта | Tech Lead | 26.03.2026 | ✅ DONE |

---

## 🔥 Немедленные действия — Sprint 8 (10.04 – 30.04.2026)

- [ ] **A-117** · VPS деплой — nginx + PM2 + SSL/Let's Encrypt (публичный URL для демо)
- [ ] **A-119** · WebSocket real-time (socket.io) — алерты по кредитным лимитам (US-528)
- [ ] **A-120** · Email-уведомления — Margin Call, просрочка (US-529)
- [ ] **A-121** · OWASP Top 10 testing — penetration + fix
- [ ] **A-122** · Аналитический дашборд — графики объёмов, трендов
- [ ] **A-123** · Уточнить domestic exit тарифы у АЕРС → обновить system_params

---

## 🎓 Дипломная работа · Чеклист

- [x] Business Model Canvas (BMC) заполнен
- [x] Анализ рынка выполнен
- [x] Техническое задание написано (`.docx` + `.md`)
- [x] MVP разработан (GTCP_MVP.html — все 15 FR)
- [x] Отчёт о ходе разработки написан
- [x] Дипломный текст (GTCP_Diploma_Text.docx)
- [x] Презентация для защиты (GTCP_Diploma_Presentation.pptx)
- [x] Backend API реализован (Sprint 4)
- [x] CAM NC договоры — 7 типов, GTA-нумерация (Sprint 4)
- [x] Официальные тарифы АЕРС интегрированы (Sprint 4)
- [x] **Capacity billing исправлен (entry/exit split) — Sprint 5** ✅
- [x] **Gas Quality Annex 3A + Fuel Gas NC Art.18 — Sprint 5** ✅
- [x] **RBP Capacity Tracker + UIOLI + Surrender — Sprint 5** ✅
- [x] **Credit Support NC Art.5 (гарантии, рейтинг, MC) — Sprint 5** ✅
- [x] **Auction Management CAM NC MAR0277-24 (lifecycle + calendar 47 rows) — Sprint 5** ✅
- [x] **OpenAPI 3.0 + Swagger UI (CDN, без npm) — Sprint 5** ✅
- [x] **Integration tests Jest+Supertest (56 cases: billing/credits/auctions) — Sprint 6** ✅
- [x] **GitHub Actions CI/CD (5 jobs: lint/test/security/openapi/build) — Sprint 5** ✅
- [x] **Credit Support UI + Auction Management UI — Sprint 6** ✅
- [x] **ERP Connector (erp-connector.js) + VPS infra конфиги — Sprint 6** ✅
- [x] **Migrations 004–008 fix (UUID FK, JSONB) + 56/56 тестов — Sprint 6** ✅
- [x] **NC Route alignment (009 + ncRoutes.js + seed) + KIREVO-EXIT §2.1 — Sprint 7** ✅
- [x] **CLAUDE.md NC compliance checklist + Discrepancy Protocol — Sprint 7** ✅
- [x] **Руководство пользователя v1.1 (NC-correct: 6 IP, 7 маршрутов) — Sprint 7** ✅
- [ ] Демо-стенд доступен по публичному URL — Sprint 8
- [ ] **Защита дипломной работы** (Июн 2026)

---

## 🔧 Архитектурные решения (ADR)

### ADR-001 · Frontend без фреймворка
**Дата:** 03.03.2026 | **Статус:** ПРИНЯТО

**Решение:** Vanilla JS (один HTML-файл)
**Причина:** Максимальная простота деплоя, нет сборки
**Последствие:** Sprint 6+ — рассмотреть миграцию на React 18 для Production

---

### ADR-002 · База данных
**Дата:** 23.03.2026 | **Статус:** ПРИНЯТО

**Решение:** PostgreSQL 17
**Причина:** ACID транзакции критичны для финансовых данных; JSON поддержка; ENTSO-G совместимость

---

### ADR-003 · Аутентификация
**Дата:** 23.03.2026 | **Статус:** ПРИНЯТО

**Решение:** JWT (access 24h + refresh 7d) + Argon2id хэширование
**Причина:** Stateless API, масштабируемость, безопасность

---

### ADR-004 · CAM NC договоры
**Дата:** 23.03.2026 | **Статус:** ПРИНЯТО

**Решение:** 7 типов договоров по CAM NC EU 2017/459; нумерация GTA-YYYY-NNN
**Реализация:** 003_contracts_nc.sql + contracts.js

---

### ADR-005 · Модель биллинга
**Дата:** 23.03.2026 | **Статус:** УТОЧНЕНО → ADR-006

**Решение:** Capacity-based take-or-pay (EUR/(kWh/h)/год) согласно АЕРС 05-145
**Формула (Sprint 4):** `capacity_fee = cap × (t_entry + t_exit) / 365 × days`
**✅ Исправлено в Sprint 5 (ADR-006)**

---

### ADR-006 · Раздельный учёт Entry/Exit capacity
**Дата:** 25.03.2026 | **Статус:** ✅ РЕАЛИЗОВАНО (Sprint 5)

**Решение:** `capacity_fee = cap_entry × t_entry / 365 × days + cap_exit × t_exit / 365 × days`
**Причина:** Entry Kirevo (13 752 230 kWh/h) ≠ Exit Horgoš (9 216 209 kWh/h) — разница 4 536 021 kWh/h уходит в domestic zone. Единая формула даёт ошибку до ±31M EUR/год.
**Источник:** VOLUMES TOTAL.xlsx (АЕРС, Табела 1 — реальные технические данные Gastrans)
**Реализация:** 005_capacity_entry_exit.sql + billing.js

---

### ADR-007 · EXIT_SERBIA как единая точка (NC Art. 6.3.1)
**Дата:** 25.03.2026 | **Статус:** ✅ РЕАЛИЗОВАНО (Sprint 5)

**Решение:** 1 EXIT_SERBIA в interconnection_points (не 3 отдельные точки: Paraćin + Pančevo + Gospođinci)
**Причина:** Gastrans NC Art. 6.3.1 — Domestic Exit Zone объединяется в одну интерфейсную точку для шипперов
**Новое направление:** `KIREVO_EXIT_SERBIA` (тариф Entry 6.00 + Exit 4.19 EUR/(kWh/h)/yr)
**Мощность:** 4 536 021 kWh/h reserved (= Entry 13 752 230 − Exit Horgoš 9 216 209)
**Реализация:** 005_capacity_entry_exit.sql + contracts.js

---

### ADR-008 · Gas Quality — реальные данные Horgoš Annex 3A
**Дата:** 25.03.2026 | **Статус:** ✅ РЕАЛИЗОВАНО (Sprint 5)

**Решение:** Использовать реальные данные качества газа FGSZ Ltd. / GMS Kiskundorozsma 2 (Апрель 2025)
**Данные:** GCV avg 11.523 kWh/Nm³, Wobbe avg 14.975, CH4 avg 94.38%, Density avg 0.7656 kg/Nm³
**Fuel Gas NC Art.18:** FG = X1 × Q_horgos + X2 × Q_serbia − KN (X1=0.42%, X2=0.08%)
**Реализация:** 005_capacity_entry_exit.sql seed (28 rows) + billing.js calcFuelGas()

---

### ADR-009 · RBP Capacity Tracker — чтение из contracts
**Дата:** 25.03.2026 | **Статус:** ✅ РЕАЛИЗОВАНО (Sprint 5)

**Решение:** Вариант A — tracker свободных мощностей (оперативная витрина)
**Принцип:** free = GREATEST(0, reserved − contracted + surrendered) по каждому IP и продукту
**UIOLI:** unutilized annual capacity → daily FCFS pool (CAM NC Art.13-16)
**Surrender:** Uncovered Auction Premium = reserve_revenue − resale_revenue (NC Art.8.3 + Art.20.3.2.4)
**Реализация:** 006_capacity_tracker.sql + capacity.js

---

### ADR-010 · Credit Support NC Art.5: URDG 758 или эскроу
**Дата:** 25.03.2026 | **Статус:** ✅ РЕАЛИЗОВАНО (Sprint 5)

**Решение:** Поддержка двух форм: Bank Guarantee (URDG 758, банк ≥ BBB-) и Escrow
**Размер (NC Art.5.3.1):**
- Annual: 2/12 годовой capacity fee (≈16.7%)
- Quarterly: 2/3 квартальной (≈22.2%)
- Monthly: 100% месяца (≈8.3%)
- Daily: 100% суток (≈0.27%)

**Margin Call NC Art.5.5:** 2 рабочих дня на доплнение
**Реализация:** 007_credit_support.sql + credits.js (14 endpoints)

---

### ADR-011 · Рейтинговое освобождение (NC Art.5.4)
**Дата:** 25.03.2026 | **Статус:** ✅ РЕАЛИЗОВАНО (Sprint 5)

**Решение:** Шипперы с инвестиционным рейтингом освобождаются от предоставления гарантии
**Критерии:** S&P/Fitch ≥ BBB- ИЛИ Moody's ≥ Baa3 ИЛИ Creditreform ≤ 235
**Реализация:** fn_check_rating_exempt() (IMMUTABLE) + credit_rating_history + credits.js

---

### ADR-012 · NC Route Alignment — 7 канонических маршрутов
**Дата:** 26.03.2026 | **Статус:** ✅ РЕАЛИЗОВАНО (Sprint 7)

**Решение:** Все flow_direction коды выровнены по NC §2.1 и Art. 6.1.2. Создана таблица `nc_routes` (справочник 7 маршрутов с RU/EN описаниями и ссылками на статьи NC). Устаревшие коды `GOSPODJINCI_HORGOS` и `HORGOS_GOSPODJINCI` сохранены в CHECK для совместимости, но не используются в новых записях.
**Реализация:** 009_nc_routes.sql + ncRoutes.js + seed.sql

---

### ADR-013 · KIREVO-EXIT — симметричная EXIT-точка (NC §2.1)
**Дата:** 26.03.2026 | **Статус:** ✅ РЕАЛИЗОВАНО (Sprint 7)

**Решение:** Добавлен отдельный код `KIREVO-EXIT` для Exit Point Kirevo/Zaječar в коммерческих реверс-контрактах. Ранее неправильно использовался `KIREVO-ENTRY` в роли exit_point_code для маршрутов HORGOS_KIREVO и EXIT_SERBIA_KIREVO.
**Причина NC §2.1:** физически это одна точка, но NC именует её «Entry Point Kirevo/Zaječar» при физическом потоке и «Exit Point Kirevo/Zaječar» при коммерческом реверсе — как HORGOS-ENTRY/HORGOS-EXIT и EXIT-SERBIA-ENTRY/EXIT-SERBIA.
**Реализация:** 009_nc_routes.sql (INSERT + contracts UPDATE) + ncRoutes.js POINTS.KIREVO_EXIT + User Guide v1.1

---

### ADR-014 · Real-time обновления
**Дата:** 23.03.2026 | **Статус:** ЗАПЛАНИРОВАНО (Sprint 8)

**Решение:** WebSocket (socket.io)
**Текущий MVP:** setInterval(30s) — временное решение
**Причина:** Критично для кредитного монитора (мгновенные алерты при превышении лимита)

---

### ADR-015 · VPS деплой
**Дата:** 23.03.2026 | **Статус:** ЗАПЛАНИРОВАНО (Sprint 8)

**Решение:** nginx reverse proxy + PM2 process manager + Let's Encrypt SSL
**Кандидаты:** Hetzner CX21 (2vCPU/4GB) или DigitalOcean Basic Droplet

---

## ⚠️ Открытые вопросы

| ID | Вопрос | Приоритет | Срок |
|---|---|---|---|
| Q-001 | Какой VPS для деплоя? (Hetzner / DigitalOcean / Yandex Cloud) | 🔴 High | до 10.04.2026 |
| Q-002 | Есть ли реальный API у 1С ERP для интеграции? | 🔴 High | до 10.04.2026 |
| **Q-005** | **Тариф domestic exit (EXIT_SERBIA) из АЕРС 05-145 — верификация 4.19 EUR** | **🟡 Medium** | **до 09.04.2026** |
| Q-003 | Нужна ли мультиязычность (EN/RU) для защиты? | 🟡 Medium | до 06.04.2026 |
| Q-004 | Сколько реальных пользователей участвуют в UAT? | 🟡 Medium | до 15.04.2026 |
| **Q-006** | **EIC коды domestic points — верификация (ENTSO-G lookup)** | **🟡 Medium** | **до 15.04.2026** |
| **Q-007** | **EURIBOR 6M актуальный курс для calcLatePaymentInterest()** | **🟡 Medium** | **до 09.04.2026** |
| **Q-008** | **Creditreform Россия/Сербия — доступность рейтинговых отчётов для шипперов** | **🟢 Low** | **до 26.04.2026** |

---

## 📊 Метрики проекта

| Метрика | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 | Sprint 6 (факт) | Sprint 7 (факт) |
|---|---|---|---|---|---|---|---|
| Story Points delivered | 28 | 34 | 21 | ~54 | **~72** | **~38** ✅ | **~21** ✅ |
| FR реализовано | 7 | 15 | 15 | 15 (backend) | +NC + Auctions | +UI+ERP+QA | +NC align |
| Документов создано | 1 | 3 | 5 | 5 | 5 | **6** | **9** (+UG v1.1 ×2 + SPRINT_7_REPORT + CLAUDE.md) |
| Открытых дефектов (P0) | 0 | 0 | 0 | 1 (CAP-FIX) | 0 | **0** ✅ | **0** ✅ |
| Migrations applied | — | — | — | 4 (001–004) | 8 (005–008) | **8** (004–008 fix ✅) | **9** (+ 009_nc_routes ✅) |
| NC Routes (canonical) | — | — | — | — | — | — | **7** (009+ncRoutes.js ✅) |
| IP точек подключения | — | — | — | — | — | — | **6** (+ KIREVO-EXIT ✅) |
| Test cases passing | — | — | — | 0 | 33/33 | **56/56** ✅ | **56/56** ✅ |
| CI/CD jobs | — | — | — | 0 | 5 | **5** | **5** |
| NC Articles implemented | — | — | — | CAM NC | +Art.5,6.3,8.3,13-18,20 | **полная NC покрытость** | **+§2.1 IP/Routes align** |

---

## 📊 Cumulative Velocity

```
Sprint 1:  28 SP  [████████████████████████████░░░░░░░░░░░░░░░] 28/34
Sprint 2:  34 SP  [██████████████████████████████████░░░░░░░░░] 34/34
Sprint 3:  21 SP  [█████████████████████░░░░░░░░░░░░░░░░░░░░░] 21/21
Sprint 4: ~54 SP  [██████████████████████████████████████████████████████] 54/34 (+59%)
Sprint 5: ~72 SP  [████████████████████████████████████████████████████████████████████████] 72/58 (+24%) ✅
Sprint 6: ~38 SP  [██████████████████████████████████████░░░░] 38/40 ✅
Sprint 7: ~21 SP  [█████████████████████░░░░░░░░░░░░░░░░░░░░░] 21/32 ✅ (NC focus)
────────────────────────────────────────────────────────────────
Total: ~268 SP delivered of ~299 SP planned
Migrations: 9 (001-009, all clean) · NC Routes: 7 · IP Points: 6 · Tests: 56/56 ✅ · CI jobs: 5
NC Coverage: §2.1 IP/Routes + Art.5 + Art.6 + Art.8.3 + Art.13-16 + Art.18 + Art.20 + CAM ✅
Git: tag sprint-7 · branch main
```

---

## 📝 История изменений Action Plan

| Дата | Версия | Изменения |
|---|---|---|
| 23.03.2026 | 1.0 | Создан документ; Sprint 3 завершён; Sprint 4 backlog добавлен |
| 23.03.2026 | 1.1 | Sprint 4 kickoff: backend структура создана, P0 задачи выполнены |
| 25.03.2026 | 2.0 | Sprint 4 завершён досрочно (+CAM NC + АЕРС тарифы). Sprint 5 активирован. ADR-006 (capacity split) + ADR-007 (domestic points) добавлены. Q-005, Q-006 открыты. |
| 25.03.2026 | 3.0 | Sprint 5 (75% done): ✅ CAP-FIX (005+billing.js+contracts.js), ✅ Gas Quality Annex 3A, ✅ RBP Tracker (006+capacity.js), ✅ Credit Support NC Art.5 (007+credits.js). ADR-008–011 добавлены. A-101–105 закрыты. A-106–110 открыты. Q-007,Q-008 добавлены. Migrations: 005–007 применены. |
| 25.03.2026 | 3.1 | Sprint 5 (100% ✅): +Auction Management (008+auctions.js, 47 seed rows MAR0277-24), +OpenAPI 3.0 (openapi.yaml+swagger-ui.html), +Integration tests (33 cases, billing/credits/auctions), +GitHub Actions CI/CD (5 jobs). A-106–108,110 закрыты. A-111–115 открыты на Sprint 6. US-519–527 выполнены. SP: 72 (vs 58 план, +24%). |
| 26.03.2026 | 4.0 | Sprint 6 АКТИВЕН (26.03–10.04.2026): ✅ A-111 Credit Support UI, ✅ A-116 Auction Management UI, ✅ A-114 ERP Connector, ✅ A-112 VPS infra конфиги. sprint-close.sh skill создан. |
| 26.03.2026 | 4.1 | Sprint 6 ЗАВЕРШЁН ✅: ✅ A-113 migrations 004/007/008 fix (UUID FK, JSONB quoting, column names), ✅ routes billing/credits/auctions — API контракт исправлен под тесты, ✅ 56/56 Jest тестов (18+21+17). Коммит e63fceb, тег sprint-6. Версии roadmap+actionplan+LOCAL_RUN обновлены. Pending → Sprint 7: VPS deploy + руководство пользователя. |
| 26.03.2026 | 5.0 | Sprint 7 ЗАВЕРШЁН ✅: ✅ A-124 Migration 009 NC route alignment (7 маршрутов, nc_routes ref table), ✅ A-125 ncRoutes.js (POINTS×6, NC_ROUTES×7, helpers), ✅ A-126 seed NC-correct (EXIT-пары, убраны plain-text точки), ✅ A-127 CLAUDE.md (NC compliance checklist 18 областей + Discrepancy Protocol), ✅ A-128 KIREVO-EXIT NC §2.1 симметрия (3 физических точки × 2 = 6 кодов), ✅ A-129 GTCP_UserGuide_v1.1 (.md+.docx, 1279 параграфов). ADR-012/013 добавлены. Тег sprint-7. Pending → Sprint 8: VPS deploy + WebSocket + OWASP. |
| 26.03.2026 | 5.1 | Sprint 5 завершён, отчёт сформирован (SPRINT_5_REPORT.md): ~72 SP доставлено (план 36 SP, +100%). P0 CAP-FIX верифицирован €10 255 724. Credit Support NC Art.5, Auction Management CAM NC MAR0277-24, OpenAPI 3.0, CI/CD — все в DoD. |
| 06.04.2026 | 14.1 | Sprint 15 завершён, отчёт сформирован (SPRINT_15_REPORT.md): ~16 SP доставлено (план 16 SP, 100%). 9/9 задач: NC IP codes в demo data, документация Sprint 14 alignment, CLAUDE.md endpoints updated. NC coverage 79%. |
| 06.04.2026 | 16.0 | Sprint 16 plan сформирован автоматически: 9 US, 35 SP. P0: NC Art.13 Matching (100%), Art.15 Balancing (75%). P1: Analytics Dashboard, Export CSV/Excel, k6, UserGuide v3.4. P2: VTP Art.11. |

---

## 📌 Правила ведения этого документа

1. **После каждого Sprint Review** — обновить статусы задач, добавить следующий спринт
2. **При принятии архитектурного решения** — добавить ADR с датой и обоснованием
3. **При выявлении дефекта P0** — добавить в «Немедленные действия» с дедлайном 48ч
4. **Метрики** — обновлять в конце каждого спринта
5. **История изменений** — добавлять строку при каждом обновлении

---

*Action Plan обновляется в конце каждого Sprint Review.*
*Связанные документы: `roadmap.md` · `SPRINT_5_PLAN.md` · `Отчёт_Sprint4_FINAL.docx`*
