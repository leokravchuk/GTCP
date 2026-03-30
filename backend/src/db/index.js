'use strict';

const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'gtcp',
  user:     process.env.DB_USER     || 'gtcp_user',
  password: process.env.DB_PASSWORD || '',
  max:      Number(process.env.DB_POOL_MAX) || 10,
});

pool.on('error', (err) => {
  logger.error('Unexpected PG pool error', { error: err.message });
});

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  withTransaction,
  pool,
};
