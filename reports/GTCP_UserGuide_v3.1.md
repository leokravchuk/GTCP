# GTCP — User Guide / Руководство пользователя

**Gas Trading & Commercial Platform · v3.2 · Sprint 13**
Обновлено: 30.03.2026 · Gastrans d.o.o. Novi Sad, Serbia
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
| Тесты | — | **442/442** passing (Sprint 13, ~95% coverage) |

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

#### Схема архитектуры

```
+-------------------------------------------------------+
|                    GTCP Platform                       |
+-------------------------------------------------------+
|                                                        |
|  +-------------+    REST API     +----------------+    |
|  |  Frontend   | <=============> |    Backend     |    |
|  | GTCP_MVP    |   api.js v2.1   |  Express.js    |    |
|  |  .html      |   93 endpoints  |  Node.js 20    |    |
|  | Vanilla JS  |                 |                |    |
|  | Single SPA  |                 +-------+--------+    |
|  +-------------+                         |             |
|                                    +-----v------+      |
|                                    | PostgreSQL |      |
|                                    |   17.x     |      |
|                                    | 14 tables  |      |
|                                    +-----+------+      |
|                                          |             |
|  +------------------+   SOAP/HTTPS  +----v-------+     |
|  | RBP.EU (FGSZ)   | <==========>  | RBP Bridge |     |
|  | Regional Booking |  EDIGAS v5.1  | Variant B  |     |
|  | Platform         |  XML          | mock/uat/  |     |
|  +------------------+               | production |     |
|                                     +------------+     |
|  +------------------+   REST/HTTPS                     |
|  | 1С ERP (Gastrans)| <===> erp-connector.js           |
|  +------------------+       mock/production            |
+-------------------------------------------------------+
```

### 1.4 Поддерживаемые нормативные акты

| Нормативный акт | Область применения | Статус |
|---|---|---|
| **Gastrans Network Code** (03.04.2020, 111 стр.) | Все операции | Binding — authoritative source of truth |
| **АЕРС Decision 05-145** (17.07.2025) | Тарифы GY2025/2026 | Reserve Prices (полная таблица — раздел 13) |
| **CAM NC** EU 2017/459 | Аукционы мощности | Ascending clock + Uniform price |
| **ENTSOG MAR0277-24** (07.10.2024) | Расписание аукционов | 47 аукционов GY2025/2026 |

> **Правило приоритета:** NC > АЕРС > CAM NC > код. При расхождении — код исправляется под NC.

### 1.5 Поток данных в системе

```
Регистрация шиппера (NC Art.3)
         |
         v
  [APPLICANT] --одобрение--> [ACTIVE]
         |                       |
         |              +--------+--------+
         |              |                 |
         v              v                 v
  Кредитная         Контракт         Бронирование
  поддержка        (NC Art.6)        мощности
  (NC Art.5)            |                 |
         |              +---------+-------+
         |                        |
         v                        v
  Номинация               Аукцион (NC Art.7)
  (NC Art.12)                     |
         |                        v
         v                   RBP-синхронизация
  Матчинг (NC Art.13)             |
         |                        |
         +------------+-----------+
                      |
                      v
              Биллинг (NC Art.20)
              Постатейные счета
                      |
                      v
              Оплата / Штрафные проценты
              (EURIBOR 6M + 3%)
```

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

Текущий результат (Sprint 13, 30.03.2026):

```
Test Suites: 25 passed, 25 total
Tests:       442 passed, 442 total
Coverage:    ~95% lines
```

Sprint 12 (6 suites, 117 тестов): `billing` — 18 · `credits` — 21 · `auctions` — 17 · `nc-routes` — 21 · `tariffs` — 24 · `rbp-mock` — 16.

Sprint 13 (+19 suites, +325 тестов): NC compliance regression (79), integration (281), unit billing (76), real-DB nominations (6). Подробнее — §18.

> **Sprint 9:** Добавлены `nc-routes.test.js` и `tariffs.test.js`. Миграция 010 (`reserve_prices`, 57 тарифов АЕРС), KIREVO-EXIT. 11 NC-расхождений → 0. **Sprint 10 P0:** Миграция 011 (`invoice_line_items`, `capacity_category`). **Миграции 012–014:** `shipper_registration`, `nominations_kwh_h`, `rbp_tables`. **Sprint 12:** Добавлен `rbp-mock.test.js` (16 тестов). **Sprint 13:** +19 test suites, покрытие ~95%, migration 000 (consolidated) + 015 (views), CI/CD, 3 bug fix.

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

### 4.2 Дедлайн подачи (NC Art.12.6.1.1)

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

Статус меняется: `CONFIRMED` → `RENOM_PENDING`. Endpoint: `POST /api/v1/nominations/:id/renominate`.

#### Правила ограничения реноминации (Sprint 11, N-8)

NC Art.12.7.5 устанавливает **4 правила** в зависимости от текущей загрузки:

| Текущая утилизация | Направление | Максимальное изменение |
|---|---|---|
| 0 – 80% contracted | вверх (increase) | до **90%** contracted |
| 80 – 100% contracted | вверх (increase) | до **половины** свободной мощности |
| 20 – 100% contracted | вниз (decrease) | не более **10%** contracted |
| ≤ 20% contracted | вниз (decrease) | до **половины** текущего объёма |

> ⚠ Описание "±10%" — неполное и применимо только к частному случаю. Используйте таблицу выше.

#### Панель баланса Entry/Exit (Sprint 11, N-2/N-6)

Фронтенд отображает **Balance panel** под формой номинации:

```
Entry total:  [сумма кВтч/ч по Entry-точкам]
Exit total:   [сумма кВтч/ч по Exit-точкам]
Difference:   [Entry − Exit]
```

- При `diff > 0` показывается подсказка: _«Excess Entry X kWh/h needs EXIT-SERBIA nomination or VTP trade»_
- При `diff < 0`: _«Entry deficit — add KIREVO-ENTRY or reduce exit»_
- Реализовано: `_balanceWarning` в response `POST /nominations`, отображается в UI как предупреждение

### 4.5 Over-Nomination (NC Art.12.8)

При полной подписке Firm Capacity шиппер может подать **Over-Nomination** — заявку сверх Contracted Capacity, excess идёт в Within-Day Interruptible pool.

**Логика Sprint 11 (N-4):**
1. Система проверяет `Nominated ≤ Contracted Capacity` (SELECT из capacity_bookings)
2. Если `nominated > CC`: не отклоняет — помечает `over_nomination = true`, `excess_kwh_h = nominated − CC`
3. Excess обрабатывается как **Interruptible**, если есть свободная мощность в UIOLI-пуле
4. Если Firm полностью подписана И нет свободной мощности → возврат `422`

- Endpoint: `POST /api/v1/nominations/:id/over-nominate`
- Штраф при прерывании: fee × **3** (АЕРС п.3)

### 4.6 EDIGAS NOMINT XML (v5.1)

Полная реализация EDIGAS v5.1 NOMINT (Sprint 14):

`GET /api/v1/nominations/:id/edigas-nomint` — возвращает XML

**Поля документа:**

| Поле | Значение |
|------|---------|
| DocumentType | `01G` (Nomination) / `P03` (Renomination) |
| SenderIdentification | Shipper EIC (codingScheme=305) |
| SenderRole | `ZSH` (Shipper) |
| ReceiverIdentification | `21X-RS-GASTRANS-0` (TSO) |
| ReceiverRole | `ZSO` (System Operator) |
| Direction | `Z02` (Entry) / `Z03` (Exit) |
| Quantity | kWh/h (hourly rate, NC Art.12.1) |
| GasDay | Local date (не UTC!) |
| TimeInterval | `GasDay T04:00Z / NextDay T04:00Z` (CEST) |
| NominationCycle | 0 = initial, 1+ = renomination |

В интерфейсе: кнопка **«XML»** на строке подтверждённой номинации → popup с полным EDIGAS v5.1 XML.

**NOMRES** (подтверждение от TSO): `buildNomres()` — mock, возвращает `CONFIRMED` + confirmed quantity.

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

#### Дерево решений по типу продукта

```
  Строка счёта (Invoice Line Item)
        |
        v
  Тип продукта?
        |
  +-----+-------+-------+-------+----------+
  |     |       |       |       |          |
  v     v       v       v       v          v
ANNUAL QRTLY  MNTHLY  DAILY  W/DAY    SPECIAL
  |     |       |       |       |          |
  v     v       v       v       v          v
cap×T  cap×T   cap×T   cap×T  cap×T    (см.ниже)
/365   /Qd     ×1      ×days  ×hours
×days  ×days
  |     |       |       |       |
  +-----+-------+-------+-------+
        |
        v
  Qd = дней в квартале:
  Q1(окт-дек)=92, Q2(янв-мар)=90
  Q3(апр-июн)=91, Q4(июл-сен)=92
        |
        v
  SPECIAL типы:
  - FUEL_GAS:          X1×Q_horgos + X2×Q_serbia − KN
  - LATE_PAYMENT:      amount × (EURIBOR_6M+3%) / 360 × days
  - INTERRUPTION:      capacity_fee × 3  (АЕРС п.3)
  - AUCTION_PREMIUM:   (P_ауц − P_рез) × cap × hours
  - IMBALANCE:         |TI| × GPP  или  |TI| × GPN
```

#### Period-aware формулы по типу продукта (NC Art.20 + АЕРС 05-145)

> **Критически важно:** единица тарифа зависит от типа продукта. Делить на 365 нужно **только для Annual**.

| Тип продукта | Единица тарифа | Формула для одной точки | NC / АЕРС |
|---|---|---|---|
| `FIRM_YEARLY` / `COMM_REV_YEARLY` | EUR/kWh/h/**year** | `cap × T / 365 × days_in_month` | Art.6.1.2.1 |
| `FIRM_QUARTERLY` / `COMM_REV_QUARTERLY` | EUR/kWh/h/**quarter** | `cap × T / days_in_quarter × days_in_month` | Art.6.3.1.1 |
| `FIRM_MONTHLY` / `COMM_REV_MONTHLY` | EUR/kWh/h/**month** | `cap × T × 1` ← **НЕ делить!** | Art.6.3.1.2 |
| `FIRM_DAILY` / `COMM_REV_DAILY` | EUR/kWh/h/**day** | `cap × T × days_in_month` | Art.6.3.1.3 |
| `FIRM_WITHIN_DAY` | EUR/kWh/h/**hour** | `cap × T × hours` ← **НЕ делить на 365!** | Art.6.3.1.4 |

Дни в квартале: Q1(окт–дек)=92, Q2(янв–мар)=90, Q3(апр–июн)=91, Q4(июл–сен)=92.

**Monthly тариф уже выражен за месяц** — дополнительное деление на длину месяца приведёт к ошибке.

**Полная формула счёта** — entry и exit всегда раздельно:

```
invoice_total = entry_fee(cap_entry, tariff_entry, product_type)
              + exit_fee(cap_exit,  tariff_exit,  product_type)
```

```
ПРАВИЛЬНО (раздельный entry/exit):
  fee = cap_entry_kWh_h × tariff_entry / 365 × days
      + cap_exit_kWh_h  × tariff_exit  / 365 × days
  (формула выше — только для ANNUAL; для других типов — см. таблицу)

НЕПРАВИЛЬНО (не использовать!):
  fee = capacity × (tariff_entry + tariff_exit) / 365 × days
  ↑ Ошибка 1: единая мощность — cap_entry ≠ cap_exit для Gastrans
  ↑ Ошибка 2: /365 — только для Annual продуктов
```

> Причина: техническая мощность Entry Kirevo ≠ Exit Horgoš. Разница уходит в domestic exit zone — биллинг обязан использовать раздельные cap_entry и cap_exit.

#### Биллинг для Commercial Reverse (COMM_REV)

При COMM_REV-маршрутах направление точек меняется — тарифы ниже физических:

| Маршрут | Entry | Exit | Тариф Entry (Annual) | Тариф Exit (Annual) |
|---|---|---|---|---|
| KIREVO→HORGOS (Physical) | KIREVO | HORGOS | 6.00 | 6.85 |
| HORGOS→KIREVO (Full Rev A) | HORGOS | KIREVO | **3.25** | **2.85** |
| EXIT-SERBIA→KIREVO (Full Rev B) | EXIT-SERBIA | KIREVO | **1.99** | **2.85** |
| HORGOS→EXIT-SERBIA (Half Rev A) | HORGOS | EXIT-SERBIA | **3.25** | **1.99** |

Формула идентична — меняются только точки и тарифы (из таблицы АЕРС §13).

### 6.3 Within-Day Fee (NC Art.6.3.1.4)

```
fee = capacity_kWh_h × price_per_hour × number_of_hours
```

> **Не делить на 365.** Тариф Within-Day уже выражен в EUR/kWh/h/**hour**. Within-Day Commercial Reverse не предлагается (NC Art.6.5.2).

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
| `CAPACITY` | **period-aware** — см. таблицу §6.2: YEARLY: `cap×T/365×days`; QUARTERLY: `cap×T/Qd×days`; MONTHLY: `cap×T×1`; DAILY: `cap×T×days` | Art.20.3.2.1 |
| `CAPACITY_WITHIN_DAY` | `cap_kWh_h × tariff_per_hour × hours` (не делить на 365!) | Art.6.3.1.4 |
| `FUEL_GAS` | `X1×Q_horgos + X2×Q_serbia − KN` | Art.18 |
| `TRANSFER` | **period-aware** — применяется та же таблица §6.2 по типу продукта | Art.10.3 |
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

#### Пример верификации (реальные данные, 31 день, **FIRM_YEARLY**, KIREVO→HORGOS)

> ⚠ Формула `/365 × days` применима **только для FIRM_YEARLY**. Для других типов — см. §6.2.

```
FIRM_YEARLY (Annual tariff = EUR/kWh/h/year):
CAPACITY ENTRY: cap_entry_kWh_h × 6.00 / 365 × 31 = [рассчитывается системой]
CAPACITY EXIT:  cap_exit_kWh_h  × 6.85 / 365 × 31 = [рассчитывается системой]
FUEL_GAS (auto): Q_exit_kWh × 0.0325               = [рассчитывается системой]
                                              TOTAL: [рассчитывается системой]
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
POST /shippers/apply        → APPLICANT
PATCH /shippers/:id/approve → APPROVED → ACTIVE
PATCH /shippers/:id/suspend → SUSPENDED
PATCH /shippers/:id/reactivate → ACTIVE
PATCH /shippers/:id/remove  → (проверки) → REMOVED
```

| Статус | Описание | UI badge |
|---|---|---|
| `APPLICANT` | Заявка подана, ждёт рассмотрения | Жёлтый |
| `APPROVED` | Одобрен, подписывает GEDP + Balancing Agreement | Синий |
| `ACTIVE` | Активный участник — может номинировать и торговать | Зелёный |
| `SUSPENDED` | Заблокирован (нарушение кредита / регуляторное) — номинации и торговля недоступны | Оранжевый |
| `REMOVED` | Отозван (NC Art.3.7) | Красный |

#### Переходы между статусами

| От | К | Условие |
|---|---|---|
| `APPLICANT` | `APPROVED` | Документы проверены |
| `APPROVED` | `ACTIVE` | Кредитная поддержка предоставлена |
| `ACTIVE` | `SUSPENDED` | Нарушение кредитного лимита / регуляторное решение |
| `SUSPENDED` | `ACTIVE` | Проблема устранена (реактивация) |
| `ACTIVE` | `REMOVED` | `contracted_capacity = 0` + `outstanding_debt = 0` |
| `APPLICANT` | `REMOVED` | Заявка отклонена |

Каждый переход логируется в `shipper_changes` (audit trail): `field_name`, `old_value`, `new_value`, `reason`.

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

#### Карта точек подключения (NC §2.1)

```
                   БОЛГАРИЯ
                      |
           [KIREVO-ENTRY] ---- Entry Point Kirevo/Zajecar
                      |         Тариф: 6.00 EUR/kWh/h/год
                      |
         =============|============= ТРУБОПРОВОД GASTRANS (TurkStream)
                      |
             +--------+--------+
             |                 |
   [EXIT-SERBIA]         [HORGOS-EXIT]
   Exit Domestic          Exit Horgos/Kiskundorozsma
   Тариф: 4.19             Тариф: 6.85
             |                 |
    +--------+--------+       |
    |        |        |       |
  GMS-2   GMS-3   GMS-4   ВЕНГРИЯ (FGSZ)
 Pančevo Paraćin Gospođinci

  Коммерческий реверс (виртуальный):
  HORGOS-ENTRY -------> KIREVO-EXIT  (Full Reverse A)
  EXIT-SERBIA-ENTRY --> KIREVO-EXIT  (Full Reverse B)
  HORGOS-ENTRY -------> EXIT-SERBIA  (Half Reverse A)
  EXIT-SERBIA-ENTRY --> HORGOS-EXIT  (Half Reverse B)
```

### 8.2 Технические мощности и правило 90/10 (Final Exemption Act + Sprint 10 P0)

90% технической мощности закреплено за Long-Term GTA (освобождены от аукционов по Final Exemption Act, 05.03.2019). 10% — доступно на публичных аукционах CAM NC.

| Точка | Tech (100%) | LT Reserve (~90%) | ST Available (~10%) |
|---|---|---|---|
| Entry Kirevo | cap_entry_tech | ~90% (cap_entry_lt) | ~10% (cap_entry_st) |
| Exit Domestic (GMS-2/3/4) | cap_domestic_tech | ~90% (cap_domestic_lt) | ~10% (cap_domestic_st) |
| Exit Horgoš | cap_horgos_tech | ~90% (cap_horgos_lt) | ~10% (cap_horgos_st) |

> **Критическое правило:** LT Reserve Entry (cap_entry_lt) ≠ LT Reserve Exit Horgoš (cap_horgos_lt). Разница = cap_domestic_lt = domestic exit capacity. Биллинг использует раздельные cap_entry и cap_exit.

#### Диаграмма распределения мощности 90/10

```
  ТЕХНИЧЕСКАЯ МОЩНОСТЬ (сертифицирована АЕРС) — 100%
  =======================================================

  Точка | [========== 90% LT Reserve ===========][= 10% ST =]
  -------+--------------------------------------------------
  Entry  | [Long-Term GTA, Final Exemption Act   ][Аукционы ]
  Horgos | [Long-Term GTA, Final Exemption Act   ][Аукционы ]
  Domest.| [Long-Term GTA, Final Exemption Act   ][Аукционы ]

  ST (10%) делится на:
  +----------+     +---------+     +-------------+
  |  ПРОДАНО |     |  FREE   |     |    UIOLI    |
  | (на ауке)|     |(на ауке)|     |(нераспроданн|
  |          |     |         |     | → WD Intrrp)|
  +----------+     +---------+     +-------------+

  ! ВАЖНО: LT Reserve Entry ≠ LT Reserve Exit Horgoš
           Разница = cap_domestic_lt (domestic exit zone)
           Биллинг: всегда раздельно cap_entry и cap_exit!
```

#### Формула Available Capacity

```
Available = Technical − LongTerm − ShortTermSold + Surrendered
```

#### Capacity Tracker (Sprint 10 P0) — 7 колонок

Трекер показывает: Tech 100% / LT Reserve ~90% / ST Available ~10% / ST Sold / ST Free.
Аукционная заявка отклоняется (HTTP 422) если `bid.capacity > Available(~10%)` по точке и периоду.

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

#### Схема маршрутов (NC §2.1)

```
  Физический поток (Болгария → Сербия/Венгрия):
  ================================================
  R1: KIREVO-ENTRY  ------>  HORGOS-EXIT         (Транзит)
  R2: KIREVO-ENTRY  ------>  EXIT-SERBIA          (Внутренний)
  R3: KIREVO-ENTRY  ------>  HORGOS + SERBIA      (Комбинир.)

  Коммерческий реверс (виртуальный):
  ================================================
  R4: HORGOS-ENTRY  ------>  KIREVO-EXIT          (Full Rev A)
  R5: EXIT-SERBIA-ENTRY -->  KIREVO-EXIT          (Full Rev B)
  R6: HORGOS-ENTRY  ------>  EXIT-SERBIA          (Half Rev A)
  R7: EXIT-SERBIA-ENTRY -->  HORGOS-EXIT          (Half Rev B)

  Устаревшие (только для совместимости БД):
  ================================================
  L1: GOSPODJINCI_HORGOS    (→ использовать R6/R7)
  L2: HORGOS_GOSPODJINCI    (→ использовать R6/R7)
```

### 8.4 Таб 1: Бронирования

Таблица активных capacity bookings с фильтром по NC-точкам (`KIREVO-ENTRY`, `HORGOS-EXIT`, `EXIT-SERBIA`). Поля: contract_no, shipper, flow_direction, cap_entry_kWh_h, cap_exit_kWh_h, period, status.

### 8.5 Таб 2: Трекер NC §2.1

Загрузка по каждой точке в реальном времени:
- **Technical capacity** — cap_entry_tech / cap_domestic_tech / cap_horgos_tech (по точкам)
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

### 8.8 Available Capacity Engine (NC Art.7.1.1)

Доступная мощность рассчитывается **в реальном времени** при каждом запросе (Option A: Real-time SQL).

**Формулы (NC Art.7.1.1 + Art.7.3):**

| Тип | Формула | NC Art. |
|-----|---------|---------|
| Firm ST (Quarterly/Monthly) | Tech - Contracted + Surrendered | 7.1.1.1-7.1.1.2 |
| Firm ST (Daily) | Tech - Contracted + Surrendered + Non-nominated | 7.1.1.3 |
| Firm ST (Within-Day) | Tech - Contracted + Surrendered + Non-nominated (per hour) | 7.1.1.4 |
| CR | Total Contracted Physical - CR Already Contracted | 7.3.2-7.3.5 |
| Yearly Firm | Surrendered LT only (0 если нет surrender) | 7.1.2 |

**Частота обновления:**

| Что | Частота | NC Art. |
|-----|---------|---------|
| Available Credit | Каждый час | 5.3.4 |
| Available Capacity | При каждом запросе (real-time SQL) | 7.1.1 |
| Non-nominated | После 14:00 CET D-1 | 12.7.5 |

`GET /api/v1/capacity/available` — возвращает physical (3 IP) + CR (3 IP) с breakdown: tech, contracted, LT, ST, surrendered, non-nominated, available.

### 8.9 API Capacity

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/v1/capacity` | Сводка по всем точкам |
| GET | `/api/v1/capacity/available` | **Available Capacity (real-time)** |
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

### 9.1 Расписание аукционов GY2025/2026

**Источник:** MAR0277-24 ENTSOG Auction Calendar (Final, 07.10.2024)
**Правовая основа:** NC Gastrans Art. 7.4

#### 9.1.1 Публикация аукционов на RBP (CAM NC practice)

NC Gastrans Art.7.4.1: Transporter публикует аукцион на Capacity Booking Platform (RBP.EU) с информацией: (i) Available Capacity, (ii) Reserve Price, (iii) price steps. Конкретные сроки публикации определяются CAM NC (EU 2017/459). Из MAR0277-24:

| Продукт | Публикация на RBP | Пример GY2025/2026 |
|---------|-------------------|-------------------|
| Yearly | ~4 недели до аукциона | Publish 07.06.2025, Auction 07.07.2025 |
| Quarterly | ~2 недели до аукциона | Publish 21.07.2025, Auction 04.08.2025 |
| Monthly | ~1 неделя до аукциона | Publish 09.02.2026, Auction 16.02.2026 |
| Daily | В тот же день (D-1) | Publication = Auction start |
| Within-Day | Непрерывно | Нет отдельной публикации |

Art.7.4.7: Публикация аукциона имеет юридический эффект "приглашения подать оферту" (Art.35 Закона о договорах Сербии).

#### 9.1.2 Yearly Firm (Art. 7.4.2.1)

> **NC Art. 7.1.2 (КРИТИЧНО):** Yearly Firm проводится **только** если LT мощность освободилась (surrender Art.8 или прекращение Long-Term GTA). ST 10% мощность на yearly аукционе **НЕ продаётся**. Если все LT контракты действуют — аукцион не проводится.

| Параметр | Значение |
|----------|---------|
| Расписание | 1st Monday of July |
| Дата GY2025/2026 | **07.07.2025** |
| Публикация на RBP | **07.06.2025** (~4 недели) |
| Время подачи заявок | 09:00-18:00 CET |
| Delivery | 01.10.2025-01.10.2026 |
| Алгоритм | Ascending clock (Art. 7.6.5) |
| Текущий статус | CLOSED - no LT surrendered |

#### 9.1.3 Quarterly Firm (Art. 7.4.2.2)

4 раунда в год. ST 10% мощность продаётся здесь (Art. 7.1.1.1).

Available Capacity = Technical - Total Contracted + Surrendered (Art. 7.1.1.1)

| Round | Дата аукциона | Публикация | Правило | Q1 Oct-Dec | Q2 Jan-Mar | Q3 Apr-Jun | Q4 Jul-Sep |
|-------|-------------|-----------|---------|-----------|-----------|-----------|-----------|
| **1st** | **04.08.2025** | 21.07.2025 | 1st Mon Aug | 1.81 | 1.78 | 1.80 | 1.81 |
| **2nd** | **03.11.2025** | 20.10.2025 | 1st Mon Nov | - | 1.78 | 1.80 | 1.81 |
| **3rd** | **02.02.2026** | 19.01.2026 | 1st Mon Feb | - | - | 1.80 | 1.81 |
| **4th** | **04.05.2026** | 20.04.2026 | 1st Mon May | - | - | - | 1.81 |

Время: 09:00-18:00 CET. Ascending clock. Reserve prices: EUR/kWh/h/quarter (Entry Kirevo).

#### 9.1.4 Monthly Firm (Art. 7.4.2.3)

3rd Monday of M-1. Публикация ~1 неделя до аукциона. Время: 09:00-18:00 CET.

| Delivery | Auction Date | Publish | Days | Entry | Horgos | Serbia |
|----------|-------------|---------|------|-------|--------|--------|
| Oct 2025 | **15.09.2025** | 08.09 | 31 | 0.66 | 0.76 | 0.46 |
| Nov 2025 | **20.10.2025** | 13.10 | 30 | 0.64 | 0.73 | 0.45 |
| Dec 2025 | **17.11.2025** | 10.11 | 31 | 0.66 | 0.76 | 0.46 |
| Jan 2026 | **15.12.2025** | 08.12 | 31 | 0.66 | 0.76 | 0.46 |
| Feb 2026 | **19.01.2026** | 12.01 | 28 | 0.60 | 0.68 | 0.42 |
| Mar 2026 | **16.02.2026** | 09.02 | 31 | 0.66 | 0.76 | 0.46 |
| Apr 2026 | **16.03.2026** | 09.03 | 30 | 0.64 | 0.73 | 0.45 |
| May 2026 | **20.04.2026** | 13.04 | 31 | 0.66 | 0.76 | 0.46 |
| Jun 2026 | **18.05.2026** | 11.05 | 30 | 0.64 | 0.73 | 0.45 |
| Jul 2026 | **15.06.2026** | 08.06 | 31 | 0.66 | 0.76 | 0.46 |
| Aug 2026 | **20.07.2026** | 13.07 | 31 | 0.66 | 0.76 | 0.46 |
| Sep 2026 | **17.08.2026** | 10.08 | 30 | 0.64 | 0.73 | 0.45 |

Reserve prices: EUR/kWh/h/month (AERS 05-145). Monthly tariff = за весь месяц, НЕ делить на дни.

#### 9.1.5 Daily Firm (Art. 7.4.2.4)

| Параметр | Значение |
|----------|---------|
| Расписание | Каждый день, D-1 |
| Время подачи заявок | **16:30-17:00 CET** |
| Delivery | Следующий Gas Day (06:00 CET - 06:00 CET) |
| Алгоритм | Uniform price (Art. 7.6.14) |
| Reserve price | Entry 0.0329, Horgos 0.0375, Serbia 0.0230 EUR/kWh/h/day |

#### 9.1.6 Within-Day Firm (Art. 7.4.2.5)

**Within-Day - это НЕ разовый аукцион.** Это непрерывная серия аукционов каждый час в течение Gas Day.

| Параметр | Значение |
|----------|---------|
| Расписание | **Непрерывно**, каждый час |
| Первый аукцион | После публикации результатов Daily (или Interruptible Daily) |
| Bid window | **30 минут** |
| Что предлагается | Первый аукцион: все 24 часа. Далее: от (текущий час + 4ч) до конца Gas Day |
| Последний аукцион | 01:00-01:30 CET Gas Day (последний час) |
| Reserve price | Entry 0.0021, Horgos 0.0023, Serbia 0.0014 EUR/kWh/h/**hour** |
| CR | **Не предлагается** (NC Art. 6.5.2) |
| Формула fee | capacity x hourly_price x hours. **НЕ делить на 365** |

#### 9.1.7 Commercial Reverse (Art. 7.4.3)

| Product | Расписание (NC Art.) | Время | Дата GY2025/2026 |
|---------|---------------------|-------|-----------------|
| CR Yearly | 3rd Monday July (7.4.3.1) | 09:00-18:00 CET | **21.07.2025** |
| CR Quarterly | 1st Mon Sep/Dec/Mar/Jun (7.4.3.2) | 09:00-18:00 CET | 01.09 / 01.12 / 02.03 / 01.06 |
| CR Monthly | 4th Tuesday M-1 (7.4.3.3) | 09:00-18:00 CET | Per month |
| CR Daily | Every day D-1 (7.4.3.4) | **17:30-18:00 CET** | Daily |

CR Available = Total Contracted в Physical Direction - уже законтрактованные CR (Art. 7.3.2-7.3.5)

#### 9.1.8 Interruptible (Art. 7.4.4-7.4.5)

| Product | Расписание | Время | Условие |
|---------|-----------|-------|---------|
| Int. Daily | Every day D-1 (7.4.4) | **17:30-18:00 CET** | Art. 7.1.3 conditions met |
| Int. Within-Day | Hourly (7.4.5) | After Firm W/D results | Via Over-Nomination Art. 12.8 |

#### 9.1.9 Хронология типичного дня (D-1 - Gas Day)

```
D-1  14:00 CET  Nomination deadline (NC Art. 12.6.1.1)
D-1  16:30 CET  Daily Firm auction opens (Art. 7.4.2.4)
D-1  17:00 CET  Daily Firm auction closes
D-1  17:30 CET  CR Daily + Interruptible Daily opens (Art. 7.4.3.4 + 7.4.4)
D-1  18:00 CET  CR Daily + Interruptible closes
D-1  ~18:30 CET Results published
D-1  ~19:00 CET First Within-Day auction starts (Art. 7.4.2.5)
D-1  ~19:30 CET First W/D bids close (30min window)
     ...        Hourly W/D auctions continue
GD   06:00 CET  Gas Day starts
     ...        W/D auctions every hour (current+4h -> end of GD)
GD   01:00 CET  Last W/D auction (01:00-01:30 CET)
GD   06:00 CET  Gas Day ends
```

### 9.2 Bid Lifecycle

```
FREE CAPACITY -> POST /auctions/bids (DRAFT)
-> POST /bids/:id/submit (SUBMITTED)
-> POST /bids/:id/result (WON / PARTIALLY_WON / LOST)
-> POST /bids/:id/create-contract (CONTRACT_CREATED)
-> BILLING
```

### 9.3 Credit Check (NC Art.5.3.1)

Перед подачей заявки - автоматическая проверка доступного кредитного лимита. При нехватке - заявка отклоняется.

| Продукт | Множитель | Available Credit |
|---------|----------|-----------------|
| Yearly | 2/12 | Credit Limit x 12/2 |
| Quarterly | 2/3 | Credit Limit x 3/2 |
| Monthly / Daily / W-D | 100% | Credit Limit |

Exempt шипперы (BBB- / Baa3 / CR<=235) - без ограничений (Art. 5.3.5).

### 9.4 Reserve Price

Стартовая цена аукциона = Reserve Price из AERS 05-145 (см. раздел 13). При ascending clock - цена растёт от Reserve Price. При uniform price (Daily/W-D) - все победители платят одну цену.

### 9.5 Capacity Split 90/10 (AERS)

| IP | Direction | Tech kWh/h | LT 90% | ST 10% (auctions) |
|---|---|---|---|---|
| KIREVO-ENTRY | ENTRY | 15,280,488 | 13,752,439 | 1,528,049 |
| HORGOS-EXIT | EXIT | 10,240,233 | 9,216,210 | 1,024,023 |
| EXIT-SERBIA | EXIT | 5,040,256 | 4,536,230 | 504,026 |

NC Art. 7.1.2: Yearly auction = ONLY surrendered LT. ST 10% sold via Quarterly/Monthly/Daily/W-D (Art. 7.1.1).

### 9.6 API Auctions

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/v1/auctions` | Список аукционов (с пагинацией) |
| GET | `/api/v1/auctions/calendar/grid` | Календарная сетка GY (новый) |
| GET | `/api/v1/auctions/calendar` | Список по фильтрам |
| GET | `/api/v1/auctions/calendar/upcoming` | Предстоящие |
| GET | `/api/v1/auctions/calendar/:id` | Конкретный аукцион |
| GET | `/api/v1/auctions/summary` | KPI |
| GET | `/api/v1/auctions/timeline` | 90-дневный timeline |
| POST | `/api/v1/auctions/bids` | Создать заявку (DRAFT) |
| GET | `/api/v1/auctions/bids` | Все заявки |
| GET | `/api/v1/auctions/bids/:id` | Детали заявки |
| PATCH | `/api/v1/auctions/bids/:id` | Обновить параметры |
| POST | `/api/v1/auctions/bids/:id/submit` | Подать (SUBMITTED) |
| POST | `/api/v1/auctions/bids/:id/result` | Результат (WON/LOST) |
| POST | `/api/v1/auctions/bids/:id/create-contract` | Создать контракт из победы |
| DELETE | `/api/v1/auctions/bids/:id` | Отменить (только DRAFT/SUBMITTED) |

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

Где **TI** = Total Imbalance за Gas Day (kWh) = суммарный вход − суммарный выход шиппера.

#### GPP и GPN — маргинальные цены газа (NC Art.15.4)

| Параметр | Описание | Кто публикует |
|---|---|---|
| **GPP** (Gas Purchase Price) | Цена, по которой TSO **покупает** излишек газа у шиппера при положительном небалансе | Gastrans, на основании рыночных котировок |
| **GPN** (Gas Network Price) | Цена, по которой TSO **продаёт** газ шипперу для покрытия отрицательного небаланса | Gastrans, на основании рыночных котировок |

**Ключевые особенности:**
- GPP < GPN (спред TSO) — при любом небалансе шиппер несёт убыток
- Цены публикуются TSO на ежедневной основе (по Gas Day)
- Небаланс начисляется после закрытия Gas Day (06:00 → 06:00 CET)
- Хранятся в системе: таблица `gas_prices` (поля `gpn_eur_kwh`, `gpp_eur_kwh`, `gas_day`)
- API: `GET /api/v1/balance/gas-prices?date=YYYY-MM-DD`

> Шиппер минимизирует небаланс точными номинациями. Charge = 0 при TI = 0.

### 10.3 VTP — Virtual Trading Point (NC Art.11)

**Что такое VTP с бизнес-точки зрения:**

VTP (Virtual Trading Point, Виртуальная Торговая Точка) — механизм, позволяющий шипперам передавать права на газ друг другу **без физической транспортировки**, непосредственно «внутри» системы Gastrans. Точка `VTP-SERBIA` является виртуальной — у неё нет физического местоположения на трубопроводе.

**Кому нужна VTP и зачем:**

| Сценарий | Пользователь | Что даёт VTP |
|---|---|---|
| Исправление небаланса | Шиппер A (излишек) + Шиппер B (дефицит) | A передаёт B излишний газ по рыночной цене, оба избегают штрафов TSO |
| OTC-торговля газом | Трейдер | Быстрый перенос позиции без нового контракта с TSO |
| Балансировка портфеля | Крупный шиппер (>1 контракт) | Перераспределение газа между своими позициями |

**Балансовый эффект (NC Art.11.3):**
- С точки зрения балансирования VTP-сделка формирует: entry из balancing zone + exit в balancing zone
- TSO видит VTP как нейтральный обмен — не меняет суммарный небаланс сети
- Каждая сделка регистрируется в системе как пара номинаций

**Текущий статус:** 0% NC compliance (Sprint backlog, P3). API эндпоинт `/api/v1/vtp` — заглушка.

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

> ⚠ Формула зависит от типа продукта. **Всегда раздельно entry + exit** (`cap_entry ≠ cap_exit`).

#### Период-зависимые формулы (NC Art.20 + АЕРС 05-145)

| Тип продукта | Единица тарифа | Формула на одну точку |
|---|---|---|
| `FIRM_YEARLY` / `COMM_REV_YEARLY` | EUR/kWh/h/год | `cap × T / 365 × days_in_month` |
| `FIRM_QUARTERLY` / `COMM_REV_QUARTERLY` | EUR/kWh/h/квартал | `cap × T / Qd × days_in_month` (Q1=92, Q2=90, Q3=91, Q4=92) |
| `FIRM_MONTHLY` / `COMM_REV_MONTHLY` | EUR/kWh/h/месяц | `cap × T × 1` ← тариф уже за месяц, **не делить!** |
| `FIRM_DAILY` / `COMM_REV_DAILY` | EUR/kWh/h/день | `cap × T × days_in_month` |
| `FIRM_WITHIN_DAY` | EUR/kWh/h/час | `cap × T × hours` ← **не делить на 365!** |

```
monthly_invoice_capacity = entry_fee(cap_entry, tariff_entry)
                         + exit_fee(cap_exit, tariff_exit)
```

Пример (FIRM_YEARLY, KIREVO_HORGOS, 31 день):
```
ENTRY: cap_entry_lt × 6.00 / 365 × 31  = [рассчитывается системой]
EXIT:  cap_horgos_lt × 6.85 / 365 × 31 = [рассчитывается системой]
                                  TOTAL: [рассчитывается системой] EUR
```

Пример (FIRM_MONTHLY, 31 день):
```
ENTRY: cap_entry_lt × tariff_entry_monthly × 1 = [рассчитывается системой]
EXIT:  cap_exit_lt  × tariff_exit_monthly  × 1 = [рассчитывается системой]
                                         TOTAL: [рассчитывается системой] EUR
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

### 16.2 NC Compliance Matrix (79%, Sprint 13)

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
| **10 P1** | **27.03.2026** | **20** | **✅** | **NC Art.3 Shipper Registration (lifecycle APPLICANT→ACTIVE→REMOVED, migration 012, audit trail), Documentation (UserGuide v3.0)** |
| **11** | **27.03.2026** | **39** | **✅** | **Nominations 100% (NC Art.12-13), Over-Nomination logic, Balance panel, Renomination 4-rule, migration 013 (nominations_kwh_h); RBP Core: Mock SOAP Server, rbpClient.js, capacityUpload, creditSync, auctionSync, bundledAuction, migration 014 (rbp_tables)** |
| **12** | **28.03.2026** | **19** | **✅** | **RBP Secondary Market: surrenderApproval, bilateralManager, remitReporter, networkUserSync; RBP Bridge UI (4 вкладки), rbp-mock.test.js (16 тестов), 117/117 тестов** |

**Кумулятив на 30.03.2026: ~501 SP · 442/442 тестов · NC 79% (55/70) · 93 endpoints · Migrations 000–015**

### 17.2 RBP Integration — ✅ Завершено (Sprint 11–12)

**Variant B: RBP-Ready с Mock SOAP Server.** Переключение на production = одна переменная `RBP_MODE=production`.

#### Роль Gastrans в RBP (NC Art.7 + CAM NC EU 2017/459)

Gastrans выступает **TSO Member** на платформе RBP.EU (оператор — FGSZ, Венгрия). RBP — общеевропейская платформа бронирования мощностей (Regional Booking Platform), аккредитованная ENTSOG. Gastrans публикует на RBP предложения мощности по точке HORGOS-EXIT, получает результаты аукционов и синхронизирует их с локальной БД GTCP.

#### Модель «Один аукцион — два контракта» (NC Art.7.2, CAM NC Art.6)

```
Шиппер → 1 bid на RBP (HORGOS-EXIT Bundled)
         ↓
RBP генерирует два GTA:
  GTA-GASTRANS  →  KIREVO-ENTRY ↔ HORGOS-EXIT   (тариф Gastrans)
  GTA-FGSZ      →  HORGOS-EXIT ↔ FGSZ-IP        (тариф FGSZ)
  linked by bundle_id
```

- **KIREVO-ENTRY не является бандловой** — Bulgartransgaz не входит в RBP; для этой точки аукционы только локальные.
- Шиппер получает **единую квитанцию** от RBP, но платит двум TSO отдельно.

#### Жизненный цикл аукциона на RBP

```
Setting → Set → Pending → Active → PitStop → Closed
```

| Статус | Описание |
|---|---|
| `Setting` | TSO настраивает параметры аукциона (резервная цена, объём, продукт) |
| `Set` | Аукцион опубликован, окно для bid ещё не открыто |
| `Pending` | Окно bid открыто (шипперы подают заявки) |
| `Active` | Аукцион идёт (применяется алгоритм распределения) |
| `PitStop` | Технический перерыв (для годовых аукционов — мультираундовых) |
| `Closed` | Аукцион закрыт, результаты GTA опубликованы, синхронизированы в GTCP |

Синхронизация: `auctionSync.js` → `GetAuctionsV5` каждые 5 мин, `GetTradesV4` каждые 2 мин.

#### Сроки публикации и открытия bid (NC Art.7 + ENTSOG MAR0277-24)

| Продукт | Публикация аукциона | Открытие окна bid | Закрытие окна bid |
|---|---|---|---|
| Yearly (Annual Firm) | За 1 месяц до начала GY | D-1 at 08:00 CET | D-1 at 17:00 CET |
| Quarterly | За 3 недели | D-1 at 08:00 | D-1 at 17:00 |
| Monthly | За 5 рабочих дней | D-1 at 08:00 | D-1 at 17:00 |
| Daily | D-1 at 15:30 CET | D-1 at 15:30 | D-1 at 16:30 CET |
| Within-Day | D at 06:00 CET | D at 06:00 | D at +80 мин |

Для годовых ENTSOG публикует расписание (~47 аукционов в GY2025/2026, MAR0277-24 от 07.10.2024).

#### EIC-коды точек

| Точка | EIC-код | Описание |
|---|---|---|
| HORGOS-EXIT | `21Z000000000075H` | Horgoš/Kiškundorožma 1200 — бандловая |
| KIREVO-ENTRY | `21Z000000000074K` | Kirevo/Zaječar — локальная (вне RBP) |
| EXIT-SERBIA | `21Z000000000076F` | Domestic Serbia — локальная |

EIC (Energy Identification Code) выдаёт ENTSO-G. Используются в EDIGAS v5.1 сообщениях при обмене с RBP.

#### Компоненты реализации

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
| remitReporter.js | UploadRemitReport → ACER через RBP как RRM | ✅ |
| RBP Bridge UI | 4 вкладки: Статус, Аукционы, Bilateral, Sync-лог | ✅ |
| rbp-mock.test.js | 16 тестов — 11 SOAP-методов, bundled, full cycle | ✅ |
| Migrations 013–014 | nominations_kwh_h, rbp_tables | ✅ |

#### REMIT-отчётность

Gastrans обязан передавать сделки в ACER (EU Regulation 1227/2011) через RBP как **Registered Reporting Mechanism (RRM)**. `remitReporter.js` вызывает `UploadRemitReport` по каждому закрытому аукциону. В тестовой среде используется Mock SOAP Server, в production — `rbp.entsog.eu`.

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

## 18. Тестирование (Sprint 13)

### 18.1 Запуск тестов

```bash
cd ETRM/backend

# Mock-режим (без БД) — 442 теста, ~6 сек
npm test

# С отчётом покрытия
npm run test:coverage

# На реальной PostgreSQL (порт 8887)
npm run test:db

# С покрытием на реальной БД
npm run test:db:coverage
```

### 18.2 Тестовая база данных

```bash
# Создание тестовой БД (от суперпользователя)
psql -h localhost -p 8887 -U postgres -c "CREATE DATABASE gtcp_test OWNER gtcp_user;"

# Миграции (19 таблиц + 5 views)
npm run db:migrate

# Seed-данные (5 users, 5 shippers, 5 contracts, 57 tariffs)
npm run db:seed

# Полный сброс (migrate + seed)
npm run db:reset
```

Конфигурация: `.env.test` (DB_HOST=localhost, DB_PORT=8887, DB_NAME=gtcp_test)

### 18.3 Docker (альтернатива)

```bash
# Поднять PostgreSQL 15 на порту 5433
npm run docker:test:up

# Тесты
npm run test:db

# Убить контейнер
npm run docker:test:down
```

### 18.4 CI/CD (GitHub Actions)

Файл: `.github/workflows/test.yml`

| Job | Что делает |
|---|---|
| `test-mock` | Mock DB, `npm test --coverage`, upload artifact |
| `test-db` | PostgreSQL 15 service → migrate → seed → `npm test --coverage` |

Триггер: push/PR в `main`, только `backend/**`.

### 18.5 Структура тестов (25 файлов, 442 теста)

| Уровень | Suites | Tests | Описание |
|---|---|---|---|
| NC Compliance | 1 | 79 | Регрессия: §2.1 IPs, 7 routes, Art.6 products, AERS tariffs, Art.18 FG, Art.20 interest |
| Integration (supertest) | 6 | 75 | HTTP → auth, billing, contracts, nominations, auctions, shippers |
| Coverage push | 8 | 127 | Глубокое покрытие: billing formulas, bid lifecycle, NC Art.3 lifecycle |
| DB-specific | 4 | 47 | Все ветки: CR/WD/legacy modes, error branches, renom Art.12.7.5 |
| Unit (exported) | 1 | 30 | calcCapacityFee (4 modes), calcFuelGas, calcInterest, calcPenalty |
| Edge cases | 1 | 18 | authorize, authenticate, edigas, auditService |
| Real-DB | 1 | 6 | PostgreSQL без mock: over-nominate Art.12.8, matching |
| Existing | 3 | 60 | nc-routes, tariffs, rbp-mock |

### 18.6 Покрытие (Coverage)

| Модуль | Lines | NC Reference |
|---|---|---|
| billing.js | **97%** | Art.18, 20, AERS 05-145 |
| rbp.js | **100%** | Art.7.4, 5, 8, 10, 24 |
| auth.js | **95%** | — |
| shippers.js | **92%** | Art.3 lifecycle |
| auctions.js | **87%** | Art.7, CAM NC |
| nominations.js | **84%** | Art.12, 13 |

Непокрываемые строки (~30 из ~3500): NODE_ENV guards, defensive dead code, complex DB chains.

### 18.7 Ошибки, выявленные при тестировании (Sprint 13)

В ходе Sprint 13 при расширении тестового покрытия были обнаружены и исправлены три ошибки:

| ID | Область | Описание | Исправление |
|---|---|---|---|
| **BUG-01** | Billing / Округление | Промежуточные суммы вычислялись с `toFixed(2)`, что приводило к накопленной погрешности ±€0.01 в итоге счёта. Обнаружено в 120 из 436 тестовых комбинаций. | Промежуточный расчёт переведён на `toFixed(4)`, итоговое округление до 2 знаков — в конце. |
| **BUG-02** | Billing / Generate | `ReferenceError: pts is not defined` в `POST /billing/generate` при наличии нескольких NC-точек в одном счёте. Возвращало HTTP 500. | Переменная `pts` вынесена в правильную область видимости перед циклом по строкам. |
| **BUG-03** | Nominations / Over-Nomination | `ERROR: column "is_over_nomination" does not exist` при `POST /nominations` с превышением мощности. Возвращало HTTP 500. | Добавлена колонка `is_over_nomination BOOLEAN DEFAULT FALSE` в migration 015. |

> Все три ошибки закрыты в Sprint 13. Тесты: 442/442 ✅.

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
| Tests | — | **442/442** passing (Sprint 13, ~95% coverage) |

### 1.3 Technical Architecture

| Component | Technology | Version | Purpose |
|---|---|---|---|
| Backend API | Node.js + Express | 20 LTS | REST API, business logic |
| Database | PostgreSQL | 15–17 | Storage, migrations 001–014 |
| Frontend | Vanilla JS + HTML5 | Sprint 12 | SPA interface + RBP Bridge UI (4 tabs), real data from API |
| API Client | api.js v2.1 | 93 methods | All modules + RBP Bridge (11 endpoints), Reserve Prices, Invoice Line Items |
| Containerization | Docker Compose | 4.x+ | Local deployment |
| VPS (production) | PM2 + Nginx | 2.x / 1.25 | Production server |
| ERP Integration | 1C:Enterprise | 8.3 | Counterparties, invoices |

#### Architecture Diagram

```
+-------------------------------------------------------+
|                    GTCP Platform                       |
+-------------------------------------------------------+
|                                                        |
|  +-------------+    REST API     +----------------+    |
|  |  Frontend   | <=============> |    Backend     |    |
|  | GTCP_MVP    |   api.js v2.1   |  Express.js    |    |
|  |  .html      |   93 endpoints  |  Node.js 20    |    |
|  | Vanilla JS  |                 |                |    |
|  | Single SPA  |                 +-------+--------+    |
|  +-------------+                         |             |
|                                    +-----v------+      |
|                                    | PostgreSQL |      |
|                                    |   17.x     |      |
|                                    | 14 tables  |      |
|                                    +-----+------+      |
|                                          |             |
|  +------------------+   SOAP/HTTPS  +----v-------+     |
|  | RBP.EU (FGSZ)   | <==========>  | RBP Bridge |     |
|  | Regional Booking |  EDIGAS v5.1  | Variant B  |     |
|  | Platform         |  XML          | mock/uat/  |     |
|  +------------------+               | production |     |
|                                     +------------+     |
|  +------------------+   REST/HTTPS                     |
|  | 1C ERP (Gastrans)| <===> erp-connector.js           |
|  +------------------+       mock/production            |
+-------------------------------------------------------+
```

### 1.4 Normative Framework

| Document | Scope | Status |
|---|---|---|
| **Gastrans Network Code** (03.04.2020, 111 pp.) | All operations | Binding — authoritative source of truth |
| **AERS Decision 05-145** (17.07.2025) | GY2025/2026 tariffs | Reserve Prices (full table — Section 13) |
| **CAM NC** EU 2017/459 | Capacity auctions | Ascending clock + Uniform price |
| **ENTSOG MAR0277-24** (07.10.2024) | Auction schedule | 47 auctions GY2025/2026 |

> **Priority rule:** NC > AERS > CAM NC > code. On discrepancy — code is corrected to match NC.

### 1.5 System Data Flow

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
npm test                    # all tests — 442/442 passing
npm run test:coverage       # with coverage report (~95%)
```

Sprint 13 result: **442/442** passing across 25 suites. Sprint 12 baseline: 6 suites, 117 tests (billing 18, credits 21, auctions 17, nc-routes 21, tariffs 24, rbp-mock 16). Sprint 13 added: NC compliance regression (79), integration (281), unit billing (76), real-DB nominations (6). See §18 for full breakdown.

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

### 4.2 Nomination Deadline (NC Art.12.6.1.1)

**D-1 by 14:00 CET** — nominations submitted after the deadline are rejected by the server (Sprint 9: server-side CET time validation).

Renomination windows (NC Art.12.7.5): additional submission allowed until 18:00 CET D-1.

### 4.3 Matching (NC Art.13)

Algorithm: **Active TSO / Double-Sided Matching**

```
Confirmed Quantity = min(Entry Nomination, Exit Nomination)
```

### 4.4 Renomination (NC Art.12.7.5)

Status transition: `CONFIRMED` → `RENOM_PENDING`. Endpoint: `POST /api/v1/nominations/:id/renominate`.

#### Renomination Limitation Rules (Sprint 11, N-8)

NC Art.12.7.5 defines **4 rules** depending on current utilization:

| Current utilization | Direction | Maximum change |
|---|---|---|
| 0 – 80% of contracted | increase | up to **90%** of contracted |
| 80 – 100% of contracted | increase | up to **half** of remaining free capacity |
| 20 – 100% of contracted | decrease | no more than **10%** of contracted |
| ≤ 20% of contracted | decrease | up to **half** of current nominated volume |

> ⚠ The description "±10%" is incomplete and only covers a specific case. Use the table above.

#### Entry/Exit Balance Panel (Sprint 11, N-2/N-6)

The frontend shows a **Balance panel** below the nomination form:

```
Entry total:  [sum kWh/h across Entry points]
Exit total:   [sum kWh/h across Exit points]
Difference:   [Entry − Exit]
```

- `diff > 0`: hint shown — _"Excess Entry X kWh/h needs EXIT-SERBIA nomination or VTP trade"_
- `diff < 0`: _"Entry deficit — add KIREVO-ENTRY or reduce exit"_
- Backend: `_balanceWarning` field in `POST /nominations` response; displayed as a UI warning

### 4.5 Over-Nomination (NC Art.12.8)

When Firm Capacity is fully contracted, a shipper may submit an **Over-Nomination** — a nomination above Contracted Capacity, with the excess allocated to the Within-Day Interruptible pool.

**Sprint 11 logic (N-4):**
1. System checks `Nominated ≤ Contracted Capacity` (SELECT from capacity_bookings)
2. If `nominated > CC`: does NOT reject — marks `over_nomination = true`, `excess_kwh_h = nominated − CC`
3. Excess is processed as **Interruptible** if spare capacity exists in the UIOLI pool
4. If Firm is fully subscribed AND no spare capacity → returns `422`

- Endpoint: `POST /api/v1/nominations/:id/over-nominate`
- Interruption penalty: fee × **3** (AERS item 3).

### 4.6 EDIGAS NOMINT XML

For confirmed nominations: `GET /api/v1/nominations/:id/edigas-nomint` returns NOMINT XML (NC Art.4.1.2).

In the UI: **«XML»** button on confirmed nominations row → popup with full XML.

### 4.7 API Nominations

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

#### Billing Formula Decision Tree

```
  Invoice Line Item
        |
        v
  What product type?
        |
  +-----+-------+-------+-------+----------+
  |     |       |       |       |          |
  v     v       v       v       v          v
ANNUAL QRTLY  MNTHLY  DAILY  W/DAY    SPECIAL
  |     |       |       |       |          |
  v     v       v       v       v          v
cap×T  cap×T   cap×T   cap×T  cap×T    (see below)
/365   /Qd     ×1      ×days  ×hours
×days  ×days
  |     |       |       |       |
  +-----+-------+-------+-------+
        |
        v
  Qd = days in quarter:
  Q1(Oct-Dec)=92, Q2(Jan-Mar)=90
  Q3(Apr-Jun)=91, Q4(Jul-Sep)=92
        |
        v
  SPECIAL types:
  - FUEL_GAS:          X1×Q_horgos + X2×Q_serbia − KN
  - LATE_PAYMENT:      amount × (EURIBOR_6M+3%) / 360 × days
  - INTERRUPTION:      capacity_fee × 3  (AERS item 3)
  - AUCTION_PREMIUM:   (P_auction − P_reserve) × cap × hours
  - IMBALANCE:         |TI| × GPP  or  |TI| × GPN
```

#### Period-Aware Formulas by Product Type (NC Art.20 + AERS 05-145)

> **Critical:** the tariff unit depends on the product type. Divide by 365 **only for Annual**.

| Product type | Tariff unit | Formula per point | NC / AERS |
|---|---|---|---|
| `FIRM_YEARLY` / `COMM_REV_YEARLY` | EUR/kWh/h/**year** | `cap × T / 365 × days_in_month` | Art.6.1.2.1 |
| `FIRM_QUARTERLY` / `COMM_REV_QUARTERLY` | EUR/kWh/h/**quarter** | `cap × T / days_in_quarter × days_in_month` | Art.6.3.1.1 |
| `FIRM_MONTHLY` / `COMM_REV_MONTHLY` | EUR/kWh/h/**month** | `cap × T × 1` ← **do NOT divide!** | Art.6.3.1.2 |
| `FIRM_DAILY` / `COMM_REV_DAILY` | EUR/kWh/h/**day** | `cap × T × days_in_month` | Art.6.3.1.3 |
| `FIRM_WITHIN_DAY` | EUR/kWh/h/**hour** | `cap × T × hours` ← **do NOT divide by 365!** | Art.6.3.1.4 |

Quarter lengths: Q1(Oct–Dec)=92, Q2(Jan–Mar)=90, Q3(Apr–Jun)=91, Q4(Jul–Sep)=92.

**Monthly tariff is already expressed per month** — dividing by month length would be an error.

**Full invoice formula** — entry and exit always separate:

```
invoice_total = entry_fee(cap_entry, tariff_entry, product_type)
              + exit_fee(cap_exit,  tariff_exit,  product_type)
```

```
CORRECT (separate entry/exit):
  fee = cap_entry_kWh_h × tariff_entry / 365 × days
      + cap_exit_kWh_h  × tariff_exit  / 365 × days
  (above formula is Annual only; for other types — see table above)

WRONG (do not use!):
  fee = capacity × (tariff_entry + tariff_exit) / 365 × days
  ↑ Error 1: single capacity — cap_entry ≠ cap_exit for Gastrans
  ↑ Error 2: /365 applies to Annual only
```

> Reason: Entry Kirevo technical capacity ≠ Exit Horgoš technical capacity. The difference flows to the domestic exit zone — billing MUST use separate cap_entry and cap_exit values.

#### Billing for Commercial Reverse (COMM_REV)

On COMM_REV routes entry/exit points are reversed — tariffs are lower than physical:

| Route | Entry | Exit | Entry Tariff (Annual) | Exit Tariff (Annual) |
|---|---|---|---|---|
| KIREVO→HORGOS (Physical) | KIREVO | HORGOS | 6.00 | 6.85 |
| HORGOS→KIREVO (Full Rev A) | HORGOS | KIREVO | **3.25** | **2.85** |
| EXIT-SERBIA→KIREVO (Full Rev B) | EXIT-SERBIA | KIREVO | **1.99** | **2.85** |
| HORGOS→EXIT-SERBIA (Half Rev A) | HORGOS | EXIT-SERBIA | **3.25** | **1.99** |

Formula is identical — only points and tariffs change (from AERS table §13).

### 6.3 Within-Day Fee (NC Art.6.3.1.4)

```
fee = capacity_kWh_h × price_per_hour × number_of_hours
```

> **Do not divide by 365.** Within-Day tariff is already in EUR/kWh/h/**hour**. Within-Day Commercial Reverse is not offered (NC Art.6.5.2).

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
| `CAPACITY` | **period-aware** — see §6.2 table: YEARLY: `cap×T/365×days`; QUARTERLY: `cap×T/Qd×days`; MONTHLY: `cap×T×1`; DAILY: `cap×T×days` | Art.20.3.2.1 |
| `CAPACITY_WITHIN_DAY` | `cap_kWh_h × tariff_per_hour × hours` (do NOT divide by 365!) | Art.6.3.1.4 |
| `FUEL_GAS` | `X1×Q_horgos + X2×Q_serbia − KN` | Art.18 |
| `TRANSFER` | **period-aware** — same §6.2 table applies by product type | Art.10.3 |
| `SURRENDER_PREMIUM` | `(P_old − P_new) × RC × hours` | Art.8.3 |
| `LATE_PAYMENT` | `overdue × (EURIBOR_6M + 3%) / 360 × days` | Art.20.4.2 |
| `IMBALANCE` | `|TI| × GPP` or `|TI| × GPN` | Art.15.4 |
| `INTERRUPTION_PENALTY` | `capacity_fee × 3` | AERS item 3 |
| `AUCTION_PREMIUM` | `(Auction_Price − Reserve_Price) × cap × hours` | Art.7.6.11 |

#### Verification example (real data, 31 days, **FIRM_YEARLY**, KIREVO→HORGOS)

> ⚠ The `/365 × days` formula applies to **FIRM_YEARLY only**. For other product types see §6.2.

```
FIRM_YEARLY (Annual tariff = EUR/kWh/h/year):
CAPACITY ENTRY: cap_entry_kWh_h × 6.00 / 365 × 31 = [system calculated]
CAPACITY EXIT:  cap_exit_kWh_h  × 6.85 / 365 × 31 = [system calculated]
FUEL_GAS (auto): Q_exit_kWh × 0.0325               = [system calculated]
                                              TOTAL: [system calculated]
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

### 7.4 API Contracts

| Method | URL | Description |
|---|---|---|
| GET | `/api/v1/contracts` | List contracts |
| POST | `/api/v1/contracts` | Create contract |
| GET | `/api/v1/contracts/:id` | Contract details |
| PATCH | `/api/v1/contracts/:id` | Update contract |
| DELETE | `/api/v1/contracts/:id` | Delete contract |

### 7.5 NC Art.3 — Shipper Registration and Lifecycle (Sprint 10 P1)

NC Art.3 defines the full shipper lifecycle as a participant in the transmission system.

#### Shipper Statuses

```
POST /shippers/apply        → APPLICANT
PATCH /shippers/:id/approve → APPROVED → ACTIVE
PATCH /shippers/:id/suspend → SUSPENDED
PATCH /shippers/:id/reactivate → ACTIVE
PATCH /shippers/:id/remove  → (checks) → REMOVED
```

| Status | Description | UI badge |
|---|---|---|
| `APPLICANT` | Application submitted, pending review | Yellow |
| `APPROVED` | Approved, signing GEDP + Balancing Agreement | Blue |
| `ACTIVE` | Active participant — can nominate and trade | Green |
| `SUSPENDED` | Blocked (credit breach / regulatory) — nominations and trading unavailable | Orange |
| `REMOVED` | Removed (NC Art.3.7) | Red |

#### Status Transitions

| From | To | Condition |
|---|---|---|
| `APPLICANT` | `APPROVED` | Documents verified |
| `APPROVED` | `ACTIVE` | Credit support provided |
| `ACTIVE` | `SUSPENDED` | Credit limit breach / regulatory decision |
| `SUSPENDED` | `ACTIVE` | Issue resolved (reactivation) |
| `ACTIVE` | `REMOVED` | `contracted_capacity = 0` + `outstanding_debt = 0` |
| `APPLICANT` | `REMOVED` | Application rejected |

Every transition is logged in `shipper_changes` (audit trail): `field_name`, `old_value`, `new_value`, `reason`.

#### Removal Conditions (NC Art.3.7)

Before transitioning to `REMOVED`, the system checks:
- `contracted_capacity = 0` (no active contracts)
- `outstanding_debt = 0` (no unpaid invoices)
- On success — GEDP and Balancing Agreement are automatically terminated

#### GTA Types

| Type | Description |
|---|---|
| `LONG_TERM` | Long-Term GTA (≥ 1 year, exempt from auctions under Final Exemption Act) |
| `SHORT_TERM` | Short-Term GTA (via public CAM NC auctions) |

#### API Shippers

| Method | URL | Description |
|---|---|---|
| GET | `/api/v1/shippers` | List shippers |
| POST | `/api/v1/shippers` | Create shipper |
| POST | `/api/v1/shippers/apply` | Submit application (→ APPLICANT) |
| PATCH | `/api/v1/shippers/:id/approve` | Approve (→ ACTIVE) |
| PATCH | `/api/v1/shippers/:id/remove` | Remove (with NC Art.3.7 checks) |
| GET | `/api/v1/shippers/:id/audit` | Audit trail (old/new values) |

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

#### Interconnection Points Map (NC §2.1)

```
                   BULGARIA
                      |
           [KIREVO-ENTRY] ---- Entry Point Kirevo/Zajecar
                      |         Tariff: 6.00 EUR/kWh/h/yr
                      |
         =============|============= GASTRANS PIPELINE (TurkStream)
                      |
             +--------+--------+
             |                 |
   [EXIT-SERBIA]         [HORGOS-EXIT]
   Exit Domestic          Exit Horgos/Kiskundorozsma
   Tariff: 4.19            Tariff: 6.85
             |                 |
    +--------+--------+       |
    |        |        |       |
  GMS-2   GMS-3   GMS-4   HUNGARY (FGSZ)
 Pančevo Paraćin Gospođinci

  Commercial Reverse (virtual):
  HORGOS-ENTRY -------> KIREVO-EXIT  (Full Reverse A)
  EXIT-SERBIA-ENTRY --> KIREVO-EXIT  (Full Reverse B)
  HORGOS-ENTRY -------> EXIT-SERBIA  (Half Reverse A)
  EXIT-SERBIA-ENTRY --> HORGOS-EXIT  (Half Reverse B)
```

### 8.2 Technical Capacity and 90/10 Rule (Final Exemption Act + Sprint 10 P0)

90% of technical capacity is reserved for Long-Term GTA (exempt from auctions under the Final Exemption Act, 05.03.2019). 10% is available for public CAM NC auctions.

| Point | Tech Capacity | LT Reserve (~90%) | ST Available (~10%) |
|---|---|---|---|
| Entry Kirevo | cap_entry_tech | cap_entry_lt | cap_entry_st |
| Exit Domestic (GMS-2/3/4) | cap_domestic_tech | cap_domestic_lt | cap_domestic_st |
| Exit Horgoš | cap_horgos_tech | cap_horgos_lt | cap_horgos_st |

> **Critical rule:** LT Reserve Entry ≠ LT Reserve Exit Horgoš (they differ by the domestic exit zone capacity). Billing MUST use separate cap_entry and cap_exit — never assume they are equal.

#### Capacity 90/10 Split Diagram

```
  TECHNICAL CAPACITY (AERS certified) — 100%
  =======================================================

  Point  | [============ ~90% LT Reserve ===========][~10% ST]
  -------+--------------------------------------------------
  Entry  | [Long-Term GTA, Final Exemption Act       ][Auct. ]
  Horgos | [Long-Term GTA, Final Exemption Act       ][Auct. ]
  Domest.| [Long-Term GTA, Final Exemption Act       ][Auct. ]

  ST (~10%) splits into:
  +----------+     +---------+     +-------------+
  |   SOLD   |     |  FREE   |     |    UIOLI    |
  | (at auctn)|    |(auction)|     |(unsold cap →|
  |          |     |         |     | WD Intrrp)  |
  +----------+     +---------+     +-------------+

  ! CRITICAL: LT Reserve Entry ≠ LT Reserve Exit Horgoš
              Difference = cap_domestic_lt (domestic exit zone)
              Billing: always separate cap_entry and cap_exit!
```

#### Available Capacity formula

```
Available = Technical − LongTerm − ShortTermSold + Surrendered
```

Auction bids are rejected (HTTP 422) if `bid.capacity > Available(~10%)` per point and period.

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

#### Route Diagram (NC §2.1)

```
  Physical Flow (Bulgaria → Serbia/Hungary):
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

  Legacy (DB compat only — do not use in new code):
  ============================================
  L1: GOSPODJINCI_HORGOS    (→ use R6/R7)
  L2: HORGOS_GOSPODJINCI    (→ use R6/R7)
```

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

Where **TI** = Total Imbalance per Gas Day (kWh) = total entry − total exit for the shipper.

#### GPP and GPN — Marginal Gas Prices (NC Art.15.4)

| Parameter | Description | Published by |
|---|---|---|
| **GPP** (Gas Purchase Price) | Price at which TSO **buys** surplus gas from the shipper on positive imbalance | Gastrans, based on market quotes |
| **GPN** (Gas Network Price) | Price at which TSO **sells** gas to the shipper to cover negative imbalance | Gastrans, based on market quotes |

**Key features:**
- GPP < GPN (TSO spread) — any imbalance results in a net loss for the shipper
- Prices published daily by TSO (per Gas Day)
- Imbalance charge accrues after Gas Day closes (06:00 → 06:00 CET)
- Stored in system: `gas_prices` table (fields: `gpn_eur_kwh`, `gpp_eur_kwh`, `gas_day`)
- API: `GET /api/v1/balance/gas-prices?date=YYYY-MM-DD`

> Shippers minimize imbalance with accurate nominations. Charge = 0 when TI = 0.

### 10.3 VTP — Virtual Trading Point (NC Art.11)

**What VTP is from a business perspective:**

VTP (Virtual Trading Point) is a mechanism allowing shippers to transfer gas rights to each other **without physical transportation**, directly "inside" the Gastrans system. Point `VTP-SERBIA` is virtual — it has no physical location on the pipeline.

**Who needs VTP and why:**

| Scenario | User | What VTP provides |
|---|---|---|
| Imbalance correction | Shipper A (surplus) + Shipper B (deficit) | A transfers surplus gas to B at market price; both avoid TSO penalties |
| OTC gas trading | Trader | Fast position transfer without a new TSO contract |
| Portfolio balancing | Large shipper (>1 contract) | Reallocates gas between own positions |

**Balancing effect (NC Art.11.3):**
- From a balancing perspective, a VTP transaction creates: entry from balancing zone + exit into balancing zone
- TSO treats VTP as a neutral exchange — does not change the overall network imbalance
- Each transaction is recorded in the system as a pair of nominations

**Current status:** 0% NC compliance (Sprint backlog, P3). API endpoint `/api/v1/vtp` — stub.

### 10.4 API Balance

| Method | URL | Description |
|---|---|---|
| GET | `/api/v1/balance` | Daily balance by point |
| GET | `/api/v1/balance/shippers` | Breakdown by shipper |
| GET | `/api/v1/balance/gas-prices` | GPP/GPN prices by date |

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

> ⚠ Formula depends on product type. **Always separate entry + exit** (`cap_entry ≠ cap_exit`).

#### Period-Aware Formulas (NC Art.20 + AERS 05-145)

| Product type | Tariff unit | Formula per point |
|---|---|---|
| `FIRM_YEARLY` / `COMM_REV_YEARLY` | EUR/kWh/h/year | `cap × T / 365 × days_in_month` |
| `FIRM_QUARTERLY` / `COMM_REV_QUARTERLY` | EUR/kWh/h/quarter | `cap × T / Qd × days_in_month` (Q1=92, Q2=90, Q3=91, Q4=92) |
| `FIRM_MONTHLY` / `COMM_REV_MONTHLY` | EUR/kWh/h/month | `cap × T × 1` ← tariff already per month, **do NOT divide!** |
| `FIRM_DAILY` / `COMM_REV_DAILY` | EUR/kWh/h/day | `cap × T × days_in_month` |
| `FIRM_WITHIN_DAY` | EUR/kWh/h/hour | `cap × T × hours` ← **do NOT divide by 365!** |

```
monthly_invoice_capacity = entry_fee(cap_entry, tariff_entry)
                         + exit_fee(cap_exit, tariff_exit)
```

Example (FIRM_YEARLY, KIREVO_HORGOS, 31 days):
```
ENTRY: cap_entry_lt × 6.00 / 365 × 31  = [system calculated]
EXIT:  cap_horgos_lt × 6.85 / 365 × 31 = [system calculated]
                                  TOTAL: [system calculated] EUR
```

Example (FIRM_MONTHLY, 31 days):
```
ENTRY: cap_entry_lt × tariff_entry_monthly × 1 = [system calculated]
EXIT:  cap_exit_lt  × tariff_exit_monthly  × 1 = [system calculated]
                                          TOTAL: [system calculated] EUR
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

### 16.2 NC Compliance Matrix (79%, Sprint 13)

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
| **10 P1** | **27.03.2026** | **20** | **✅** | **NC Art.3 Shipper Registration (lifecycle APPLICANT→ACTIVE→REMOVED, migration 012, audit trail), Documentation (UserGuide v3.0)** |
| **11** | **27.03.2026** | **39** | **✅** | **Nominations 100% (NC Art.12-13), Over-Nomination logic, Balance panel, Renomination 4-rule, migration 013 (nominations_kwh_h); RBP Core: Mock SOAP Server, rbpClient.js, capacityUpload, creditSync, auctionSync, bundledAuction, migration 014 (rbp_tables)** |
| **12** | **28.03.2026** | **19** | **✅** | **RBP Secondary Market: surrenderApproval, bilateralManager, remitReporter, networkUserSync; RBP Bridge UI (4 tabs), rbp-mock.test.js (16 tests), 117/117 tests** |

| **13** | **30.03.2026** | **45** | **✅** | **Testing Infrastructure: 442 tests (25 suites), CI/CD GitHub Actions + PostgreSQL, coverage ~95%, billing 97%, 3 bugs found+fixed, migrations 000+015** |

**Cumulative 30.03.2026: ~501 SP · 442/442 tests · NC 79% (55/70) · 93 endpoints · Migrations 000–015**

### 17.2 RBP Integration — ✅ Complete (Sprint 11–12)

**Variant B: RBP-Ready with Mock SOAP Server.** Switch to production = one env variable: `RBP_MODE=production`.

#### Gastrans Role on RBP (NC Art.7 + CAM NC EU 2017/459)

Gastrans operates as a **TSO Member** on RBP.EU (operated by FGSZ, Hungary). RBP is the pan-European Regional Booking Platform accredited by ENTSOG. Gastrans publishes capacity offerings for the HORGOS-EXIT point, receives auction results, and synchronizes them with the GTCP local database.

#### "One Auction — Two Contracts" Model (NC Art.7.2, CAM NC Art.6)

```
Shipper → 1 bid on RBP (HORGOS-EXIT Bundled)
          ↓
RBP generates two GTAs:
  GTA-GASTRANS  →  KIREVO-ENTRY ↔ HORGOS-EXIT   (Gastrans tariff)
  GTA-FGSZ      →  HORGOS-EXIT ↔ FGSZ-IP        (FGSZ tariff)
  linked by bundle_id
```

- **KIREVO-ENTRY is NOT bundled** — Bulgartransgaz is outside RBP; this point uses local auctions only.
- The shipper receives **a single receipt** from RBP but pays two TSOs separately.

#### RBP Auction Lifecycle

```
Setting → Set → Pending → Active → PitStop → Closed
```

| Status | Description |
|---|---|
| `Setting` | TSO configures auction parameters (reserve price, volume, product) |
| `Set` | Auction published; bid window not yet open |
| `Pending` | Bid window open (shippers submit bids) |
| `Active` | Auction running (allocation algorithm applied) |
| `PitStop` | Technical pause (for multi-round annual auctions) |
| `Closed` | Auction closed; GTA results published and synced to GTCP |

Sync: `auctionSync.js` → `GetAuctionsV5` every 5 min, `GetTradesV4` every 2 min.

#### Publication and Bid Deadlines (NC Art.7 + ENTSOG MAR0277-24)

| Product | Auction publication | Bid window open | Bid window close |
|---|---|---|---|
| Yearly (Annual Firm) | 1 month before GY start | D-1 at 08:00 CET | D-1 at 17:00 CET |
| Quarterly | 3 weeks before | D-1 at 08:00 | D-1 at 17:00 |
| Monthly | 5 business days before | D-1 at 08:00 | D-1 at 17:00 |
| Daily | D-1 at 15:30 CET | D-1 at 15:30 | D-1 at 16:30 CET |
| Within-Day | D at 06:00 CET | D at 06:00 | D at +80 min |

For annual capacity ENTSOG publishes the full auction schedule (~47 auctions in GY2025/2026, MAR0277-24 dated 07.10.2024).

#### EIC Point Codes

| Point | EIC code | Description |
|---|---|---|
| HORGOS-EXIT | `21Z000000000075H` | Horgoš/Kiškundorožma 1200 — bundled |
| KIREVO-ENTRY | `21Z000000000074K` | Kirevo/Zaječar — local only (outside RBP) |
| EXIT-SERBIA | `21Z000000000076F` | Domestic Serbia — local only |

EIC (Energy Identification Code) issued by ENTSO-G. Used in EDIGAS v5.1 messages when communicating with RBP.

#### Implementation Components

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
| Migrations 013–014 | nominations_kwh_h, rbp_tables | ✅ |

#### REMIT Reporting

Gastrans is required to report trades to ACER (EU Regulation 1227/2011) via RBP as a **Registered Reporting Mechanism (RRM)**. `remitReporter.js` calls `UploadRemitReport` after each closed auction. In test mode: Mock SOAP Server. In production: `rbp.entsog.eu`.

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

## 18. Testing (Sprint 13)

### 18.1 Running Tests

```bash
cd ETRM/backend

# Mock mode (no DB required) — 442 tests, ~6 sec
npm test

# With coverage report
npm run test:coverage

# Against real PostgreSQL (port 8887)
npm run test:db
```

### 18.2 Test Database Setup

```bash
# Create test DB
psql -h localhost -p 8887 -U postgres -c "CREATE DATABASE gtcp_test OWNER gtcp_user;"

# Run migrations (19 tables + 5 views)
npm run db:migrate

# Seed data (5 users, 5 shippers, 5 contracts, 57 AERS tariffs)
npm run db:seed
```

### 18.3 CI/CD

GitHub Actions (`.github/workflows/test.yml`) runs on every push/PR to `main`:
- **Job 1:** Mock DB — `npm test --coverage`
- **Job 2:** Real PostgreSQL 15 — migrate → seed → `npm test --coverage`

### 18.4 Test Suite Summary

| Level | Suites | Tests | Description |
|---|---|---|---|
| NC Compliance | 1 | 79 | Regression: §2.1, Art.5, 6, 12, 18, 20, AERS 05-145 |
| Integration | 6 | 75 | HTTP via supertest: auth, billing, contracts, nominations, auctions, shippers |
| Coverage | 8 | 127 | Deep: billing formulas, bid lifecycle, NC Art.3 |
| DB-specific | 4 | 47 | All branches: CR/WD/legacy, error paths, Art.12.7.5 |
| Unit | 1 | 30 | Exported functions: calcCapacityFee, calcFuelGas, calcInterest |
| Edge cases | 1 | 18 | Defensive: auth, authorize, edigas, audit |
| Real-DB | 1 | 6 | PostgreSQL: over-nominate Art.12.8, matching |

**Total: 442 tests · 25 suites · Coverage ~95%**

### 18.5 Key Coverage

| Module | Lines | NC |
|---|---|---|
| billing.js | **97%** | Art.18, 20, AERS |
| rbp.js | **100%** | Art.7, 8, 10, 24 |
| auth.js | **95%** | — |
| shippers.js | **92%** | Art.3 |

### 18.6 Bugs Found During Testing (Sprint 13)

Three bugs were discovered and fixed during Sprint 13 coverage expansion:

| ID | Area | Description | Fix |
|---|---|---|---|
| **BUG-01** | Billing / Rounding | Subtotals computed with `toFixed(2)`, causing accumulated ±€0.01 error in invoice total. Found in 120 of 436 test combinations. | Intermediate calculation changed to `toFixed(4)`; final rounding to 2 decimal places applied at the end only. |
| **BUG-02** | Billing / Generate | `ReferenceError: pts is not defined` in `POST /billing/generate` when multiple NC points were present in one invoice. Returned HTTP 500. | Variable `pts` moved to correct scope before the line-items loop. |
| **BUG-03** | Nominations / Over-Nomination | `ERROR: column "is_over_nomination" does not exist` on `POST /nominations` with capacity exceeded. Returned HTTP 500. | Column `is_over_nomination BOOLEAN DEFAULT FALSE` added in migration 015. |

> All three bugs resolved in Sprint 13. Tests: 442/442 ✅.

---

## Glossary

| Term | Definition | NC Ref |
|---|---|---|
| **Gas Day** | 06:00 CET → 06:00 CET next day | §2.1 |
| **Gas Year** | 01 October → 01 October | §2.1 |
| **Gas Quarter** | 3 months from October, January, April, July | §2.1 |
| **Contracted Capacity** | Maximum capacity kWh/h at a point | §