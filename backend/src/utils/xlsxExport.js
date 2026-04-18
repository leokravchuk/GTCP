'use strict';

/**
 * Excel (xlsx) export utility — Sprint 18 · US-1804
 *
 * Uses exceljs streaming workbook for memory efficiency.
 * Numbers are formatted as numbers, dates as dates, EUR as #,##0.00.
 */

const ExcelJS = require('exceljs');

/**
 * Column type hints for auto-formatting.
 * If a column spec includes `type`, it's used to format cells.
 */
const CELL_FORMATS = {
  number:   { numFmt: '#,##0.00' },
  integer:  { numFmt: '#,##0' },
  eur:      { numFmt: '#,##0.00 "EUR"' },
  date:     { numFmt: 'YYYY-MM-DD' },
  percent:  { numFmt: '0.0%' },
};

/**
 * Build an xlsx Buffer from rows and column definitions.
 * @param {Array<Object>} rows
 * @param {Array<{key: string, header?: string, type?: string, width?: number}>} columns
 * @param {string} [sheetName='Export']
 * @returns {Promise<Buffer>}
 */
async function rowsToXlsx(rows, columns, sheetName = 'Export') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GTCP Platform';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);

  // Define columns
  const cols = columns && columns.length
    ? columns
    : (rows.length ? Object.keys(rows[0]).map(k => ({ key: k, header: k })) : []);

  sheet.columns = cols.map(c => ({
    header: c.header || c.key,
    key: c.key,
    width: c.width || Math.max((c.header || c.key).length + 4, 14),
  }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
  headerRow.alignment = { vertical: 'middle' };

  // Add data rows
  for (const row of (rows || [])) {
    const dataRow = sheet.addRow(
      cols.reduce((acc, c) => {
        let val = row[c.key];
        // Coerce numeric strings to numbers
        if (c.type && ['number', 'integer', 'eur', 'percent'].includes(c.type) && val !== null && val !== undefined) {
          val = Number(val);
        }
        acc[c.key] = val === null || val === undefined ? '' : val;
        return acc;
      }, {})
    );
    // Apply cell formats
    cols.forEach((c, idx) => {
      if (c.type && CELL_FORMATS[c.type]) {
        dataRow.getCell(idx + 1).numFmt = CELL_FORMATS[c.type].numFmt;
      }
    });
  }

  // Auto-filter on header
  if (cols.length && rows && rows.length) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: cols.length },
    };
  }

  return workbook.xlsx.writeBuffer();
}

/**
 * Send xlsx response with proper headers.
 * @param {import('express').Response} res
 * @param {string} filenameBase
 * @param {Buffer} buffer
 */
function sendXlsx(res, filenameBase, buffer) {
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${filenameBase}-${stamp}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

module.exports = { rowsToXlsx, sendXlsx };
