# GTCP Session Report — Auction Calendar + Data Integrity — 2026-03-31

**Дата:** 31.03.2026
**Провёл:** Claude Opus 4.6 + Leo
**Тема:** Аукционный календарь (CAM NC MAR0277-24), исправление цепочки Contract→Booking→Nomination, Within-Day архитектура

---

## NC Compliance — исправлена ошибка

**Ошибка:** Yearly Firm auction описан как "для ST 10% мощности".
**Факт (NC Art.7.1.2):** Yearly Firm = **ONLY surrendered LT capacity**. ST 10% продаётся через Quarterly/Monthly/Daily/Within-Day (Art.7.1.1).

✅ Исправлено: CLAUDE.md, GTCP_Artifacts.md, reference_cam_nc_calendar.md
✅ Создано правило: `feedback_nc_before_conclusions.md` — всегда читать NC перед выводами

---

## CAM NC Auction Calendar (MAR0277-24)

✅ Скачан: `ETRM/reports/CAM_NC_Auction_Calendar_2025-2026.xlsx` (ENTSOG, 07.10.2024)
✅ Распарсен: Publication dates, auction dates, delivery periods для Yearly/Quarterly/Monthly/Daily/Within-Day

### Публикация на RBP (CAM NC practice)

| Продукт | Публикация перед аукционом | NC Art. |
|---------|--------------------------|---------|
| Yearly | ~4 недели | 7.4.2.1 |
| Quarterly | ~2 недели | 7.4.2.2 |
| Monthly | ~1 неделя | 7.4.2.3 |
| Daily | В тот же день (D-1) | 7.4.2.4 |
| Within-Day | Непрерывно (нет отдельной публикации) | 7.4.2.5 |

NC Gastrans Art.7.4.1 не указывает конкретные сроки. Сроки из CAM NC (EU 2017/459) practice via MAR0277-24.

---

## Реализовано

### 1. Seed auction_calendar — 68 аукционов

✅ Записано: `ETRM/backend/src/db/seeds/seed_auctions.sql`

| Product | Capacity Type | Count | Status |
|---------|-------------|-------|--------|
| YEARLY Firm | 3 (no LT surrendered, Art.7.1.2) | 3 | CLOSED |
| YEARLY CR | HORGOS-ENTRY + EXIT-SERBIA-ENTRY | 2 | CLOSED |
| QUARTERLY Firm | 4 rounds x 3 IP x varying quarters | 30 | 27 CLOSED + 3 UPCOMING |
| MONTHLY Firm | 8 months x 3 IP | 24 | 18 CLOSED + 3 OPEN + 3 UPCOMING |
| DAILY Firm | 2 days x 3 IP | 6 | 3 CLOSED + 3 OPEN |
| WITHIN_DAY | 3 IP (continuous) | 3 | 3 OPEN |

Reserve prices from AERS 05-145 per IP per product type.

### 2. Backend: GET /auctions/calendar/grid

✅ Записано: `ETRM/backend/src/routes/auctions.js`

Returns: `{ gasYear, months[12], grid[5 products x 12 months], totalAuctions, open, upcoming, closed }`

### 3. Frontend: Calendar Grid

✅ Записано: `ETRM/Soft/GTCP_MVP.html`

- HTML: `<div id="auc-calendar-grid">` с таблицей Product x Month
- JS: `renderAuctionCalendarGrid()` — fetch from `/auctions/calendar/grid`
- Icons: ● CLOSED (green), ◉ OPEN (yellow), ◎ UPCOMING (blue), ▄▄▄ W/D (continuous)
- Click: `showAuctionCellDetail()` — alert с деталями (IP, reserve price, status, NC ref)

### 4. Frontend: Auction table mapping fix

✅ MAX МОЩНОСТЬ: `reserve_price_eur_kwh_h` → `ST_FREE[point_code]` (1,528,049 / 1,024,023 / 504,026)
✅ РЕЗЕРВНАЯ ЦЕНА: отдельное поле, не дублирует capacity

---

## Data Integrity — Contract → Booking → Nomination

### Логика (NC)

```
Shipper (NC Art.3)
  → Contract/GTA (LT = Long-Term GTA / ST = Short-Term GTA via auction)
    → Capacity Booking (LT = LONG_TERM / ST = SHORT_TERM, from auction win)
      → Nomination (volume <= Contracted Capacity, NC Art.13.2.1)
        → Entry = Exit per shipper (NC Art.12.3)
```

### Проблемы найдены и исправлены

| # | Проблема | Исправление |
|---|----------|-------------|
| 1 | Контракты без cap_entry/exit (NULL) | Заполнены из bookings |
| 2 | SHP-003 MET + SHP-005 Srbijagas — контракты без bookings | ST шипперы — bookings добавлены (auction win) |
| 3 | SHP-004 WIEH — номинация 2M > ST available 1.5M | Уменьшена до 1M (=контракт) |
| 4 | SHP-001 Газпром — номинация 10M > booking 9.75M | Уменьшена до 9,752,416 |
| 5 | MWh/d → kWh/h округление (±42 kWh/h) | Entry = Exit выровнены |
| 6 | 3 номинации REJECTED вместо PENDING | Исправлены статусы |
| 7 | DB constraints: auction_calendar, nominations | Добавлены YEARLY, CONFIRMED, SUBMITTED |

### Итоговая таблица

| Shipper | Type | Contract Entry | Contract Exit | Nom Entry | Nom Exit | Balance |
|---------|------|---------------|---------------|-----------|----------|---------|
| SHP-001 Газпром | LT | 9,752,458 | 9,216,208 | 9,752,416 | 9,752,416 | 0 |
| SHP-002 NIS | LT | 4,000,000 | 4,000,000 | 2,500,000 | 2,500,000 | 0 |
| SHP-003 MET | ST | 0 | 0 | 0 | 0 | 0 (no auction win) |
| SHP-004 WIEH | ST | 1,000,000 | 1,000,000 | 1,000,000 | 1,000,000 | 0 |
| SHP-005 Srbijagas | ST | 400,000 | 400,000 | 0 | 0 | 0 (no nomination) |

### IP загрузка

| IP | Nominated | Tech Limit | Util% |
|---|---|---|---|
| KIREVO-ENTRY | 13,252,416 | 15,280,488 | 86.7% |
| HORGOS-EXIT | 10,216,208 | 10,240,233 | 99.8% |
| EXIT-SERBIA | 3,036,208 | 5,040,256 | 60.2% |

---

## GTCP_UserGuide v3.2 — секция 9 обновлена

✅ Полностью переписана секция 9 (Аукционы):
- 9.1.1 Публикация на RBP (сроки per CAM NC practice)
- 9.1.2 Yearly Firm — Art.7.1.2 ONLY surrendered LT
- 9.1.3 Quarterly — 4 раунда с датами + reserve prices
- 9.1.4 Monthly — 12 месяцев с датами, publication, reserve prices по 3 IP
- 9.1.5 Daily — 16:30-17:00 CET, uniform price
- 9.1.6 Within-Day — непрерывный, 30мин окно, CR NOT offered, hourly formula
- 9.1.7 CR — расписание
- 9.1.8 Interruptible — Daily + W/D via Over-Nomination
- 9.1.9 Хронология D-1 → Gas Day
- 9.5 Capacity Split 90/10
- 9.6 API (обновлён с /calendar/grid)

---

## Файлы изменённые

| Файл | Изменения |
|------|-----------|
| `CLAUDE.md` | Yearly = ONLY surrendered LT, сроки публикации, правило "always read NC" |
| `GTCP_Artifacts.md` | Секция 11 — полная архитектура аукционов + календарь MAR0277-24 |
| `GTCP_UserGuide_v3.1.md` | Секция 9 — полностью переписана (9.1.1-9.1.9, 9.5, 9.6) |
| `backend/src/routes/auctions.js` | GET /calendar/grid endpoint |
| `backend/src/db/seeds/seed_auctions.sql` | 68 аукционов GY2025/2026 |
| `Soft/GTCP_MVP.html` | Calendar grid UI, maxCap fix, auction mapping |
| `memory/reference_cam_nc_calendar.md` | CAM NC Calendar reference |
| `memory/feedback_nc_before_conclusions.md` | Rule: always read NC before conclusions |

### БД изменения

| Таблица | Изменение |
|---------|-----------|
| auction_calendar | 68 аукционов (заменены 39 старых) |
| contracts | cap_entry/exit заполнены для всех 5 шипперов |
| capacity_bookings | +4 ST bookings (WIEH + Srbijagas) |
| nominations | volumes выровнены по контрактам, statuses fixed |
| constraints | auction_calendar +YEARLY, nominations +CONFIRMED/SUBMITTED |

---

## Дополнительные исправления (позже в сессии)

### Daily/WD генерация на лету (Вариант B)

✅ Изменено: `backend/src/routes/auctions.js` — GET /calendar/days endpoint генерирует Daily Firm (3 IP), CR Daily (2 IP), Within-Day (3 IP) для каждого дня GY2025/2026 программно. В БД только Yearly/Quarterly/Monthly (115 записей).

### Seed v2 — 115 аукционов

✅ Записано: `backend/src/db/seeds/seed_auctions_v2.sql` — сгенерировано программно по NC Art.7.4:
- 3 Yearly Firm (no LT surrendered) + 2 CR Yearly
- 30 Quarterly Firm (4 rounds × 3 IP × varying quarters) + 20 CR Quarterly
- 36 Monthly Firm (12 months × 3 IP) + 24 CR Monthly

### Available Capacity Engine (Option A: Real-time SQL)

✅ Записано: `backend/src/routes/capacity.js` — GET /capacity/available endpoint:
- Real-time SQL on every request (~10ms)
- Physical: Tech - Contracted + Surrendered + Non-nominated (NC Art.7.1.1)
- CR: Total Contracted Physical - CR Already Contracted (NC Art.7.3)
- Breakdown: tech, contracted, LT, ST, surrendered, non-nominated, available per IP

✅ Изменено: `backend/src/routes/auctions.js` — /calendar/days uses dynamic available from DB instead of hardcoded ST_FREE

✅ Изменено: `backend/src/routes/shippers.js` — GET / returns status, gta_type, ratings

### Auction table improvements

✅ Изменено: `Soft/GTCP_MVP.html`:
- Two capacity columns: TECH (grey) + AVAILABLE (accent, bold)
- capacity_type badge: Firm (blue) / CR (purple) / Int (orange)
- Nomination KPI = Entry only (not Entry+Exit)
- activeShippers filter uses status from backend
- Dashboard labels: "ЗАБРОНИРОВАНО (ВСЕГО)" / "СВОБОДНО ДЛЯ АУКЦИОНОВ"

### CR capacity fix

✅ Изменено: `Soft/GTCP_MVP.html` — ST_FREE map расширен CR IPs:
- HORGOS-ENTRY: 9,216,210 (= Total Contracted Horgos-Exit, NC Art.7.3.2)
- EXIT-SERBIA-ENTRY: 4,536,230
- KIREVO-EXIT: 13,752,439

---

## Следующие шаги

1. **Commit все изменения** — backend + frontend + seeds + docs
2. **Push на GitHub**

### Файлы для обновления (выбери что нужно):

**Backend:**
- [ ] `backend/src/routes/auctions.js` — новые endpoints /calendar/grid, /calendar/days, bid validation
- [ ] `backend/src/routes/auth.js` — accessToken fix
- [ ] `backend/src/routes/billing.js` — res.json(rows), toFixed(2), _test export, pts bugfix
- [ ] `backend/src/routes/nominations.js` — shipperId resolve, PATCH /status, reference lookup
- [ ] `backend/src/routes/credits.js` — /margin-calls, /rating, /instruments
- [ ] `backend/src/routes/capacity.js` — period_from/period_to fix
- [ ] `backend/src/routes/audit.js` — occurred_at fix
- [ ] `backend/src/app.js` — rate limiter production-only
- [ ] `backend/src/db/seeds/seed_auctions_v2.sql` — 115 аукционов GY2025/2026

**Frontend:**
- [ ] `Soft/GTCP_MVP.html` — calendar grid, day-centric view, shipperName fix, capacity mapping, nominations fix, ST_FREE with CR

**Docs:**
- [ ] `CLAUDE.md` — CAM NC calendar, yearly = only surrendered LT, "always read NC" rule
- [ ] `GTCP_Artifacts.md` — секция 11 auction architecture + секция 16 testing
- [ ] `GTCP_UserGuide_v3.1.md` — секция 9 полностью переписана (9.1.1-9.1.9, 9.5, 9.6) + секция 18 testing
- [ ] `reports/session-auction-calendar-2026-03-31.md` — этот отчёт
- [ ] `reports/session-uat-frontend-2026-03-30.md` — UAT frontend fixes
- [ ] `reports/session-uat-dashboard-2026-03-31.md` — dashboard P0 fixes

**Memory:**
- [ ] `memory/reference_cam_nc_calendar.md` — CAM NC dates
- [ ] `memory/feedback_nc_before_conclusions.md` — rule: always read NC

**Seeds/DB:**
- [ ] `backend/src/db/seeds/seed_auctions_v2.sql` — 115 аукционов
- [ ] DB: contracts cap_entry/exit заполнены
- [ ] DB: capacity_bookings — ST bookings для WIEH + Srbijagas
- [ ] DB: nominations — volumes выровнены по контрактам
- [ ] DB: shippers — GTA types, ratings
- [ ] DB constraints — auction_calendar, nominations расширены
