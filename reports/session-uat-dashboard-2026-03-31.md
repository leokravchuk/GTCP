# GTCP Session Report — Dashboard UAT & Data Fixes — 2026-03-31

**Дата:** 31.03.2026
**Провёл:** Claude Opus 4.6 + Leo
**Тема:** Анализ Dashboard, исправление seed data, новые KPI-блоки

---

## Анализ Dashboard (из скриншота)

### Критические (P0)

| # | Проблема | Причина |
|---|----------|---------|
| 1 | UUID вместо кода шиппера | Dashboard рендерит `s.id` (UUID), не `s.code + s.name` |
| 2 | GTA = "Short-Term ST" у всех | `gta_type` не обновлён для LT-шипперов (Газпром, NIS) |
| 3 | 7 активных шипперов вместо 5 | Test Energy (REMOVED) и Test1 видны на Dashboard |
| 4 | Нет блока "Забронировано по IP" | Отсутствует KPI-виджет с capacity bookings |
| 5 | Нет блока "Свободно для аукционов" | Отсутствует KPI-виджет со свободными мощностями |

### Средние (P1)

| # | Проблема |
|---|----------|
| 6 | Счета все €0.00 DRAFT — capacity fee не рассчитан |
| 7 | Номинации — объём 1,000 kWh/h — тестовые данные |
| 8 | "Short-Term ST" — дублирование текста |
| 9 | Объём номинаций 29M — сумма по всем датам, не текущий Gas Day |

### P2

| # | Проблема |
|---|----------|
| 10 | Топбар ENTRY ≠ EXIT (разница 1,000 kWh/h) — нет индикатора дисбаланса |
| 11 | PARTIALLY_MATCHED без кнопки "Детали" |
| 12 | Нет pagination для таблиц > 10 строк |

---

## Data Fixes (выполнено ранее в сессии)

### Capacity Bookings — пересчитаны по NC Art.6 + AERS 90/10

| IP | Direction | Tech kWh/h | LT Booked (90%) | ST Free (10%) |
|---|---|---|---|---|
| KIREVO-ENTRY | ENTRY | 15,280,488 | 13,752,458 | 1,528,030 |
| HORGOS-EXIT | EXIT | 10,240,233 | 9,216,208 | 1,024,025 |
| EXIT-SERBIA | EXIT | 5,040,256 | 4,536,208 | 504,048 |

### LT распределение по шипперам

| Shipper | ENTRY | EXIT Horgoš | EXIT Serbia | Balance |
|---------|-------|-------------|-------------|---------|
| SHP-001 Газпром | 9,752,458 | 9,216,208 | 536,250 | 0 |
| SHP-002 NIS | 4,000,000 | — | 4,000,000 | 0 |

### Credit — обнулено

Все exposure = 0, рейтинги установлены (Газпром BBB-, MET A-, WIEH BBB).

---

## План реализации P0

### P0-1: Shipper ID → code + name на Dashboard
- Файл: `GTCP_MVP.html` — `renderDashboard()` таблица шипперов
- Замена: `s.id` → `s.code`

### P0-2: GTA type — обновить в БД
- `UPDATE shippers SET gta_type = 'LONG_TERM' WHERE code IN ('SHP-001', 'SHP-002')`

### P0-3: Фильтр — только активные шипперы
- Dashboard: `shippers.filter(s => s.status === 'ACTIVE')` — исключить REMOVED и тестовые

### P0-4: KPI-блок "Забронировано по IP"
- Новый виджет на Dashboard с таблицей capacity bookings per IP
- Данные: `GET /capacity` → группировка по point + direction

### P0-5: KPI-блок "Свободно для аукционов"
- Tech limit (хардкод AERS) минус booked = free
- Зелёный/жёлтый/красный индикатор по % утилизации

---

## Реализация P0

### P0-1: Shipper ID → code + name ✅

✅ Изменено: `GTCP_MVP.html` строка 1798 — `s.id` → `s.code || s.id`

### P0-2: GTA type fix ✅

✅ SQL: `UPDATE shippers SET gta_type = 'LONG_TERM' WHERE code IN ('SHP-001', 'SHP-002')`

### P0-3: Фильтр только ACTIVE ✅

✅ Изменено: `GTCP_MVP.html` — `renderDashboard()`:
- Добавлено `const activeShippers = shippers.filter(s => s.status === 'ACTIVE')`
- KPI "Активные грузоотправители" → `activeShippers.length` (было `shippers.length`)
- Таблица шипперов → `activeShippers.map(...)` (было `shippers.map(...)`)

### P0-4: KPI-блок "Забронировано по IP" ✅

✅ Добавлено: HTML `<table id="t-dash-booked">` + JS рендеринг в `renderDashboard()`:
- 3 строки: KIREVO-ENTRY, HORGOS-EXIT, EXIT-SERBIA
- Колонки: IP, Direction, Booked kWh/h, Tech Limit, Util%
- Цвет: >95% red, >80% yellow
- Данные: из `capacityBookings[]` (backend GET /capacity), fallback 90% от tech

### P0-5: KPI-блок "Свободно для аукционов" ✅

✅ Добавлено: HTML `<table id="t-dash-free">` + JS рендеринг:
- 3 строки: KIREVO-ENTRY, HORGOS-EXIT, EXIT-SERBIA
- Колонки: IP, Direction, Free kWh/h, Tech Limit, Available%
- Цвет: <0 red, <5% yellow, >5% green
- Расчёт: `tech - booked = free`

### Дополнительные исправления

✅ `GTCP_MVP.html` строка 1637-1642 — capacity bookings mapping:
- Добавлено `direction`, `category`, `capacity_mwh_d` → kWh/h конвертация
- Было: `volume: parseFloat(cb.capacity_kwh_h || cb.volume)`
- Стало: `volume: parseFloat(cb.capacity_kwh_h) || (parseFloat(cb.capacity_mwh_d) * 1000 / 24)`

✅ Удалена тестовая номинация с volume < 10,000 kWh/h

✅ Rate limiter отключён в dev mode (`process.env.NODE_ENV === 'production'` guard)

---

## Файлы изменённые за сессию 30-31.03.2026

### Backend routes (7 файлов)

| Файл | Изменения |
|------|-----------|
| `src/routes/auth.js` | `accessToken` + `fullName` в login response |
| `src/routes/billing.js` | `res.json(rows)` вместо `{data:[]}`, `_test` export, pts bugfix, toFixed(2) |
| `src/routes/auctions.js` | `res.json(rows)` для GET /bids, GET / |
| `src/routes/credits.js` | `/margin-calls`, `/:id/rating` (с реальными рейтингами), `/:id/instruments` GET+POST |
| `src/routes/capacity.js` | `period_from`/`period_to` вместо `start_date`/`end_date` |
| `src/routes/audit.js` | `occurred_at` вместо `created_at` |
| `src/routes/nominations.js` | shipperId auto-resolve code→UUID, relaxed validation |
| `src/app.js` | Rate limiter только в production |

### Frontend (1 файл)

| Файл | Изменения |
|------|-----------|
| `Soft/GTCP_MVP.html` | `shipperName()` ищет по id+code, возвращает "code name"; `shippers.find()` 8 мест добавлен `x.code`; nominations загружают все (не только today); `volume_kwh_h`; Dashboard: shipper code, active filter, capacity KPI blocks, GTA badge; capacity mapping с MWh/d→kWh/h конвертацией; пароль пустой по умолчанию |

### База данных

| Изменение | Таблица |
|-----------|---------|
| GTA type = LONG_TERM для SHP-001, SHP-002 | shippers |
| Рейтинги S&P/Moodys/Creditreform | shippers |
| Exposure = 0 для всех | shippers |
| Capacity bookings — пересчитаны по AERS 90/10 | capacity_bookings |
| Номинации — нормализованы по tech limits | nominations |

---

## Следующие шаги

1. **Commit все UAT fixes** — backend + frontend + reports
2. **Push на GitHub**
3. **P1 задачи** — пересчитать счета, фильтр номинаций по Gas Day, "Short-Term" → "ST" badge
4. **P2 задачи** — дисбаланс индикатор, pagination, PARTIALLY_MATCHED детали
