# GTCP — Инструкция по локальному запуску

**Gas Trading & Commercial Platform · v3.0 · Sprint 18**
Последнее обновление: 17.04.2026 · Sprint 18

> **Sprint 12–18 изменения (с предыдущей версии):**
> - Миграции 000–022 (VTP trades, FG election, adjacent TSO, invoice_type, OBA, capacity_kwh_h)
> - API endpoints: 95 actual (`npm run count-endpoints`)
> - Jest тесты: 559/559 (36 suites)
> - VTP Basic (NC Art.11): 5 новых endpoints
> - Excel xlsx export (exceljs): billing/contracts/nominations `?format=xlsx`
> - FG separate invoice (NC Art.20.3.5): invoice_type CAPACITY/FUEL_GAS
> - NC Art.13 matching: Adjacent TSO mock + Lesser Rule
> - Analytics dashboard: volumes/revenue/utilization endpoints
> - CSV export (RFC 4180 + BOM): 3 endpoints
> - OBA Settlement (NC Art.15): read-only TSO-to-TSO view

---

## Требования

| Инструмент | Версия | Скачать |
|---|---|---|
| Node.js | >= 20.x LTS | https://nodejs.org |
| PostgreSQL | 15–18.x | https://www.postgresql.org/download/windows/ |
| Docker Desktop | 4.x+ | https://www.docker.com/products/docker-desktop/ (опционально) |
| Git | любая | https://git-scm.com |

Проверить версии:
```powershell
node --version    # v20.x.x+
npm --version     # 10.x.x
psql --version    # 15.x / 17.x / 18.x
docker --version  # 4.x (если используешь Docker)
```

> **Нестандартные порты:** если PostgreSQL 17 слушает на `8887`, а PG18 на `8888` — укажи нужный порт в `.env` через `DB_PORT=8887`.

---

## Вариант A — Docker Compose (рекомендуется)

PostgreSQL + Node.js API одной командой.

### Первый запуск

```powershell
cd C:\Users\leokr\ETRM\backend

# 1. Собрать и запустить контейнеры (API + PostgreSQL)
docker compose up -d

# 2. Применить миграции (000–022)
docker compose exec api node src/db/migrate.js

# 3. Загрузить тестовые данные
docker compose exec api node src/db/seed.js
```

### Ежедневный запуск

```powershell
cd C:\Users\leokr\ETRM\backend

docker compose up -d        # запустить в фоне
docker compose down         # остановить
docker compose down -v      # остановить + удалить данные БД (полный сброс)
docker compose logs -f api  # логи API
```

### Адреса после запуска

| Сервис | URL |
|---|---|
| API | http://localhost:3000/api/v1 |
| Swagger UI | http://localhost:3000/docs |
| Frontend | http://localhost:3000/GTCP_MVP.html |
| PostgreSQL | localhost:5432 (gtcp / gtcp_user / gtcp_dev_password) |

---

## Вариант B — Node.js напрямую (без Docker)

Нужен PostgreSQL, установленный и запущенный локально.

### 1. Создать базу данных

```powershell
psql -U postgres
```

```sql
CREATE USER gtcp_user WITH PASSWORD 'gtcp_dev_password';
CREATE DATABASE gtcp OWNER gtcp_user;
GRANT ALL PRIVILEGES ON DATABASE gtcp TO gtcp_user;
\q
```

### 2. Настроить переменные окружения

```powershell
cd C:\Users\leokr\ETRM\backend
copy .env.example .env
```

Минимально необходимые значения в `.env`:

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gtcp
DB_USER=gtcp_user
DB_PASSWORD=gtcp_dev_password
JWT_ACCESS_SECRET=any_random_64_char_string_here_for_local_dev
JWT_REFRESH_SECRET=another_random_64_char_string_here_for_local
RBP_MODE=mock
```

### 3. Установить зависимости и запустить

```powershell
cd C:\Users\leokr\ETRM\backend

npm install        # установить зависимости
npm run migrate    # применить миграции 000–022
npm run seed       # загрузить тестовые данные
npm run dev        # dev-сервер (nodemon hot-reload)
```

Сервер запустится на `http://localhost:3000`.

---

## Тесты

```powershell
cd C:\Users\leokr\ETRM\backend

# Все тесты (559 test cases, 36 suites)
npm test

# С отчётом покрытия
npm run test:coverage

# Один файл
npx jest tests/vtp.integration.test.js --verbose
npx jest tests/billing.integration.test.js --verbose

# Только mock-тесты (не требуют PostgreSQL)
npx jest --testPathIgnorePatterns realdb --verbose

# Real-DB тесты (требуют PostgreSQL на 8887)
DB_PORT=8887 DB_NAME=gtcp_test npx jest tests/nominations.realdb.test.js
```

Ожидаемый результат (Sprint 18):
```
Test Suites: 36 passed, 36 total
Tests:       559 passed, 559 total
```

### Тест-сьюты (ключевые)

| Suite | Тестов | Scope |
|---|---|---|
| billing.integration.test.js | 12 | CRUD, permissions, filters |
| billing.coverage.test.js | 17 | Gas quality, line items, ERP |
| billing.dbspec.test.js | 10 | Generate branches, tariff lookup |
| credits.test.js | 21 | Credit support, margin calls |
| auctions.test.js / coverage | 17+22 | Bids, results, create-contract |
| nominations.deep.test.js | 7 | Capacity check, over-nom, edigas |
| nominations.realdb.test.js | 6 | Real SQL with PostgreSQL |
| vtp.integration.test.js | 16 | VTP CRUD, balance, confirm |
| fuel-gas.unit.test.js | 12 | FG route x election x AAQ |
| adjacent-tso.*.test.js | 25 | NC Art.13 matching |
| analytics.test.js | 11 | Volumes, revenue, utilization |
| csv-export.test.js | 15 | BOM, escaping, permissions |
| export-xlsx.test.js | 5 | Excel formatting, empty result |
| fg-invoice-split.test.js | 3 | Art.20.3.5 multi-product split |

---

## API Quick Start

### 1. Получить токен

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

Ответ: `{"token": "eyJ..."}`. Использовать в заголовке `Authorization: Bearer <token>`.

### 2. Первый запрос

```bash
# Список шипперов
curl http://localhost:3000/api/v1/shippers \
  -H "Authorization: Bearer <token>"

# VTP баланс
curl http://localhost:3000/api/v1/vtp/balance \
  -H "Authorization: Bearer <token>"

# Аналитика объёмов
curl http://localhost:3000/api/v1/analytics/volumes \
  -H "Authorization: Bearer <token>"
```

### 3. Swagger UI

Открыть http://localhost:3000/docs — полная OpenAPI 3.0 документация всех 95 endpoints.

---

## Endpoint Audit

```powershell
cd C:\Users\leokr\ETRM\backend

# Единый источник правды — подсчёт из кода
npm run count-endpoints

# Ожидаемый результат:
#   Actual endpoints (router.*/app.*): 95
#   OpenAPI paths × methods:           95
#   In sync: ✅ YES
```

---

## Swagger UI

После запуска бэкенда:

```
http://localhost:3000/docs
```

Swagger UI (CDN) с OpenAPI 3.0.3 спецификацией всех 95 endpoints.

---

## Частые проблемы

| Проблема | Решение |
|---|---|
| `npm install` — 1 пакет | Ты в корне ETRM. Перейди в `cd backend` |
| `ECONNREFUSED 5432` | PostgreSQL не запущен. Запусти Docker или сервис |
| `JWT_ACCESS_SECRET is required` | Не создан `.env`. Выполни `copy .env.example .env` |
| `relation "users" does not exist` | Миграции не применены: `npm run migrate` |
| `Port 3000 already in use` | `netstat -ano \| findstr 3000`, затем `taskkill /PID <id> /F` |
| `duplicate key nominations_reference_key` | Seed data conflict. Выполни `npm run seed` повторно |
| Тесты real-DB failing | Нужен PostgreSQL на порту 8887 с базой `gtcp_test` |

---

## Структура проекта

```
ETRM/
├── backend/
│   ├── src/
│   │   ├── app.js                     # Express entry point (95 endpoints)
│   │   ├── routes/                    # 15 route files
│   │   │   ├── auth.js                # login, me, change-password
│   │   │   ├── shippers.js            # CRUD shippers (NC Art.3)
│   │   │   ├── contracts.js           # Capacity contracts + export
│   │   │   ├── nominations.js         # Nominations + matching (NC Art.12-13)
│   │   │   ├── billing.js             # Invoicing + FG + export (NC Art.18,20)
│   │   │   ├── credits.js             # Credit support (NC Art.5)
│   │   │   ├── capacity.js            # Capacity bookings + available
│   │   │   ├── auctions.js            # CAM NC auctions + calendar
│   │   │   ├── balance.js             # OBA settlement (NC Art.15)
│   │   │   ├── analytics.js           # Volumes, revenue, utilization
│   │   │   ├── vtp.js                 # Virtual Trading Point (NC Art.11)
│   │   │   ├── rbp.js                 # RBP Bridge (SOAP mock)
│   │   │   ├── audit.js               # Audit log
│   │   │   ├── systemParams.js        # System parameters
│   │   │   └── reservePrices.js       # AERS tariffs
│   │   ├── services/
│   │   │   ├── adjacentTsoService.js  # NC Art.13 matching mock
│   │   │   └── erp-connector.js       # 1С ERP интеграция
│   │   ├── utils/
│   │   │   ├── csvExport.js           # RFC 4180 CSV
│   │   │   ├── xlsxExport.js          # Excel xlsx (exceljs)
│   │   │   └── ncRoutes.js            # NC routes + IP constants
│   │   └── db/
│   │       ├── migrations/            # 000–022 SQL migrations
│   │       ├── migrate.js
│   │       └── seed.js
│   ├── scripts/
│   │   ├── count-endpoints.js         # Endpoint audit tool
│   │   └── fix-fuel-gas-invoices.js   # FG data sweep (Sprint 17)
│   ├── docs/
│   │   ├── openapi.yaml               # OpenAPI 3.0.3 spec
│   │   └── swagger-ui.html            # Swagger UI (CDN)
│   ├── tests/                         # 36 Jest suites (559 tests)
│   ├── .env.example
│   ├── docker-compose.yml
│   └── package.json
├── Soft/
│   └── GTCP_MVP.html                  # Frontend (vanilla JS)
├── reports/
│   ├── LOCAL_RUN.md                   # <-- этот файл
│   ├── GTCP_Artifacts.md              # Реестр артефактов
│   ├── GTCP_UserGuide_v3.4.md         # User Guide (actual)
│   ├── actionplan.md                  # Активные задачи
│   ├── roadmap.md                     # Roadmap и бэклог
│   └── SPRINT_*_REPORT.md            # Отчёты Sprint 5–17
├── NC-Gastrans-2020-ENG.pdf           # Network Code (источник истины)
├── CLAUDE.md                          # Проектные правила
└── README.md                          # Точка входа
```
