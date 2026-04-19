# GTCP — Diploma Final Summary

**Gas Trading & Commercial Platform · Итоговая сводка для дипломной защиты**
**Дата:** 19.04.2026 · Sprint 22 CLOSED · Факультет технических наук

---

## 1. О проекте

**GTCP** — информационная система управления коммерческой деятельностью газотранспортного оператора **Gastrans d.o.o.** (Нови Сад, Сербия). Автоматизирует полный коммерческий цикл TurkStream (сербский участок, 403 км): аукционы мощности, номинации, биллинг, кредитная поддержка, VTP-торговля.

**Нормативная база:** Gastrans Network Code (2020), CAM NC EU 2017/459, AERS Decision 05-145.

---

## 2. Кодовая база

| Компонент | Технология | Объём |
|---|---|---|
| Backend API | Node.js + Express + PostgreSQL | 7,203 строки (17 route files) |
| Frontend | Vanilla JS (single HTML) | 4,855 строк |
| Tests | Jest + Supertest + autocannon | 8,600 строк (42 suites) |
| Migrations | SQL | 25 файлов (000–025) |
| Documentation | Markdown + PDF + XLSX + DOCX | 31,587 строк (61 файл) |

---

## 3. Ключевые метрики

| Метрика | Значение |
|---|---|
| **API endpoints** | 110 (OpenAPI 110/110 = 100% sync) |
| **Jest tests** | 612 passed, 0 failed (42 suites) |
| **DB migrations** | 25 (000–025) |
| **Story Points** | ~750 (Sprint 1–22) |
| **Sprints** | 22 |
| **NC Coverage** | ~93% |
| **Git commits** | 43 |
| **Avg RPS** | 854 (smoke test, localhost) |

---

## 4. NC Compliance Matrix

| NC Article | Тема | Реализация | Покрытие |
|---|---|---|---|
| Art.3 | Shipper Registration | APPLICANT→ACTIVE→REMOVED lifecycle | 100% |
| Art.5 | Credit Support | Margin calls, instruments, rating, exposure | 100% |
| Art.6 | Capacity Products | 10 типов (Y/Q/M/D/WD × Firm/Int/CR) | 100% |
| Art.6.3.1.4 | Within-Day | Hourly booking, fee=cap×price×hours | 100% |
| Art.7 | Auctions | Sealed-bid + CAM NC compliance documented | 80% |
| Art.8 | Surrender | Voluntary + TSO approval | 100% |
| Art.10 | UIOLI | Underutilization check (<80%) | 100% |
| Art.11 | VTP | Virtual Trading Point, BUY=entry, SELL=exit | 100% |
| Art.12 | Nominations | kWh/h, over-nomination, renom ±10% | 100% |
| Art.12.3 | Equal Nominations | Entry=Exit, VTP-adjusted balance | 100% |
| Art.13 | Matching | Adjacent TSO mock, Lesser Rule, double-sided | 100% |
| Art.14 | Interruption | Penalty = fee × 3 (AERS 05-145) | 100% |
| Art.15 | Balancing/OBA | TSO-to-TSO (read-only), shippers always balanced | 100% |
| Art.17-18 | Auction Mechanism | Clearing price + premium + auction_rounds table | 70% |
| Art.17 | Gas Quality | GCV, Wobbe, H₂S per IP | 100% |
| Art.18 | Fuel Gas | Route guards, election IN_KIND/CASH, FG-invoice split | 100% |
| Art.20 | Billing | Period-aware formulas, separate entry/exit, late interest | 100% |
| Art.20.3.5 | FG Separate Invoice | invoice_type CAPACITY/FUEL_GAS for multi-product | 100% |
| Art.24 | Transparency | 4 public endpoints, rate-limited, anonymized | 100% |

**Документированные ограничения:**
- Art.17-18: Ascending clock auction не реализован полностью (sealed-bid). Обоснование: NC Art.7.4.1 допускает альтернативный механизм по решению NRA. Архитектура готова (auction_rounds table).
- RBP интеграция: 10 SOAP методов в mock-режиме. Реальная интеграция требует TSO регистрацию и SSL-сертификат FGSZ.

---

## 5. Архитектура

```
┌───────────────────────────────────────────────────────┐
│ Frontend (GTCP_MVP.html, 4855 loc)                    │
│ Vanilla JS · 12 разделов · Real-time API              │
└────────────────────┬──────────────────────────────────┘
                     │ REST API (JSON)
┌────────────────────▼──────────────────────────────────┐
│ Backend (Node.js + Express, 7203 loc)                  │
│ 17 route files · 110 endpoints · JWT auth             │
│ Helmet CSP · CORS · Rate limiting                     │
├───────────────────────────────────────────────────────┤
│ Services:                                             │
│  · adjacentTsoService (NC Art.13 matching)            │
│  · rbpClient (SOAP mock → FGSZ RBP)                  │
│  · erp-connector (1С ERP integration)                 │
│  · csvExport + xlsxExport (RFC 4180 + exceljs)        │
├───────────────────────────────────────────────────────┤
│ PostgreSQL 17 · 25 migrations · 30+ tables            │
│ Real-time SQL (no cache) for capacity/available       │
└───────────────────────────────────────────────────────┘
```

---

## 6. API Surface (110 endpoints)

| Module | Endpoints | NC Reference |
|---|---|---|
| Health | 1 | — |
| Auth | 3 | Art.3 |
| Shippers | 7 | Art.3 |
| Contracts | 6 | Art.6 |
| Nominations | 12 | Art.12-13 |
| Capacity | 11 | Art.6-8, 10, 14 |
| Auctions | 18 | Art.7, 17-18 |
| Billing | 10 | Art.18, 20 |
| Credits | 7 | Art.5 |
| Balance | 4 | Art.15 |
| Analytics | 3 | — |
| VTP | 5 | Art.11 |
| RBP | 12 | CAM NC |
| Bids | 3 | Art.7 |
| Public | 4 | Art.24 |
| System | 4 | — |
| **Total** | **110** | |

---

## 7. Тестовое покрытие (612 tests)

| Category | Tests | Scope |
|---|---|---|
| Billing (integration + coverage + dbspec) | 39 | Invoice CRUD, FG, generate, line items |
| Credits | 21 | Credit support, margin calls, instruments |
| Auctions (integration + coverage + clearing) | 44 | Bids lifecycle, calendar, clearing price |
| Nominations (deep + dbspec + realdb) | 20 | Capacity check, over-nom, matching |
| NC Routes + Tariffs | 45 | 7 routes, 57 reserve prices, AERS |
| RBP Mock | 16 | 10 SOAP methods |
| Fuel Gas | 12 | Route × election × AAQ matrix |
| Adjacent TSO | 25 | Lesser Rule, mock TSOs |
| Analytics | 11 | Volumes, revenue, utilization |
| CSV Export | 15 | BOM, escaping, permissions |
| XLSX Export | 5 | Format, headers, numeric types |
| Balance + VTP | 13 | VTP integration, OBA |
| Public | 6 | Transparency Portal, anonymization |
| Surrender + WD + Interruption | 13 | Capacity lifecycle |
| Bids Reporting | 7 | Portfolio, KPI, export |
| Other | ~320 | Auth, shippers, contracts, capacity, etc. |
| **Total** | **612** | |

---

## 8. Sprint History

| Sprint | SP | Tests | Migrations | Focus |
|---|---|---|---|---|
| 1-4 | ~100 | 12 | 4 | Core: auth, contracts, billing |
| 5-9 | ~163 | 56 | 3 | NC compliance, capacity, security |
| 10-12 | ~120 | 117 | 5 | Invoice lines, 90/10, RBP, tests |
| 13-16 | ~109 | 442 | 6 | Testing 442, capacity_kwh_h, OBA |
| **17** | **29** | **527** | **2** | FG Art.18 hotfix, NC Art.13, Analytics, CSV |
| **18** | **22** | **559** | **2** | VTP Art.11, Excel, FG-invoice, OpenAPI 100% |
| **19** | **19** | **565** | **0** | Transparency Art.24, VTP balance, Diploma index |
| **20** | **22** | **600** | **1** | Surrender Art.8, WD Art.6, Interruption Art.14 |
| **21** | **21** | **607** | **0** | Раздел «Заявка», RBP panel, CAM NC report |
| **22** | **5** | **612** | **2** | Clearing price, premium, auction_rounds, Interruptible |
| **Total** | **~750** | **612** | **25** | |

---

## 9. Документация

| Документ | Файл | Назначение |
|---|---|---|
| Network Code (PDF) | `NC-Gastrans-2020-ENG.pdf` | Источник истины (111 стр) |
| CLAUDE.md | `CLAUDE.md` | Binding implementation rules |
| GTCP Artifacts | `reports/GTCP_Artifacts.md` | Реестр артефактов v1.5 |
| User Guide v3.4 | `reports/GTCP_UserGuide_v3.4.md` | Руководство (3162 строки) |
| CAM NC Compliance | `reports/CAM_NC_AUCTION_COMPLIANCE_REPORT.md` | Ascending clock analysis |
| RBP Analysis | `reports/RBP_Integration_Analysis.md` | FGSZ integration plan |
| Diploma Index | `reports/DIPLOMA_ARTIFACTS_INDEX.md` | Полный индекс артефактов |
| Load Test | `reports/LOAD_TEST_RESULTS.md` | 854 RPS avg, p97.5 < 500ms |
| OpenAPI | `backend/docs/openapi.yaml` | 110/110 endpoints |
| Local Deploy | `reports/LOCAL_DEPLOY_3003.md` | Инструкция запуска |
| Sprint Reports | `reports/SPRINT_*_REPORT.md` | 12 отчётов (Sprint 5–21) |
| Session Reports | `reports/SESSION_*.md` | 4 сессии |

---

## 10. Демонстрация

**Frontend:** http://localhost:3003/GTCP_MVP.html
**Логин:** admin / admin123

### Демо-сценарий для защиты (5 минут)

1. **Dashboard** → KPI карточки, 7 шипперов, 3 контракта
2. **Номинации** → создать номинацию 10M kWh/h на KIREVO-ENTRY, запустить matching
3. **Аукционы** → календарь April 2026, таблица Monthly + Interruptible аукционов
4. **Заявка** → доступные мощности (3 IP), RBP panel (mock), отчёты
5. **Биллинг** → invoice с FG line item, export XLSX
6. **Мощности** → available capacity (90% LT, 10% ST free)
7. **Swagger UI** → http://localhost:3003/docs/openapi.yaml → 110 endpoints

---

*Diploma Final Summary · 19.04.2026 · GTCP Project*
*Факультет технических наук · krav4ukleo@gmail.com*
