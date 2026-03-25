'use strict';

/**
 * Mock pg database module.
 *
 * Usage in test files:
 *   jest.mock('../../src/db', () => require('../helpers/mockDb'));
 *
 * Each test can call:
 *   mockDb.__setQueryResult({ rows: [...], rowCount: N });
 *   mockDb.__setQuerySequence([result1, result2, ...]);   // multiple consecutive calls
 *   mockDb.__reset();
 */

let _queue = [];
let _default = { rows: [], rowCount: 0 };

const mockDb = {
  query: jest.fn(async () => {
    if (_queue.length > 0) return _queue.shift();
    return { ..._default };
  }),

  // ── Helpers ──────────────────────────────────────────────────────────────
  __setQueryResult(result) {
    _default = result;
    _queue   = [];
  },

  __setQuerySequence(results) {
    _queue = results.map(r => ({ ...r }));
  },

  __reset() {
    _default = { rows: [], rowCount: 0 };
    _queue   = [];
    mockDb.query.mockClear();
  },
};

module.exports = mockDb;
