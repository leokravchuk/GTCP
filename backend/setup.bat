@echo off
setlocal EnableDelayedExpansion

:: ============================================================================
:: GTCP Backend Setup Script (Windows CMD)
:: Steps: npm install -> docker compose up -d -> wait DB -> seed -> open browser
:: Run from the backend\ folder (double-click or right-click -> Run as ...)
:: ============================================================================

echo.
echo  +------------------------------------------------------------+
echo  ^|  GTCP - Gas Trading ^& Commercial Platform                ^|
echo  ^|  Sprint 4 Backend Setup                                   ^|
echo  +------------------------------------------------------------+
echo.

:: Set working directory to the folder containing this script
cd /d "%~dp0"
echo   Working directory: %CD%
echo.

:: ============================================================================
:: STEP 0: Check dependencies
:: ============================================================================
echo [0/5] Checking dependencies...

where node >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found.
    echo          Install Node.js 20 LTS: https://nodejs.org/en/download
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo         Node.js: %%v

where docker >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Docker not found.
    echo          Install Docker Desktop: https://www.docker.com/products/docker-desktop
    pause & exit /b 1
)
docker -v 2>nul | findstr /i "docker" >nul || (echo  [ERROR] Docker error & pause & exit /b 1)
echo         Docker: OK

docker compose version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] docker compose plugin not found. Update Docker Desktop.
    pause & exit /b 1
)
echo         docker compose: OK
echo.

:: ============================================================================
:: STEP 1: .env file
:: ============================================================================
echo [1/5] Checking .env...
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo         .env created from .env.example
    echo.
    echo   NOTE: Open .env and set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET
    echo         Current placeholder values are OK for local development.
    echo.
    timeout /t 3 /nobreak >nul
) else (
    echo         .env already exists - skipping
)
echo.

:: ============================================================================
:: STEP 2: npm install
:: ============================================================================
echo [2/5] npm install...
if exist "node_modules" (
    echo         node_modules found - running npm ci
    call npm ci --omit=dev --silent
) else (
    call npm install --omit=dev --silent
)
if errorlevel 1 (
    echo  [ERROR] npm install failed.
    pause & exit /b 1
)
echo         Dependencies installed OK
echo.

:: ============================================================================
:: STEP 3: docker compose up
:: ============================================================================
echo [3/5] Starting Docker containers...
docker compose up -d --build
if errorlevel 1 (
    echo  [ERROR] docker compose up failed.
    echo          Check logs: docker compose logs
    pause & exit /b 1
)
echo         Containers started OK
echo.

:: ============================================================================
:: STEP 4: Wait for PostgreSQL
:: ============================================================================
echo [4/5] Waiting for PostgreSQL (up to 60s)...
set /a TRIES=0

:WAIT_LOOP
set /a TRIES+=1
if !TRIES! gtr 30 (
    echo  [ERROR] PostgreSQL did not start in 60s.
    echo          Check logs: docker compose logs db
    pause & exit /b 1
)
docker compose exec -T db pg_isready -U gtcp_user -d gtcp >nul 2>&1
if errorlevel 1 (
    echo         [!TRIES!/30] waiting...
    timeout /t 2 /nobreak >nul
    goto WAIT_LOOP
)
echo         PostgreSQL ready ^(attempts: !TRIES!^)
echo.

:: ============================================================================
:: STEP 5: Seed demo data
:: ============================================================================
echo [5/5] Loading demo data...
echo         Generating Argon2 hashes (~10 sec)...
docker compose exec -T api node src/db/seed.js
if errorlevel 1 (
    echo   [WARN] Seed returned an error.
    echo          This is normal if data already exists ^(re-run^).
) else (
    echo         Seed completed OK
)
echo.

:: ============================================================================
:: Done
:: ============================================================================
echo  +------------------------------------------------------------+
echo  ^|  GTCP Backend is running!                                 ^|
echo  +------------------------------------------------------------+
echo  ^|  API:      http://localhost:3000/api/v1                   ^|
echo  ^|  Frontend: http://localhost:80                            ^|
echo  ^|  Health:   http://localhost:3000/health                   ^|
echo  +------------------------------------------------------------+
echo  ^|  DEMO CREDENTIALS (after seed):                           ^|
echo  ^|    admin        / Admin@2026!      (admin)                ^|
echo  ^|    dispatcher1  / Disp@2026!       (dispatcher)           ^|
echo  ^|    credit1      / Credit@2026!     (credit)               ^|
echo  ^|    billing1     / Billing@2026!    (billing)              ^|
echo  ^|    contracts1   / Contracts@2026!  (contracts)            ^|
echo  +------------------------------------------------------------+
echo.

:: Open GTCP_MVP.html automatically
set "HTML=%~dp0..\Soft\GTCP_MVP.html"
if exist "!HTML!" (
    echo   Opening GTCP_MVP.html in browser...
    start "" "!HTML!"
) else (
    echo   [WARN] GTCP_MVP.html not found at: !HTML!
)

echo.
echo   Press any key to close...
pause >nul
endlocal
