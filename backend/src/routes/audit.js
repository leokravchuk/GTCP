'use strict';

const express    = require('express');
const db         = require('../db');
const authenticate  = require('../middleware/authenticate');
const authorize     = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

// GET /audit — paginated audit log (admin only)
router.get('/', authorize('audit:read'), async (req, res, next) => {
  const {
    user_id, entity_type, action_type,
    limit = 100, offset = 0,
  } = req.query;

  const conds = []; const params = []; let i = 1;
  if (user_id)     { conds.push(`user_id = $${i++}`);     params.push(user_id); }
  if (entity_type) { conds.push(`entity_type = $${i++}`); params.push(entity_type); }
  if (action_type) { conds.push(`action_type = $${i++}`); params.push(action_type); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  try {
    const { rows } = await db.query(
      `SELECT * FROM audit_log ${where}
       ORDER BY occurred_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
