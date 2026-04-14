'use strict';

/**
 * Minimal CSV serializer for API export endpoints.
 * Sprint 17 · US-1706 · 15.04.2026
 *
 * RFC 4180-compliant:
 *  - values containing ", newline, or comma → wrapped in double quotes
 *  - embedded double quotes → doubled (`"` → `""`)
 *  - null/undefined → empty string
 *  - Date → ISO 8601
 *  - BOM prefix for Excel UTF-8 compatibility
 */

const DELIM = ',';
const BOM = '\ufeff';

function escapeCell(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  if (s.includes('"') || s.includes(DELIM) || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serialize rows to CSV text.
 * @param {Array<Object>} rows
 * @param {Array<{key: string, header?: string}>} columns — if omitted, keys of rows[0] are used
 * @returns {string} CSV body (with BOM)
 */
function rowsToCsv(rows, columns) {
  if (!rows || !rows.length) {
    // Empty result: emit at least the header row if columns provided
    if (columns && columns.length) {
      return BOM + columns.map(c => escapeCell(c.header || c.key)).join(DELIM) + '\n';
    }
    return BOM;
  }
  const cols = columns && columns.length
    ? columns
    : Object.keys(rows[0]).map(k => ({ key: k, header: k }));
  const headerLine = cols.map(c => escapeCell(c.header || c.key)).join(DELIM);
  const body = rows.map(row =>
    cols.map(c => escapeCell(row[c.key])).join(DELIM)
  ).join('\n');
  return BOM + headerLine + '\n' + body + (body ? '\n' : '');
}

/**
 * Send CSV response with proper headers (Content-Type, Content-Disposition).
 * @param {import('express').Response} res
 * @param {string} filenameBase — without extension
 * @param {string} csv — CSV body
 */
function sendCsv(res, filenameBase, csv) {
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${filenameBase}-${stamp}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

module.exports = { rowsToCsv, sendCsv, escapeCell };
