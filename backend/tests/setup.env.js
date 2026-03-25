'use strict';

// Test environment variables — no real DB or JWT secrets needed
process.env.NODE_ENV           = 'test';
process.env.JWT_ACCESS_SECRET  = 'test-secret-gtcp-2025';
process.env.JWT_REFRESH_SECRET = 'test-refresh-gtcp-2025';
process.env.DB_HOST            = 'localhost';
process.env.DB_PORT            = '5432';
process.env.DB_NAME            = 'gtcp_test';
process.env.DB_USER            = 'gtcp_user';
process.env.DB_PASSWORD        = 'test';
process.env.API_PREFIX         = '/api/v1';
process.env.RATE_LIMIT_MAX     = '10000'; // disable effective rate limiting in tests
