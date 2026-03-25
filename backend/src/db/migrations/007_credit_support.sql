-- ============================================================
-- Migration 007: Credit Support (NC Art. 5)
-- Gastrans Network Code — Кредитная поддержка шипперов
-- ============================================================
-- NC Art. 5.3.1 — размер гарантии по типу продукта:
--   Annual   : 2/12 годовой выручки (≈ 2 месяца)
--   Quarterly: 2/3  квартальной выручки
--   Monthly  : 100% месячной выручки
--   Daily    : 100% суточной выручки
-- NC Art. 5.2   — допустимые формы: банковская гарантия (URDG 758) или эскроу
-- NC Art. 5.4   — рейтинговое освобождение (BBB-/Baa3/≤235)
-- NC Art. 20.3.2 — блокировка кредита при открытых обязательствах
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Таблица кредитной поддержки
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_support (
  id                    SERIAL PRIMARY KEY,
  shipper_id            INTEGER NOT NULL REFERENCES shippers(id) ON DELETE RESTRICT,

  -- Форма кредитной поддержки (NC Art. 5.2)
  support_type          VARCHAR(20) NOT NULL
    CHECK (support_type IN ('BANK_GUARANTEE', 'ESCROW', 'PARENT_GUARANTEE')),

  -- Банковская гарантия (URDG 758)
  guarantee_number      VARCHAR(100),
  bank_name             VARCHAR(200),
  bank_swift            VARCHAR(20),
  bank_country          CHAR(2),                -- ISO 3166-1 alpha-2
  urdg_758_compliant    BOOLEAN      DEFAULT true,
  min_credit_rating     VARCHAR(10)  DEFAULT 'BBB-', -- Минимальный рейтинг банка

  -- Эскроу
  escrow_account        VARCHAR(100),
  escrow_bank           VARCHAR(200),
  escrow_swift          VARCHAR(20),

  -- Денежные параметры
  amount_eur            NUMERIC(18,2) NOT NULL CHECK (amount_eur > 0),
  currency              CHAR(3)      NOT NULL DEFAULT 'EUR',

  -- Срок действия
  valid_from            DATE         NOT NULL,
  valid_to              DATE,                  -- NULL = бессрочная
  auto_extend_days      INTEGER      DEFAULT 0, -- автопролонгация (дней)

  -- Статус
  status                VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING', 'CALLED')),

  -- Рейтинговое освобождение (NC Art. 5.4)
  -- Освобождение: рейтинг шиппера BBB-/Baa3 или Creditreform ≤235
  rating_exempt         BOOLEAN      DEFAULT false,
  sp_rating             VARCHAR(10),            -- S&P/Fitch: BBB-, BBB, BBB+, A-, A, etc.
  moodys_rating         VARCHAR(10),            -- Moody's: Baa3, Baa2, Baa1, A3, etc.
  creditreform_score    INTEGER,                -- ≤235 = освобождение
  rating_valid_until    DATE,                  -- Дата актуальности рейтинга
  rating_source         VARCHAR(100),           -- Источник рейтинга

  -- Покрытие по типам продуктов
  covers_annual         BOOLEAN DEFAULT true,
  covers_quarterly      BOOLEAN DEFAULT true,
  covers_monthly        BOOLEAN DEFAULT true,
  covers_daily          BOOLEAN DEFAULT true,
  covers_within_day     BOOLEAN DEFAULT true,

  -- Вызов гарантии
  called_at             TIMESTAMPTZ,
  called_amount_eur     NUMERIC(18,2),
  call_reason           TEXT,

  notes                 TEXT,
  created_by            INTEGER REFERENCES users(id),
  updated_by            INTEGER REFERENCES users(id),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_support_shipper
  ON credit_support(shipper_id);
CREATE INDEX IF NOT EXISTS idx_credit_support_status
  ON credit_support(status);
CREATE INDEX IF NOT EXISTS idx_credit_support_valid_to
  ON credit_support(valid_to)
  WHERE valid_to IS NOT NULL;

-- ============================================================
-- 2. Лог рейтинговых изменений
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_rating_history (
  id              SERIAL PRIMARY KEY,
  shipper_id      INTEGER NOT NULL REFERENCES shippers(id),
  record_date     DATE    NOT NULL DEFAULT CURRENT_DATE,
  sp_rating       VARCHAR(10),
  moodys_rating   VARCHAR(10),
  creditreform_score INTEGER,
  rating_exempt   BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  recorded_by     INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_rating_history_shipper
  ON credit_rating_history(shipper_id, record_date DESC);

-- ============================================================
-- 3. Лог вызовов / изменений статуса гарантии
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_support_events (
  id                  SERIAL PRIMARY KEY,
  credit_support_id   INTEGER NOT NULL REFERENCES credit_support(id),
  shipper_id          INTEGER NOT NULL REFERENCES shippers(id),
  event_type          VARCHAR(30) NOT NULL
    CHECK (event_type IN ('ISSUED','EXTENDED','INCREASED','DECREASED',
                          'CALLED','PARTIALLY_CALLED','RELEASED','EXPIRED','CANCELLED')),
  event_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_before_eur   NUMERIC(18,2),
  amount_after_eur    NUMERIC(18,2),
  valid_to_before     DATE,
  valid_to_after      DATE,
  notes               TEXT,
  performed_by        INTEGER REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. Добавление полей credit_limit в shippers (если не существуют)
-- ============================================================
ALTER TABLE shippers
  ADD COLUMN IF NOT EXISTS credit_form        VARCHAR(20) DEFAULT 'BANK_GUARANTEE',
  ADD COLUMN IF NOT EXISTS rating_exempt      BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS sp_rating          VARCHAR(10),
  ADD COLUMN IF NOT EXISTS moodys_rating      VARCHAR(10),
  ADD COLUMN IF NOT EXISTS creditreform_score INTEGER,
  ADD COLUMN IF NOT EXISTS credit_status      VARCHAR(20) DEFAULT 'NORMAL'
    CHECK (credit_status IN ('NORMAL','WARNING','BLOCKED','MARGIN_CALL'));

-- ============================================================
-- 5. Функция: проверить рейтинговое освобождение (NC Art. 5.4)
-- ============================================================
-- BBB- (S&P/Fitch) = инвестиционный класс
-- Baa3 (Moody's)   = инвестиционный класс
-- Creditreform ≤ 235 = хорошая кредитоспособность
CREATE OR REPLACE FUNCTION fn_check_rating_exempt(
  p_sp_rating          VARCHAR,
  p_moodys_rating      VARCHAR,
  p_creditreform_score INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  sp_grades TEXT[]    := ARRAY['BBB-','BBB','BBB+','A-','A','A+','AA-','AA','AA+','AAA'];
  moodys_grades TEXT[] := ARRAY['Baa3','Baa2','Baa1','A3','A2','A1','Aa3','Aa2','Aa1','Aaa'];
BEGIN
  -- S&P/Fitch: BBB- или лучше
  IF p_sp_rating IS NOT NULL AND p_sp_rating = ANY(sp_grades) THEN
    RETURN true;
  END IF;
  -- Moody's: Baa3 или лучше
  IF p_moodys_rating IS NOT NULL AND p_moodys_rating = ANY(moodys_grades) THEN
    RETURN true;
  END IF;
  -- Creditreform: ≤235
  IF p_creditreform_score IS NOT NULL AND p_creditreform_score <= 235 THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 6. Функция: рассчитать минимальный размер гарантии (NC Art. 5.3.1)
-- ============================================================
-- Принцип: гарантия должна покрывать N периодов capacity fee по контракту
--   Annual   → 2/12 годовой суммы
--   Quarterly→ 2/3  квартальной суммы (= 2 месяца квартала из 3)
--   Monthly  → 100% месячной суммы
--   Daily    → 100% суточной суммы
CREATE OR REPLACE FUNCTION fn_calc_min_credit_size(
  p_shipper_id  INTEGER
) RETURNS NUMERIC AS $$
DECLARE
  v_total       NUMERIC(18,2) := 0;
  r             RECORD;
BEGIN
  FOR r IN
    SELECT
      c.product_type,
      c.cap_entry_kwh_h,
      c.cap_exit_kwh_h,
      COALESCE(c.tariff_entry_eur_kwh_h_yr, 6.00) AS t_entry,
      COALESCE(c.tariff_exit_eur_kwh_h_yr,  6.85) AS t_exit,
      c.flow_direction
    FROM contracts c
    WHERE c.shipper_id = p_shipper_id
      AND c.status IN ('ACTIVE', 'PENDING')
  LOOP
    DECLARE
      v_annual_entry NUMERIC(18,2);
      v_annual_exit  NUMERIC(18,2);
      v_annual_total NUMERIC(18,2);
      v_required     NUMERIC(18,2);
    BEGIN
      -- Годовая capacity fee по контракту
      v_annual_entry := COALESCE(r.cap_entry_kwh_h, 0) * r.t_entry;
      v_annual_exit  := COALESCE(r.cap_exit_kwh_h,  0) * r.t_exit;
      v_annual_total := v_annual_entry + v_annual_exit;

      -- Минимальный размер по типу продукта (NC Art. 5.3.1)
      v_required := CASE r.product_type
        WHEN 'ANNUAL'      THEN v_annual_total * 2 / 12   -- 2/12 годовой суммы
        WHEN 'QUARTERLY'   THEN v_annual_total / 4 * 2/3  -- 2/3 квартальной суммы
        WHEN 'MONTHLY'     THEN v_annual_total / 12       -- 100% месячной суммы
        WHEN 'DAILY'       THEN v_annual_total / 365      -- 100% суточной суммы
        WHEN 'WITHIN_DAY'  THEN v_annual_total / 365 / 24 -- почасовой
        ELSE                    v_annual_total * 2 / 12   -- по умолчанию как ANNUAL
      END;
      v_total := v_total + COALESCE(v_required, 0);
    END;
  END LOOP;
  RETURN ROUND(v_total, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 7. VIEW: v_available_credit — доступный кредит по шипперу
-- ============================================================
CREATE OR REPLACE VIEW v_available_credit AS
WITH
-- Сумма активных гарантий
active_cs AS (
  SELECT
    shipper_id,
    SUM(amount_eur) FILTER (WHERE status = 'ACTIVE'
      AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)) AS total_credit_eur,
    COUNT(*) FILTER (WHERE status = 'ACTIVE'
      AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)) AS active_instruments,
    -- Истекающие в течение 30 дней
    COUNT(*) FILTER (WHERE status = 'ACTIVE'
      AND valid_to IS NOT NULL
      AND valid_to BETWEEN CURRENT_DATE AND CURRENT_DATE + 30) AS expiring_soon,
    MIN(valid_to) FILTER (WHERE status = 'ACTIVE'
      AND valid_to IS NOT NULL) AS nearest_expiry
  FROM credit_support
  GROUP BY shipper_id
),
-- Открытые счета (неоплаченные обязательства)
open_invoices AS (
  SELECT
    shipper_id,
    SUM(total_amount_eur) AS open_invoices_eur,
    SUM(total_amount_eur) FILTER (WHERE status = 'OVERDUE') AS overdue_eur
  FROM invoices
  WHERE status IN ('ISSUED', 'OVERDUE')
  GROUP BY shipper_id
),
-- Минимальный требуемый размер (NC Art. 5.3.1)
min_required AS (
  SELECT
    s.id AS shipper_id,
    fn_calc_min_credit_size(s.id) AS min_required_eur
  FROM shippers s
  WHERE s.is_active = true
)
SELECT
  s.id                AS shipper_id,
  s.code              AS shipper_code,
  s.name              AS shipper_name,
  s.rating_exempt,
  s.sp_rating,
  s.moodys_rating,
  s.creditreform_score,
  fn_check_rating_exempt(s.sp_rating, s.moodys_rating, s.creditreform_score) AS is_rating_exempt,

  -- Кредитная поддержка
  COALESCE(cs.total_credit_eur, 0)     AS total_credit_eur,
  COALESCE(cs.active_instruments, 0)   AS active_instruments,
  COALESCE(cs.expiring_soon, 0)        AS expiring_soon_count,
  cs.nearest_expiry,

  -- Обязательства
  COALESCE(oi.open_invoices_eur, 0)    AS open_invoices_eur,
  COALESCE(oi.overdue_eur, 0)          AS overdue_eur,

  -- Расчётные поля
  mr.min_required_eur,
  GREATEST(0,
    COALESCE(cs.total_credit_eur, 0)
    - COALESCE(oi.open_invoices_eur, 0)
  )                                     AS available_credit_eur,

  -- Утилизация
  CASE WHEN COALESCE(cs.total_credit_eur, 0) > 0
    THEN ROUND(COALESCE(oi.open_invoices_eur, 0)
               / cs.total_credit_eur * 100, 2)
    ELSE 0
  END                                   AS utilization_pct,

  -- Достаточность (NC Art. 5.3.1)
  CASE
    WHEN fn_check_rating_exempt(s.sp_rating, s.moodys_rating, s.creditreform_score) THEN 'EXEMPT'
    WHEN COALESCE(cs.total_credit_eur, 0) >= COALESCE(mr.min_required_eur, 0) THEN 'SUFFICIENT'
    WHEN COALESCE(cs.total_credit_eur, 0) > 0 THEN 'INSUFFICIENT'
    ELSE 'MISSING'
  END                                   AS coverage_status,

  -- Дефицит
  GREATEST(0,
    COALESCE(mr.min_required_eur, 0)
    - COALESCE(cs.total_credit_eur, 0)
  )                                     AS shortfall_eur,

  -- Риск-флаги
  (COALESCE(oi.overdue_eur, 0) > 0)    AS has_overdue,
  (COALESCE(cs.expiring_soon, 0) > 0)  AS has_expiring_soon,
  CASE
    WHEN COALESCE(oi.open_invoices_eur, 0) >= COALESCE(cs.total_credit_eur, 0) * 0.90 THEN 'CRITICAL'
    WHEN COALESCE(oi.open_invoices_eur, 0) >= COALESCE(cs.total_credit_eur, 0) * 0.75 THEN 'WARNING'
    ELSE 'OK'
  END                                   AS risk_level

FROM shippers s
LEFT JOIN active_cs cs ON cs.shipper_id = s.id
LEFT JOIN open_invoices oi ON oi.shipper_id = s.id
LEFT JOIN min_required mr ON mr.shipper_id = s.id
WHERE s.is_active = true;

-- ============================================================
-- 8. VIEW: v_credit_support_detail — детализация по инструментам
-- ============================================================
CREATE OR REPLACE VIEW v_credit_support_detail AS
SELECT
  cs.id,
  cs.shipper_id,
  s.code                                AS shipper_code,
  s.name                                AS shipper_name,
  cs.support_type,
  cs.guarantee_number,
  cs.bank_name,
  cs.bank_swift,
  cs.bank_country,
  cs.urdg_758_compliant,
  cs.escrow_account,
  cs.escrow_bank,
  cs.amount_eur,
  cs.currency,
  cs.valid_from,
  cs.valid_to,
  cs.auto_extend_days,
  cs.status,
  cs.rating_exempt,
  cs.sp_rating,
  cs.moodys_rating,
  cs.creditreform_score,
  cs.rating_valid_until,
  cs.rating_source,
  cs.covers_annual,
  cs.covers_quarterly,
  cs.covers_monthly,
  cs.covers_daily,
  cs.covers_within_day,
  cs.called_at,
  cs.called_amount_eur,
  cs.call_reason,
  cs.notes,
  -- Вычисляемые
  CASE
    WHEN cs.valid_to IS NULL THEN NULL
    ELSE (cs.valid_to - CURRENT_DATE)
  END                                   AS days_until_expiry,
  CASE
    WHEN cs.valid_to IS NOT NULL AND cs.valid_to < CURRENT_DATE THEN true
    ELSE false
  END                                   AS is_expired,
  CASE
    WHEN cs.valid_to IS NOT NULL AND cs.valid_to BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 THEN true
    ELSE false
  END                                   AS expires_soon,
  fn_check_rating_exempt(cs.sp_rating, cs.moodys_rating, cs.creditreform_score)
                                        AS is_exempt_rated,
  cs.created_at,
  cs.updated_at
FROM credit_support cs
JOIN shippers s ON s.id = cs.shipper_id;

-- ============================================================
-- 9. VIEW: v_credit_by_product — минимальный кредит по продукту (NC Art. 5.3.1)
-- ============================================================
CREATE OR REPLACE VIEW v_credit_by_product AS
SELECT
  c.shipper_id,
  s.code                                AS shipper_code,
  s.name                                AS shipper_name,
  c.product_type,
  c.id                                  AS contract_id,
  c.contract_number,
  c.flow_direction,
  COALESCE(c.cap_entry_kwh_h, 0)        AS cap_entry_kwh_h,
  COALESCE(c.cap_exit_kwh_h, 0)         AS cap_exit_kwh_h,
  COALESCE(c.tariff_entry_eur_kwh_h_yr, 6.00) AS tariff_entry,
  COALESCE(c.tariff_exit_eur_kwh_h_yr, 6.85)  AS tariff_exit,
  -- Годовая capacity fee
  ROUND(
    COALESCE(c.cap_entry_kwh_h, 0) * COALESCE(c.tariff_entry_eur_kwh_h_yr, 6.00)
    + COALESCE(c.cap_exit_kwh_h, 0) * COALESCE(c.tariff_exit_eur_kwh_h_yr, 6.85)
  , 2)                                  AS annual_capacity_fee_eur,
  -- Минимальный размер гарантии по NC Art. 5.3.1
  ROUND(CASE c.product_type
    WHEN 'ANNUAL'    THEN (COALESCE(c.cap_entry_kwh_h,0) * COALESCE(c.tariff_entry_eur_kwh_h_yr,6.00)
                          + COALESCE(c.cap_exit_kwh_h,0) * COALESCE(c.tariff_exit_eur_kwh_h_yr,6.85)) * 2/12
    WHEN 'QUARTERLY' THEN (COALESCE(c.cap_entry_kwh_h,0) * COALESCE(c.tariff_entry_eur_kwh_h_yr,6.00)
                          + COALESCE(c.cap_exit_kwh_h,0) * COALESCE(c.tariff_exit_eur_kwh_h_yr,6.85)) / 4 * 2/3
    WHEN 'MONTHLY'   THEN (COALESCE(c.cap_entry_kwh_h,0) * COALESCE(c.tariff_entry_eur_kwh_h_yr,6.00)
                          + COALESCE(c.cap_exit_kwh_h,0) * COALESCE(c.tariff_exit_eur_kwh_h_yr,6.85)) / 12
    WHEN 'DAILY'     THEN (COALESCE(c.cap_entry_kwh_h,0) * COALESCE(c.tariff_entry_eur_kwh_h_yr,6.00)
                          + COALESCE(c.cap_exit_kwh_h,0) * COALESCE(c.tariff_exit_eur_kwh_h_yr,6.85)) / 365
    ELSE                  (COALESCE(c.cap_entry_kwh_h,0) * COALESCE(c.tariff_entry_eur_kwh_h_yr,6.00)
                          + COALESCE(c.cap_exit_kwh_h,0) * COALESCE(c.tariff_exit_eur_kwh_h_yr,6.85)) * 2/12
  END, 2)                               AS min_credit_required_eur,
  -- Мультипликатор
  CASE c.product_type
    WHEN 'ANNUAL'    THEN '2/12 (≈16.7%)'
    WHEN 'QUARTERLY' THEN '2/3 квартала (≈22.2%)'
    WHEN 'MONTHLY'   THEN '100% месяца (8.3%)'
    WHEN 'DAILY'     THEN '100% суток (0.27%)'
    ELSE '2/12 (по умолчанию)'
  END                                   AS multiplier_label,
  c.status                              AS contract_status
FROM contracts c
JOIN shippers s ON s.id = c.shipper_id
WHERE c.status IN ('ACTIVE', 'PENDING');

-- ============================================================
-- 10. Триггер: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION fn_credit_support_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_credit_support_updated_at ON credit_support;
CREATE TRIGGER trg_credit_support_updated_at
  BEFORE UPDATE ON credit_support
  FOR EACH ROW EXECUTE FUNCTION fn_credit_support_updated_at();

-- ============================================================
-- 11. Функция: выдать Margin Call (обновлённая, NC Art. 5.5)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_issue_margin_call(
  p_shipper_id    INTEGER,
  p_issued_by     INTEGER,
  p_notes         TEXT DEFAULT NULL
) RETURNS TABLE (
  margin_call_id  INTEGER,
  exposure_eur    NUMERIC,
  limit_eur       NUMERIC,
  shortfall_eur   NUMERIC,
  deadline        TIMESTAMPTZ
) AS $$
DECLARE
  v_mc_id     INTEGER;
  v_exposure  NUMERIC(18,2);
  v_limit     NUMERIC(18,2);
  v_shortfall NUMERIC(18,2);
BEGIN
  -- Текущие данные по шипперу из v_available_credit
  SELECT
    open_invoices_eur,
    total_credit_eur,
    GREATEST(0, open_invoices_eur - total_credit_eur)
  INTO v_exposure, v_limit, v_shortfall
  FROM v_available_credit
  WHERE shipper_id = p_shipper_id;

  -- Создать margin call
  INSERT INTO margin_calls (shipper_id, exposure_eur, limit_eur, issued_by, notes)
  VALUES (p_shipper_id, v_exposure, v_limit, p_issued_by, p_notes)
  RETURNING id INTO v_mc_id;

  -- Обновить статус шиппера
  UPDATE shippers SET credit_status = 'MARGIN_CALL' WHERE id = p_shipper_id;

  RETURN QUERY SELECT
    v_mc_id,
    v_exposure,
    v_limit,
    v_shortfall,
    NOW() + INTERVAL '2 business days';  -- NC Art. 5.5: 2 рабочих дня на доплнение
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 12. Seed: параметры кредитной поддержки в system_params
-- ============================================================
INSERT INTO system_params (param_key, param_value, description, updated_at)
VALUES
  ('credit.min_bank_rating',    'BBB-',         'Минимальный рейтинг банка-гаранта (S&P/Fitch) NC Art.5.2', NOW()),
  ('credit.min_bank_rating_moodys', 'Baa3',     'Минимальный рейтинг банка (Moody''s) NC Art.5.2', NOW()),
  ('credit.rating_exempt_sp',   'BBB-',         'Освобождение от гарантии — рейтинг S&P/Fitch NC Art.5.4', NOW()),
  ('credit.rating_exempt_moodys','Baa3',        'Освобождение от гарантии — рейтинг Moody''s NC Art.5.4', NOW()),
  ('credit.rating_exempt_creditreform', '235',  'Освобождение — Creditreform score ≤235 NC Art.5.4', NOW()),
  ('credit.multiplier_annual',  '0.1667',       'Множитель гарантии: Annual = 2/12 NC Art.5.3.1', NOW()),
  ('credit.multiplier_quarterly','0.2222',      'Множитель гарантии: Quarterly = 2/3 квартала NC Art.5.3.1', NOW()),
  ('credit.multiplier_monthly', '0.0833',       'Множитель гарантии: Monthly = 100% месяца NC Art.5.3.1', NOW()),
  ('credit.multiplier_daily',   '0.00274',      'Множитель гарантии: Daily = 100% суток NC Art.5.3.1', NOW()),
  ('credit.margin_call_deadline_days', '2',     'Срок доплнения гарантии после Margin Call (рабочих дней) NC Art.5.5', NOW()),
  ('credit.urdg_version',       'URDG 758',     'Версия унифицированных правил для банковских гарантий', NOW())
ON CONFLICT (param_key) DO UPDATE
  SET param_value = EXCLUDED.param_value,
      description = EXCLUDED.description,
      updated_at  = NOW();

-- ============================================================
-- 13. Seed: тестовые данные кредитной поддержки
-- ============================================================
-- Примечание: shipper_id=1 (Gazprom Export) и shipper_id=2 (MET Serbia) — seed из 001_initial.sql
INSERT INTO credit_support (
  shipper_id, support_type, guarantee_number, bank_name, bank_swift,
  bank_country, urdg_758_compliant, min_credit_rating,
  amount_eur, valid_from, valid_to, status,
  covers_annual, covers_quarterly, covers_monthly, covers_daily,
  notes, created_at
) VALUES
  -- Gazprom Export: банковская гарантия Sberbank
  (1, 'BANK_GUARANTEE',
   'BG-GE-2026-001', 'Sberbank CIB', 'SABRRUMM', 'RU',
   true, 'BBB-',
   45000000.00, '2026-01-01', '2027-01-01', 'ACTIVE',
   true, true, true, true,
   'Годовая гарантия по контракту GTA-2026-001. URDG 758. Auto-extend 30d.', NOW()),

  -- MET Serbia: эскроу
  (2, 'ESCROW',
   NULL, NULL, NULL, NULL,
   false, NULL,
   8500000.00, '2026-01-01', '2026-12-31', 'ACTIVE',
   true, true, true, false,
   'Эскроу-счёт MET Serbia AG. Transit capacity GTA-2026-002.', NOW()),

  -- Пример рейтингового освобождения (Naftna industrija Srbije)
  (3, 'BANK_GUARANTEE',
   NULL, NULL, NULL, NULL,
   false, 'BBB-',
   0.00, '2026-01-01', NULL, 'ACTIVE',
   true, false, false, false,
   'Рейтинговое освобождение NC Art.5.4. SP: BBB, Creditreform: 198.', NOW())
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================
-- Проверочные запросы после применения миграции:
-- SELECT * FROM v_available_credit;
-- SELECT * FROM v_credit_by_product;
-- SELECT fn_calc_min_credit_size(1);
-- SELECT fn_check_rating_exempt('BBB-', NULL, NULL);  -- → true
-- SELECT fn_check_rating_exempt('BB+', NULL, NULL);   -- → false
-- SELECT fn_check_rating_exempt(NULL, NULL, 200);     -- → true
-- SELECT fn_check_rating_exempt(NULL, NULL, 250);     -- → false
-- ============================================================
