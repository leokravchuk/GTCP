#Requires -Version 5.1
<#
.SYNOPSIS
    GTCP Backend Setup Script
    npm install -> docker compose up -d -> wait DB -> seed -> open browser

.EXAMPLE
    .\setup.ps1
    .\setup.ps1 -SkipBuild
    .\setup.ps1 -SkipSeed
    .\setup.ps1 -OpenBrowser:$false
#>

param(
    [switch]$SkipBuild,
    [switch]$SkipSeed,
    [switch]$SkipNpmInstall,
    [bool]$OpenBrowser = $true
)

# ---- Output helpers ----------------------------------------------------------
function Write-Step  { param($n, $msg) Write-Host "" ; Write-Host "[$n/5] $msg" -ForegroundColor Cyan }
function Write-OK    { param($msg)     Write-Host "      OK  $msg" -ForegroundColor Green }
function Write-Warn  { param($msg)     Write-Host "  [WARN]  $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg)     Write-Host " [ERROR]  $msg" -ForegroundColor Red ; exit 1 }

function Write-Banner {
    Write-Host ""
    Write-Host "  +----------------------------------------------------------+" -ForegroundColor Magenta
    Write-Host "  |  GTCP - Gas Trading & Commercial Platform                |" -ForegroundColor Magenta
    Write-Host "  |  Sprint 4 Backend Setup                                  |" -ForegroundColor Magenta
    Write-Host "  +----------------------------------------------------------+" -ForegroundColor Magenta
    Write-Host ""
}

function Write-Done {
    Write-Host ""
    Write-Host "  +----------------------------------------------------------+" -ForegroundColor Green
    Write-Host "  |  GTCP Backend is running!                                |" -ForegroundColor Green
    Write-Host "  +----------------------------------------------------------+" -ForegroundColor Green
    Write-Host "  |  API:      http://localhost:3000/api/v1                  |" -ForegroundColor Green
    Write-Host "  |  Frontend: http://localhost:80                           |" -ForegroundColor Green
    Write-Host "  |  Health:   http://localhost:3000/health                  |" -ForegroundColor Green
    Write-Host "  +----------------------------------------------------------+" -ForegroundColor Green
    Write-Host "  |  DEMO CREDENTIALS (after seed):                          |" -ForegroundColor Cyan
    Write-Host "  |    admin        / Admin@2026!      (admin)               |" -ForegroundColor Cyan
    Write-Host "  |    dispatcher1  / Disp@2026!       (dispatcher)          |" -ForegroundColor Cyan
    Write-Host "  |    credit1      / Credit@2026!     (credit)              |" -ForegroundColor Cyan
    Write-Host "  |    billing1     / Billing@2026!    (billing)             |" -ForegroundColor Cyan
    Write-Host "  |    contracts1   / Contracts@2026!  (contracts)           |" -ForegroundColor Cyan
    Write-Host "  +----------------------------------------------------------+" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Open Soft\GTCP_MVP.html in your browser." -ForegroundColor White
    Write-Host "  Login with any credential above - data comes from the API." -ForegroundColor White
    Write-Host ""
}

# ---- Working directory -------------------------------------------------------
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir
Write-Banner
Write-Host "  Working directory: $ScriptDir" -ForegroundColor DarkGray

# =============================================================================
# STEP 0: Check dependencies
# =============================================================================
Write-Step "0" "Checking dependencies..."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Fail "Node.js not found. Install Node.js 20 LTS from https://nodejs.org"
}
Write-OK "Node.js $(node -v)"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "  Docker is NOT installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "  You have two options:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  OPTION A - Install Docker Desktop (then re-run setup.ps1):" -ForegroundColor White
    Write-Host "    https://www.docker.com/products/docker-desktop" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  OPTION B - Run WITHOUT Docker (local PostgreSQL):" -ForegroundColor White
    Write-Host "    .\setup_local.ps1" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  setup_local.ps1 will guide you through PostgreSQL setup." -ForegroundColor DarkGray
    Write-Host ""
    $choice = Read-Host "  Launch setup_local.ps1 now? (Y/N)"
    if ($choice -match "^[Yy]") {
        & "$ScriptDir\setup_local.ps1"
    }
    exit 0
}
Write-OK "$(docker -v 2>&1 | Select-Object -First 1)"

docker compose version 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Fail "docker compose plugin not found. Update Docker Desktop."
}
Write-OK "docker compose: OK"

# =============================================================================
# STEP 1: .env file
# =============================================================================
Write-Step "1" "Checking .env..."

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-OK ".env created from .env.example"
    Write-Warn "Open .env and set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET for production use"
    Start-Sleep -Seconds 2
} else {
    Write-OK ".env already exists - skipping"
}

# =============================================================================
# STEP 2: npm install
# =============================================================================
Write-Step "2" "npm install..."

if (-not $SkipNpmInstall) {
    if (Test-Path "node_modules") {
        Write-Host "      node_modules exists - running npm ci" -ForegroundColor DarkGray
        npm ci --omit=dev --silent
    } else {
        npm install --omit=dev --silent
    }
    if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed" }
    Write-OK "Dependencies installed"
} else {
    Write-Warn "Skipped (SkipNpmInstall)"
}

# =============================================================================
# STEP 3: docker compose up
# =============================================================================
Write-Step "3" "docker compose up -d..."

if ($SkipBuild) {
    docker compose up -d
} else {
    docker compose up -d --build
}

if ($LASTEXITCODE -ne 0) {
    Write-Fail "docker compose up failed. Check: docker compose logs"
}
Write-OK "Containers started"

# =============================================================================
# STEP 4: Wait for PostgreSQL
# =============================================================================
Write-Step "4" "Waiting for PostgreSQL (up to 60s)..."

$tries    = 0
$maxTries = 30

do {
    $tries++
    Start-Sleep -Seconds 2
    docker compose exec -T db pg_isready -U gtcp_user -d gtcp 2>&1 | Out-Null
    Write-Host "      [$tries/$maxTries] waiting..." -ForegroundColor DarkGray
} while ($LASTEXITCODE -ne 0 -and $tries -lt $maxTries)

if ($LASTEXITCODE -ne 0) {
    Write-Fail "PostgreSQL did not start in $($maxTries * 2)s. Check: docker compose logs db"
}
Write-OK "PostgreSQL ready (attempts: $tries)"

# =============================================================================
# STEP 5: Seed
# =============================================================================
Write-Step "5" "Loading demo data (seed)..."

if (-not $SkipSeed) {
    Write-Host "      Generating Argon2 hashes (~10 sec)..." -ForegroundColor DarkGray
    docker compose exec -T api node src/db/seed.js

    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Seed returned an error (data may already exist - this is OK on re-run)."
    } else {
        Write-OK "Seed completed successfully!"
    }
} else {
    Write-Warn "Skipped (SkipSeed)"
}

# ---- Done -------------------------------------------------------------------
Write-Done

# ---- Open GTCP_MVP.html -----------------------------------------------------
if ($OpenBrowser) {
    $htmlPath = Join-Path $ScriptDir "..\Soft\GTCP_MVP.html"
    if (Test-Path $htmlPath) {
        Write-Host "  Opening GTCP_MVP.html in browser..." -ForegroundColor Cyan
        Start-Process $htmlPath
    } else {
        Write-Warn "GTCP_MVP.html not found at: $htmlPath"
    }
}

Write-Host "  Press any key to close..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
