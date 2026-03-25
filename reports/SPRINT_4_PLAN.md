# GTCP — Sprint 4 Plan
**Gas Trading & Commercial Platform · Backend & Infrastructure**

---

## 📋 Sprint Overview

| Параметр | Значение |
|---|---|
| **Sprint** | Sprint 4 |
| **Период** | 06.04.2026 — 19.04.2026 (2 недели) |
| **Команда** | Backend Dev, Frontend Dev, DevOps, QA |
| **Velocity (цель)** | 34 Story Points |
| **Sprint Goal** | Перевести GTCP MVP с in-memory хранилища на полноценный Backend API (Node.js + PostgreSQL) с JWT-аутентификацией |
| **Приоритет** | P0 — критический путь к production |
| **Статус** | 🟡 PLANNED |

---

## 🎯 Sprint Goal

> **"К концу Sprint 4 GTCP имеет работающий REST API с базой данных PostgreSQL, JWT-аутентификацией по ролям (RBAC) и синхронизированный с существующим фронтендом MVP."**

### Критерии успеха Sprint
- [ ] REST API задокументирован (Swagger/OpenAPI 3.0)
- [ ] База данных PostgreSQL развёрнута, схема применена (migrations)
- [ ] JWT login/logout работает для всех 5 ролей
- [ ] Фронтенд GTCP_MVP.html подключён к реальному API (не in-memory)
- [ ] Все существующие TS-01…TS-06 из ТЗ проходят с реальным backend

---

## 📦 Sprint Backlog

### Epic 1: Database Layer (PostgreSQL)

#### US-401 · Схема базы данных
**Как** backend-разработчик, **я хочу** создать полную схему БД, **чтобы** все данные системы хранились персистентно.

| | |
|---|---|
| **Story Points** | 5 |
| **Assignee** | Backend Dev |
| **Priority** | 🔴 P0 |

**Задачи:**
- [ ] `DB-01` Создать таблицу `users` (id, username, password_hash, role, created_at, last_login)
- [ ] `DB-02` Создать таблицу `shippers` (id, name, contract_id, capacity_mwh, credit_limit_eur, exposure_eur)
- [ ] `DB-03` Создать таблицу `nominations` (id, shipper_id, point, direction, volume, gas_day, status, created_by, created_at, updated_at)
- [ ] `DB-04` Создать таблицу `invoices` (id, shipper_id, period_from, period_to, volume, tariff, status, created_by, created_at)
- [ ] `DB-05` Создать таблицу `contracts` (id, type, counterparty, start_date, end_date, capacity, created_at)
- [ ] `DB-06` Создать таблицу `capacity_bookings` (id, counterparty, point, type, period_from, period_to, volume)
- [ ] `DB-07` Создать таблицу `margin_calls` (id, shipper_id, amount, deadline, basis, created_by, created_at)
- [ ] `DB-08` Создать таблицу `audit_log` (id, user_id, module, action, ip_address, created_at)
- [ ] `DB-09` Написать seed-данные (demo data: 5 shippers, 8 nominations, 6 invoices, etc.)
- [ ] `DB-10` Настроить Flyway/node-pg-migrate для управления миграциями

**Definition of Done:** ERD-диаграмма создана, migrations применяются без ошибок, seed-данные загружены.

---

#### US-402 · ORM / Query Layer
**Как** backend-разработчик, **я хочу** иметь типизированный слой запросов к БД, **чтобы** избежать SQL-инъекций и ускорить разработку.

| | |
|---|---|
| **Story Points** | 3 |
| **Assignee** | Backend Dev |
| **Priority** | 🔴 P0 |

**Задачи:**
- [ ] `ORM-01` Настроить `pg` (node-postgres) + connection pool
- [ ] `ORM-02` Создать query-функции для каждой таблицы (CRUD)
- [ ] `ORM-03` Настроить `.env` с DATABASE_URL, JWT_SECRET, PORT
- [ ] `ORM-04` Unit-тесты для query-функций (Jest + pg-mock)

---

### Epic 2: Authentication & RBAC (JWT)

#### US-403 · JWT Аутентификация
**Как** пользователь системы, **я хочу** входить в GTCP с JWT-токеном, **чтобы** мои данные были защищены и сессия сохранялась.

| | |
|---|---|
| **Story Points** | 5 |
| **Assignee** | Backend Dev |
| **Priority** | 🔴 P0 |

**Задачи:**
- [ ] `AUTH-01` `POST /api/auth/login` — проверка username/password (bcrypt.compare), возврат JWT access token (24h) + refresh token (7d)
- [ ] `AUTH-02` `POST /api/auth/logout` — инвалидация refresh token в БД
- [ ] `AUTH-03` `POST /api/auth/refresh` — обновление access token по refresh token
- [ ] `AUTH-04` `GET /api/auth/me` — текущий пользователь и его роль
- [ ] `AUTH-05` Middleware `authenticate` — проверка JWT в заголовке `Authorization: Bearer <token>`
- [ ] `AUTH-06` Middleware `authorize(roles[])` — RBAC проверка роли
- [ ] `AUTH-07` Хэширование паролей Argon2 при создании пользователей
- [ ] `AUTH-08` Rate limiting на `/api/auth/login` (max 10 попыток/мин)

**Definition of Done:** Login/logout работает, все protected routes возвращают 401 без токена, 403 при неверной роли.

---

### Epic 3: Core API Endpoints

#### US-404 · Nominations API
**Как** диспетчер, **я хочу** управлять номинациями через API, **чтобы** данные сохранялись в БД.

| | |
|---|---|
| **Story Points** | 5 |
| **Assignee** | Backend Dev |
| **Priority** | 🔴 P0 |

**Задачи:**
- [ ] `NOM-01` `GET /api/nominations` — список с фильтрами (status, gas_day, shipper_id, point)
- [ ] `NOM-02` `POST /api/nominations` — создать номинацию (валидация кредитного лимита)
- [ ] `NOM-03` `PATCH /api/nominations/:id/status` — изменить статус (CONFIRMED/REJECTED)
- [ ] `NOM-04` `POST /api/nominations/match` — запустить матчинг (batch operation)
- [ ] `NOM-05` `POST /api/nominations/:id/renom` — подать реноминацию (валидация ±10%)
- [ ] `NOM-06` Валидация: volume > 0, gas_day формат, shipper существует
- [ ] `NOM-07` Интеграция аудита: все операции → audit_log

---

#### US-405 · Credit Monitor API
**Как** кредитный менеджер, **я хочу** получать актуальные данные экспозиций через API.

| | |
|---|---|
| **Story Points** | 3 |
| **Assignee** | Backend Dev |
| **Priority** | 🔴 P0 |

**Задачи:**
- [ ] `CRED-01` `GET /api/credit/positions` — все позиции с расчётом % использования
- [ ] `CRED-02` `POST /api/credit/margin-call` — создать Margin Call (запись в БД + аудит)
- [ ] `CRED-03` `GET /api/credit/margin-calls` — история MCL
- [ ] `CRED-04` Автоматический пересчёт exposure при изменении статуса счёта

---

#### US-406 · Billing API
**Как** специалист по биллингу, **я хочу** создавать счета и отслеживать оплаты через API.

| | |
|---|---|
| **Story Points** | 3 |
| **Assignee** | Backend Dev |
| **Priority** | 🔴 P0 |

**Задачи:**
- [ ] `BILL-01` `GET /api/invoices` — список с фильтром по статусу
- [ ] `BILL-02` `POST /api/invoices` — создать счёт (автоприсвоение номера INV-ГГГГ-НННН)
- [ ] `BILL-03` `PATCH /api/invoices/:id/status` — ISSUED→WAITING→PAID/OVERDUE
- [ ] `BILL-04` `POST /api/invoices/erp-sync` — событие синхронизации с ERP (mock + аудит)

---

#### US-407 · Contracts & Capacity API
| | |
|---|---|
| **Story Points** | 2 |
| **Assignee** | Backend Dev |
| **Priority** | 🟡 P1 |

**Задачи:**
- [ ] `CTR-01` `GET /api/contracts` — список договоров с расчётом daysLeft
- [ ] `CTR-02` `POST /api/contracts` — добавить договор
- [ ] `CAP-01` `GET /api/capacity` — бронирования с фильтром по точке
- [ ] `CAP-02` `GET /api/balance` — суточный баланс (агрегация по confirmed nominations)

---

### Epic 4: Frontend Integration

#### US-408 · Подключение фронтенда к API
**Как** пользователь GTCP, **я хочу** чтобы все операции в браузере сохранялись в БД.

| | |
|---|---|
| **Story Points** | 5 |
| **Assignee** | Frontend Dev |
| **Priority** | 🔴 P0 |

**Задачи:**
- [ ] `FE-01` Создать `api.js` — обёртка fetch с автоподстановкой JWT заголовка
- [ ] `FE-02` Заменить in-memory `shippers[]` на `GET /api/shippers`
- [ ] `FE-03` Заменить in-memory `nominations[]` на `GET /api/nominations`
- [ ] `FE-04` Заменить in-memory `invoices[]` на `GET /api/invoices`
- [ ] `FE-05` Подключить login-форму к `POST /api/auth/login`, сохранить JWT в `sessionStorage`
- [ ] `FE-06` Добавить interceptor: при 401 → автоматический redirect на login
- [ ] `FE-07` Добавить глобальный error handler для API ошибок (toast notifications)
- [ ] `FE-08` Заменить `doLogout()` на вызов `POST /api/auth/logout`

---

### Epic 5: Infrastructure & DevOps

#### US-409 · Docker Compose окружение
| | |
|---|---|
| **Story Points** | 3 |
| **Assignee** | DevOps |
| **Priority** | 🟡 P1 |

**Задачи:**
- [ ] `DEV-01` `docker-compose.yml` — сервисы: `api` (Node.js), `db` (PostgreSQL 15), `nginx` (static files)
- [ ] `DEV-02` `Dockerfile` для Node.js API (multi-stage build)
- [ ] `DEV-03` `.env.example` с описанием всех переменных окружения
- [ ] `DEV-04` Healthcheck для `db` и `api` сервисов
- [ ] `DEV-05` `README.md` — инструкция: `git clone` → `docker-compose up` → открыть браузер

---

### Epic 6: Testing & Swagger

#### US-410 · API Documentation (Swagger)
| | |
|---|---|
| **Story Points** | 2 |
| **Assignee** | Backend Dev |
| **Priority** | 🟡 P1 |

**Задачи:**
- [ ] `DOC-01` Подключить `swagger-ui-express` + `swagger-jsdoc`
- [ ] `DOC-02` Аннотировать все endpoints (параметры, ответы, security schemas)
- [ ] `DOC-03` Доступ: `GET /api/docs` — Swagger UI

#### US-411 · Integration Tests
| | |
|---|---|
| **Story Points** | 3 |
| **Assignee** | QA |
| **Priority** | 🟡 P1 |

**Задачи:**
- [ ] `TEST-01` Jest + Supertest — тесты для auth endpoints
- [ ] `TEST-02` Тесты для nominations (create, match, renom)
- [ ] `TEST-03` Тест: создание счёта + смена статуса + проверка exposure
- [ ] `TEST-04` Запуск тестов в GitHub Actions CI

---

## 📊 Sprint Backlog Summary

| User Story | Epic | SP | Assignee | Priority | Status |
|---|---|---|---|---|---|
| US-401 · Схема БД | Database | 5 | Backend Dev | 🔴 P0 | TODO |
| US-402 · ORM Layer | Database | 3 | Backend Dev | 🔴 P0 | TODO |
| US-403 · JWT Auth | Auth | 5 | Backend Dev | 🔴 P0 | TODO |
| US-404 · Nominations API | API | 5 | Backend Dev | 🔴 P0 | TODO |
| US-405 · Credit API | API | 3 | Backend Dev | 🔴 P0 | TODO |
| US-406 · Billing API | API | 3 | Backend Dev | 🔴 P0 | TODO |
| US-407 · Contracts API | API | 2 | Backend Dev | 🟡 P1 | TODO |
| US-408 · Frontend Integration | Frontend | 5 | Frontend Dev | 🔴 P0 | TODO |
| US-409 · Docker Compose | DevOps | 3 | DevOps | 🟡 P1 | TODO |
| US-410 · Swagger Docs | Docs | 2 | Backend Dev | 🟡 P1 | TODO |
| US-411 · Integration Tests | QA | 3 | QA | 🟡 P1 | TODO |
| **ИТОГО** | | **39 SP** | | | |

> ⚠️ **Velocity target: 34 SP.** US-410 и US-411 переносятся в Sprint 5 если не хватает времени.

---

## 🏗️ Технический стек Sprint 4

```
backend/
├── src/
│   ├── routes/
│   │   ├── auth.js          ← US-403
│   │   ├── nominations.js   ← US-404
│   │   ├── credit.js        ← US-405
│   │   ├── billing.js       ← US-406
│   │   └── contracts.js     ← US-407
│   ├── middleware/
│   │   ├── authenticate.js  ← JWT verify
│   │   └── authorize.js     ← RBAC check
│   ├── db/
│   │   ├── migrations/      ← Flyway/pgmigrate
│   │   ├── seeds/           ← Demo data
│   │   └── queries/         ← ORM functions
│   ├── services/
│   │   ├── matching.js      ← Matching algorithm
│   │   └── audit.js         ← Audit logger
│   └── app.js
├── frontend/
│   ├── GTCP_MVP.html        ← Уже готов (Sprint 3)
│   └── api.js               ← NEW: API wrapper
├── docker-compose.yml       ← US-409
├── Dockerfile
├── .env.example
└── README.md
```

**Версии зависимостей:**

| Пакет | Версия | Назначение |
|---|---|---|
| `node` | 20 LTS | Runtime |
| `express` | ^4.18 | HTTP framework |
| `pg` | ^8.11 | PostgreSQL driver |
| `jsonwebtoken` | ^9.0 | JWT tokens |
| `argon2` | ^0.31 | Password hashing |
| `express-rate-limit` | ^7.0 | Rate limiting |
| `helmet` | ^7.0 | Security headers |
| `cors` | ^2.8 | CORS policy |
| `swagger-ui-express` | ^5.0 | API docs |
| `jest` | ^29.0 | Testing |
| `supertest` | ^6.3 | API testing |

---

## 📅 Sprint Events

| Событие | Дата | Время | Участники |
|---|---|---|---|
| **Sprint Planning** | 06.04.2026 | 10:00 CET | Вся команда |
| **Daily Standup** | Ежедн. пн–пт | 09:00 CET | Вся команда |
| **Mid-Sprint Review** | 13.04.2026 | 14:00 CET | Tech Lead + Dev |
| **Sprint Review** | 19.04.2026 | 14:00 CET | Вся команда + PO |
| **Sprint Retrospective** | 19.04.2026 | 15:30 CET | Вся команда |

### Daily Standup Template
```
1. Что сделано вчера?
2. Что планируется сегодня?
3. Есть ли блокеры?
```

---

## 🎯 Definition of Done (Sprint 4)

- [ ] Код написан, peer review пройден (PR approved)
- [ ] Unit-тесты покрывают ≥ 70% нового кода
- [ ] Все TS-01…TS-06 из ТЗ проходят с реальным backend
- [ ] API задокументирован в Swagger
- [ ] `docker-compose up` запускает полный стек без ошибок
- [ ] Нет незакрытых P0 дефектов
- [ ] README обновлён инструкцией по запуску

---

## ⚠️ Риски Sprint 4

| ID | Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|---|
| R-401 | Сложность PostgreSQL схемы дольше расчётного | Средняя | Высокое | Начать с DB в первые 2 дня; Fallback — SQLite |
| R-402 | Frontend интеграция сломает существующий UI | Средняя | Высокое | Сохранить in-memory режим как fallback через env flag |
| R-403 | JWT refresh token логика — edge cases | Низкая | Среднее | Использовать проверенную библиотеку `passport-jwt` |
| R-404 | Docker не работает на dev-машине Windows | Низкая | Среднее | Инструкция запуска без Docker (node + local PG) |
| R-405 | Velocity не достигнет 34 SP | Средняя | Низкое | US-410 и US-411 — кандидаты на перенос в Sprint 5 |

---

## 🔗 Связи со Sprint 5

По завершении Sprint 4 следующий Sprint 5 реализует:
- **WebSocket** для real-time обновлений Dashboard (replace setInterval)
- **REST API интеграция с 1С ERP** (реальный коннектор)
- **GitHub Actions CI/CD** — автодеплой на VPS при merge в `main`
- **Мониторинг** — Prometheus + Grafana дашборд метрик API

---

## 📁 Файлы проекта

| Файл | Путь | Описание |
|---|---|---|
| MVP Frontend | `ETRM\Soft\GTCP_MVP.html` | Готово (Sprint 3) |
| ТЗ | `ETRM\ТЗ_GTCP_MVP_v1.0.docx` | Базовый документ |
| Отчёт Sprint 3 | `ETRM\reports\Отчёт_MVP_разработка.docx` | Результаты MVP |
| **Sprint 4 Plan** | `ETRM\reports\SPRINT_4_PLAN.md` | Данный документ |

---

*Документ сформирован: 23.03.2026 · GTCP Project · PMNz-74*
