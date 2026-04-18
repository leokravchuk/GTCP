'use strict';

/**
 * Load test — Smoke (10 connections, 30 seconds)
 * Sprint 18 · US-1805
 *
 * Tests: GET /health, GET /shippers, GET /nominations, GET /billing, GET /capacity/available
 * Target: p95 < 500ms, error rate < 1%
 *
 * Usage: node tests/load/smoke.js
 */

const autocannon = require('autocannon');
const jwt = require('jsonwebtoken');

const BASE = process.env.LOAD_TEST_URL || 'http://localhost:3000';
const SECRET = process.env.JWT_ACCESS_SECRET || 'test-secret-for-jwt-signing';

// Generate admin JWT
const token = jwt.sign(
  { sub: '11111111-0000-0000-0000-000000000001', username: 'admin', role: 'admin', permissions: ['*'] },
  SECRET,
  { expiresIn: '1h' }
);

const endpoints = [
  { path: '/api/v1/health', name: 'health' },
  { path: '/api/v1/shippers', name: 'shippers' },
  { path: '/api/v1/nominations', name: 'nominations' },
  { path: '/api/v1/billing', name: 'billing' },
  { path: '/api/v1/capacity/available', name: 'capacity/available' },
  { path: '/api/v1/vtp/trades', name: 'vtp/trades' },
  { path: '/api/v1/analytics/volumes', name: 'analytics/volumes' },
];

async function runTest(endpoint, connections, duration) {
  return new Promise((resolve) => {
    const instance = autocannon({
      url: `${BASE}${endpoint.path}`,
      connections,
      duration,
      headers: { Authorization: `Bearer ${token}` },
      title: endpoint.name,
    }, (err, result) => {
      resolve({ name: endpoint.name, result, err });
    });
    autocannon.track(instance, { renderProgressBar: false });
  });
}

async function main() {
  const CONNECTIONS = Number(process.env.LOAD_CONNECTIONS) || 10;
  const DURATION = Number(process.env.LOAD_DURATION) || 30;
  const mode = process.argv[2] || 'smoke';

  let connections = CONNECTIONS;
  let duration = DURATION;

  if (mode === 'stress') { connections = 50; duration = 60; }
  if (mode === 'spike')  { connections = 100; duration = 10; }

  console.log(`\n  GTCP Load Test — ${mode.toUpperCase()}`);
  console.log(`  ${connections} connections × ${duration}s`);
  console.log(`  Target: p95 < 500ms, errors < 1%\n`);

  const results = [];

  for (const ep of endpoints) {
    const { name, result, err } = await runTest(ep, connections, duration);
    if (err) {
      console.log(`  ${name}: ERROR — ${err.message}`);
      continue;
    }

    const p50 = result.latency.p50;
    const p95 = result.latency.p95;
    const p99 = result.latency.p99;
    const rps = Math.round(result.requests.average);
    const errors = result.errors + result.timeouts + (result.non2xx || 0);
    const total = result.requests.total;
    const errorRate = total > 0 ? (errors / total * 100).toFixed(2) : '0.00';
    const pass = p95 < 500 && parseFloat(errorRate) < 1;

    results.push({ name, p50, p95, p99, rps, errors, total, errorRate, pass });

    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(22)} p50=${String(p50).padStart(4)}ms  p95=${String(p95).padStart(4)}ms  p99=${String(p99).padStart(4)}ms  ${String(rps).padStart(5)} RPS  err=${errorRate}%`);
  }

  console.log('\n  ──────────────────────────────────────────');
  const allPass = results.every(r => r.pass);
  const avgRps = Math.round(results.reduce((s, r) => s + r.rps, 0) / results.length);
  console.log(`  ${allPass ? 'ALL PASS' : 'SOME FAILED'}  avg=${avgRps} RPS  mode=${mode}\n`);

  // Output JSON for report generation
  if (process.env.LOAD_JSON_OUTPUT) {
    const fs = require('fs');
    fs.writeFileSync(process.env.LOAD_JSON_OUTPUT, JSON.stringify({ mode, connections, duration, results, allPass }, null, 2));
    console.log(`  Results saved to ${process.env.LOAD_JSON_OUTPUT}`);
  }

  process.exit(allPass ? 0 : 1);
}

main();
