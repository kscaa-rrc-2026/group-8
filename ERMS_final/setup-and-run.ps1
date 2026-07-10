# ERMS setup-and-run — checks for required software, installs anything
# missing, then starts the app. Meant to be launched via run.bat, not run
# directly (though `powershell -File setup-and-run.ps1` works too).
#
# What this does, in order:
#   1. Check for Node.js — install via winget if missing.
#   2. Check for a reachable PostgreSQL on port 5432 — start its service if
#      installed-but-stopped, otherwise install via winget.
#   3. npm install (skipped if already done).
#   4. Create apps/api/.env and packages/db/.env from .env.example if missing.
#   5. Generate the Prisma client and apply the already-committed migrations
#      (non-interactive — this repo ships with its migration history intact,
#      so there's never a "create the first migration" step for a fresh
#      clone the way there was during initial development).
#   6. Seed the 5 demo accounts (safe to re-run — it upserts).
#   7. Start the API and web dev servers in their own windows and open the
#      browser.
#
# If step 1 or 2 needs to install something, Windows will likely show a
# security ("UAC") prompt asking for permission — click Yes to allow it.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Write-Step($text) {
    Write-Host ""
    Write-Host "== $text ==" -ForegroundColor Cyan
}

function Test-CommandExists($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Sync-PathFromRegistry {
    # A freshly-installed program updates the registry's PATH, but this
    # already-running PowerShell process (and its own child processes)
    # won't see that until it re-reads the registry itself — Windows does
    # not push PATH updates into processes that are already running.
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
}

function Fail($message) {
    Write-Host ""
    Write-Host "[ERROR] $message" -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host "============================================" -ForegroundColor Yellow
Write-Host " ERMS - Expense Reimbursement Management System" -ForegroundColor Yellow
Write-Host " Checking your system, then starting the app" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

if (-not (Test-CommandExists "winget")) {
    Fail "winget (Windows Package Manager) isn't available, so prerequisites can't be auto-installed.`nInstall 'App Installer' from the Microsoft Store, then re-run this script.`nOr install Node.js (https://nodejs.org) and PostgreSQL (https://www.postgresql.org/download/windows/) manually."
}

# ─── 1. Node.js ──────────────────────────────────────────────────────────
Write-Step "1/6  Node.js"
Sync-PathFromRegistry
if (Test-CommandExists "node") {
    Write-Host "Already installed: $(node -v)"
} else {
    Write-Host "Not found - installing via winget."
    Write-Host "If Windows asks for permission (a security prompt), click Yes."
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
    Sync-PathFromRegistry
    if (-not (Test-CommandExists "node")) {
        Fail "Node.js install didn't complete. Install it manually from https://nodejs.org (LTS) and re-run this script."
    }
    Write-Host "Installed: $(node -v)"
}

# ─── 2. PostgreSQL ───────────────────────────────────────────────────────
Write-Step "2/6  PostgreSQL"
function Test-PostgresListening {
    return (Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue).TcpTestSucceeded
}

if (Test-PostgresListening) {
    Write-Host "Already running on port 5432."
} else {
    $pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($pgService) {
        Write-Host "Found installed PostgreSQL service '$($pgService.Name)' but it's not running - starting it."
        Start-Service $pgService.Name
        Start-Sleep -Seconds 3
    }
}

if (-not (Test-PostgresListening)) {
    Write-Host "Not found - installing via winget (this sets the postgres superuser password to 'postgres',"
    Write-Host "matching .env.example's DATABASE_URL)."
    Write-Host "This WILL show a Windows security prompt asking for permission - click Yes."
    winget install -e --id PostgreSQL.PostgreSQL.16 --accept-source-agreements --accept-package-agreements --silent --override "--mode unattended --superpassword postgres --serverport 5432"
    Sync-PathFromRegistry
    Start-Sleep -Seconds 5
    if (-not (Test-PostgresListening)) {
        Write-Host "[WARNING] PostgreSQL doesn't seem to be listening on port 5432 yet." -ForegroundColor Yellow
        Write-Host "          It may still be finishing setup, or may need a system restart to register its service." -ForegroundColor Yellow
        Write-Host "          Continuing anyway - if the next steps fail, restart your computer and re-run this script." -ForegroundColor Yellow
    } else {
        Write-Host "PostgreSQL is running on port 5432."
    }
}

# ─── 3. npm install ──────────────────────────────────────────────────────
Write-Step "3/6  Project dependencies"
if (Test-Path "node_modules") {
    Write-Host "Already installed, skipping."
} else {
    Write-Host "Running npm install - this can take a few minutes the first time..."
    npm install
    if ($LASTEXITCODE -ne 0) { Fail "npm install failed. See the output above." }
}

# ─── 4. .env files ───────────────────────────────────────────────────────
Write-Step "4/6  Environment files"
if (-not (Test-Path "apps\api\.env")) {
    Copy-Item ".env.example" "apps\api\.env"
    Write-Host "Created apps\api\.env from .env.example."
}
if (-not (Test-Path "packages\db\.env")) {
    Copy-Item ".env.example" "packages\db\.env"
    Write-Host "Created packages\db\.env from .env.example."
}
Write-Host "If your PostgreSQL connection differs from the default (postgres/postgres on localhost:5432),"
Write-Host "edit DATABASE_URL in both files before continuing."

# ─── 5. Prisma generate + migrate ────────────────────────────────────────
Write-Step "5/6  Database schema"
npm run db:generate
if ($LASTEXITCODE -ne 0) { Fail "Prisma generate failed. Check DATABASE_URL in apps\api\.env and packages\db\.env." }

# This repo ships with its full migration history already committed, so
# `migrate deploy` (non-interactive, just applies what's there) is always
# the right command here — never `migrate dev`, which would prompt for a
# migration name if it ever saw uncommitted schema drift.
npm run db:migrate:deploy
if ($LASTEXITCODE -ne 0) { Fail "Migration failed. Is PostgreSQL running and is DATABASE_URL correct in apps\api\.env / packages\db\.env?" }

npm run db:seed

# ─── 6. Start the app ────────────────────────────────────────────────────
Write-Step "6/6  Starting servers"
Start-Process cmd -ArgumentList "/k", "npm run dev:api" | Out-Null
Start-Sleep -Seconds 2
Start-Process cmd -ArgumentList "/k", "npm run dev:web" | Out-Null
Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " Done - servers are starting in their own windows." -ForegroundColor Green
Write-Host " Close those windows to stop them." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Log in at http://localhost:5173 with any of (password: ChangeMe123!):"
Write-Host "  employee@erms.local   (Employee)"
Write-Host "  manager@erms.local    (Manager)"
Write-Host "  accounts@erms.local   (Accounts)"
Write-Host "  admin@erms.local      (Admin)"
Write-Host "  ceo@erms.local        (CEO)"
Write-Host ""
Read-Host "Press Enter to close this window"
