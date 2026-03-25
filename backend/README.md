# GTCP Backend API

**Gas Trading & Commercial Platform · Sprint 4 · Node.js + PostgreSQL**

---

## Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Runtime    | Node.js 20 LTS                      |
| Framework  | Express 4.x                         |
| Database   | PostgreSQL 15                       |
| Auth       | JWT (HS256) + Argon2id              |
| ORM        | node-postgres (raw SQL)             |
| Containers | Docker Compose (api + db + nginx)   |
| Tests      | Jest + Supertest                    |

---

## Quick Start

### Option A — Docker (recommended)

```bash
# 1. Copy env template
cp .env.example .env
# 2. Edit .env — set JWT secrets (required for security)
# 3. Start all services
docker compose up -d
# 4. Run seed (demo data)
docker compose exec api node src/db/seed.js
```

API is available at: `http://localhost:80/api/v1`

### Option B — Local

```bash
# Prerequisites: Node.js 20, PostgreSQL 15 running

# 1. Install dependencies
npm install

# 2. Create DB
psql -U postgres -c "CREATE DATABASE gtcp;"
psql -U postgres -c "CREATE USER gtcp_user WITH PASSWORD 'your_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE gtcp TO gtcp_user;"

# 3. Configure env
cp .env.example .env   # edit DB_* and JWT_* values

# 4. Run migrations
npm run migrate

# 5. Seed demo data
npm run seed

# 6. Start development server
npm run dev
```

API is available at: `http://localhost:3000/api/v1`

---

## Demo Credentials (after seed)

| Username     | Password        | Role        |
|--------------|-----------------|-------------|
| admin        | Admin@2026!     | admin       |
| dispatcher1  | Disp@2026!      | dispatcher  |
| credit1      | Credit@2026!    | credit      |
| billing1     | Billing@2026!   | billing     |
| contracts1   | Contracts@2026! | contracts   |

---

## API Endpoints

### Auth
| Method | Endpoint              | Description              |
|--------|-----------------------|--------------------------|
| POST   | /auth/login           | Login → access+refresh tokens |
| POST   | /auth/refresh         | Refresh access token     |
| POST   | /auth/logout          | Logout                   |
| GET    | /auth/me              | Current user profile     |

### Nominations
| Method | Endpoint                      | Roles           |
|--------|-------------------------------|-----------------|
| GET    | /nominations                  | dispatcher, credit, admin |
| GET    | /nominations/:id              | dispatcher, credit, admin |
| POST   | /nominations                  | dispatcher, admin |
| POST   | /nominations/match            | dispatcher, admin |
| POST   | /nominations/:id/renom        | dispatcher, admin |

### Credits
| Method | Endpoint                              | Roles         |
|--------|---------------------------------------|---------------|
| GET    | /credits                              | credit, admin |
| GET    | /credits/:shipperId                   | credit, admin |
| GET    | /credits/margin-calls                 | credit, admin |
| POST   | /credits/:shipperId/margin-call       | credit, admin |
| PATCH  | /credits/margin-calls/:id             | credit, admin |

### Billing
| Method | Endpoint                  | Roles          |
|--------|---------------------------|----------------|
| GET    | /billing                  | billing, admin |
| POST   | /billing                  | billing, admin |
| PATCH  | /billing/:id/status       | billing, admin |
| POST   | /billing/:id/erp-sync     | billing, admin |

### Contracts / Capacity / Balance / Audit
See route files in `src/routes/`.

---

## Project Structure

```
backend/
├── src/
│   ├── app.js                    ← Express entry point
│   ├── db/
│   │   ├── index.js              ← pg Pool + query/withTransaction helpers
│   │   ├── migrate.js            ← Migration runner
│   │   ├── seed.js               ← Seed runner (generates Argon2 hashes)
│   │   ├── migrations/
│   │   │   └── 001_initial.sql   ← 8 tables + triggers
│   │   └── seeds/
│   │       └── seed.sql          ← Demo data template
│   ├── middleware/
│   │   ├── authenticate.js       ← JWT verification
│   │   ├── authorize.js          ← RBAC (5 roles)
│   │   └── errorHandler.js       ← 404 + global error handler
│   ├── routes/
│   │   ├── auth.js               ← login/logout/refresh/me
│   │   ├── nominations.js        ← CRUD + matching + renomination
│   │   ├── credits.js            ← Credit positions + margin calls
│   │   ├── billing.js            ← Invoices + ERP sync
│   │   ├── contracts.js
│   │   ├── capacity.js
│   │   ├── balance.js
│   │   └── audit.js
│   ├── services/
│   │   └── auditService.js       ← Audit log write/query
│   └── utils/
│       ├── logger.js             ← Winston logger
│       └── tokens.js             ← JWT sign/verify helpers
├── frontend/
│   └── api.js                    ← Browser fetch wrapper for GTCP_MVP.html
├── nginx/
│   └── default.conf
├── docker-compose.yml
├── Dockerfile
├── package.json
└── .env.example
```

---

## Sprint 5 TODO

- [ ] Token blacklist (Redis) for proper logout
- [ ] WebSocket (socket.io) real-time dashboard
- [ ] Real 1С ERP REST connector (replace mock)
- [ ] GitHub Actions CI/CD
- [ ] VPS deployment (nginx + PM2 + SSL)
- [ ] Swagger/OpenAPI 3.0 documentation
