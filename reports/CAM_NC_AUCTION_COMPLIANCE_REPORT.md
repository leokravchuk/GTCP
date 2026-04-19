# CAM NC Auction Compliance Report — GTCP vs Real Mechanisms

**GTCP · Compliance Analysis · 19.04.2026**
**Sources:** CAM NC EU 2017/459 (Art.17-18), RBP Operational Rules v1.10 (FGSZ), ENTSOG Auction Calendar MAR0277-24, Gastrans NC Art.7

---

## 1. Контекст

GTCP реализует аукционы на мощность по упрощённой модели **sealed-bid** (однораундовый, каждый платит свою цену). Реальный механизм, предписанный **CAM NC EU 2017/459 (Art.17-18)**, — это **ascending clock auction** с многораундовой динамической ценой и единой clearing price для всех победителей.

Данный отчёт фиксирует расхождения, оценивает их критичность и предлагает рекомендации для дипломного проекта.

---

## 2. Ascending Clock Auction — CAM NC Art.17-18

### 2.1 Механизм

Ascending clock — это итеративный аукцион, где цена начинается с Reserve Price (P₀) и повышается по раундам до момента clearance (спрос ≤ предложение).

```
ПОДГОТОВКА
  TSO публикует: available capacity (kWh/h), reserve price (P₀), auction window
  ↓
РАУНД 1 — Duration: 3 часа — Price: P₀ (reserve price)
  Все shippers подают quantity bids (kWh/h) по цене P₀
  TSO агрегирует: Σ demand vs available supply
  ↓
  Σ demand > supply  → OVERSUBSCRIPTION → цена растёт → Раунд 2
  Σ demand = supply  → CLEARANCE → аукцион закрыт
  Σ demand < supply  → UNDERSELL → аукцион закрыт (все получают свой объём)
  ↓
РАУНД 2 — Duration: 1 час — Price: P₁ = P₀ + large price step
  Shippers корректируют объёмы (только уменьшение допускается)
  TSO агрегирует
  ↓
  Повторяется до Clearance или Undersell
  ↓
РАУНД N — Duration: 1 час — Price: Pₙ
  Если demand снизился до ≤ supply → CLEARANCE
  ↓
РЕЗУЛЬТАТ
  Uniform clearing price = цена последнего раунда
  ВСЕ победители платят ОДНУ цену (не свою индивидуальную)
  Auction premium = clearing price − reserve price
  ↓
КОНТРАКТОВАНИЕ
  Каждый winner получает контракт на allocated volume × clearing price
```

### 2.2 Timing (CAM NC Art.11)

| Раунд | Длительность | Пауза после раунда |
|---|---|---|
| Первый | **3 часа** | 1 час |
| Второй и далее | **1 час** | 1 час |

### 2.3 Правила подачи бидов

- **Раунд 1:** Shipper подаёт volume (kWh/h) по объявленной P₀. Не может подать цену ниже P₀.
- **Раунды 2+:** Shipper может только **уменьшить** свой volume (или оставить). Увеличение volume запрещено (anti-gaming).
- **Minimum bid:** Volume ≥ minimum lot (обычно 1 kWh/h для Gastrans).
- **Withdrawal:** Shipper может полностью отозвать bid (volume = 0).

### 2.4 Ценовой шаг (Price Step)

CAM NC определяет два типа шагов:
- **Large price step (LPS):** P₁ = P₀ × (1 + LPS%). Типично LPS = 10-20%.
- **Small price step (SPS):** Используется в undersell ситуации для fine-tuning. SPS = LPS / 5.

Пример:
```
P₀ = 1.81 EUR/kWh/h/quarter (AERS 05-145, Q1 Firm, KIREVO-ENTRY)
LPS = 15%
P₁ = 1.81 × 1.15 = 2.08 EUR
P₂ = 2.08 × 1.15 = 2.39 EUR
...
```

### 2.5 Uniform Price Rule

**Все победители платят одну цену** — clearing price последнего раунда. Это **не** highest-bid wins (как в sealed-bid), а market-clearing mechanism.

```
Пример:
  Shipper A: bid 500K kWh/h по P₂ = 2.39 EUR
  Shipper B: bid 300K kWh/h по P₂ = 2.39 EUR
  Shipper C: withdrew (0 kWh/h)
  
  Available: 1,000K kWh/h
  Demand: 800K kWh/h < Available → UNDERSELL at P₂
  
  Result:
    A: allocated 500K @ 2.39 EUR (не по его оценке, а по uniform price)
    B: allocated 300K @ 2.39 EUR
    Remaining 200K: returned to available pool for next auction
```

### 2.6 Auction Premium

```
premium_per_unit = clearing_price − reserve_price
total_premium = allocated_kwh_h × premium_per_unit

Пример:
  clearing = 2.39, reserve = 1.81
  premium = 2.39 − 1.81 = 0.58 EUR/kWh/h/quarter
  Shipper A total premium = 500,000 × 0.58 = 290,000 EUR
```

Premium распределяется по национальным правилам (AERS). Обычно остаётся у TSO как дополнительный доход.

---

## 3. Текущая реализация GTCP (Sealed-Bid)

### 3.1 Модель

```
Shipper подаёт заявку: POST /auctions/bids
  body: { auctionCalendarId, bidCapacityKwhH, bidPriceEur }
  ↓
TSO оценивает (вручную): POST /auctions/bids/:id/result
  body: { result: 'WON' | 'LOST' }
  ↓
Winner создаёт контракт: POST /auctions/bids/:id/create-contract
```

### 3.2 Характеристики

| Параметр | GTCP (sealed-bid) | CAM NC (ascending clock) |
|---|---|---|
| Раундов | **1** | **3h + N × 1h** |
| Цена | Shipper назначает свою | TSO объявляет, растёт по раундам |
| Оплата | Каждый платит свою bid price | **Все платят uniform clearing price** |
| Корректировка | Невозможна | Volume можно уменьшить между раундами |
| Price discovery | Нет (sealed) | Да (aggregate demand видна после раунда) |
| Premium | Не рассчитывается | clearing − reserve |
| Таблица DB | `auction_bids` | + `auction_rounds` (нет) |

### 3.3 Допустимость упрощения

Для **unbundled внутренних точек** Gastrans (KIREVO-ENTRY, EXIT-SERBIA) — упрощение sealed-bid **допустимо** в учебных целях. NC Art.7.4 говорит что TSO "shall offer capacity through auctions using the ascending clock algorithm **or** alternative allocation mechanism approved by NRA (AERS)".

Для **bundled точки HORGOS-EXIT** (совместная с FGSZ) — **обязательно** через RBP с ascending clock, т.к. RBP Operational Rules v1.10 не допускают альтернатив.

---

## 4. RBP (Regional Booking Platform) — FGSZ

### 4.1 Модель "One Auction — Two Contracts"

На interconnection point Horgoš/Kiskundorozsma мощность продаётся **bundled** — один аукцион порождает два контракта:

```
RBP Auction (operated by FGSZ)
  ↓
Shipper wins 200,000 kWh/h @ clearing price
  ↓
Contract 1: Gastrans ↔ Shipper
  - Entry: KIREVO-ENTRY → Exit: HORGOS-EXIT (сербская сторона)
  - Tariff: AERS 05-145
  - Contract ref: GTA-2026-XXX
  ↓
Contract 2: FGSZ ↔ Shipper
  - Entry: HORGOS-EXIT → Exit: Hungarian grid (венгерская сторона)
  - Tariff: HEA (Hungarian Energy Authority)
  - Contract ref: FGSZ-2026-XXX
  ↓
Оба контракта ВЗАИМОЗАВИСИМЫ
  - Ни один не существует без другого
  - Отмена одного = отмена обоих
  - Bundle ID связывает контракты
```

### 4.2 Интеграция TSO с RBP (SOAP API)

| Метод | Направление | Описание | Наш статус |
|---|---|---|---|
| `UploadCapacityAndTariffV4` | GTCP → RBP | Публикация available capacity + reserve price | Mock ✅ |
| `UploadFinanceCreditV3` | GTCP → RBP | Синхронизация кредитных лимитов shippers | Mock ✅ |
| `GetAuctionsV5` | RBP → GTCP | Получение аукционного календаря | Mock ✅ |
| `GetTradesV4` | RBP → GTCP | Получение результатов (WON/LOST) | Mock ✅ |
| `GetCreditLimits` | RBP → GTCP | Запрос кредитных лимитов с RBP | Mock ✅ |
| `ApproveSurrenderedCapacityDeal` | GTCP → RBP | Одобрение surrender на вторичном рынке | Mock ✅ |
| `CreateBilateralDealV4` | GTCP → RBP | Двусторонняя сделка | Mock ✅ |
| `ApproveBilateralDeal` | GTCP → RBP | Одобрение bilateral | Mock ✅ |
| `GetActiveNetworkUsers` | RBP → GTCP | Список активных network users | Mock ✅ |
| `UploadRemitReport` | GTCP → RBP | REMIT отчётность (ACER) | Mock ✅ |

**Все 10 методов реализованы в mock-режиме (Sprint 11).** Реальная интеграция требует SSL-сертификат от FGSZ и TSO Member регистрацию.

### 4.3 Шаги регистрации TSO на RBP

1. Заявка на TSO Membership → FGSZ (2-4 недели)
2. Предоставить EIC-коды точек (21X... формат, ENTSOG)
3. Получить SSL-сертификат для WS-Security
4. Тестирование на UAT: `app.uat.rbp.euipnew.test.fgsz.hu`
5. Production: `app.rbp.euipnew.fgsz.hu`

---

## 5. ENTSOG Auction Calendar (MAR0277-24, GY 2025/2026)

| Product | Расписание аукциона | Тип аукциона | Наш seed |
|---|---|---|---|
| **Yearly Firm** | 1-й Пн июля (07.07.2025) | Ascending clock | ✅ 3 записи |
| **Yearly Interruptible** | 3-й Пн июля (21.07.2025) | Ascending clock | ❌ Нет |
| **Quarterly Firm** | 4 раунда: 1-й Пн авг/ноя/фев/мая | Ascending clock | ✅ 48 записей |
| **Quarterly Interruptible** | 1 месяц после Firm | Ascending clock | ❌ Нет |
| **Quarterly CR** | 1-й Пн сен/дек/мар/июн | Ascending clock | ✅ 20 записей |
| **Monthly Firm** | 3-й Пн M-1 | Ascending clock | ✅ 36 записей |
| **Monthly CR** | 1 неделя после Firm | Ascending clock | ✅ 24 записи |
| **Daily Firm** | D-1 15:30 UTC (зима) / 14:30 UTC (лето) | Uniform price (single round) | On-the-fly |
| **Daily Interruptible** | D-1 16:30 / 15:30 UTC | Uniform price | On-the-fly |
| **Within-Day** | Continuous, каждый час | FCFS (not auction) | `POST /capacity/within-day` |

**Важно:** Daily и Within-Day используют **упрощённый механизм** (single round или FCFS), не full ascending clock. Наша реализация sealed-bid **корректна для Daily/WD**.

---

## 6. GAP Analysis

| # | Gap | Severity | Наше состояние | CAM NC / RBP требование |
|---|---|---|---|---|
| **G-01** | Нет multi-round ascending clock | **CRITICAL** | 1 раунд sealed-bid | Art.17-18: 3h + N×1h раунды |
| **G-02** | Нет uniform price | **CRITICAL** | Каждый платит свою price | Все WON платят clearing price |
| **G-03** | RBP — только mock | **CRITICAL** | Mock SOAP (10 методов) | Real SOAP + SSL cert |
| **G-04** | Нет bundled capacity logic | **CRITICAL** | Точки независимы | One auction → two contracts |
| **G-05** | Нет динамической корректировки бидов | **HIGH** | Один shot | Volume уменьшается между раундами |
| **G-06** | Нет price step (LPS/SPS) | **HIGH** | Фиксированный reserve | P₁ = P₀ × (1+LPS%), SPS для undersell |
| **G-07** | Auction premium не рассчитывается | **HIGH** | Колонка есть (auction_premium_eur), но пустая | premium = clearing − reserve |
| **G-08** | Interruptible auctions не в seed | **MEDIUM** | Только Firm + CR | Interruptible Daily/Yearly тоже нужны |
| **G-09** | REMIT reporting — stub | **MEDIUM** | Mock `UploadRemitReport` | Реальная отчётность в ACER |
| **G-10** | Нет EIC-кодов для точек | **LOW** | Названия (KIREVO-ENTRY) | 21X... формат ENTSOG |

---

## 7. Рекомендации для дипломного проекта

### 7.1 Что НЕ нужно делать (over-engineering для диплома)

- Полноценный ascending clock с real-time WebSocket раундами (~40 SP)
- Реальная интеграция с FGSZ UAT (требует TSO регистрацию, SSL cert, 2-4 недели)
- REMIT reporting в ACER (regulatory process)
- EIC-коды (административная процедура)

### 7.2 Что НУЖНО сделать (дипломный минимум)

| # | Действие | SP | Эффект |
|---|---|---|---|
| 1 | **Описать** в тексте диплома разницу sealed-bid vs ascending clock | 0 | Показывает понимание |
| 2 | **Добавить `clearing_price_eur`** в auction results (uniform price) | 2 | G-02 закрыт |
| 3 | **Рассчитывать `auction_premium_eur`** = clearing − reserve | 1 | G-07 закрыт |
| 4 | **Отметить** в UI что Gastrans использует "simplified allocation per NRA approval" | 0 | Юридическое обоснование |
| 5 | **Показать** RBP mock integration как proof-of-concept | 0 | G-03 отмечен |
| 6 | **Добавить** Interruptible auctions в seed | 2 | G-08 закрыт |
| 7 | **Добавить** таблицу `auction_rounds` (даже если 1 раунд) | 3 | G-01 архитектурно готов |

**Итого: 8 SP** для полного compliance на дипломном уровне.

### 7.3 Юридическое обоснование упрощения

NC Art.7.4.1:
> "The allocation of firm capacity products shall be carried out by applying an auction algorithm. The TSO may use an **alternative allocation mechanism** where the national regulatory authority has approved such mechanism."

AERS (как NRA Сербии) может утвердить sealed-bid как альтернативный механизм для внутренних точек. Для бандлированной точки HORGOS-EXIT — обязательно через RBP ascending clock.

---

## 8. Сравнительная таблица: GTCP vs Реальные платформы

| Feature | GTCP (учебный) | RBP (FGSZ) | PRISMA (EU) | GSA Platform |
|---|---|---|---|---|
| Auction type | Sealed-bid | Ascending clock | Ascending clock | Ascending clock |
| Rounds | 1 | Multi (3h+1h) | Multi (3h+1h) | Multi |
| Pricing | Pay-as-bid | Uniform | Uniform | Uniform |
| Bundling | No | Yes (One Auction Two Contracts) | Yes | Yes |
| Integration | REST API | SOAP (SoapTSOService) | REST + SOAP | REST |
| REMIT | No | Yes (RRM) | Yes | Yes |
| Shippers | 7 (demo) | 50+ real | 200+ real | 100+ real |
| Points | 3+3 CR | Horgoš (bundled) | 300+ EU | 50+ |

---

## 9. Источники

| # | Источник | URL / Location |
|---|---|---|
| 1 | CAM NC EU 2017/459 (full text) | entsog.eu/capacity-allocation-mechanisms-nc |
| 2 | RBP Operational Rules v1.10 | FGSZ Ltd., tsoua.com/wp-content/uploads/2020/11/PDF_5_EN-RBP-Operational_rules.pdf |
| 3 | RBP Web Service Documentation v1.29 | FGSZ Ltd. (confidential, local copy) |
| 4 | ENTSOG Auction Calendar MAR0277-24 | entsog.eu (press release 20.12.2024) |
| 5 | Gastrans NC 2020 (Art.7) | `NC-Gastrans-2020-ENG.pdf` (local) |
| 6 | AERS Decision 05-145 (17.07.2025) | Referenced in `CLAUDE.md` |
| 7 | PRISMA Ascending Clock Guide | help.prisma-capacity.eu |
| 8 | EASEE-gas CBP 2018-001/05 | Harmonised Gas Role Model |
| 9 | RBP Portal | rbp.eu |
| 10 | GTCP CLAUDE.md | `ETRM/CLAUDE.md` — auction rules section |
| 11 | GTCP RBP Integration Analysis | `reports/RBP_Integration_Analysis.md` |
| 12 | GTCP seed-runner.js | `backend/src/db/seed-runner.js` — auction calendar seed |

---

*Compliance Report v1.0 · 19.04.2026 · GTCP Project*
*Подготовлен для дипломной работы · Факультет технических наук*
