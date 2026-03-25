'use strict';

/**
 * RBAC permission map — which roles can access which modules.
 * Mirrors the frontend RBAC from GTCP_MVP.html.
 *
 * Structure: { 'resource:action': ['role1', 'role2', ...] }
 * Special role 'admin' always has full access (handled below).
 */
const PERMISSIONS = {
  // Nominations
  'nominations:read':   ['dispatcher', 'credit', 'admin'],
  'nominations:create': ['dispatcher', 'admin'],
  'nominations:update': ['dispatcher', 'admin'],
  'nominations:match':  ['dispatcher', 'admin'],
  'nominations:renom':  ['dispatcher', 'admin'],

  // Credits
  'credits:read':       ['dispatcher', 'credit', 'admin'],
  'credits:margin_call':['credit', 'admin'],

  // Billing
  'billing:read':       ['billing', 'credit', 'admin'],
  'billing:create':     ['billing', 'admin'],
  'billing:update':     ['billing', 'admin'],
  'billing:erp_sync':   ['billing', 'admin'],

  // Contracts
  'contracts:read':     ['contracts', 'billing', 'admin'],
  'contracts:create':   ['contracts', 'admin'],
  'contracts:update':   ['contracts', 'admin'],

  // Capacity
  'capacity:read':      ['dispatcher', 'contracts', 'admin'],
  'capacity:create':    ['contracts', 'admin'],
  'capacity:update':    ['contracts', 'admin'],

  // Balance
  'balance:read':       ['dispatcher', 'credit', 'billing', 'admin'],

  // Shippers
  'shippers:read':      ['dispatcher', 'credit', 'billing', 'contracts', 'admin'],
  'shippers:create':    ['admin'],
  'shippers:update':    ['admin'],

  // Audit
  'audit:read':         ['admin'],

  // Users management
  'users:read':         ['admin'],
  'users:create':       ['admin'],
  'users:update':       ['admin'],
};

/**
 * authorize(permission) — Express middleware factory.
 * Usage: router.get('/nominations', authenticate, authorize('nominations:read'), handler)
 *
 * @param {string|string[]} permission - e.g. 'nominations:read' or ['billing:create', 'billing:update']
 */
function authorize(permission) {
  const required = Array.isArray(permission) ? permission : [permission];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { role } = req.user;

    // Admin always has access
    if (role === 'admin') return next();

    // Check if user's role satisfies ANY of the required permissions
    const allowed = required.some(perm => {
      const roles = PERMISSIONS[perm];
      return roles && roles.includes(role);
    });

    if (!allowed) {
      return res.status(403).json({
        error: `Forbidden: role '${role}' cannot perform '${required.join(' or ')}'`,
      });
    }

    next();
  };
}

/**
 * Export the map for tests and Swagger docs.
 */
authorize.PERMISSIONS = PERMISSIONS;

module.exports = authorize;
