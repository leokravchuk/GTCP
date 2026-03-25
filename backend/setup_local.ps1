#Requires -Version 5.1
<#
.SYNOPSIS
    GTCP Backend - Local Setup (NO Docker required)
    Node.js + local PostgreSQL only.

.EXAMPLE
    .\setup_local.ps1
    .\setup_local.ps1 -SkipSeed        # skip demo data (re-run)
    .\setup_local.ps1 -SkipMigrate     # skip migrations (re-run)
    .\setup_local.ps1 -Port 3001       # custom port
#>

param(
    [switch]$SkipSeed,
    [switch]$SkipMigrate,
    [int]$Port = 3000
)

# ---- Output helpers ----------------------------------------------------------
function Write-Step { param($n, $msg) Write-Host "" ; Write-Host "[$n] $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "     [OK]  $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "   [WARN]  $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "  [ERROR]  $msg" -ForegroundColor Red ; Write-Host "" ; pause ; exit 1 }
function Write-Info { param($msg) Write-Host "          $msg" -ForegroundColor DarkGray }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host ""
Write-Host "  +------------------------------------------------------------+" -ForegroundColor Magenta
Write-Host "  |  GTCP - Backend Local Setup (no Docker)                   |" -ForegroundColor Magenta
Write-Host "  +------------------------------------------------------------+" -ForegroundColor Magenta
Write-Host "  Working directory: $ScriptDir" -ForegroundColor DarkGray

# =============================================================================
# STEP 0: Check Node.js
# =============================================================================
Write-Step "0" "Checking Node.js..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Fail "Node.js not found. Install from: https://nodejs.org/en/download"
}
Write-OK "Node.js $(node -v)"

# =============================================================================
# STEP 1: Check PostgreSQL
# =============================================================================
Write-Step "1" "Checking PostgreSQL..."

$pgReady = $false

# Try common PostgreSQL paths on Windows
$pgPaths = @(
    "C:\Program Files\PostgreSQL\17\bin\psql.exe",
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe",
    "C:\Program Files\PostgreSQL\14\bin\psql.exe"
)

$psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
if ($psqlCmd) {
    Write-OK "psql found: $($psqlCmd.Source)"
    $pgReady = $true
} else {
    foreach ($p in $pgPaths) {
        if (Test-Path $p) {
            Write-OK "psql found: $p"
            # Add to PATH for this session
            $env:PATH = (Split-Path $p) + ";" + $env:PATH
            $pgReady = $true
            break
        }
    }
}

if (-not $pgReady) {
    Write-Host ""
    Write-Host "  PostgreSQL is NOT installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "  OPTION A - Install PostgreSQL (recommended, ~5 min):" -ForegroundColor Yellow
    Write-Host "    1. Download: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads" -ForegroundColor White
    Write-Host "    2. Choose version 15 or 16, Windows x86-64" -ForegroundColor White
    Write-Host "    3. Run installer, remember the password you set for 'postgres' user" -ForegroundColor White
    Write-Host "    4. Re-run this script after installation" -ForegroundColor White
    Write-Host ""
    Write-Host "  OPTION B - Use a free cloud PostgreSQL (no install needed):" -ForegroundColor Yellow
    Write-Host "    1. Register at https://neon.tech (free tier)" -ForegroundColor White
    Write-Host "    2. Create a project, copy the connection string" -ForegroundColor White
    Write-Host "    3. Fill in DB_* values in .env file manually" -ForegroundColor White
    Write-Host "    4. Skip to step 2 of this script (set -SkipDbCreate flag)" -ForegroundColor White
    Write-Host ""
    Write-Host "  Press any key to open the PostgreSQL download page..." -ForegroundColor DarkGray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    Start-Process "https://www.enterprisedb.com/downloads/postgres-postgresql-downloads"
    exit 0
}

# =============================================================================
# STEP 2: .env configuration
# =============================================================================
Write-Step "2" "Configuring .env..."

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-OK ".env created from .env.example"
}

# Read current .env
$envContent = Get-Content ".env" -Raw

# Check if DB credentials look like placeholders
if ($envContent -match "DB_PASSWORD=change_me") {
    Write-Host ""
    Write-Host "  +----------------------------------------------------------+" -ForegroundColor Yellow
    Write-Host "  |  Set your PostgreSQL password in .env                   |" -ForegroundColor Yellow
    Write-Host "  |                                                          |" -ForegroundColor Yellow
    Write-Host "  |  Required settings:                                      |" -ForegroundColor Yellow
    Write-Host "  |    DB_HOST=localhost                                     |" -ForegroundColor Yellow
    Write-Host "  |    DB_PORT=5432                                          |" -ForegroundColor Yellow
    Write-Host "  |    DB_NAME=gtcp                                          |" -ForegroundColor Yellow
    Write-Host "  |    DB_USER=gtcp_user                                     |" -ForegroundColor Yellow
    Write-Host "  |    DB_PASSWORD=<your postgres password>                  |" -ForegroundColor Yellow
    Write-Host "  +----------------------------------------------------------+" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Opening .env in Notepad. Save and close when done." -ForegroundColor Cyan
    Start-Process notepad ".env" -Wait
    Write-Host "  .env saved. Continuing..." -ForegroundColor Green
}

# Load .env into environment variables for this session
Write-Info "Loading .env values..."
Get-Content ".env" | ForEach-Object {
    if ($_ -match "^\s*([^#][^=]*)=(.*)$") {
        $key = $matches[1].Trim()
        $val = $matches[2].Trim().Trim('"')
        [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
    }
}
Write-OK ".env loaded"

# =============================================================================
# STEP 3: Create DB and user
# =============================================================================
Write-Step "3" "Setting up database..."

$dbName = if ($env:DB_NAME)     { $env:DB_NAME     -replace '"','' } else { "gtcp" }
$dbUser = if ($env:DB_USER)     { $env:DB_USER     -replace '"','' } else { "gtcp_user" }
$dbPass = if ($env:DB_PASSWORD) { $env:DB_PASSWORD -replace '"','' } else { "gtcp_dev_password" }
$dbHost = if ($env:DB_HOST)     { $env:DB_HOST     -replace '"','' } else { "localhost" }
$dbPort = if ($env:DB_PORT)     { $env:DB_PORT     -replace '"','' } else { "5432" }

Write-Info "Target: $dbUser@$dbHost`:$dbPort/$dbName"
Write-Info "App password from .env: $(if($dbPass){'set'}else{'NOT SET'})"

# ---- Quick connection test as app user --------------------------------------
$env:PGPASSWORD = $dbPass
psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c "SELECT 1" 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-OK "Connected as $dbUser - DB already configured"
} else {
    Write-Info "Cannot connect as $dbUser - will create DB/user as superuser"
    Write-Host ""
    Write-Host "  Enter your PostgreSQL superuser (postgres) password:" -ForegroundColor Yellow
    $pgSuperPassSec = Read-Host -Prompt "  postgres password" -AsSecureString
    $pgSuperPass    = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
                        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($pgSuperPassSec))
    $env:PGPASSWORD = $pgSuperPass

    # --- Verify superuser connection first ---
    psql -h $dbHost -p $dbPort -U postgres -c "SELECT current_user;" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  Cannot connect as postgres superuser." -ForegroundColor Red
        Write-Host "  Check that PostgreSQL is running and the password is correct." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  To start PostgreSQL on Windows:" -ForegroundColor White
        Write-Host "    net start postgresql-x64-15   (or -x64-16, -x64-17)" -ForegroundColor DarkGray
        Write-Host "  Or open Services (services.msc) and start the postgresql service." -ForegroundColor DarkGray
        Write-Host ""
        Write-Fail "Superuser connection failed."
    }
    Write-OK "Superuser connected"

    # --- Write all SQL to a temp file (avoids PowerShell quoting/escaping issues) ---
    $tmpSql = [System.IO.Path]::GetTempFileName() -replace '\.tmp$', '.sql'

    # Escape single quotes in password for SQL (double them)
    $dbPassSql = $dbPass -replace "'", "''"

    @"
-- Create user if not exists
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$dbUser') THEN
    CREATE USER $dbUser WITH PASSWORD '$dbPassSql' LOGIN;
  ELSE
    ALTER USER $dbUser WITH PASSWORD '$dbPassSql';
  END IF;
END
`$`$;

-- Create database if not exists
SELECT 'CREATE DATABASE $dbName OWNER $dbUser'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$dbName')\gexec

-- Grants on database
GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;
"@ | Set-Content $tmpSql -Encoding UTF8

    Write-Info "Executing user + DB creation..."
    $out = psql -h $dbHost -p $dbPort -U postgres -f $tmpSql 2>&1
    Write-Info $out
    Remove-Item $tmpSql -Force

    # --- Schema grants (PostgreSQL 15 removed default CREATE on public) ---
    $tmpSql2 = [System.IO.Path]::GetTempFileName() -replace '\.tmp$', '.sql'
    @"
GRANT ALL ON SCHEMA public TO $dbUser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $dbUser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $dbUser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $dbUser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $dbUser;
"@ | Set-Content $tmpSql2 -Encoding UTF8

    Write-Info "Granting schema privileges..."
    $out2 = psql -h $dbHost -p $dbPort -U postgres -d $dbName -f $tmpSql2 2>&1
    Write-Info $out2
    Remove-Item $tmpSql2 -Force

    # --- Re-test connection as app user ---
    $env:PGPASSWORD = $dbPass
    psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c "SELECT current_user, current_database();" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  Still cannot connect. Diagnostic info:" -ForegroundColor Red
        Write-Host "    Host:     $dbHost"  -ForegroundColor DarkGray
        Write-Host "    Port:     $dbPort"  -ForegroundColor DarkGray
        Write-Host "    Database: $dbName"  -ForegroundColor DarkGray
        Write-Host "    User:     $dbUser"  -ForegroundColor DarkGray
        Write-Host "    Password: (from .env DB_PASSWORD)" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "  Common fixes:" -ForegroundColor Yellow
        Write-Host "    1. Make sure DB_PASSWORD in .env matches what you set above" -ForegroundColor White
        Write-Host "    2. Check pg_hba.conf allows md5/scram auth for localhost" -ForegroundColor White
        Write-Host "       File location: C:\Program Files\PostgreSQL\<ver>\data\pg_hba.conf" -ForegroundColor DarkGray
        Write-Host "       Should contain: host all all 127.0.0.1/32 scram-sha-256" -ForegroundColor DarkGray
        Write-Host "    3. Verify PostgreSQL service is running (services.msc)" -ForegroundColor White
        Write-Host ""
        Write-Fail "Database connection failed. See hints above."
    }
    Write-OK "DB user and database configured successfully"
}

# =============================================================================
# STEP 4: npm install
# =============================================================================
Write-Step "4" "npm install..."
if (Test-Path "node_modules") {
    npm ci --omit=dev --silent
} else {
    npm install --omit=dev --silent
}
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed" }
Write-OK "Dependencies installed"

# =============================================================================
# STEP 5: Migrate
# =============================================================================
Write-Step "5" "Running database migrations..."
if (-not $SkipMigrate) {
    node src/db/migrate.js
    if ($LASTEXITCODE -ne 0) { Write-Fail "Migration failed. Check DB connection in .env" }
    Write-OK "Migrations applied"
} else {
    Write-Warn "Skipped (SkipMigrate)"
}

# =============================================================================
# STEP 6: Seed
# =============================================================================
Write-Step "6" "Loading demo data (seed)..."
if (-not $SkipSeed) {
    Write-Info "Generating Argon2 hashes (~10 sec)..."
    node src/db/seed.js
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Seed returned error (data may already exist - OK on re-run)"
    } else {
        Write-OK "Seed completed"
    }
} else {
    Write-Warn "Skipped (SkipSeed)"
}

# =============================================================================
# Done - start server
# =============================================================================
Write-Host ""
Write-Host "  +------------------------------------------------------------+" -ForegroundColor Green
Write-Host "  |  Starting GTCP API on http://localhost:$Port              |" -ForegroundColor Green
Write-Host "  |  Press Ctrl+C to stop the server                          |" -ForegroundColor Green
Write-Host "  +------------------------------------------------------------+" -ForegroundColor Green
Write-Host ""
Write-Host "  DEMO CREDENTIALS:" -ForegroundColor Cyan
Write-Host "    admin        / Admin@2026!      (admin)" -ForegroundColor White
Write-Host "    dispatcher1  / Disp@2026!       (dispatcher)" -ForegroundColor White
Write-Host "    credit1      / Credit@2026!     (credit)" -ForegroundColor White
Write-Host "    billing1     / Billing@2026!    (billing)" -ForegroundColor White
Write-Host "    contracts1   / Contracts@2026!  (contracts)" -ForegroundColor White
Write-Host ""

# Open browser after 3 sec
$htmlPath = Join-Path $ScriptDir "..\Soft\GTCP_MVP.html"
if (Test-Path $htmlPath) {
    Start-Job -ScriptBlock {
        param($path)
        Start-Sleep -Seconds 3
        Start-Process $path
    } -ArgumentList $htmlPath | Out-Null
    Write-Host "  GTCP_MVP.html will open automatically in 3 seconds..." -ForegroundColor DarkGray
}

Write-Host ""

# Start server (blocking)
$env:PORT      = $Port
$env:NODE_ENV  = "development"
node src/app.js
