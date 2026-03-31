# GTCP Session Report — UAT Frontend Fixes — 2026-03-30

**Дата:** 30.03.2026
**Провёл:** Claude Opus 4.6 + Leo
**Тема:** Ручное тестирование фронтенда (GTCP_MVP.html) + исправление совместимости backend ↔ frontend

---

## Что сделано

### Backend → Frontend совместимость (10 багов)

| # | Баг | Endpoint | Причина | Исправление | Файл |
|---|-----|----------|---------|-------------|------|
| 1 | `iData.map is not a function` | GET /billing | Возвращал `{data:[...]}` вместо `[...]` | Заменено на `res.json(rows)` + `X-Total-Count` header | billing.js:324 |
| 2 | `bidData.map is not a function` | GET /auctions/bids | Возвращал `{count, bids:[...]}` | Заменено на `res.json(rows)` | auctions.js:305 |
| 3 | Token не сохранялся | POST /auth/login | Response `{token}`, api.js ожидает `{accessToken}` | Добавлено `accessToken: token` + `fullName` | auth.js |
| 4 | credits/margin-calls 500 | GET /credits/margin-calls | Шло в `/:shipperId` → UUID parse error | Добавлен маршрут `/margin-calls` **перед** `/:shipperId` | credits.js |
| 5 | credits/:id/rating 404 | GET /credits/:id/rating | Маршрут не существовал | Добавлен `/:shipperId/rating` с rating stub | credits.js |
| 6 | capacity 500 | GET /capacity | `cb.start_date` → колонка не существует | Заменено на `cb.period_from` / `period_to` | capacity.js |
| 7 | audit 500 | GET /audit | `created_at` → колонка не существует | Заменено на `occurred_at` | audit.js |
| 8 | nominations 500 с SHP-001 | POST /nominations | `shipperId: "SHP-001"` → UUID expected | Авто-resolve: code → UUID через `SELECT id FROM shippers WHERE code = $1` | nominations.js |
| 9 | Номинации не отображаются | GET /nominations | Фильтр только за сегодня + `volume_mwh` null | Убран фильтр по дате, `volume_kwh_h \|\| volume_mwh` | GTCP_MVP.html:1525 |
| 10 | Rate limiter 429 при разработке | POST /auth/login | 100 req/15min слишком мало для dev | `NODE_ENV !== 'production' ? 1000 : 100` | app.js:52 |

### Данные — нормализация номинаций

Тестовые номинации содержали нереалистичные объёмы (107M kWh/h при tech limit 15.3M). Исправлено:

| Точка | Было | Стало | Тех. лимит | Загрузка |
|-------|------|-------|-----------|----------|
| KIREVO-ENTRY | 107,584,333 | **14,500,000** | 15,280,488 | 95% |
| HORGOS-EXIT | 24,418,667 | **10,000,000** | 10,240,233 | 98% |
| EXIT-SERBIA | 28,750,000 | **4,500,000** | 5,040,256 | 89% |

NC Art.12.3 (Equal Nominations) — исправлено:

| Шиппер | Entry | Exit Horgoš | Exit Serbia | Баланс |
|--------|-------|-------------|-------------|--------|
| SHP-001 Газпром | 10,000,000 | 8,000,000 | 2,000,000 | **0** ✅ |
| SHP-002 NIS | 2,500,000 | — | 2,500,000 | **0** ✅ |
| SHP-004 WIEH | 2,000,000 | 2,000,000 | — | **0** ✅ |
| **TOTAL** | **14,500,000** | **10,000,000** | **4,500,000** | **0** ✅ |

### Матчинг проверен

```
POST /nominations/match { gasDay: "2026-04-05" }
→ matchedPairs: 1
→ SHP-001: ENTRY 13M ↔ EXIT 9M → matchedVolume: 9,000,000 kWh/h
```

---

## Что не завершено

- [ ] Фронтенд `_refreshFromBackend()` вызывает слишком много запросов при каждом action (6 рефрешей за 1 клик) — нужен debounce
- [ ] Demo-номинации из in-memory при init пытаются POST → 400/500 — нужен guard `if (!backendMode)` перед demo init
- [ ] `credits/228937cd-...` — неизвестный shipper ID в запросе (demo data leak)
- [ ] Chrome "Local Network Access detected" warnings при открытии через `file://` — нужно открывать через `http://localhost:5501/Soft/GTCP_MVP.html`

---

## Решения

1. **`res.json(rows)` vs `{data: rows}`** — frontend api.js ожидает массив напрямую (`.map()`), а не обёрнутый объект. Стандарт проекта: GET list endpoints возвращают `[]`, total в `X-Total-Count` header.

2. **Route ordering в credits.js** — `/margin-calls` и `/:shipperId/rating` должны быть **перед** `/:shipperId`, иначе Express парсит "margin-calls" как UUID → 500.

3. **ShipperId auto-resolve** — фронтенд хранит shipper code ("SHP-001"), backend ожидает UUID. Добавлен fallback: если `shipperId.length < 36` → `SELECT id FROM shippers WHERE code = $1`.

4. **Rate limiter в dev** — увеличен до 1000 req/15min для dev, 100 для production. Каждый `_refreshFromBackend()` делает ~15 запросов → 6 refresh = 90 запросов → быстро упирается в лимит 100.

---

## Shipper code + name — глобальное исправление (31.03.2026)

### Проблема

Фронтенд отображал только `shipper_code` ("SHP-001") без имени компании. Причины:
1. `shipperName(id)` искал только по `s.id` (UUID), но `n.shipperId` из backend = `shipper_code`
2. `shippers.find(x=>x.id===sid)` — 8 мест в коде искали только по UUID
3. Balance section фильтровал номинации по `s.id`, не находил совпадений → всё по нулям

### Исправления в GTCP_MVP.html

| Строка | Было | Стало |
|--------|------|-------|
| 1295 | `shipperName(id)` возвращал `s.name` | Возвращает `${s.code} ${s.name}`, ищет по `id \|\| code` |
| 1527 | `shipperId: n.shipper_code` | + `shipperName: n.shipper_name` |
| 1541 | `shipperId: inv.shipper_code` | + `shipperName: inv.shipper_name` |
| 2212-2213 | `n.shipperId===s.id` | `n.shipperId===s.id \|\| n.shipperId===s.code` |
| 2216 | `${s.name}` | `${s.code} ${s.name}` |
| 3088, 3117 | `find(x=>x.id===...)` | `find(x=>x.id===...\|\|x.code===...)` |
| 8 мест | `shippers.find(x=>x.id===sid)` | `shippers.find(x=>x.id===sid\|\|x.code===sid)` |

**Результат:** во всех таблицах (Номинации, Биллинг, Баланс, Кредит, Аукционы) отображается "SHP-001 Газпром Экспорт" вместо "SHP-001".

---

## Следующие шаги

1. **Commit все UAT fixes** — backend routes + GTCP_MVP.html + app.js
2. **Debounce _refreshFromBackend()** — throttle до 1 раза в 3 секунды
3. **Guard demo init** — не создавать demo-номинации в backendMode
4. **Проверить остальные разделы** — Billing, Contracts, Credits, Auctions, Capacity, Balance
