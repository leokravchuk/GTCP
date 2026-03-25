# GTCP — Project Roadmap
**Gas Trading & Commercial Platform · Full Delivery Plan**

> Последнее обновление: 25.03.2026 · Версия 3.1

---

## 🗺️ Общая картина

```
Phase 0       Phase 1 (MVP)         Phase 2 (Backend)         Phase 3 (Production)
Jan–Feb 2026  Mar 2026              Mar–Apr 2026               Apr–Jun 2026
─────────────┬─────────────────────┬──────────────────────────┬───────────────────
  Research   │  Sprint 1–3 (MVP)   │  Sprint 4–6 (API+DB+Infra)│  Sprint 7 (Prod)
  ТЗ, BMC    │  ✅ ЗАВЕРШЕНО        │  ✅ Sprint 5 ЗАВЕРШЁН (100%)│  📋 ЗАПЛАНИРОВАНО
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

## 📋 Phase 3 — Production Hardening (ЗАПЛАНИРОВАНО)

### Sprint 6 · ERP Integration + VPS Deploy + Analytics
**Период:** 10.04 – 26.04.2026 | **Target:** ~40 SP

| Задача | SP | Приоритет |
|---|---|---|
| ~~Swagger/OpenAPI 3.0~~ ✅ (выполнено Sprint 5) | — | ✅ |
| ~~Integration tests (Jest+Supertest)~~ ✅ (выполнено Sprint 5) | — | ✅ |
| ~~GitHub Actions CI/CD~~ ✅ (выполнено Sprint 5) | — | ✅ |
| `npm install` локально + `npm test` — запустить 33 теста, исправить если нужно | 1 | P0 |
| VPS деплой (nginx + PM2 + SSL/Let's Encrypt) — публичный демо-URL | 5 | P0 |
| Credit Support UI (GTCP_MVP.html) — витрина гарантий + рейтинг + MC | 3 | P0 |
| Auction Management UI (GTCP_MVP.html) — статус аукционов, подача заявок | 3 | P0 |
| REST API коннектор к 1С ERP (реальный) | 6 | P1 |
| Аналитический дашборд (графики объёмов, трендов) | 6 | P1 |
| Экспорт данных в Excel/CSV | 4 | P1 |
| Domestic exit тарифы (уточнить у АЕРС → обновить system_params) | 2 | P1 |
| WebSocket real-time dashboard (ADR-014) | 4 | P2 |
| Email-уведомления (Margin Call, просрочка) | 4 | P2 |
| Мобильная адаптация (планшет 768px+) | 5 | P3 |

### Sprint 7 · Security Audit + UAT + Launch
**Период:** 27.04 – 15.05.2026 | **Target:** ~28 SP

| Задача | SP | Приоритет |
|---|---|---|
| OWASP Top 10 penetration testing | 5 | P0 |
| Исправление выявленных уязвимостей | 5 | P0 |
| User Acceptance Testing (UAT) с реальными пользователями | 4 | P0 |
| Performance testing (k6 нагрузочное, 100 RPS) | 3 | P1 |
| Backup & recovery процедуры | 3 | P1 |
| Production release notes | 2 | P1 |
| Финальная документация + руководство пользователя | 3 | P1 |
| Тёмная/светлая тема (toggle) | 2 | P3 |
| Localization: EN/RU переключение | 3 | P3 |

---

## 📊 Сводка по фазам

| Фаза | Спринты | Период | SP | Статус |
|---|---|---|---|---|
| Phase 0 · Research | — | Янв–Фев 2026 | — | ✅ ЗАВЕРШЕНО |
| Phase 1 · MVP | Sprint 1–3 | 03.03–23.03.2026 | 83 SP | ✅ ЗАВЕРШЕНО |
| Phase 2 · Backend | Sprint 4 | 23.03.2026 | ~54 SP | ✅ ЗАВЕРШЕНО ДОСРОЧНО |
| Phase 2 · Backend | Sprint 5 | 25.03.2026 (досрочно) | **~72 SP** | ✅ ЗАВЕРШЕНО ДОСРОЧНО |
| Phase 3 · Production | Sprint 6 | 10.04–26.04.2026 | ~40 SP | 📋 ПЛАН |
| Phase 3 · Production | Sprint 7 | 27.04–15.05.2026 | ~28 SP | 📋 ПЛАН |
| **ИТОГО** | **7 спринтов** | **Янв–Май 2026** | **~263 SP** | |

---

## 🏁 Milestone Plan

| Milestone | Дата | Критерий | Статус |
|---|---|---|---|
| **M1 · MVP Ready** | 23.03.2026 | Все 15 FR реализованы, демо-стенд готов | ✅ ВЫПОЛНЕНО |
| **M2 · Backend Live** | 23.03.2026 | API + PostgreSQL + JWT + CAM NC + АЕРС тарифы | ✅ ВЫПОЛНЕНО ДОСРОЧНО |
| **M2.1 · Billing Fix** | 25.03.2026 | Capacity entry/exit split + fuel gas + late payment | ✅ ВЫПОЛНЕНО |
| **M2.2 · NC Compliance** | 25.03.2026 | Gas quality, Capacity Tracker, Credit Support NC Art.5 | ✅ ВЫПОЛНЕНО |
| **M2.3 · Auction + Infra** | 25.03.2026 | Auction Management (008+auctions.js) + OpenAPI + CI/CD + 33 tests | ✅ ВЫПОЛНЕНО ДОСРОЧНО |
| **M3 · Integration Complete** | 26.04.2026 | VPS public URL + ERP + UI (Credit/Auction) | 📋 Sprint 6 |
| **M4 · Production Release** | 15.05.2026 | OWASP pass, UAT pass, go-live | 📋 Sprint 7 |
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
| ADR-014 | WebSocket (socket.io) для real-time кредитных алертов | 📋 Sprint 6 |
| ADR-015 | VPS деплой: nginx + PM2 + Let's Encrypt SSL (Hetzner CX21) | 📋 Sprint 6 |

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
│       └── 008_auction_management.sql  ← CAM NC Auction Calendar + Bids ✅
├── reports\
│   ├── roadmap.md                      ← Данный файл (v3.1, 25.03.2026)
│   ├── actionplan.md                   ← Живой документ задач (v3.1)
│   ├── SPRINT_4_PLAN.md                ← Sprint 4 backlog ✅
│   ├── SPRINT_5_PLAN.md                ← Sprint 5 backlog ✅ ЗАВЕРШЁН
│   ├── Отчёт_Sprint4_FINAL.docx        ← Sprint 4 отчёт v3 ✅
│   └── Gastrans_Capacity_Analysis.xlsx ← Анализ мощностей ✅
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
| Sprint 6 | 10.04–26.04.2026 | ~40 | — | 📋 |
| Sprint 7 | 27.04–15.05.2026 | ~28 | — | 📋 |

---

*Roadmap обновляется в конце каждого Sprint Review.*
*25.03.2026 v3.1 — Sprint 5 завершён досрочно (~72 SP). ✅ CAP-FIX · ✅ Gas Quality · ✅ RBP Tracker · ✅ Credit Support NC Art.5 · ✅ Auction Management MAR0277-24 · ✅ OpenAPI 3.0 · ✅ Jest 33 tests · ✅ GitHub Actions CI/CD. Migrations 001–008. ADR-014 (WebSocket) и ADR-015 (VPS) добавлены. Sprint 6 активен с 10.04.2026.*
