// =============================================================
//  GTCP — Gas Trading & Commercial Platform
//  PM2 Process Manager config
//
//  Usage:
//    pm2 start ecosystem.config.js           # start
//    pm2 restart gtcp-backend                # restart
//    pm2 reload gtcp-backend                 # zero-downtime reload
//    pm2 stop gtcp-backend                   # stop
//    pm2 logs gtcp-backend                   # logs
//    pm2 save && pm2 startup                 # auto-start on boot
// =============================================================

module.exports = {
  apps: [
    {
      name: 'gtcp-backend',
      script: './backend/src/app.js',
      cwd: '/opt/gtcp/app',

      // ── Cluster mode — 1 worker per vCPU ─────────────────
      instances: 'max',     // Hetzner CX21 = 2 vCPU → 2 workers
      exec_mode: 'cluster',

      // ── Environment ──────────────────────────────────────
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Secrets should be in /opt/gtcp/app/.env.production
        // Loaded via dotenv in app.js — do NOT hardcode here
      },

      // ── Restart policy ───────────────────────────────────
      max_memory_restart: '400M',  // restart if RAM > 400MB
      restart_delay: 3000,         // 3s between restarts
      max_restarts: 10,
      min_uptime: '10s',

      // ── Logging ──────────────────────────────────────────
      out_file:   '/var/log/gtcp/out.log',
      error_file: '/var/log/gtcp/err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // ── Graceful shutdown ─────────────────────────────────
      kill_timeout: 5000,     // wait 5s for in-flight requests
      listen_timeout: 8000,   // wait 8s for cluster worker to listen

      // ── Health check (optional — requires pm2-health-check)
      // health_check_interval: 30000,
      // health_check_path: '/api/v1/health',
    },
  ],

  // ── Deploy config (optional — for pm2 deploy) ────────────
  deploy: {
    production: {
      user:       'root',
      host:       'TODO_YOUR_VPS_IP',       // ← Hetzner IP
      ref:        'origin/main',
      repo:       'git@github.com:leokravchuk/GTCP.git',
      path:       '/opt/gtcp',
      'pre-deploy-local': '',
      'post-deploy': [
        'npm ci --prefix backend --omit=dev',
        'node backend/src/db/migrate.js',
        'pm2 reload ecosystem.config.js --env production',
        'pm2 save',
      ].join(' && '),
    },
  },
};
