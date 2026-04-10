# GTCP Project Instructions for Claude

## Confidentiality
This folder contains commercially sensitive information based on a real company and study files.
No publication or usage outside this machine is allowed.

---

## Binding Business Rule — Gastrans Network Code

**Before implementing, modifying, or reviewing any feature**, consult the Network Code:

```
File: /sessions/happy-focused-hamilton/mnt/ETRM/NC-Gastrans-2020-ENG.pdf
Full name: Gastrans d.o.o. Natural Gas Transmission System Network Code
Adopted: 03 April 2020, Novi Sad, Republic of Serbia
Pages: 111
```

The NC is the **authoritative legal and operational source of truth** for this system.
If any code, migration, seed data, API logic, or documentation contradicts the NC — **stop and ask the user before proceeding**.

---

## Binding Project Rule — GTCP Artifacts Registry

**`GTCP_Artifacts.md` has the same binding authority as the NC and this CLAUDE.md file.**

```
File: /sessions/happy-focused-hamilton/mnt/ETRM/reports/GTCP_Artifacts.md
Role: Authoritative registry of all project deliverables, sprint history,
      NC compliance status, API surface, migrations, and test coverage.
```

**Rules:**
- Before any sprint work, feature implementation, or documentation change — **read `GTCP_Artifacts.md` first** to understand current project state.
- After completing any sprint, migration, test addition, or API change — **update `GTCP_Artifacts.md`** to reflect the new state.
- The three sources of truth are consulted in this order:
  1. **NC** — legal/operational rules (what the system MUST do)
  2. **GTCP_Artifacts.md** — project state (what the system HAS done and IS doing)
  3. **CLAUDE.md** — implementation rules (HOW to do it)
- If `GTCP_Artifacts.md` contradicts NC — **stop and ask the user before proceeding**.
- If `GTCP_Artifacts.md` is missing or empty — **stop and ask the user to restore it before proceeding**.

---

## NC Compliance Checklist

Before writing or changing any code in the following areas, verify against the NC article listed:

| Area | NC Reference | Key Rule |
|---|---|---|
| Interconnection Points | NC §2.1 Definitions | Only 3 physical IPs exist — see below |
| Flow Direction / Routes | NC §2.1 (Physical Flow Direction, Full Reverse Flow, Half Reverse Flow) | 7 valid routes — see below |
| Capacity Products | NC Art. 6 | 9 product types — see below |
| Capacity units | NC §2.1 ("Contracted Capacity") | Always **kWh/hour** |
| Nomination window | NC Art. 12.6.1.1 | D-1 no later than **14:00 CET** (Confirmed Quantities notified by 16:00 CET) |
| Gas Day | NC §2.1 ("Gas Day") | 06:00 CET → 06:00 CET next day |
| Credit Support | NC Art. 5 | Margin call: 2 Business Days (Art. 5.5) |
| Credit calculation | NC Art. 5.3.1 | Available Credit = Credit Limit − current exposure |
| Fuel Gas billing | NC Art. 18 | Monthly: (Production − Consumption) × tariff |
| Capacity fee tariff | AERS Decision 05-145 (17.07.2025) | EUR/kWh/h/period; see full tariff table below |
| Capacity fee formula | Gastrans analysis | **Separate entry/exit**: fee = cap_entry×t_entry + cap_exit×t_exit (cap_entry ≠ cap_exit!) |
| Within-Day fee | NC Art. 6.3.1.4 | fee = capacity_kWh_h × price_per_hour × hours (NOT / 365) |
| Late payment interest | NC Art. 20.4.2 | **EURIBOR 6M** + 3 pp spread, daily accrual, 360-day basis |
| Interruption penalty | AERS 05-145 item 3 | Interruptible daily/within-day interruption fee = value × **3** |
| Over-Nomination | NC Art. 12.8 | Within-Day Interruptible via over-nomination when Firm fully contracted |
| Invoice due date | NC Art. 20.4.1 | Payment by **20th of month** in which invoice received (issued by 5th, Art. 20.3.1) |
| Balancing | NC Art. 15 | Imbalance Charge per Gas Day |
| Secondary trading | NC Art. 10 | Surrender / UIOLI / RBP |
| Gas quality | NC Art. 17 | GCV, Wobbe index, H2S limits |
| Nominations format | NC Art. 12.1 | kWh, equally allocated to hours |
| Matching | NC Art. 13 | Active TSO / Double-Sided |
| Auctions | NC Art. 7 + CAM NC (EU 2017/459) | Reserve Price, Auction Price, Bundled Capacity |
| Within-Day capacity | NC Art. 6.3.1.4 | fee = capacity_kWh_h × price_per_hour × hours (NOT / 365) |
| VTP trades | NC Art. 11 | Virtual Trading Point — entry+exit from balancing perspective |

---

## CAM NC Auction Calendar 2025/2026 (MAR0277-24)

**Binding source:** `ETRM/reports/CAM_NC_Auction_Calendar_2025-2026.xlsx`

| Product | Schedule | Timing |
|---------|----------|--------|
| **Yearly** Firm | 1st Monday of July | **ONLY if LT surrendered/released** (NC Art.7.1.2). NOT for ST 10%. Auction 07.07.2025 |
| **Yearly** Interruptible | 3rd Monday of July | Auction 21.07.2025 |
| **Quarterly** Firm | 1st Monday of Aug/Nov/Feb/May (4 rounds) | Q1=Oct-Dec, Q2=Jan-Mar, Q3=Apr-Jun, Q4=Jul-Sep |
| **Quarterly** Interruptible | 1st Monday of Sep/Dec/Mar/Jun | 1 month after Firm |
| **Monthly** Firm | 3rd Monday of M-1 | e.g. Mar 2026 delivery → auction 16.02.2026 |
| **Monthly** Interruptible | 1 week after Firm | e.g. Mar 2026 → 24.02.2026 |
| **Daily** Firm | D-1 at 15:30 UTC (winter) / 14:30 UTC (summer) | Repeating every day |
| **Daily** Interruptible | D-1 at 16:30 / 15:30 UTC | 1 hour after Firm |
| **Within-Day** | Continuous, every hour | For remaining hours of current Gas Day |

## Available Capacity Formulas (NC Art.7.1.1 + Art.7.3)

**Binding rule — always calculate from DB, never hardcode.**

```
Firm ST Available (Art.7.1.1):
  = Technical[IP] - SUM(active bookings at IP) + SUM(surrendered at IP)
  Daily/WD: += non-nominated capacity (Art.12.7.5)

CR Available (Art.7.3.2-7.3.5):
  = SUM(contracted in physical direction at IP) - SUM(CR already contracted at IP)

Yearly Firm Available (Art.7.1.2):
  = SUM(surrendered LT at IP)  (0 if no surrender)

Available Credit (Art.5.3.4):
  Updated every hour on Capacity Booking Platform
```

API: `GET /capacity/available` — real-time SQL, always fresh.
Implementation: Option A (real-time SQL on every request).

**Sprint 14 Auction Calendar Endpoints (31.03.2026):**
- `GET /auctions/calendar/grid` — Product × Month grid for Gas Year (Yearly/Quarterly/Monthly status per month)
- `GET /auctions/calendar/days?year=YYYY&month=M` — Day-centric calendar: DB auctions (Y/Q/M) + on-the-fly Daily/WD per day

Total API endpoints: **96** (was 93 at Sprint 12)

**Sprint 16 capacity_kwh_h (09.04.2026):**
- Migration 017: `capacity_bookings.capacity_kwh_h` — native kWh/h column (АЕРС-exact)
- All 12 runtime conversions `capacity_mwh_d * 1000 / 24` replaced with `capacity_kwh_h` in 6 files
- `capacity_mwh_d` kept for backward compatibility (deprecated, do not use in new code)
- Bug fixed: nominations.js over-nomination compared MWh/d with kWh/h (BUG-04/05)
- Migrations: 000–017

**Sprint 16 UI cleanup (10.04.2026):**
- Billing tariff SQL: `tariff_eur` → `price_eur` (reserve_prices column), contract_type mapping FIRM→FIRM_YEARLY
- Frontend contracts mapping uses `capEntryKwhH`/`capExitKwhH` + AERS lookup by `flow_direction`
- Credit NC Art.5.1.6: rated shippers (Газпром BBB-) show "ОСВОБОЖДЁН" instead of minimum
- Gas quality UI: correct columns `wobbe_kwh_nm3`, `methane_pct`, `density_kg_nm3`
- Billing table uses `total_amount_eur`, `line_items_count`, `due_date` (not legacy volume*tariff)
- Contracts table shows raw kWh/h + separate AERS tariffs (not bundled)
- Data cleanup: 7 stale invoices + 3 orphan ST contracts deleted; 8 monthly Jan-Apr 2026 generated

---

**Key rules:**
- **Yearly Firm auction = ONLY surrendered LT capacity** (NC Art. 7.1.2). If no LT released → no yearly auction. ST 10% is NOT sold at yearly auction.
- **ST 10% capacity is sold via Quarterly/Monthly/Daily/Within-Day auctions** (NC Art. 7.1.1).
- Available Capacity = Technical Capacity − Total Contracted + Surrendered (NC Art. 7.1.1.1–7.1.1.4).
- Within-Day = NOT a scheduled auction. It runs continuously for each remaining hour of the Gas Day.
- Within-Day fee = capacity × price_per_hour × hours. Do NOT divide by 365.
- Within-Day Commercial Reverse is NOT offered (NC Art. 6.5.2).
- All auction times in UTC. CET = UTC+1 (winter), CEST = UTC+2 (summer).
- **ALWAYS read NC article before making statements about auction rules.**

---

## Interconnection Points (NC §2.1 Definitions)

Exactly **3 physical interconnection points** exist on the Gastrans pipeline:

| Code in DB | NC Official Name | Direction | Location |
|---|---|---|---|
| `KIREVO-ENTRY` | Entry Point Kirevo/Zaječar | ENTRY (physical) | Bulgarian-Serbian border, near Zaječar |
| `HORGOS-EXIT` | Exit Point Horgoš/Kiškundorožma 1200 | EXIT (physical) | Serbian-Hungarian border, near Kiškundorožma |
| `EXIT-SERBIA` | Exit Point Serbia (= Gospođinci + Pančevo + Paraćin) | EXIT (physical) | Domestic Serbia: GMS-2, GMS-3, GMS-4 |

For **Commercial Reverse Flow** the same physical points act as reversed entry/exit:

| Code in DB | NC Official Name | Used in |
|---|---|---|
| `HORGOS-ENTRY` | Entry Point Horgoš/Kiškundorožma 1200 | Full Reverse A, Half Reverse A |
| `EXIT-SERBIA-ENTRY` | Entry Point Serbia | Full Reverse B, Half Reverse B |
| `KIREVO-EXIT` | Exit Point Kirevo/Zaječar | Full Reverse A and B (virtual exit to Bulgarian border) |

**Old / deprecated names** — must NOT appear in new code or data:
- `Horgoš` (plain text) — use `KIREVO-ENTRY` or `HORGOS-EXIT`
- `Gospođinci` (plain text) — use `EXIT-SERBIA`
- `GOSPODJINCI-ENTRY`, `GOSPODJINCI-EXIT` — deprecated since migration 005

---

## Transportation Routes (NC §2.1)

Physical Flow Direction: **Bulgaria → Serbia and/or Hungary**
Commercial Reverse Flow: **virtual** opposite direction (NC §2.1, Art. 6.1.2)

| `flow_direction` code | Type | Entry → Exit | NC Reference |
|---|---|---|---|
| `KIREVO_HORGOS` | PHYSICAL | KIREVO-ENTRY → HORGOS-EXIT | NC §2.1 |
| `KIREVO_EXIT_SERBIA` | PHYSICAL | KIREVO-ENTRY → EXIT-SERBIA | NC §2.1 |
| `KIREVO_HORGOS_AND_SERBIA` | PHYSICAL | KIREVO-ENTRY → HORGOS-EXIT + EXIT-SERBIA | NC §2.1 |
| `HORGOS_KIREVO` | COMMERCIAL_REVERSE_FULL | HORGOS-ENTRY → KIREVO-ENTRY | NC Art. 6.1.2.4 |
| `EXIT_SERBIA_KIREVO` | COMMERCIAL_REVERSE_FULL | EXIT-SERBIA-ENTRY → KIREVO-ENTRY | NC Art. 6.1.2.4 |
| `HORGOS_EXIT_SERBIA` | COMMERCIAL_REVERSE_HALF | HORGOS-ENTRY → EXIT-SERBIA | NC Art. 6.1.2 |
| `EXIT_SERBIA_HORGOS` | COMMERCIAL_REVERSE_HALF | EXIT-SERBIA-ENTRY → HORGOS-EXIT | NC Art. 6.1.2 |

Legacy codes `GOSPODJINCI_HORGOS` and `HORGOS_GOSPODJINCI` are kept in the CHECK constraint for backward compatibility only — do not use in new contracts.

JS constants: `src/utils/ncRoutes.js`

---

## Capacity Products (NC Art. 6)

| Product type | `contract_type` / product code | Duration | NC Article |
|---|---|---|---|
| Firm Yearly | `FIRM_YEARLY` | 1 Gas Year | 6.1.2.1 |
| Firm Quarterly | `FIRM_QUARTERLY` | 1 Gas Quarter | 6.3.1.1 |
| Firm Monthly | `FIRM_MONTHLY` | 1 Gas Month | 6.3.1.2 |
| Firm Daily | `FIRM_DAILY` | 1 Gas Day | 6.3.1.3 |
| Firm Within-Day | `FIRM_WITHIN_DAY` | < 1 Gas Day | 6.3.1.4 |
| Interruptible Daily | `INTERRUPTIBLE` | 1 Gas Day | 6.1.2.3 |
| Commercial Reverse Yearly | `COMM_REV_YEARLY` | 1 Gas Year | 6.1.2.4 |
| Commercial Reverse Short-Term Quarterly | `COMM_REV_QUARTERLY` | 1 Gas Quarter | 6.5.2.2 |
| Commercial Reverse Short-Term Monthly | `COMM_REV_MONTHLY` | 1 Gas Month | 6.5.2.3 |
| Commercial Reverse Short-Term Daily | `COMM_REV_DAILY` | 1 Gas Day | 6.5.2.4 |

Capacity is always expressed in **kWh per hour** (kWh/h). Never use MWh/day for contracted capacity values.

---

## Technical Capacity (AERS, GY 2022/2023)

| Point | Technical kWh/h | LT Reserved (90%) | ST Free for Auctions (10%) |
|---|---|---|---|
| Entry Kirevo/Zaječar | **15,280,488** | 13,752,439 | **1,528,049** |
| Exit Domestic (3 pts) | **5,040,256** | 4,536,230 | **504,026** |
| Exit Horgoš | **10,240,233** | 9,216,209 | **1,024,024** |

> **Critical rule:** Reserved Entry (13,752,439) ≠ Reserved Exit Horgoš (9,216,209).
> Difference = domestic exit zone capacity.
> Billing MUST use separate entry/exit capacity values — never assume cap_entry == cap_exit.
> **ST Free balance:** Entry Free (1,528,049) = Exit Horgoš Free (1,024,024) + Exit Serbia Free (504,026) − 1 (rounding)

## LT Booking Rules (Sprint 16, 09.04.2026)

**Binding rule — enforced in seed data, billing, and capacity checks.**

| Rule | Description | NC / Legal Basis |
|---|---|---|
| **Газпром HORGOS-EXIT = 90% Tech** | 9,216,209 kWh/h. NOT higher. | Final Exemption Act + NC Art.7.1.2 |
| **LT total per IP ≤ 90% Tech** | Газпром + NIS combined must not exceed floor(Tech × 0.9) | AERS 90/10 split |
| **ST = 10% fully free for auctions** | No ST pre-bookings. ST pool = Tech − LT = available for Quarterly/Monthly/Daily/WD auctions | NC Art.7.1.1 |
| **Shipper balance: Entry = Σ Exit** | Each shipper's total Entry kWh/h must equal total Exit kWh/h | NC Art.12.3 |
| **capacity_kwh_h is authoritative** | Use `capacity_kwh_h` column (not `capacity_mwh_d × 1000 / 24`) | Migration 017 |

### Current LT Bookings (seed data, 09.04.2026)

| Shipper | KIREVO-ENTRY | HORGOS-EXIT | EXIT-SERBIA | Balance |
|---|---|---|---|---|
| Газпром Экспорт | 9,752,230 | 9,216,209 | 536,021 | Δ=0 ✅ |
| NIS | 4,000,209 | — | 4,000,209 | Δ=0 ✅ |
| **LT Total** | **13,752,439** | **9,216,209** | **4,536,230** | |
| % of Tech | 90.0% | 90.0% | 90.0% | |

---

## Official Reserve Prices — AERS Decision 05-145 (17.07.2025, GY2025/2026)

### Annual Capacity (EUR/kWh/h/year)

| Point | Firm | Interruptible | Commercial Reverse |
|---|---|---|---|
| Entry Kirevo | **6.00** | — | **2.85** |
| Domestic Exit | **4.19** | — | **1.99** |
| Exit Horgoš | **6.85** | — | **3.25** |

### Quarterly Capacity (EUR/kWh/h/quarter)

| Quarter | Entry F | Dom F | Horgoš F | Entry CR | Dom CR | Horgoš CR |
|---|---|---|---|---|---|---|
| Q1 (Oct-Dec) | 1.81 | 1.27 | 2.07 | 0.86 | 0.60 | 0.98 |
| Q2 (Jan-Mar) | 1.78 | 1.24 | 2.03 | 0.85 | 0.59 | 0.96 |
| Q3 (Apr-Jun) | 1.80 | 1.25 | 2.05 | 0.86 | 0.59 | 0.97 |
| Q4 (Jul-Sep) | 1.81 | 1.27 | 2.07 | 0.86 | 0.60 | 0.98 |

### Monthly Capacity (EUR/kWh/h/month)

| Month type | Entry F | Dom F | Horgoš F | Entry CR | Dom CR | Horgoš CR |
|---|---|---|---|---|---|---|
| 28 days (Feb) | 0.60 | 0.42 | 0.68 | 0.29 | 0.20 | 0.32 |
| 30 days | 0.64 | 0.45 | 0.73 | 0.30 | 0.21 | 0.35 |
| 31 days | 0.66 | 0.46 | 0.76 | 0.31 | 0.22 | 0.36 |

### Daily Capacity (EUR/kWh/h/day)

| Point | Firm | Interruptible | Commercial Reverse |
|---|---|---|---|
| Entry Kirevo | **0.0329** | 0.0329 | 0.0156 |
| Domestic Exit | **0.0230** | 0.0230 | 0.0109 |
| Exit Horgoš | **0.0375** | 0.0375 | 0.0178 |

### Within-Day Capacity (EUR/kWh/h/hour)

| Point | Firm | Interruptible | Commercial Reverse |
|---|---|---|---|
| Entry Kirevo | **0.0021** | 0.0021 | — |
| Domestic Exit | **0.0014** | 0.0014 | — |
| Exit Horgoš | **0.0023** | 0.0023 | — |

> Within-Day Commercial Reverse is NOT offered (NC Art. 6.5.2).
> **Interruption penalty** (AERS item 3): interruptible daily/within-day interruption → fee × **3**.

---

## Billing Formulas

### Capacity Fee — Period-Aware Formula (NC Art. 20 + AERS 05-145)

**CRITICAL:** formula depends on product type. Tariff unit = EUR/kWh/h/**per product period**.

```
ANNUAL (tariff = EUR/kWh/h/year):
  fee = cap_kWh_h × tariff / 365 × days_in_month

QUARTERLY (tariff = EUR/kWh/h/quarter):
  fee = cap_kWh_h × tariff / days_in_quarter × days_in_month
  (Q1=92d, Q2=90d, Q3=91d, Q4=92d)

MONTHLY (tariff = EUR/kWh/h/month):
  fee = cap_kWh_h × tariff × 1
  (tariff is ALREADY for the month — do NOT divide by anything!)

DAILY (tariff = EUR/kWh/h/day):
  fee = cap_kWh_h × tariff × days_in_month

WITHIN-DAY (tariff = EUR/kWh/h/hour):
  fee = cap_kWh_h × tariff × hours
  (do NOT divide by 365!)
```

**Always separate entry and exit** — cap_entry ≠ cap_exit:
```
monthly_invoice = entry_fee(cap_entry, tariff_entry) + exit_fee(cap_exit, tariff_exit)
```

**WRONG (do NOT use):**
```
fee = cap × tariff / 365 × days   ← ONLY correct for Annual!
fee = cap × (t_entry + t_exit)     ← assumes cap_entry == cap_exit, FALSE for Gastrans
```

**Example (March 2026, 31 days, Entry Kirevo 13,752,230 kWh/h):**
```
