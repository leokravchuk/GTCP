'use strict';

const logger = require('../utils/logger');

function notFound(req, res, _next) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
}

function errorHandler(err, req, res, _next) {
  logger.error(`${err.message}`, { stack: err.stack, url: req.originalUrl });
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}

module.exports = { notFound, errorHandler };
