# GTCP — Sprint 18 Plan
**Gas Trading & Commercial Platform · Diploma Final Assembly + VTP Art.11 + Excel Export + Performance**

---

## Sprint Overview

| Параметр | Значение |
|---|---|
| **Sprint** | Sprint 18 |
| **Период** | 27.04.2026 — 08.05.2026 |
| **Команда** | Backend Dev, Frontend Dev, DevOps, QA |
| **Velocity (цель)** | 27 Story Points (24 базовый + 3 US-1712 FG-invoice split) |
| **Sprint Goal** | Собрать финальный пакет артефактов для дипломной защиты, реализовать VTP Basic (NC Art.11), добавить Excel export, провести k6 load testing, выполнить FG-invoice split (Art.20.3.5) |
| **Приоритет** | P0 — Diploma Assembly + OpenAPI sync; P1 — VTP, Excel, k6, FG-invoice split; P2 — LOCAL_RUN.md |
| **Статус** | PLANNED |

---

## Sprint Goal

> **"К концу Sprint 18 дипломный пакет полностью скомплектован (текст + презентация + UserGuide + все отчёты), VTP Basic (NC Art.11) реализован как Entry+Exit балансирующая точка, Excel export работает поверх CSV из Sprint 17, и k6 нагрузочный тест подтверждает 100 RPS на ключевых endpoints."**

### Критерии успеха Sprint

- [ ] Дипломный пакет собран: обновлённый текст + презентация + UserGuide v3.4 + Sprint 1-18 артефакты
- [ ] VTP (Virtual Trading Point) реализован: миграция + endpoints + UI + NC Art.11 compliance
- [ ] Excel export работает для Billing/Contracts/Nominations (SheetJS поверх CSV)
- [ ] k6 load test: ≥100 RPS на GET /nominations, /billing, /contracts без ошибок
- [ ] OpenAPI spec синхронизирован со всеми endpoints Sprint 17-18
- [ ] Jest total ≥ 475 (Sprint 17 target 460 + 15 новых)

---

## Sprint Backlog

### Epic 1: Diploma Final Assembly

#### US-1801 · Diploma Final Assembly
**Как** дипломант, **я хочу** собрать все артефакты проекта Sprint 1-18 в финальный пакет, **чтобы** быть готовым к защите в июне 2026.

| | |
|---|---|
| **Story Points** | 5 |
| **Assignee** | Tech Lead |
| **Priority** | P0 |

**Задачи:**
- [ ] `DIP-01` Обновить `GTCP_Diploma_Text.docx` — добавить разделы Sprint 15-18 (backend architecture, NC compliance 79%+, testing 460+ tests, OBA, VTP)
- [ ] `DIP-02` Обновить `GTCP_Diploma_Presentation.pptx` — слайды: архитектура (19 миграций), NC compliance matrix, тестовое покрытие, analytics dashboard скриншот
- [ ] `DIP-03` Составить `reports/DIPLOMA_ARTIFACTS_INDEX.md` — полный индекс всех артефактов проекта с описаниями и ссылками
- [ ] `DIP-04` Верифицировать: все .docx/.pptx/.xlsx открываются корректно, нет битых ссылок
- [ ] `DIP-05` Финальная ревизия `GTCP_Artifacts.md` — Sprint 18 state, cumulative stats (~590 SP, ~475 tests, 20 migrations)

**Definition of Done:** Дипломный пакет готов к отправке научному руководителю; все документы актуальны до Sprint 18 включительно.

---

#### US-1802 · OpenAPI Final Sync
**Как** Tech Lead, **я хочу** полностью синхронизировать openapi.yaml со всеми реальными endpoints, **чтобы** Swagger UI отражал актуальное API.

| | |
|---|---|
| **Story Points** | 2 |
| **Assignee** | Tech Lead |
| **Priority** | P0 |

**Задачи:**
- [ ] `API-01` Добавить в openapi.yaml все endpoints Sprint 17 (analytics/volumes, analytics/revenue, analytics/utilization, billing/export, contracts/export, nominations/export, match-adjacent, matching-result)
- [ ] `API-02` Добавить Sprint 18 endpoints (VTP, xlsx export параметры)
- [ ] `API-03` Запустить `npm run count-endpoints` (из US-1702) — подтвердить docs = actual
- [ ] `API-04` Обновить CLAUDE.md endpoint count

**Definition of Done:** openapi.yaml покрывает 100% endpoints; `npm run count-endpoints` = 0 расхождений.

---

### Epic 2: VTP Basic (NC Art.11)

#### US-1803 · Virtual Trading Point — NC Art.11
**Как** шиппер, **я хочу** совершать сделки на виртуальной торговой точке (VTP), **чтобы** перебалансировать позиции entry/exit без физической транспортировки.

| | |
|---|---|
| **Story Points** | 5 |
| **Assignee** | Backend Dev |
| **Priority** | P1 |

**Задачи:**
- [ ] `VTP-01` Migration 020: `vtp_trades` table (id, shipper_id, counterparty_id, gas_day, volume_kwh_h, direction ENUM('BUY','SELL'), status, trade_type ENUM('TITLE_TRANSFER','BALANCING'), created_at)
- [ ] `VTP-02` Seed data: 5-10 VTP trades для существующих шипперов (Газпром, NIS, WIEH)
- [ ] `VTP-03` Backend: `src/routes/vtp.js` — CRUD endpoints:
  - `GET /api/v1/vtp/trades` — список сделок (фильтр по gas_day, shipper, status)
  - `POST /api/v1/vtp/trades` — создать VTP-сделку
  - `GET /api/v1/vtp/trades/:id` — детали сделки
  - `PATCH /api/v1/vtp/trades/:id/confirm` — подтвердить сделку
  - `GET /api/v1/vtp/balance` — VTP-баланс по шипперу (net buy-sell)
- [ ] `VTP-04` VTP = entry + exit с точки зрения балансирования (NC Art.11): покупка на VTP = виртуальный entry, продажа = виртуальный exit
- [ ] `VTP-05` Validation: shipper must be ACTIVE, volume > 0, gas_day ≥ today
- [ ] `VTP-06` Frontend: VTP Trading tab в GTCP_MVP.html — таблица сделок + кнопка "+ New Trade" + confirm workflow
- [ ] `VTP-07` Jest тесты: ≥8 cases (create, confirm, balance calc, invalid shipper, duplicate trade, negative volume, past gas_day, counterparty match)

**Definition of Done:** VTP trades создаются и подтверждаются через UI; VTP balance корректно считает net position; NC Art.11 coverage > 0% (baseline).

---

### Epic 3: Excel Export + Performance

#### US-1804 · Excel (xlsx) Export
**Как** бухгалтер TSO, **я хочу** экспортировать данные в Excel формат, **чтобы** использовать формулы и сводные таблицы в ERP.

| | |
|---|---|
| **Story Points** | 3 |
| **Assignee** | Backend Dev |
| **Priority** | P1 |

**Задачи:**
- [ ] `XLS-01` Установить `exceljs` (lightweight xlsx library, no native deps)
- [ ] `XLS-02` Расширить `GET /billing/export?format=xlsx` — генерация .xlsx с заголовками, форматированием ячеек (EUR числа, даты), автоширина колонок
- [ ] `XLS-03` Расширить `GET /contracts/export?format=xlsx` — включить capacity_kwh_h, tariffs, flow_direction
- [ ] `XLS-04` Расширить `GET /nominations/export?format=xlsx` — gas_day, point_code, volume_kwh_h, status, matching_rule
- [ ] `XLS-05` Frontend: кнопка "Export Excel" рядом с "Export CSV" (toggle format)
- [ ] `XLS-06` Jest тесты: ≥4 cases (xlsx header validation, numeric formatting, empty result, large dataset)

**Definition of Done:** Excel файлы открываются в MS Excel / LibreOffice без ошибок; числовые поля форматированы как числа (не текст).

---

#### US-1805 · k6 Load Testing
**Как** DevOps, **я хочу** провести нагрузочное тестирование API, **чтобы** подтвердить производительность для дипломной работы.

| | |
|---|---|
| **Story Points** | 3 |
| **Assignee** | DevOps + QA |
| **Priority** | P1 |

**Задачи:**
- [ ] `PERF-01` Установить k6 (Grafana k6) в dev-среду
- [ ] `PERF-02` Написать `tests/load/smoke.js` — 10 VU, 30s: GET /nominations, /billing, /contracts, /capacity/available
- [ ] `PERF-03` Написать `tests/load/stress.js` — ramp 10→100 VU за 60s: тот же набор endpoints
- [ ] `PERF-04` Написать `tests/load/spike.js` — 200 VU spike, 10s: проверка graceful degradation
- [ ] `PERF-05` Критерии: p95 < 500ms, error rate < 1% при 100 RPS
- [ ] `PERF-06` Сгенерировать `reports/LOAD_TEST_RESULTS.md` — таблицы p50/p95/p99, RPS, error rate, выводы
- [ ] `PERF-07` Добавить `npm run test:load` script в package.json

**Definition of Done:** Smoke test проходит ≥100 RPS при p95 < 500ms; результаты задокументированы в отчёте.

---

### Epic 4: Infrastructure & Docs

#### US-1806 · LOCAL_RUN.md + Deployment Docs
**Как** новый разработчик, **я хочу** актуальную инструкцию по запуску проекта, **чтобы** поднять среду за 10 минут.

| | |
|---|---|
| **Story Points** | 2 |
| **Assignee** | Tech Lead |
| **Priority** | P2 |

**Задачи:**
- [ ] `DOC-07` Обновить `LOCAL_RUN.md`: prerequisites (Node 18+, PG 15+, Docker), env vars (.env.example), migration commands, seed commands
- [ ] `DOC-08` Добавить секцию "Running Tests": mock mode, DB mode, CI mode, coverage report
- [ ] `DOC-09` Добавить секцию "API Quick Start": auth token, first request, Swagger UI URL
- [ ] `DOC-10` Обновить CORS/CSP настройки (Helmet, frontend http-server)

**Definition of Done:** Новый разработчик может поднять проект по LOCAL_RUN.md без дополнительных вопросов.

---

#### US-1807 · Sprint 17 Carryover Buffer
**Как** команда, **мы хотим** зарезервировать буфер для задач из Sprint 17, которые не были завершены.

| | |
|---|---|
| **Story Points** | 4 (резерв) |
| **Assignee** | All |
| **Priority** | P0 (если есть carryover) / P2 (если Sprint 17 = 100%) |

**Задачи:**
- [ ] `BUF-01` Ревизия Sprint 17 на Mid-Sprint (20.04): определить carryover items
- [ ] `BUF-02` Если carryover: приоритизировать P0 items из Sprint 17 (US-1701-1704 debt и matching)
- [ ] `BUF-03` Если Sprint 17 = 100%: использовать буфер для Transparency Portal (NC Art.24) endpoints — `GET /api/v1/public/capacity`, `GET /api/v1/public/auctions`

**Definition of Done:** Все P0 carryover из Sprint 17 завершены; либо Transparency Portal baseline реализован.

---

#### US-1712 · FG Separate Invoice (Art.20.3.5, FG-05)
**Как** Billing Engineer, **я хочу** выставлять Fuel Gas отдельным счётом для shipper'ов с >1 Capacity Product, **чтобы** выполнить NC Art.20.3.5 (separate invoice for Fuel Gas when multiple Capacity Products contracted).

| | |
|---|---|
| **Story Points** | 3 |
| **Assignee** | Backend Dev |
| **Priority** | 🟡 P1 |

**Контекст:** Sprint 17 Epic 5 закрыл FG-01..FG-04, FG-06, FG-07 (правильное начисление + data fix). FG-05 (отдельный invoice) вынесен в Sprint 18 как improvement. Сейчас FG — line item в общем Monthly Invoice.

**Задачи:**
- [ ] `FG-05.1` В `POST /billing`: если shipper имеет >1 ACTIVE contract (разные Capacity Products) → сгенерировать отдельный invoice с `invoice_type='FUEL_GAS'` вместо line item в общем счёте.
- [ ] `FG-05.2` Migration 021: `ALTER TABLE invoices ADD COLUMN invoice_type TEXT DEFAULT 'CAPACITY' CHECK (invoice_type IN ('CAPACITY','FUEL_GAS','IMBALANCE'))`.
- [ ] `FG-05.3` UI Billing: фильтр по invoice_type; отдельная вкладка "Fuel Gas Invoices".
- [ ] `FG-05.4` LT GTA case (Art.20.3.6): для shipper'ов с LT GTA — invoice_type='FUEL_GAS', reference к LT GTA contract_id.
- [ ] `FG-05.5` ≥3 теста: multi-product shipper → 2 invoices; single-product → 1 combined; LT GTA → separate FG invoice.

**DoD:** Sprint 18 smoke test: Газпром с FIRM_YEARLY + FIRM_MONTHLY → получает 2 invoice (capacity + fuel gas); NIS (in-kind) → FG invoice не генерируется.

**Риски:** Необходимо согласовать с US-1801 Diploma Assembly — может потребовать обновления диаграмм Monthly Billing flow в UserGuide.

---

## Sprint Backlog Summary

| User Story | Epic | SP | Assignee | Priority | Status |
|---|---|---|---|---|---|
| US-1801 · Diploma Final Assembly | Diploma | 5 | Tech Lead | P0 | TODO |
| US-1802 · OpenAPI Final Sync | Diploma | 2 | Tech Lead | P0 | TODO |
| US-1803 · VTP Basic (NC Art.11) | VTP | 5 | Backend Dev | P1 | TODO |
| US-1804 · Excel (xlsx) Export | Export | 3 | Backend Dev | P1 | TODO |
| US-1805 · k6 Load Testing | Performance | 3 | DevOps + QA | P1 | TODO |
| US-1806 · LOCAL_RUN.md + Docs | Infrastructure | 2 | Tech Lead | P2 | TODO |
| US-1807 · Sprint 17 Carryover Buffer | Buffer | 4 | All | P0/P2 | TODO |
| **US-1712 · FG Separate Invoice (Art.20.3.5, FG-05)** | **Billing** | **3** | **Backend Dev** | **P1** | **TODO** |
| **ИТОГО** | | **24 SP** | | | |

---

## Технический стек Sprint 18

### Новые файлы

```
backend/
├── src/routes/
│   └── vtp.js                      ← VTP CRUD + balance (NC Art.11)
├── src/db/migrations/
│   └── 020_vtp_trades.sql          ← vtp_trades table + seed
├── tests/
│   ├── vtp.integration.test.js     ← US-1803 (≥8 tests)
│   ├── export-xlsx.test.js         ← US-1804 (≥4 tests)
│   └── load/
│       ├── smoke.js                ← k6 smoke (10 VU)
│       ├── stress.js               ← k6 stress (100 VU)
│       └── spike.js                ← k6 spike (200 VU)
├── docs/
│   └── openapi.yaml                ← Updated with Sprint 17-18 endpoints

reports/
├── SPRINT_18_PLAN.md               ← Данный файл
├── SPRINT_18_REPORT.md             ← Закрытие Sprint 18
├── LOAD_TEST_RESULTS.md            ← k6 результаты
├── DIPLOMA_ARTIFACTS_INDEX.md      ← Полный индекс дипломных артефактов
└── LOCAL_RUN.md                    ← Обновлённая инструкция запуска
```

### Изменяемые файлы

```
backend/src/app.js                  ← +vtpRouter
backend/src/routes/billing.js       ← +xlsx format в /export
backend/src/routes/contracts.js     ← +xlsx format в /export
backend/src/routes/nominations.js   ← +xlsx format в /export
backend/docs/openapi.yaml           ← Sprint 17-18 endpoints sync
Soft/GTCP_MVP.html                  ← +VTP Trading tab, +Export Excel buttons
GTCP_Diploma_Text.docx              ← Sprint 15-18 разделы
GTCP_Diploma_Presentation.pptx      ← Обновлённые слайды
CLAUDE.md                           ← Endpoint count, Sprint 18 notes
reports/GTCP_Artifacts.md           ← Sprint 18 velocity, cumulative stats
package.json                        ← +exceljs, +"test:load" script
```

### Новые API endpoints (Sprint 18)

| # | Method | Path | Description | NC Ref |
|---|---|---|---|---|
| 108 | GET | /api/v1/vtp/trades | VTP trade list | Art.11 |
| 109 | POST | /api/v1/vtp/trades | Create VTP trade | Art.11 |
| 110 | GET | /api/v1/vtp/trades/:id | VTP trade detail | Art.11 |
| 111 | PATCH | /api/v1/vtp/trades/:id/confirm | Confirm VTP trade | Art.11 |
| 112 | GET | /api/v1/vtp/balance | VTP net balance | Art.11 |

**Total API endpoints после Sprint 18: ~112** (после DEBT-02 audit в Sprint 17)

### Новые зависимости

| Package | Version | Purpose |
|---|---|---|
| exceljs | ^4.4 | Excel xlsx generation (streaming, formatting) |
| k6 | latest | Load testing (dev dependency, CLI tool) |

---

## Sprint Events

| Событие | Дата | Время | Участники |
|---|---|---|---|
| Sprint Planning | 27.04.2026 (Пн) | 10:00-11:00 | All |
| Daily Standup | 28.04-07.05 (Пн-Пт) | 09:30-09:45 | All |
| Mid-Sprint Review | 04.05.2026 (Пн) | 14:00-15:00 | Backend Dev, Tech Lead |
| Sprint Review | 08.05.2026 (Пт) | 14:00-15:30 | All + Stakeholders |
| Sprint Retrospective | 08.05.2026 (Пт) | 15:30-16:00 | All |

---

## Definition of Done (Sprint 18)

- [ ] Все P0 US завершены (US-1801, US-1802, US-1807 carryover)
- [ ] VTP Basic реализован и покрыт тестами (≥8 tests)
- [ ] Excel export работает для 3 модулей (.xlsx format)
- [ ] k6 smoke test: ≥100 RPS, p95 < 500ms
- [ ] OpenAPI spec = 100% coverage (0 расхождений с count-endpoints)
- [ ] Дипломный пакет собран и верифицирован
- [ ] **FG separate invoice (Art.20.3.5) работает для multi-product shipper'ов; migration 021 invoice_type**
- [ ] Jest tests: ≥478 зелёные (466 из Sprint 17 + 3 FG-invoice + ≥8 VTP + ≥4 xlsx)
- [ ] Git: коммит `feat(sprint-18)` + тег `sprint-18`
- [ ] SPRINT_18_REPORT.md написан
- [ ] LOCAL_RUN.md актуален

---

## Риски Sprint 18

| # | Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|---|
| R-1 | Sprint 17 carryover > 4 SP съедает буфер | Средняя | Высокое | Mid-Sprint 17 Review (20.04) — раннее обнаружение; если >8 SP carryover — сократить VTP до P2 |
| R-2 | exceljs генерирует файлы с ошибками в старых версиях Excel | Низкая | Среднее | Тестировать в LibreOffice + MS Excel Online; fallback на SheetJS если exceljs нестабилен |
| R-3 | k6 требует запущенный backend для load test — нет VPS | Средняя | Среднее | Тестировать на localhost (Docker Compose); задокументировать ограничение в отчёте |
| R-4 | Дипломный текст требует больше времени чем запланировано | Средняя | Высокое | Начать DIP-01 в первый день спринта; черновик к Mid-Sprint Review (04.05) |
| R-5 | VTP Art.11 требует балансировку с existing nominations | Низкая | Среднее | Sprint 18 = Basic (standalone trades); интеграция с nominations balance — Sprint 19 |

---

## Связи со Sprint 19

Sprint 18 разблокирует для Sprint 19:
- **VTP Integration** — VTP trades учитываются в Balance view (entry+exit netting)
- **Transparency Portal (Art.24)** — если не вошло в US-1807 buffer
- **Real FGSZ/Bulgartransgaz integration** — replace adjacent TSO mock with real API stubs
- **VPS Deploy** — если появится доступ к серверу (Hetzner/DigitalOcean)
- **WebSocket real-time** — кредитные алерты, nomination status push
- **Diploma Defense Prep** — mock presentation, Q&A preparation

---

*Документ сформирован автоматически: 2026-04-13 · GTCP Project · PMNz-74*
