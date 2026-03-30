'use strict';

const db = require('../db');

/**
 * Insert audit log entry.
 * @param {Object} opts
 * @param {string} opts.actionType - CREATE | UPDATE | DELETE | STATUS_CHANGE | LOGIN | ...
 * @param {string} opts.entityType - shipper | contract | nomination | invoice | ...
 * @param {number|string} opts.entityId
 * @param {number|string} opts.userId
 * @param {string} opts.username
 * @param {string} [opts.ipAddress]
 * @param {string} [opts.description]
 * @param {Object} [opts.oldValue]
 * @param {Object} [opts.newValue]
 */
async function addAudit({ actionType, entityType, entityId, userId, username, ipAddress, description, oldValue, newValue }) {
  try {
    await db.query(
      `INSERT INTO audit_log (action_type, entity_type, entity_id, user_id, username, ip_address, description, old_value, new_value)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [actionType, entityType, entityId, userId, username, ipAddress || null, description || null,
       oldValue ? JSON.stringify(oldValue) : null,
       newValue ? JSON.stringify(newValue) : null]
    );
  } catch (err) {
    // Audit failure should not break the main operation
    const logger = require('../utils/logger');
    logger.error('Audit log insert failed', { error: err.message, actionType, entityType });
  }
}

module.exports = { addAudit };
