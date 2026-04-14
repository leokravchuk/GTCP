#!/usr/bin/env node
/**
 * GTCP — Endpoint Count Auditor
 *
 * Sprint 17 · US-1702 (DEBT-02)
 *
 * Counts actual HTTP endpoints in the backend and reconciles them with
 * the number advertised in docs (CLAUDE.md, GTCP_Artifacts.md, UserGuide).
 *
 * Sources of truth, in order:
 *   1. src/routes/*.js  — router.<method>() declarations
 *   2. src/app.js       — bare app.<method>() + base-path mounts
 *   3. docs/openapi.yaml — top-level path entries
 *
 * Usage:
 *   node scripts/count-endpoints.js         # summary
 *   node scripts/count-endpoints.js --list  # print every endpoint
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const ROUTES_DIR = path.join(BACKEND_ROOT, 'src', 'routes');
const APP_FILE = path.join(BACKEND_ROOT, 'src', 'app.js');
const OPENAPI_FILE = path.join(BACKEND_ROOT, 'docs', 'openapi.yaml');

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const VERBOSE = process.argv.includes('--list');

// ── 1. Discover mounts in app.js ──────────────────────────────────────────────
function discoverMounts() {
  const src = fs.readFileSync(APP_FILE, 'utf8');
  const mounts = {};
  const mountRe = /app\.use\(\s*`?\$\{API\}?(\/[\w/-]*)`?\s*,\s*(\w+)Router\b/g;
  let m;
  while ((m = mountRe.exec(src)) !== null) {
    // Drop trailing /* from e.g. `${API}/auth` style
    const basePath = m[1];
    const routerVar = m[2];
    mounts[routerVar] = basePath;
  }
  // Also collect inline app.<method>() declarations
  const inline = [];
  const inlineRe = /app\.(get|post|put|patch|delete)\(\s*(?:`\$\{API\}(\/[\w/\-{}:]*)`|['"](\/[\w/\-{}:]*)['"])/g;
  while ((m = inlineRe.exec(src)) !== null) {
    const p = m[2] || m[3];
    // Skip non-API debug routes (/docs, /docs/openapi.json)
    if (m[3] && !m[3].startsWith('/api/')) continue;
    inline.push({ method: m[1].toUpperCase(), path: p });
  }
  return { mounts, inline };
}

// Normalize path params: /foo/:id ↔ /foo/{id} → /foo/{id} (OpenAPI style)
function normalizePath(p) {
  return p.replace(/:([a-zA-Z_][\w]*)/g, '{$1}');
}

// ── 2. Extract endpoints from a single route file ────────────────────────────
function extractFromRouteFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const endpoints = [];
  // Match router.<method>('/path', ...)  or  router.<method>(`/path`, ...)
  const re = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    endpoints.push({ method: m[1].toUpperCase(), relPath: m[2] });
  }
  return endpoints;
}

// ── 3. Build the full actual endpoint list ───────────────────────────────────
function buildActualEndpoints() {
  const { mounts, inline } = discoverMounts();
  const files = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js'));
  const list = [];

  // Map file name (e.g. auth.js) → expected router variable (e.g. authRouter)
  // by inspecting the require() line in app.js
  const appSrc = fs.readFileSync(APP_FILE, 'utf8');

  for (const file of files) {
    const base = file.replace(/\.js$/, ''); // e.g. "auth", "reservePrices"
    // Find `const XxxRouter = require('./routes/auth')`
    const reqRe = new RegExp(
      `const\\s+(\\w+)Router\\s*=\\s*require\\(\\s*['"]\\.\\/routes\\/${base}['"]\\)`,
    );
    const rm = appSrc.match(reqRe);
    if (!rm) {
      console.warn(`[warn] routes/${file} is not mounted in app.js — skipping`);
      continue;
    }
    const routerVar = rm[1];
    const basePath = mounts[routerVar];
    if (!basePath) {
      console.warn(`[warn] router ${routerVar}Router has no app.use() — skipping`);
      continue;
    }

    const endpoints = extractFromRouteFile(path.join(ROUTES_DIR, file));
    for (const ep of endpoints) {
      const full = `${basePath}${ep.relPath === '/' ? '' : ep.relPath}` || '/';
      list.push({ file, method: ep.method, path: `/api/v1${full}` });
    }
  }

  for (const ep of inline) {
    list.push({ file: 'app.js', method: ep.method, path: `/api/v1${ep.path}` });
  }

  return list;
}

// ── 4. Extract paths from openapi.yaml ───────────────────────────────────────
function extractOpenApiEndpoints() {
  if (!fs.existsSync(OPENAPI_FILE)) return [];
  const src = fs.readFileSync(OPENAPI_FILE, 'utf8');
  const lines = src.split(/\r?\n/);

  const endpoints = [];
  let inPaths = false;
  let currentPath = null;

  for (const line of lines) {
    if (/^paths\s*:/.test(line)) {
      inPaths = true;
      continue;
    }
    if (!inPaths) continue;
    // Top-level section end
    if (/^\w/.test(line)) { inPaths = false; continue; }

    // 2-space indent + "/..." = path entry
    const pathMatch = line.match(/^ {2}(\/[^:\s]*)\s*:\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      continue;
    }
    // 4-space indent + method
    const methodMatch = line.match(/^ {4}(get|post|put|patch|delete)\s*:\s*$/);
    if (methodMatch && currentPath) {
      endpoints.push({
        method: methodMatch[1].toUpperCase(),
        path: `/api/v1${currentPath}`,
      });
    }
  }
  return endpoints;
}

// ── 5. Print report ──────────────────────────────────────────────────────────
function main() {
  const actual = buildActualEndpoints();
  const openapi = extractOpenApiEndpoints();

  // Deduplicate (normalize :id → {id} for cross-source comparison)
  const key = ep => `${ep.method} ${normalizePath(ep.path)}`;
  const actualSet = new Set(actual.map(key));
  const openapiSet = new Set(openapi.map(key));

  const inActualOnly = [...actualSet].filter(k => !openapiSet.has(k)).sort();
  const inOpenApiOnly = [...openapiSet].filter(k => !actualSet.has(k)).sort();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  GTCP — Endpoint Count Audit (Sprint 17 DEBT-02)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Actual endpoints (router.*/app.*): ${actual.length}`);
  console.log(`  OpenAPI paths × methods           : ${openapi.length}`);
  console.log(`  In sync                           : ${actualSet.size === openapiSet.size && inActualOnly.length === 0 ? '✅ YES' : '❌ NO'}`);
  console.log('───────────────────────────────────────────────────────────────');

  if (inActualOnly.length) {
    console.log(`  Only in code (${inActualOnly.length}) — missing from openapi.yaml:`);
    for (const k of inActualOnly) console.log(`    · ${k}`);
  }
  if (inOpenApiOnly.length) {
    console.log(`  Only in openapi.yaml (${inOpenApiOnly.length}) — missing from code:`);
    for (const k of inOpenApiOnly) console.log(`    · ${k}`);
  }

  if (VERBOSE) {
    console.log('───────────────────────────────────────────────────────────────');
    console.log('  All actual endpoints (grouped by file):');
    const byFile = {};
    for (const ep of actual) {
      (byFile[ep.file] ||= []).push(ep);
    }
    for (const file of Object.keys(byFile).sort()) {
      console.log(`\n  ${file} (${byFile[file].length}):`);
      for (const ep of byFile[file]) {
        console.log(`    ${ep.method.padEnd(6)} ${ep.path}`);
      }
    }
  }

  console.log('═══════════════════════════════════════════════════════════════');

  // Exit non-zero if out of sync (useful for CI)
  if (inActualOnly.length || inOpenApiOnly.length) {
    process.exitCode = 1;
  }
}

main();
