/**
 * GTCP API Client — api.js
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
 * Usage:
 *   <script src="api.js"></script>
 *   const { data, error } = await API.login('admin', 'Admin@2026!');
 *   const { data: noms }  = await API.nominations.list({ gas_day: '2026-03-23' });
 * ─────────────────────────────────────────────────────────────────────────────
 */

const API = (() => {
  // ── Config ──────────────────────────────────────────────────────────────────
  const BASE_URL    = window.GTCP_API_URL || 'http://localhost:3000/api/v1';
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
  /**
   * _fetch — internal, handles auth header + JSON parsing.
   * @param {string}  endpoint  — e.g. '/nominations'
   * @param {object}  options   — standard fetch options
   * @param {boolean} retry     — internal: prevent infinite refresh loop
   * @returns {{ data: any, error: string|null, status: number }}
   */
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
        return _fetch(endpoint, options, false); // retry with new token
      }
      // Refresh failed — force logout
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

    async me() {
      return get('/auth/me');
    },

    getUser,
    clearTokens,
    isAuthenticated: () => !!getAccessToken(),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Shippers
  // ═══════════════════════════════════════════════════════════════════════════
  const shippers = {
    list:   ()      => get('/shippers'),
    get:    (id)    => get(`/shippers/${id}`),
    create: (body)  => post('/shippers', body),
    update: (id, b) => patch(`/shippers/${id}`, b),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Nominations
  // ═══════════════════════════════════════════════════════════════════════════
  const nominations = {
    list:    (params) => get('/nominations', params),
    get:     (id)     => get(`/nominations/${id}`),
    create:  (body)   => post('/nominations', body),
    match:   (gasDay) => post('/nominations/match', { gasDay }),
    renom:   (id, body) => post(`/nominations/${id}/renom`, body),
    setStatus: (id, status) => patch(`/nominations/${id}/status`, { status }),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Credits
  // ═══════════════════════════════════════════════════════════════════════════
  const credits = {
    list:          ()          => get('/credits'),
    get:           (shipperId) => get(`/credits/${shipperId}`),
    marginCalls:   ()          => get('/credits/margin-calls'),
    issueMarginCall: (shipperId, body) => post(`/credits/${shipperId}/margin-call`, body),
    updateMarginCall: (id, body)       => patch(`/credits/margin-calls/${id}`, body),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Billing
  // ═══════════════════════════════════════════════════════════════════════════
  const billing = {
    list:       (params) => get('/billing', params),
    get:        (id)     => get(`/billing/${id}`),
    create:     (body)   => post('/billing', body),
    setStatus:  (id, status) => patch(`/billing/${id}/status`, { status }),
    erpSync:    (id)         => post(`/billing/${id}/erp-sync`, {}),
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
  // Capacity
  // ═══════════════════════════════════════════════════════════════════════════
  const capacity = {
    list:    ()      => get('/capacity'),
    summary: ()      => get('/capacity/summary'),
    get:     (id)    => get(`/capacity/${id}`),
    create:  (body)  => post('/capacity', body),
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

  // ── Public API ───────────────────────────────────────────────────────────────
  return {
    auth,
    shippers,
    nominations,
    credits,
    billing,
    contracts,
    capacity,
    balance,
    audit,
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
  // The GTCP_MVP.html login screen will handle this if integrated
  if (typeof showLoginScreen === 'function') {
    showLoginScreen('Session expired. Please log in again.');
  } else {
    alert('Your session has expired. Please refresh the page and log in again.');
  }
});
