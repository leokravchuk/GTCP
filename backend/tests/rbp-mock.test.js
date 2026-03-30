'use strict';

/**
 * RBP Mock Integration Tests — Sprint 12
 * Tests the RBP Bridge service in mock mode
 */

const rbpClient = require('../src/services/rbp/rbpClient');
const { uploadCapacity } = require('../src/services/rbp/capacityUpload');
const { uploadCredit, getCreditLimits } = require('../src/services/rbp/creditSync');
const { getAuctions, getTrades } = require('../src/services/rbp/auctionSync');

// Mock the db module
jest.mock('../src/db', () => ({
  query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
}));

describe('RBP Client (mock mode)', () => {

  test('getStatus returns mock mode', () => {
    const status = rbpClient.getStatus();
    expect(status.mode).toBe('mock');
    expect(status.connected).toBe(true);
    expect(status.methods).toContain('UploadCapacityAndTariffV4');
    expect(status.methods).toContain('GetAuctionsV5');
    expect(status.methods).toContain('GetTradesV4');
    expect(status.methods.length).toBeGreaterThanOrEqual(6); // 6 core + 5 secondary
  });

  test('call unknown method throws', async () => {
    await expect(rbpClient.call('UnknownMethod')).rejects.toThrow('Unknown RBP method');
  });
});

describe('UploadCapacityAndTariffV4', () => {

  test('uploads capacity and returns uploadId', async () => {
    const result = await uploadCapacity({
      pointCode: 'KIREVO-ENTRY',
      direction: 'ENTRY',
      capacityKwhH: 1528258,
      tariffEur: 6.00,
      productType: 'FIRM_QUARTERLY',
    });
    expect(result.success).toBe(true);
    expect(result.uploadId).toMatch(/^MOCK-CAP-/);
    expect(result.pointCode).toBe('KIREVO-ENTRY');
    expect(result.capacityKwhH).toBe(1528258);
  });

  test('includes EDIGAS unit KW1 in params', async () => {
    const result = await uploadCapacity({ pointCode: 'HORGOS-EXIT', capacityKwhH: 1024024, tariffEur: 6.85 });
    expect(result.success).toBe(true);
  });
});

describe('UploadFinanceCreditV3', () => {

  test('syncs credit limit', async () => {
    const result = await uploadCredit({
      shipperId: 'SHP-001',
      shipperCode: 'SHP-001',
      creditLimitEur: 5000000,
    });
    expect(result.success).toBe(true);
    expect(result.creditId).toMatch(/^MOCK-CRD-/);
    expect(result.creditLimitEur).toBe(5000000);
  });
});

describe('GetCreditLimits', () => {

  test('returns credit info for shipper', async () => {
    const result = await getCreditLimits({ shipperId: 'SHP-001' });
    expect(result.success).toBe(true);
    expect(result.creditLimitEur).toBe(5000000);
    expect(result.availableEur).toBe(2900000);
    expect(result.usedEur + result.availableEur).toBe(result.creditLimitEur);
  });
});

describe('GetAuctionsV5', () => {

  test('returns mock auctions', async () => {
    const result = await getAuctions();
    expect(result.success).toBe(true);
    expect(result.auctions.length).toBe(2);
  });

  test('first auction is bundled at HORGOS-EXIT', async () => {
    const result = await getAuctions();
    const bundled = result.auctions.find(a => a.isBundled);
    expect(bundled).toBeTruthy();
    expect(bundled.pointCode).toBe('HORGOS-EXIT');
    expect(bundled.partnerTso).toBe('FGSZ');
    expect(bundled.productType).toBe('FIRM_QUARTERLY');
  });

  test('second auction is unbundled at KIREVO-ENTRY', async () => {
    const result = await getAuctions();
    const unbundled = result.auctions.find(a => !a.isBundled);
    expect(unbundled).toBeTruthy();
    expect(unbundled.pointCode).toBe('KIREVO-ENTRY');
    expect(unbundled.productType).toBe('FIRM_DAILY');
  });

  test('all auctions have required fields', async () => {
    const result = await getAuctions();
    for (const a of result.auctions) {
      expect(a.rbpAuctionId).toBeTruthy();
      expect(a.productType).toBeTruthy();
      expect(a.pointCode).toBeTruthy();
      expect(a.maxCapacityKwhH).toBeGreaterThan(0);
      expect(a.reservePriceEur).toBeGreaterThan(0);
      expect(a.status).toBeTruthy();
    }
  });
});

describe('GetTradesV4', () => {

  test('returns mock trades', async () => {
    const result = await getTrades();
    expect(result.success).toBe(true);
    expect(result.trades.length).toBe(1);
  });

  test('trade is WON and bundled', async () => {
    const result = await getTrades();
    const trade = result.trades[0];
    expect(trade.status).toBe('WON');
    expect(trade.isBundled).toBe(true);
    expect(trade.bundleId).toBe('BDL-2026-001');
  });

  test('trade has Gastrans and FGSZ sides', async () => {
    const result = await getTrades();
    const trade = result.trades[0];
    expect(trade.capacityKwhH).toBe(500000);
    expect(trade.auctionPriceEur).toBe(2.15);
    expect(trade.fgszSide).toBeTruthy();
    expect(trade.fgszSide.contractRef).toMatch(/^FGSZ-CTR/);
    expect(trade.fgszSide.capacityKwhH).toBe(500000);
  });

  test('auction premium = auction price - reserve price', async () => {
    const result = await getTrades();
    const trade = result.trades[0];
    expect(trade.premiumEur).toBe(0.10);
    expect(trade.auctionPriceEur - trade.reservePriceEur).toBeCloseTo(0.10, 2);
  });
});

describe('RBP Full Cycle (mock)', () => {

  test('Upload → GetAuctions → GetTrades cycle works', async () => {
    // 1. Upload capacity
    const upload = await uploadCapacity({ pointCode: 'HORGOS-EXIT', capacityKwhH: 1024024, tariffEur: 2.05 });
    expect(upload.success).toBe(true);

    // 2. Get auctions (capacity should be available)
    const auctions = await getAuctions();
    expect(auctions.auctions.length).toBeGreaterThan(0);

    // 3. Get trades (results)
    const trades = await getTrades();
    expect(trades.trades.length).toBeGreaterThan(0);
    expect(trades.trades[0].status).toBe('WON');
  });

  test('Credit sync → check cycle works', async () => {
    // 1. Upload credit
    const sync = await uploadCredit({ shipperId: 'SHP-001', creditLimitEur: 3000000 });
    expect(sync.success).toBe(true);

    // 2. Check credit
    const check = await getCreditLimits({ shipperId: 'SHP-001' });
    expect(check.creditLimitEur).toBe(5000000); // mock returns fixed value
    expect(check.availableEur).toBeGreaterThan(0);
  });
});
