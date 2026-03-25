'use strict';

const { Pool } = require('pg');
const logger   = require('../utils/logger');

const pool = new Pool({
  host:               process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT)        || 5432,
  database:           process.env.DB_NAME     || 'gtcp',
  user:               process.env.DB_USER     || 'gtcp_user',
  password:           process.env.DB_PASSWORD || '',
  max:      Number(process.env.DB_POOL_MAX)    || 10,
  idleTimeoutMillis:  Number(process.env.DB_POOL_IDLE_TIMEOUT)  || 10000,
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT) || 2000,
});

pool.on('connect', () => logger.debug('DB: new client connected'));
pool.on('error',   (err) => logger.error('DB: unexpected error on idle client', err));

/**
 * Execute a single query
 * @param {string} text - SQL string with $1..$N placeholders
 * @param {Array}  [params] - parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug(`DB query [${duration}ms] rows=${res.rowCount}: ${text.slice(0, 120)}`);
  return res;
}

/**
 * Run multiple queries inside a single transaction.
 * @param {(client: import('pg').PoolClient) => Promise<*>} callback
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, withTransaction, pool };
