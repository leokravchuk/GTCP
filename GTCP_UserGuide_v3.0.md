# GTCP — User Guide / Руководство пользователя

**Gas Trading & Commercial Platform · v3.0 · Sprint 10 P0**
Обновлено: 27.03.2026 · Gastrans d.o.o. Novi Sad, Serbia
Дипломный проект · Факультет технических наук · krav4ukleo@gmail.com

---

# ЧАСТЬ I — РУССКИЙ

---

## 1. Общее описание системы

**GTCP (Gas Trading & Commercial Platform)** — информационная система для управления коммерческой деятельностью газотранспортной компании Gastrans d.o.o. Система реализует полный коммерческий цикл в соответствии с Сетевым кодексом Gastrans (принят 03.04.2020) и решениями АЕРС (Агентство энергетики Республики Сербия).

Объект автоматизации: трубопровод TurkStream (сербский участок), 403 км, Болгарская граница (Кирево/Заечар) → Сербия / Венгерская граница (Хоргош).

### 1.1 Назначение системы

GTCP предназначена для:

- Проведения аукционов на транспортную мощность (NC Art.7 + CAM NC EU 2017/459)
- Управления кредитной поддержкой шипперов (NC Art.5, URDG 758, рейтинговые освобождения)
- Автоматического расчёта счётов: capacity fee (entry≠exit), топливный газ (NC Art.18), штрафные проценты (EURIBOR 6M + 3%, NC Art.20.4.2)
- Учёта договоров транспортировки — 10 типов продуктов мощности
- Мониторинга загруженности транспортной сети в реальном времени (Capacity Tracker)
- Over-Nomination (NC Art.12.8) — Within-Day Interruptible при полной подписке
- Двусторонней интеграции с ERP-системой (1С:Предприятие)

### 1.2 KPI системы

| KPI | Было | Стало |
|---|---|---|
| Время обработки номинации | 30–60 мин | < 5 мин |
| Выявление превышения кредитного лимита | 1–24 часа | < 1 мин |
| Ошибки при выставлении счётов | 3–5% | 0% (авторасчёт по NC) |
| Подготовка отчёта по балансу | 2–4 часа | Мгновенно |
| Покрытие NC compliance | ~40% | **79% (55/70)** ✅ (Sprint 12, матрица по главам) |
| Тесты | — | **117/117** passing (Sprint 12) |

### 1.3 Техническая архитектура

| Компонент | Технология | Версия | Назначение |
|---|---|---|---|
| Backend API | Node.js + Express | 20 LTS | REST API, бизнес-логика |
| База данных | PostgreSQL | 15–17 | Хранение данных, миграции 001–014 |
| Frontend | Vanilla JS + HTML5 | Sprint 12 | SPA-интерфейс (GTCP_MVP.html), RBP Bridge UI (4 вкладки) |
| API Client | api.js v2.1 | 93 метода | Все модули + RBP Bridge (11 endpoints), Reserve Prices, Invoice Line Items |
| Контейнеризация | Docker Compose | 4.x+ | Локальное развёртывание |
| VPS (продакшн) | PM2 + Nginx | 2.x / 1.25 | Продакшн-сервер |
| ERP-интеграция | 1С:Предприятие | 8.3 | Учёт контрагентов, счетов |

### 1.4 Поддерживаемые нормативные акты

| Нормативный акт | Область применения | Статус |
|---|---|---|
| **Gastrans Network Code** (03.04.2020, 111 стр.) | Все операции | Binding — authoritative source of truth |
| **АЕРС Decision 05-145** (17.07.2025) | Тарифы GY2025/2026 | Reserve Prices (полная таблица — раздел 13) |
| **CAM NC** EU 2017/459 | Аукционы мощности | Ascending clock + Uniform price |
| **ENTSOG MAR0277-24** (07.10.2024) | Расписание аукционов | 47 аукционов GY2025/2026 |

> **Правило приоритета:** NC > АЕРС > CAM NC > код. При расхождении — код исправляется под NC.

---

## 2. Роли и права доступа (RBAC)

Система использует ролевую модель управления доступом. Роль назначается администратором при создании пользователя.

### 2.1 Матрица ролей

| Роль | Описание | Доступные модули |
|---|---|---|
| `admin` | Системный администратор | Все модули + Users + Settings + System Params |
| `dispatcher` | Оператор коммерческого отдела | Dashboard, Nominations, Credits, Balance, Billing, Contracts, Capacity, Auctions, Audit |
| `credit` | Кредитный менеджер | Dashboard, Credits, Audit |
| `billing` | Специалист по биллингу | Dashboard, Billing, Audit |
| `contracts` | Менеджер по договорам | Dashboard, Contracts, Capacity, Audit |
| `viewer` | Гость (только чтение) | Dashboard (readonly) |

### 2.2 Аутентификация (JWT)

- **Access Token**: срок действия 15 минут, передаётся в заголовке `Authorization: Bearer <token>`
- **Refresh Token**: срок действия 7 суток, хранится в HttpOnly cookie
- **Ротация токенов**: при каждом обновлении access token refresh token заменяется

| Метод | URL | Тело запроса | Ответ |
|---|---|---|---|
| POST | `/api/v1/auth/login` | `{"email":"...","password":"..."}` | `{"accessToken":"...","user":{...}}` |
| POST | `/api/v1/auth/refresh` | Cookie: refreshToken | `{"accessToken":"..."}` |
| POST | `/api/v1/auth/logout` | — | `{"message":"Logged out"}` |

---

## 3. Установка и локальный запуск

### 3.1 Системные требования

| Инструмент | Минимальная версия | Скачать |
|---|---|---|
| Node.js | 20.x LTS | https://nodejs.org |
| PostgreSQL | 15.x – 17.x | https://www.postgresql.org/download/windows/ |
| Docker Desktop | 4.x+ (опционально) | https://www.docker.com/products/docker-desktop/ |
| Git | любая | https://git-scm.com |

### 3.2 Вариант A — Docker Compose (если установлен)

```powershell
cd C:\Users\leokr\ETRM\backend
docker compose up -d
docker compose exec api node src/db/migrate.js   # миграции 001–009
docker compose exec api node src/db/seed.js      # тестовые данные
```

Адреса: API `http://localhost:3000/api/v1` · Swagger UI `http://localhost:3000/docs` · PostgreSQL `localhost:5432`

### 3.3 Вариант B — Node.js напрямую (Sprint 8 — основной)

```powershell
# Создать БД
psql -U postgres -c "CREATE USER gtcp_user WITH PASSWORD 'gtcp_dev_password';"
psql -U postgres -c "CREATE DATABASE gtcp OWNER gtcp_user;"

# Настроить .env
cd C:\Users\leokr\ETRM\backend
copy .env.example .env
```

Минимальный `.env`:

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432          # или 8887 если PostgreSQL 17 на нестандартном порту
DB_NAME=gtcp
DB_USER=gtcp_user
DB_PASSWORD=gtcp_dev_password
JWT_ACCESS_SECRET=any_64_char_string
JWT_REFRESH_SECRET=another_64_char_string
CORS_ORIGIN=http://localhost:8080,http://127.0.0.1:5501,http://localhost:5501,http://127.0.0.1:5500,http://localhost:5500
ERP_MOCK=true
```

```powershell
npm install
npm run migrate   # 001–009 (все чистые)
npm run seed
npm run dev       # hot-reload через nodemon
```

> **CORS**: `CORS_ORIGIN` должен включать origin фронтенда. Если используете http-server на порту 5501, добавьте `http://127.0.0.1:5501`.

> **Swagger UI CSP**: Helmet настроен с relaxed CSP для `/docs` (разрешены CDN cloudflare для Swagger UI).

### 3.4 Вариант C — Только Frontend (http-server)

```powershell
# Установить http-server глобально
npm install -g http-server

# Запустить фронтенд
cd C:\Users\leokr\ETRM\Soft
http-server -p 5501 --cors

# Откроется: http://127.0.0.1:5501/GTCP_MVP.html
```

> Требует запущенного бэкенда (Вариант A или B). В бэкенде `.env`: `CORS_ORIGIN=...http://127.0.0.1:5501`.

### 3.5 Тесты

```powershell
cd C:\Users\leokr\ETRM\backend
npm test                                   # все тесты
npm run test:coverage                      # с покрытием
npx jest tests/billing.test.js --verbose   # один файл
```

Текущий результат (Sprint 12, 28.03.2026):

```
Test Suites: 6 passed, 6 total
Tests:       117 passed, 117 total
```

Распределение: `billing.test.js` — 18 · `credits.test.js` — 21 · `auctions.test.js` — 17 · `nc-routes.test.js` — 21 · `tariffs.test.js` — 24 · `rbp-mock.test.js` — 16.

> **Sprint 9:** Добавлены `nc-routes.test.js` и `tariffs.test.js`. Миграция 010 (`reserve_prices`, 57 тарифов АЕРС), KIREVO-EXIT. 11 NC-расхождений → 0. **Sprint 10 P0:** Миграция 011 (`invoice_line_items`, `capacity_category`). **Миграции 012–014:** `shipper_registration`, `nominations_kwh_h`, `rbp_tables`. **Sprint 12:** Добавлен `rbp-mock.test.js` (16 тестов — 11 SOAP-методов, bundled, full cycle).

---

## 4. Номинации (NC Art.12)

### 4.1 Создание номинации

Номинация — уведомление шиппера о планируемых объёмах транспортировки на конкретный Gas Day (06:00 CET → 06:00 CET следующего дня). Объём указывается в **kWh/h**, равномерно распределённых по часам.

| Поле | Тип | Описание |
|---|---|---|
| `shipper_id` | UUID | Ссылка на шиппера |
| `point_code` | TEXT | NC-код точки: `KIREVO-ENTRY`, `HORGOS-EXIT`, `EXIT-SERBIA` и др. |
| `flow_direction` | TEXT | NC-маршрут (7 вариантов) |
| `nominated_quantity_kwh_h` | NUMERIC | Объём в kWh/h |
| `gas_day` | DATE | Дата газовых суток |
| `status` | TEXT | `PENDING` → `CONFIRMED` → `MATCHED` |

### 4.2 Дедлайн подачи (NC Art.12.3)

**D-1 до 14:00 CET** — номинации, поданные позже, отклоняются сервером.

- Серверная валидация времени включена (Sprint 9: endpoint `/nominations/:id/submit` проверяет CET время)
- Gas Day начинается в 06:00 CET текущего дня
- Реноминации — дополнительные окна (NC Art.12.7.5): до 18:00 CET D-1

### 4.3 Матчинг (NC Art.13)

Алгоритм: **Active TSO / Double-Sided Matching**

```
Confirmed Quantity = min(Entry Nomination, Exit Nomination)
```

Endpoint: `POST /api/v1/nominations/:id/match`

### 4.4 Реноминации (NC Art.12.7.5)

Ограничения: изменение ±10% от confirmed quantity за реноминацию. Статус меняется: `CONFIRMED` → `RENOM_PENDING`.

### 4.5 Over-Nomination (NC Art.12.8)

При полной подписке Firm Capacity шиппер может подать **Over-Nomination** — заявку на Within-Day Interruptible capacity.

- Доступно только в рамках UIOLI (Use-It-Or-Lose-It) пула
- Endpoint: `POST /api/v1/nominations/:id/over-nominate` (Sprint 9)
- Штраф при прерывании: fee × **3** (АЕРС п.3)

### 4.6 EDIGAS NOMINT XML

Для подтверждённых номинаций доступен предпросмотр XML в формате EDIGAS (NC Art.4.1.2):

`GET /api/v1/nominations/:id/edigas-nomint` → возвращает NOMINT XML

В интерфейсе: кнопка **«XML»** на строке подтверждённой номинации → popup с полным XML.

### 4.7 API Nominations

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/v1/nominations` | Список номинаций |
| POST | `/api/v1/nominations` | Создать номинацию |
| GET | `/api/v1/nominations/:id` | Детали номинации |
| PATCH | `/api/v1/nominations/:id` | Обновить (до дедлайна) |
| POST | `/api/v1/nominations/:id/match` | Запустить матчинг |
| POST | `/api/v1/nominations/:id/renominate` | Реноминация |
| GET | `/api/v1/nominations/:id/edigas-nomint` | EDIGAS XML preview |
| POST | `/api/v1/nominations/:id/over-nominate` | Over-Nomination (NC Art.12.8) |

---

## 5. Кредитный монитор (NC Art.5)

### 5.1 Кредитные позиции

| Поле | Описание |
|---|---|
| `credit_limit` | Установленный кредитный лимит (EUR) |
| `current_exposure` | Текущие обязательства по активным контрактам |
| `available_credit` | `credit_limit − current_exposure` |
| `utilization_pct` | % использования лимита |
| `risk_level` | `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` |

### 5.2 Инструменты кредитной поддержки (NC Art.5.1)

| Тип | Описание | NC Ref |
|---|---|---|
| `BANK_GUARANTEE` | Банковская гарантия URDG 758 (банк ≥ BBB-) | Art.5.1.1 |
| `LETTER_OF_CREDIT` | Аккредитив | Art.5.1.2 |
| `CASH_DEPOSIT` | Денежный депозит на эскроу-счёт | Art.5.1.3 |
| `PARENT_GUARANTEE` | Корпоративное поручительство | Art.5.1.4 |

### 5.3 Размер кредитной поддержки (NC Art.5.1.5)

| Тип продукта | Credit Support = % от fee | Available Credit = limit × |
|---|---|---|
| Monthly / Daily / Within-Day | 100% | × 1 |
| Quarterly | 2/3 (66.67%) | × 3/2 |
| Yearly | 2/12 (16.67%) | × 12/2 |

### 5.4 Рейтинговое освобождение (NC Art.5.1.6)

Шипперы с инвестиционным рейтингом освобождаются от предоставления гарантии:

**S&P/Fitch ≥ BBB−** ИЛИ **Moody's ≥ Baa3** ИЛИ **Creditreform ≤ 235**

### 5.5 Margin Call (NC Art.5.5)

При нехватке обеспечения система генерирует Margin Call. Дедлайн пополнения: **+2 рабочих дня** от даты уведомления.

### 5.6 API Credits

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/v1/credits` | Сводка по всем шипперам |
| GET | `/api/v1/credits/summary` | Агрегированные KPI |
| GET | `/api/v1/credits/:shipperId/instruments` | Инструменты шиппера |
| POST | `/api/v1/credits/:shipperId/instruments` | Добавить инструмент |
| GET | `/api/v1/credits/:shipperId/rating` | Рейтинг шиппера |
| POST | `/api/v1/credits/:shipperId/rating` | Обновить рейтинг |
| GET | `/api/v1/credits/:shipperId/eligibility` | Eligibility check (NC Art.5) |
| GET | `/api/v1/credits/:shipperId/by-product` | Лимиты по типам продуктов |
| PATCH | `/api/v1/credits/:shipperId/status` | Обновить статус |
| GET | `/api/v1/credits/margin-calls` | Все активные Margin Call |

---

## 6. Биллинг (NC Art.18, 20)

### 6.1 Типы счётов

| Тип | Описание | NC Ref |
|---|---|---|
| `CAPACITY` | Плата за транспортную мощность (entry + exit) | Art.20 |
| `FUEL_GAS` | Топливный газ — компрессоры и подогрев | Art.18 |
| `LATE_PAYMENT` | Штрафные проценты за просрочку | Art.20.4.2 |

Жизненный цикл счёта: `DRAFT` → `ISSUED` → `PAID` / `OVERDUE` / `DISPUTED`

Срок оплаты: до **20-го числа** месяца, в котором получен счёт (NC Art.20.4.1). Счёт выставляется в первые 5 рабочих дней следующего месяца (NC Art.20.3.1). При превышении — автопереход в `OVERDUE`.

### 6.2 Формула Capacity Fee

```
ПРАВИЛЬНО (раздельный entry/exit):
  fee = cap_entry_kWh_h × tariff_entry / 365 × days
      + cap_exit_kWh_h  × tariff_exit  / 365 × days

НЕПРАВИЛЬНО (не использовать!):
  fee = capacity × (tariff_entry + tariff_exit) / 365 × days
  ↑ Предполагает cap_entry == cap_exit, что НЕВЕРНО для Gastrans
```

> Причина: Entry Kirevo (13 752 230 kWh/h) ≠ Exit Horgoš (9 216 209 kWh/h). Разница = 4 536 021 kWh/h уходит в domestic exit zone.

### 6.3 Within-Day Fee (NC Art.6.3.1.4)

```
fee = capacity_kWh_h × price_per_hour × number_of_hours
```

> Не делить на 365 для Within-Day продуктов.

### 6.4 Топливный газ (NC Art.18.2.1)

```
FG = X1 × Q_horgos + X2 × Q_serbia − KN
```

Где: X1 = 0.42% (компрессоры), X2 = 0.08% (подогрев), KN = коррекция D-2.

### 6.5 Штрафные проценты (NC Art.20.4.2)

```
interest = overdue_EUR × (EURIBOR_6M + 3%) / 360 × overdue_days
```

> **EURIBOR 6M** (не 3M). Начисление ежедневно. База 360 дней (act/360).

### 6.6 Штраф за прерывание (АЕРС п.3)

При прерывании Interruptible daily/within-day capacity: **fee × 3**.

### 6.7 Качество газа (NC Art.17, Annex 3A)

Таблица ежедневных показателей качества газа (данные FGSZ Ltd., GMS Kiskundorozsma 2):

| Параметр | Единица | Источник |
|---|---|---|
| GCV | kWh/Nm³ | Средн. апр.2025: 11.523 |
| Wobbe Index | kWh/Nm³ | Средн. апр.2025: 14.975 |
| CH4 | % | Средн. апр.2025: 94.38% |
| H2S | mg/Nm³ | Лимит NC Art.17: ≤ 5 |
| Плотность | kg/Nm³ | Средн. апр.2025: 0.7656 |

### 6.9 Invoice Line Items — Variant C (NC Art.20, Sprint 10 P0)

С Sprint 10 система перешла на **постатейную структуру счёта** (NC Art.20.3.2). Один счёт содержит наборные строки по типам продуктов.

#### Типы строк (`line_type`) — 9 значений

| `line_type` | Формула | NC Ref |
|---|---|---|
| `CAPACITY` | `cap_kWh_h × tariff / 365 × days` | Art.20.3.2.1 |
| `CAPACITY_WITHIN_DAY` | `cap_kWh_h × tariff_per_hour × hours` | Art.6.3.1.4 |
| `FUEL_GAS` | `X1×Q_horgos + X2×Q_serbia − KN` | Art.18 |
| `TRANSFER` | `cap_kWh_h × tariff / 365 × days` | Art.10.3 |
| `SURRENDER_PREMIUM` | `(P_old − P_new) × RC × hours` | Art.8.3 |
| `LATE_PAYMENT` | `overdue × (EURIBOR_6M + 3%) / 360 × days` | Art.20.4.2 |
| `IMBALANCE` | `|TI| × GPP` или `|TI| × GPN` | Art.15.4 |
| `INTERRUPTION_PENALTY` | `capacity_fee × 3` | АЕРС п.3 |
| `AUCTION_PREMIUM` | `(Auction_Price − Reserve_Price) × cap × hours` | Art.7.6.11 |

#### Автоматическая генерация (POST /billing/generate)

При вызове `POST /api/v1/billing/generate` система автоматически:
1. Находит все активные контракты шиппера за период
2. Создаёт строки CAPACITY (entry) + CAPACITY (exit) раздельно
3. Рассчитывает FUEL_GAS из EXIT номинаций (NC Art.18)
4. Добавляет LATE_PAYMENT если есть просроченные счета

#### Пример верификации (реальные данные, 31 день, FIRM_YEARLY, KIREVO→HORGOS)

```
CAPACITY ENTRY: 13 752 230 × 6.00 / 365 × 31 = €7 007 985.70
CAPACITY EXIT:   9 216 209 × 6.85 / 365 × 31 = €5 361 813.65
FUEL_GAS (auto): 28 798 810 kWh × 0.0325      = €  935 961.32
                                        TOTAL: €13 305 760.67
```

#### Типы продуктов (`product_type`) — 21 значение

`FIRM_YEARLY`, `FIRM_QUARTERLY_Q1–Q4`, `FIRM_MONTHLY_28/30/31`, `FIRM_DAILY`, `FIRM_WITHIN_DAY`, `INTERRUPTIBLE_DAILY`, `INTERRUPTIBLE_WITHIN_DAY`, `COMM_REV_YEARLY`, `COMM_REV_QUARTERLY_Q1–Q4`, `COMM_REV_MONTHLY_28/30/31`, `COMM_REV_DAILY`

### 6.10 API Billing

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/v1/billing` | Список счётов |
| POST | `/api/v1/billing` | Создать счёт (legacy, одна сумма) |
| POST | `/api/v1/billing/with-lines` | Создать счёт с постатейными строками (Variant C) |
| POST | `/api/v1/billing/generate` | Автогенерация строк из контрактов шиппера |
| GET | `/api/v1/billing/:id` | Детали счёта + line_items + subtotals |
| PATCH | `/api/v1/billing/:id/status` | Обновить статус |
| GET | `/api/v1/billing/gas-quality` | Таблица качества газа |
| GET | `/api/v1/billing/:id/statement` | Monthly Statement (NC Art.20.1) |
| POST | `/api/v1/billing/:id/erp-sync` | Синхронизация с 1С |
| GET | `/api/v1/reserve-prices` | Тарифы АЕРС 05-145 с фильтрами |

---

## 7. Контракты (NC Art.3–6)

### 7.1 Жизненный цикл

`DRAFT` → `ACTIVE` → `EXPIRED` / `TERMINATED` / `CANCELLED`

### 7.2 Поля контракта

| Поле | Тип | Описание |
|---|---|---|
| `contract_no` | TEXT UNIQUE | GTCP-YYYY-NNNN |
| `shipper_id` | UUID | Ссылка на шиппера |
| `entry_point_code` | TEXT | NC §2.1: `KIREVO-ENTRY`, `HORGOS-ENTRY`, `EXIT-SERBIA-ENTRY` |
| `exit_point_code` | TEXT | NC §2.1: `HORGOS-EXIT`, `EXIT-SERBIA`, `KIREVO-EXIT` |
| `flow_direction` | TEXT | NC-маршрут (7 вариантов) |
| `nc_route_type` | TEXT | `PHYSICAL` / `COMMERCIAL_REVERSE_FULL` / `COMMERCIAL_REVERSE_HALF` |
| `contract_type` | TEXT | Тип продукта (10 вариантов) |
| `capacity_entry_kwh_h` | NUMERIC | Мощность входа, kWh/h |
| `capacity_exit_kwh_h` | NUMERIC | Мощность выхода, kWh/h |
| `start_date` / `end_date` | DATE | Период контракта |

### 7.3 Продукты мощности (NC Art.6) — 10 типов

| Код | Описание | Длительность | NC Article |
|---|---|---|---|
| `FIRM_YEARLY` | Firm Annual | 1 Gas Year | 6.1.2.1 |
| `FIRM_QUARTERLY` | Firm Quarterly | 1 Gas Quarter | 6.3.1.1 |
| `FIRM_MONTHLY` | Firm Monthly | 1 Gas Month | 6.3.1.2 |
| `FIRM_DAILY` | Firm Daily | 1 Gas Day | 6.3.1.3 |
| `FIRM_WITHIN_DAY` | Firm Within-Day | < 1 Gas Day | 6.3.1.4 |
| `INTERRUPTIBLE` | Interruptible Daily | 1 Gas Day | 6.1.2.3 |
| `COMM_REV_YEARLY` | Commercial Reverse Yearly | 1 Gas Year | 6.1.2.4 |
| `COMM_REV_QUARTERLY` | Comm. Reverse Quarterly | 1 Gas Quarter | 6.5.2.2 |
| `COMM_REV_MONTHLY` | Comm. Reverse Monthly | 1 Gas Month | 6.5.2.3 |
| `COMM_REV_DAILY` | Comm. Reverse Daily | 1 Gas Day | 6.5.2.4 |

> Мощность всегда в **kWh/h** (кВт·ч/час). Никогда MWh/day в бизнес-логике.

### 7.4 API Contracts

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/v1/contracts` | Список контрактов |
| POST | `/api/v1/contracts` | Создать контракт |
| GET | `/api/v1/contracts/:id` | Детали контракта |
| PATCH | `/api/v1/contracts/:id` | Обновить |
| GET | `/api/v1/contracts/meta` | NC маршруты + АЕРС тарифы (для dropdown) |

### 7.5 NC Art.3 — Регистрация и жизненный цикл шиппера (Sprint 10 P1)

NC Art.3 описывает полный жизненный цикл шиппера как участника транспортной системы.

#### Статусы шиппера

```
POST /shippers/apply → APPLICANT
PATCH /shippers/:id/approve → APPROVED → ACTIVE
PATCH /shippers/:id/remove → (проверки) → REMOVED
```

| Статус | Описание | UI badge |
|---|---|---|
| `APPLICANT` | Заявка подана, ждёт рассмотрения | Жёлтый |
| `APPROVED` | Одобрен, подписывает GEDP + Balancing Agreement | Синий |
| `ACTIVE` | Активный участник — может номинировать и торговать | Зелёный |
| `REMOVED` | Отозван (NC Art.3.7) | Красный |

#### Условия удаления (NC Art.3.7)

Перед переводом в `REMOVED` система проверяет:
- `contracted_capacity = 0` (нет активных контрактов)
- `outstanding_debt = 0` (нет неоплаченных счётов)
- При выполнении — автоматически завершаются GEDP и Balancing Agreement

#### Типы GTA

| Тип | Описание |
|---|---|
| `LONG_TERM` | Долгосрочные GTA (≥ 1 год, освобождены от аукционов по Final Exemption Act) |
| `SHORT_TERM` | Краткосрочные GTA (через публичные аукционы CAM NC) |

#### API Shippers

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/v1/shippers` | Список шипперов |
| POST | `/api/v1/shippers` | Создать шиппера |
| POST | `/api/v1/shippers/apply` | Подать заявку (→ APPLICANT) |
| PATCH | `/api/v1/shippers/:id/approve` | Одобрить (→ ACTIVE) |
| PATCH | `/api/v1/shippers/:id/remove` | Удалить (с проверками NC Art.3.7) |
| GET | `/api/v1/shippers/:id/audit` | Журнал изменений (old/new value) |

---

## 8. Мощности — Capacity Tracker (NC §2.1, Art.6, 8)

### 8.1 Точки подключения (NC §2.1)

Согласно Сетевому кодексу Gastrans (§2.1) существует **3 физических точки подключения**:

| Код в БД | Официальное название NC | Тип | Расположение |
|---|---|---|---|
| `KIREVO-ENTRY` | Entry Point Kirevo/Zaječar | ENTRY (физ.) | Болгарско-сербская граница, GMS-1 |
| `HORGOS-EXIT` | Exit Point Horgoš/Kiškundorožma 1200 | EXIT (физ.) | Сербско-венгерская граница |
| `EXIT-SERBIA` | Exit Point Serbia (Gospođinci+Pančevo+Paraćin) | EXIT (физ.) | Внутренняя Сербия: GMS-2/3/4 |

Для **коммерческого реверса** (NC Art.6.1.2) те же точки используются в обратном направлении:

| Код в БД | NC Название | Используется в |
|---|---|---|
| `HORGOS-ENTRY` | Entry Point Horgoš | Full Reverse A, Half Reverse A |
| `EXIT-SERBIA-ENTRY` | Entry Point Serbia | Full Reverse B, Half Reverse B |
| `KIREVO-EXIT` | Exit Point Kirevo/Zaječar | Full Reverse A и B (виртуальный выход к болгарской границе) |
| `VTP-SERBIA` | Virtual Trading Point | NC Art.11 — передача прав на газ |

**Устаревшие названия** — не использовать: `Horgoš` (plain text), `Gospođinci` (plain text), `GOSPODJINCI-ENTRY`, `GOSPODJINCI-EXIT`.

### 8.2 Технические мощности и правило 90/10 (Final Exemption Act + Sprint 10 P0)

90% технической мощности закреплено за Long-Term GTA (освобождены от аукционов по Final Exemption Act, 05.03.2019). 10% — доступно на публичных аукционах CAM NC.

| Точка | Tech kWh/h (100%) | LT Reserve (90%) | ST Available (10%) |
|---|---|---|---|
| Entry Kirevo | **15 280 488** | 13 752 230 | 1 528 258 |
| Exit Domestic (GMS-2/3/4) | **5 040 256** | 4 536 021 | 504 235 |
| Exit Horgoš | **10 240 233** | 9 216 209 | 1 024 024 |

> **Критическое правило:** LT Reserve Entry (13 752 230) ≠ LT Reserve Exit Horgoš (9 216 209). Разница 4 536 021 kWh/h = domestic exit capacity. Биллинг использует раздельные cap_entry и cap_exit.

#### Формула Available Capacity

```
Available = Technical − LongTerm − ShortTermSold + Surrendered
```

#### Capacity Tracker (Sprint 10 P0) — 7 колонок

Трекер показывает: Tech 100% / LT Reserve 90% / ST Available 10% / ST Sold / ST Free.
Аукционная заявка отклоняется (HTTP 422) если `bid.capacity > Available(10%)` по точке и периоду.

### 8.3 Маршруты транспортировки (NC §2.1)

| Код `flow_direction` | Тип | Entry → Exit | NC Ref |
|---|---|---|---|
| `KIREVO_HORGOS` | PHYSICAL | KIREVO-ENTRY → HORGOS-EXIT | §2.1 |
| `KIREVO_EXIT_SERBIA` | PHYSICAL | KIREVO-ENTRY → EXIT-SERBIA | §2.1 |
| `KIREVO_HORGOS_AND_SERBIA` | PHYSICAL | KIREVO-ENTRY → HORGOS-EXIT + EXIT-SERBIA | §2.1 |
| `HORGOS_KIREVO` | COMM. REVERSE FULL | HORGOS-ENTRY → KIREVO-EXIT | Art.6.1.2.4 |
| `EXIT_SERBIA_KIREVO` | COMM. REVERSE FULL | EXIT-SERBIA-ENTRY → KIREVO-EXIT | Art.6.1.2.4 |
| `HORGOS_EXIT_SERBIA` | COMM. REVERSE HALF | HORGOS-ENTRY → EXIT-SERBIA | Art.6.1.2 |
| `EXIT_SERBIA_HORGOS` | COMM. REVERSE HALF | EXIT-SERBIA-ENTRY → HORGOS-EXIT | Art.6.1.2 |

### 8.4 Таб 1: Бронирования

Таблица активных capacity bookings с фильтром по NC-точкам (`KIREVO-ENTRY`, `HORGOS-EXIT`, `EXIT-SERBIA`). Поля: contract_no, shipper, flow_direction, cap_entry_kWh_h, cap_exit_kWh_h, period, status.

### 8.5 Таб 2: Трекер NC §2.1

Загрузка по каждой точке в реальном времени:
- **Technical capacity** (kWh/h) — 15 280 488 / 5 040 256 / 10 240 233
- **LT Reserve** (90%) — контракты Long-Term GTA
- **ST Available** (10%) — максимум для аукционов
- **ST Sold** — продано на аукционах (≤ ST Available)
- **ST Free** — остаток для аукционов
- **Utilization %** — от технической мощности

> Формула (NC-compliant, Sprint 10 P0): `free = technical − long_term − short_term_sold`

### 8.6 Таб 3: RBP Предложения (NC Art.8)

Capacity, выставленная на Secondary Market (Surrender workflow). Доступные для покупки лоты с reserve price.

Surrender Premium (NC Art.8.3): `AP = (P_old − P_new) × RC × P`

### 8.7 Таб 4: UIOLI — Use-It-Or-Lose-It (NC Art.12.8)

Неноминированная Annual Firm capacity за Gas Day → Within-Day Interruptible pool. Утилизация по газовым суткам (факт Apr 2025: ~72%).

### 8.8 API Capacity

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/v1/capacity` | Сводка по всем точкам |
| GET | `/api/v1/capacity/tracker` | Трекер: tech/contracted/free |
| GET | `/api/v1/capacity/:pointCode` | Конкретная точка (NC-код) |
| GET | `/api/v1/capacity/rbp-offerings` | RBP предложения |
| GET | `/api/v1/capacity/products` | Продукты мощности |
| GET | `/api/v1/capacity/uioli` | UIOLI данные |
| GET | `/api/v1/capacity/routes` | NC-маршруты из `nc_routes` |
| GET | `/api/v1/capacity/surrender` | Список surrender |
| POST | `/api/v1/capacity/surrender` | Создать surrender |
| PATCH | `/api/v1/capacity/surrender/:id/rbp` | Обновить RBP |
| GET | `/api/v1/capacity/:pointCode/history` | История загрузки (timeseries) |
| GET | `/api/v1/capacity/next-auctions` | Ближайшие аукционы |

---

## 9. Аукционы (NC Art.7 + CAM NC EU 2017/459)

### 9.1 Календарь аукционов (ENTSOG MAR0277-24)

47 аукционов GY2025/2026 (семя от октября 2024):

| Тип | Кол-во | Расписание |
|---|---|---|
| Annual Firm | 2 | 07.07.2025 (Horgoš, Joint) |
| Quarterly | 11 | AQC-1…4 (3 мес. до газового квартала) |
| Monthly Firm | 24 | 3-й понедельник M-1 |
| Daily/Within-Day | templates | 4-й вторник M-1 (Interruptible) |

### 9.2 Bid Lifecycle

```
FREE CAPACITY → POST /auctions/bids (DRAFT)
→ POST /bids/:id/submit (SUBMITTED)
→ POST /bids/:id/result (WON / LOST)
→ POST /bids/:id/create-contract (CONTRACT_CREATED)
→ BILLING
```

### 9.3 Credit Check (NC Art.5.3.1)

Перед подачей заявки — автоматическая проверка доступного кредитного лимита. При нехватке — заявка отклоняется.

`calcCreditBlock(product_type, capacity_kWh_h, tariff)` — множители по типу продукта (см. раздел 5.3).

### 9.4 Reserve Price

Стартовая цена аукциона = Reserve Price из АЕРС 05-145 (см. раздел 13). При отсутствии спроса — снижение до нуля не ниже нуля.

### 9.5 API Auctions

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/v1/auctions` | Список аукционов |
| GET | `/api/v1/auctions/summary` | KPI |
| GET | `/api/v1/auctions/revenue-forecast` | Revenue forecast |
| GET | `/api/v1/auctions/calendar` | Календарь MAR0277-24 |
| GET | `/api/v1/auctions/calendar/upcoming` | Предстоящие |
| GET | `/api/v1/auctions/calendar/:id` | Конкретный аукцион |
| PATCH | `/api/v1/auctions/calendar/:id/status` | Статус аукциона |
| GET | `/api/v1/auctions/bids` | Все заявки |
| POST | `/api/v1/auctions/bids` | Создать заявку (DRAFT) |
| GET | `/api/v1/auctions/bids/:id` | Детали заявки |
| PATCH | `/api/v1/auctions/bids/:id` | Обновить |
| POST | `/api/v1/auctions/bids/:id/submit` | Подать (SUBMITTED) |
| POST | `/api/v1/auctions/bids/:id/result` | Результат (WON/LOST) |
| POST | `/api/v1/auctions/bids/:id/create-contract` | Создать контракт |
| POST | `/api/v1/auctions/bids/:id/cancel` | Отменить |
| GET | `/api/v1/auctions/timeline` | 90-дневный timeline событий |

---

## 10. Баланс и VTP (NC Art.11, 15)

### 10.1 Суточный баланс

Баланс по точкам за Gas Day:

| Поле | Описание |
|---|---|
| `contracted_kwh_h` | Контрактованная мощность |
| `nominated_kwh_h` | Номинированный объём |
| `confirmed_kwh_h` | Подтверждённый (после матчинга) |
| `free_kwh_h` | Свободная мощность |
| `imbalance_kwh_h` | Небаланс entry vs exit |

### 10.2 Imbalance Charge (NC Art.15.4)

```
Positive Imbalance: ICP = |TI| × GPP
Negative Imbalance: ICN = |TI| × GPN
```

Где TI = Total Imbalance за Gas Day, GPP/GPN — маргинальные цены газа.

### 10.3 VTP — Virtual Trading Point (NC Art.11)

VTP позволяет шипперам передавать права на газ между собой без физической транспортировки. Точка `VTP-SERBIA` — виртуальная, участвует в балансировании.

### 10.4 API Balance

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/v1/balance` | Суточный баланс по точкам |
| GET | `/api/v1/balance/shippers` | Детализация по шипперам |

---

## 11. Системные параметры

Раздел доступен только для роли `admin`. Навигация: **СИСТЕМА → Параметры**.

### 11.1 Точки подключения

Таблица всех 7 точек подключения из базы данных (`interconnection_points`): код, тип, официальное название NC, расположение. Только чтение для всех.

### 11.2 Системные параметры

Inline-редактирование значений из таблицы `system_params` (admin only):

| Параметр | Значение | Источник |
|---|---|---|
| `fuel_gas_x1_pct` | 0.42 | NC Art.18, Annex 3A |
| `fuel_gas_x2_pct` | 0.08 | NC Art.18, Annex 3A |
| `euribor_6m_rate` | актуальный % | NC Art.20.4.2 |
| `margin_call_days` | 2 | NC Art.5.5 |
| `invoice_due_days` | 30 | NC Art.20.3 |

### 11.3 Тарифы АЕРС по Gas Year

Просмотр полной тарифной таблицы из `reserve_prices` (после миграции 010 в Sprint 9).

### 11.4 API System Params

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/v1/system-params` | Все параметры |
| GET | `/api/v1/system-params/:key` | Конкретный параметр |
| PATCH | `/api/v1/system-params/:key` | Обновить (admin only) |
| GET | `/api/v1/system-params/points` | Точки подключения |

---

## 12. Аудит (FR-17)

Полный журнал действий всех пользователей. Фильтр по модулям:

`AUTH` · `NOM` · `CREDIT` · `BILLING` · `CONTRACTS` · `CAPACITY` · `AUCTIONS` · `SYSTEM`

Каждая запись содержит: timestamp CET, пользователь, роль, действие, объект, old_value / new_value.

`GET /api/v1/audit` — список записей (с пагинацией и фильтрами).

---

## 13. Тарифы АЕРС GY2025/2026

Источник: **АЕРС Decision 05-145** (17.07.2025, Gas Year 01.10.2025 – 30.09.2026)

### 13.1 Annual Capacity (EUR/kWh/h/year)

| Точка | Firm | Commercial Reverse |
|---|---|---|
| Entry Point Kirevo/Zaječar | **6.00** | **2.85** |
| Domestic Exit Zone | **4.19** | **1.99** |
| Exit Point Horgoš/Kiškundorožma | **6.85** | **3.25** |

### 13.2 Quarterly Capacity (EUR/kWh/h/quarter)

| Квартал | Entry F | Dom F | Horgoš F | Entry CR | Dom CR | Horgoš CR |
|---|---|---|---|---|---|---|
| Q1 (Oct–Dec 2025) | 1.81 | 1.27 | 2.07 | 0.86 | 0.60 | 0.98 |
| Q2 (Jan–Mar 2026) | 1.78 | 1.24 | 2.03 | 0.85 | 0.59 | 0.96 |
| Q3 (Apr–Jun 2026) | 1.80 | 1.25 | 2.05 | 0.86 | 0.59 | 0.97 |
| Q4 (Jul–Sep 2026) | 1.81 | 1.27 | 2.07 | 0.86 | 0.60 | 0.98 |

### 13.3 Monthly Capacity (EUR/kWh/h/month)

| Дней в месяце | Entry F | Dom F | Horgoš F | Entry CR | Dom CR | Horgoš CR |
|---|---|---|---|---|---|---|
| 28 (февраль) | 0.60 | 0.42 | 0.68 | 0.29 | 0.20 | 0.32 |
| 30 дней | 0.64 | 0.45 | 0.73 | 0.30 | 0.21 | 0.35 |
| 31 день | 0.66 | 0.46 | 0.76 | 0.31 | 0.22 | 0.36 |

### 13.4 Daily Capacity (EUR/kWh/h/day)

| Точка | Firm | Interruptible | Commercial Reverse |
|---|---|---|---|
| Entry Kirevo | **0.0329** | 0.0329 | 0.0156 |
| Domestic Exit | **0.0230** | 0.0230 | 0.0109 |
| Exit Horgoš | **0.0375** | 0.0375 | 0.0178 |

### 13.5 Within-Day Capacity (EUR/kWh/h/hour)

| Точка | Firm | Interruptible |
|---|---|---|
| Entry Kirevo | **0.0021** | 0.0021 |
| Domestic Exit | **0.0014** | 0.0014 |
| Exit Horgoš | **0.0023** | 0.0023 |

> Within-Day Commercial Reverse не предлагается (NC Art.6.5.2).

### 13.6 Штраф за прерывание (АЕРС п.3)

При прерывании Interruptible Daily или Within-Day capacity:

**Штраф = стоимость × 3**

---

## 14. Формулы расчётов (NC-reference)

### 14.1 Capacity Fee (NC Art.20 + АЕРС)

```
fee = cap_entry_kWh_h × tariff_entry / 365 × days
    + cap_exit_kWh_h  × tariff_exit  / 365 × days
```

Пример (Annual Firm, KIREVO_HORGOS, 31 день):
```
fee = 13 752 230 × 6.00 / 365 × 31 + 9 216 209 × 6.85 / 365 × 31
    = 7 011 065 + 5 363 185 = 12 374 250 EUR
```

### 14.2 Within-Day Fee (NC Art.6.3.1.4)

```
fee = capacity_kWh_h × price_per_hour × hours
```

### 14.3 Fuel Gas (NC Art.18.2.1)

```
FG_kwh = X1 × Q_horgos + X2 × Q_serbia − KN
```

### 14.4 Штрафные проценты (NC Art.20.4.2)

```
interest = overdue_EUR × (EURIBOR_6M + 0.03) / 360 × days
```

> EURIBOR 6M, не 3M. База 360 дней (act/360).

### 14.5 Credit Support (NC Art.5.1.5)

```
min_credit = fee × multiplier
  Yearly:   multiplier = 2/12 ≈ 16.67%
  Quarterly: multiplier = 2/3  ≈ 66.67%
  Monthly:   multiplier = 1    = 100%
  Daily:     multiplier = 1    = 100%
```

### 14.6 Imbalance Charge (NC Art.15.4)

```
ICP = |TI| × GPP   (positive imbalance)
ICN = |TI| × GPN   (negative imbalance)
```

### 14.7 Surrender Premium (NC Art.8.3)

```
AP = (P_old − P_new) × RC × P
```

---

## 15. API Reference

Полная спецификация доступна в Swagger UI: `http://localhost:3000/docs`

### Сводная таблица (70+ эндпоинтов, api.js v2.1)

| Модуль | Кол-во | Базовый путь | Изменения |
|---|---|---|---|
| Auth | 4 | `/api/v1/auth` | |
| Users | 5 | `/api/v1/users` | |
| Shippers | 7 | `/api/v1/shippers` | +apply, +approve, +remove, +audit (Sprint 10 P1) |
| Contracts | 5 | `/api/v1/contracts` | |
| Billing | 10 | `/api/v1/billing` | +with-lines, +generate, +reserve-prices (Sprint 10 P0) |
| Credits | 14 | `/api/v1/credits` | |
| Auctions | 16 | `/api/v1/auctions` | |
| Capacity | 12 | `/api/v1/capacity` | |
| Nominations | 8 | `/api/v1/nominations` | |
| Balance | 2 | `/api/v1/balance` | |
| Audit | 1 | `/api/v1/audit` | |
| System Params | 4 | `/api/v1/system-params` | |
| ERP | 3 | `/api/v1/erp` | |
| Health | 1 | `/api/v1/health` | |
| **RBP Bridge** | **11** | /api/v1/rbp | auctions, trades, bilateral, surrender, remit, sync |
| **Итого** | **93** | | Sprint 12 финальный: +11 RBP Bridge |

---

## 16. Безопасность

| Требование | Реализация | Статус |
|---|---|---|
| Аутентификация | JWT + Argon2id хэширование | ✅ |
| Авторизация | RBAC middleware per-route | ✅ |
| HTTPS / Headers | Helmet + CSP (relaxed для /docs) | ✅ |
| Rate Limiting | express-rate-limit (100 req/15 мин) | ✅ |
| SQL Injection | Parameterized queries (pg) | ✅ |
| XSS | Helmet CSP, Content-Type validation | ✅ |
| CORS | Whitelist origins в .env | ✅ |
| Input Validation | Joi/Zod schemas | ✅ Sprint 9 |
| OWASP Top 10 Audit | Penetration test | ✅ Sprint 9 |
| Nomination deadline | 14:00 CET D-1 серверная проверка | ✅ Sprint 9 |

### 16.2 NC Compliance Matrix (79%, Sprint 12)

| Глава | Статей | ✅ | ⚠ | 🔲 | Покрытие |
|---|---|---|---|---|---|
| Art.3 Access | 8 | 7 | 1 | 0 | 94% |
| Art.5 Credit | 6 | 6 | 0 | 0 | 100% |
| Art.6 Products | 5 | 5 | 0 | 0 | 100% |
| Art.7 Auctions | 8 | 8 | 0 | 0 | 100% |
| Art.8 Surrender | 2 | 2 | 0 | 0 | 100% |
| Art.10 Secondary | 3 | 1 | 0 | 2 | 33% |
| Art.11 VTP | 1 | 0 | 0 | 1 | 0% |
| Art.12 Nominations | 8 | 8 | 0 | 0 | 100% |
| Art.13 Matching | 3 | 2 | 0 | 1 | 67% |
| Art.14 Restrictions | 2 | 0 | 0 | 2 | 0% |
| Art.15 Balancing | 3 | 1 | 1 | 1 | 50% |
| Art.17 Gas Quality | 2 | 1 | 0 | 1 | 50% |
| Art.18 Fuel Gas | 3 | 3 | 0 | 0 | 100% |
| Art.20 Billing | 5 | 5 | 0 | 0 | 100% |
| Art.24 Transparency | 1 | 0 | 1 | 0 | 50% |
| **ИТОГО** | **70** | **55** | **4** | **11** | **79%** |

> ⚠ = частично реализовано. 🔲 = P2/P3 (VTP, OTC, Matching auto, Restrictions, Gas Quality limits, Transparency portal).

---

## 17. Дорожная карта проекта

### 17.1 Завершённые спринты

| Sprint | Дата | SP | Статус | Ключевые deliverables |
|---|---|---|---|---|
| 1–3 | 03–23.03.2026 | 83 | ✅ | MVP Frontend, Dashboard, RBAC, Billing UI |
| 4 | 23.03.2026 | 54 | ✅ | Backend API, PostgreSQL, CAM NC, АЕРС тарифы |
| 5 | 25.03.2026 | 72 | ✅ | CAP-FIX, Gas Quality, Capacity Tracker, NC Art.5, Auctions |
| 6 | 26.03.2026 | 38 | ✅ | ERP Connector, Credit UI, Auction UI, 56/56 тестов |
| 7 | 26.03.2026 | 21 | ✅ | NC route alignment (009), ncRoutes.js, CLAUDE.md |
| 8 | 26.03.2026 | 22 | ✅ | api.js v2.0 (65 методов), 10 модулей wired, CORS/CSP fix |
| **9** | **27.03.2026** | **46** | **✅** | **NC Full Compliance (0 расхождений), АЕРС тарифы (migration 010), KIREVO-EXIT, 101/101 тестов, Over-Nomination, OWASP, Input Validation** |
| **10 P0** | **27.03.2026** | **42** | **✅** | **Invoice Line Items (9 типов, migration 011), Capacity 90/10 (LT/ST split), Frontend Real Data (F-1–F-7), api.js v2.1, reserve-prices endpoint** |
| **11** | **27.03.2026** | **39** | **✅** | **Nominations 100% (NC Art.12-13), RBP Core: Mock SOAP Server, rbpClient.js, capacityUpload, creditSync, auctionSync, bundledAuction, migrations 012–013** |
| **12** | **28.03.2026** | **19** | **✅** | **RBP Secondary Market: surrenderApproval, bilateralManager, remitReporter, RBP Bridge UI (4 вкладки), migration 014, rbp-mock.test.js (16 тестов), 117/117** |

**Кумулятив на 28.03.2026: ~456 SP · 117/117 тестов · NC 79% (55/70) · 93 endpoints · Migrations 001–014**

### 17.2 RBP Integration — ✅ Завершено (Sprint 11–12)

**Variant B: RBP-Ready с Mock SOAP Server.** Переключение на production = одна переменная `RBP_MODE=production`.

| Компонент | Описание | Статус |
|---|---|---|
| Mock SOAP Server | Node.js/Express port 8080, 11 handlers | ✅ |
| rbpClient.js | node-soap, mock/uat/prod toggle, retry ×3, timeout 30s | ✅ |
| capacityUpload.js | UploadCapacityAndTariffV4 + deadlineScheduler | ✅ |
| creditSync.js | UploadFinanceCreditV3, GetCreditLimits, UploadCreditRelease | ✅ |
| auctionSync.js | GetAuctionsV5 (5 мин), GetTradesV4 (2 мин) | ✅ |
| bundledAuction.js | «One auction – two contracts», bundle_id | ✅ |
| surrenderApproval.js | ApproveSurrenderedCapacityDeal (NC Art.8) | ✅ |
| bilateralManager.js | CreateBilateralDealV4, OTC lifecycle | ✅ |
| remitReporter.js | UploadRemitReport → ACER через RBP | ✅ |
| RBP Bridge UI | 4 вкладки: Статус, Аукционы, Bilateral, Sync-лог | ✅ |
| rbp-mock.test.js | 16 тестов — 11 SOAP-методов, bundled, full cycle | ✅ |
| Migrations 013–014 | nominations_kwh_h, rbp_tables | ✅ |

**Bundled Auction:** шиппер подаёт 1 bid на HORGOS-EXIT → RBP создаёт 2 контракта: `GTA-GASTRANS` (тариф 6.85) + `GTA-FGSZ`, linked по `bundle_id`. KIREVO-ENTRY — не бандловая (Bulgartransgaz вне RBP).

**Gaps Variant B:** 14/20 закрыто. Остаток P2/P3: G-01 (регистрация TSO Member у FGSZ), AS4, Comfort Bidding, Buyback, LPFS.

### 17.3 Что осталось за рамками MVP (P2/P3 backlog)

| Gap | Область | Приоритет |
|---|---|---|
| G-01 | Регистрация TSO Member у FGSZ (организационно) | P2 |
| G-02 | Реальный SSL-сертификат для RBP prod | P2 |
| Art.11 | VTP — Virtual Trading Point полный цикл | P3 |
| Art.10 | OTC Secondary Market full matching | P3 |
| Art.14 | Restrictions (congestion management) | P3 |
| Art.24 | Transparency portal (ENTSO-G) | P3 |
| AS4 | Стандарт обмена сообщениями ENTSOG | P3 |

---

# ЧАСТЬ II — ENGLISH

---

## 1. System Overview

**GTCP (Gas Trading & Commercial Platform)** — an information system for managing the commercial operations of a gas transmission company. Developed in accordance with the Gastrans Network Code (03.04.2020) and AERS (Energy Agency of the Republic of Serbia) decisions.

Pipeline: TurkStream Serbian section, 403 km, Bulgarian border (Kirevo/Zaječar) → Serbia / Hungarian border (Horgoš).

### 1.1 Purpose

GTCP covers:
- Capacity auctions (NC Art.7 + CAM NC EU 2017/459)
- Shipper credit support management (NC Art.5, URDG 758)
- Automated billing: capacity fee (entry≠exit), fuel gas (NC Art.18), late payment interest (EURIBOR 6M + 3%, NC Art.20.4.2)
- Transportation contracts — 10 capacity product types
- Real-time capacity monitoring (Capacity Tracker)
- Over-Nomination (NC Art.12.8) — Within-Day Interruptible when Firm is fully subscribed
- ERP integration (1C:Enterprise)

### 1.2 KPIs

| KPI | As Is | To Be |
|---|---|---|
| Nomination processing time | 30–60 min | < 5 min |
| Credit limit breach detection | 1–24 hours | < 1 min |
| Billing errors | 3–5% | 0% (auto-calc per NC) |
| Balance report preparation | 2–4 hours | Instant |
| NC compliance coverage | ~40% | **79% (55/70)** ✅ (Sprint 12, chapter matrix) |
| Tests | — | **117/117** passing (Sprint 12) |

### 1.3 Technical Architecture

| Component | Technology | Version | Purpose |
|---|---|---|---|
| Backend API | Node.js + Express | 20 LTS | REST API, business logic |
| Database | PostgreSQL | 15–17 | Storage, migrations 001–014 |
| Frontend | Vanilla JS + HTML5 | Sprint 10 | SPA interface, real data from API |
| API Client | api.js v2.1 | 93 methods | All modules + RBP Bridge (11 endpoints), Reserve Prices, Invoice Line Items |
| Containerization | Docker Compose | 4.x+ | Local deployment |
| VPS (production) | PM2 + Nginx | 2.x / 1.25 | Production server |
| ERP Integration | 1C:Enterprise | 8.3 | Counterparties, invoices |

### 1.4 Normative Framework

| Document | Scope | Status |
|---|---|---|
| **Gastrans Network Code** (03.04.2020, 111 pp.) | All operations | Binding — authoritative source of truth |
| **AERS Decision 05-145** (17.07.2025) | GY2025/2026 tariffs | Reserve Prices (full table — Section 13) |
| **CAM NC** EU 2017/459 | Capacity auctions | Ascending clock + Uniform price |
| **ENTSOG MAR0277-24** (07.10.2024) | Auction schedule | 47 auctions GY2025/2026 |

> **Priority rule:** NC > AERS > CAM NC > code. On discrepancy — code is corrected to match NC.

---

## 2. Roles and Access (RBAC)

### 2.1 Role Matrix

| Role | Description | Module Access |
|---|---|---|
| `admin` | System Administrator | All modules + Users + Settings + System Params |
| `dispatcher` | Commercial Operator | Dashboard, Nominations, Credits, Balance, Billing, Contracts, Capacity, Auctions, Audit |
| `credit` | Credit Manager | Dashboard, Credits, Audit |
| `billing` | Billing Specialist | Dashboard, Billing, Audit |
| `contracts` | Contracts Manager | Dashboard, Contracts, Capacity, Audit |
| `viewer` | Guest (read-only) | Dashboard (readonly) |

### 2.2 Authentication (JWT)

- **Access Token**: 15 minutes, passed in `Authorization: Bearer <token>` header
- **Refresh Token**: 7 days, stored in HttpOnly cookie
- **Token Rotation**: refresh token replaced on every access token renewal

| Method | URL | Body | Response |
|---|---|---|---|
| POST | `/api/v1/auth/login` | `{"email":"...","password":"..."}` | `{"accessToken":"...","user":{...}}` |
| POST | `/api/v1/auth/refresh` | Cookie: refreshToken | `{"accessToken":"..."}` |
| POST | `/api/v1/auth/logout` | — | `{"message":"Logged out"}` |

---

## 3. Installation and Local Run

### 3.1 System Requirements

| Tool | Min Version | Download |
|---|---|---|
| Node.js | 20.x LTS | https://nodejs.org |
| PostgreSQL | 15.x – 17.x | https://www.postgresql.org/download/windows/ |
| Docker Desktop | 4.x+ (optional) | https://www.docker.com/products/docker-desktop/ |
| Git | any | https://git-scm.com |

### 3.2 Option A — Docker Compose

```powershell
cd C:\Users\leokr\ETRM\backend
docker compose up -d
docker compose exec api node src/db/migrate.js   # migrations 001–009
docker compose exec api node src/db/seed.js
```

Addresses: API `http://localhost:3000/api/v1` · Swagger `http://localhost:3000/docs` · PostgreSQL `localhost:5432`

### 3.3 Option B — Node.js Direct (Sprint 10 default)

```powershell
psql -U postgres -c "CREATE USER gtcp_user WITH PASSWORD 'gtcp_dev_password';"
psql -U postgres -c "CREATE DATABASE gtcp OWNER gtcp_user;"
cd C:\Users\leokr\ETRM\backend
copy .env.example .env
```

Minimum `.env`:

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432          # or 8887 if PostgreSQL 17 on non-standard port
DB_NAME=gtcp
DB_USER=gtcp_user
DB_PASSWORD=gtcp_dev_password
JWT_ACCESS_SECRET=any_64_char_string
JWT_REFRESH_SECRET=another_64_char_string
CORS_ORIGIN=http://localhost:8080,http://127.0.0.1:5501,http://localhost:5501,http://127.0.0.1:5500,http://localhost:5500
ERP_MOCK=true
```

```powershell
npm install
npm run migrate   # 001–009 (all clean)
npm run seed
npm run dev
```

> **CORS**: `CORS_ORIGIN` must include the frontend origin. If using http-server on port 5501, add `http://127.0.0.1:5501`.

### 3.4 Option C — Frontend Only (http-server)

```powershell
npm install -g http-server
cd C:\Users\leokr\ETRM\Soft
http-server -p 5501 --cors
# Opens: http://127.0.0.1:5501/GTCP_MVP.html
```

Requires running backend (Option A or B).

### 3.5 Tests

```powershell
cd C:\Users\leokr\ETRM\backend
npm test                    # all tests — 117/117 passing
npm run test:coverage       # with coverage report
```

Sprint 12 result: **117/117** passing across 6 suites: billing (18), credits (21), auctions (17), nc-routes (21), tariffs (24), rbp-mock (16, added Sprint 12).

---

## 4. Nominations (NC Art.12)

### 4.1 Creating a Nomination

A nomination is a shipper's notification of planned transportation volumes for a specific Gas Day (06:00 CET → 06:00 CET next day). Volume is expressed in **kWh/h**, equally distributed across hours.

| Field | Type | Description |
|---|---|---|
| `shipper_id` | UUID | Shipper reference |
| `point_code` | TEXT | NC IP code: `KIREVO-ENTRY`, `HORGOS-EXIT`, `EXIT-SERBIA`, etc. |
| `flow_direction` | TEXT | NC route code (7 options) |
| `nominated_quantity_kwh_h` | NUMERIC | Volume in kWh/h |
| `gas_day` | DATE | Gas Day date |
| `status` | TEXT | `PENDING` → `CONFIRMED` → `MATCHED` |

### 4.2 Nomination Deadline (NC Art.12.3)

**D-1 by 14:00 CET** — nominations submitted after the deadline are rejected by the server (Sprint 9: server-side CET time validation).

Renomination windows (NC Art.12.7.5): additional submission allowed until 18:00 CET D-1.

### 4.3 Matching (NC Art.13)

Algorithm: **Active TSO / Double-Sided Matching**

```
Confirmed Quantity = min(Entry Nomination, Exit Nomination)
```

### 4.4 Over-Nomination (NC Art.12.8)

When Firm Capacity is fully contracted, a shipper may submit an **Over-Nomination** for Within-Day Interruptible capacity from the UIOLI pool.

Endpoint: `POST /api/v1/nominations/:id/over-nominate` (Sprint 9)

Interruption penalty: fee × **3** (AERS item 3).

### 4.5 EDIGAS NOMINT XML

For confirmed nominations: `GET /api/v1/nominations/:id/edigas-nomint` returns NOMINT XML (NC Art.4.1.2).

In the UI: **«XML»** button on confirmed nominations row → popup with full XML.

### 4.6 API Nominations

| Method | URL | Description |
|---|---|---|
| GET | `/api/v1/nominations` | List nominations |
| POST | `/api/v1/nominations` | Create nomination |
| GET | `/api/v1/nominations/:id` | Nomination details |
| PATCH | `/api/v1/nominations/:id` | Update (before deadline) |
| POST | `/api/v1/nominations/:id/match` | Run matching |
| POST | `/api/v1/nominations/:id/renominate` | Renomination |
| GET | `/api/v1/nominations/:id/edigas-nomint` | EDIGAS XML preview |
| POST | `/api/v1/nominations/:id/over-nominate` | Over-Nomination (NC Art.12.8) |

---

## 5. Credit Monitor (NC Art.5)

### 5.1 Credit Positions

| Field | Description |
|---|---|
| `credit_limit` | Established credit limit (EUR) |
| `current_exposure` | Current obligations on active contracts |
| `available_credit` | `credit_limit − current_exposure` |
| `utilization_pct` | % of limit used |
| `risk_level` | `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` |

### 5.2 Credit Support Instruments (NC Art.5.1)

| Type | Description | NC Ref |
|---|---|---|
| `BANK_GUARANTEE` | Bank Guarantee URDG 758 (bank ≥ BBB-) | Art.5.1.1 |
| `LETTER_OF_CREDIT` | Letter of Credit | Art.5.1.2 |
| `CASH_DEPOSIT` | Cash deposit into escrow | Art.5.1.3 |
| `PARENT_GUARANTEE` | Corporate parent guarantee | Art.5.1.4 |

### 5.3 Credit Support Size (NC Art.5.1.5)

| Product Type | Min Credit = % of Fee | Available Credit = Limit × |
|---|---|---|
| Monthly / Daily / Within-Day | 100% | × 1 |
| Quarterly | 2/3 (66.67%) | × 3/2 |
| Yearly | 2/12 (16.67%) | × 12/2 |

### 5.4 Rating Exemption (NC Art.5.1.6)

Shippers with investment grade rating are exempt from providing guarantees:

**S&P/Fitch ≥ BBB−** OR **Moody's ≥ Baa3** OR **Creditreform ≤ 235**

### 5.5 Margin Call (NC Art.5.5)

Deadline to replenish collateral: **+2 Business Days** from notification date.

### 5.6 API Credits

| Method | URL | Description |
|---|---|---|
| GET | `/api/v1/credits` | All shippers credit summary |
| GET | `/api/v1/credits/summary` | Aggregated KPIs |
| GET | `/api/v1/credits/:shipperId/instruments` | Shipper instruments |
| POST | `/api/v1/credits/:shipperId/instruments` | Add instrument |
| GET | `/api/v1/credits/:shipperId/rating` | Shipper rating |
| POST | `/api/v1/credits/:shipperId/rating` | Update rating |
| GET | `/api/v1/credits/:shipperId/eligibility` | NC Art.5 eligibility check |
| GET | `/api/v1/credits/:shipperId/by-product` | Limits by product type |
| PATCH | `/api/v1/credits/:shipperId/status` | Update status |
| GET | `/api/v1/credits/margin-calls` | Active Margin Calls |

---

## 6. Billing (NC Art.18, 20)

### 6.1 Invoice Types

| Type | Description | NC Ref |
|---|---|---|
| `CAPACITY` | Transportation capacity fee (entry + exit) | Art.20 |
| `FUEL_GAS` | Fuel gas — compressors and preheating | Art.18 |
| `LATE_PAYMENT` | Interest on overdue invoices | Art.20.4.2 |

Invoice lifecycle: `DRAFT` → `ISSUED` → `PAID` / `OVERDUE` / `DISPUTED`

Payment due: by the **20th of the month** in which the invoice was received (NC Art.20.4.1). Invoice issued within the first 5 business days of the following month (NC Art.20.3.1). Auto-transition to `OVERDUE` on breach.

### 6.2 Capacity Fee Formula

```
CORRECT (separate entry/exit):
  fee = cap_entry_kWh_h × tariff_entry / 365 × days
      + cap_exit_kWh_h  × tariff_exit  / 365 × days

WRONG (do not use!):
  fee = capacity × (tariff_entry + tariff_exit) / 365 × days
  ↑ Assumes cap_entry == cap_exit, which is FALSE for Gastrans
```

> Reason: Entry Kirevo (13,752,230 kWh/h) ≠ Exit Horgoš (9,216,209 kWh/h). Difference = 4,536,021 kWh/h goes to domestic exit zone.

### 6.3 Within-Day Fee (NC Art.6.3.1.4)

```
fee = capacity_kWh_h × price_per_hour × number_of_hours
```

Do NOT divide by 365 for Within-Day products.

### 6.4 Fuel Gas (NC Art.18.2.1)

```
FG = X1 × Q_horgos + X2 × Q_serbia − KN
```

Where: X1 = 0.42% (compressors), X2 = 0.08% (preheating), KN = D-2 correction.

### 6.5 Late Payment Interest (NC Art.20.4.2)

```
interest = overdue_EUR × (EURIBOR_6M + 3%) / 360 × overdue_days
```

> **EURIBOR 6M** (NOT 3M). Daily accrual. 360-day basis (act/360).

### 6.6 Interruption Penalty (AERS item 3)

On interruption of Interruptible Daily or Within-Day capacity: **fee × 3**.

### 6.7 Gas Quality (NC Art.17, Annex 3A)

Daily gas quality data from FGSZ Ltd. / GMS Kiskundorozsma 2:

| Parameter | Unit | Apr 2025 Average |
|---|---|---|
| GCV | kWh/Nm³ | 11.523 |
| Wobbe Index | kWh/Nm³ | 14.975 |
| CH4 | % | 94.38% |
| H2S | mg/Nm³ | NC limit: ≤ 5 |
| Density | kg/Nm³ | 0.7656 |

### 6.9 Invoice Line Items — Variant C (NC Art.20, Sprint 10 P0)

Starting with Sprint 10, invoices have a **line-item structure** (NC Art.20.3.2). A single invoice contains individual rows per product type.

#### Line Types (`line_type`) — 9 values

| `line_type` | Formula | NC Ref |
|---|---|---|
| `CAPACITY` | `cap_kWh_h × tariff / 365 × days` | Art.20.3.2.1 |
| `CAPACITY_WITHIN_DAY` | `cap_kWh_h × tariff_per_hour × hours` | Art.6.3.1.4 |
| `FUEL_GAS` | `X1×Q_horgos + X2×Q_serbia − KN` | Art.18 |
| `TRANSFER` | `cap_kWh_h × tariff / 365 × days` | Art.10.3 |
| `SURRENDER_PREMIUM` | `(P_old − P_new) × RC × hours` | Art.8.3 |
| `LATE_PAYMENT` | `overdue × (EURIBOR_6M + 3%) / 360 × days` | Art.20.4.2 |
| `IMBALANCE` | `|TI| × GPP` or `|TI| × GPN` | Art.15.4 |
| `INTERRUPTION_PENALTY` | `capacity_fee × 3` | AERS item 3 |
| `AUCTION_PREMIUM` | `(Auction_Price − Reserve_Price) × cap × hours` | Art.7.6.11 |

#### Verification example (real data, 31 days, FIRM_YEARLY, KIREVO→HORGOS)

```
CAPACITY ENTRY: 13,752,230 × 6.00 / 365 × 31 = €7,007,985.70
CAPACITY EXIT:   9,216,209 × 6.85 / 365 × 31 = €5,361,813.65
FUEL_GAS (auto): 28,798,810 kWh × 0.0325      = €  935,961.32
                                        TOTAL: €13,305,760.67
```

### 6.10 API Billing

| Method | URL | Description |
|---|---|---|
| GET | `/api/v1/billing` | Invoice list |
| POST | `/api/v1/billing` | Create invoice (legacy, single amount) |
| POST | `/api/v1/billing/with-lines` | Create invoice with line items (Variant C) |
| POST | `/api/v1/billing/generate` | Auto-generate lines from shipper contracts |
| GET | `/api/v1/billing/:id` | Invoice details + line_items + subtotals |
| PATCH | `/api/v1/billing/:id/status` | Update status |
| GET | `/api/v1/billing/gas-quality` | Gas quality table |
| GET | `/api/v1/billing/:id/statement` | Monthly Statement (NC Art.20.1) |
| POST | `/api/v1/billing/:id/erp-sync` | Sync with 1C ERP |
| GET | `/api/v1/reserve-prices` | AERS 05-145 tariffs with filters |

---

## 7. Contracts (NC Art.3–6)

### 7.1 Lifecycle

`DRAFT` → `ACTIVE` → `EXPIRED` / `TERMINATED` / `CANCELLED`

### 7.2 Contract Fields

| Field | Type | Description |
|---|---|---|
| `contract_no` | TEXT UNIQUE | GTCP-YYYY-NNNN |
| `shipper_id` | UUID | Shipper reference |
| `entry_point_code` | TEXT | Entry IP code (NC §2.1): `KIREVO-ENTRY`, `HORGOS-ENTRY`, `EXIT-SERBIA-ENTRY` |
| `exit_point_code` | TEXT | Exit IP code (NC §2.1): `HORGOS-EXIT`, `EXIT-SERBIA`, `KIREVO-EXIT` |
| `flow_direction` | TEXT | NC route code (7 options) |
| `nc_route_type` | TEXT | `PHYSICAL` / `COMMERCIAL_REVERSE_FULL` / `COMMERCIAL_REVERSE_HALF` |
| `contract_type` | TEXT | Product type (10 options) |
| `capacity_entry_kwh_h` | NUMERIC | Entry capacity, kWh/h |
| `capacity_exit_kwh_h` | NUMERIC | Exit capacity, kWh/h |
| `start_date` / `end_date` | DATE | Contract period |

### 7.3 Capacity Products (NC Art.6) — 10 types

| Code | Description | Duration | NC Article |
|---|---|---|---|
| `FIRM_YEARLY` | Firm Annual | 1 Gas Year | 6.1.2.1 |
| `FIRM_QUARTERLY` | Firm Quarterly | 1 Gas Quarter | 6.3.1.1 |
| `FIRM_MONTHLY` | Firm Monthly | 1 Gas Month | 6.3.1.2 |
| `FIRM_DAILY` | Firm Daily | 1 Gas Day | 6.3.1.3 |
| `FIRM_WITHIN_DAY` | Firm Within-Day | < 1 Gas Day | 6.3.1.4 |
| `INTERRUPTIBLE` | Interruptible Daily | 1 Gas Day | 6.1.2.3 |
| `COMM_REV_YEARLY` | Commercial Reverse Yearly | 1 Gas Year | 6.1.2.4 |
| `COMM_REV_QUARTERLY` | Comm. Reverse Quarterly | 1 Gas Quarter | 6.5.2.2 |
| `COMM_REV_MONTHLY` | Comm. Reverse Monthly | 1 Gas Month | 6.5.2.3 |
| `COMM_REV_DAILY` | Comm. Reverse Daily | 1 Gas Day | 6.5.2.4 |

> Capacity always in **kWh/h**. Never MWh/day in business logic.

---

## 8. Capacity Tracker (NC §2.1, Art.6, 8)

### 8.1 Interconnection Points (NC §2.1)

Per the Gastrans Network Code (§2.1), exactly **3 physical interconnection points** exist:

| DB Code | NC Official Name | Type | Location |
|---|---|---|---|
| `KIREVO-ENTRY` | Entry Point Kirevo/Zaječar | ENTRY (physical) | Bulgarian-Serbian border, GMS-1 |
| `HORGOS-EXIT` | Exit Point Horgoš/Kiškundorožma 1200 | EXIT (physical) | Serbian-Hungarian border |
| `EXIT-SERBIA` | Exit Point Serbia (Gospođinci+Pančevo+Paraćin) | EXIT (physical) | Domestic Serbia: GMS-2/3/4 |

For **Commercial Reverse Flow** (NC Art.6.1.2), the same physical points serve as reversed entry/exit:

| DB Code | NC Name | Used In |
|---|---|---|
| `HORGOS-ENTRY` | Entry Point Horgoš | Full Reverse A, Half Reverse A |
| `EXIT-SERBIA-ENTRY` | Entry Point Serbia | Full Reverse B, Half Reverse B |
| `KIREVO-EXIT` | Exit Point Kirevo/Zaječar | Full Reverse A and B (virtual exit to Bulgarian border) |
| `VTP-SERBIA` | Virtual Trading Point | NC Art.11 — gas rights transfer |

**Deprecated names** — must not appear in new code or data: `Horgoš` (plain text), `Gospođinci` (plain text), `GOSPODJINCI-ENTRY`, `GOSPODJINCI-EXIT`.

### 8.2 Technical Capacity and 90/10 Rule (Final Exemption Act + Sprint 10 P0)

90% of technical capacity is reserved for Long-Term GTA (exempt from auctions under the Final Exemption Act, 05.03.2019). 10% is available for public CAM NC auctions.

| Point | Tech kWh/h (100%) | LT Reserve (90%) | ST Available (10%) |
|---|---|---|---|
| Entry Kirevo | **15,280,488** | 13,752,230 | 1,528,258 |
| Exit Domestic (GMS-2/3/4) | **5,040,256** | 4,536,021 | 504,235 |
| Exit Horgoš | **10,240,233** | 9,216,209 | 1,024,024 |

> **Critical rule:** LT Reserve Entry (13,752,230) ≠ LT Reserve Exit Horgoš (9,216,209). Difference 4,536,021 kWh/h = domestic exit capacity. Billing MUST use separate cap_entry and cap_exit.

#### Available Capacity formula

```
Available = Technical − LongTerm − ShortTermSold + Surrendered
```

Auction bids are rejected (HTTP 422) if `bid.capacity > Available(10%)` per point and period.

### 8.3 Transportation Routes (NC §2.1)

| `flow_direction` code | Type | Entry → Exit | NC Ref |
|---|---|---|---|
| `KIREVO_HORGOS` | PHYSICAL | KIREVO-ENTRY → HORGOS-EXIT | §2.1 |
| `KIREVO_EXIT_SERBIA` | PHYSICAL | KIREVO-ENTRY → EXIT-SERBIA | §2.1 |
| `KIREVO_HORGOS_AND_SERBIA` | PHYSICAL | KIREVO-ENTRY → HORGOS-EXIT + EXIT-SERBIA | §2.1 |
| `HORGOS_KIREVO` | COMM. REVERSE FULL | HORGOS-ENTRY → KIREVO-EXIT | Art.6.1.2.4 |
| `EXIT_SERBIA_KIREVO` | COMM. REVERSE FULL | EXIT-SERBIA-ENTRY → KIREVO-EXIT | Art.6.1.2.4 |
| `HORGOS_EXIT_SERBIA` | COMM. REVERSE HALF | HORGOS-ENTRY → EXIT-SERBIA | Art.6.1.2 |
| `EXIT_SERBIA_HORGOS` | COMM. REVERSE HALF | EXIT-SERBIA-ENTRY → HORGOS-EXIT | Art.6.1.2 |

### 8.4 Tab 1: Bookings

Table of active capacity bookings filtered by NC IP codes. Fields: contract_no, shipper, flow_direction, cap_entry_kWh_h, cap_exit_kWh_h, period, status.

### 8.5 Tab 2: Tracker NC §2.1

Real-time load per point: technical / contracted / free capacity (kWh/h), utilization %.

### 8.6 Tab 3: RBP Offerings (NC Art.8)

Capacity offered on the Secondary Market (Surrender workflow). Lots available for purchase with reserve price.

### 8.7 Tab 4: UIOLI (NC Art.12.8)

Unnominated Annual Firm capacity per Gas Day → Within-Day Interruptible pool. Utilization by gas days (Apr 2025 actual: ~72%).

### 8.8 API Capacity

| Method | URL | Description |
|---|---|---|
| GET | `/api/v1/capacity/tracker` | Tech/contracted/free per point |
| GET | `/api/v1/capacity/rbp-offerings` | RBP offerings |
| GET | `/api/v1/capacity/uioli` | UIOLI data |
| GET | `/api/v1/capacity/routes` | NC routes from `nc_routes` table |
| GET | `/api/v1/capacity/:pointCode` | Load for specific NC-code point |
| POST | `/api/v1/capacity/surrender` | Create surrender |

---

## 9. Auctions (NC Art.7 + CAM NC EU 2017/459)

### 9.1 Auction Calendar (ENTSOG MAR0277-24)

47 auctions GY2025/2026:

| Type | Count | Schedule |
|---|---|---|
| Annual Firm | 2 | 07.07.2025 (Horgoš, Joint) |
| Quarterly | 11 | AQC-1…4 (3 months before gas quarter) |
| Monthly Firm | 24 | 3rd Monday of M-1 |
| Daily/Within-Day | templates | 4th Tuesday of M-1 (Interruptible) |

### 9.2 Bid Lifecycle

```
FREE CAPACITY → POST /auctions/bids (DRAFT)
→ POST /bids/:id/submit (SUBMITTED)
→ POST /bids/:id/result (WON / LOST)
→ POST /bids/:id/create-contract (CONTRACT_CREATED)
→ BILLING
```

### 9.3 Credit Check (NC Art.5.3.1)

Automatic credit limit check before bid submission. If insufficient — bid is rejected.

### 9.4 Reserve Price

Starting auction price = Reserve Price from AERS 05-145 (see Section 13).

---

## 10. Balance and VTP (NC Art.11, 15)

### 10.1 Daily Balance

Balance per point per Gas Day: contracted / nominated / confirmed / free / imbalance (kWh/h).

### 10.2 Imbalance Charge (NC Art.15.4)

```
ICP = |TI| × GPP   (positive imbalance)
ICN = |TI| × GPN   (negative imbalance)
```

### 10.3 VTP — Virtual Trading Point (NC Art.11)

`VTP-SERBIA` allows shippers to transfer gas rights without physical transportation. Participates in balancing.

---

## 11. System Parameters

Available to `admin` role only. Navigation: **SYSTEM → Parameters**.

### 11.1 Interconnection Points

Table of all 7 IP codes from `interconnection_points` table: code, type, NC official name, location. Read-only for all roles.

### 11.2 System Parameters

Inline editable values from `system_params` (admin only):

| Parameter | Value | Source |
|---|---|---|
| `fuel_gas_x1_pct` | 0.42 | NC Art.18, Annex 3A |
| `fuel_gas_x2_pct` | 0.08 | NC Art.18, Annex 3A |
| `euribor_6m_rate` | current % | NC Art.20.4.2 |
| `margin_call_days` | 2 | NC Art.5.5 |
| `invoice_due_days` | 30 | NC Art.20.3 |

### 11.3 API System Params

| Method | URL | Description |
|---|---|---|
| GET | `/api/v1/system-params` | All parameters |
| PATCH | `/api/v1/system-params/:key` | Update (admin only) |
| GET | `/api/v1/system-params/points` | Interconnection points |

---

## 12. Audit Log (FR-17)

Full action log for all users. Filter by module: `AUTH` · `NOM` · `CREDIT` · `BILLING` · `CONTRACTS` · `CAPACITY` · `AUCTIONS` · `SYSTEM`

Each record: CET timestamp, user, role, action, object, old_value / new_value.

`GET /api/v1/audit` — paginated list with filters.

---

## 13. AERS Tariffs GY2025/2026

Source: **AERS Decision 05-145** (17.07.2025, Gas Year 01.10.2025 – 30.09.2026)

### 13.1 Annual Capacity (EUR/kWh/h/year)

| Point | Firm | Commercial Reverse |
|---|---|---|
| Entry Point Kirevo/Zaječar | **6.00** | **2.85** |
| Domestic Exit Zone | **4.19** | **1.99** |
| Exit Point Horgoš/Kiškundorožma | **6.85** | **3.25** |

### 13.2 Quarterly Capacity (EUR/kWh/h/quarter)

| Quarter | Entry F | Dom F | Horgoš F | Entry CR | Dom CR | Horgoš CR |
|---|---|---|---|---|---|---|
| Q1 (Oct–Dec 2025) | 1.81 | 1.27 | 2.07 | 0.86 | 0.60 | 0.98 |
| Q2 (Jan–Mar 2026) | 1.78 | 1.24 | 2.03 | 0.85 | 0.59 | 0.96 |
| Q3 (Apr–Jun 2026) | 1.80 | 1.25 | 2.05 | 0.86 | 0.59 | 0.97 |
| Q4 (Jul–Sep 2026) | 1.81 | 1.27 | 2.07 | 0.86 | 0.60 | 0.98 |

### 13.3 Monthly Capacity (EUR/kWh/h/month)

| Days in Month | Entry F | Dom F | Horgoš F | Entry CR | Dom CR | Horgoš CR |
|---|---|---|---|---|---|---|
| 28 (Feb) | 0.60 | 0.42 | 0.68 | 0.29 | 0.20 | 0.32 |
| 30 days | 0.64 | 0.45 | 0.73 | 0.30 | 0.21 | 0.35 |
| 31 days | 0.66 | 0.46 | 0.76 | 0.31 | 0.22 | 0.36 |

### 13.4 Daily Capacity (EUR/kWh/h/day)

| Point | Firm | Interruptible | Commercial Reverse |
|---|---|---|---|
| Entry Kirevo | **0.0329** | 0.0329 | 0.0156 |
| Domestic Exit | **0.0230** | 0.0230 | 0.0109 |
| Exit Horgoš | **0.0375** | 0.0375 | 0.0178 |

### 13.5 Within-Day Capacity (EUR/kWh/h/hour)

| Point | Firm | Interruptible |
|---|---|---|
| Entry Kirevo | **0.0021** | 0.0021 |
| Domestic Exit | **0.0014** | 0.0014 |
| Exit Horgoš | **0.0023** | 0.0023 |

> Within-Day Commercial Reverse is NOT offered (NC Art.6.5.2).

### 13.6 Interruption Penalty (AERS item 3)

On interruption of Interruptible Daily or Within-Day: **fee × 3**.

---

## 14. Calculation Formulas (NC-reference)

### 14.1 Capacity Fee (NC Art.20 + AERS)

```
fee = cap_entry_kWh_h × tariff_entry / 365 × days
    + cap_exit_kWh_h  × tariff_exit  / 365 × days
```

### 14.2 Within-Day Fee (NC Art.6.3.1.4)

```
fee = capacity_kWh_h × price_per_hour × hours
```

### 14.3 Fuel Gas (NC Art.18.2.1)

```
FG = X1 × Q_horgos + X2 × Q_serbia − KN
```

### 14.4 Late Payment Interest (NC Art.20.4.2)

```
interest = overdue_EUR × (EURIBOR_6M + 3%) / 360 × days
```

> EURIBOR 6M (NOT 3M). 360-day basis (act/360).

### 14.5 Credit Support (NC Art.5.1.5)

```
min_credit = fee × multiplier
  Yearly:    2/12 ≈ 16.67%
  Quarterly: 2/3  ≈ 66.67%
  Monthly:   100%
  Daily:     100%
```

### 14.6 Surrender Premium (NC Art.8.3)

```
AP = (P_old − P_new) × RC × P
```

---

## 15. API Reference

Full specification: Swagger UI at `http://localhost:3000/docs`

### Summary Table (93 endpoints, api.js v2.1)

| Module | Count | Base Path | Changes |
|---|---|---|---|
| Auth | 4 | `/api/v1/auth` | |
| Users | 5 | `/api/v1/users` | |
| Shippers | 7 | `/api/v1/shippers` | +apply, +approve, +remove, +audit (Sprint 10 P1) |
| Contracts | 5 | `/api/v1/contracts` | |
| Billing | 10 | `/api/v1/billing` | +with-lines, +generate, +reserve-prices (Sprint 10 P0) |
| Credits | 14 | `/api/v1/credits` | |
| Auctions | 16 | `/api/v1/auctions` | |
| Capacity | 12 | `/api/v1/capacity` | |
| Nominations | 8 | `/api/v1/nominations` | |
| Balance | 2 | `/api/v1/balance` | |
| Audit | 1 | `/api/v1/audit` | |
| System Params | 4 | `/api/v1/system-params` | |
| ERP | 3 | `/api/v1/erp` | |
| Health | 1 | `/api/v1/health` | |

---

## 16. Security

| Requirement | Implementation | Status |
|---|---|---|
| Authentication | JWT + Argon2id hashing | ✅ |
| Authorization | RBAC middleware per-route | ✅ |
| HTTPS / Headers | Helmet + CSP (relaxed for /docs) | ✅ |
| Rate Limiting | express-rate-limit (100 req/15 min) | ✅ |
| SQL Injection | Parameterized queries (pg) | ✅ |
| XSS | Helmet CSP, Content-Type validation | ✅ |
| CORS | Whitelist origins in .env | ✅ |
| Input Validation | Joi/Zod schemas | ✅ Sprint 9 |
| OWASP Top 10 Audit | Penetration test | ✅ Sprint 9 |
| Nomination Deadline | 14:00 CET D-1 server validation | ✅ Sprint 9 |

### 16.2 NC Compliance Matrix (79%, Sprint 12)

| Chapter | Articles | ✅ | ⚠ | 🔲 | Coverage |
|---|---|---|---|---|---|
| Art.3 Access | 8 | 7 | 1 | 0 | 94% |
| Art.5 Credit | 6 | 6 | 0 | 0 | 100% |
| Art.6 Products | 5 | 5 | 0 | 0 | 100% |
| Art.7 Auctions | 8 | 8 | 0 | 0 | 100% |
| Art.8 Surrender | 2 | 2 | 0 | 0 | 100% |
| Art.10 Secondary | 3 | 1 | 0 | 2 | 33% |
| Art.11 VTP | 1 | 0 | 0 | 1 | 0% |
| Art.12 Nominations | 8 | 8 | 0 | 0 | 100% |
| Art.13 Matching | 3 | 2 | 0 | 1 | 67% |
| Art.14 Restrictions | 2 | 0 | 0 | 2 | 0% |
| Art.15 Balancing | 3 | 1 | 1 | 1 | 50% |
| Art.17 Gas Quality | 2 | 1 | 0 | 1 | 50% |
| Art.18 Fuel Gas | 3 | 3 | 0 | 0 | 100% |
| Art.20 Billing | 5 | 5 | 0 | 0 | 100% |
| Art.24 Transparency | 1 | 0 | 1 | 0 | 50% |
| **TOTAL** | **70** | **55** | **4** | **11** | **79%** |

> ⚠ = partially implemented. 🔲 = P2/P3 backlog (VTP, OTC, Matching auto, Restrictions, Gas Quality limits, Transparency portal).

---

## 17. Project Roadmap

### 17.1 Completed Sprints

| Sprint | Date | SP | Status | Key Deliverables |
|---|---|---|---|---|
| 1–3 | 03–23.03.2026 | 83 | ✅ | MVP Frontend, Dashboard, RBAC, Billing UI |
| 4 | 23.03.2026 | 54 | ✅ | Backend API, PostgreSQL, CAM NC, AERS tariffs |
| 5 | 25.03.2026 | 72 | ✅ | CAP-FIX, Gas Quality, Capacity Tracker, NC Art.5, Auctions |
| 6 | 26.03.2026 | 38 | ✅ | ERP Connector, Credit UI, Auction UI, 56/56 tests |
| 7 | 26.03.2026 | 21 | ✅ | NC route alignment (009), ncRoutes.js, CLAUDE.md |
| 8 | 26.03.2026 | 22 | ✅ | api.js v2.0 (65 methods), 10 modules wired, CORS/CSP fix |
| **9** | **27.03.2026** | **46** | **✅** | **NC Full Compliance (0 discrepancies), AERS tariffs (migration 010), KIREVO-EXIT, 101/101 tests, Over-Nomination, OWASP, Input Validation** |
| **10 P0** | **27.03.2026** | **42** | **✅** | **Invoice Line Items (9 types, migration 011), Capacity 90/10 (LT/ST split), Frontend Real Data (F-1–F-7), api.js v2.1, reserve-prices endpoint** |
| **11** | **27.03.2026** | **39** | **✅** | **Nominations 100% (NC Art.12-13), RBP Core: Mock SOAP Server, rbpClient.js, capacityUpload, creditSync, auctionSync, bundledAuction, migrations 012–013** |
| **12** | **28.03.2026** | **19** | **✅** | **RBP Secondary Market: surrenderApproval, bilateralManager, remitReporter, RBP Bridge UI (4 tabs), migration 014, rbp-mock.test.js (16 tests), 117/117** |

**Cumulative 28.03.2026: ~456 SP · 117/117 tests · NC 79% (55/70) · 93 endpoints · Migrations 001–014**

### 17.2 RBP Integration — ✅ Complete (Sprint 11–12)

**Variant B: RBP-Ready with Mock SOAP Server.** Switch to production = one env variable: `RBP_MODE=production`.

| Component | Description | Status |
|---|---|---|
| Mock SOAP Server | Node.js/Express port 8080, 11 handlers | ✅ |
| rbpClient.js | node-soap, mock/uat/prod toggle, retry ×3, timeout 30s | ✅ |
| capacityUpload.js | UploadCapacityAndTariffV4 + deadlineScheduler | ✅ |
| creditSync.js | UploadFinanceCreditV3, GetCreditLimits, UploadCreditRelease | ✅ |
| auctionSync.js | GetAuctionsV5 (5 min), GetTradesV4 (2 min) | ✅ |
| bundledAuction.js | «One auction – two contracts», bundle_id | ✅ |
| surrenderApproval.js | ApproveSurrenderedCapacityDeal (NC Art.8) | ✅ |
| bilateralManager.js | CreateBilateralDealV4, OTC lifecycle | ✅ |
| remitReporter.js | UploadRemitReport → ACER via RBP as RRM | ✅ |
| RBP Bridge UI | 4 tabs: Status, Auctions, Bilateral, Sync Log | ✅ |
| rbp-mock.test.js | 16 tests — 11 SOAP methods, bundled, full cycle | ✅ |

**Bundled Auction:** shipper submits 1 bid on HORGOS-EXIT → RBP creates 2 contracts: `GTA-GASTRANS` (tariff 6.85) + `GTA-FGSZ`, linked by `bundle_id`. KIREVO-ENTRY is NOT bundled (Bulgartransgaz not on RBP).

**Variant B covers 14/20 gaps.** Remaining P2/P3: G-01 (FGSZ TSO Member registration), AS4, Comfort Bidding, Buyback, LPFS.

### 17.3 MVP Backlog (P2/P3)

| Gap | Area | Priority |
|---|---|---|
| G-01 | TSO Member registration at FGSZ (organizational) | P2 |
| G-02 | Real SSL certificate for RBP production | P2 |
| Art.11 | VTP — Virtual Trading Point full cycle | P3 |
| Art.10 | OTC Secondary Market full matching | P3 |
| Art.14 | Restrictions (congestion management) | P3 |
| Art.24 | Transparency portal (ENTSO-G) | P3 |
| AS4 | ENTSOG message exchange standard | P3 |

---

## Glossary

| Term | Definition | NC Ref |
|---|---|---|
| **Gas Day** | 06:00 CET → 06:00 CET next day | §2.1 |
| **Gas Year** | 01 October → 01 October | §2.1 |
| **Gas Quarter** | 3 months from October, January, April, July | §2.1 |
| **Contracted Capacity** | Maximum capacity kWh/h at a point | §2.1 |
| **Technical Capacity** | Maximum Firm Capacity (physical limit) | §2.1 |
| **Available Capacity** | Technical − Contracted + Surrendered | §2.1 |
| **Reserve Price** | Auction starting price, set by AERS | Art.7 |
| **Auction Price** | Price at which capacity is contracted | Art.7 |
| **Bundled Capacity** | Simultaneous entry+exit offering with Adjacent TSO | Art.7.2 |
| **Commercial Reverse Flow** | Virtual (non-physical) reverse | §2.1 |
| **Credit Support** | Financial collateral: bank guarantee or deposit | Art.5 |
| **Margin Call** | Requirement to replenish collateral, deadline = 2 Business Days | Art.5.5 |
| **Nomination** | Notification of planned volumes for Gas Day, kWh/h | Art.12 |
| **Confirmed Quantity** | Confirmed volume = min(Entry nom, Exit nom) | Art.13 |
| **Fuel Gas** | Gas for compressors and preheating | Art.18 |
| **Imbalance Charge** | Penalty for entry vs exit imbalance per Gas Day | Art.15 |
| **Surrender** | Releasing contracted capacity for resale at auction | Art.8 |
| **UIOLI** | Use-It-Or-Lose-It: unnominated capacity → Within-Day Interruptible | Art.12.8 |
| **Over-Nomination** | Within-Day Interruptible via over-nomination when Firm fully contracted | Art.12.8 |
| **VTP** | Virtual Trading Point — gas rights transfer between shippers | Art.11 |
| **AERS** | Energy Agency of the Republic of Serbia | — |
| **CAM NC** | Capacity Allocation Mechanisms Network Code (EU 2017/459) | — |
| **GTA** | Gas Transportation Agreement (Short-Term / Long-Term) | §2.1 |
| **TSO** | Transmission System Operator (= Gastrans) | §2.1 |
| **RBP** | Regional Booking Platform (operated by FGSZ Ltd.) — SOAP-based capacity auction platform | Art.3.2 |
| **Bundled Capacity** | Joint entry+exit offering by two TSOs at one IIP — one bid creates two contracts | Art.7.2 |
| **EIC Code** | Energy Identification Code — 21-character identifier for TSOs and shippers | EASEE-gas |
| **REMIT** | Regulation on Wholesale Energy Market Integrity and Transparency — reporting to ACER | NC Art.3.6 |
| **Long-Term GTA** | Gas Transportation Agreement exempt from third-party access (Final Exemption Act, 90% capacity) | Final Exemption Act |
| **Short-Term GTA** | Gas Transportation Agreement through public CAM NC auctions (10% capacity) | NC Art.6 |
| **URDG 758** | Uniform Rules for Demand Guarantees (ICC) | Art.5 |

---

*GTCP UserGuide v3.0 · 27.03.2026 · Sources: NC Gastrans (03.04.2020), AERS 05-145 (17.07.2025), Sprint 1–10 P0 implementation · Т�