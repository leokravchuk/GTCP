# ТЗ — Раздел «Заявка» (Capacity Bid & Booking Management)

**GTCP · Sprint 21 · v2.0 · 19.04.2026**
**NC:** Art.6 (Capacity Products), Art.7 (Auctions), Art.10 (Secondary), CAM NC EU 2017/459
**RBP:** Operational Rules v1.10 (FGSZ), SoapTSOService v1.29

---

## 1. Цель

Создать **новый раздел «Заявка»** в sidebar для полного цикла формирования, подачи и отслеживания заявок на мощность — как напрямую через GTCP (внутренние аукционы), так и через платформу **RBP** (Regional Booking Platform, FGSZ).

**Раздел «Аукционы» не трогать** — он остаётся как есть (календарь, биды, KPI).

---

## 2. Место в навигации

```
Sidebar (существующий):
  Dashboard
  Номинации
  Кредит
  Баланс
  Биллинг
  Договоры
  Мощности
  Аукционы      ← НЕ ТРОГАТЬ
  📋 ЗАЯВКА     ← НОВЫЙ РАЗДЕЛ
  Аудит
  RBP
  Настройки
```

---

## 3. Структура раздела «Заявка»

```
📋 Заявка
├── [Таб] Доступные мощности     ← real-time capacity per IP
├── [Таб] Подать заявку           ← выбор типа → модалка
│   ├── GTCP Internal (Yearly/Q/M/Daily/WD)
│   └── RBP Platform (Bundled/Unbundled auctions)
├── [Таб] Мои заявки              ← портфель GTCP + RBP заявок
└── [Таб] Отчёты                  ← история, сводки, экспорт
```

---

## 4. Таб «Доступные мощности»

Real-time доступная мощность для всех IP. Источник: `GET /capacity/available`.

### 4.1 Physical IPs (Firm / Interruptible)

```
┌──────────────────────────────────────────────────────────────────────┐
│  IP              Dir    Technical     LT (90%)      ST Free (10%)   │
│  KIREVO-ENTRY    ENTRY  15,280,488   13,752,439    1,528,049       │
│  HORGOS-EXIT     EXIT   10,240,233    9,216,209    1,024,024       │
│  EXIT-SERBIA     EXIT    5,040,256    4,536,230      504,026       │
├──────────────────────────────────────────────────────────────────────┤
│  Utilization: 90.0% │ Surrendered: 0 │ Non-nominated: — (Daily/WD) │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 Commercial Reverse IPs

```
┌──────────────────────────────────────────────────────────────────────┐
│  IP                  Dir    Phys Contracted   CR Booked   CR Avail  │
│  HORGOS-ENTRY        ENTRY   9,216,209        0          9,216,209 │
│  EXIT-SERBIA-ENTRY   ENTRY   4,536,230        0          4,536,230 │
│  KIREVO-EXIT         EXIT   13,752,439        0         13,752,439 │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.3 Within-Day (текущий Gas Day)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Gas Day: 19.04.2026 │ CET: 14:32 │ Осталось: 16h                  │
│  IP              Available    Тариф EUR/h     Fee за 16h (100K)     │
│  KIREVO-ENTRY    1,528,049    0.0021          3,360 EUR             │
│  HORGOS-EXIT     1,024,024    0.0023          3,680 EUR             │
│  EXIT-SERBIA       504,026    0.0014          2,240 EUR             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Таб «Подать заявку»

Два канала подачи:

### 5.1 GTCP Internal (прямые аукционы Gastrans)

Для точек, где Gastrans — единственный TSO: **KIREVO-ENTRY**, **EXIT-SERBIA**.

| Тип | Выбор → Действие |
|---|---|
| **Yearly/Quarterly/Monthly/Daily** | Выбрать аукцион из списка OPEN → модалка Bid (volume, price ≥ reserve, fee preview, credit check) |
| **Within-Day** | Выбрать IP → модалка WD Booking (volume, auto-hours, tariff AERS, live fee) |

### 5.2 RBP Platform (bundled аукционы через FGSZ)

Для **HORGOS-EXIT** (совместная точка Gastrans + FGSZ) — заявка уходит на RBP.

**Модель «One Auction — Two Contracts»:** один бид порождает два контракта (Gastrans-shipper + FGSZ-shipper).

| Шаг | UI | API |
|---|---|---|
| 1. Синхронизировать мощности | Кнопка «Sync Capacity → RBP» | `POST /rbp/sync-capacity` |
| 2. Синхронизировать кредиты | Кнопка «Sync Credit → RBP» | `POST /rbp/sync-credit` |
| 3. Посмотреть аукционы RBP | Таблица bundled auctions | `GET /rbp/auctions` |
| 4. Подать заявку на RBP | Модалка RBP Bid | `POST /rbp/bilateral` (bilateral) или через RBP web portal link |
| 5. Посмотреть результаты | Таблица results | `GET /rbp/trades` |

```
┌─── Подать заявку через RBP ───────────────────────────────┐
│                                                            │
│  🔗 RBP Platform (FGSZ Ltd.)                              │
│  Режим: mock (dev) │ Status: ✅ Connected                  │
│                                                            │
│  [Sync Capacity ↑]  [Sync Credit ↑]  [↻ Refresh]         │
│                                                            │
│  ┌── Bundled Auctions (Horgoš) ───────────────────────┐   │
│  │  #    Product     Period      Reserve   Status      │   │
│  │  RBP-2026-Q3  Quarterly  Jul-Sep 2026  2.07  OPEN  │   │
│  │  RBP-2026-M05 Monthly    May 2026      0.76  OPEN  │   │
│  │                              [Подать заявку на RBP] │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌── Мои RBP Trades ─────────────────────────────────┐    │
│  │  Trade#   Auction   Volume    Price   Status       │    │
│  │  (данные из GET /rbp/trades)                       │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ┌── RBP Sync Log ───────────────────────────────────┐    │
│  │  Timestamp    Action           Status   Details    │    │
│  │  (данные из GET /rbp/sync-log)                     │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

### 5.3 Модалка «Bid на GTCP Аукцион» (Scheduled)

```
┌─── Подать заявку на аукцион ──────────────────────────┐
│                                                        │
│  Аукцион:     #51 · Q Firm · KIREVO-ENTRY · Q4 2026  │
│  Канал:       GTCP Internal                            │
│  Reserve:     1.81 EUR/kWh/h/quarter                  │
│  Available:   1,528,049 kWh/h                         │
│                                                        │
│  Volume (kWh/h):  [ 500,000      ] max: 1,528,049    │
│  Offered Price:   [ 1.85         ] min: 1.81 (RP)     │
│                                                        │
│  ── Fee Preview ──                                     │
│  Fee:      500,000 × 1.85 = 925,000 EUR              │
│  Deposit:  92,500 EUR (10%)                            │
│  Credit:   2,900,000 EUR available ✅                  │
│                                                        │
│  [ Отмена ]                     [ Подать заявку ✓ ]   │
└────────────────────────────────────────────────────────┘
```

### 5.4 Модалка «RBP Bid» (Bundled)

```
┌─── Подать заявку через RBP ───────────────────────────┐
│                                                        │
│  RBP Auction:  RBP-2026-Q3 · Quarterly · HORGOS-EXIT │
│  Канал:        RBP (FGSZ) — Bundled Capacity          │
│  ⚠️ One Auction — Two Contracts (Gastrans + FGSZ)     │
│  Reserve:      2.07 EUR/kWh/h/quarter (Gastrans)      │
│                + FGSZ tariff (RBP platform)            │
│                                                        │
│  Volume (kWh/h):  [ 200,000      ]                    │
│  Offered Price:   [ 2.10         ] (Gastrans side)     │
│                                                        │
│  ── Fee Preview (Gastrans side only) ──                │
│  Fee:      200,000 × 2.10 = 420,000 EUR              │
│  ⚠️ FGSZ fee calculated separately on RBP            │
│                                                        │
│  [ Отмена ]                  [ Подать на RBP ✓ ]      │
└────────────────────────────────────────────────────────┘
```

### 5.5 Модалка «Within-Day Booking»

```
┌─── Within-Day бронирование ───────────────────────────┐
│                                                        │
│  IP:          KIREVO-ENTRY                             │
│  Канал:       GTCP Internal (continuous)               │
│  Gas Day:     19.04.2026 │ CET: 14:32                 │
│  Тариф:      0.0021 EUR/kWh/h/hour (AERS)            │
│  Available:   1,528,049 kWh/h                         │
│                                                        │
│  Volume (kWh/h):  [ 100,000      ]                    │
│  Hours:           [ 16           ] (авто до 06:00)    │
│                                                        │
│  ── Fee (LIVE) ──                                      │
│  100,000 × 0.0021 × 16 = 3,360.00 EUR                │
│  NC Art.6.3.1.4: cap × price × hours                  │
│                                                        │
│  [ Отмена ]                  [ Забронировать ✓ ]      │
└────────────────────────────────────────────────────────┘
```

---

## 6. Таб «Мои заявки»

Портфель всех заявок shipper'а — и GTCP internal, и RBP.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Фильтр: [Все] [GTCP] [RBP] [WD]  │  Статус: [Все ▼]  │  [🔍]    │
├──────────────────────────────────────────────────────────────────────┤
│  #     Канал  Product    IP             Volume    Price   Status    │
│  B-01  GTCP   Monthly    KIREVO-ENTRY   500K      0.66   SUBMITTED │
│  B-02  RBP    Quarterly  HORGOS-EXIT    200K      2.10   PENDING   │
│  W-01  WD     Within-Day KIREVO-ENTRY   100K      ×16h   ACTIVE    │
│  B-03  GTCP   Daily      EXIT-SERBIA    300K      0.023  WON       │
│                                                    [Create Contract]│
└──────────────────────────────────────────────────────────────────────┘
```

Lifecycle кнопки:
- DRAFT → «Отправить» / «Удалить»
- WON → «Создать контракт»
- ACTIVE (WD) → информационно

---

## 7. Таб «Отчёты»

### 7.1 История заявок

Полная таблица с фильтрами:
- Период (от/до)
- Тип продукта (Yearly/Q/M/D/WD)
- Канал (GTCP / RBP)
- Статус (Draft / Submitted / Won / Lost / Active / Cancelled)
- IP

### 7.2 Сводка

KPI-блок:

| KPI | Описание |
|---|---|
| Подано заявок | Total bids (GTCP + RBP) за период |
| Выиграно | WON + PARTIALLY_WON |
| Проиграно | LOST |
| В обработке | SUBMITTED + PENDING |
| Общий объём (kWh/h) | SUM volume по выигранным |
| Общая стоимость (EUR) | SUM fee по выигранным |
| WD бронирований | Кол-во + total hours |

### 7.3 По продуктам

Breakdown: строка на каждый product type → кол-во заявок, объём, средняя цена, win rate %.

### 7.4 Экспорт

- **CSV** — `GET /billing/export` pattern (переиспользуем `csvExport.js`)
- **XLSX** — `GET /billing/export?format=xlsx` pattern (переиспользуем `xlsxExport.js`)
- Экспортируемые данные: bid#, канал, product, IP, volume, price, fee, status, date

---

## 8. API endpoints

### Существующие (backend уже готов)

| Method | Path | Для чего |
|---|---|---|
| `GET /capacity/available` | Available capacity per IP (real-time) |
| `GET /capacity/within-day/available` | WD available per IP |
| `POST /capacity/within-day` | Book WD capacity |
| `GET /auctions` | List auction_calendar |
| `POST /auctions/bids` | Create bid |
| `POST /auctions/bids/:id/submit` | Submit bid |
| `POST /auctions/bids/:id/create-contract` | Bid → Contract |
| `GET /credits/:shipperId` | Credit check |
| `GET /reserve-prices` | AERS tariffs |
| `GET /rbp/status` | RBP connection status |
| `GET /rbp/auctions` | RBP auction list |
| `GET /rbp/trades` | RBP trade results |
| `POST /rbp/sync-capacity` | Upload capacity to RBP |
| `POST /rbp/sync-credit` | Sync credit to RBP |
| `POST /rbp/bilateral` | Create bilateral deal |
| `GET /rbp/sync-log` | RBP sync audit log |

### Новые endpoints (Sprint 21)

| Method | Path | Для чего |
|---|---|---|
| `GET /bids/my` | Все заявки текущего shipper'а (GTCP + WD) |
| `GET /bids/report` | Сводный отчёт (KPI + breakdown) |
| `GET /bids/export` | CSV/XLSX экспорт заявок |

---

## 9. Acceptance Criteria

- [ ] Новый раздел «Заявка» в sidebar (не трогать «Аукционы»)
- [ ] 4 таба: Доступные мощности / Подать заявку / Мои заявки / Отчёты
- [ ] Available Capacity загружается real-time из API (Physical + CR + WD)
- [ ] GTCP заявки: модалка с volume, price ≥ reserve, live fee, credit check
- [ ] RBP заявки: sync capacity/credit, view auctions, bid на RBP, view trades
- [ ] Within-Day: auto-hours, tariff AERS, live `cap × price × hours`
- [ ] Мои заявки: портфель GTCP + RBP + WD с lifecycle кнопками
- [ ] Отчёты: история с фильтрами, сводка KPI, breakdown по продуктам
- [ ] Экспорт CSV/XLSX
- [ ] Все числа в kWh/h, EUR, форматирование с разделителем тысяч

---

*ТЗ v2.0 · 19.04.2026 · GTCP Project · Sprint 21*
