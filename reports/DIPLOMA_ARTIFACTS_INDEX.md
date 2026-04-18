# GTCP — Diploma Artifacts Index

**Gas Trading & Commercial Platform · Полный индекс артефактов проекта**
**Дата:** 18.04.2026 · Sprint 19 · Для дипломной защиты (июнь 2026)

---

## 1. Кодовая база

| Артефакт | Расположение | Описание |
|---|---|---|
| Backend API | `backend/src/` | Express.js + PostgreSQL, 95 REST endpoints |
| Routes (15 файлов) | `backend/src/routes/` | auth, shippers, contracts, nominations, billing, credits, capacity, auctions, balance, analytics, vtp, rbp, audit, systemParams, reservePrices |
| Миграции (22) | `backend/src/db/migrations/` | 000–022: schema evolution from init to VTP + invoice_type |
| Services | `backend/src/services/` | adjacentTsoService.js, erp-connector.js, rbp/ |
| Utilities | `backend/src/utils/` | csvExport.js, xlsxExport.js, ncRoutes.js, logger.js |
| Frontend | `Soft/GTCP_MVP.html` | Single-page vanilla JS dashboard |
| OpenAPI spec | `backend/docs/openapi.yaml` | 95/95 endpoints documented (100% sync) |
| Swagger UI | `backend/docs/swagger-ui.html` | CDN-based API documentation UI |

### Метрики кода

| Метрика | Значение |
|---|---|
| API endpoints | 95 (authoritative: `npm run count-endpoints`) |
| Миграции | 22 (000–022) |
| Jest тесты | 559 (36 suites, 0 failing) |
| NC Coverage | ~87% (Art.3,5,6,7,10-13,15,17,18,20,24 partial) |
| OpenAPI coverage | 100% |
| SP доставлено | ~655 (Sprint 1–18) |

---

## 2. Нормативная база

| Артефакт | Расположение | Описание |
|---|---|---|
| Network Code | `NC-Gastrans-2020-ENG.pdf` | Gastrans d.o.o. Network Code 2020 (111 pages) — источник истины |
| AERS Decision 05-145 | Referenced in CLAUDE.md | Тарифные решения GY 2025/2026 |
| CAM NC Calendar | `reports/CAM_NC_Auction_Calendar_2025-2026.xlsx` | Аукционный календарь MAR0277-24 |

---

## 3. Проектная документация

| Артефакт | Расположение | Описание |
|---|---|---|
| CLAUDE.md | `CLAUDE.md` | Binding implementation rules: IP, routes, tariffs, FG, billing formulas |
| GTCP_Artifacts.md | `reports/GTCP_Artifacts.md` | Реестр артефактов v1.4: архитектура, диаграммы, API map, velocity |
| README.md | `README.md` | Точка входа в проект |

---

## 4. Руководство пользователя (версии)

| Версия | Файлы | Sprint | Примечания |
|---|---|---|---|
| v1.1 | `.md` + `.docx` | Sprint 7 | Первая версия |
| v2.0 | `.md` + `.docx` | Sprint 9 | NC compliance расширение |
| v3.0 | `.md` + `.docx` | Sprint 12 | RBP, Invoice Line Items |
| v3.1 | `.md` + `.docx` | Sprint 15 | Auction Calendar, EDIGAS |
| v3.3 | `.md` + `.docx` | Sprint 16 | OBA, capacity_kwh_h |
| **v3.4** | `.md` | **Sprint 17** | **FG Art.18, Art.13 matching, Analytics, CSV — АКТУАЛЬНАЯ** |

---

## 5. Аналитические отчёты

| Артефакт | Формат | Описание |
|---|---|---|
| Gastrans_Capacity_Analysis | `.pdf` + `.xlsx` | Разбор Technical Capacity по IP (AERS) |
| Gastrans_formula_Analysis | `.pdf` | Billing формулы (period-aware: annual/quarterly/monthly/daily/WD) |
| Gastrans_code_Analysis | `.pdf` | Анализ кодовой базы |
| RBP_Integration_Analysis | `.md` + `.docx` | Regional Booking Platform SOAP integration (Variant B) |
| LOAD_TEST_RESULTS | `.md` | Нагрузочное тестирование: avg 854 RPS, p97.5 < 500ms |
| FG_DATA_FIX_REPORT | `.md` | Fuel Gas data sweep: 4 invoices corrected, 299K EUR |

---

## 6. Спринт-отчёты

| Sprint | Plan | Report | SP | Highlights |
|---|---|---|---|---|
| 5 | — | `SPRINT_5_REPORT.md` | 45 | Capacity tracker, UIOLI |
| 7 | — | `SPRINT_7_REPORT.md` | 42 | NC Routes, seed alignment |
| 8 | — | `SPRINT_8_REPORT.md` | 22 | Frontend-Backend alignment |
| 9 | `SPRINT_9_PLAN.md` | `SPRINT_9_REPORT.md` | 38 | NC Compliance, Security |
| 10 | `SPRINT_10_PLAN.md` | `SPRINT_10_REPORT.md` | 62 | Invoice Lines, 90/10, NC Art.3 |
| 11 | `SPRINT_11_PLAN.md` | `SPRINT_11_REPORT.md` | 39 | Nominations NC, RBP Core |
| 12 | — | `SPRINT_12_REPORT.md` | 19 | RBP Secondary, UI, Tests |
| 15 | `SPRINT_15_PLAN.md` | `SPRINT_15_REPORT.md` | 16 | NC consistency |
| 16 | `SPRINT_16_PLAN.md` | `SPRINT_16_REPORT.md` | 13 | capacity_kwh_h + OBA (rescoped) |
| **17** | `SPRINT_17_PLAN.md` | `SPRINT_17_REPORT.md` | **29** | **FG Art.18, Art.13 matching, +85 tests** |
| **18** | `SPRINT_18_PLAN.md` | `SPRINT_18_REPORT.md` | **22** | **VTP, Excel, FG-invoice, OpenAPI 100%** |
| 19 | `SPRINT_19_PLAN.md` | — | — | VTP integration, Transparency Portal |

### Специальные планы
- `SPRINT_RBP_PLAN.md` — RBP Bridge integration plan

---

## 7. Сессионные отчёты

| Дата | Файл | Тема |
|---|---|---|
| 29.03.2026 | `session-uat-fixes-2026-03-29.md` | UAT fixes |
| 30.03.2026 | `session-uat-frontend-2026-03-30.md` | UAT frontend |
| 30.03.2026 | `session-testing-infrastructure-2026-03-30.md` | Testing infra (442 tests) |
| 31.03.2026 | `session-auction-calendar-2026-03-31.md` | Auction Calendar |
| 31.03.2026 | `session-uat-dashboard-2026-03-31.md` | UAT dashboard |
| 03.04.2026 | `session-sprint-15-consistency-2026-04-03.md` | Sprint 15 consistency |
| 06.04.2026 | `session-matvey-review-2026-04-06.md` | Matvey code review |
| 06.04.2026 | `session-seed-to-js-2026-04-06.md` | Seed migration to JS |
| 09.04.2026 | `session-sprint16-capacity-kwh-h-2026-04-09.md` | capacity_kwh_h migration |
| 10.04.2026 | `session-sprint16-ui-cleanup-2026-04-10.md` | Sprint 16 UI cleanup |
| 15.04.2026 | `SESSION_2026-04-15_FG_HOTFIX.md` | FG Art.18 hotfix (Sprint 17) |

---

## 8. Инфраструктура

| Артефакт | Расположение | Описание |
|---|---|---|
| LOCAL_RUN.md | `reports/LOCAL_RUN.md` | Инструкция локального запуска v3.0 |
| docker-compose.yml | `backend/docker-compose.yml` | Docker Compose (API + PostgreSQL) |
| .env.example | `backend/.env.example` | Шаблон переменных окружения |
| jest.config.js | `backend/jest.config.js` | Jest конфигурация |
| count-endpoints.js | `backend/scripts/count-endpoints.js` | Endpoint audit tool |
| smoke.js | `backend/tests/load/smoke.js` | Load test (autocannon) |

---

## 9. Кумулятивная статистика

| Метрика | Значение |
|---|---|
| Спринтов завершено | 18 |
| Story Points доставлено | ~655 |
| API endpoints | 95 |
| Миграций БД | 22 |
| Jest тестов | 559 (36 suites) |
| NC Coverage | ~87% |
| OpenAPI coverage | 100% |
| Avg RPS (smoke test) | 854 |
| Git commits (Sprint 5–18) | ~40+ |
| Документация | 60+ файлов (.md, .pdf, .docx, .xlsx) |

---

*Индекс составлен: 18.04.2026 · GTCP Project · Sprint 19*
