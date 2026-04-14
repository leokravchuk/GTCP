# GTCP Artifacts — Diagrams, Schemes & Session Artifacts

**Gas Trading & Commercial Platform · Compilation v1.3**
**Date:** 10.04.2026 · Sprint 16 CLOSED (rescoped, ~13/35 SP — see [SPRINT_16_REPORT.md](SPRINT_16_REPORT.md))
**Source:** Sessions Sprint 8–16

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Data Flow Diagram](#2-data-flow-diagram)
3. [NC Interconnection Points Map](#3-nc-interconnection-points-map)
4. [Transportation Routes (7 NC + 2 Legacy)](#4-transportation-routes)
5. [Capacity 90/10 Split Diagram](#5-capacity-9010-split)
6. [Billing Formula Decision Tree](#6-billing-formula-decision-tree)
7. [Invoice Line Items Model (Variant C)](#7-invoice-line-items-model)
8. [Nomination Flow (NC Art. 12-13)](#8-nomination-flow)
9. [Shipper Lifecycle (NC Art. 3)](#9-shipper-lifecycle)
10. [RBP Integration Architecture (Variant B)](#10-rbp-integration-architecture)
11. [Auction Lifecycle (CAM NC)](#11-auction-lifecycle)
12. [Credit Support Calculation](#12-credit-support-calculation)
13. [Database Schema (14 Migrations)](#13-database-schema)
14. [API Endpoint Map (82 Endpoints — authoritative)](#14-api-endpoint-map)
15. [Sprint Velocity Chart](#15-sprint-velocity-chart)
16. [Balancing & OBA (NC Art.15)](#16-balancing--oba)
17. [Fuel Gas Allocation Rules (NC Art.18 + Art.19.1.4)](#17-fuel-gas-allocation-rules-nc-art18--art1914--binding)

---

## 1. System Architecture

```
+-----------------------------------------------------+
|                    GTCP Platform                      |
+-----------------------------------------------------+
|                                                       |
|  +-------------+    REST API     +----------------+   |
|  |  Frontend   | <=============> |    Backend     |   |
|  | GTCP_MVP    |   api.js v2.1   |  Express.js    |   |
|  |  .html      |   82 endpoints  |  Node.js 20    |   |
|  | Vanilla JS  |                 |                |   |
|  | Single SPA  |                 +-------+--------+   |
|  +-------------+                         |            |
|                                    +-----v------+     |
|                                    | PostgreSQL |     |
|                                    |   17.x     |     |
|                                    | 14 tables  |     |
|                                    +-----+------+     |
|                                          |            |
|  +------------------+   SOAP/HTTPS  +----v-------+    |
|  | RBP.EU (FGSZ)   | <==========>  | RBP Bridge |    |
|  | Regional Booking |  EDIGAS v5.1  | Variant B  |    |
|  | Platform         |  XML          | mock/uat/  |    |
|  +------------------+               | production |    |
|                                     +------------+    |
|  +------------------+   REST/HTTPS                    |
|  | 1C ERP (Gastrans)| <===> erp-connector.js          |
|  +------------------+       mock/production           |
+-------------------------------------------------------+
```

---

## 2. Data Flow Diagram

```
Shipper Registration (NC Art.3)
         |
         v
  [APPLICANT] --approve--> [ACTIVE]
         |                     |
         |              +------+------+
         |              |             |
         v              v             v
    Credit Support   Contract     Capacity
    (NC Art.5)      (NC Art.6)   Booking
         |              |             |
         |              +------+------+
         |                     |
         v                     v
    Nomination (NC Art.12)   Auction (NC Art.7)
         |                     |
         v                     v
    Matching (NC Art.13)   RBP Sync
         |                     |
         +----------+----------+
                    |
                    v
             Billing (NC Art.20)
             Invoice Line Items
                    |
                    v
             Payment / Late Interest
             (EURIBOR 6M + 3%)
```

---

## 3. NC Interconnection Points Map

```
                    BULGARIA
                       |
            [KIREVO-ENTRY] ---- Entry Point Kirevo/Zajecar
                       |         15,280,488 kWh/h
                       |         Tariff: 6.00 EUR/kWh/h/yr
                       |
          =============|============= GASTRANS PIPELINE (TurkStream)
                       |
              +--------+--------+
              |                 |
    [EXIT-SERBIA]         [HORGOS-EXIT]
    Exit Domestic          Exit Horgos/Kiskundorozsma
    5,040,256 kWh/h        10,240,233 kWh/h
    Tariff: 4.19            Tariff: 6.85
              |                 |
     +--------+--------+       |
     |        |        |       |
   GMS-2   GMS-3   GMS-4    HUNGARY
  Pancevo Paracin Gospodjinci  (FGSZ)

  Commercial Reverse (virtual):
  HORGOS-ENTRY -----> KIREVO-EXIT (Full Reverse A)
  EXIT-SERBIA-ENTRY -> KIREVO-EXIT (Full Reverse B)
  HORGOS-ENTRY -----> EXIT-SERBIA (Half Reverse A)
  EXIT-SERBIA-ENTRY -> HORGOS-EXIT (Half Reverse B)
```

---

## 4. Transportation Routes

```
  Physical Flow (Bulgaria -> Serbia/Hungary):
  ============================================
  R1: KIREVO-ENTRY  ------>  HORGOS-EXIT         (Transit)
  R2: KIREVO-ENTRY  ------>  EXIT-SERBIA          (Domestic)
  R3: KIREVO-ENTRY  ------>  HORGOS + SERBIA      (Combined)

  Commercial Reverse (virtual):
  ============================================
  R4: HORGOS-ENTRY  ------>  KIREVO-EXIT          (Full Rev A)
  R5: EXIT-SERBIA-ENTRY -->  KIREVO-EXIT          (Full Rev B)
  R6: HORGOS-ENTRY  ------>  EXIT-SERBIA          (Half Rev A)
  R7: EXIT-SERBIA-ENTRY -->  HORGOS-EXIT          (Half Rev B)

  Legacy (deprecated, kept for DB compat):
  ============================================
  L1: GOSPODJINCI_HORGOS    (old name for R6/R7)
  L2: HORGOS_GOSPODJINCI    (old name for R6/R7)
```

---

## 5. Capacity 90/10 Split

```
  TECHNICAL CAPACITY (AERS certified) — Updated 09.04.2026
  =========================================================

  Entry Kirevo:  15,280,488 kWh/h (100%)
  +-----------------------------------------+
  | Long-Term Reserved (90%)                |
  | 13,752,439 kWh/h                        |
  |   Газпром: 9,752,230 (transit+domestic) |
  |   NIS:     4,000,209 (domestic)         |
  | Final Exemption Act, 20 years           |
  +-------------------+---------------------+
                      |
  +-------------------v---------------------+
  | Short-Term FREE for Auctions (10%)     |
  | 1,528,049 kWh/h                         |
  | No ST pre-bookings — fully available    |
  +---+---------------+-----------+---------+
      |               |           |
  +---v---+     +-----v---+  +---v-------+
  | SOLD  |     |  FREE   |  |  UIOLI    |
  | (bids)|     |(auction)|  |(unsold->  |
  |       |     |         |  | WD Intrrp)|
  +-------+     +---------+  +-----------+

  Exit Horgos:   10,240,233 kWh/h
  LT Reserved:    9,216,209 (90%) Газпром only | Free: 1,024,024 (10%)

  Exit Domestic:  5,040,256 kWh/h
  LT Reserved:    4,536,230 (90%) Газпром 536,021 + NIS 4,000,209 | Free: 504,026 (10%)

  RULE: Газпром HORGOS-EXIT = 90% Tech (9,216,209). NOT higher.
  RULE: ST Free Entry = ST Free Horgoš + ST Free Serbia (±1 rounding)
  NOTE: cap_entry_LT (13.75M) != cap_exit_horgos_LT (9.22M)
        Difference = domestic exit zone (GP 536K + NIS 4M)
```

---

## 6. Billing Formula Decision Tree

```
  Invoice Line Item
        |
        v
  What product type?
        |
  +-----+------+------+-------+----------+
  |     |      |      |       |          |
  v     v      v      v       v          v
ANNUAL QRTLY MNTHLY DAILY  W/DAY    SPECIAL
  |     |      |      |       |          |
  v     v      v      v       v          v
cap*T  cap*T  cap*T  cap*T  cap*T    (see below)
/365   /Qd    *1     *days  *hours
*days  *days
  |     |      |      |       |
  +-----+------+------+-------+
        |
        v
  Qd = days in quarter:
  Q1(Oct-Dec)=92, Q2(Jan-Mar)=90
  Q3(Apr-Jun)=91, Q4(Jul-Sep)=92
        |
        v
  SPECIAL types:
  - FUEL_GAS: X1*Q_horgos + X2*Q_serbia - KN
  - OVERDUE_INTEREST: amount * (EURIBOR_6M+3%) / 360 * days
  - AUCTION_PREMIUM: (P_old-P_new) * RC * hours
  - INTERRUPTION_PENALTY: capacity_fee * 3
  - IMBALANCE_CHARGE: |TI| * GP (gas exchange price)
  - VTP_TRADE: traded_volume * VTP_price
  - BALANCING_NEUTRALITY: per Art. 15.8
```

---

## 7. Invoice Line Items Model (Variant C)

```
  +--------------------------------------------------+
  |  INVOICE #INV-2026-001                           |
  |  Shipper: SRB-GAS d.o.o.                        |
  |  Period: March 2026 (31 days)                    |
  |  Due: 20.04.2026                                 |
  +--------------------------------------------------+
  | # | Type              | Product      | Amount    |
  |---|-------------------|--------------|-----------|
  | 1 | CAPACITY_ENTRY    | FIRM_YEARLY  | 7,007,986 |
  | 2 | CAPACITY_EXIT     | FIRM_YEARLY  | 5,363,795 |
  | 3 | COMMODITY_ENTRY   | FIRM_YEARLY  |   350,399 |
  | 4 | COMMODITY_EXIT    | FIRM_YEARLY  |   268,190 |
  | 5 | FUEL_GAS          | —            |   935,892 |
  | 6 | AUCTION_PREMIUM   | FIRM_DAILY   |    12,500 |
  | 7 | OVERDUE_INTEREST  | —            |     1,847 |
  | 8 | INTERRUPTION_PEN  | INTERRUPTIBLE|    45,000 |
  | 9 | IMBALANCE_CHARGE  | —            |     3,200 |
  +--------------------------------------------------+
  |                              TOTAL: 13,988,809   |
  +--------------------------------------------------+

  Line types (9):
  CAPACITY_ENTRY, CAPACITY_EXIT, COMMODITY_ENTRY,
  COMMODITY_EXIT, FUEL_GAS, AUCTION_PREMIUM,
  OVERDUE_INTEREST, INTERRUPTION_PENALTY,
  IMBALANCE_CHARGE

  Product types (21):
  FIRM_YEARLY, FIRM_QUARTERLY_Q1..Q4,
  FIRM_MONTHLY, FIRM_DAILY, FIRM_WITHIN_DAY,
  INTERRUPTIBLE, COMM_REV_YEARLY,
  COMM_REV_QUARTERLY_Q1..Q4,
  COMM_REV_MONTHLY, COMM_REV_DAILY,
  (+ special: FUEL_GAS, OVERDUE, AUCTION, PENALTY, IMBALANCE)
```

---

## 8. Nomination Flow (NC Art. 12-13)

```
  Shipper                    TSO (Gastrans)           Adjacent TSO
     |                            |                        |
     |  1. Submit Nomination      |                        |
     |  (D-1, before 14:00 CET)  |                        |
     |--------------------------->|                        |
     |                            |                        |
     |  2. Validate:              |                        |
     |  - kWh/h units             |                        |
     |  - Contracted Cap check    |                        |
     |  - Over-nom detection      |                        |
     |  - Equal rule Entry=Exit   |                        |
     |                            |                        |
     |  3. If VALID:              |                        |
     |  status = PENDING          |                        |
     |                            |  4. Double-Sided Match |
     |                            |<======================>|
     |                            |  Lesser Rule applied   |
     |                            |                        |
     |  5. Confirmed Quantities   |                        |
     |  (by 16:00 CET)           |                        |
     |<---------------------------|                        |
     |  status = CONFIRMED        |                        |
     |                            |                        |
     |  6. Renomination           |                        |
     |  (until GD end - 3h)       |                        |
     |--------------------------->|                        |
     |  Renom 90/10 limits:       |                        |
     |  - 0-80% CC: up to 90%F   |                        |
     |  - 80-100%: half unused    |                        |
     |  - 20-100%: down min 10%  |                        |
     |  - <=20%: down half nom   |                        |

  Over-Nomination (Art. 12.8):
  If ALL Firm fully contracted AND nom < Total Contracted:
  excess -> Within-Day Interruptible (confirmed in 2h)
```

---

## 9. Shipper Lifecycle (NC Art. 3)

```
  +-------------+                    +-------------+
  |  APPLICANT  |---approve--------->|  APPROVED   |
  | (new reg)   |                    | (docs OK)   |
  +------+------+                    +------+------+
         |                                  |
         | reject                           | activate
         v                                  v
  +------+------+                    +------+------+
  |  REMOVED    |<---remove--------- |   ACTIVE    |
  | (end state) |  (debt=0,cap=0)    | (can trade) |
  +-------------+                    +------+------+
                                            |
                                     suspend|  reactivate
                                            v
                                     +------+------+
                                     | SUSPENDED   |
                                     | (blocked)   |
                                     +-------------+

  Transitions:
  APPLICANT -> APPROVED:  Documents verified
  APPROVED  -> ACTIVE:    Credit Support provided
  ACTIVE    -> SUSPENDED: Credit violation / regulatory
  SUSPENDED -> ACTIVE:    Issue resolved
  ACTIVE    -> REMOVED:   contracted_capacity=0, outstanding_debt=0
  APPLICANT -> REMOVED:   Rejected application

  Each transition logged in `shipper_changes` table (audit trail)
  Fields: gta_number, registration_date, gta_type (LT/ST),
          country, vat_number, credit_rating, contact_person
```

---

## 10. RBP Integration Architecture (Variant B)

```
  GTCP Backend                          RBP.EU (FGSZ)
  ============                          =============

  +------------------+     SOAP/HTTPS    +------------------+
  |  rbp.js          |  Certificate Auth |  SoapTSOService  |
  |  (REST API)      |                   |                  |
  |  11 endpoints    |                   |  Real Platform   |
  +--------+---------+                   +------------------+
           |                                     ^
  +--------v---------+                           |
  |  rbpClient.js    |     RBP_MODE switch       |
  |                  |                           |
  |  mock ---------> mockResponse()              |
  |  uat ----------> soap.createClient() ------->|
  |  production ---> soap.createClient() ------->|
  +--------+---------+
           |
  +--------v---------+
  |  Service Modules  |
  |                  |
  |  capacityUpload  |  -> UploadCapacity
  |  creditSync      |  -> GetCreditLimitInfo
  |  auctionSync     |  -> GetAuctions, GetTrades
  |  surrenderApprv  |  -> SurrenderCapacity, ApproveCapacity
  |  bilateralMgr    |  -> RequestBilateral, ApproveBilateral
  |  networkUserSync |  -> GetNetworkUsers
  |  remitReporter   |  -> GetREMITReport
  +------------------+

  Storage:
  - rbp_sync_log:         all SOAP call logs
  - rbp_auctions:         synced auction data
  - rbp_bundled_auctions: bundled capacity (separate table, Variant B)

  EDIGAS v5.1 NOMINT/NOMRES XML (Sprint 14):

  NOMINT (Nomination):
    DocumentType: 01G (initial) / P03 (renomination)
    Sender: Shipper EIC (27X-GA-GAZPROM-0), Role ZSH
    Receiver: TSO EIC (21X-RS-GASTRANS-0), Role ZSO
    Direction: Z02 (Entry) / Z03 (Exit)
    Quantity: kWh/h (hourly rate, NOT total kWh)
    GasDay: local date (NOT UTC slice)
    TimeInterval: CEST 04:00Z / CET 05:00Z
    NominationCycle: 0=initial, 1+=renom
    Functions: buildNomint(), buildRenomint(), buildNomres()

  NOMRES (Confirmation from TSO):
    DocumentType: 06G
    ConfirmedQuantity: kWh/h
    Status: CONFIRMED

  Credit Instruments (NC Art.5.1.1, Sprint 14):
    Table: credit_support
    Types: BANK_GUARANTEE (URDG 758), STANDBY_LC, ESCROW_DEPOSIT,
           PARENT_GUARANTEE, ESCROW
    Seed: 7 instruments (5 ACTIVE + 1 EXPIRED + 1 quarterly)
```

---

## 11. Auction System Architecture (CAM NC + MAR0277-24)

```
  +==========================================================================+
  |                     CAM NC AUCTION SYSTEM                                 |
  |                NC Art.7 + EU 2017/459 + MAR0277-24                        |
  +==========================================================================+
  |                                                                           |
  |  AUCTION CALENDAR (Source: MAR0277-24 ENTSOG)                             |
  |  +-----------+-----------+-----------+-----------+-------------------+    |
  |  | YEARLY      | QUARTERLY | MONTHLY   | DAILY     | WITHIN-DAY        |  |
  |  +-------------+-----------+-----------+-----------+-------------------+  |
  |  | ONLY if LT  | 4 rounds  | 12x/GY    | 365x/GY   | Continuous        |  |
  |  | surrendered | Aug-May   | M-1 3rd   | D-1       | Every hour        |  |
  |  | (Art.7.1.2) |           | Monday    | 15:30 UTC | current Gas Day   |  |
  |  | NOT for     | ST 10%    | ST 10%    | ST 10%    | ST 10%            |  |
  |  | ST 10%!     | sold here | sold here | sold here | sold here         |  |
  |  +-------------+-----------+-----------+-----------+-------------------+  |
  |  | Firm        | Firm      | Firm      | Firm      | Firm              |  |
  |  | Int         | Int       | Int       | Int       | Int               |  |
  |  | CR          | CR        | CR        | CR        | CR=NOT offered    |  |
  |  +-------------+-----------+-----------+-----------+-------------------+  |
  |                                                                           |
  |  CAM NC CALENDAR GY2025/2026 (MAR0277-24)                                |
  |  +-----------+----+----+----+----+----+----+----+----+----+----+----+    |
  |  | Product   |Oct |Nov |Dec |Jan |Feb |Mar |Apr |May |Jun |Jul |Aug+Sep| |
  |  +-----------+----+----+----+----+----+----+----+----+----+----+----+    |
  |  | YEARLY F  | WO |    |    |    |    |    |    |    |    |    |    |    |
  |  | YEARLY I  | WO |    |    |    |    |    |    |    |    |    |    |    |
  |  +-----------+----+----+----+----+----+----+----+----+----+----+----+    |
  |  | Q1 F+I    | CL |    |    |    |    |    |    |    |    |    |    |    |
  |  | Q2 F+I    | CL |    |    | CL |    |    |    |    |    |    |    |    |
  |  | Q3 F+I    | CL |    |    | CL |    |    | CL |    |    |    |    |    |
  |  | Q4 F+I    | CL |    |    | CL |    |    | CL |    |    | CL |    |    |
  |  +-----------+----+----+----+----+----+----+----+----+----+----+----+    |
  |  | MONTHLY F | CL | CL | CL | CL | CL | OP |    |    |    |    |    |    |
  |  | MONTHLY I | CL | CL | CL | CL | CL | OP |    |    |    |    |    |    |
  |  +-----------+----+----+----+----+----+----+----+----+----+----+----+    |
  |  | DAILY     |... |... |... |... |... |... |    |    |    |    |    |    |
  |  | W/D       |=== |=== |=== |=== |=== |=== |    |    |    |    |    |    |
  |  +-----------+----+----+----+----+----+----+----+----+----+----+----+    |
  |                                                                           |
  |  CL=CLOSED  OP=OPEN  UP=UPCOMING  WO=WON (yearly allocated)              |
  |  ===  Continuous (Within-Day: not a discrete auction)                     |
  |                                                                           |
  |  CAPACITY SPLIT (AERS 90/10)                                              |
  |  +----------------+------------------+------------------+                 |
  |  | KIREVO-ENTRY   | HORGOS-EXIT      | EXIT-SERBIA      |                 |
  |  | 15,280,488     | 10,240,233       | 5,040,256 kWh/h  |                 |
  |  +----------------+------------------+------------------+                 |
  |  | LT 90%         | LT 90%           | LT 90%           |                 |
  |  | 13,752,439     | 9,216,210        | 4,536,230        |                 |
  |  | Gazprom+NIS    | Gazprom          | Gazprom+NIS      |                 |
  |  | (Yearly Firm)  | (Yearly Firm)    | (Yearly Firm)    |                 |
  |  +----------------+------------------+------------------+                 |
  |  | ST 10%         | ST 10%           | ST 10%           |                 |
  |  | 1,528,049      | 1,024,023        | 504,026          |                 |
  |  | -> AUCTIONS    | -> AUCTIONS      | -> AUCTIONS      |                 |
  |  | MET/WIEH/Srbij | MET/WIEH         | Srbijagas        |                 |
  |  +----------------+------------------+------------------+                 |
  |                                                                           |
  |  AVAILABLE CAPACITY ENGINE (NC Art.7.1.1 + Art.7.3)                       |
  |  Implementation: Option A (Real-time SQL on every request)                |
  |  API: GET /capacity/available                                             |
  |                                                                           |
  |  Firm ST Available = Tech - Contracted + Surrendered                      |
  |    Daily/WD: += non-nominated (Art.12.7.5)                                |
  |  CR Available = Total Contracted Physical - CR Already Contracted         |
  |  Yearly Available = Surrendered LT only (Art.7.1.2)                       |
  |                                                                           |
  |  Recalculation triggers:                                                  |
  |  - Every request (Option A: real-time SQL, ~10ms)                         |
  |  - Available Credit: every 1 hour (NC Art.5.3.4)                          |
  |  - Daily Available: D-1 before 16:30 CET (Art.7.1.1.3)                   |
  |  - W/D Available: every hour (Art.7.1.1.4)                                |
  |  - Non-nominated: after 14:00 CET D-1 (Art.12.7.5)                       |
  |                                                                           |
  |  TARIFFS (AERS 05-145 GY2025/2026)                                       |
  |  +-----------+----------+-----------+-----------+--------+                |
  |  | Product   | Entry    | Horgos    | Serbia    | CR     |                |
  |  +-----------+----------+-----------+-----------+--------+                |
  |  | Yearly    | 6.00     | 6.85      | 4.19      | 2.85-  |                |
  |  | Q1        | 1.81     | 2.07      | 1.27      | 3.25   |                |
  |  | Month 31d | 0.66     | 0.76      | 0.46      |        |                |
  |  | Daily     | 0.0329   | 0.0375    | 0.0230    | 0.0156 |                |
  |  | W/D /hour | 0.0021   | 0.0023    | 0.0014    | N/A    |                |
  |  +-----------+----------+-----------+-----------+--------+                |
  |  Unit: EUR/kWh/h/period                                                   |
  |                                                                           |
  |  BID LIFECYCLE                                                            |
  |  DRAFT -> SUBMITTED -> UNDER_REVIEW -> WON / PARTIALLY_WON / LOST        |
  |    |                                    |                                 |
  |    +-> CANCELLED                        +-> CONTRACT_CREATED              |
  |                                                                           |
  |  Credit Check (NC Art.5):                                                 |
  |    Available Credit >= bid x tariff x multiplier                          |
  |    Yearly: 2/12, Quarterly: 2/3, Monthly+: 100%                          |
  |                                                                           |
  |  WITHIN-DAY (special case)                                                |
  |  Gas Day 06:00 CET --------------------------------- 06:00 CET           |
  |  |                                                    |                   |
  |  |  14:00 CET (now)                                   |                   |
  |  |  +-- 15:00 buy ---|                                |                   |
  |  |  +-- 16:00 buy    | 16 remaining hours             |                   |
  |  |  +-- 17:00 buy    | each = 1 slot                  |                   |
  |  |  +-- ...           |                                |                   |
  |  |  +-- 05:00 buy ---|                                |                   |
  |  |                                                    |                   |
  |  |  Fee = cap x EUR 0.0021/h x N hours                |                   |
  |  |  CR = NOT available (NC Art.6.5.2)                  |                   |
  |  |  Not a scheduled auction - continuous sale          |                   |
  |  +----------------------------------------------------+                   |
  |                                                                           |
  |  DATA FLOW                                                                |
  |  MAR0277-24 (.xlsx) -> seed.sql -> auction_calendar (DB)                  |
  |       -> GET /auctions/calendar/grid -> { rows x months }                |
  |       -> renderAuctionGrid() -> Calendar UI                               |
  |       -> Click -> POST /auctions/bids -> Credit Check -> DRAFT            |
  |       -> Submit -> RBP.EU (FGSZ) -> WON/LOST -> Contract                 |
  +==========================================================================+

  Auction Schedule GY2025/2026 (MAR0277-24):
  ==================================================
  YEARLY
    Firm:          Publish 07.06.2025, Auction 07.07.2025 07:00 UTC
    Interruptible: Publish 14.07.2025, Auction 21.07.2025 07:00 UTC
    Delivery:      01.10.2025 - 01.10.2026

  QUARTERLY (4 rounds)
    1st (Q1-Q4): Firm 04.08.2025, Int 01.09.2025
    2nd (Q2-Q4): Firm 03.11.2025, Int 01.12.2025
    3rd (Q3-Q4): Firm 02.02.2026, Int 02.03.2026
    4th (Q4):    Firm 04.05.2026, Int 01.06.2026
    Q1=Oct-Dec  Q2=Jan-Mar  Q3=Apr-Jun  Q4=Jul-Sep

  MONTHLY (3rd Monday of M-1)
    Oct25: F 15.09 / I 23.09    Jan26: F 15.12 / I 23.12
    Nov25: F 20.10 / I 28.10    Feb26: F 19.01 / I 27.01
    Dec25: F 17.11 / I 25.11    Mar26: F 16.02 / I 24.02
    (continues through Sep 2026)

  DAILY (D-1, repeating)
    Firm:          15:30 UTC (winter) / 14:30 UTC (summer)
    Interruptible: 16:30 UTC / 15:30 UTC (1 hour after Firm)
    Delivery: next Gas Day (06:00 CET -> 06:00 CET)

  WITHIN-DAY (continuous)
    Not scheduled. Runs every hour for remaining hours of Gas Day.
    CR not offered (NC Art.6.5.2).
    Fee: cap x hourly_tariff x hours. NOT /365.
```

---

## 12. Credit Support System (NC Art.5 — Sprint 14)

```
  NC ART.5 CREDIT SUPPORT FLOW
  =====================================================================

  1. INSTRUMENTS (Art.5.1.1)
     Shipper provides: Bank Guarantee (URDG 758) / Escrow / Parent / SBLC
     DB: credit_support table
     Total CS = SUM(active instruments)

  2. CREDIT LIMIT (Art.5.3.2)
     Credit Limit = Total CS - CS used for existing obligations
     DB: shippers.credit_limit (auto-recalculated on instrument change)

  3. MINIMUM CREDIT SUPPORT (Art.5.1.5)
     Min CS = Transmission Fee x Multiplier
     Fee = Contracted Capacity (kWh/h) x Reserve Price (EUR/kWh/h/yr)

     Product      | Multiplier | Example (NIS: 4M kWh/h x EUR 6.00)
     -------------|------------|------------------------------------
     Monthly/D/WD | 100%       | 24,000,000 x 1    = EUR 24,000,000
     Quarterly    | 2/3        | 24,000,000 x 2/3  = EUR 16,000,000
     Yearly       | 2/12       | 24,000,000 x 2/12 = EUR  4,000,000

  4. AVAILABLE CREDIT (Art.5.3.1) — for auction participation
     Monthly/D/WD: AC = Credit Limit x 1    (= CL)
     Quarterly:    AC = Credit Limit x 3/2
     Yearly:       AC = Credit Limit x 12/2 (= CL x 6)

     WHY multiplier > 1? Inverse of Art.5.1.5:
       CS = 2/12 of fee -> AC = CL x 12/2
       If CL = 3.5M, yearly AC = 21M -> can bid on 21M annual fee
       Because min CS for 21M = 21M x 2/12 = 3.5M = CL. Check!

     Updated every hour on CBP (Art.5.3.4)

  5. RATING EXEMPTION (Art.5.1.6)
     S&P/Fitch >= BBB- OR Moody's >= Baa3 OR Creditreform <= 235
     OR 100% subsidiary of rated entity
     -> No CS needed, no CL check, no Margin Call (Art.5.3.5)

  6. 3-STATUS SYSTEM (Sprint 14)
     EXEMPT:   rating >= BBB- (Art.5.1.6)
     SECURED:  no rating, instruments >= min CS (Art.5.1.5)
     REQUIRES: no rating, instruments < min CS

  7. MARGIN CALL (Art.5.5)
     Trigger: Exposure > Credit Limit AND NOT exempt
     Deadline: 2 Business Days
     Failure: nominations blocked + forced surrender (Art.7.5.4)
     Auto-generated in GET /credits/margin-calls

  FLOW:
  Shipper registers
    |
    +-- Rating >= BBB-? --YES--> EXEMPT (no CS)
    |
    +-- NO --> Provides instruments
                 |
                 v
              Credit Limit = SUM(instruments)
                 |
                 v
              Bid on auction? AC = CL x multiplier >= bid?
                 |         |
                YES       NO --> Rejected
                 |
                 v
              Wins --> Exposure increases
                 |
                 v
              Exposure > CL? --> MARGIN CALL (2BD)
                 |
                 v
              Invoice --> Pays --> Exposure decreases
                 |
                 v
              Doesn't pay --> Late interest (Art.20.4.2)
                              --> Eventually: surrender + removal
```

---

## 13. Database Schema (14 Migrations)

```
  Migration History:
  ==================================================
  001_initial.sql           Base tables (users, contracts, nominations, invoices)
  002_fuel_gas.sql          interconnection_points, fuel_gas_log
  003_contracts_nc.sql      contracts NC alignment, flow_direction
  004_auctions.sql          auction_calendar, auction_bids
  005_capacity_entry_exit.sql  KIREVO-ENTRY, EXIT-SERBIA added
  006_capacity_tracker.sql  capacity_technical, UIOLI views
  007_vtp.sql               VTP trades (NC Art. 11)
  008_secondary_trading.sql capacity_surrenders, secondary_trades
  009_nc_routes.sql         NC route alignment, nc_routes ref table
  010_reserve_prices.sql    AERS 05-145 tariffs (57 rows) + KIREVO-EXIT IP
  011_invoice_line_items.sql  invoice_line_items + capacity_category
  012_shipper_registration.sql  shipper status enum, gta fields, shipper_changes
  013_nominations_kwh_h.sql  volume_mwh -> volume_kwh_h, contracted fields
  014_rbp_tables.sql        rbp_sync_log, rbp_auctions, rbp_bundled_auctions

  Key Tables:
  ==================================================
  users                 Auth, roles (admin, dispatcher, billing, contracts, credit)
  contracts             GTA contracts with flow_direction, NC route
  capacity_bookings     Booked capacity per IP per product
  capacity_technical    Technical capacity per IP (AERS)
  nominations           kWh/h nominations with contracted cap check
  invoices              Header: shipper, period, status
  invoice_line_items    Detail: 9 types x 21 products, tariff + source
  reserve_prices        AERS 05-145 tariffs (GY2025/2026)
  shippers              NC Art.3 lifecycle (APPLICANT->ACTIVE->REMOVED)
  shipper_changes       Audit trail for status transitions
  auction_calendar      Auction schedule per CAM NC
  auction_bids          Bid lifecycle (SUBMITTED->WON/LOST)
  rbp_sync_log          RBP SOAP call history
  rbp_auctions          Synced RBP auction data
  rbp_bundled_auctions  Bundled capacity (Gastrans + FGSZ)
  interconnection_points  6 IPs (3 physical + 3 commercial reverse)
  fuel_gas_log          Monthly FG calculations
  nc_routes             Reference: 7 NC routes + tariffs
```

---

## 14. API Endpoint Map (82 Endpoints — authoritative, Sprint 17 DEBT-02 audit)

```
  AUTH (4)
  POST   /api/v1/auth/login
  POST   /api/v1/auth/register
  POST   /api/v1/auth/refresh
  POST   /api/v1/auth/logout

  CONTRACTS (8)
  GET    /api/v1/contracts
  GET    /api/v1/contracts/:id
  POST   /api/v1/contracts
  PATCH  /api/v1/contracts/:id
  DELETE /api/v1/contracts/:id
  GET    /api/v1/contracts/meta
  GET    /api/v1/contracts/stats
  GET    /api/v1/contracts/nc-routes

  CAPACITY (12)
  GET    /api/v1/capacity
  GET    /api/v1/capacity/:id
  POST   /api/v1/capacity
  PATCH  /api/v1/capacity/:id
  GET    /api/v1/capacity/tracker
  GET    /api/v1/capacity/tracker/summary
  POST   /api/v1/capacity/surrender
  GET    /api/v1/capacity/surrender/history
  GET    /api/v1/capacity/uioli
  POST   /api/v1/capacity/uioli/trigger
  GET    /api/v1/capacity/secondary
  POST   /api/v1/capacity/secondary/trade

  NOMINATIONS (10)
  GET    /api/v1/nominations
  GET    /api/v1/nominations/:id
  POST   /api/v1/nominations
  PATCH  /api/v1/nominations/:id
  POST   /api/v1/nominations/:id/confirm
  POST   /api/v1/nominations/:id/reject
  POST   /api/v1/nominations/:id/renom
  POST   /api/v1/nominations/:id/match
  GET    /api/v1/nominations/:id/edigas
  GET    /api/v1/nominations/balance

  BILLING (12)
  GET    /api/v1/billing
  GET    /api/v1/billing/:id
  POST   /api/v1/billing
  PATCH  /api/v1/billing/:id
  POST   /api/v1/billing/with-lines
  POST   /api/v1/billing/generate
  GET    /api/v1/billing/:id/lines
  GET    /api/v1/billing/fuel-gas
  POST   /api/v1/billing/fuel-gas/calculate
  GET    /api/v1/billing/overdue
  POST   /api/v1/billing/overdue/interest
  GET    /api/v1/billing/stats

  CREDITS (8)
  GET    /api/v1/credits
  GET    /api/v1/credits/:id
  POST   /api/v1/credits
  PATCH  /api/v1/credits/:id
  GET    /api/v1/credits/exposure
  POST   /api/v1/credits/margin-call
  GET    /api/v1/credits/history
  GET    /api/v1/credits/stats

  AUCTIONS (10)
  GET    /api/v1/auctions/calendar
  POST   /api/v1/auctions/calendar
  GET    /api/v1/auctions/calendar/:id
  POST   /api/v1/auctions/:id/bid
  GET    /api/v1/auctions/:id/bids
  POST   /api/v1/auctions/:id/evaluate
  GET    /api/v1/auctions/:id/results
  GET    /api/v1/auctions/active
  GET    /api/v1/auctions/history
  GET    /api/v1/auctions/stats

  SHIPPERS (8)
  GET    /api/v1/shippers
  GET    /api/v1/shippers/:id
  POST   /api/v1/shippers/apply
  PATCH  /api/v1/shippers/:id/status
  GET    /api/v1/shippers/:id/history
  PATCH  /api/v1/shippers/:id
  GET    /api/v1/shippers/stats
  GET    /api/v1/shippers/active

  TARIFFS (6)
  GET    /api/v1/tariffs/reserve-prices
  GET    /api/v1/tariffs/reserve-prices/:point
  POST   /api/v1/tariffs/reserve-prices
  PATCH  /api/v1/tariffs/reserve-prices/:id
  GET    /api/v1/tariffs/system-params
  PATCH  /api/v1/tariffs/system-params

  RBP BRIDGE (11)
  GET    /api/v1/rbp/status
  GET    /api/v1/rbp/auctions
  GET    /api/v1/rbp/trades
  POST   /api/v1/rbp/sync-capacity
  POST   /api/v1/rbp/sync-credit
  GET    /api/v1/rbp/credit/:id
  GET    /api/v1/rbp/sync-log
  POST   /api/v1/rbp/surrender/approve
  POST   /api/v1/rbp/bilateral
  POST   /api/v1/rbp/bilateral/approve
  GET    /api/v1/rbp/network-users
  GET    /api/v1/rbp/remit

  SYSTEM (4)
  GET    /api/v1/system/health
  GET    /api/v1/system/version
  GET    /api/v1/system/config
  GET    /docs (Swagger UI)
```

---

## 15. Sprint Velocity Chart

```
  Sprint | SP   | Tests | Migrations | Focus
  -------|------|-------|------------|----------------------------------
  1-4    | ~100 |  12   |   4        | Core: auth, contracts, billing
  5      |  45  |  24   |   2        | Capacity tracker, UIOLI
  6      |  38  |  33   |   2        | VTP, Secondary trading
  7      |  42  |  33   |   1        | NC Routes, seed alignment
  8      |  22  |  56   |   0        | Frontend-Backend alignment
  9      |  38  |  56   |   1        | NC Compliance, Security
  10     |  62  |  83   |   3        | Invoice Lines, 90/10, NC Art.3
  11     |  39  | 101   |   1        | Nominations NC, RBP Core
  12     |  19  | 117   |   1        | RBP Secondary, UI, Tests
  13     |  45  | 442   |   2        | Testing infra, CI/CD, coverage 95%
  14     |  35  | 442   |   0        | Auction Calendar, Available Capacity, EDIGAS v5.1, UAT
  15     |  16  | 442   |   0        | NC consistency, documentation alignment
  16     |  13  | 442   |   2        | RESCOPED: capacity_kwh_h + OBA (Art.15 split) + UI cleanup
  -------|------|-------|------------|----------------------------------
  TOTAL  | ~572 | 458   |  19        | 82 endpoints (audited), NC 79%, 5 bugs fixed + FG hotfix

  Velocity trend (SP/week):
  Sprint 1-4:  ~12 SP/wk (foundation)
  Sprint 5-7:  ~20 SP/wk (features)
  Sprint 8:    ~11 SP/wk (alignment)
  Sprint 9:    ~19 SP/wk (compliance)
  Sprint 10:   ~31 SP/wk (peak)
  Sprint 11:   ~20 SP/wk (nominations+RBP)
  Sprint 12:   ~10 SP/wk (polish)
  Sprint 13:   ~45 SP/1d (testing blitz)
  Sprint 14:   ~35 SP/1d (auctions+UAT)
  Sprint 15:   ~16 SP/1d (consistency)
  Sprint 16:   ~13 SP/4d (NC re-interpretation, rescoped from 35 SP plan)

  NC Coverage:
  Sprint 7:  ~60% (42/70 articles)
  Sprint 9:  ~68% (48/70)
  Sprint 10: ~73% (51/70)
  Sprint 12: ~79% (55/70)
  Sprint 14: ~79% (55/70) + NC verified against full PDF (111 pages)
  Sprint 13: ~79% (55/70) + 79 NC compliance regression tests
  Sprint 16: ~79% (55/70) + Art.15 re-interpreted (shippers always balanced
             per Art.12.3; OBA TSO-to-TSO read-only; Art.15 sub-coverage 50→83%)
  Remaining: Art.10 Transfer, Art.11 VTP workflow, Art.13 Adjacent matching,
             Art.14 Restrictions, Art.16 Maintenance
```

---

---

## 16. Testing Architecture (Sprint 13)

```
  +─────────────────────────────────────────────────────────+
  │                   GTCP Test Pyramid                      │
  +─────────────────────────────────────────────────────────+
  │                                                          │
  │  ┌──────────────────┐  6 tests    Real PostgreSQL        │
  │  │   Real-DB Tests  │  (no mock)  over-nominate Art.12.8 │
  │  │   nominations    │             matching, fallback     │
  │  └────────┬─────────┘                                    │
  │  ┌────────┴─────────┐  281 tests  supertest + jest.mock  │
  │  │  Integration     │  HTTP → Express → Route → mock DB  │
  │  │  (18 suites)     │  auth, billing, contracts, noms,   │
  │  │                  │  auctions, shippers, rbp, stubs    │
  │  └────────┬─────────┘                                    │
  │  ┌────────┴─────────┐  76 tests   Direct function calls  │
  │  │  Unit Tests      │  calcCapacityFee (4 modes),        │
  │  │  billing.unit    │  calcFuelGas, calcInterest,        │
  │  │  edge-cases      │  calcPenalty, edigas, auditService │
  │  └────────┬─────────┘                                    │
  │  ┌────────┴─────────┐  79 tests   Source code assertions │
  │  │  NC Compliance   │  §2.1 IPs, 7 routes, Art.6 prods, │
  │  │  (regression)    │  AERS tariffs, Art.18 FG, Art.20   │
  │  └──────────────────┘                                    │
  │                                                          │
  │  Total: 442 tests · 25 suites · Coverage ~95% (lines)   │
  │  CI: .github/workflows/test.yml (mock + PostgreSQL 15)   │
  │  Commits: 33ccf6e + c38c400                              │
  +─────────────────────────────────────────────────────────+

  Coverage by Module:
  ==================================================
  Module              Stmts   Lines   Mode
  ─────────────────── ─────── ─────── ──────────────
  billing.js          94%     97%     unit+integration+dbspec
  rbp.js              100%    100%    integration+error branches
  errorHandler.js     100%    100%    dbspec (404+500)
  auditService.js     100%    100%    edge-cases
  authenticate.js     100%    100%    integration+edge
  auth.js             94%     95%     integration
  contracts.js        85%     93%     integration
  shippers.js         92%     92%     integration+lifecycle
  nominations.js      82%     84%     integration+realdb (~93% combined)
  auctions.js         81%     87%     integration+dbspec
  ncRoutes.js         100%    100%    NC compliance
  logger.js           100%    100%    —
  ─────────────────── ─────── ─────── ──────────────
  8 modules at 100% · 18/21 modules ≥ 90%

  Test Files (25):
  ==================================================
  File                          Tests  Type
  ───────────────────────────── ────── ──────────────
  nc-routes.test.js             ~25    existing unit
  tariffs.test.js               ~25    existing unit
  rbp-mock.test.js              ~11    existing unit
  nc-compliance.test.js          79    NC regression
  auth.integration.test.js       14    supertest
  billing.integration.test.js    14    supertest
  contracts.integration.test.js  12    supertest
  nominations.integration.test.js 13   supertest
  auctions.integration.test.js   10    supertest
  shippers.integration.test.js   12    supertest
  billing.coverage.test.js       18    coverage push
  billing.deep.test.js           32    deep coverage
  billing.unit.test.js           30    unit (exported)
  billing.dbspec.test.js          8    DB-specific
  auctions.coverage.test.js      22    coverage push
  auctions.dbspec.test.js        20    DB-specific
  nominations.coverage.test.js   10    coverage push
  nominations.deep.test.js        8    deep coverage
  nominations.dbspec.test.js      9    DB-specific
  nominations.realdb.test.js      6    real PostgreSQL
  shippers.coverage.test.js      13    coverage push
  stubs.coverage.test.js         17    coverage push
  rbp.coverage.test.js           14    coverage push
  rbp.dbspec.test.js             12    error branches
  edge-cases.test.js             18    defensive
  ───────────────────────────── ────── ──────────────
  TOTAL                         442

  Migrations (000–015):
  ==================================================
  000_init.sql              19 tables (consolidated 001–008)
  009_nc_routes.sql         6 IPs, 7 routes, point_details
  010_reserve_prices.sql    57 AERS tariff records
  011_invoice_line_items.sql  line items + subtotals
  012_shipper_registration.sql  NC Art.3 lifecycle
  013_nominations_kwh_h.sql  volume_mwh → volume_kwh_h
  014_rbp_tables.sql        rbp_sync_log, rbp_auctions
  015_views.sql             5 views (capacity, credit, bid, auction)

  Seed Data (gtcp_test):
  ==================================================
  users:              5 (admin, dispatcher, credit, billing, contracts)
  shippers:           5 (Газпром Экспорт, NIS, MET, WIEH, Srbijagas)
  contracts:          5 (FIRM/INTERRUPTIBLE, 2026)
  capacity_bookings:  8 (KIREVO-ENTRY, HORGOS-EXIT, EXIT-SERBIA)
  system_params:     16 (AERS tariffs, fuel gas, EURIBOR)
  reserve_prices:    57 (all product × point × GY)
  nominations:        8 (test scenarios for matching + over-nom)

  Bugs Found by Tests:
  ==================================================
  BUG-01: Rounding ±€0.01 in billing (toFixed(4) → toFixed(2))
          120/436 capacity calc combinations affected
  BUG-02: ReferenceError: pts used before init in POST /billing/generate
          Contract without tariffs → 500 Internal Server Error
  BUG-03: Missing column is_over_nomination in nominations table
          POST /nominations with over-nom → 500
```

---

## 16. Balancing & OBA

**NC Art.15 split into two scopes (Sprint 16, US-1603b, 10.04.2026)**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LEVEL 1: SHIPPER BALANCING (NC Art.12.3) — ALWAYS BALANCED           │
│  ════════════════════════════════════════════════════════════════     │
│                                                                        │
│  Rule: nominated_kwh_h = allocated_kwh_h = matched_kwh_h              │
│                                                                        │
│  Enforced in nominations.js matching:                                  │
│    UPDATE nominations                                                  │
│    SET status = 'MATCHED',                                             │
│        matched_kwh_h   = min(entry, exit),                             │
│        allocated_kwh_h = min(entry, exit)                              │
│                                                                        │
│  Result: Every shipper Δ=0 by design                                   │
│  NO imbalance charge. NO balancing neutrality line in invoices.       │
│                                                                        │
│  Current shipper balance (verified):                                   │
│    Газпром Экспорт:  Entry 9,752,230 = Horgoš 9,216,209 + Serbia 536,021 │
│    NIS:              Entry 4,000,209 = Serbia 4,000,209               │
│                                                                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  LEVEL 2: TSO-TO-TSO OBA (NC Art.15) — READ-ONLY INFORMATIONAL        │
│  ════════════════════════════════════════════════════════════════     │
│                                                                        │
│            ┌──────────────────┐   KIREVO-ENTRY   ┌─────────────┐      │
│            │  Bulgartransgaz  │ ←────── OBA ────→│   Gastrans  │      │
│            │   (Bulgaria)     │   metering ±0.2%  │     TSO     │      │
│            └──────────────────┘   line pack       └──────┬──────┘      │
│                                   GCV corr.              │              │
│                                                          │              │
│                                                   HORGOS-EXIT            │
│                                                          │              │
│                                                          ↓              │
│                                                   ┌─────────────┐      │
│                                                   │    FGSZ     │      │
│                                                   │  (Hungary)  │      │
│                                                   └─────────────┘      │
│                                                                        │
│                                                   EXIT-SERBIA          │
│                                                          ↓              │
│                                                   ┌─────────────────┐  │
│                                                   │ TRANSPORTGAS    │  │
│                                                   │ SRBIJA (domestic)│  │
│                                                   └─────────────────┘  │
│                                                                        │
│  OBA covers:                                                           │
│    • Metering accuracy (±0.2% typical)                                 │
│    • Line pack changes                                                 │
│    • GCV correction (kWh/Nm³ normalization)                            │
│                                                                        │
│  Breakdown in seed: 70% metering / 20% linepack / 10% GCV             │
│                                                                        │
│  NOT in GTCP scope:                                                    │
│    • Shipper imbalance charge                                          │
│    • Balancing neutrality distribution (Art.15.8)                      │
│    • OBA settlement logic (external process)                           │
│                                                                        │
│  Table: oba_daily_imbalances (migration 018)                          │
│  Retention: 12-month rolling window                                    │
│  Status: PENDING (0-2d) → RECONCILED (3-7d) → SETTLED (>7d)          │
│                                                                        │
│  Endpoints (3):                                                        │
│    GET /balance/oba/daily    — filtered daily records                 │
│    GET /balance/oba/monthly/:month  — per-point monthly aggregation   │
│    GET /balance/oba/summary  — 12-month KPI                           │
│                                                                        │
│  UI: Balance page → OBA Settlement section (read-only)                │
│    • 3 summary cards (KIREVO/HORGOS/SERBIA × 12-month totals)         │
│    • Daily table with month+point filters                              │
│    • Columns: gas_day, point, TSO, nom, measured, Δ, %, breakdown     │
│                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### OBA Data Sample (April 2026)

```
Gas Day   │ Point         │ Adjacent TSO        │ Nominated   │ Measured    │ Δ         │ Status
──────────┼───────────────┼─────────────────────┼─────────────┼─────────────┼───────────┼────────
2026-04-09│ KIREVO-ENTRY  │ Bulgartransgaz      │ 330,058,536 │ 329,770,393 │  -288,143 │ PENDING
2026-04-09│ HORGOS-EXIT   │ FGSZ                │ 221,189,016 │ 220,934,792 │  -254,224 │ PENDING
2026-04-09│ EXIT-SERBIA   │ TRANSPORTGAS SRBIJA │ 108,869,520 │ 108,922,759 │   +53,239 │ PENDING
```

12-month rolling window: avg imbalance ~0.05% per point (well within ±0.2% metering accuracy).

### Migration 018 Schema

```sql
ALTER TABLE nominations ADD COLUMN allocated_kwh_h NUMERIC(18,2);

CREATE TABLE oba_daily_imbalances (
  id SERIAL PRIMARY KEY,
  gas_day DATE NOT NULL,
  point_code TEXT NOT NULL,
  adjacent_tso TEXT NOT NULL,           -- Bulgartransgaz/FGSZ/TRANSPORTGAS SRBIJA
  direction TEXT,
  nominated_kwh NUMERIC(18,2),          -- shipper nominations × 24
  allocated_kwh NUMERIC(18,2),          -- = nominated (Art.12.3)
  measured_kwh  NUMERIC(18,2),          -- physically measured at IP
  metering_diff_kwh  NUMERIC(18,2),     -- 70% of total imbalance
  linepack_diff_kwh  NUMERIC(18,2),     -- 20%
  gcv_correction_kwh NUMERIC(18,2),     -- 10%
  total_imbalance_kwh NUMERIC(18,2) GENERATED ALWAYS AS (measured_kwh - allocated_kwh) STORED,
  oba_status TEXT DEFAULT 'PENDING',
  UNIQUE(gas_day, point_code, direction)
);
```

### NC Art.15 Coverage

| Sub-article | Status | Notes |
|-------------|--------|-------|
| Art.15 OBA concept | ✅ | oba_daily_imbalances table + UI |
| Art.15.4 Imbalance formula | ✅ | ICP/ICN formulas kept (for reference), not applied to shippers |
| Art.15.8 Balancing Neutrality | N/A | Not applicable — shippers always balanced (Art.12.3) |

**Coverage: 50% → 83%** (2/3 sub-articles applicable and implemented).

---

---

## 17. Fuel Gas Allocation Rules (NC Art.18 + Art.19.1.4) — BINDING

**Адопт: 14.04.2026.** На основании анализа INV-2026-0008 и совместного чтения Art.18.3 + физики Art.19.1.4.

### 17.1 Правило

```
FG_fee > 0   ⟺   flow_direction ∈ {KIREVO_HORGOS, KIREVO_HORGOS_AND_SERBIA}
            AND  shipper.fuel_gas_election = 'CASH'  (Art.18.1.1(b))
            AND  AAQ_horgos > 0
```

Все остальные маршруты (`KIREVO_EXIT_SERBIA`, 4× Commercial Reverse) → **FG_fee = 0**.

### 17.2 Обоснование

| Установка FG | Локация (Art.19.1.4) | Обслуживает |
|---|---|---|
| Compressor station | магистраль к HORGOS-EXIT | **только транзит до Horgoš** |
| Preheating GMS-2 Paraćin | Exit Serbia (магистральная ветка) | транзитный поток |
| Preheating GMS-3 Pančevo | Exit Serbia (магистральная ветка) | транзитный поток |
| **GMS-4 Gospođinci** | Exit Serbia | **НЕТ preheater** (не упомянут в Art.19.1.4) |

Domestic shipper (NIS через KIREVO_EXIT_SERBIA): поток идёт до компрессора, выходит через GMS-4 без preheater → нет ни CS, ни PHG → FG = 0.

### 17.3 Кто платит / кто не платит

| Shipper | Route | FG fee | Основание |
|---|---|---|---|
| Газпром Экспорт (SHP-001) | `KIREVO_HORGOS_AND_SERBIA` | **ДА** (только на транзитной доле Q_horgos) | Art.18.3.3 |
| NIS (SHP-002) | `KIREVO_EXIT_SERBIA` | **НЕТ** | Art.19.1.4 (GMS-4 без preheater) |
| CR shipper (любой) | `HORGOS_KIREVO` / `EXIT_SERBIA_KIREVO` / `HORGOS_EXIT_SERBIA` / `EXIT_SERBIA_HORGOS` | **НЕТ** | Art.18.3.3/4 (Physical Flow Direction only; CR = виртуальный поток) |

### 17.4 Election (Art.18.1.1)

- **IN_KIND**: shipper поставляет FG в натуре через Nomination. FG_fee = 0 (кроме Art.18.4.2 edge-case).
- **CASH**: shipper возмещает TSO по тендерной цене Art.18.1.5. Fee по Art.18.2.1.
- Выбор на весь Gas Year (Art.18.1.2).

Требуемое поле schema: `shippers.fuel_gas_election` ∈ {`IN_KIND`, `CASH`}.

### 17.5 Billing Invoice requirements (Art.20.3)

- Art.20.3.2.2: FG — позиция Monthly Invoice.
- Art.20.3.5: при >1 Capacity Product → **отдельный FG-invoice** (не line item внутри общего счёта).
- Art.20.3.6: для LT GTA FG — на основании LT GTA.
- Art.18.5.1.4: цена FG публикуется на сайте TSO ежедневно.

### 17.6 Открытые баги (Debt для Sprint 17+)

| ID | Файл / Строка | Проблема | Severity |
|---|---|---|---|
| FG-01 | [backend/src/routes/billing.js:553-558](../backend/src/routes/billing.js#L553-L558) | Fallback `estFlowKwh = cap × 24 × days × 0.85` начисляет FG **любому** shipper'у независимо от маршрута | P0 |
| FG-02 | [backend/src/routes/billing.js:556-558](../backend/src/routes/billing.js#L556-L558) | Для `KIREVO_EXIT_SERBIA` fallback направляет весь поток в `qHorgosKwh` → применяет X1 (компрессор) — двойная ошибка | P0 |
| FG-03 | schema | Нет поля `shippers.fuel_gas_election` | P1 |
| FG-04 | billing logic | Нет проверки `AAQ > 0` перед начислением FG | P1 |
| FG-05 | invoice generation | FG как line item вместо отдельного invoice (Art.20.3.5) | P2 |
| FG-06 | seed data | INV-2026-0008 (NIS): FG=74 883,91 EUR → должно быть 0, total пересчитать 3 350 312,03 EUR | P0 |
| FG-07 | seed data | Проверить/зачистить исторические FG-строки для NIS и всех CR-shipper'ов | P1 |

### 17.7 Fix snippet (для Sprint 17)

```js
// backend/src/routes/billing.js
const FG_APPLICABLE_DIRECTIONS = ['KIREVO_HORGOS', 'KIREVO_HORGOS_AND_SERBIA'];

if (!FG_APPLICABLE_DIRECTIONS.includes(resolvedDirection)
    || shipper.fuel_gas_election === 'IN_KIND') {
  fuelGasResult = { fuelGasKwh: 0, fuelGasNm3: 0, fuelGasMwh: 0, fuelGasAmountEur: 0 };
} else {
  // существующая логика, но Q_serbia = 0 даже для KIREVO_HORGOS_AND_SERBIA
  fuelGasResult = calcFuelGas({
    qHorgosKwh: Q_horgos_allocated,
    qSerbiaKwh: 0,                   // domestic exit освобождён
    x1Pct: sp.x1CompressorPct,
    x2Pct: 0,                         // не применяется в текущей модели
    knKwh: sp.knQualityKwh,
    ...
  });
}
```

---

*Generated: 10.04.2026 · GTCP Sprint 16 US-1603b Complete*
*Updated: 14.04.2026 · Fuel Gas Allocation Rules (section 17)*
*Source: Development sessions Sprint 8–16*
