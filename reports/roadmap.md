# GTCP — Project Roadmap
**Gas Trading & Commercial Platform · Full Delivery Plan**

> Последнее обновление: 10.04.2026 · Версия 12.1 · Sprint 16 в процессе (18/43 SP)

---

## 🗺️ Общая картина

```
Phase 0       Phase 1 (MVP)         Phase 2 (Backend)         Phase 3         Phase 4 (NC)           Phase 5 (RBP)        Phase 6 (QA)
Jan–Feb 2026  Mar 2026              Mar 2026                   Mar 2026        Mar–Apr 2026           May–Jun 2026         Mar 2026
─────────────┬─────────────────────┬──────────────────────────┬───────────────┬──────────────────────┬────────────────────┬──────────────
  Research   │  Sprint 1–3 (MVP)   │  Sprint 4–7 (API+DB+NC)  │  Sprint 8–9   │  Sprint 10 (Lines)   │  Sprint 11–12      │  Sprint 13
  ТЗ, BMC    │  ✅ ЗАВЕРШЕНО        │  ✅ ЗАВЕРШЕНО             │  ✅ ЗАВЕРШЕНО  │  ✅ ЗАВЕРШЕНО         │  📋 ПЛАН           │  ✅ TESTING
```

---

## ✅ Phase 0 — Исследование и планирование (ЗАВЕРШЕНО)

| Артефакт | Статус | Файл |
|---|---|---|
| Business Model Canvas | ✅ Готово | `Diploma/ETRM_Busines_Model_Canvas.xlsx` |
| Анализ рынка | ✅ Готово | `01 Market analys/Анализ_рынка.xlsx` |
| Техническое задание | ✅ Готово | `ТЗ_GTCP_MVP.md` |
| Дипломная работа (текст) | ✅ Готово | `GTCP_Diploma_Text.docx` |
| Презентация для защиты | ✅ Готово | `GTCP_Diploma_Presentation.pptx` |

---

## ✅ Phase 1 — MVP Frontend (ЗАВЕРШЕНО)

### Sprint 1 · Дизайн и структура
**Период:** 03.03 – 16.03.2026 | **Velocity:** 28 SP | **Статус:** ✅

| ID | Задача | SP | Статус |
|---|---|---|---|
| S1-01 | Дизайн-система (цвета, шрифты, компоненты) | 5 | ✅ |
| S1-02 | HTML-каркас (topbar, sidebar, main) | 3 | ✅ |
| S1-03 | Dashboard KPI + таблица грузоотправителей | 5 | ✅ |
| S1-04 | Модуль номинаций — базовый список | 5 | ✅ |
| S1-05 | Модуль биллинга — список счётов | 5 | ✅ |
| S1-06 | Модуль договоров — реестр | 3 | ✅ |
| S1-07 | Прототип (index_0.html) | 2 | ✅ |

### Sprint 2 · Бизнес-логика
**Период:** 17.03 – 23.03.2026 | **Velocity:** 34 SP | **Статус:** ✅

| ID | Задача | SP | Статус |
|---|---|---|---|
| S2-01 | Аутентификация + RBAC (5 ролей) | 5 | ✅ |
| S2-02 | Алгоритм матчинга ENTRY/EXIT | 5 | ✅ |
| S2-03 | Реноминации с проверкой ±10% | 3 | ✅ |
| S2-04 | Кредитный монитор + Margin Call | 5 | ✅ |
| S2-05 | Модуль Balance (прогресс-бары, имбаланс) | 3 | ✅ |
| S2-06 | Биллинг: авторасчёт + смена статусов | 3 | ✅ |
| S2-07 | ERP-синхронизация (симуляция) | 2 | ✅ |
| S2-08 | Журнал аудита (FR-15) | 3 | ✅ |
| S2-09 | Capacity + Contracts (полные модули) | 3 | ✅ |
| S2-10 | Toast-уведомления + nav-badges | 2 | ✅ |

### Sprint 3 · Документация и полировка
**Период:** 23.03.2026 | **Velocity:** 21 SP | **Статус:** ✅

| ID | Задача | SP | Статус |
|---|---|---|---|
| S3-01 | Техническое задание (GTCP-ТЗ-MVP-2026 v1.0) | 8 | ✅ |
| S3-02 | MVP финализация (GTCP_MVP.html) | 5 | ✅ |
| S3-03 | Отчёт о ходе разработки | 3 | ✅ |
| S3-04 | Sprint 4 Plan | 2 | ✅ |
| S3-05 | Roadmap + Action Plan + ТЗ в MD | 3 | ✅ |

**Итого Phase 1:** 83 SP · Все 15 FR из ТЗ реализованы ✅

---

## ✅ Phase 2 — Backend & Infrastructure (Sprint 4 ЗАВЕРШЁН ДОСРОЧНО)

### Sprint 4 · Backend Core + CAM NC + АЕРС Tariffs
**Период:** 23.03.2026 (досрочно) | **Velocity:** ~54 SP | **Статус:** ✅

> Sprint 4 завершён досрочно 23.03.2026 (план: 06.04–19.04.2026). Дополнительно реализованы CAM NC contracts и официальные тарифы АЕРС 05-145.

| Epic | Задача | SP | Статус |
|---|---|---|---|
| Database | Схема БД (8 таблиц) + миграции + seed | 5 | ✅ |
| Database | ORM layer (node-postgres + queries) | 3 | ✅ |
| Auth | JWT login/logout/refresh + Argon2id | 5 | ✅ |
| API | Nominations REST API (CRUD + match + renom) | 5 | ✅ |
| API | Credit positions + Margin Call API | 3 | ✅ |
| API | Billing API + ERP sync endpoint | 3 | ✅ |
| API | Contracts + Capacity + Balance API | 2 | ✅ |
| Frontend | api.js wrapper + подключение к backend | 5 | ✅ |
| DevOps | Docker Compose (api + db + nginx) | 3 | ✅ |
| CAM NC | 003_contracts_nc.sql — 7 типов GTA, 2 flow dir., EIC | 5 | ✅ |
| CAM NC | contracts.js rewrite — GTA-YYYY-NNN нумерация | 3 | ✅ |
| Тарифы АЕРС | 004_tariff_official.sql — АЕРС 05-145, 35 тарифных строк | 5 | ✅ |
| Тарифы АЕРС | billing.js — calcCapacityFee(), CAPACITY/VOLUME dual-mode | 3 | ✅ |
| Тарифы АЕРС | GTCP_MVP.html — Invoice modal + capacity billing UI | 3 | ✅ |
| MDAP | Анализ MDAP апрель 2025 (фактические потоки) | 2 | ✅ |
| Отчёт | Отчёт_Sprint4_FINAL v3 (разд. 12 + 13) | 2 | ✅ |

> ⚠️ **Sprint 4 Review (25.03.2026):** Выявлена критическая ошибка capacity billing формулы (±31M EUR/год). Исправление — P0 задача Sprint 5 (US-501–504).

> 📄 Детали: `reports/SPRINT_4_PLAN.md` · Отчёт: `reports/Отчёт_Sprint4_FINAL.docx` (v3) · Анализ: `reports/Gastrans_Capacity_Analysis.xlsx`

---

## ✅ Phase 7 — Sprint 14 · Auction Calendar + UAT · ЗАВЕРШЁН (31.03.2026)

### Sprint 14 · Auction Calendar + UAT Fixes + Data Integrity
**Период:** 30-31.03.2026 | **Velocity:** ~35 SP | **Статус:** ✅ ЗАВЕРШЁН

| Блок | SP | Результат |
|---|---|---|
| Auction Calendar (CAM NC MAR0277-24) | 10 | Day-centric calendar, /calendar/grid + /calendar/days, 115 DB auctions + Daily/WD on-the-fly |
| UAT Frontend Fixes | 10 | 10 backend→frontend compatibility fixes (auth token, response format, shipperId resolve, rate limiter) |
| Data Integrity | 8 | Contract→Booking→Nomination chain, 90/10 AERS split, capacity balanced per NC Art.12.3 |
| Dashboard P0 | 5 | Shipper code+name, active filter, GTA type, capacity KPI blocks (booked/free per IP) |
| NC Compliance Fix | 2 | Yearly Firm = only surrendered LT (Art.7.1.2), publication timing from MAR0277-24 |
| Available Capacity Engine | 5 | GET /capacity/available (real-time SQL, Option A), dynamic available in auctions, NC Art.7.1.1+7.3 formulas |
| EDIGAS v5.1 XML | 3 | Full NOMINT (01G/P03), NOMRES mock, sender/receiver EIC, direction Z02/Z03, GasDay timezone fix |
| Credit Instruments | 2 | credit_support table, 7 seed instruments (URDG 758, SBLC, escrow, parent guarantee), frontend mapping |
| Balance/Matching fixes | 2 | Matching via backend API, balance filter all non-rejected, gasDay timezone, active shippers only |
| Real-time analysis | 1 | Polling/WebSocket/PWA comparison document (reports/analysis-realtime-update-options.md) |

**Коммит:** `feat(sprint-14)` — backend routes, frontend, seeds, docs
**Отчёты:** `session-uat-frontend-2026-03-30.md`, `session-uat-dashboard-2026-03-31.md`, `session-auction-calendar-2026-03-31.md`

---

## ✅ Phase 6 — Sprint 13 · Testing Infrastructure · ЗАВЕРШЁН (30.03.2026)

### Sprint 13 · 442 Tests + CI/CD + PostgreSQL + Coverage 95%
**Период:** 30.03.2026 | **Velocity:** ~45 SP | **Статус:** ✅ ЗАВЕРШЁН

| Блок | SP | Результат |
|---|---|---|
| Backend infrastructure (middleware, db, routes, services) | 12 | 18 файлов: authenticate, authorize, errorHandler, db/index, logger, auditService, edigasService, auth/credits/capacity/balance/audit/systemParams routes |
| Integration tests Level 1 (supertest) | 10 | 6 suites, 75 tests: auth, billing, contracts, nominations, auctions, shippers |
| NC Compliance suite Level 3 | 5 | 1 suite, 79 tests: 9 NC sections (§2.1, Art.5, Art.6, Art.12, Art.18, Art.20, AERS 05-145) |
| Coverage push + DB-specific | 13 | 8 suites, 185 tests: billing.coverage/deep/unit/dbspec, auctions.coverage/dbspec, nominations.coverage/deep/dbspec, shippers.coverage, stubs, rbp.coverage/dbspec, edge-cases |
| Real-DB tests (no mock) | 2 | 1 suite, 6 tests: over-nominate Art.12.8, matching, contracts fallback |
| CI/CD + PostgreSQL | 5 | test.yml (2 jobs), docker-compose.test.yml, .env.test, 000_init.sql (19 tables), 015_views.sql (5 views), migrate.js, seed-runner.js |
| Billing rounding fix | — | toFixed(4) → toFixed(2), 120/436 mismatches eliminated |
| Bugfixes found by tests | — | 3 bugs: rounding, ReferenceError pts, missing column |

**Коммиты:** `33ccf6e` (43 files, +7233 lines) + `c38c400` (11 files, +1869 lines)
**Отчёт:** `reports/session-testing-infrastructure-2026-03-30.md`

---

## ✅ Phase 2 — Sprint 5 · ЗАВЕРШЁН (100%)

### Sprint 5 · Capacity Fix + NC Compliance + Credit Support + **Auction Management**
**Период:** 25.03.2026 (завершён досрочно) | **Target:** 72 SP | **Actual:** ~72 SP | **Статус:** ✅ ЗАВЕРШЁН

#### ✅ P0 — CAP-FIX (capacity billing — ЗАВЕРШЕНО)

| Epic | Задача | SP | Статус |
|---|---|---|---|
| **CAP-FIX** | **US-501: Migration 005 — capacity_entry_exit, EXIT-SERBIA, gas_quality_daily** | **3** | ✅ DONE |
| **CAP-FIX** | **US-502: calcCapacityFee() split entry/exit, HORGOS_GOSPODJINCI Commercial Reverse** | **2** | ✅ DONE |
| **CAP-FIX** | **US-503: calcFuelGas() NC Art.18 — X1=0.42%, X2=0.08%, GCV-нормализация** | **2** | ✅ DONE |
| **CAP-FIX** | **US-504: calcLatePaymentInterest() NC Art.20.4.2 — EURIBOR+3%, 360d** | **2** | ✅ DONE |
| **CAP-FIX** | **US-504b: contracts.js — 3 flow directions, KIREVO_EXIT_SERBIA, АЕРС тарифы** | **2** | ✅ DONE |

#### ✅ P1 — Gas Quality & Fuel Gas (ЗАВЕРШЕНО)

| Epic | Задача | SP | Статус |
|---|---|---|---|
| **GAS-Q** | **US-505: Horgoš quality data Annex 3A Apr 2025 — 28 дней GCV/Wobbe/CH4** | **2** | ✅ DONE |
| **GAS-Q** | **US-506: GET /billing/gas-quality endpoint** | **1** | ✅ DONE |
| **GAS-Q** | **US-507: Fuel Gas в Invoice (fuel_gas_kwh, volume_nm3)** | **2** | ✅ DONE |

#### ✅ P1 — Capacity Tracker / RBP Vitrine (ЗАВЕРШЕНО)

| Epic | Задача | SP | Статус |
|---|---|---|---|
| **RBP** | **US-508: Migration 006 — capacity_technical, capacity_surrenders, 4 views** | **3** | ✅ DONE |
| **RBP** | **US-509: capacity.js rewrite — GET /capacity/tracker + /rbp-offerings + /uioli** | **3** | ✅ DONE |
| **RBP** | **US-510: Surrender workflow POST/GET/PATCH — NC Art.8.3 Uncovered Auction Premium** | **2** | ✅ DONE |
| **RBP** | **US-511: UIOLI fallback (72% utilization estimate vs actuals)** | **1** | ✅ DONE |

#### ✅ P0 — Credit Support NC Art.5 (ЗАВЕРШЕНО)

| Epic | Задача | SP | Статус |
|---|---|---|---|
| **CRED** | **US-514: Migration 007 — credit_support table, v_available_credit, fn_calc_min_credit_size** | **3** | ✅ DONE |
| **CRED** | **US-515: credit_rating_history, credit_support_events tables** | **2** | ✅ DONE |
| **CRED** | **US-516: fn_check_rating_exempt() — BBB-/Baa3/Creditreform≤235** | **1** | ✅ DONE |
| **CRED** | **US-517: v_available_credit view — total/available/shortfall/risk_level** | **2** | ✅ DONE |
| **CRED** | **US-518: credits.js rewrite — 14 endpoints NC Art.5 (instruments, ratings, MC, eligibility)** | **4** | ✅ DONE |

#### ✅ P0 — Auction Management CAM NC (ЗАВЕРШЕНО)

| Epic | Задача | SP | Статус |
|---|---|---|---|
| **AUCTION** | **US-519: Migration 008 — auction_calendar (47 строк MAR0277-24 2025-2026) + auction_bids** | **4** | ✅ DONE |
| **AUCTION** | **US-520: fn_create_contract_from_bid() — авто-контракт из победы в аукционе** | **2** | ✅ DONE |
| **AUCTION** | **US-521: v_auction_overview + v_bid_lifecycle + v_upcoming_auctions views** | **2** | ✅ DONE |
| **AUCTION** | **US-522: auctions.js — 14 endpoints (lifecycle: DRAFT→SUBMIT→RESULT→CONTRACT)** | **4** | ✅ DONE |
| **AUCTION** | **US-523: capacity.js — next_auctions из auction_calendar в /rbp-offerings** | **1** | ✅ DONE |
| **AUCTION** | **US-524: /auctions/timeline — 90-дневный timeline аукционных событий** | **1** | ✅ DONE |

> **Источник:** MAR0277-24 Final (October 7th 2024, ENTSOG). 47 строк аукционного расписания: Annual (2), Quarterly (11), Monthly (24), Daily (1 template), Within-Day (1 template).

> **Lifecycle:** Free Capacity → `POST /auctions/bids` → `POST /bids/:id/submit` → `POST /bids/:id/result` → `POST /bids/:id/create-contract` → Billing

#### ✅ P1 — Infrastructure (ЗАВЕРШЕНО)

| Epic | Задача | SP | Статус |
|---|---|---|---|
| Infra | **US-525: OpenAPI 3.0** — `openapi.yaml` 60+ endpoints + `swagger-ui.html` (CDN) | 3 | ✅ DONE |
| Infra | **US-526: Integration tests** — Jest+Supertest: 33 test cases (billing/credits/auctions) | 4 | ✅ DONE |
| Infra | **US-527: GitHub Actions CI/CD** — 5 jobs: lint/test/security/openapi-validate/build-check | 3 | ✅ DONE |
| P2 | US-528: WebSocket (socket.io) | 4 | 🔲 Sprint 6 |
| P2 | US-529: Credit alert push | 2 | 🔲 Sprint 6 |

> 📄 Детальный план: `reports/SPRINT_5_PLAN.md`

---

## ✅ Phase 3 — Sprint 6 · ЗАВЕРШЁН (26.03.2026)

### Sprint 6 · ERP Integration + QA + Infrastructure
**Период:** 26.03.2026 (завершён досрочно) | **Target:** ~40 SP | **Actual:** ~38 SP | **Статус:** ✅ ЗАВЕРШЁН

> Sprint 6 завершён досрочно 26.03.2026. Исправлены все миграционные ошибки, тест-сьют расширен до 56 тестов (все pass).

| Epic | Задача | SP | Статус |
|---|---|---|---|
| Frontend | **A-111** Credit Support UI — 4 таба: Позиции/Инструменты NC Art.5/Рейтинги/MC | 3 | ✅ |
| Frontend | **A-116** Auction Management UI — CAM NC, заявки, credit check NC Art.5, 5 статусов | 3 | ✅ |
| Backend | **A-114** ERP Connector — `erp-connector.js` (mock mode + 1С REST skeleton) | 3 | ✅ |
| DevOps | **A-112** VPS infra — `nginx.conf` SSL+proxy+gzip + `ecosystem.config.js` PM2 cluster | 3 | ✅ |
| QA/DB | **A-113** Migrations 004/007/008 — UUID FK fix, JSONB quoting, column names | 3 | ✅ |
| QA | **A-113** Jest тесты — исправлены routes (billing/credits/auctions), **56/56 passing** | 5 | ✅ |
| Tooling | sprint-close.sh — автоматизация закрытия спринта (skill) | 1 | ✅ |
| DevOps | `scripts/sprint-close.sh` — в репозитории, тег sprint-6 создан | 1 | ✅ |

> **Детали QA (26.03.2026):** migrations 004–008 применены без ошибок. Тест-сьют: **56 тестов** (18 billing + 21 credits + 17 auctions), все pass. Зафиксировано в коммите `e63fceb`, тег `sprint-6`.

> 📌 **Pending (не блокирует Sprint 7):** VPS публичный деплой (требует внешнего сервера), WebSocket (US-528), Email-алерты (US-529).

### Sprint 7 · NC Route Alignment + User Guide v1.1
**Период:** 26.03.2026 (выполнен досрочно) | **Target:** ~32 SP | **Actual:** ~21 SP | **Статус:** ✅ ЗАВЕРШЁН

> Sprint 7 сосредоточен на соответствии Сетевому кодексу: все маршруты и точки подключения выровнены по NC §2.1. Добавлена NC PDF как binding rule; создан CLAUDE.md с Discrepancy Protocol.

| Epic | Задача | SP | Статус |
|---|---|---|---|
| NC | **A-124** Migration 009 — NC route alignment: 6 IP, nc_routes ref table (7 маршрутов), legacy backfill | 5 | ✅ |
| NC | **A-125** ncRoutes.js — POINTS×6, NC_ROUTES×7, getRoute/resolvePoints/isValidFlowDirection | 3 | ✅ |
| NC | **A-126** seed.sql — NC-correct: убраны plain-text 'Horgoš'/'Gospođinci', EXIT-пары bookings | 2 | ✅ |
| NC | **A-128** KIREVO-EXIT NC §2.1 — симметричная EXIT-точка Full Reverse (3×2=6 кодов) | 2 | ✅ |
| Docs | **A-127** CLAUDE.md — NC compliance checklist 18 областей + Discrepancy Protocol | 3 | ✅ |
| Docs | **A-129** GTCP_UserGuide_v1.1 (.md + .docx) — 6 IP точек, NC-correct маршруты | 5 | ✅ |
| Docs | **A-130** SPRINT_7_REPORT.md — итоговый отчёт | 1 | ✅ |

> 📌 **Pending (перенесено в Sprint 8):** VPS деплой, WebSocket, OWASP, Email-уведомления.

### Sprint 8 · Frontend-Backend Alignment + Security + VPS
**Период:** 26.03 – 30.04.2026 | **Target:** ~50 SP | **Статус:** 🔄 В ПРОЦЕССЕ

> Sprint 8 начат досрочно 26.03.2026 с задачи Frontend-Backend Alignment. api.js обновлён до v2.0 (65 методов), все 10 модулей фронтенда подключены к реальному бэкенду.

#### ✅ P0 — Frontend-Backend Alignment (ЗАВЕРШЕНО 26.03.2026)

| Epic | Задача | SP | Статус |
|---|---|---|---|
| Frontend | **A-133** api.js v2.0 — 65 методов: auctions lifecycle, capacity tracker, credits NC Art.5, systemParams | 5 | ✅ |
| Frontend | **A-134** `_refreshFromBackend()` — все модули (credits/auctions/capacity/audit) | 3 | ✅ |
| Frontend | **A-135** Credit wiring — addInstrument, updateRating, MC через API | 2 | ✅ |
| Frontend | **A-136** Auctions — 2-step bid flow (DRAFT→SUBMITTED) | 2 | ✅ |
| Frontend | **A-137** Capacity — 4 таба (Bookings/Tracker NC §2.1/RBP/UIOLI) | 3 | ✅ |
| Frontend | **A-138** Nominations — EDIGAS NOMINT XML preview | 1 | ✅ |
| Frontend | **A-139** Billing — Gas Quality NC Art.17 + Statement button | 2 | ✅ |
| Frontend | **A-140** System Parameters page (admin: points + params) | 2 | ✅ |
| Infra | **A-131** Swagger UI CSP fix (helmet relaxation for /docs) | 1 | ✅ |
| Infra | **A-132** CORS config for frontend http-server | 1 | ✅ |

#### 🔲 P0 — Security & Deploy (в очереди)

| Задача | SP | Приоритет |
|---|---|---|
| VPS деплой (nginx + PM2 + SSL/Let's Encrypt) — публичный демо-URL | 5 | P0 |
| OWASP Top 10 penetration testing | 5 | P0 |
| Исправление выявленных уязвимостей | 3 | P0 |
| User Acceptance Testing (UAT) | 3 | P1 |

#### 🔲 P1 — Real-Time & Notifications (в очереди)

| Задача | SP | Приоритет |
|---|---|---|
| WebSocket real-time dashboard (US-528, ADR-014) | 4 | P1 |
| Email-уведомления (Margin Call, просрочка) (US-529) | 3 | P1 |
| UserGuide v1.2 — обновить под реальный API | 3 | P1 |

### Sprint 10 · Frontend Real Data + NC Art.3 + VPS Deploy
**Период:** 10.04 – 30.04.2026 | **Target:** ~61 SP | **Статус:** 📋 ПЛАН

> Sprint 9 NC Audit (27.03.2026) выявил: backend NC-compliant, но frontend использует
> hardcoded demo данные вместо реальных API. Sprint 10 устраняет ВСЕ frontend разрывы.

#### P0 — Frontend Real Data (14 SP) ← КРИТИЧНО

| # | Задача | SP | Проблема |
|---|---|---|---|
| F-1 | **Balance: реальные tech capacities** — заменить `PHYS_CAP={HORGOS:12000}` на `API.capacity.tracker.overview()` | 2 | Баланс показывает фейковые 12000 МВт/ч вместо 15.28M/10.24M/5.04M kWh/h |
| F-2 | **Invoice modal: два поля cap_entry + cap_exit** — раздельный расчёт, автозаполнение из контракта | 3 | Одно поле capacity, формула `cap × bundled / 365 × days` — НЕ separate entry/exit |
| F-3 | **Reserve Prices API** — `GET /api/v1/reserve-prices` + frontend подтягивает тариф по product_type + point_code | 3 | 57 тарифов в БД, но ни один не вызывается из frontend |
| F-4 | **Balance: NC point codes** — заменить HORGOS/GOSPODJINCI на KIREVO-ENTRY/HORGOS-EXIT/EXIT-SERBIA | 2 | Legacy names в balance cards |
| F-5 | **Contract filter dropdown: NC codes primary** — KIREVO_HORGOS вместо GOSPODJINCI_HORGOS | 1 | Dropdown для фильтра контрактов: legacy коды |
| F-6 | **Fuel Gas params: из system_params** — проверить loadFuelGasParams() реально работает | 1 | Hardcoded fallback `ratePct:0.50, priceEurMwh:32.50` |
| F-7 | **Capacity Tracker: проверить data mapping** — by_point формат vs API response | 2 | Табы Трекер/RBP/UIOLI могут показывать пустые таблицы |

#### P0 — NC Art.3: Shipper Registration Workflow (15 SP)

| # | Задача | SP | NC Ref |
|---|---|---|---|
| A-172 | Shipper lifecycle: APPLICANT → APPROVED → ACTIVE → REMOVED | 3 | Art.3.1–3.3 |
| A-173 | Extend `shippers` table: address, company_id, tax_id, license_no, representative_name, representative_email | 3 | Art.3.3.2 |
| A-174 | `gta_type` field: SHORT_TERM / LONG_TERM | 2 | Art.3.4 vs 3.8 |
| A-175 | Removal logic: contracted capacity = 0 + debt = 0 + 3 BD SLA | 3 | Art.3.7 |
| A-176 | Shipper data audit trail: old/new values | 2 | Art.3.5 |
| A-177 | Frontend: Registration form + status badges | 2 | Art.3.3 |

#### P1 — Infrastructure & Deploy (11 SP)

| # | Задача | SP |
|---|---|---|
| A-178 | VPS деплой (nginx + PM2 + SSL/Let's Encrypt) | 5 |
| A-179 | WebSocket real-time dashboard | 4 |
| A-180 | Email-уведомления (Margin Call, просрочка) | 2 |

#### P1 — Documentation (5 SP)

| # | Задача | SP |
|---|---|---|
| A-181 | UserGuide v1.2 — тарифы АЕРС, 101+ тестов, новые эндпоинты | 3 |
| A-182 | OpenAPI update — reserve-prices, over-nominate, systemParams | 2 |

#### P2 — Analytics & Polish (16 SP)

| # | Задача | SP |
|---|---|---|
| A-183 | Frontend: Contract modal — NC route dropdown (NC codes first, deprecated marked) | 2 |
| A-184 | Frontend: Invoice modal — separate entry/exit capacity fields (автозаполнение из контракта) | 2 |
| A-185 | Performance testing (k6, 100 RPS) | 2 |
| A-186 | Аналитический дашборд (графики объёмов, revenue by shipper) | 4 |
| A-187 | Экспорт данных в Excel/CSV (billing, contracts, nominations) | 3 |
| A-188 | OpenAPI spec completeness (Sprint 9–10 endpoints) | 1 |
| A-189 | Sprint 10 Review Gate — git tag, 101+ tests, VPS verify | 2 |

### Sprint 9 · NC Full Compliance + AERS Tariff Alignment
**Период:** 27.03 – 10.04.2026 | **Target:** 46 SP | **Статус:** 🔄 В ПРОЦЕССЕ

> NC Audit (26.03.2026) выявил 11 расхождений между кодом и Сетевым кодексом / АЕРС 05-145.
> Sprint 9 устраняет ВСЕ расхождения и добавляет security hardening.

#### P0 — Тарифы АЕРС 05-145 (12 SP)

| Epic | Задача | SP | Статус |
|---|---|---|---|
| TARIFF | **A-147** Entry Kirevo = 6.00 (не 4.19!) | 2 | 🔲 |
| TARIFF | **A-148** Daily Entry = 0.0329 (не 0.0230!) | 1 | 🔲 |
| TARIFF | **A-149** Quarterly tariffs: 4Q × 3 points × 3 types | 3 | 🔲 |
| TARIFF | **A-150** Monthly tariffs: 28/30/31d × 3 points | 2 | 🔲 |
| TARIFF | **A-151** Within-Day tariffs: hourly pricing | 1 | 🔲 |
| TARIFF | **A-152** CR tariffs: Entry 2.85, Domestic 1.99 | 1 | 🔲 |
| DB | **A-153** Migration 010: reserve_prices table + KIREVO-EXIT | 2 | 🔲 |

#### P0 — Формулы биллинга (10 SP)

| Epic | Задача | SP | Статус |
|---|---|---|---|
| BILLING | **A-154** Separate entry/exit capacity fee | 3 | 🔲 |
| BILLING | **A-155** Within-Day hourly fee mode | 2 | 🔲 |
| BILLING | **A-156** EURIBOR 6M (was 3M) | 1 | ✅ CLAUDE.md |
| BILLING | **A-157** Invoice due = 30 days | 1 | 🔲 |
| BILLING | **A-158** Interruption penalty ×3 | 2 | 🔲 |
| NOM | **A-159** Over-Nomination NC Art.12.8 | 3 | 🔲 |

#### P0 — Маршруты (7 SP)

| Epic | Задача | SP | Статус |
|---|---|---|---|
| NC | **A-160** contracts/meta: 7 NC routes | 3 | 🔲 |
| NC | **A-161** KIREVO-EXIT in DB | 1 | 🔲 |
| FE | **A-162** Nomination NC point codes | 2 | 🔲 |
| FE | **A-163** Capacity units кВт·ч/ч | 1 | 🔲 |

#### P1 — Security + Docs + Testing (17 SP)

| Epic | Задача | SP | Статус |
|---|---|---|---|
| SEC | **A-164** OWASP audit | 2 | 🔲 |
| SEC | **A-165** Input validation Joi/Zod | 3 | 🔲 |
| SEC | **A-166** Nomination 13:00 CET validation | 2 | 🔲 |
| TEST | **A-167** Jest nc-routes (70+ cases) | 3 | 🔲 |
| TEST | **A-168** Jest tariffs (entry≠exit) | 2 | 🔲 |
| DOCS | **A-169** UserGuide v1.2 | 2 | 🔲 |
| DOCS | **A-170** LOCAL_RUN.md update | 1 | 🔲 |
| GATE | **A-171** Sprint 9 Review Gate | 2 | 🔲 |

---

## 📊 Сводка по фазам

| Фаза | Спринты | Период | SP | Статус |
|---|---|---|---|---|
| Phase 0 · Research | — | Янв–Фев 2026 | — | ✅ ЗАВЕРШЕНО |
| Phase 1 · MVP | Sprint 1–3 | 03.03–23.03.2026 | 83 SP | ✅ ЗАВЕРШЕНО |
| Phase 2 · Backend | Sprint 4 | 23.03.2026 | ~54 SP | ✅ ЗАВЕРШЕНО ДОСРОЧНО |
| Phase 2 · Backend | Sprint 5 | 25.03.2026 (досрочно) | **~72 SP** | ✅ ЗАВЕРШЕНО ДОСРОЧНО |
| Phase 3 · Production | Sprint 6 | 26.03.2026 (досрочно) | **~38 SP** | ✅ ЗАВЕРШЕНО ДОСРОЧНО |
| Phase 3 · Production | Sprint 7 | 26.03.2026 (досрочно) | **~21 SP** | ✅ ЗАВЕРШЕНО ДОСРОЧНО |
| Phase 3 · Production | Sprint 8 | 26.03.2026 | ~22 SP | ✅ ЗАВЕРШЕНО (FE-Backend Alignment) |
| Phase 4 · NC Compliance | Sprint 9 | 27.03.2026 | ~46 SP | ✅ ЗАВЕРШЕНО (NC Full Compliance) |
| Phase 4 · NC Compliance | Sprint 10 | 27.03.2026 | ~62 SP | ✅ ЗАВЕРШЕНО (Invoice Lines + 90/10 + NC Art.3) |
| Phase 5 · Nominations + RBP | Sprint 11 | 27.03.2026 | ~39 SP | ✅ ЗАВЕРШЕНО (Nominations 100% + RBP Core mock) |
| Phase 5 · RBP + Analytics | Sprint 12 | 28.03.2026 | ~19 SP | ✅ ЗАВЕРШЕНО (RBP Secondary + UI + Tests, 117/117) |
| Phase 6 · Testing | Sprint 13 | 30.03.2026 | ~45 SP | ✅ ЗАВЕРШЕНО (442 tests, CI/CD, PostgreSQL) |
| Phase 7 · Auction Calendar | Sprint 14 | 31.03.2026 | ~35 SP | ✅ ЗАВЕРШЕНО (Auction Calendar + UAT) |
| Phase 8 · NC Consistency | Sprint 15 | 03.04.2026 | ~16 SP | ✅ ЗАВЕРШЕНО (NC consistency + docs alignment) |
| **Phase 9 · NC Push + Analytics** | **Sprint 16** | **06.04.2026** | **35 SP** | **🔄 В РАБОТЕ (NC Art.13+15 + Analytics + Diploma)** |
| **ИТОГО** | **16 спринтов** | **Янв–Июн 2026** | **~587 SP** | |

---

## 🏁 Milestone Plan

| Milestone | Дата | Критерий | Статус |
|---|---|---|---|
| **M1 · MVP Ready** | 23.03.2026 | Все 15 FR реализованы, демо-стенд готов | ✅ ВЫПОЛНЕНО |
| **M2 · Backend Live** | 23.03.2026 | API + PostgreSQL + JWT + CAM NC + АЕРС тарифы | ✅ ВЫПОЛНЕНО ДОСРОЧНО |
| **M2.1 · Billing Fix** | 25.03.2026 | Capacity entry/exit split + fuel gas + late payment | ✅ ВЫПОЛНЕНО |
| **M2.2 · NC Compliance** | 25.03.2026 | Gas quality, Capacity Tracker, Credit Support NC Art.5 | ✅ ВЫПОЛНЕНО |
| **M2.3 · Auction + Infra** | 25.03.2026 | Auction Management (008+auctions.js) + OpenAPI + CI/CD + 33 tests | ✅ ВЫПОЛНЕНО ДОСРОЧНО |
| **M3 · QA Complete** | 26.03.2026 | 56/56 tests passing · migrations 004–008 clean · sprint-6 tag | ✅ ВЫПОЛНЕНО ДОСРОЧНО |
| **M3.1 · NC Compliance** | 26.03.2026 | NC §2.1 IP/Routes align + User Guide v1.1 + CLAUDE.md | ✅ ВЫПОЛНЕНО (Sprint 7) |
| **M3.2 · Integration Complete** | 30.04.2026 | VPS public URL + ERP + WebSocket | 📋 Sprint 8 |
| **M4 · Production Release** | 30.04.2026 | OWASP pass, UAT pass, go-live | 📋 Sprint 8 |
| **M5 · Diploma Defense** | Июн 2026 | Защита дипломной работы | 📋 |

---

## ⚡ Ключевые технические решения (ADR Summary)

| ADR | Решение | Статус |
|---|---|---|
| ADR-001 | Vanilla JS MVP (без фреймворка) | ✅ ПРИНЯТО |
| ADR-002 | PostgreSQL 17 (ACID, JSON) | ✅ ПРИНЯТО |
| ADR-003 | JWT + Argon2id (24h access, 7d refresh) | ✅ ПРИНЯТО |
| ADR-004 | CAM NC EU 2017/459 — 7 типов договоров, GTA-нумерация | ✅ ПРИНЯТО |
| ADR-005 | Биллинг: capacity-based take-or-pay (EUR/(kWh/h)/yr) | ✅ ПРИНЯТО |
| ADR-006 | Раздельный учёт capacity_entry / capacity_exit | ✅ РЕАЛИЗОВАНО (005+billing.js) |
| ADR-007 | 1 EXIT_SERBIA (Paraćin+Pančevo+Gospođinci) по NC Art.6.3.1 | ✅ РЕАЛИЗОВАНО (005+contracts.js) |
| ADR-008 | Gas Quality — реальные данные Annex 3A Apr 2025 | ✅ РЕАЛИЗОВАНО (005 seed) |
| ADR-009 | Capacity Tracker — витрина RBP.EU (read from contracts) | ✅ РЕАЛИЗОВАНО (006+capacity.js) |
| ADR-010 | Credit Support NC Art.5: гарантия URDG 758 или эскроу | ✅ РЕАЛИЗОВАНО (007+credits.js) |
| ADR-011 | Rating Exemption: BBB-/Baa3/Creditreform≤235 | ✅ РЕАЛИЗОВАНО (007) |
| ADR-012 | Auction Management: Full Lifecycle (Free→Bid→Won→Contract→Billing) | ✅ РЕАЛИЗОВАНО (008+auctions.js) |
| ADR-013 | Auction Calendar: MAR0277-24 seed (47 строк, 2025-2026) | ✅ РЕАЛИЗОВАНО (008 seed) |
| ADR-012 | NC Route Alignment — 7 канонических маршрутов (009 + ncRoutes.js) | ✅ РЕАЛИЗОВАНО (Sprint 7) |
| ADR-013 | KIREVO-EXIT — симметричная EXIT-точка NC §2.1 | ✅ РЕАЛИЗОВАНО (Sprint 7) |
| ADR-014 | WebSocket (socket.io) для real-time кредитных алертов | 📋 Sprint 8 |
| ADR-015 | VPS деплой: nginx + PM2 + Let's Encrypt SSL (Hetzner CX21) | 📋 Sprint 8 |

---

## 📁 Ключевые артефакты

```
C:\Users\leokr\ETRM\
├── Soft\
│   └── GTCP_MVP.html                   ← MVP + Backend integration (Sprint 4)
├── backend\
│   ├── src\routes\
│   │   ├── billing.js                  ← calcCapacityFee/FuelGas/LatePayment (Sprint 5 ✅)
│   │   ├── contracts.js                ← 3 flow directions + АЕРС тарифы (Sprint 5 ✅)
│   │   ├── capacity.js                 ← Tracker + RBP offerings + Surrender (Sprint 5 ✅)
│   │   ├── credits.js                  ← NC Art.5 Credit Support (Sprint 5 ✅)
│   │   └── auctions.js                 ← CAM NC Auction Management (Sprint 5 ✅)
│   ├── docs\
│   │   ├── openapi.yaml                ← OpenAPI 3.0.3 spec (60+ endpoints) ✅ Sprint 5
│   │   └── swagger-ui.html             ← CDN Swagger UI (без npm) ✅ Sprint 5
│   └── src\db\migrations\
│       ├── 001_initial.sql             ← Базовая схема ✅
│       ├── 003_contracts_nc.sql        ← CAM NC ✅
│       ├── 004_tariff_official.sql     ← АЕРС тарифы ✅
│       ├── 005_capacity_entry_exit.sql ← Entry/Exit + Gas Quality + Fuel Gas ✅
│       ├── 006_capacity_tracker.sql    ← RBP Tracker + Surrender + UIOLI ✅
│       ├── 007_credit_support.sql      ← NC Art.5 Credit Support ✅
│       ├── 008_auction_management.sql  ← CAM NC Auction Calendar + Bids ✅
│       └── 009_nc_routes.sql           ← NC route alignment, nc_routes ref table ✅ Sprint 7
│   └── src\utils\
│       └── ncRoutes.js                 ← NC §2.1 POINTS×6, NC_ROUTES×7, helpers ✅ Sprint 7
├── reports\
│   ├── roadmap.md                      ← Данный файл (v5.0, 26.03.2026)
│   ├── actionplan.md                   ← Живой документ задач (v5.0)
│   ├── SPRINT_4_PLAN.md                ← Sprint 4 backlog ✅
│   ├── SPRINT_5_PLAN.md                ← Sprint 5 backlog ✅ ЗАВЕРШЁН
│   ├── SPRINT_5_REPORT.md              ← Sprint 5 итоговый отчёт ✅ (26.03.2026)
│   ├── SPRINT_7_REPORT.md              ← Sprint 7 итоговый отчёт ✅
│   ├── GTCP_UserGuide_v1.1.md          ← Руководство пользователя v1.1 ✅ Sprint 7
│   ├── GTCP_UserGuide_v1.1.docx        ← Руководство пользователя v1.1 (Word) ✅ Sprint 7
│   ├── Отчёт_Sprint4_FINAL.docx        ← Sprint 4 отчёт v3 ✅
│   └── Gastrans_Capacity_Analysis.xlsx ← Анализ мощностей ✅
├── CLAUDE.md                           ← NC compliance checklist + Discrepancy Protocol ✅ Sprint 7
├── ТЗ_GTCP_MVP_v1.0.docx
├── GTCP_Diploma_Text.docx
└── GTCP_Diploma_Presentation.pptx
```

---

## 📈 Velocity & Burndown Summary

| Sprint | Период | Plan SP | Actual SP | Delta |
|---|---|---|---|---|
| Sprint 1 | 03.03–16.03.2026 | 28 | 28 | — |
| Sprint 2 | 17.03–23.03.2026 | 34 | 34 | — |
| Sprint 3 | 23.03.2026 | 21 | 21 | — |
| Sprint 4 | (план: 06–19.04) | 34 | ~54 | **+20 SP досрочно** |
| Sprint 5 | 25.03.2026 (досрочно) | 58 | **~72** | **+24 SP досрочно** ✅ |
| Sprint 6 | 26.03.2026 (досрочно) | 40 | **~38** | **досрочно** ✅ |
| Sprint 7 | 26.03.2026 (досрочно) | 32 | **~21** | **досрочно** ✅ |
| Sprint 8 | 26.03.2026 | ~32 | **~22** | **досрочно** ✅ |
| Sprint 9 | 27.03.2026 | 46 | **~46** | ✅ NC Full Compliance |
| Sprint 10 | 27.03.2026 | 62 | **~62** | ✅ Invoice Lines + 90/10 + Art.3 |
| Sprint 11 | 27.03.2026 | 39 | **~39** | ✅ Nominations + RBP Core |
| Sprint 12 | 28.03.2026 | 33 | **~19** | ✅ RBP Secondary |
| Sprint 13 | 30.03.2026 | 45 | **~45** | ✅ Testing 442/442 |
| Sprint 14 | 31.03.2026 | 35 | **~35** | ✅ Auction Calendar + UAT |
| Sprint 15 | 03.04.2026 | 16 | **~16** | ✅ NC consistency + docs |
| Sprint 16 | 06–19.04.2026 | 43 | **~18** (WIP) | 🔄 capacity_kwh_h ✅ + UI cleanup ✅ + NC Art.13+15 |
────────────────────────────────────────────────────────────────
Total: ~570 SP delivered (552+18) + 25 SP remaining · Migrations: 17 (000-017) · Tests: 442/442 · NC: 79% → 84% → target 87%

---

*Roadmap обновляется в конце каждого Sprint Review.*
*25.03.2026 v3.1 — Sprint 5 завершён досрочно (~72 SP). ✅ CAP-FIX · ✅ Gas Quality · ✅ RBP Tracker · ✅ Credit Support NC Art.5 · ✅ Auction Management MAR0277-24 · ✅ OpenAPI 3.0 · ✅ Jest 33 tests · ✅ GitHub Actions CI/CD. Migrations 001–008.*
*26.03.2026 v4.0 — Sprint 6 завершён досрочно (~38 SP). ✅ Credit Support UI · ✅ Auction Management UI · ✅ ERP Connector · ✅ VPS infra конфиги · ✅ Migrations 004/007/008 fix (UUID FK, JSONB) · ✅ **56/56 Jest тестов** (billing+credits+auctions) · sprint-close.sh skill. Тег sprint-6. Sprint 7 планируется с 10.04.2026.*
*26.03.2026 v5.0 — Sprint 7 завершён досрочно (~21 SP). ✅ Migration 009 NC route alignment · ✅ ncRoutes.js (7 маршрутов, 6 IP-кодов) · ✅ KIREVO-EXIT NC §2.1 симметрия · ✅ CLAUDE.md Discrepancy Protocol · ✅ GTCP_UserGuide_v1.1 (.md+.docx). Тег sprint-7. Migrations 001–009 clean. Sprint 8 с 10.04.2026.*
*26.03.2026 v5.1 — Sprint 5 отчёт сформирован (SPRINT_5_REPORT.md). Статус Sprint 5: ✅ ЗАВЕРШЕНО ДОСРОЧНО (~72 SP). P0 Gate Review пройден, все формулы NC верифицированы.*
*06.04.2026 v10.1 — Sprint 15 отчёт сформирован (SPRINT_15_REPORT.md). ~16 SP, 9/9 задач. NC IP codes в demo data исправлены, документация синхронизирована до Sprint 14. NC coverage 79%.*
