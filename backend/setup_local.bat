@echo off
setlocal EnableDelayedExpansion

:: ============================================================================
:: GTCP Backend - Local Setup (WITHOUT Docker)
:: Use this when PostgreSQL is already installed locally.
:: Steps: npm install -> migrate -> seed -> start node server
:: ============================================================================

echo.
echo  +------------------------------------------------------------+
echo  ^|  GTCP - Local Setup (no Docker)                          ^|
echo  +------------------------------------------------------------+
echo.

cd /d "%~dp0"

:: Check Node.js
where node >nul 2>&1 || (echo  [ERROR] Node.js not found. & pause & exit /b 1)
for /f "tokens=*" %%v in ('node -v') do echo   Node.js: %%v

:: Create .env if missing
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo   .env created from .env.example
    echo.
    echo   IMPORTANT: Open .env and set your PostgreSQL connection:
    echo     DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
    echo.
    echo   Also create the DB and user first (run in psql):
    echo     CREATE DATABASE gtcp;
    echo     CREATE USER gtcp_user WITH PASSWORD 'gtcp_dev_password';
    echo     GRANT ALL PRIVILEGES ON DATABASE gtcp TO gtcp_user;
    echo.
    notepad .env
    echo.
    echo   After saving .env press any key to continue...
    pause >nul
)

:: npm install
echo.
echo [1/3] npm install...
call npm install --silent
if errorlevel 1 ( echo  [ERROR] npm install failed & pause & exit /b 1 )
echo       OK

:: Migrate
echo.
echo [2/3] Running migrations...
call node src/db/migrate.js
if errorlevel 1 (
    echo  [ERROR] Migration failed. Check DB settings in .env
    pause & exit /b 1
)
echo       OK

:: Seed
echo.
echo [3/3] Loading demo data...
call node src/db/seed.js
if errorlevel 1 (
    echo   [WARN] Seed returned an error (data may already exist - OK on re-run)
) else (
    echo       OK
)

:: Start server
echo.
echo  +------------------------------------------------------------+
echo  ^|  Starting GTCP API on http://localhost:3000              ^|
echo  ^|  Press Ctrl+C to stop                                    ^|
echo  +------------------------------------------------------------+
echo.

:: Open browser after 3 sec in background
set "HTML=%~dp0..\Soft\GTCP_MVP.html"
if exist "!HTML!" (
    start "" /b cmd /c "timeout /t 3 /nobreak >nul && start """" """!HTML!""""
)

set NODE_ENV=development
call node src/app.js

pause
endlocal
