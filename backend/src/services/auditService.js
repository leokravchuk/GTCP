'use strict';

const db     = require('../db');
const logger = require('../utils/logger');

/**
 * Append an entry to audit_log.
 * Non-blocking: errors are logged but never bubble up to the request lifecycle.
 *
 * @param {{
 *   actionType:  string,
 *   entityType?: string,
 *   entityId?:   string,
 *   userId?:     string,
 *   username?:   string,
 *   ipAddress?:  string,
 *   description: string,
 *   oldValue?:   object,
 *   newValue?:   object,
 * }} entry
 */
async function addAudit(entry) {
  try {
    await db.query(
      `INSERT INTO audit_log
         (action_type, entity_type, entity_id, user_id, username, ip_address,
          description, old_value, new_value)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        entry.actionType,
        entry.entityType  || null,
        entry.entityId    || null,
        entry.userId      || null,
        entry.username    || null,
        entry.ipAddress   || null,
        entry.description,
        entry.oldValue    ? JSON.stringify(entry.oldValue)  : null,
        entry.newValue    ? JSON.stringify(entry.newValue)  : null,
      ]
    );
  } catch (err) {
    logger.error('auditService.addAudit failed:', err);
  }
}

/**
 * Query the audit log with optional filters.
 * @param {{ userId?, entityType?, entityId?, actionType?, limit?, offset? }} opts
 */
async function queryAudit(opts = {}) {
  const conditions = [];
  const params     = [];
  let   i          = 1;

  if (opts.userId) {
    conditions.push(`user_id = $${i++}`);
    params.push(opts.userId);
  }
  if (opts.entityType) {
    conditions.push(`entity_type = $${i++}`);
    params.push(opts.entityType);
  }
  if (opts.entityId) {
    conditions.push(`entity_id = $${i++}`);
    params.push(opts.entityId);
  }
  if (opts.actionType) {
    conditions.push(`action_type = $${i++}`);
    params.push(opts.actionType);
  }

  const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit  = opts.limit  || 100;
  const offset = opts.offset || 0;

  const { rows } = await db.query(
    `SELECT * FROM audit_log ${where}
     ORDER BY occurred_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset]
  );
  return rows;
}

module.exports = { addAudit, queryAudit };
