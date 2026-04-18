# GTCP — Sprint 19 Plan
**Gas Trading & Commercial Platform · VTP Integration + Transparency Portal + Diploma Prep**

---

## Sprint Overview

| Параметр | Значение |
|---|---|
| **Sprint** | Sprint 19 |
| **Период** | 18.04.2026 — 30.04.2026 |
| **Velocity (цель)** | 24 SP |
| **Sprint Goal** | Интегрировать VTP в Balance view, реализовать Transparency Portal (NC Art.24), собрать дипломный индекс артефактов, обновить UserGuide |
| **Приоритет** | P0 — VTP Integration + Diploma Index; P1 — Transparency Portal, UserGuide |
| **Baseline** | 559 tests, 95 endpoints, 22 migrations, NC 87% |

---

## Sprint Goal

> **"К концу Sprint 19 VTP trades учитываются в Balance view (entry/exit netting), Transparency Portal публикует открытые данные по NC Art.24, дипломный индекс артефактов собран, UserGuide v3.5 актуален до Sprint 18 включительно."**

---

## Sprint Backlog

### US-1801 · Diploma Artifacts Index (carryover from Sprint 18)
**SP:** 3 | **Priority:** P0 | **Assignee:** Tech Lead

- [ ] `DIP-03` Составить `reports/DIPLOMA_ARTIFACTS_INDEX.md` — полный индекс всех артефактов проекта
- [ ] `DIP-05` Финальная ревизия `GTCP_Artifacts.md` — cumulative stats (~655 SP, 559 tests, 22 migrations)

**DoD:** Индекс артефактов готов для приложения к дипломной работе.

---

### US-1901 · VTP Balance Integration
**SP:** 5 | **Priority:** P0 | **Assignee:** Backend Dev

VTP trades (NC Art.11) должны учитываться в общем Balance view:
- BUY on VTP = virtual entry (увеличивает entry position)
- SELL on VTP = virtual exit (увеличивает exit position)

- [ ] `VTP-INT-01` Расширить `GET /balance` — включить VTP net position per shipper
- [ ] `VTP-INT-02` Расширить `GET /balance/oba/daily` — VTP trades как отдельная строка
- [ ] `VTP-INT-03` Shipper nomination balance warning (NC Art.12.3) — учитывать VTP при расчёте Entry=Exit
- [ ] `VTP-INT-04` ≥8 тестов: balance с VTP, balance без VTP, mixed shipper

**DoD:** Balance view показывает VTP-adjusted positions; Art.12.3 warning учитывает VTP.

---

### US-1902 · Transparency Portal (NC Art.24)
**SP:** 5 | **Priority:** P1 | **Assignee:** Backend Dev

NC Art.24 требует публикацию данных о capacity и аукционах. Публичные endpoints без JWT.

- [ ] `TP-01` `GET /api/v1/public/capacity` — Technical capacity per IP, contracted vs available (anonymized)
- [ ] `TP-02` `GET /api/v1/public/auctions` — Upcoming auction calendar + past results (anonymized)
- [ ] `TP-03` `GET /api/v1/public/gas-quality` — Latest gas quality data per IP (NC Art.17)
- [ ] `TP-04` `GET /api/v1/public/fuel-gas-price` — Current FG price (Art.18.5.1.4)
- [ ] `TP-05` No JWT required — public access, rate-limited (30 req/min)
- [ ] `TP-06` Add to openapi.yaml + `npm run count-endpoints` sync
- [ ] `TP-07` ≥6 тестов: public access, rate limit, data anonymization

**DoD:** 4 public endpoints work without auth; data is anonymized (no shipper names/IDs).

---

### US-1903 · UserGuide v3.5
**SP:** 3 | **Priority:** P1 | **Assignee:** Tech Lead

- [ ] `UG-01` VTP Trading section — CRUD workflow, balance impact
- [ ] `UG-02` Excel export section — `?format=xlsx` usage
- [ ] `UG-03` FG separate invoice — Art.20.3.5 logic
- [ ] `UG-04` Load test results summary
- [ ] `UG-05` Transparency Portal usage (public endpoints)
- [ ] `UG-06` Updated screenshots / endpoint list

**DoD:** UserGuide v3.5 covers Sprint 17-19 features.

---

### US-1904 · OpenAPI Maintenance
**SP:** 1 | **Priority:** P1 | **Assignee:** Tech Lead

- [ ] Add Sprint 19 endpoints (public/*, balance VTP) to openapi.yaml
- [ ] Verify `npm run count-endpoints` = 0 discrepancies

---

### US-1905 · Test Coverage Improvement
**SP:** 2 | **Priority:** P2 | **Assignee:** QA

- [ ] Fix `GET /shippers` 401 in load test — verify JWT permission routing
- [ ] Add load test to `npm run test:load` script
- [ ] Jest target: ≥580

---

## Sprint Backlog Summary

| User Story | Epic | SP | Priority |
|---|---|---|---|
| US-1801 · Diploma Artifacts Index | Diploma | 3 | P0 |
| US-1901 · VTP Balance Integration | VTP | 5 | P0 |
| US-1902 · Transparency Portal (Art.24) | NC | 5 | P1 |
| US-1903 · UserGuide v3.5 | Docs | 3 | P1 |
| US-1904 · OpenAPI Maintenance | API | 1 | P1 |
| US-1905 · Test Coverage | QA | 2 | P2 |
| **Buffer** | | **5** | P2 |
| **ИТОГО** | | **24 SP** | |

---

## Definition of Done (Sprint 19)

- [ ] VTP trades appear in Balance view (entry/exit netting)
- [ ] 4 public endpoints work without JWT (Transparency Portal)
- [ ] Diploma artifacts index compiled
- [ ] UserGuide v3.5 ready
- [ ] OpenAPI synced
- [ ] Jest ≥ 580
- [ ] Git commit `feat(sprint-19)` + tag `sprint-19`

---

*Документ: 18.04.2026 · GTCP Project · Sprint 19 PLANNED*
