/**
 * GTCP — Gas Trading & Commercial Platform
 * 1С ERP Connector (REST / HTTP API)
 *
 * Интеграция с 1С:Предприятие 8.3 через REST-сервисы (Gastrans Serbia ERP).
 * NC Art.20 — синхронизация данных биллинга и платёжных транзакций.
 *
 * Конфигурация (/.env.production):
 *   ERP_BASE_URL=http://1c-server.gastrans.rs:8080/gest_prod/hs
 *   ERP_USER=gtcp_service
 *   ERP_PASSWORD=<password>
 *   ERP_TIMEOUT_MS=15000
 *
 * Эндпоинты 1С (REST-сервис "gtcp_integration"):
 *   GET  /invoices          — список счетов по периоду
 *   GET  /invoices/:id      — детали счёта
 *   POST /invoices          — создать/обновить счёт
 *   GET  /payments          — платёжные транзакции
 *   POST /payments          — зарегистрировать платёж
 *   GET  /counterparties    — справочник контрагентов
 *   GET  /health            — статус соединения
 */

'use strict';

const https  = require('https');
const http   = require('http');
const { URL } = require('url');

// ── Config ────────────────────────────────────────────────────────────────────
const ERP_CONFIG = {
  baseUrl:    process.env.ERP_BASE_URL    || 'http://localhost:8080/gest_prod/hs',
  user:       process.env.ERP_USER        || 'gtcp_service',
  password:   process.env.ERP_PASSWORD    || '',
  timeoutMs:  parseInt(process.env.ERP_TIMEOUT_MS || '15000', 10),
  mockMode:   process.env.ERP_MOCK === 'true' || process.env.NODE_ENV === 'test',
};

// ── Logger ────────────────────────────────────────────────────────────────────
const log = {
  info:  (...a) => console.log('[ERP]', ...a),
  warn:  (...a) => console.warn('[ERP]', ...a),
  error: (...a) => console.error('[ERP]', ...a),
};

// ── HTTP client (no external deps) ───────────────────────────────────────────
async function erpRequest(method, path, body = null) {
  if (ERP_CONFIG.mockMode) {
    log.info(`[MOCK] ${method} ${path}`, body ? JSON.stringify(body) : '');
    return _mockResponse(method, path, body);
  }

  const url  = new URL(path, ERP_CONFIG.baseUrl);
  const auth = Buffer.from(`${ERP_CONFIG.user}:${ERP_CONFIG.password}`).toString('base64');
  const payload = body ? JSON.stringify(body) : null;

  const options = {
    method,
    hostname: url.hostname,
    port:     url.port || (url.protocol === 'https:' ? 443 : 80),
    path:     url.pathname + url.search,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    },
    timeout: ERP_CONFIG.timeoutMs,
  };
  if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(options, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new ErpError(`HTTP ${res.statusCode}`, res.statusCode, data));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', err => reject(new ErpError(`Network: ${err.message}`, 0, null)));
    req.on('timeout', ()  => { req.destroy(); reject(new ErpError('Timeout', 408, null)); });
    if (payload) req.write(payload);
    req.end();
  });
}

class ErpError extends Error {
  constructor(message, statusCode, body) {
    super(message);
    this.name = 'ErpError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Проверка соединения с 1С ERP.
 * @returns {{ ok: boolean, version: string, ts: string }}
 */
async function healthCheck() {
  try {
    const res = await erpRequest('GET', '/health');
    return { ok: true, version: res.version || '8.3', ts: new Date().toISOString() };
  } catch (err) {
    log.error('healthCheck failed:', err.message);
    return { ok: false, error: err.message, ts: new Date().toISOString() };
  }
}

/**
 * Получить список счетов за период.
 * @param {string} dateFrom  ISO date 'YYYY-MM-DD'
 * @param {string} dateTo    ISO date 'YYYY-MM-DD'
 * @param {string} [status]  'ISSUED' | 'PAID' | 'OVERDUE'
 * @returns {Array<ErpInvoice>}
 */
async function getInvoices(dateFrom, dateTo, status = null) {
  const params = new URLSearchParams({ dateFrom, dateTo });
  if (status) params.append('status', status);
  const data = await erpRequest('GET', `/invoices?${params}`);
  return (data.invoices || data || []).map(_mapErpInvoice);
}

/**
 * Получить один счёт по ID.
 * @param {string} invoiceId
 * @returns {ErpInvoice}
 */
async function getInvoice(invoiceId) {
  const data = await erpRequest('GET', `/invoices/${encodeURIComponent(invoiceId)}`);
  return _mapErpInvoice(data);
}

/**
 * Синхронизировать счёт GTCP → 1С ERP (NC Art.20).
 * Создаёт или обновляет счёт в 1С.
 * @param {object} invoice  GTCP invoice object
 * @returns {{ erpId: string, status: string }}
 */
async function syncInvoice(invoice) {
  const payload = _toErpInvoice(invoice);
  log.info(`Syncing invoice ${invoice.id} → ERP`);
  const res = await erpRequest('POST', '/invoices', payload);
  log.info(`Invoice ${invoice.id} synced: ERP ID = ${res.id || res.erpId}`);
  return { erpId: res.id || res.erpId, status: res.status || 'SYNCED' };
}

/**
 * Получить платёжные транзакции за период.
 * @param {string} dateFrom
 * @param {string} dateTo
 * @returns {Array<ErpPayment>}
 */
async function getPayments(dateFrom, dateTo) {
  const params = new URLSearchParams({ dateFrom, dateTo });
  const data = await erpRequest('GET', `/payments?${params}`);
  return (data.payments || data || []).map(_mapErpPayment);
}

/**
 * Зарегистрировать платёж в 1С ERP.
 * @param {string} invoiceId  GTCP invoice ID
 * @param {number} amount     EUR
 * @param {string} paidAt     ISO date
 * @returns {{ erpPaymentId: string }}
 */
async function registerPayment(invoiceId, amount, paidAt) {
  const res = await erpRequest('POST', '/payments', {
    invoiceRef: invoiceId,
    amount:     Math.round(amount * 100) / 100,
    currency:   'EUR',
    paidAt,
  });
  log.info(`Payment registered: ${invoiceId} — EUR ${amount}`);
  return { erpPaymentId: res.id || res.paymentId };
}

/**
 * Справочник контрагентов из 1С.
 * @returns {Array<{ erpId, name, inn, kpp }>}
 */
async function getCounterparties() {
  const data = await erpRequest('GET', '/counterparties');
  return (data.items || data || []).map(c => ({
    erpId: c.Ref_Key || c.id,
    name:  c.Description || c.name,
    inn:   c.ИНН || c.inn || null,
    kpp:   c.КПП || c.kpp || null,
  }));
}

// ── Field mappers ─────────────────────────────────────────────────────────────

function _mapErpInvoice(raw) {
  return {
    erpId:       raw.Ref_Key      || raw.id,
    gtcpId:      raw.НомерГТЦП   || raw.gtcpId  || null,
    number:      raw.Number       || raw.number,
    date:        raw.Date         || raw.date,
    counterparty:raw.Контрагент   || raw.counterparty,
    amount:      parseFloat(raw.СуммаДокумента || raw.amount || 0),
    currency:    raw.Валюта       || raw.currency || 'EUR',
    status:      _mapErpStatus(raw.Статус || raw.status),
    paidAt:      raw.ДатаОплаты   || raw.paidAt  || null,
  };
}

function _mapErpPayment(raw) {
  return {
    erpId:       raw.Ref_Key   || raw.id,
    invoiceRef:  raw.ОснДок    || raw.invoiceRef,
    amount:      parseFloat(raw.СуммаДокумента || raw.amount || 0),
    currency:    raw.Валюта    || 'EUR',
    paidAt:      raw.Дата      || raw.date,
  };
}

function _toErpInvoice(inv) {
  return {
    gtcpId:      inv.id,
    НомерГТЦП:   inv.id,
    Date:        inv.from || inv.date,
    Number:      inv.id,
    СуммаДокумента: inv.amount || 0,
    Валюта:      'EUR',
    Контрагент:  inv.shipperId,
    Статус:      inv.status,
    ПериодС:     inv.from,
    ПериодПо:    inv.to,
    НомерGTA:    inv.contractId || null,
  };
}

function _mapErpStatus(s) {
  const map = {
    'Выставлен':'ISSUED', 'Оплачен':'PAID',
    'Просрочен':'OVERDUE','Ожидает':'WAITING',
    'ISSUED':'ISSUED','PAID':'PAID','OVERDUE':'OVERDUE',
  };
  return map[s] || s || 'UNKNOWN';
}

// ── Mock responses (used in tests + ERP_MOCK=true) ────────────────────────────

function _mockResponse(method, path, body) {
  if (path === '/health')
    return { version: '8.3.24.1', status: 'OK' };
  if (path.startsWith('/invoices') && method === 'GET')
    return { invoices: [
      { id:'ERP-INV-001', gtcpId:'INV-2026-0001', Number:'00001', Date:'2026-03-01',
        Контрагент:'SHP-001', СуммаДокумента:45000, Валюта:'EUR', Статус:'Оплачен' },
    ] };
  if (path === '/invoices' && method === 'POST')
    return { id:`ERP-INV-${Date.now()}`, status:'SYNCED' };
  if (path.startsWith('/payments') && method === 'GET')
    return { payments: [] };
  if (path === '/payments' && method === 'POST')
    return { id:`ERP-PAY-${Date.now()}`, paymentId:`ERP-PAY-${Date.now()}` };
  if (path === '/counterparties')
    return { items: [
      { Ref_Key:'cp-001', Description:'ОАО Газпром Экспорт', ИНН:'7736215859' },
      { Ref_Key:'cp-002', Description:'Repower Gas AG' },
    ] };
  return {};
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  healthCheck,
  getInvoices,
  getInvoice,
  syncInvoice,
  getPayments,
  registerPayment,
  getCounterparties,
  ErpError,
  // expose config for tests
  _config: ERP_CONFIG,
};
