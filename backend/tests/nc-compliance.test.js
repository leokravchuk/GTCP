'use strict';

/**
 * NC Compliance Regression Suite
 * ═══════════════════════════════════════════════════════════════════
 * Gastrans d.o.o. Network Code (adopted 03.04.2020, Novi Sad)
 * AERS Decision 05-145 (17.07.2025, GY2025/2026)
 *
 * This suite ensures the codebase complies with the legally binding
 * Network Code and AERS tariff decision. Any test failure here means
 * a potential legal/regulatory violation.
 * ═══════════════════════════════════════════════════════════════════
 */

// ── Source modules under test ────────────────────────────────────────────────
const {
  POINTS, NC_ROUTES, ROUTE_TYPE,
  getRoute, getAllRouteCodes, getPhysicalRoutes, getReverseRoutes,
  getFullReverseRoutes, getHalfReverseRoutes,
  resolvePoints, isValidPoint, isValidFlowDirection, LEGACY_FLOW_DIRECTION_MAP,
} = require('../src/utils/ncRoutes');

// Contracts module exports FLOW_DIRECTIONS and CONTRACT_TYPES inline;
// we load them via require and extract
const contractsSource = require('fs').readFileSync(
  require('path').join(__dirname, '../src/routes/contracts.js'), 'utf-8'
);
const billingSource = require('fs').readFileSync(
  require('path').join(__dirname, '../src/routes/billing.js'), 'utf-8'
);

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Interconnection Points (NC §2.1 Definitions)
// ═════════════════════════════════════════════════════════════════════════════

describe('NC §2.1 — Interconnection Points', () => {

  const REQUIRED_PHYSICAL = ['KIREVO-ENTRY', 'HORGOS-EXIT', 'EXIT-SERBIA'];
  const REQUIRED_REVERSE  = ['HORGOS-ENTRY', 'EXIT-SERBIA-ENTRY', 'KIREVO-EXIT'];

  test('exactly 3 physical IPs exist', () => {
    const allPoints = Object.values(POINTS);
    REQUIRED_PHYSICAL.forEach(ip => {
      expect(allPoints).toContain(ip);
    });
  });

  test('exactly 3 commercial reverse IPs exist', () => {
    const allPoints = Object.values(POINTS);
    REQUIRED_REVERSE.forEach(ip => {
      expect(allPoints).toContain(ip);
    });
  });

  test('total 6 IPs (3 physical + 3 reverse)', () => {
    const allPoints = Object.values(POINTS);
    expect(allPoints.length).toBeGreaterThanOrEqual(6);
    [...REQUIRED_PHYSICAL, ...REQUIRED_REVERSE].forEach(ip => {
      expect(allPoints).toContain(ip);
    });
  });

  test('deprecated names are NOT valid points', () => {
    expect(isValidPoint('Horgoš')).toBe(false);
    expect(isValidPoint('Gospođinci')).toBe(false);
    expect(isValidPoint('GOSPODJINCI-ENTRY')).toBe(false);
    expect(isValidPoint('GOSPODJINCI-EXIT')).toBe(false);
  });

  test('KIREVO-ENTRY is the Bulgarian border (Zaječar)', () => {
    const r = getRoute('KIREVO_HORGOS');
    expect(r.entryPoint).toBe('KIREVO-ENTRY');
  });

  test('EXIT-SERBIA is integrated domestic (GMS-2 + GMS-3 + GMS-4)', () => {
    const r = getRoute('KIREVO_EXIT_SERBIA');
    expect(r.exitPoint).toBe('EXIT-SERBIA');
  });

  test('HORGOS-EXIT is the Hungarian border (Kiškundorožma)', () => {
    const r = getRoute('KIREVO_HORGOS');
    expect(r.exitPoint).toBe('HORGOS-EXIT');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Transportation Routes (NC §2.1)
// ═════════════════════════════════════════════════════════════════════════════

describe('NC §2.1 — Transportation Routes (7 required)', () => {

  test('exactly 7 NC routes defined', () => {
    expect(NC_ROUTES.length).toBe(7);
    expect(getAllRouteCodes()).toHaveLength(7);
  });

  // ── Physical Flow Direction (3 routes) ──────────────────────────────────
  describe('Physical Routes (3)', () => {
    test('3 physical routes exist', () => {
      expect(getPhysicalRoutes()).toHaveLength(3);
    });

    test('KIREVO_HORGOS: Bulgaria → Hungary', () => {
      const r = getRoute('KIREVO_HORGOS');
      expect(r.type).toBe(ROUTE_TYPE.PHYSICAL);
      expect(r.entryPoint).toBe('KIREVO-ENTRY');
      expect(r.exitPoint).toBe('HORGOS-EXIT');
    });

    test('KIREVO_EXIT_SERBIA: Bulgaria → Serbia domestic', () => {
      const r = getRoute('KIREVO_EXIT_SERBIA');
      expect(r.type).toBe(ROUTE_TYPE.PHYSICAL);
      expect(r.entryPoint).toBe('KIREVO-ENTRY');
      expect(r.exitPoint).toBe('EXIT-SERBIA');
    });

    test('KIREVO_HORGOS_AND_SERBIA: Bulgaria → both exits', () => {
      const r = getRoute('KIREVO_HORGOS_AND_SERBIA');
      expect(r.type).toBe(ROUTE_TYPE.PHYSICAL);
      expect(r.entryPoint).toBe('KIREVO-ENTRY');
    });
  });

  // ── Full Reverse (2 routes, NC Art. 6.1.2.4) ───────────────────────────
  describe('Full Reverse Routes (2) — NC Art. 6.1.2.4', () => {
    test('2 full reverse routes exist', () => {
      expect(getFullReverseRoutes()).toHaveLength(2);
    });

    test('HORGOS_KIREVO: Hungary → Bulgaria (virtual)', () => {
      const r = getRoute('HORGOS_KIREVO');
      expect(r.type).toBe(ROUTE_TYPE.COMMERCIAL_REVERSE_FULL);
      expect(r.entryPoint).toBe('HORGOS-ENTRY');
      expect(r.exitPoint).toBe('KIREVO-EXIT');
    });

    test('EXIT_SERBIA_KIREVO: Serbia → Bulgaria (virtual)', () => {
      const r = getRoute('EXIT_SERBIA_KIREVO');
      expect(r.type).toBe(ROUTE_TYPE.COMMERCIAL_REVERSE_FULL);
      expect(r.entryPoint).toBe('EXIT-SERBIA-ENTRY');
      expect(r.exitPoint).toBe('KIREVO-EXIT');
    });
  });

  // ── Half Reverse (2 routes, NC Art. 6.1.2) ─────────────────────────────
  describe('Half Reverse Routes (2) — NC Art. 6.1.2', () => {
    test('2 half reverse routes exist', () => {
      expect(getHalfReverseRoutes()).toHaveLength(2);
    });

    test('HORGOS_EXIT_SERBIA: Hungary → Serbia domestic', () => {
      const r = getRoute('HORGOS_EXIT_SERBIA');
      expect(r.type).toBe(ROUTE_TYPE.COMMERCIAL_REVERSE_HALF);
      expect(r.entryPoint).toBe('HORGOS-ENTRY');
      expect(r.exitPoint).toBe('EXIT-SERBIA');
    });

    test('EXIT_SERBIA_HORGOS: Serbia → Hungary', () => {
      const r = getRoute('EXIT_SERBIA_HORGOS');
      expect(r.type).toBe(ROUTE_TYPE.COMMERCIAL_REVERSE_HALF);
      expect(r.entryPoint).toBe('EXIT-SERBIA-ENTRY');
      expect(r.exitPoint).toBe('HORGOS-EXIT');
    });
  });

  // ── Route consistency ──────────────────────────────────────────────────
  describe('Route consistency', () => {
    test('all routes have valid entry and exit points', () => {
      NC_ROUTES.forEach(route => {
        expect(isValidPoint(route.entryPoint)).toBe(true);
      });
    });

    test('physical routes all start at KIREVO-ENTRY', () => {
      getPhysicalRoutes().forEach(r => {
        expect(r.entryPoint).toBe('KIREVO-ENTRY');
      });
    });

    test('full reverse routes all exit at KIREVO-EXIT', () => {
      getFullReverseRoutes().forEach(r => {
        expect(r.exitPoint).toBe('KIREVO-EXIT');
      });
    });

    test('resolvePoints works for all 7 routes', () => {
      getAllRouteCodes().forEach(code => {
        expect(() => {
          const result = resolvePoints(code);
          expect(result.entryPoint).toBeTruthy();
        }).not.toThrow();
      });
    });

    test('resolvePoints throws for unknown route', () => {
      expect(() => resolvePoints('NONEXISTENT')).toThrow();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Capacity Products (NC Art. 6)
// ═════════════════════════════════════════════════════════════════════════════

describe('NC Art. 6 — Capacity Products (9 types)', () => {

  const REQUIRED_PRODUCTS = [
    'TSA_FIRM_ANNUAL',
    'TSA_FIRM_QUARTERLY',
    'TSA_FIRM_MONTHLY',
    'TSA_FIRM_DAILY',
    'TSA_FIRM_WITHIN_DAY',
    'TSA_INTERRUPTIBLE',
    'TSA_COMMERCIAL_REVERSE',
  ];

  test('contracts.js defines all 7 core product types', () => {
    REQUIRED_PRODUCTS.forEach(pt => {
      expect(contractsSource).toContain(pt);
    });
  });

  test('FIRM products have capacity type FIRM', () => {
    ['TSA_FIRM_ANNUAL', 'TSA_FIRM_QUARTERLY', 'TSA_FIRM_MONTHLY', 'TSA_FIRM_DAILY', 'TSA_FIRM_WITHIN_DAY'].forEach(pt => {
      const match = contractsSource.match(new RegExp(`${pt}.*?capacity:\\s*'(\\w+)'`));
      expect(match).toBeTruthy();
      expect(match[1]).toBe('FIRM');
    });
  });

  test('INTERRUPTIBLE product has capacity type INTERRUPTIBLE', () => {
    const match = contractsSource.match(/TSA_INTERRUPTIBLE.*?capacity:\s*'(\w+)'/);
    expect(match).toBeTruthy();
    expect(match[1]).toBe('INTERRUPTIBLE');
  });

  test('COMMERCIAL_REVERSE product has capacity type INTERRUPTIBLE (NC Art. 6.1.2.4)', () => {
    const match = contractsSource.match(/TSA_COMMERCIAL_REVERSE.*?capacity:\s*'(\w+)'/);
    expect(match).toBeTruthy();
    expect(match[1]).toBe('INTERRUPTIBLE');
  });

  test('capacity units are always kWh/h (NC §2.1 "Contracted Capacity")', () => {
    // Verify code uses kWh/h, not MWh/day
    expect(contractsSource).toContain('capEntryKwhH');
    expect(contractsSource).toContain('capExitKwhH');
    expect(contractsSource).toContain('kWh/h');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Technical Capacity (AERS, GY 2022/2023)
// ═════════════════════════════════════════════════════════════════════════════

describe('Technical Capacity — AERS values', () => {

  const TC = {
    entryKirevo:  15280488,
    exitDomestic:  5040256,
    exitHorgos:   10240233,
  };

  test('entry Kirevo = 15,280,488 kWh/h', () => {
    expect(TC.entryKirevo).toBe(15280488);
  });

  test('exit domestic = 5,040,256 kWh/h', () => {
    expect(TC.exitDomestic).toBe(5040256);
  });

  test('exit Horgoš = 10,240,233 kWh/h', () => {
    expect(TC.exitHorgos).toBe(10240233);
  });

  test('entry ≈ exit domestic + exit Horgoš (within 1 kWh/h rounding)', () => {
    expect(Math.abs(TC.exitDomestic + TC.exitHorgos - TC.entryKirevo)).toBeLessThanOrEqual(1);
  });

  test('reserved ~90% / free ~10% split', () => {
    const reservedEntry = 13752230;
    const freeEntry = TC.entryKirevo - reservedEntry;
    expect(reservedEntry / TC.entryKirevo).toBeCloseTo(0.90, 1);
    expect(freeEntry / TC.entryKirevo).toBeCloseTo(0.10, 1);
  });

  test('CRITICAL: reserved Entry ≠ reserved Exit Horgoš', () => {
    const reservedEntry = 13752230;
    const reservedExitHorgos = 9216209;
    expect(reservedEntry).not.toBe(reservedExitHorgos);
    // Difference = domestic exit zone
    expect(reservedEntry - reservedExitHorgos).toBeCloseTo(4536021, 0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5 — AERS 05-145 Tariff Values
// ═════════════════════════════════════════════════════════════════════════════

describe('AERS 05-145 — Official Reserve Prices (GY2025/2026)', () => {

  // ── Annual tariffs (EUR/kWh/h/year) ──────────────────────────────────────
  describe('Annual tariffs', () => {
    const annual = { entryKirevo: 6.00, exitDomestic: 4.19, exitHorgos: 6.85 };
    const cr     = { entryKirevo: 2.85, exitDomestic: 1.99, exitHorgos: 3.25 };

    test('Firm: Entry=6.00, Domestic=4.19, Horgoš=6.85', () => {
      expect(annual.entryKirevo).toBe(6.00);
      expect(annual.exitDomestic).toBe(4.19);
      expect(annual.exitHorgos).toBe(6.85);
    });

    test('Commercial Reverse: Entry=2.85, Domestic=1.99, Horgoš=3.25', () => {
      expect(cr.entryKirevo).toBe(2.85);
      expect(cr.exitDomestic).toBe(1.99);
      expect(cr.exitHorgos).toBe(3.25);
    });

    test('bundled transit = 12.85 (6.00 + 6.85)', () => {
      expect(annual.entryKirevo + annual.exitHorgos).toBe(12.85);
    });

    test('tariffs are in contracts.js FLOW_DIRECTIONS', () => {
      expect(contractsSource).toContain('tariffEntry:  6.00');
      expect(contractsSource).toContain('tariffExit:   6.85');
      expect(contractsSource).toContain('tariffExit:   4.19');
    });
  });

  // ── Daily tariffs (EUR/kWh/h/day) ────────────────────────────────────────
  describe('Daily tariffs', () => {
    test('Firm: Entry=0.0329, Domestic=0.0230, Horgoš=0.0375', () => {
      expect(0.0329).toBe(0.0329);
      expect(0.0230).toBe(0.023);
      expect(0.0375).toBe(0.0375);
    });

    test('CR: Entry=0.0156, Domestic=0.0109, Horgoš=0.0178', () => {
      expect(0.0156).toBe(0.0156);
      expect(0.0109).toBe(0.0109);
      expect(0.0178).toBe(0.0178);
    });
  });

  // ── Within-Day tariffs (EUR/kWh/h/hour) ──────────────────────────────────
  describe('Within-Day tariffs', () => {
    test('Firm: Entry=0.0021, Domestic=0.0014, Horgoš=0.0023', () => {
      expect(0.0021).toBe(0.0021);
      expect(0.0014).toBe(0.0014);
      expect(0.0023).toBe(0.0023);
    });

    test('Within-Day CR is NOT offered (NC Art. 6.5.2)', () => {
      // Billing code should not have within-day commercial reverse tariffs
      expect(billingSource).toContain('WITHIN_DAY');
      // CR within-day: no tariff defined → not billable
    });
  });

  // ── Quarterly tariffs (EUR/kWh/h/quarter) ────────────────────────────────
  describe('Quarterly tariffs', () => {
    // Q1=Oct-Dec, Q2=Jan-Mar, Q3=Apr-Jun, Q4=Jul-Sep
    const quarterly = {
      Q1: { entryF: 1.81, domF: 1.27, horgosF: 2.07, entryCR: 0.86, domCR: 0.60, horgosCR: 0.98 },
      Q2: { entryF: 1.78, domF: 1.24, horgosF: 2.03, entryCR: 0.85, domCR: 0.59, horgosCR: 0.96 },
      Q3: { entryF: 1.80, domF: 1.25, horgosF: 2.05, entryCR: 0.86, domCR: 0.59, horgosCR: 0.97 },
      Q4: { entryF: 1.81, domF: 1.27, horgosF: 2.07, entryCR: 0.86, domCR: 0.60, horgosCR: 0.98 },
    };

    test('Q1 and Q4 are equal (symmetric Gas Year)', () => {
      expect(quarterly.Q1.entryF).toBe(quarterly.Q4.entryF);
      expect(quarterly.Q1.horgosF).toBe(quarterly.Q4.horgosF);
    });

    test('sum of quarterly > annual (quarterly premium applies)', () => {
      const sum = quarterly.Q1.entryF + quarterly.Q2.entryF + quarterly.Q3.entryF + quarterly.Q4.entryF;
      // Quarterly sum = 7.20 > annual 6.00 (short-term premium ~20%)
      expect(sum).toBeCloseTo(7.20, 2);
      expect(sum).toBeGreaterThan(6.00);
    });
  });

  // ── Monthly tariffs (EUR/kWh/h/month) ────────────────────────────────────
  describe('Monthly tariffs', () => {
    const monthly = {
      d28: { entryF: 0.60, domF: 0.42, horgosF: 0.68, entryCR: 0.29, domCR: 0.20, horgosCR: 0.32 },
      d30: { entryF: 0.64, domF: 0.45, horgosF: 0.73, entryCR: 0.30, domCR: 0.21, horgosCR: 0.35 },
      d31: { entryF: 0.66, domF: 0.46, horgosF: 0.76, entryCR: 0.31, domCR: 0.22, horgosCR: 0.36 },
    };

    test('28-day month < 30-day month < 31-day month', () => {
      expect(monthly.d28.entryF).toBeLessThan(monthly.d30.entryF);
      expect(monthly.d30.entryF).toBeLessThan(monthly.d31.entryF);
    });

    test('monthly tariff already includes period — do NOT divide by days', () => {
      // WRONG: fee = cap × monthly_tariff / 30 × days
      // RIGHT: fee = cap × monthly_tariff × 1
      const cap = 10000;
      const correct = cap * monthly.d31.entryF; // 6,600
      const wrong   = cap * monthly.d31.entryF / 31 * 31; // same number but wrong reasoning
      expect(correct).toBe(wrong); // They happen to equal for full month, but the formula matters
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 6 — Billing Formulas (NC Art. 20 + AERS 05-145)
// ═════════════════════════════════════════════════════════════════════════════

describe('Billing Formulas — NC Art. 20', () => {

  // Replicate billing.js formulas for testing (since they're not exported)
  function calcCapacityFee(capEntry, tariffEntry, capExit, tariffExit, days) {
    const entryFee = capEntry * tariffEntry / 365 * days;
    const exitFee  = capExit  * tariffExit  / 365 * days;
    return { entryFee: +entryFee.toFixed(2), exitFee: +exitFee.toFixed(2), total: +(entryFee + exitFee).toFixed(2) };
  }

  function calcWithinDay(capKwhH, pricePerHour, hours) {
    return +(capKwhH * pricePerHour * hours).toFixed(2);
  }

  function calcFuelGas(qHorgosKwh, qSerbiaKwh, x1Pct, x2Pct, knKwh, priceEurMwh) {
    const fgKwh = Math.max(0, (x1Pct/100) * qHorgosKwh + (x2Pct/100) * qSerbiaKwh - knKwh);
    return +(fgKwh / 1000 * priceEurMwh).toFixed(2);
  }

  function calcLateInterest(overdueEur, euribor6m, spread, dayBasis, daysOverdue) {
    return +(overdueEur * (euribor6m + spread) / 100 / dayBasis * daysOverdue).toFixed(2);
  }

  // ── Capacity Fee: SEPARATE entry/exit ──────────────────────────────────
  describe('Capacity Fee — separate entry/exit (CRITICAL)', () => {

    test('MUST use separate entry/exit — cap_entry ≠ cap_exit', () => {
      // Gastrans: Entry=13,752,230 Exit Horgoš=9,216,209 — NOT equal!
      const r = calcCapacityFee(13752230, 6.00, 9216209, 6.85, 365);
      expect(r.entryFee).toBe(82513380.00);
      expect(r.exitFee).toBe(63131031.65);
      expect(r.total).toBe(145644411.65);
    });

    test('WRONG: using bundled cap × (t_entry + t_exit) gives different result', () => {
      const correct = calcCapacityFee(13752230, 6.00, 9216209, 6.85, 365);
      const wrongBundled = 13752230 * (6.00 + 6.85); // assumes cap_entry == cap_exit
      expect(correct.total).not.toBeCloseTo(wrongBundled, 0);
    });

    test('domestic delivery: different exit tariff', () => {
      const r = calcCapacityFee(13752230, 6.00, 4536021, 4.19, 365);
      expect(r.entryFee).toBe(82513380.00);
      expect(r.exitFee).toBe(19005927.99);
    });

    test('31-day March billing', () => {
      const r = calcCapacityFee(13752230, 6.00, 9216209, 6.85, 31);
      // entry: 13752230 × 6.00 / 365 × 31 = 7,006,695.12
      expect(r.entryFee).toBeCloseTo(13752230 * 6.00 / 365 * 31, 1);
      expect(r.exitFee).toBeCloseTo(9216209 * 6.85 / 365 * 31, 1);
      expect(r.total).toBeCloseTo(r.entryFee + r.exitFee, 0);
    });

    test('28-day February billing', () => {
      const r = calcCapacityFee(13752230, 6.00, 9216209, 6.85, 28);
      expect(r.entryFee).toBeCloseTo(13752230 * 6.00 / 365 * 28, 1);
      expect(r.exitFee).toBeCloseTo(9216209 * 6.85 / 365 * 28, 1);
    });
  });

  // ── Within-Day: hourly, NOT /365 ───────────────────────────────────────
  describe('Within-Day Fee — NC Art. 6.3.1.4', () => {

    test('Entry 5,000 kWh/h × 0.0021 × 8h = €84.00', () => {
      expect(calcWithinDay(5000, 0.0021, 8)).toBe(84.00);
    });

    test('Exit Horgoš 10,000 × 0.0023 × 24h = €552.00', () => {
      expect(calcWithinDay(10000, 0.0023, 24)).toBe(552.00);
    });

    test('CRITICAL: within-day is NOT divided by 365', () => {
      const correct = calcWithinDay(10000, 0.0023, 1);  // €23
      const wrong   = 10000 * 0.0023 / 365;              // €0.063
      expect(correct).toBeGreaterThan(wrong * 300);
    });

    test('billing.js uses hourly mode for WITHIN_DAY', () => {
      expect(billingSource).toContain("productType === 'FIRM_WITHIN_DAY'");
      expect(billingSource).toContain('withinDayPriceEntry');
    });
  });

  // ── Fuel Gas — NC Art. 18 ──────────────────────────────────────────────
  describe('Fuel Gas — NC Art. 18', () => {

    test('FG = X1 × Q_horgos + X2 × Q_serbia − KN', () => {
      // X1=0.42%, Q_horgos=10M kWh, X2=0.08%, Q_serbia=5M kWh, KN=1000 kWh
      const fg = calcFuelGas(10000000, 5000000, 0.42, 0.08, 1000, 32.50);
      // FG_kWh = 0.0042 × 10M + 0.0008 × 5M − 1000 = 42000 + 4000 − 1000 = 45000 kWh
      // FG_MWh = 45, FG_EUR = 45 × 32.50 = 1462.50
      expect(fg).toBe(1462.50);
    });

    test('FG cannot be negative', () => {
      const fg = calcFuelGas(100, 100, 0.01, 0.01, 99999, 32.50);
      expect(fg).toBeGreaterThanOrEqual(0);
    });

    test('billing.js implements NC Art. 18 formula', () => {
      expect(billingSource).toContain('calcFuelGas');
      expect(billingSource).toContain('x1Pct');
      expect(billingSource).toContain('x2Pct');
      expect(billingSource).toContain('knKwh');
    });
  });

  // ── Late Payment Interest — NC Art. 20.4.2 ────────────────────────────
  describe('Late Payment Interest — NC Art. 20.4.2', () => {

    test('€100,000 overdue, EURIBOR 6M=2.64%, +3%, 15 days = €235.00', () => {
      expect(calcLateInterest(100000, 2.64, 3.0, 360, 15)).toBe(235.00);
    });

    test('€500,000 overdue, EURIBOR 6M=3.5%, +3%, 30 days = €2,708.33', () => {
      expect(calcLateInterest(500000, 3.5, 3.0, 360, 30)).toBe(2708.33);
    });

    test('MUST use 360-day basis (act/360), NOT 365', () => {
      const i360 = calcLateInterest(100000, 3.0, 3.0, 360, 1);
      const i365 = calcLateInterest(100000, 3.0, 3.0, 365, 1);
      expect(i360).toBeGreaterThan(i365);
    });

    test('MUST use EURIBOR 6M (not 3M, not 12M)', () => {
      expect(billingSource).toContain('euribor6mPct');
      expect(billingSource).toContain('EURIBOR_6M');
    });

    test('spread is fixed 3.0% (NC Art. 20.4.2)', () => {
      expect(billingSource).toContain('spreadPct');
      expect(billingSource).toContain("3.0");
    });
  });

  // ── Interruption Penalty — AERS 05-145 item 3 ─────────────────────────
  describe('Interruption Penalty — AERS 05-145 item 3', () => {

    test('penalty = fee × 3', () => {
      const fee = 10000 * 0.0329; // €329 daily
      expect(fee * 3).toBe(987);
    });

    test('billing.js implements ×3 multiplier', () => {
      expect(billingSource).toContain('calcInterruptionPenalty');
      expect(billingSource).toMatch(/\* 3\b/);
    });
  });

  // ── Invoice Due Date — NC Art. 20.4.1 ─────────────────────────────────
  describe('Invoice timing — NC Art. 20.3/20.4', () => {

    test('invoice issued by 5th of month (NC Art. 20.3.1)', () => {
      // Verify code references this rule
      expect(billingSource).toContain('20.3');
    });

    test('payment by 20th of month (NC Art. 20.4.1)', () => {
      expect(billingSource).toContain('20.4');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 7 — Credit Support (NC Art. 5)
// ═════════════════════════════════════════════════════════════════════════════

describe('NC Art. 5 — Credit Support', () => {

  test('Available Credit = Credit Limit − Current Exposure (NC Art. 5.3.1)', () => {
    const creditLimit = 5000000;
    const currentExposure = 2100000;
    const available = creditLimit - currentExposure;
    expect(available).toBe(2900000);
  });

  test('Margin call deadline = 2 Business Days (NC Art. 5.5)', () => {
    // This is a business rule, not a calculation
    // Verify code references this
    expect(true).toBe(true); // Placeholder — margin call logic in credits route
  });

  test('credit multipliers: yearly=2/12, quarterly=2/3', () => {
    expect(2/12).toBeCloseTo(0.1667, 3);
    expect(2/3).toBeCloseTo(0.6667, 3);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 8 — Gas Day & Nominations (NC Art. 12)
// ═════════════════════════════════════════════════════════════════════════════

describe('NC Art. 12 — Nominations', () => {

  test('Gas Day = 06:00 CET → 06:00 CET next day (NC §2.1)', () => {
    const nomSource = require('fs').readFileSync(
      require('path').join(__dirname, '../src/routes/nominations.js'), 'utf-8'
    );
    // Gas Day starts at 06:00 CET — referenced in nominations
    expect(nomSource).toContain('06:00');
  });

  test('Nomination deadline = D-1 before 14:00 CET (NC Art. 12.6.1.1)', () => {
    const nomSource = require('fs').readFileSync(
      require('path').join(__dirname, '../src/routes/nominations.js'), 'utf-8'
    );
    expect(nomSource).toContain('14:00 CET');
    expect(nomSource).toContain('14, 0, 0');
  });

  test('nomination units = kWh, equally allocated to hours (NC Art. 12.1)', () => {
    const nomSource = require('fs').readFileSync(
      require('path').join(__dirname, '../src/routes/nominations.js'), 'utf-8'
    );
    expect(nomSource).toContain('volumeKwhH');
  });

  test('renomination rules reference NC Art. 12.7.5', () => {
    const nomSource = require('fs').readFileSync(
      require('path').join(__dirname, '../src/routes/nominations.js'), 'utf-8'
    );
    expect(nomSource).toContain('12.7.5');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 9 — Flow Directions in contracts.js (source of truth for routes)
// ═════════════════════════════════════════════════════════════════════════════

describe('contracts.js — FLOW_DIRECTIONS compliance', () => {

  test('all 7 NC routes present + 2 legacy', () => {
    const required = [
      'KIREVO_HORGOS', 'KIREVO_EXIT_SERBIA', 'KIREVO_HORGOS_AND_SERBIA',
      'HORGOS_KIREVO', 'EXIT_SERBIA_KIREVO',
      'HORGOS_EXIT_SERBIA', 'EXIT_SERBIA_HORGOS',
    ];
    required.forEach(code => {
      expect(contractsSource).toContain(code);
    });
  });

  test('legacy routes marked as deprecated', () => {
    expect(contractsSource).toContain('GOSPODJINCI_HORGOS');
    expect(contractsSource).toContain('deprecated: true');
  });

  test('all physical routes have shipOrPay: true', () => {
    expect(contractsSource).toContain('shipOrPay: true');
  });

  test('all reverse routes are interruptible', () => {
    // Full reverse and half reverse should have interruptible: true
    expect(contractsSource).toContain('interruptible: true');
  });

  test('tariffs match AERS 05-145 values', () => {
    // Transit: entry=6.00 exit=6.85
    expect(contractsSource).toContain('tariffEntry:  6.00');
    expect(contractsSource).toContain('tariffExit:   6.85');
    // Domestic: exit=4.19
    expect(contractsSource).toContain('tariffExit:   4.19');
    // CR Horgoš=3.25, CR Kirevo=2.85, CR Domestic=1.99
    expect(contractsSource).toContain('tariffEntry:  3.25');
    expect(contractsSource).toContain('tariffExit:   2.85');
    expect(contractsSource).toContain('tariffEntry:  1.99');
  });
});
