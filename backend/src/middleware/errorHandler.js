'use strict';

const logger = require('../utils/logger');

/**
 * 404 Not Found
 */
function notFound(req, res, next) {
  const err = new Error(`Not Found: ${req.method} ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

/**
 * Global error handler — never leaks stack traces to clients in production
 */
function errorHandler(err, req, res, _next) { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    logger.error(err);
  }

  const payload = {
    error:   err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  // express-validator errors come with .errors array
  if (err.errors) {
    payload.details = err.errors;
  }

  res.status(status).json(payload);
}

module.exports = { notFound, errorHandler };
