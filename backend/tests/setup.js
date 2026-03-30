'use strict';

/**
 * Test setup — runs before each test suite.
 * Mocks the DB layer so tests don't need a running PostgreSQL.
 */

// Suppress winston logs in tests
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-secret-for-jwt-signing';
