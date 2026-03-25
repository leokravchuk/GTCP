# GTCP — Sprint 5 Plan
**Gas Trading & Commercial Platform · Capacity Fix + Domestic Points + Infrastructure**

---

## 📋 Sprint Overview

| Параметр | Значение |
|---|---|
| **Sprint** | Sprint 5 |
| **Период** | 25.03.2026 — 09.04.2026 (2 недели) |
| **Команда** | Backend Dev, Frontend Dev, DevOps, QA |
| **Velocity (цель)** | 36 Story Points |
| **Sprint Goal** | Исправить критическую ошибку биллинговой формулы (split entry/exit capacity), добавить domestic exit points и завершить инфраструктуру |
| **Приоритет** | P0 — исправление критической ошибки |
| **Статус** | 🔴 ACTIVE — стартует 25.03.2026 |

> **Sprint 4 завершён досрочно (23.03.2026)** — все 9 US выполнены + дополнительно реализованы CAM NC contracts (003_contracts_nc.sql), официальные тарифы АЕРС (004_tariff_official.sql), capacity-based billing mode.

---

## 🎯 Sprint Goal

> **"К концу Sprint 5 GTCP корректно рассчитывает capacity fee с раздельным учётом Entry (Kirevo) и Exit (Horgoš), поддерживает domestic exit points (Paraćin / Pančevo / Gospođinci), и имеет автоматизированный CI/CD с тестами."**

### Критерии успеха Sprint

- [ ] `calcCapacityFee()` принимает отдельные `capacityEntryKwhH` и `capacityExitKwhH`
- [ ] Invoice modal в UI отображает два поля capacity с автозаполнением из контракта
- [ ] Таблица `contracts` имеет `capacity_entry_kwh_h` и `capacity_exit_kwh_h` (migration 005)
- [ ] 3 domestic exit points зарегистрированы в `interconnection_points`
- [ ] Направление `KIREVO_DOMESTIC` доступно при создании договора
- [ ] `GET /api/contracts/meta` возвращает обновлённые enum'ы
- [ ] GitHub Actions: PR запускает lint → test → build
- [ ] Swagger UI доступен на `/api/docs`

---

## 🔴 CRITICAL: Предпосылка (из Sprint 4 Review)

### Выявленная ошибка биллинговой модели

Анализ реальных технических данных GASTRANS (АЕРС, Табела 1) показал:

| Точка | Тех. мощность | Зарезервировано (90%) | Тариф (Annual Firm) |
|---|---|---|---|
| Entry Kirevo/Zaječar | 15 280 488 kWh/h | **13 752 230 kWh/h** | 4.19 EUR/(kWh/h)/yr |
| Exit Horgoš | 10 240 233 kWh/h | **9 216 209 kWh/h** | 6.85 EUR/(kWh/h)/yr |
| Exit Domestic zone | 5 040 256 kWh/h | **4 536 021 kWh/h** | TBD (АЕРС domestic) |

**Проблема:** `13 752 230 ≠ 9 216 209` — разница 4 536 021 kWh/h уходит в domestic exit zone.
Текущая формула `capacity_kWh_h × (t_entry + t_exit) / 365 × days` применяет одно значение к обоим тарифам.

**Цена ошибки:** до ±31M EUR/год относительно корректного расчёта.

**Корректная формула:**
```
capacity_fee = cap_entry_kWh_h × tariff_entry / 365 × days
             + cap_exit_kWh_h  × tariff_exit  / 365 × days
```

---

## 📦 Sprint Backlog

### Epic 1: CAP-FIX — Исправление capacity billing (P0 КРИТИЧЕСКИЙ)

#### US-501 · Migration 005 — Разделение capacity entry/exit
**Как** специалист по биллингу, **я хочу** чтобы система хранила и использовала раздельные мощности по точкам входа и выхода, **чтобы** расчёт был финансово корректным.

| | |
|---|---|
| **Story Points** | 3 |
| **Assignee** | Backend Dev |
| **Priority** | 🔴 P0 |
| **Файл** | `backend/src/db/migrations/005_capacity_entry_exit.sql` |

**Задачи:**
- [ ] `CAP-01` `ALTER TABLE contracts` — добавить `capacity_entry_kwh_h NUMERIC(18,2)` и `capacity_exit_kwh_h NUMERIC(18,2)`
- [ ] `CAP-02` Миграция данных: для `GOSPODJINCI_HORGOS` — `capacity_entry = 13752230`, `capacity_exit = 9216209`; для `HORGOS_GOSPODJINCI` — entry = exit = зарезервированный реверс
- [ ] `CAP-03` `ALTER TABLE invoices` — добавить `capacity_entry_kwh_h`, `capacity_exit_kwh_h`, `entry_fee_eur`, `exit_fee_eur`
- [ ] `CAP-04` Обновить `system_params` — добавить `capacity_entry_kirevo_kwh_h: 13752230`, `capacity_exit_horgos_kwh_h: 9216209`, `capacity_domestic_zone_kwh_h: 4536021`
- [ ] `CAP-05` Добавить `CHECK (capacity_entry_kwh_h >= 0)` и `CHECK (capacity_exit_kwh_h >= 0)`

**Definition of Done:** `\d contracts` показывает оба новых поля; данные мигрированы корректно; проверить `SELECT id, capacity_entry_kwh_h, capacity_exit_kwh_h FROM contracts LIMIT 5`.

---

#### US-502 · Обновление calcCapacityFee() в billing.js
**Как** backend-разработчик, **я хочу** исправить функцию расчёта capacity fee, **чтобы** entry и exit биллились по своим мощностям раздельно.

| | |
|---|---|
| **Story Points** | 2 |
| **Assignee** | Backend Dev |
| **Priority** | 🔴 P0 |
| **Файл** | `backend/src/routes/billing.js` |

**Задачи:**
- [ ] `CAP-06` Обновить сигнатуру `calcCapacityFee({ capacityEntryKwhH, capacityExitKwhH, tariffEntryEurKwhHYr, tariffExitEurKwhHYr, billingDays })` — раздельный расчёт
- [ ] `CAP-07` `entryFee = capacityEntryKwhH × tariffEntryEurKwhHYr / 365 × billingDays`
- [ ] `CAP-08` `exitFee  = capacityExitKwhH  × tariffExitEurKwhHYr  / 365 × billingDays`
- [ ] `CAP-09` При auto-lookup по `contractId` — загружать `capacity_entry_kwh_h` и `capacity_exit_kwh_h` из `contracts`
- [ ] `CAP-10` INSERT в `invoices` — записывать `entry_fee_eur` и `exit_fee_eur` раздельно
- [ ] `CAP-11` Backward compat: если переданы оба поля через тело запроса — использовать их; если только `capacityKwhH` (legacy) — entry = exit = значение (совместимость со старым кодом)

**Definition of Done:** Unit-тест `calcCapacityFee({ capacityEntryKwhH:13752230, capacityExitKwhH:9216209, tariffEntryEurKwhHYr:4.19, tariffExitEurKwhHYr:6.85, billingDays:31 })` возвращает `10 255 723.66 EUR` ± 1 EUR.

---

#### US-503 · Обновление Invoice Modal в GTCP_MVP.html
**Как** специалист по биллингу, **я хочу** видеть два отдельных поля мощности в форме счёта, **чтобы** контролировать корректность ввода данных.

| | |
|---|---|
| **Story Points** | 2 |
| **Assignee** | Frontend Dev |
| **Priority** | 🔴 P0 |
| **Файл** | `Soft/GTCP_MVP.html` |

**Задачи:**
- [ ] `CAP-12` Заменить `#inv-cap-kwh-h` (одно поле) на `#inv-cap-entry-kwh-h` + `#inv-cap-exit-kwh-h`
- [ ] `CAP-13` Placeholder: Entry `13 752 230 (Kirevo reserved)`, Exit `9 216 209 (Horgoš reserved)`
- [ ] `CAP-14` При выборе контракта в `onInvShipperChange()` — автозаполнять оба поля из `contract.capacityEntryKwhH / contract.capacityExitKwhH`
- [ ] `CAP-15` АЕРС справочный блок — обновить пример с раздельными строками (Entry: X × 4.19 + Exit: Y × 6.85)
- [ ] `CAP-16` `calcInvoice()` — обновить CAPACITY-mode: `transit = entry_cap × t_entry/365×days + exit_cap × t_exit/365×days`
- [ ] `CAP-17` В строке счёта показывать `Entry: X EUR + Exit: Y EUR = Total` при hover/detail view

**Definition of Done:** В UI при вводе Entry=13752230, Exit=9216209, тариф Entry=4.19, Exit=6.85, 31 день — результат `10 255 724 EUR`.

---

#### US-504 · Обновление contracts.js и api.js
| | |
|---|---|
| **Story Points** | 2 |
| **Assignee** | Backend Dev |
| **Priority** | 🔴 P0 |

**Задачи:**
- [ ] `CAP-18` `POST /contracts` — принимать `capacity_entry_kwh_h`, `capacity_exit_kwh_h`; сохранять оба поля
- [ ] `CAP-19` `GET /contracts/:id` — возвращать оба поля в ответе
- [ ] `CAP-20` `PATCH /contracts/:id` — разрешить обновление обоих полей
- [ ] `CAP-21` Валидация: `capacity_exit_kwh_h ≤ capacity_entry_kwh_h` (физическое ограничение сети)
- [ ] `CAP-22` `api.js` — `contracts.create()` и `contracts.update()` передают новые поля

---

### Epic 2: DOM — Domestic Exit Points (P1)

#### US-505 · Регистрация domestic exit points в БД
**Как** оператор системы, **я хочу** чтобы три domestic exit point были зарегистрированы в системе, **чтобы** можно было заключать договоры на поставку в сербскую внутреннюю сеть.

| | |
|---|---|
| **Story Points** | 3 |
| **Assignee** | Backend Dev |
| **Priority** | 🟡 P1 |
| **Файл** | `backend/src/db/migrations/005_capacity_entry_exit.sql` (расширение) |

**Задачи:**
- [ ] `DOM-01` INSERT в `interconnection_points` — три domestic exit points:

| Код | Название | EIC | Тип | TSO | Мощн. reserved (kWh/h) |
|---|---|---|---|---|---|
| `PARACIN` | IP Paraćin | 21W-0000-0029-K | EXIT_DOMESTIC | Yugas | ~1 450 000 |
| `PANCEVO` | IP Pančevo | 21W-0000-0031-9 | EXIT_DOMESTIC | Yugas | ~1 615 000 |
| `GOSPODJINCI_DOM` | GMS-4 Gospođinci | 21W-0000-0028-M | EXIT_DOMESTIC | Gastrans | ~1 471 021 |

- [ ] `DOM-02` Суммарная domestic exit reserved = 4 536 021 kWh/h (= Entry 13 752 230 − Exit Horgoš 9 216 209)
- [ ] `DOM-03` INSERT в `system_params`: `domestic_exit_reserved_total_kwh_h: 4536021`

---

#### US-506 · Направление KIREVO_DOMESTIC в схеме контрактов
**Как** коммерческий менеджер, **я хочу** создавать договоры с направлением KIREVO_DOMESTIC, **чтобы** учитывать поставки в сербскую сеть.

| | |
|---|---|
| **Story Points** | 2 |
| **Assignee** | Backend Dev |
| **Priority** | 🟡 P1 |

**Задачи:**
- [ ] `DOM-04` Добавить значение `KIREVO_DOMESTIC` в CHECK constraint таблицы `contracts.flow_direction`
- [ ] `DOM-05` Обновить `FLOW_DIRECTIONS` map в `contracts.js`:
  ```
  KIREVO_DOMESTIC: {
    label: 'Кирево → Domestic (Параћин / Панчево / Госпођинцы)',
    entryPoint: 'KIREVO', exitPoint: 'DOMESTIC_ZONE',
    tariffEntry: 4.19, tariffDomesticExit: TBD // АЕРС domestic exit tariff
  }
  ```
- [ ] `DOM-06` `GET /contracts/meta` — добавить KIREVO_DOMESTIC в `flowDirections`
- [ ] `DOM-07` Допустимые типы для KIREVO_DOMESTIC: `TSA_FIRM_ANNUAL`, `TSA_FIRM_QUARTERLY`, `TSA_FIRM_MONTHLY`, `TSA_FIRM_DAILY`, `TSA_INTERRUPTIBLE`

---

#### US-507 · Domestic direction в UI (GTCP_MVP.html)
| | |
|---|---|
| **Story Points** | 2 |
| **Assignee** | Frontend Dev |
| **Priority** | 🟡 P1 |

**Задачи:**
- [ ] `DOM-08` Добавить `KIREVO_DOMESTIC` в `FLOW_DIR_LABELS` и `FLOW_DIR_DESC`:
  ```javascript
  KIREVO_DOMESTIC: 'Кирево → Domestic'
  // desc: 'ВХОД: Kirevo (21W-…) → ВЫХОД: Domestic zone
  //        (Paraćin / Pančevo / Gospođinci GMS-4)
  //        Мощность domestic zone: 4 536 021 kWh/h (reserved)'
  ```
- [ ] `DOM-09` В `onCtrDirChange()` для KIREVO_DOMESTIC — не блокировать тип договора (все firm типы разрешены)
- [ ] `DOM-10` Автозаполнение тарифа: `tariff_entry = 4.19`, `tariff_exit = TBD` (domestic tariff из system_params)
- [ ] `DOM-11` Capacity defaults: `cap_entry = 4536021` (полная domestic zone), редактируемо
- [ ] `DOM-12` Добавить sub-field "Domestic Exit Point" (select: Paraćin / Pančevo / Gospođinci / Все три)

---

#### US-508 · Domestic capacity tracking
| | |
|---|---|
| **Story Points** | 2 |
| **Assignee** | Backend Dev |
| **Priority** | 🟡 P1 |

**Задачи:**
- [ ] `DOM-13` `GET /capacity` — добавить domestic zone capacity в ответ (зарезервированная + свободная + технич.)
- [ ] `DOM-14` Проверка при создании контракта KIREVO_DOMESTIC: сумма всех domestic контрактов ≤ 4 536 021 kWh/h
- [ ] `DOM-15` Добавить строку "Domestic zone capacity" в демо-данные capacity_bookings

---

### Epic 3: Infrastructure & Documentation (P1)

#### US-509 · Swagger / OpenAPI 3.0
| | |
|---|---|
| **Story Points** | 3 |
| **Assignee** | Backend Dev |
| **Priority** | 🟡 P1 |

**Задачи:**
- [ ] `DOC-01` Установить `swagger-ui-express` + `swagger-jsdoc`
- [ ] `DOC-02` Аннотировать все endpoints: `/auth`, `/nominations`, `/credit`, `/billing`, `/contracts`, `/capacity`
- [ ] `DOC-03` Добавить Security Schema: `BearerAuth (JWT)`
- [ ] `DOC-04` Документировать новые поля: `capacity_entry_kwh_h`, `capacity_exit_kwh_h`, `KIREVO_DOMESTIC`
- [ ] `DOC-05` `GET /api/docs` — Swagger UI в браузере

---

#### US-510 · Integration Tests
| | |
|---|---|
| **Story Points** | 4 |
| **Assignee** | QA |
| **Priority** | 🟡 P1 |

**Задачи:**
- [ ] `TEST-01` Jest + Supertest — аутентификация (login, refresh, logout, неверный пароль)
- [ ] `TEST-02` Nominations: создать → матч → реноминация (±10% граница)
- [ ] `TEST-03` **Billing capacity-mode**: POST /billing с `capacityEntryKwhH=13752230`, `capacityExitKwhH=9216209`, `billingDays=31` → ожидаемый ответ `10 255 724 EUR`
- [ ] `TEST-04` **Billing legacy-mode**: backward compat с `capacityKwhH` (один параметр)
- [ ] `TEST-05` Contracts: создать GTA с `KIREVO_DOMESTIC` → проверить capacity validation
- [ ] `TEST-06` CI: все тесты запускаются через `npm test`

---

#### US-511 · GitHub Actions CI/CD
| | |
|---|---|
| **Story Points** | 3 |
| **Assignee** | DevOps |
| **Priority** | 🟡 P1 |

**Задачи:**
- [ ] `CI-01` `.github/workflows/ci.yml` — триггер: push на `main`, PR
- [ ] `CI-02` Шаги: `npm ci` → `npm run lint` → `npm test` → `docker build`
- [ ] `CI-03` Service container PostgreSQL 15 для integration tests
- [ ] `CI-04` Кэширование `node_modules` для ускорения (cache: npm)
- [ ] `CI-05` Badge статуса CI в README.md

---

### Epic 4: Real-time (P2 — при наличии времени)

#### US-512 · WebSocket сервер
| | |
|---|---|
| **Story Points** | 4 |
| **Assignee** | Backend Dev |
| **Priority** | 🟢 P2 |

**Задачи:**
- [ ] `RT-01` `npm install socket.io` + подключить к Express app
- [ ] `RT-02` Namespace `/dashboard` — emit `nomination:updated`, `credit:alert`, `invoice:paid`
- [ ] `RT-03` Middleware аутентификации для WebSocket (JWT из query param)
- [ ] `RT-04` Заменить `setInterval(30s)` в Dashboard на `socket.on('dashboard:refresh')`

#### US-513 · Credit alert push
| | |
|---|---|
| **Story Points** | 2 |
| **Assignee** | Backend Dev |
| **Priority** | 🟢 P2 |

- [ ] `RT-05` При превышении 80% кредитного лимита → emit `credit:warning` + toast в UI
- [ ] `RT-06` При Margin Call → emit `credit:margin_call` + push-уведомление

---

## 📊 Sprint Backlog Summary

| US | Epic | SP | Assignee | Priority | Status |
|---|---|---|---|---|---|
| US-501 · Migration 005 | CAP-FIX | 3 | Backend Dev | 🔴 P0 | TODO |
| US-502 · calcCapacityFee fix | CAP-FIX | 2 | Backend Dev | 🔴 P0 | TODO |
| US-503 · Invoice modal UI | CAP-FIX | 2 | Frontend Dev | 🔴 P0 | TODO |
| US-504 · contracts.js + api.js | CAP-FIX | 2 | Backend Dev | 🔴 P0 | TODO |
| US-505 · Domestic points БД | DOM | 3 | Backend Dev | 🟡 P1 | TODO |
| US-506 · KIREVO_DOMESTIC direction | DOM | 2 | Backend Dev | 🟡 P1 | TODO |
| US-507 · Domestic UI | DOM | 2 | Frontend Dev | 🟡 P1 | TODO |
| US-508 · Domestic capacity check | DOM | 2 | Backend Dev | 🟡 P1 | TODO |
| US-509 · Swagger/OpenAPI | Infra | 3 | Backend Dev | 🟡 P1 | TODO |
| US-510 · Integration tests | Infra | 4 | QA | 🟡 P1 | TODO |
| US-511 · GitHub Actions CI | Infra | 3 | DevOps | 🟡 P1 | TODO |
| US-512 · WebSocket server | RT | 4 | Backend Dev | 🟢 P2 | TODO |
| US-513 · Credit alert push | RT | 2 | Backend Dev | 🟢 P2 | TODO |
| **ИТОГО P0** | | **9 SP** | | | |
| **ИТОГО P0+P1** | | **28 SP** | | | |
| **ИТОГО ALL** | | **34 SP** | | | |

> ⚠️ **Velocity target: 36 SP.** P0 задачи (9 SP) — обязательны к завершению в первые 3 дня. P2 (US-512, US-513) — при наличии capacity.

---

## 🗂️ Структура файлов Sprint 5

```
backend/
├── src/
│   ├── routes/
│   │   ├── billing.js         ← CAP-06–11 (calcCapacityFee fix)
│   │   └── contracts.js       ← CAP-18–22, DOM-04–07
│   ├── db/
│   │   └── migrations/
│   │       └── 005_capacity_entry_exit.sql  ← CAP-01–05, DOM-01–03
│   └── app.js                 ← RT-01–03 (WebSocket, P2)
├── frontend/
│   ├── api.js                 ← CAP-22
│   └── GTCP_MVP.html          ← CAP-12–17, DOM-08–12
├── tests/
│   └── integration/
│       ├── auth.test.js       ← TEST-01
│       ├── nominations.test.js ← TEST-02
│       ├── billing.test.js    ← TEST-03–04
│       └── contracts.test.js  ← TEST-05
└── .github/
    └── workflows/
        └── ci.yml             ← CI-01–05

reports/
└── SPRINT_5_PLAN.md           ← Данный документ
```

---

## 🏗️ Технические детали: Migration 005

```sql
-- 005_capacity_entry_exit.sql

-- 1. Разделение capacity в contracts
ALTER TABLE contracts
  ADD COLUMN capacity_entry_kwh_h  NUMERIC(18,2),
  ADD COLUMN capacity_exit_kwh_h   NUMERIC(18,2);

-- 2. Миграция существующих данных (Gastrans transit flow)
UPDATE contracts
  SET capacity_entry_kwh_h = 13752230,
      capacity_exit_kwh_h  = 9216209
  WHERE flow_direction = 'GOSPODJINCI_HORGOS'
    AND contract_type   = 'TSA_FIRM_ANNUAL';

-- Commercial Reverse: одна точка (только exit Horgoš reversed)
UPDATE contracts
  SET capacity_entry_kwh_h = capacity_kwh_h,
      capacity_exit_kwh_h  = capacity_kwh_h
  WHERE flow_direction = 'HORGOS_GOSPODJINCI';

-- 3. Domestic exit points
INSERT INTO interconnection_points
  (code, name, eic_code, point_type, country, tso, capacity_kwh_h) VALUES
  ('PARACIN',       'IP Paraćin',          '21W-0000-0029-K', 'EXIT_DOMESTIC', 'RS', 'Yugas',    1450000),
  ('PANCEVO',       'IP Pančevo',          '21W-0000-0031-9', 'EXIT_DOMESTIC', 'RS', 'Yugas',    1615000),
  ('GOSPODJINCI_DOM','GMS-4 Gospođinci Dom','21W-0000-0028-M', 'EXIT_DOMESTIC', 'RS', 'Gastrans', 1471021);

-- 4. Добавить KIREVO_DOMESTIC в contracts CHECK
ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_flow_direction_check;
ALTER TABLE contracts
  ADD CONSTRAINT contracts_flow_direction_check
  CHECK (flow_direction IN (
    'GOSPODJINCI_HORGOS',
    'HORGOS_GOSPODJINCI',
    'KIREVO_DOMESTIC'
  ));

-- 5. Расширить invoices
ALTER TABLE invoices
  ADD COLUMN capacity_entry_kwh_h  NUMERIC(18,2),
  ADD COLUMN capacity_exit_kwh_h   NUMERIC(18,2),
  ADD COLUMN entry_fee_eur         NUMERIC(14,2),
  ADD COLUMN exit_fee_eur          NUMERIC(14,2);

-- 6. system_params: реальные Gastrans capacities
INSERT INTO system_params (key, value, unit, description) VALUES
  ('capacity_entry_kirevo_kwh_h',   '13752230', 'kWh/h', 'Reserved entry Kirevo/Zaječar (90% of 15,280,488)'),
  ('capacity_exit_horgos_kwh_h',    '9216209',  'kWh/h', 'Reserved exit Horgoš (90% of 10,240,233)'),
  ('capacity_domestic_zone_kwh_h',  '4536021',  'kWh/h', 'Reserved domestic exit zone (3 points)'),
  ('capacity_entry_free_kwh_h',     '1528258',  'kWh/h', 'Free/short-term entry capacity (10%)'),
  ('capacity_exit_horgos_free_kwh_h','1024024', 'kWh/h', 'Free/short-term exit Horgoš (10%)')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

---

## 🏗️ Технические детали: calcCapacityFee (исправленный)

```javascript
// billing.js — ОБНОВЛЁННАЯ функция

function calcCapacityFee({
  capacityEntryKwhH,       // kWh/h зарезервировано на ВХОДЕ (Kirevo)
  capacityExitKwhH,        // kWh/h зарезервировано на ВЫХОДЕ (Horgoš или domestic)
  tariffEntryEurKwhHYr,    // EUR/(kWh/h)/год — тариф ВХОДНОЙ точки
  tariffExitEurKwhHYr,     // EUR/(kWh/h)/год — тариф ВЫХОДНОЙ точки
  billingDays,
  // Legacy fallback:
  capacityKwhH,            // если передан один параметр (старый формат)
}) {
  // Legacy backward compat
  if (capacityKwhH && !capacityEntryKwhH && !capacityExitKwhH) {
    capacityEntryKwhH = capacityKwhH;
    capacityExitKwhH  = capacityKwhH;
  }
  if (!capacityEntryKwhH || !capacityExitKwhH) return 0;

  const entryFee = (capacityEntryKwhH * tariffEntryEurKwhHYr / 365) * billingDays;
  const exitFee  = (capacityExitKwhH  * tariffExitEurKwhHYr  / 365) * billingDays;

  return {
    entryFee:    parseFloat(entryFee.toFixed(2)),
    exitFee:     parseFloat(exitFee.toFixed(2)),
    totalFee:    parseFloat((entryFee + exitFee).toFixed(2)),
  };
}

// Контрольный расчёт (31 день, Annual Firm, полные зарезервированные мощности):
// Entry: 13,752,230 × 4.19 / 365 × 31 = 4,893,910 EUR
// Exit:   9,216,209 × 6.85 / 365 × 31 = 5,361,814 EUR
// TOTAL:                                10,255,724 EUR ✅
```

---

## 📅 Sprint Events

| Событие | Дата | Время | Участники |
|---|---|---|---|
| **Sprint Planning** | 25.03.2026 | 10:00 CET | Вся команда |
| **Daily Standup** | Ежедн. пн–пт | 09:00 CET | Вся команда |
| **P0 Gate Review** | 28.03.2026 | 14:00 CET | Tech Lead — проверка CAP-FIX |
| **Mid-Sprint Review** | 02.04.2026 | 14:00 CET | Tech Lead + Dev |
| **Sprint Review** | 09.04.2026 | 14:00 CET | Вся команда + PO |
| **Sprint Retrospective** | 09.04.2026 | 15:30 CET | Вся команда |

---

## 🎯 Definition of Done (Sprint 5)

- [ ] P0 CAP-FIX: `calcCapacityFee` unit-тест проходит с ожидаемым результатом 10 255 724 EUR
- [ ] Migration 005 применяется без ошибок на чистой БД
- [ ] UI: Invoice modal с двумя полями capacity работает корректно
- [ ] DOM: 3 domestic exit points в `interconnection_points`; `KIREVO_DOMESTIC` доступно в UI
- [ ] Swagger UI открывается на `/api/docs`
- [ ] `npm test` — ≥ 70% coverage, 0 failed tests
- [ ] GitHub Actions: PR check зелёный
- [ ] Нет незакрытых P0 дефектов

---

## ⚠️ Риски Sprint 5

| ID | Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|---|
| R-501 | Тариф domestic exit неизвестен (АЕРС 05-145 — нет точных цифр) | Высокая | Среднее | Placeholder TBD; функциональность готова, тариф подставить после уточнения у АЕРС |
| R-502 | EIC коды domestic points требуют верификации | Средняя | Низкое | Использовать placeholder EIC; production-verify перед UAT |
| R-503 | Migration 005 конфликт с legacy capacity_kwh_h | Средняя | Высокое | Сохранить legacy поле (не DROP); backward compat тест |
| R-504 | WebSocket (P2) может не поместиться в velocity | Средняя | Низкое | US-512/513 — официальные кандидаты на Sprint 6 |
| R-505 | GitHub Actions (платный/ограниченный для private repo) | Низкая | Среднее | Альтернатива: GitLab CI / самохостинг runner |

---

## 🔗 Связи со Sprint 6

По завершении Sprint 5 следующий Sprint 6 реализует:
- **VPS деплой** (nginx + PM2 + SSL/Let's Encrypt) — демо-стенд по публичному URL
- **1С ERP коннектор** — реальная синхронизация биллинга
- **Аналитический дашборд** — исторические данные объёмов, графики
- **Domestic exit тарифы** — после получения официальных данных АЕРС

---

## 📁 Связанные файлы

| Файл | Путь | Статус |
|---|---|---|
| MVP Frontend | `ETRM\Soft\GTCP_MVP.html` | ✅ Готово (Sprint 4) |
| CAM NC Migration | `backend\src\db\migrations\003_contracts_nc.sql` | ✅ Готово |
| Tariff Migration | `backend\src\db\migrations\004_tariff_official.sql` | ✅ Готово |
| **Capacity Fix Migration** | `backend\src\db\migrations\005_capacity_entry_exit.sql` | 🔴 TODO |
| Capacity Analysis | `reports\Gastrans_Capacity_Analysis.xlsx` | ✅ Готово |
| Sprint 4 Report | `reports\Отчёт_Sprint4_FINAL.docx` | ✅ v3 Готово |
| **Sprint 5 Plan** | `reports\SPRINT_5_PLAN.md` | ✅ Данный документ |

---

*Документ сформирован: 25.03.2026 · GTCP Project · PMNz-74*
*Sprint 5 стартует немедленно после досрочного завершения Sprint 4*
