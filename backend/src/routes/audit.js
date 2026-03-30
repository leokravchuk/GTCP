'use strict';

const express = require('express');
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

// GET /audit — audit log (admin only)
router.get('/', authorize('audit:read'), async (req, res, next) => {
  const { entity_type, action_type, user_id, limit = 100, offset = 0 } = req.query;
  const conds = [];
  const params = [];
  let i = 1;
  if (entity_type) { conds.push(`entity_type = $${i++}`); params.push(entity_type); }
  if (action_type) { conds.push(`action_type = $${i++}`); params.push(action_type); }
  if (user_id)     { conds.push(`user_id = $${i++}`);     params.push(user_id); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  try {
    const { rows } = await db.query(
      `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
