# GTCP — Sprint 20 Plan
**Gas Trading & Commercial Platform · Capacity Surrender + Within-Day + Interruption + 600 Tests**

---

## Sprint Overview

| Параметр | Значение |
|---|---|
| **Sprint** | Sprint 20 |
| **Период** | 19.04.2026 — 30.04.2026 |
| **Velocity (цель)** | 22 SP |
| **Sprint Goal** | Реализовать Capacity Surrender/UIOLI (NC Art.8/10), Within-Day continuous booking (Art.6.3.1.4), Interruption management (Art.14), довести тесты до 600+ |
| **Baseline** | 565 tests, 99 endpoints, 22 migrations, NC 89% |

---

## Sprint Backlog

### US-2001 · Capacity Surrender + UIOLI (NC Art.8 + Art.10)
**SP:** 5 | **Priority:** P0

Shipper может вернуть (surrender) неиспользуемую мощность TSO. TSO применяет UIOLI (Use It Or Lose It).

- [ ] Migration 023: `capacity_surrenders` table (shipper_id, booking_id, volume_kwh_h, status, reason)
- [ ] `POST /capacity/surrender` — shipper surrenders capacity
- [ ] `PATCH /capacity/surrender/:id/approve` — TSO approves/rejects
- [ ] `GET /capacity/surrender/history` — surrender history
- [ ] `POST /capacity/uioli/check` — TSO checks underutilization (NC Art.10)
- [ ] >=8 tests

### US-2002 · Within-Day Continuous Booking (NC Art.6.3.1.4)
**SP:** 5 | **Priority:** P0

Within-Day capacity = continuous hourly allocation for remaining Gas Day hours.

- [ ] `POST /capacity/within-day` — book within-day capacity (hour-by-hour)
- [ ] `GET /capacity/within-day/available` — available WD capacity per IP per hour
- [ ] Fee = capacity_kwh_h × price_per_hour × hours (NOT / 365)
- [ ] Validation: only for current gas day, remaining hours
- [ ] >=6 tests

### US-2003 · Interruption Management (NC Art.14)
**SP:** 5 | **Priority:** P1

Interruptible capacity can be interrupted by TSO. Penalty = fee × 3 (AERS 05-145 item 3).

- [ ] Migration 024: `interruptions` table (booking_id, gas_day, hours_interrupted, reason, penalty_eur)
- [ ] `POST /capacity/interrupt` — TSO interrupts interruptible booking
- [ ] `GET /capacity/interruptions` — interruption history
- [ ] Penalty calculation: interrupted_fee × 3
- [ ] >=6 tests

### US-2004 · Test Coverage Push (target 600+)
**SP:** 4 | **Priority:** P1

- [ ] Balance integration tests (VTP + nominations combined)
- [ ] Transparency Portal edge cases
- [ ] Capacity surrender + WD + interruption tests
- [ ] Target: 600+ tests total

### US-2005 · actionplan.md + roadmap.md update
**SP:** 1 | **Priority:** P2

---

## Summary

| US | SP | Priority |
|---|---|---|
| US-2001 Capacity Surrender + UIOLI | 5 | P0 |
| US-2002 Within-Day Booking | 5 | P0 |
| US-2003 Interruption Management | 5 | P1 |
| US-2004 Test Coverage 600+ | 4 | P1 |
| US-2005 Docs update | 1 | P2 |
| Buffer | 2 | P2 |
| **Total** | **22 SP** | |

---

*19.04.2026 · Sprint 20 PLANNED*
