# GTCP — Session Report 19.04.2026

**Local Deploy на порту 3003 + Sprint 20 (Surrender/WD/Interruption)**

---

## 1. Sprint 20 — реализация (15 SP)

### US-2001 · Capacity Surrender + UIOLI (NC Art.8/10) — 5 SP

- Migration 023: `capacity_surrenders` + `interruptions` tables
- `POST /capacity/surrender` — shipper surrenders capacity
- `PATCH /capacity/surrender/:id/approve` — TSO approves/rejects
- `GET /capacity/surrender/history` — surrender history
- `POST /capacity/uioli/check` — underutilization check (<80% threshold)
- 7 tests

### US-2002 · Within-Day Continuous Booking (NC Art.6.3.1.4) — 5 SP

- `POST /capacity/within-day` — hourly booking, fee = cap × price × hours (NOT /365)
- `GET /capacity/within-day/available` — available WD capacity per IP
- 3 tests

### US-2003 · Interruption Management (NC Art.14) — 5 SP

- `POST /capacity/interrupt` — TSO interrupts, penalty = fee × 3 (AERS 05-145 item 3)
- `GET /capacity/interruptions` — interruption history
- 3 tests

**Commit:** `51f682b feat(sprint-20): Capacity Surrender Art.8, Within-Day Art.6, Interruption Art.14`

---

## 2. Local Deploy на порту 3003

### Изменённые файлы (порт 3000 → 3003)

| Файл | Изменение |
|---|---|
| `backend/.env` | `PORT=3003`, добавлен `http://localhost:3003` в `CORS_ORIGIN` |
| `Soft/GTCP_MVP.html` | 10 вхождений `localhost:3000` → `localhost:3003` |
| `backend/frontend/api.js` | fallback BASE_URL → `localhost:3003` |
| `backend/docs/openapi.yaml` | servers URL → `localhost:3003` |

### Исправленные проблемы CSP (Helmet)

| Проблема | Причина | Решение |
|---|---|---|
| Inline scripts blocked (`onclick`, `<script>`) | `helmet()` default CSP: `script-src 'self'` | Добавлен relaxed CSP для frontend: `script-src 'unsafe-inline'`, `script-src-attr 'unsafe-inline'` |
| api.js не загружается (404) | Express static раздаёт только `Soft/`, путь `../backend/frontend/api.js` не резолвится | Добавлен `app.use('/backend/frontend', express.static(...))` |
| Google Fonts blocked | CSP `style-src 'self'` блокирует `fonts.googleapis.com` | Добавлены `https://fonts.googleapis.com` в `style-src`, `https://fonts.gstatic.com` в `font-src` |
| Login 500 (CORS preflight) | `http://localhost:3003` не в `CORS_ORIGIN` | Добавлен в `.env` `CORS_ORIGIN` |

### Итоговая CSP директива для frontend

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-hashes';
script-src-attr 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data:;
connect-src 'self' http://localhost:*;
```

### Код изменений в app.js

```javascript
// Relax CSP for GTCP_MVP.html
app.use('/', helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc:  ["'self'", "'unsafe-inline'", "'unsafe-hashes'"],
    scriptSrcAttr: ["'unsafe-inline'"],
    styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc:    ["'self'", "https://fonts.gstatic.com"],
    imgSrc:     ["'self'", "data:"],
    connectSrc: ["'self'", "http://localhost:*"],
  },
}));
app.use(express.static(path.join(__dirname, '..', '..', 'Soft')));
app.use('/backend/frontend', express.static(path.join(__dirname, '..', 'frontend')));
```

---

## 3. Команды запуска

```powershell
cd C:\Users\leokr\ETRM\backend

# Запуск (PORT, DB, JWT, CORS — из .env)
node src/app.js

# Или явно
$env:PORT="3003"; $env:DB_PORT="8887"; $env:DB_NAME="gtcp"
$env:DB_USER="gtcp_user"; $env:JWT_ACCESS_SECRET="dev-secret-change-me"
$env:RBP_MODE="mock"; $env:CORS_ORIGIN="http://localhost:3003"
node src/app.js
```

### Адреса

| Сервис | URL |
|---|---|
| Backend API | http://localhost:3003/api/v1 |
| Frontend | http://localhost:3003/GTCP_MVP.html |
| Health | http://localhost:3003/api/v1/health |
| OpenAPI | http://localhost:3003/docs/openapi.yaml |

### Логин: `admin` / `admin123`

---

## 4. Метрики после сессии

| Метрика | Значение |
|---|---|
| Tests | 578 (38 suites) |
| Endpoints | 107 |
| OpenAPI | 107/107 (100%) |
| Migrations | 23 |
| NC Coverage | ~92% |

---

*Session report: 19.04.2026 · GTCP Project*
