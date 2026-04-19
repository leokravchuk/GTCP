/**
 * GTCP API Client — api.js v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin fetch wrapper for all GTCP_MVP.html → backend communication.
 *
 * Features:
 *  • Auto-injects Authorization: Bearer <accessToken>
 *  • 401 interceptor: auto-refreshes access token via refresh token
 *  • sessionStorage token storage
 *  • Redirects to login on expired refresh token
 *  • All methods return { data, error, status }
 *
 * v2.0 — Full backend coverage (Sprint 7):
 *   auth, shippers, nominations (+ EDIGAS), credits (+ instruments, ratings,
 *   eligibility, by-product), billing (+ gas-quality, statement), contracts,
 *   capacity (+ tracker, RBP, UIOLI, surrender), auctions (+ calendar, bids
 *   lifecycle, summary, revenue-forecast), balance, audit, systemParams
 *
 * Usage:
 *   <script src="api.js"></script>
 *   const { data, error } = await API.auth.login('admin', 'Admin@2026!');
 *   const { data: noms }  = await API.nominations.list({ gas_day: '2026-03-23' });
 * ─────────────────────────────────────────────────────────────────────────────
 */

const API = (() => {
  // ── Config ──────────────────────────────────────────────────────────────────
  const BASE_URL    = window.GTCP_API_URL || 'http://localhost:3003/api/v1';
  const SS_ACCESS   = 'gtcp_access_token';
  const SS_REFRESH  = 'gtcp_refresh_token';
  const SS_USER     = 'gtcp_user';

  // ── Token helpers ────────────────────────────────────────────────────────────
  function getAccessToken()  { return sessionStorage.getItem(SS_ACCESS);  }
  function getRefreshToken() { return sessionStorage.getItem(SS_REFRESH); }

  function setTokens(accessToken, refreshToken) {
    sessionStorage.setItem(SS_ACCESS, accessToken);
    if (refreshToken) sessionStorage.setItem(SS_REFRESH, refreshToken);
  }

  function clearTokens() {
    sessionStorage.removeItem(SS_ACCESS);
    sessionStorage.removeItem(SS_REFRESH);
    sessionStorage.removeItem(SS_USER);
  }

  function setUser(user) {
    sessionStorage.setItem(SS_USER, JSON.stringify(user));
  }

  function getUser() {
    try { return JSON.parse(sessionStorage.getItem(SS_USER)); } catch { return null; }
  }

  // ── Core fetch ──────────────────────────────────────────────────────────────
  async function _fetch(endpoint, options = {}, retry = true) {
    const url = `${BASE_URL}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (networkErr) {
      return { data: null, error: 'Network error: cannot reach server', status: 0 };
    }

    // ── 401: try refresh once ────────────────────────────────────────────────
    if (response.status === 401 && retry) {
      const refreshed = await _doRefresh();
      if (refreshed) {
        return _fetch(endpoint, options, false);
      }
      clearTokens();
      window.dispatchEvent(new CustomEvent('gtcp:sessionExpired'));
      return { data: null, error: 'Session expired, please log in again', status: 401 };
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let data = null;
    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errorMsg = data?.error || `HTTP ${response.status}`;
      return { data: null, error: errorMsg, status: response.status };
    }

    return { data, error: null, status: response.status };
  }

  async function _doRefresh() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const resp = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!resp.ok) return false;
      const { accessToken, refreshToken: newRefresh } = await resp.json();
      setTokens(accessToken, newRefresh);
      return true;
    } catch {
      return false;
    }
  }

  // ── HTTP helpers ─────────────────────────────────────────────────────────────
  function get(endpoint, params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null))
    ).toString();
    return _fetch(qs ? `${endpoint}?${qs}` : endpoint, { method: 'GET' });
  }

  function post(endpoint, body) {
    return _fetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }

  function patch(endpoint, body) {
    return _fetch(endpoint, { method: 'PATCH', body: JSON.stringify(body) });
  }

  function del(endpoint) {
    return _fetch(endpoint, { method: 'DELETE' });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Auth
  // ═══════════════════════════════════════════════════════════════════════════
  const auth = {
    async login(username, password) {
      const result = await post('/auth/login', { username, password });
      if (result.data?.accessToken) {
        setTokens(result.data.accessToken, result.data.refreshToken);
        setUser(result.data.user);
      }
      return result;
    },

    async logout() {
      const result = await post('/auth/logout', {});
      clearTokens();
      return result;
    },

    me:              ()  => get('/auth/me'),
    getUser,
    clearTokens,
    isAuthenticated: ()  => !!getAccessToken(),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Shippers
  // ═══════════════════════════════════════════════════════════════════════════
  const shippers = {
    list:   (params) => get('/shippers', params),
    get:    (id)     => get(`/shippers/${id}`),
    create: (body)   => post('/shippers', body),
    update: (id, b)  => patch(`/shippers/${id}`, b),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Nominations (+ EDIGAS NC Art.12)
  // ═══════════════════════════════════════════════════════════════════════════
  const nominations = {
    list:          (params)    => get('/nominations', params),
    get:           (id)        => get(`/nominations/${id}`),
    create:        (body)      => post('/nominations', body),
    match:         (gasDay)    => post('/nominations/match', { gasDay }),
    renom:         (id, body)  => post(`/nominations/${id}/renom`, body),
    setStatus:     (id, status) => patch(`/nominations/${id}/status`, { status }),
    // EDIGAS XML integration
    edigasPreview: (id)        => get(`/nominations/${id}/edigas-nomint`),
    edigasSubmit:  (id)        => post(`/nominations/${id}/edigas-submit`, {}),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Credits (NC Art.5 — full coverage)
  // ═══════════════════════════════════════════════════════════════════════════
  const credits = {
    // Lists & summaries
    list:              (params)     => get('/credits', params),
    summary:           ()           => get('/credits/summary'),
    // Per-shipper
    get:               (shipperId)  => get(`/credits/${shipperId}`),
    getInstruments:    (shipperId)  => get(`/credits/${shipperId}/instruments`),
    getByProduct:      (shipperId)  => get(`/credits/${shipperId}/by-product`),
    getRating:         (shipperId)  => get(`/credits/${shipperId}/rating`),
    getEligibility:    (shipperId, params) => get(`/credits/${shipperId}/eligibility`, params),
    // Mutations
    updateStatus:      (shipperId, body) => patch(`/credits/${shipperId}/status`, body),
    addInstrument:     (shipperId, body) => post(`/credits/${shipperId}/instruments`, body),
    addRating:         (shipperId, body) => post(`/credits/${shipperId}/rating`, body),
    // Margin calls
    marginCalls:       (params)     => get('/credits/margin-calls', params),
    issueMarginCall:   (shipperId, body) => post(`/credits/${shipperId}/margin-call`, body),
    updateMarginCall:  (id, body)   => patch(`/credits/margin-calls/${id}`, body),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Billing (NC Art.18, Art.20)
  // ═══════════════════════════════════════════════════════════════════════════
  const billing = {
    list:       (params)     => get('/billing', params),
    get:        (id)         => get(`/billing/${id}`),
    create:     (body)       => post('/billing', body),
    setStatus:  (id, status) => patch(`/billing/${id}/status`, { status }),
    erpSync:    (id)         => post(`/billing/${id}/erp-sync`, {}),
    // New in v2.0
    gasQuality: (params)     => get('/billing/gas-quality', params),
    statement:  (id)         => get(`/billing/${id}/statement`),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Contracts
  // ═══════════════════════════════════════════════════════════════════════════
  const contracts = {
    list:   (params) => get('/contracts', params),
    get:    (id)     => get(`/contracts/${id}`),
    meta:   ()       => get('/contracts/meta'),
    create: (body)   => post('/contracts', body),
    update: (id, b)  => patch(`/contracts/${id}`, b),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Capacity (+ Tracker, RBP, UIOLI, Surrender — NC §2.1, Art.8)
  // ═══════════════════════════════════════════════════════════════════════════
  const capacity = {
    // Legacy bookings
    list:    (params) => get('/capacity', params),
    summary: ()       => get('/capacity/summary'),
    get:     (id)     => get(`/capacity/${id}`),
    create:  (body)   => post('/capacity', body),
    // Tracker (NC §2.1 interconnection points)
    tracker: {
      overview:      ()          => get('/capacity/tracker'),
      point:         (pointCode) => get(`/capacity/tracker/${pointCode}`),
      rbpOfferings:  (params)    => get('/capacity/tracker/rbp-offerings', params),
      products:      (params)    => get('/capacity/tracker/products', params),
      uioli:         (params)    => get('/capacity/tracker/uioli', params),
    },
    // Surrender (NC Art.8)
    surrender: {
      list:      (params)    => get('/capacity/surrender', params),
      create:    (body)      => post('/capacity/surrender', body),
      updateRbp: (id, body)  => patch(`/capacity/surrender/${id}/rbp`, body),
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Auctions (CAM NC EU 2017/459 — full lifecycle)
  // ═══════════════════════════════════════════════════════════════════════════
  const auctions = {
    list:    (params) => get('/auctions', params),
    summary: ()       => get('/auctions/summary'),
    revenueForecast: (params) => get('/auctions/revenue-forecast', params),
    // Calendar
    calendar: {
      list:         (params) => get('/auctions/calendar', params),
      upcoming:     ()       => get('/auctions/calendar/upcoming'),
      get:          (id)     => get(`/auctions/calendar/${id}`),
      updateStatus: (id, body) => patch(`/auctions/calendar/${id}`, body),
    },
    // Bids lifecycle: DRAFT → SUBMITTED → WON/LOST → CONTRACT_CREATED
    bids: {
      list:           (params) => get('/auctions/bids', params),
      get:            (id)     => get(`/auctions/bids/${id}`),
      create:         (body)   => post('/auctions/bids', body),
      update:         (id, b)  => patch(`/auctions/bids/${id}`, b),
      submit:         (id)     => post(`/auctions/bids/${id}/submit`, {}),
      result:         (id, body) => post(`/auctions/bids/${id}/result`, body),
      createContract: (id)     => post(`/auctions/bids/${id}/create-contract`, {}),
      cancel:         (id)     => del(`/auctions/bids/${id}`),
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Balance
  // ═══════════════════════════════════════════════════════════════════════════
  const balance = {
    daily:   (gasDay) => get('/balance', gasDay ? { gas_day: gasDay } : {}),
    summary: ()       => get('/balance/summary'),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Audit
  // ═══════════════════════════════════════════════════════════════════════════
  const audit = {
    list: (params) => get('/audit', params),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // System Parameters
  // ═══════════════════════════════════════════════════════════════════════════
  const systemParams = {
    list:   ()           => get('/system-params'),
    get:    (key)        => get(`/system-params/${key}`),
    update: (key, body)  => patch(`/system-params/${key}`, body),
    points: (params)     => get('/system-params/points', params),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Reserve Prices (AERS 05-145)
  // ═══════════════════════════════════════════════════════════════════════════
  const reservePrices = {
    list: (params) => get('/reserve-prices', params),
  };

  // ── Public API ───────────────────────────────────────────────────────────────
  return {
    auth,
    shippers,
    nominations,
    credits,
    billing,
    contracts,
    capacity,
    auctions,
    balance,
    audit,
    systemParams,
    reservePrices,
    // low-level
    get, post, patch, del,
    // config
    BASE_URL,
  };
})();

// Make available globally
window.API = API;

// ── Auto session-expired handler ─────────────────────────────────────────────
window.addEventListener('gtcp:sessionExpired', () => {
  if (typeof showLoginScreen === 'function') {
    showLoginScreen('Session expired. Please log in again.');
  } else {
    alert('Your session has expired. Please refresh the page and log in again.');
  }
});
