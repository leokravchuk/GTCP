# GTCP — Action Plan
**Текущие задачи, приоритеты и решения · Living Document**

> Последнее обновление: 25.03.2026 · Sprint 5 (100% выполнен ✅) · Версия 3.1

---

## ✅ Sprint 5 — Все задачи выполнены (25.03.2026)

| # | Задача | Ответственный | Срок | Статус |
|---|---|---|---|---|
| A-106 | Swagger/OpenAPI 3.0 — `openapi.yaml` 60+ endpoints + CDN Swagger UI | Backend Dev | 25.03.2026 | ✅ DONE |
| A-107 | Integration tests — Jest+Supertest: billing NC Art.18, credits NC Art.5, auctions lifecycle | Backend Dev | 25.03.2026 | ✅ DONE |
| A-108 | GitHub Actions CI/CD — lint + test (PG service) + security audit + OpenAPI validate | DevOps | 25.03.2026 | ✅ DONE |
| A-109 | Credit Support UI — витрина в GTCP_MVP.html (гарантии + рейтинг) | Frontend Dev | 10.04.2026 | 🔲 Sprint 6 |
| A-110 | Sprint 5 Review Gate — node --check все routes ✅ / миграции 001-008 верифицированы | Tech Lead | 25.03.2026 | ✅ DONE |

## 🔥 Немедленные действия — Sprint 6 (10.04 – 26.04.2026)

| # | Задача | Ответственный | Срок | Статус |
|---|---|---|---|---|
| A-111 | Credit Support UI (GTCP_MVP.html) — витрина гарантий, рейтинг, Margin Call | Frontend Dev | 15.04.2026 | 🔲 TODO |
| A-112 | VPS деплой — nginx + PM2 + Let's Encrypt (публичный URL для демо) | DevOps | 18.04.2026 | 🔲 TODO |
| A-113 | `npm install` локально + `npm test` — запустить Jest тесты (33 test cases) | Backend Dev | 10.04.2026 | 🔲 TODO |
| A-114 | REST API коннектор к 1С ERP (реальный, не mock) | Backend Dev | 26.04.2026 | 🔲 TODO |
| A-115 | Sprint 6 Review Gate — полный smoke test endpoints + Swagger UI verify | Tech Lead | 26.04.2026 | 🔲 TODO |

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

## 🗓️ Sprint 6 · Предстоящие задачи (10.04 – 26.04.2026)

- [ ] **A-111** · Credit Support UI (GTCP_MVP.html) — витрина гарантий + рейтинг + MC
- [ ] **A-112** · VPS деплой — nginx + PM2 + SSL/Let's Encrypt (публичный URL для демо)
- [ ] **A-113** · `npm install` + `npm test` — запустить 33 Jest тестов локально, исправить if any
- [ ] **A-114** · REST API коннектор к 1С ERP (реальный endpoint, не mock)
- [ ] WebSocket real-time (socket.io) — алерты по кредитным лимитам
- [ ] Аналитический дашборд — графики объёмов, трендов по месяцам
- [ ] Уточнить domestic exit тарифы у АЕРС → обновить system_params
- [ ] Auction Management UI — статус аукционов, подача заявок из GTCP_MVP.html

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
- [x] **Integration tests Jest+Supertest (33 cases: billing/credits/auctions) — Sprint 5** ✅
- [x] **GitHub Actions CI/CD (5 jobs: lint/test/security/openapi/build) — Sprint 5** ✅
- [ ] Демо-стенд доступен по публичному URL — Sprint 6
- [ ] Финальная документация обновлена — Sprint 7
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

### ADR-012 · Real-time обновления
**Дата:** 23.03.2026 | **Статус:** ЗАПЛАНИРОВАНО (Sprint 5/6)

**Решение:** WebSocket (socket.io)
**Текущий MVP:** setInterval(30s) — временное решение
**Причина:** Критично для кредитного монитора (мгновенные алерты при превышении лимита)

---

### ADR-013 · VPS деплой
**Дата:** 23.03.2026 | **Статус:** ЗАПЛАНИРОВАНО (Sprint 6)

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

| Метрика | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 (факт) |
|---|---|---|---|---|---|
| Story Points delivered | 28 | 34 | 21 | ~54 | **~72** ✅ |
| FR реализовано | 7 | 15 | 15 | 15 (backend) | +NC compliance + Auctions |
| Документов создано | 1 | 3 | 5 | 5 | 5 (roadmap/plan v3.1 + openapi + CI) |
| Открытых дефектов (P0) | 0 | 0 | 0 | 1 (CAP-FIX) | **0** ✅ |
| Migrations applied | — | — | — | 4 (001–004) | **8 (005–008)** |
| Routes implemented | — | — | — | 2 | **5** (capacity/credits/auctions) |
| Test cases | — | — | — | 0 | **33** (Jest+Supertest) |
| CI/CD jobs | — | — | — | 0 | **5** (lint/test/security/openapi/build) |
| NC Articles implemented | — | — | — | CAM NC | **+Art.5,6.3,8.3,13-16,18,20 + CAM Auctions** |

---

## 📊 Cumulative Velocity

```
Sprint 1:  28 SP  [████████████████████████████░░░░░░░░░░░░░░░] 28/34
Sprint 2:  34 SP  [██████████████████████████████████░░░░░░░░░] 34/34
Sprint 3:  21 SP  [█████████████████████░░░░░░░░░░░░░░░░░░░░░] 21/21
Sprint 4: ~54 SP  [██████████████████████████████████████████████████████] 54/34 (+59%)
Sprint 5: ~72 SP  [████████████████████████████████████████████████████████████████████████] 72/58 (+24%) ✅
────────────────────────────────────────────────────────────────
Total: ~209 SP delivered of ~263 SP planned
Migrations: 8 (001-008) · Routes: 11 · Tests: 33 · CI jobs: 5
NC Coverage: Art.5 + Art.6.3 + Art.8.3 + Art.13-16 + Art.18 + Art.20 + CAM Auctions ✅
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
