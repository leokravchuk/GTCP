# GTCP — Локальный запуск на порту 3003

**Пошаговая инструкция для ручного развёртывания · 19.04.2026**

---

## Предварительные требования

- Node.js >= 20.x (`node --version`)
- PostgreSQL 17 запущен на порту **8887** (база `gtcp`, пользователь `gtcp_user`)
- Порт **3003** свободен

---

## Шаг 1 — Установить зависимости

```powershell
cd C:\Users\leokr\ETRM\backend
npm install
```

---

## Шаг 2 — Применить миграции

Если база `gtcp` уже существует и содержит данные — применить только недостающие миграции:

```powershell
cd C:\Users\leokr\ETRM\backend

# Проверить что БД доступна
node -e "process.env.DB_PORT='8887';process.env.DB_USER='gtcp_user';process.env.DB_NAME='gtcp';const db=require('./src/db');db.query('SELECT 1').then(()=>{console.log('OK');db.pool.end()}).catch(e=>{console.log('ERROR:',e.message);db.pool.end()})"

# Применить все миграции (идемпотентно — CREATE IF NOT EXISTS)
node -e "process.env.DB_PORT='8887';process.env.DB_USER='gtcp_user';process.env.DB_NAME='gtcp';const fs=require('fs');const db=require('./src/db');(async()=>{const dir='src/db/migrations';const files=fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort();for(const f of files){try{await db.query(fs.readFileSync(dir+'/'+f,'utf8'));console.log('OK:',f)}catch(e){console.log('SKIP:',f,'—',e.message.slice(0,60))}}await db.pool.end()})()"
```

Если база **не существует** — создать с нуля:

```powershell
# В psql (PowerShell: & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -p 8887)
CREATE USER gtcp_user WITH PASSWORD 'change_me_in_production';
CREATE DATABASE gtcp OWNER gtcp_user;
GRANT ALL PRIVILEGES ON DATABASE gtcp TO gtcp_user;

# Затем применить миграции + seed
cd C:\Users\leokr\ETRM\backend
set DB_PORT=8887
set DB_NAME=gtcp
set DB_USER=gtcp_user
node src/db/migrate.js
node src/db/seed-runner.js
```

---

## Шаг 3 — Запустить Backend API (порт 3003)

```powershell
cd C:\Users\leokr\ETRM\backend

# Вариант A — через .env (уже настроен на PORT=3003)
node src/app.js

# Вариант B — явно через переменные окружения
$env:PORT="3003"
$env:DB_PORT="8887"
$env:DB_NAME="gtcp"
$env:DB_USER="gtcp_user"
$env:DB_PASSWORD="change_me_in_production"
$env:JWT_ACCESS_SECRET="dev-secret-change-me"
$env:JWT_REFRESH_SECRET="dev-refresh-secret"
$env:RBP_MODE="mock"
node src/app.js

# Вариант C — в фоне (PowerShell)
Start-Process -NoNewWindow node -ArgumentList "src/app.js"
```

Ожидаемый вывод:
```
GTCP API listening on port 3003 [development]
```

---

## Шаг 4 — Проверить Backend

```powershell
# Health check
curl http://localhost:3003/api/v1/health

# Получить JWT токен
curl -X POST http://localhost:3003/api/v1/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"admin123\"}"

# Проверить шипперов (подставить токен из предыдущей команды)
curl http://localhost:3003/api/v1/shippers -H "Authorization: Bearer <TOKEN>"
```

---

## Шаг 5 — Открыть Frontend

Frontend раздаётся через Express static. Просто открыть в браузере:

```
http://localhost:3003/GTCP_MVP.html
```

Логин: `admin` / `admin123`

Альтернативно — через файловую систему (Live Server / http-server):

```powershell
# http-server на отдельном порту 5501
cd C:\Users\leokr\ETRM
npx http-server . -p 5501 -c-1 --cors

# Открыть: http://127.0.0.1:5501/Soft/GTCP_MVP.html
```

> При запуске через отдельный http-server — проверить CORS_ORIGIN в `.env` содержит `http://127.0.0.1:5501`.

---

## Шаг 6 — Swagger UI (OpenAPI документация)

OpenAPI spec доступен по адресу:

```
http://localhost:3003/docs/openapi.yaml
```

Для визуального просмотра можно вставить URL в [Swagger Editor](https://editor.swagger.io/) или [Swagger UI online](https://petstore.swagger.io/) → ввести URL `http://localhost:3003/docs/openapi.yaml`.

---

## Адреса после запуска

| Сервис | URL |
|---|---|
| API | http://localhost:3003/api/v1 |
| Health | http://localhost:3003/api/v1/health |
| Frontend | http://localhost:3003/GTCP_MVP.html |
| OpenAPI YAML | http://localhost:3003/docs/openapi.yaml |
| PostgreSQL | localhost:8887 (gtcp / gtcp_user) |

---

## Остановить сервер

```powershell
# Найти PID
netstat -ano | findstr :3003

# Убить процесс
taskkill /PID <PID> /F

# Или Ctrl+C в терминале где запущен node
```

---

## Пользователи для входа

| Логин | Пароль | Роль | Права |
|---|---|---|---|
| admin | admin123 | admin | Все (*) |
| dispatcher1 | dispatcher123 | dispatcher | Nominations, Shippers, Contracts, Capacity |
| billing1 | billing123 | billing | Billing, Shippers, Contracts |
| credit1 | credit123 | credit | Credits, Shippers |
| contracts1 | contracts123 | contracts | Contracts, Shippers, Auctions |

---

## Изменённые файлы (порт 3000 → 3003)

| Файл | Что изменено |
|---|---|
| `backend/.env` | `PORT=3003` |
| `Soft/GTCP_MVP.html` | 10 вхождений `localhost:3000` → `localhost:3003` |
| `backend/frontend/api.js` | fallback BASE_URL → `localhost:3003` |
| `backend/docs/openapi.yaml` | servers URL → `localhost:3003` |

---

## Troubleshooting

| Проблема | Решение |
|---|---|
| `ECONNREFUSED :8887` | PostgreSQL не запущен на порту 8887. Проверить: `pg_isready -p 8887` |
| `EADDRINUSE :3003` | Порт 3003 занят. Убить: `netstat -ano \| findstr :3003` → `taskkill /PID <PID> /F` |
| `relation "users" does not exist` | Миграции не применены. См. Шаг 2 |
| Пустые таблицы на frontend | Seed не запущен: `node src/db/seed-runner.js` |
| CORS error в браузере | Добавить origin в `CORS_ORIGIN` в `.env` и перезапустить |
| `JWT_ACCESS_SECRET is required` | Переменная окружения не задана. Использовать `.env` или `$env:JWT_ACCESS_SECRET="..."` |
