'use strict';

require('dotenv').config();

const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const morgan   = require('morgan');
const rateLimit = require('express-rate-limit');
const path     = require('path');

const logger    = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// ── Route imports ──────────────────────────────────────────────────────────────
const authRouter         = require('./routes/auth');
const shippersRouter     = require('./routes/shippers');
const nominationsRouter  = require('./routes/nominations');
const creditsRouter      = require('./routes/credits');
const billingRouter      = require('./routes/billing');
const contractsRouter    = require('./routes/contracts');
const capacityRouter     = require('./routes/capacity');
const auctionsRouter     = require('./routes/auctions');
const balanceRouter      = require('./routes/balance');
const auditRouter        = require('./routes/audit');
const systemParamsRouter = require('./routes/systemParams');

const app = express();
const API = process.env.API_PREFIX || '/api/v1';

// ── Security & CORS ────────────────────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (file://, Postman, curl, local HTML)
    // Firefox sends Origin: "null" (string) for file:// pages
    if (!origin || origin === 'null') return cb(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── Global rate limit ──────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      Number(process.env.RATE_LIMIT_MAX)        || 100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// ── Body & logging ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ── OpenAPI / Swagger UI (CDN-based, no npm package needed) ────────────────────
const DOCS_DIR = path.join(__dirname, '../docs');
app.use('/docs', express.static(DOCS_DIR));
// Convenience redirect: GET /docs → /docs/swagger-ui.html
app.get('/docs', (_req, res) => res.redirect('/docs/swagger-ui.html'));
// Expose the YAML spec via JSON route for programmatic consumers
app.get('/docs/openapi.json', (_req, res) => {
  res.sendFile(path.join(DOCS_DIR, 'openapi.yaml'));
});

// ── Health ─────────────────────────────────────────────────────────────────────
app.get(`${API}/health`, (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), version: '0.1.0' });
});

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use(`${API}/auth`,        authRouter);
app.use(`${API}/shippers`,    shippersRouter);
app.use(`${API}/nominations`, nominationsRouter);
app.use(`${API}/credits`,     creditsRouter);
app.use(`${API}/billing`,     billingRouter);
app.use(`${API}/contracts`,   contractsRouter);
app.use(`${API}/capacity`,    capacityRouter);
app.use(`${API}/auctions`,    auctionsRouter);
app.use(`${API}/balance`,     balanceRouter);
app.use(`${API}/audit`,         auditRouter);
app.use(`${API}/system-params`, systemParamsRouter);

// ── 404 & Error handlers ───────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`GTCP API listening on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}

module.exports = app; // for tests
