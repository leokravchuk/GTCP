'use strict';

/**
 * Role-based authorization middleware factory.
 * Usage: authorize('shippers:read')
 *
 * Admin role bypasses all checks.
 * Other roles must have the permission in req.user.permissions[].
 */
function authorize(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Admin bypasses permission checks
    if (req.user.role === 'admin') return next();

    // Check specific permission
    if (req.user.permissions && req.user.permissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden',
      required: permission,
    });
  };
}

module.exports = authorize;
