-- ============================================================
-- Migration 008: Auction Management — Full Lifecycle
-- CAM NC EU 2017/459 + MAR0277-24 (Auction Calendar 2025-2026)
-- ============================================================
-- Free Capacity → Bid → Won → Contract → Billing
--
-- Источник дат: MAR0277-24_CAM NC Auction Calendar 2025-2026
--   (Final, October 7th 2024, ENTSOG)
-- Все времена в UTC; доставка газа по CET/CEST (UTC+1/UTC+2)
--
-- Иерархия продуктов CAM NC Art. 8:
--   ANNUAL     → July (Firm) / 3rd July (Interruptible)
--   QUARTERLY  → 4 раунда в год: Aug, Nov, Feb, May
--   MONTHLY    → 3rd Monday M-1 (Firm) / 4th Tuesday M-1 (Interruptible)
--   DAILY      → D-1 15:30/14:30 UTC
--   WITHIN_DAY → каждый час газового дня
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Auction Calendar — расписание аукционов CAM NC
-- ============================================================
CREATE TABLE IF NOT EXISTS auction_calendar (
  id                  SERIAL PRIMARY KEY,

  -- Классификация
  product_type        VARCHAR(20) NOT NULL
    CHECK (product_type IN ('ANNUAL','QUARTERLY','MONTHLY','DAILY','WITHIN_DAY')),
  capacity_type       VARCHAR(20) NOT NULL DEFAULT 'FIRM'
    CHECK (capacity_type IN ('FIRM','INTERRUPTIBLE')),
  auction_round       VARCHAR(50),         -- "AQC-1", "AQC-2", "Jan-2026", etc.
  gas_year            INTEGER,             -- 2025, 2026

  -- Привязка к IP (NULL = все IPs Gastrans)
  point_code          VARCHAR(50) REFERENCES interconnection_points(code),

  -- Временные окна аукциона
  publication_date    DATE,                -- дата публикации тех. параметров
  auction_start_date  DATE         NOT NULL,  -- открытие окна для ставок
  auction_start_utc   TIME         NOT NULL DEFAULT '07:00:00', -- UTC
  auction_end_date    DATE,                -- закрытие окна (если не run_date)
  auction_end_utc     TIME         DEFAULT '12:00:00',

  -- Период поставки
  delivery_start      TIMESTAMPTZ  NOT NULL,  -- начало поставки мощности
  delivery_end        TIMESTAMPTZ  NOT NULL,  -- конец поставки мощности

  -- Правило по CAM NC (для генерации будущих дат)
  schedule_rule       VARCHAR(200),        -- "1st Monday of July", "3rd Monday of M-1"
  cam_nc_reference    VARCHAR(100),        -- "CAM NC Art. 12.1 / MAR0277-24"
  source_doc          VARCHAR(100) DEFAULT 'MAR0277-24',

  -- Статус
  status              VARCHAR(20) NOT NULL DEFAULT 'UPCOMING'
    CHECK (status IN ('UPCOMING','OPEN','CLOSED','RESULTS_PUBLISHED','CANCELLED')),

  -- RBP.EU связь
  rbp_auction_id      VARCHAR(100),        -- внешний ID аукциона на RBP.EU
  rbp_platform_url    VARCHAR(500),

  -- Резервная цена (если известна)
  reserve_price_eur_kwh_h NUMERIC(12,6),

  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_calendar_type    ON auction_calendar(product_type, capacity_type);
CREATE INDEX IF NOT EXISTS idx_auction_calendar_start   ON auction_calendar(auction_start_date);
CREATE INDEX IF NOT EXISTS idx_auction_calendar_status  ON auction_calendar(status);
CREATE INDEX IF NOT EXISTS idx_auction_calendar_delivery ON auction_calendar(delivery_start, delivery_end);

-- ============================================================
-- 2. Auction Bids — заявки шипперов
-- ============================================================
CREATE TABLE IF NOT EXISTS auction_bids (
  id                      SERIAL PRIMARY KEY,
  auction_id              INTEGER NOT NULL REFERENCES auction_calendar(id) ON DELETE RESTRICT,
  shipper_id              UUID    NOT NULL REFERENCES shippers(id),

  -- Параметры заявки
  point_code              VARCHAR(50) NOT NULL REFERENCES interconnection_points(code),
  flow_direction          VARCHAR(30) NOT NULL
    CHECK (flow_direction IN ('GOSPODJINCI_HORGOS','HORGOS_GOSPODJINCI','KIREVO_EXIT_SERBIA')),
  bid_capacity_kwh_h      NUMERIC(18,2) NOT NULL CHECK (bid_capacity_kwh_h > 0),
  bid_price_eur_kwh_h_yr  NUMERIC(12,6),   -- предложение цены (для аукционов с ценовой конкуренцией)
  bid_quantity            INTEGER DEFAULT 1,  -- лоты (если применяется)

  -- Статус жизненного цикла
  status                  VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT',           -- создана, не отправлена
      'SUBMITTED',       -- отправлена на RBP.EU
      'UNDER_REVIEW',    -- рассматривается
      'WON',             -- выиграна (полностью)
      'PARTIALLY_WON',   -- выиграна частично
      'LOST',            -- не выиграна
      'CANCELLED',       -- отозвана до закрытия
      'CONTRACT_CREATED' -- контракт создан на основе победы
    )),

  -- Отправка на RBP.EU
  submitted_at            TIMESTAMPTZ,
  rbp_bid_ref             VARCHAR(100),     -- ссылочный ID заявки на RBP.EU

  -- Результат аукциона
  result_received_at      TIMESTAMPTZ,
  allocated_capacity_kwh_h NUMERIC(18,2),  -- фактически выделенная мощность
  clearing_price_eur_kwh_h_yr NUMERIC(12,6), -- итоговая цена клиринга
  auction_premium_eur     NUMERIC(18,2),   -- аукционная надбавка (Annual/Quarterly)
  result_notes            TEXT,

  -- Связь с контрактом (заполняется при создании контракта)
  contract_id             UUID REFERENCES contracts(id),
  contract_created_at     TIMESTAMPTZ,

  -- Кредитная блокировка (NC Art. 5)
  credit_checked          BOOLEAN DEFAULT false,
  credit_sufficient       BOOLEAN,
  credit_blocked_eur      NUMERIC(18,2),   -- заблокировано на счёте кредитной поддержки

  notes                   TEXT,
  created_by              UUID REFERENCES users(id),
  updated_by              UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_bids_auction    ON auction_bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_shipper    ON auction_bids(shipper_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_status     ON auction_bids(status);
CREATE INDEX IF NOT EXISTS idx_auction_bids_contract   ON auction_bids(contract_id)
  WHERE contract_id IS NOT NULL;

-- ============================================================
-- 3. Триггер: updated_at для обеих таблиц
-- ============================================================
CREATE OR REPLACE FUNCTION fn_auction_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auction_calendar_upd ON auction_calendar;
CREATE TRIGGER trg_auction_calendar_upd
  BEFORE UPDATE ON auction_calendar
  FOR EACH ROW EXECUTE FUNCTION fn_auction_updated_at();

DROP TRIGGER IF EXISTS trg_auction_bids_upd ON auction_bids;
CREATE TRIGGER trg_auction_bids_upd
  BEFORE UPDATE ON auction_bids
  FOR EACH ROW EXECUTE FUNCTION fn_auction_updated_at();

-- ============================================================
-- 4. Функция: авто-создание контракта из выигранной заявки
-- ============================================================
CREATE OR REPLACE FUNCTION fn_create_contract_from_bid(
  p_bid_id     INTEGER,
  p_created_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_bid         RECORD;
  v_auction     RECORD;
  v_shipper     RECORD;
  v_ip          RECORD;
  v_contract_id UUID;
  v_tariff_entry NUMERIC(12,6) := 6.00;
  v_tariff_exit  NUMERIC(12,6) := 6.85;
  v_cap_entry    NUMERIC(18,2);
  v_cap_exit     NUMERIC(18,2);
  v_contract_num VARCHAR(50);
BEGIN
  -- Получить данные заявки и аукциона
  SELECT ab.*, ac.product_type, ac.delivery_start, ac.delivery_end,
         ac.auction_round, ac.capacity_type
  INTO v_bid
  FROM auction_bids ab
  JOIN auction_calendar ac ON ac.id = ab.auction_id
  WHERE ab.id = p_bid_id
    AND ab.status IN ('WON', 'PARTIALLY_WON')
    AND ab.contract_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bid % not found or not eligible for contract creation', p_bid_id;
  END IF;

  -- Данные по IP для тарифов
  SELECT * INTO v_ip FROM interconnection_points WHERE code = v_bid.point_code;

  -- Определить тарифы по направлению потока (АЕРС 05-145)
  v_tariff_entry := CASE v_bid.flow_direction
    WHEN 'GOSPODJINCI_HORGOS'  THEN 4.19
    WHEN 'HORGOS_GOSPODJINCI'  THEN 0.00
    WHEN 'KIREVO_EXIT_SERBIA'  THEN 6.00
    ELSE 6.00
  END;
  v_tariff_exit := CASE v_bid.flow_direction
    WHEN 'GOSPODJINCI_HORGOS'  THEN 6.85
    WHEN 'HORGOS_GOSPODJINCI'  THEN 3.25
    WHEN 'KIREVO_EXIT_SERBIA'  THEN 4.19
    ELSE 6.85
  END;

  -- Для KIREVO_EXIT_SERBIA оба тарифа на entry;
  -- иначе entry → entry point, exit → exit point
  v_cap_entry := CASE v_bid.flow_direction
    WHEN 'HORGOS_GOSPODJINCI' THEN 0
    ELSE COALESCE(v_bid.allocated_capacity_kwh_h, v_bid.bid_capacity_kwh_h)
  END;
  v_cap_exit := COALESCE(v_bid.allocated_capacity_kwh_h, v_bid.bid_capacity_kwh_h);

  -- Сгенерировать номер контракта GTA-YYYY-NNN
  SELECT 'GTA-' || EXTRACT(YEAR FROM NOW())::TEXT || '-'
         || LPAD((COUNT(*) + 1)::TEXT, 3, '0')
  INTO v_contract_num
  FROM contracts
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

  -- Создать контракт
  INSERT INTO contracts (
    contract_number, shipper_id, product_type, capacity_type,
    flow_direction,
    cap_entry_kwh_h, cap_exit_kwh_h,
    tariff_entry_eur_kwh_h_yr, tariff_exit_eur_kwh_h_yr,
    start_date, end_date,
    status, created_by,
    notes
  ) VALUES (
    v_contract_num,
    v_bid.shipper_id,
    v_bid.product_type,
    v_bid.capacity_type,
    v_bid.flow_direction,
    v_cap_entry, v_cap_exit,
    v_tariff_entry, v_tariff_exit,
    v_bid.delivery_start::DATE,
    v_bid.delivery_end::DATE,
    'ACTIVE',
    COALESCE(p_created_by, v_bid.created_by),
    'Auto-created from auction bid #' || p_bid_id
      || ' | Auction: ' || COALESCE(v_bid.auction_round, v_bid.product_type)
      || ' | Allocated: ' || COALESCE(v_bid.allocated_capacity_kwh_h, v_bid.bid_capacity_kwh_h)
      || ' kWh/h | Clearing: '
      || COALESCE(v_bid.clearing_price_eur_kwh_h_yr::TEXT, 'reserve') || ' EUR/(kWh/h)/yr'
  )
  RETURNING id INTO v_contract_id;

  -- Обновить bid: связать контракт + статус
  UPDATE auction_bids
  SET contract_id = v_contract_id,
      contract_created_at = NOW(),
      status = 'CONTRACT_CREATED'
  WHERE id = p_bid_id;

  RETURN v_contract_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. VIEW: v_auction_overview — витрина аукционов с дедлайнами
-- ============================================================
CREATE OR REPLACE VIEW v_auction_overview AS
SELECT
  ac.id,
  ac.product_type,
  ac.capacity_type,
  ac.auction_round,
  ac.gas_year,
  ac.point_code,
  ac.publication_date,
  ac.auction_start_date,
  ac.auction_start_utc,
  ac.delivery_start,
  ac.delivery_end,
  -- Длительность поставки в днях
  EXTRACT(DAY FROM (ac.delivery_end - ac.delivery_start))::INTEGER AS delivery_days,
  ac.schedule_rule,
  ac.cam_nc_reference,
  ac.status,
  ac.rbp_auction_id,
  ac.reserve_price_eur_kwh_h,

  -- Время до открытия (отрицательное = уже прошло)
  (ac.auction_start_date - CURRENT_DATE)::INTEGER  AS days_until_open,
  -- Время до начала поставки
  (ac.delivery_start::DATE - CURRENT_DATE)::INTEGER AS days_until_delivery,

  -- Флаги
  CASE
    WHEN ac.auction_start_date > CURRENT_DATE THEN 'UPCOMING'
    WHEN ac.auction_start_date = CURRENT_DATE THEN 'OPEN_TODAY'
    WHEN ac.status = 'OPEN' THEN 'OPEN'
    WHEN ac.delivery_start > NOW() THEN 'CLOSED_PENDING_DELIVERY'
    WHEN ac.delivery_end < NOW() THEN 'DELIVERED'
    ELSE ac.status
  END AS display_status,

  -- Срочность
  CASE
    WHEN (ac.auction_start_date - CURRENT_DATE) <= 0 THEN 'NOW'
    WHEN (ac.auction_start_date - CURRENT_DATE) <= 7 THEN 'THIS_WEEK'
    WHEN (ac.auction_start_date - CURRENT_DATE) <= 30 THEN 'THIS_MONTH'
    ELSE 'FUTURE'
  END AS urgency,

  -- Статистика по заявкам
  COUNT(ab.id)                                    AS total_bids,
  COUNT(ab.id) FILTER (WHERE ab.status = 'SUBMITTED') AS submitted_bids,
  COUNT(ab.id) FILTER (WHERE ab.status IN ('WON','PARTIALLY_WON')) AS won_bids,
  COALESCE(SUM(ab.allocated_capacity_kwh_h) FILTER (WHERE ab.status IN ('WON','PARTIALLY_WON')), 0)
                                                  AS total_allocated_kwh_h,
  ac.notes
FROM auction_calendar ac
LEFT JOIN auction_bids ab ON ab.auction_id = ac.id
GROUP BY ac.id;

-- ============================================================
-- 6. VIEW: v_bid_lifecycle — полный lifecycle заявки
-- ============================================================
CREATE OR REPLACE VIEW v_bid_lifecycle AS
SELECT
  ab.id                                 AS bid_id,
  ab.auction_id,
  ac.product_type,
  ac.capacity_type,
  ac.auction_round,
  ac.delivery_start,
  ac.delivery_end,
  ab.shipper_id,
  s.code                                AS shipper_code,
  s.name                                AS shipper_name,
  ab.point_code,
  ip.name                               AS point_name,
  ab.flow_direction,
  ab.bid_capacity_kwh_h,
  ab.bid_price_eur_kwh_h_yr,
  ab.status,
  ab.submitted_at,
  ab.rbp_bid_ref,
  ab.result_received_at,
  ab.allocated_capacity_kwh_h,
  ab.clearing_price_eur_kwh_h_yr,
  ab.auction_premium_eur,
  ab.contract_id,
  c.contract_number,
  ab.credit_checked,
  ab.credit_sufficient,
  ab.credit_blocked_eur,
  -- Эффективный тариф (АЕРС 05-145)
  CASE ab.flow_direction
    WHEN 'GOSPODJINCI_HORGOS' THEN 4.19 + 6.85
    WHEN 'HORGOS_GOSPODJINCI' THEN 3.25
    WHEN 'KIREVO_EXIT_SERBIA' THEN 6.00 + 4.19
    ELSE 10.19
  END                                   AS effective_tariff_eur_kwh_h_yr,
  -- Оценочная годовая выручка при победе
  ROUND(
    COALESCE(ab.allocated_capacity_kwh_h, ab.bid_capacity_kwh_h) *
    CASE ab.flow_direction
      WHEN 'GOSPODJINCI_HORGOS' THEN 4.19 + 6.85
      WHEN 'HORGOS_GOSPODJINCI' THEN 3.25
      WHEN 'KIREVO_EXIT_SERBIA' THEN 6.00 + 4.19
      ELSE 10.19
    END
  , 2)                                  AS est_annual_revenue_eur,
  ab.notes,
  ab.created_at,
  ab.updated_at
FROM auction_bids ab
JOIN auction_calendar ac ON ac.id = ab.auction_id
JOIN shippers s ON s.id = ab.shipper_id
LEFT JOIN interconnection_points ip ON ip.code = ab.point_code
LEFT JOIN contracts c ON c.id = ab.contract_id;

-- ============================================================
-- 7. VIEW: v_upcoming_auctions — следующие аукционы по IP
-- ============================================================
CREATE OR REPLACE VIEW v_upcoming_auctions AS
SELECT DISTINCT ON (ac.product_type, ac.capacity_type, ac.point_code)
  ac.id,
  ac.product_type,
  ac.capacity_type,
  ac.point_code,
  ac.auction_round,
  ac.auction_start_date,
  ac.auction_start_utc,
  ac.delivery_start,
  ac.delivery_end,
  (ac.auction_start_date - CURRENT_DATE)::INTEGER AS days_until_open,
  ac.status,
  ac.schedule_rule
FROM auction_calendar ac
WHERE ac.status IN ('UPCOMING','OPEN')
  AND ac.delivery_end > NOW()
ORDER BY
  ac.product_type,
  ac.capacity_type,
  ac.point_code,
  ac.auction_start_date ASC;

-- ============================================================
-- 8. SEED: Расписание аукционов 2025–2026 из MAR0277-24
-- ============================================================

-- ─── ANNUAL 2025–2026 ────────────────────────────────────────

-- Annual FIRM: 1st Monday of July → 07.07.2025
INSERT INTO auction_calendar (
  product_type, capacity_type, auction_round, gas_year,
  publication_date, auction_start_date, auction_start_utc,
  delivery_start, delivery_end,
  schedule_rule, cam_nc_reference, status, notes
) VALUES (
  'ANNUAL', 'FIRM', 'Annual-FIRM-2025', 2025,
  '2025-06-07', '2025-07-07', '07:00:00',
  '2025-10-01 04:00:00+00', '2026-10-01 04:00:00+00',
  '1st Monday of July',
  'CAM NC Art.12.1 / MAR0277-24 §Yearly',
  CASE WHEN '2025-07-07' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END,
  'Annual Firm Capacity Gas Year 2025/2026. Publication 30 days before start.'
);

-- Annual INTERRUPTIBLE: 3rd Monday of July → 21.07.2025
INSERT INTO auction_calendar (
  product_type, capacity_type, auction_round, gas_year,
  publication_date, auction_start_date, auction_start_utc,
  delivery_start, delivery_end,
  schedule_rule, cam_nc_reference, status, notes
) VALUES (
  'ANNUAL', 'INTERRUPTIBLE', 'Annual-INT-2025', 2025,
  '2025-07-14', '2025-07-21', '07:00:00',
  '2025-10-01 04:00:00+00', '2026-10-01 04:00:00+00',
  '3rd Monday of July',
  'CAM NC Art.12.2 / MAR0277-24 §Yearly',
  CASE WHEN '2025-07-21' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END,
  'Annual Interruptible Capacity Gas Year 2025/2026.'
);

-- ─── QUARTERLY FIRM 2025–2026 (AQC-1: Aug 4, 2025) ──────────

-- AQC-1 — Q4-2025 (Oct–Jan)
INSERT INTO auction_calendar (
  product_type, capacity_type, auction_round, gas_year,
  publication_date, auction_start_date, auction_start_utc,
  delivery_start, delivery_end,
  schedule_rule, cam_nc_reference, status
) VALUES (
  'QUARTERLY', 'FIRM', 'AQC1-Q4-2025', 2025,
  '2025-07-21', '2025-08-04', '07:00:00',
  '2025-10-01 04:00:00+00', '2026-01-01 05:00:00+00',
  '1st Monday of August',
  'CAM NC Art.13.1 / MAR0277-24 §Quarterly AQC-1',
  CASE WHEN '2025-08-04' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END
);

-- AQC-1 — Q1-2026 (Jan–Apr)
INSERT INTO auction_calendar (
  product_type, capacity_type, auction_round, gas_year,
  publication_date, auction_start_date, auction_start_utc,
  delivery_start, delivery_end,
  schedule_rule, cam_nc_reference, status
) VALUES (
  'QUARTERLY', 'FIRM', 'AQC1-Q1-2026', 2026,
  '2025-07-21', '2025-08-04', '07:00:00',
  '2026-01-01 05:00:00+00', '2026-04-01 04:00:00+00',
  '1st Monday of August',
  'CAM NC Art.13.1 / MAR0277-24 §Quarterly AQC-1',
  CASE WHEN '2025-08-04' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END
);

-- AQC-1 — Q2-2026 (Apr–Jul)
INSERT INTO auction_calendar (
  product_type, capacity_type, auction_round, gas_year,
  publication_date, auction_start_date, auction_start_utc,
  delivery_start, delivery_end,
  schedule_rule, cam_nc_reference, status
) VALUES (
  'QUARTERLY', 'FIRM', 'AQC1-Q2-2026', 2026,
  '2025-07-21', '2025-08-04', '07:00:00',
  '2026-04-01 04:00:00+00', '2026-07-01 04:00:00+00',
  '1st Monday of August',
  'CAM NC Art.13.1 / MAR0277-24 §Quarterly AQC-1',
  CASE WHEN '2025-08-04' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END
);

-- AQC-1 — Q3-2026 (Jul–Oct)
INSERT INTO auction_calendar (
  product_type, capacity_type, auction_round, gas_year,
  publication_date, auction_start_date, auction_start_utc,
  delivery_start, delivery_end,
  schedule_rule, cam_nc_reference, status
) VALUES (
  'QUARTERLY', 'FIRM', 'AQC1-Q3-2026', 2026,
  '2025-07-21', '2025-08-04', '07:00:00',
  '2026-07-01 04:00:00+00', '2026-10-01 04:00:00+00',
  '1st Monday of August',
  'CAM NC Art.13.1 / MAR0277-24 §Quarterly AQC-1',
  CASE WHEN '2025-08-04' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END
);

-- ─── QUARTERLY FIRM AQC-2 (Nov 3, 2025) ─────────────────────

-- AQC-2 — Q1-2026
INSERT INTO auction_calendar (
  product_type, capacity_type, auction_round, gas_year,
  publication_date, auction_start_date, auction_start_utc,
  delivery_start, delivery_end,
  schedule_rule, cam_nc_reference, status
) VALUES (
  'QUARTERLY', 'FIRM', 'AQC2-Q1-2026', 2026,
  '2025-10-20', '2025-11-03', '08:00:00',
  '2026-01-01 05:00:00+00', '2026-04-01 04:00:00+00',
  '1st Monday of November',
  'CAM NC Art.13.1 / MAR0277-24 §Quarterly AQC-2',
  CASE WHEN '2025-11-03' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END
);

-- AQC-2 — Q2-2026
INSERT INTO auction_calendar (
  product_type, capacity_type, auction_round, gas_year,
  publication_date, auction_start_date, auction_start_utc,
  delivery_start, delivery_end,
  schedule_rule, cam_nc_reference, status
) VALUES (
  'QUARTERLY', 'FIRM', 'AQC2-Q2-2026', 2026,
  '2025-10-20', '2025-11-03', '08:00:00',
  '2026-04-01 04:00:00+00', '2026-07-01 04:00:00+00',
  '1st Monday of November',
  'CAM NC Art.13.1 / MAR0277-24 §Quarterly AQC-2',
  CASE WHEN '2025-11-03' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END
);

-- AQC-2 — Q3-2026
INSERT INTO auction_calendar (
  product_type, capacity_type, auction_round, gas_year,
  publication_date, auction_start_date, auction_start_utc,
  delivery_start, delivery_end,
  schedule_rule, cam_nc_reference, status
) VALUES (
  'QUARTERLY', 'FIRM', 'AQC2-Q3-2026', 2026,
  '2025-10-20', '2025-11-03', '08:00:00',
  '2026-07-01 04:00:00+00', '2026-10-01 04:00:00+00',
  '1st Monday of November',
  'CAM NC Art.13.1 / MAR0277-24 §Quarterly AQC-2',
  CASE WHEN '2025-11-03' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END
);

-- ─── QUARTERLY INTERRUPTIBLE (AQC-1: Sep 1, 2025) ───────────

INSERT INTO auction_calendar (
  product_type, capacity_type, auction_round, gas_year,
  publication_date, auction_start_date, auction_start_utc,
  delivery_start, delivery_end,
  schedule_rule, cam_nc_reference, status
) VALUES
-- Q4-2025
('QUARTERLY','INTERRUPTIBLE','AQC1-INT-Q4-2025', 2025,
 '2025-08-25','2025-09-01','07:00:00',
 '2025-10-01 04:00:00+00','2026-01-01 05:00:00+00',
 '1st Monday of September','CAM NC Art.13.2 / MAR0277-24 §Quarterly INT-AQC-1',
 CASE WHEN '2025-09-01' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
-- Q1-2026
('QUARTERLY','INTERRUPTIBLE','AQC1-INT-Q1-2026', 2026,
 '2025-08-25','2025-09-01','07:00:00',
 '2026-01-01 05:00:00+00','2026-04-01 04:00:00+00',
 '1st Monday of September','CAM NC Art.13.2 / MAR0277-24 §Quarterly INT-AQC-1',
 CASE WHEN '2025-09-01' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
-- Q2-2026
('QUARTERLY','INTERRUPTIBLE','AQC1-INT-Q2-2026', 2026,
 '2025-08-25','2025-09-01','07:00:00',
 '2026-04-01 04:00:00+00','2026-07-01 04:00:00+00',
 '1st Monday of September','CAM NC Art.13.2 / MAR0277-24 §Quarterly INT-AQC-1',
 CASE WHEN '2025-09-01' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
-- Q3-2026
('QUARTERLY','INTERRUPTIBLE','AQC1-INT-Q3-2026', 2026,
 '2025-08-25','2025-09-01','07:00:00',
 '2026-07-01 04:00:00+00','2026-10-01 04:00:00+00',
 '1st Monday of September','CAM NC Art.13.2 / MAR0277-24 §Quarterly INT-AQC-1',
 CASE WHEN '2025-09-01' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END);

-- ─── MONTHLY FIRM (3rd Monday of M-1) ───────────────────────
-- Источник: MAR0277-24 §Monthly rows 8-19

INSERT INTO auction_calendar (
  product_type, capacity_type, auction_round, gas_year,
  publication_date, auction_start_date, auction_start_utc,
  delivery_start, delivery_end,
  schedule_rule, cam_nc_reference, status
) VALUES
('MONTHLY','FIRM','Monthly-FIRM-Apr-2025', 2025, '2025-03-10','2025-03-17','08:00:00', '2025-04-01 04:00:00+00','2025-05-01 04:00:00+00', '3rd Monday of M-1','CAM NC Art.14.1 / MAR0277-24 §Monthly', CASE WHEN '2025-03-17' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','FIRM','Monthly-FIRM-May-2025', 2025, '2025-04-07','2025-04-14','07:00:00', '2025-05-01 04:00:00+00','2025-06-01 04:00:00+00', '3rd Monday of M-1','CAM NC Art.14.1 / MAR0277-24 §Monthly', CASE WHEN '2025-04-14' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','FIRM','Monthly-FIRM-Jun-2025', 2025, '2025-05-12','2025-05-19','07:00:00', '2025-06-01 04:00:00+00','2025-07-01 04:00:00+00', '3rd Monday of M-1','CAM NC Art.14.1 / MAR0277-24 §Monthly', CASE WHEN '2025-05-19' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','FIRM','Monthly-FIRM-Jul-2025', 2025, '2025-06-09','2025-06-16','07:00:00', '2025-07-01 04:00:00+00','2025-08-01 04:00:00+00', '3rd Monday of M-1','CAM NC Art.14.1 / MAR0277-24 §Monthly', CASE WHEN '2025-06-16' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','FIRM','Monthly-FIRM-Aug-2025', 2025, '2025-07-14','2025-07-21','07:00:00', '2025-08-01 04:00:00+00','2025-09-01 04:00:00+00', '3rd Monday of M-1','CAM NC Art.14.1 / MAR0277-24 §Monthly', CASE WHEN '2025-07-21' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','FIRM','Monthly-FIRM-Sep-2025', 2025, '2025-08-11','2025-08-18','07:00:00', '2025-09-01 04:00:00+00','2025-10-01 04:00:00+00', '3rd Monday of M-1','CAM NC Art.14.1 / MAR0277-24 §Monthly', CASE WHEN '2025-08-18' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','FIRM','Monthly-FIRM-Oct-2025', 2025, '2025-09-08','2025-09-15','07:00:00', '2025-10-01 04:00:00+00','2025-11-01 05:00:00+00', '3rd Monday of M-1','CAM NC Art.14.1 / MAR0277-24 §Monthly', CASE WHEN '2025-09-15' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','FIRM','Monthly-FIRM-Nov-2025', 2025, '2025-10-13','2025-10-20','07:00:00', '2025-11-01 05:00:00+00','2025-12-01 05:00:00+00', '3rd Monday of M-1','CAM NC Art.14.1 / MAR0277-24 §Monthly', CASE WHEN '2025-10-20' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','FIRM','Monthly-FIRM-Dec-2025', 2025, '2025-11-10','2025-11-17','08:00:00', '2025-12-01 05:00:00+00','2026-01-01 05:00:00+00', '3rd Monday of M-1','CAM NC Art.14.1 / MAR0277-24 §Monthly', CASE WHEN '2025-11-17' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','FIRM','Monthly-FIRM-Jan-2026', 2026, '2025-12-08','2025-12-15','08:00:00', '2026-01-01 05:00:00+00','2026-02-01 05:00:00+00', '3rd Monday of M-1','CAM NC Art.14.1 / MAR0277-24 §Monthly', CASE WHEN '2025-12-15' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','FIRM','Monthly-FIRM-Feb-2026', 2026, '2026-01-12','2026-01-19','08:00:00', '2026-02-01 05:00:00+00','2026-03-01 05:00:00+00', '3rd Monday of M-1','CAM NC Art.14.1 / MAR0277-24 §Monthly', CASE WHEN '2026-01-19' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','FIRM','Monthly-FIRM-Mar-2026', 2026, '2026-02-09','2026-02-16','08:00:00', '2026-03-01 05:00:00+00','2026-04-01 04:00:00+00', '3rd Monday of M-1','CAM NC Art.14.1 / MAR0277-24 §Monthly', CASE WHEN '2026-02-16' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END);

-- ─── MONTHLY INTERRUPTIBLE (4th Tuesday of M-1) ──────────────

INSERT INTO auction_calendar (
  product_type, capacity_type, auction_round, gas_year,
  publication_date, auction_start_date, auction_start_utc,
  delivery_start, delivery_end,
  schedule_rule, cam_nc_reference, status
) VALUES
('MONTHLY','INTERRUPTIBLE','Monthly-INT-Apr-2025', 2025, '2025-03-18','2025-03-25','08:00:00', '2025-04-01 04:00:00+00','2025-05-01 04:00:00+00', '4th Tuesday of M-1','CAM NC Art.14.2 / MAR0277-24 §Monthly INT', CASE WHEN '2025-03-25' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','INTERRUPTIBLE','Monthly-INT-May-2025', 2025, '2025-04-15','2025-04-22','07:00:00', '2025-05-01 04:00:00+00','2025-06-01 04:00:00+00', '4th Tuesday of M-1','CAM NC Art.14.2 / MAR0277-24 §Monthly INT', CASE WHEN '2025-04-22' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','INTERRUPTIBLE','Monthly-INT-Jun-2025', 2025, '2025-05-20','2025-05-27','07:00:00', '2025-06-01 04:00:00+00','2025-07-01 04:00:00+00', '4th Tuesday of M-1','CAM NC Art.14.2 / MAR0277-24 §Monthly INT', CASE WHEN '2025-05-27' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','INTERRUPTIBLE','Monthly-INT-Jul-2025', 2025, '2025-06-17','2025-06-24','07:00:00', '2025-07-01 04:00:00+00','2025-08-01 04:00:00+00', '4th Tuesday of M-1','CAM NC Art.14.2 / MAR0277-24 §Monthly INT', CASE WHEN '2025-06-24' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','INTERRUPTIBLE','Monthly-INT-Aug-2025', 2025, '2025-07-22','2025-07-29','07:00:00', '2025-08-01 04:00:00+00','2025-09-01 04:00:00+00', '4th Tuesday of M-1','CAM NC Art.14.2 / MAR0277-24 §Monthly INT', CASE WHEN '2025-07-29' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','INTERRUPTIBLE','Monthly-INT-Sep-2025', 2025, '2025-08-19','2025-08-26','07:00:00', '2025-09-01 04:00:00+00','2025-10-01 04:00:00+00', '4th Tuesday of M-1','CAM NC Art.14.2 / MAR0277-24 §Monthly INT', CASE WHEN '2025-08-26' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','INTERRUPTIBLE','Monthly-INT-Oct-2025', 2025, '2025-09-16','2025-09-23','07:00:00', '2025-10-01 04:00:00+00','2025-11-01 05:00:00+00', '4th Tuesday of M-1','CAM NC Art.14.2 / MAR0277-24 §Monthly INT', CASE WHEN '2025-09-23' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','INTERRUPTIBLE','Monthly-INT-Nov-2025', 2025, '2025-10-21','2025-10-28','08:00:00', '2025-11-01 05:00:00+00','2025-12-01 05:00:00+00', '4th Tuesday of M-1','CAM NC Art.14.2 / MAR0277-24 §Monthly INT', CASE WHEN '2025-10-28' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','INTERRUPTIBLE','Monthly-INT-Dec-2025', 2025, '2025-11-18','2025-11-25','08:00:00', '2025-12-01 05:00:00+00','2026-01-01 05:00:00+00', '4th Tuesday of M-1','CAM NC Art.14.2 / MAR0277-24 §Monthly INT', CASE WHEN '2025-11-25' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','INTERRUPTIBLE','Monthly-INT-Jan-2026', 2026, '2025-12-16','2025-12-23','08:00:00', '2026-01-01 05:00:00+00','2026-02-01 05:00:00+00', '4th Tuesday of M-1','CAM NC Art.14.2 / MAR0277-24 §Monthly INT', CASE WHEN '2025-12-23' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','INTERRUPTIBLE','Monthly-INT-Feb-2026', 2026, '2026-01-20','2026-01-27','08:00:00', '2026-02-01 05:00:00+00','2026-03-01 05:00:00+00', '4th Tuesday of M-1','CAM NC Art.14.2 / MAR0277-24 §Monthly INT', CASE WHEN '2026-01-27' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END),
('MONTHLY','INTERRUPTIBLE','Monthly-INT-Mar-2026', 2026, '2026-02-17','2026-02-24','08:00:00', '2026-03-01 05:00:00+00','2026-04-01 04:00:00+00', '4th Tuesday of M-1','CAM NC Art.14.2 / MAR0277-24 §Monthly INT', CASE WHEN '2026-02-24' < CURRENT_DATE THEN 'CLOSED' ELSE 'UPCOMING' END);

-- ─── DAILY — шаблонная запись (не генерируем 365 строк) ──────
-- Представлена как единая rolling-rule запись; daily аукционы
-- генерируются динамически endpoint-ом на основе этих правил

INSERT INTO auction_calendar (
  product_type, capacity_type, auction_round, gas_year,
  auction_start_date, auction_start_utc,
  delivery_start, delivery_end,
  schedule_rule, cam_nc_reference, status, notes
) VALUES (
  'DAILY', 'FIRM', 'Daily-FIRM-template', 2025,
  CURRENT_DATE, '14:30:00',   -- 15:30 UTC winter / 14:30 UTC summer
  NOW()::DATE + INTERVAL '1 day',
  NOW()::DATE + INTERVAL '2 days',
  'D-1 at 15:30 UTC (winter) / 14:30 UTC (summer)',
  'CAM NC Art.15 / MAR0277-24 §Daily',
  'OPEN',
  'Daily Firm Auction template. Repeats daily. Start 15:30/14:30 UTC D-1, run 05:00/04:00 UTC, end D+1 05:00/04:00 UTC. Source: MAR0277-24.'
);

-- ─── WITHIN-DAY — шаблон ─────────────────────────────────────
INSERT INTO auction_calendar (
  product_type, capacity_type, auction_round, gas_year,
  auction_start_date, auction_start_utc,
  delivery_start, delivery_end,
  schedule_rule, cam_nc_reference, status, notes
) VALUES (
  'WITHIN_DAY', 'FIRM', 'WithinDay-FIRM-template', 2025,
  CURRENT_DATE, '00:00:00',
  NOW(), NOW() + INTERVAL '1 day',
  'Every hour of gas day, capacity from H+4, round 30 min',
  'CAM NC Art.16 / MAR0277-24 §Within-Day',
  'OPEN',
  'Within-Day auction: bidding opens after last daily auction. '
  'Each round: 30 min, opens at hour start, capacity effective H+4. '
  'First round after FDA results. Last: 00:30 UTC (winter) / 23:30 UTC (summer). '
  'Source: MAR0277-24.'
);

-- ============================================================
-- 9. Обновить статусы прошедших аукционов
-- ============================================================
UPDATE auction_calendar
SET status = 'CLOSED'
WHERE product_type IN ('ANNUAL','QUARTERLY','MONTHLY')
  AND auction_start_date < CURRENT_DATE
  AND status = 'UPCOMING';

-- ============================================================
-- 10. Параметры аукционного модуля в system_params
-- ============================================================
INSERT INTO system_params (key, value, description, updated_at)
VALUES
  ('auction.rbp_platform_url',          '"https://rbp.eu"',         'URL платформы RBP.EU', NOW()),
  ('auction.daily_firm_open_utc',       '"15:30"',                  'Открытие Daily Firm аукциона (UTC зима)', NOW()),
  ('auction.daily_firm_open_utc_summer','"14:30"',                  'Открытие Daily Firm аукциона (UTC лето)', NOW()),
  ('auction.daily_run_utc',             '"05:00"',                  'Начало суток поставки (UTC зима)', NOW()),
  ('auction.daily_run_utc_summer',      '"04:00"',                  'Начало суток поставки (UTC лето)', NOW()),
  ('auction.within_day_round_min',      '30',                       'Длительность раунда Within-Day (минут)', NOW()),
  ('auction.within_day_h_plus',         '4',                        'Поставка Within-Day capacity: H+4', NOW()),
  ('auction.cam_nc_version',            '"CAM NC EU 2017/459"',     'Применимый регламент CAM NC', NOW()),
  ('auction.calendar_source',           '"MAR0277-24"',             'Источник расписания аукционов', NOW()),
  ('auction.calendar_valid_from',       '"2025-03-01"',             'Расписание действует с', NOW()),
  ('auction.calendar_valid_to',         '"2026-10-01"',             'Расписание действует до', NOW())
ON CONFLICT (key) DO UPDATE
  SET value      = EXCLUDED.value,
      updated_at = NOW();

COMMIT;

-- ============================================================
-- Проверочные запросы после применения:
-- SELECT product_type, capacity_type, auction_round, auction_start_date, delivery_start, delivery_end, status
-- FROM auction_calendar ORDER BY auction_start_date;
--
-- SELECT * FROM v_auction_overview WHERE days_until_open >= 0 ORDER BY days_until_open;
-- SELECT * FROM v_upcoming_auctions;
-- SELECT COUNT(*) FROM auction_calendar;  -- ожидается ~47 строк
-- ============================================================
