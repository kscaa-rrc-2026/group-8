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
#   5. Generate the Prisma client and apply the already-committed migrations.
#      If PostgreSQL was already installed on this machine (with its own
#      password, and without this project's database created yet), this
#      step detects that, creates the database if needed, and prompts for
#      the correct password if the default one is wrong — rather than
#      just failing.
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

# Runs a command through cmd.exe with its OWN redirection (`> file 2>&1`)
# rather than PowerShell's `2>&1` operator. In Windows PowerShell 5.1,
# piping a native command's stderr through PowerShell's own `2>&1` wraps
# every line as a terminating NativeCommandError — which, combined with
# $ErrorActionPreference = "Stop", would abort the script on the first
# warning a tool prints to stderr, even on success. Redirecting at the
# cmd.exe level avoids that entirely: PowerShell only ever sees one plain
# external process.
function Invoke-Logged($command) {
    $logFile = [System.IO.Path]::GetTempFileName()
    try {
        cmd /c "$command > `"$logFile`" 2>&1"
        $exitCode = $LASTEXITCODE
        $output = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
        Write-Host $output
        return [PSCustomObject]@{ ExitCode = $exitCode; Output = $output }
    } finally {
        Remove-Item $logFile -Force -ErrorAction SilentlyContinue
    }
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

# ─── 5. Prisma generate + migrate (self-healing) ────────────────────────
Write-Step "5/6  Database schema"

function Get-DatabaseUrlParts {
    # Both .env files carry the same DATABASE_URL — read from either one.
    $line = Get-Content "packages\db\.env" -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if (-not $line) { return $null }
    $url = ($line -split '=', 2)[1].Trim().Trim('"')
    if ($url -match 'postgresql://([^:]+):([^@]+)@([^:/]+):(\d+)/([^?]+)') {
        return [PSCustomObject]@{ User = $matches[1]; Password = $matches[2]; HostName = $matches[3]; Port = $matches[4]; Database = $matches[5] }
    }
    return $null
}

function Set-DatabaseUrlPassword($newPassword) {
    foreach ($envFile in @("apps\api\.env", "packages\db\.env")) {
        if (-not (Test-Path $envFile)) { continue }
        $updated = Get-Content $envFile | ForEach-Object {
            if ($_ -match '^\s*DATABASE_URL\s*=') {
                $url = ($_ -split '=', 2)[1].Trim().Trim('"')
                if ($url -match '^(postgresql://[^:]+):[^@]+@(.*)$') {
                    "DATABASE_URL=`"$($matches[1]):$newPassword@$($matches[2])`""
                } else { $_ }
            } else { $_ }
        }
        Set-Content $envFile $updated
    }
}

function Test-TargetDatabaseExists($parts) {
    $env:PGPASSWORD = $parts.Password
    $result = & psql -U $parts.User -h $parts.HostName -p $parts.Port -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$($parts.Database)'" 2>$null
    return ($result -match "1")
}

function New-TargetDatabase($parts) {
    $env:PGPASSWORD = $parts.Password
    & psql -U $parts.User -h $parts.HostName -p $parts.Port -d postgres -c "CREATE DATABASE `"$($parts.Database)`";" 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

# If PostgreSQL was already installed on this machine (rather than by step
# 2 above), it almost certainly doesn't have this project's database
# created yet, and may use a different superuser password than the
# 'postgres' default in .env.example. Handle both without just failing.
$dbParts = Get-DatabaseUrlParts
$hasPsql = Test-CommandExists "psql"
if ($dbParts -and $hasPsql -and -not (Test-TargetDatabaseExists $dbParts)) {
    Write-Host "Database '$($dbParts.Database)' doesn't exist yet on this PostgreSQL server - creating it..."
    if (New-TargetDatabase $dbParts) {
        Write-Host "Created."
    } else {
        Write-Host "[WARNING] Couldn't create it automatically (likely a password issue) - the next step will confirm." -ForegroundColor Yellow
    }
}

$maxAttempts = 3
$succeeded = $false
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    $gen = Invoke-Logged "npm run db:generate"
    $result = $gen
    if ($gen.ExitCode -eq 0) {
        $mig = Invoke-Logged "npm run db:migrate:deploy"
        $result = $mig
        if ($mig.ExitCode -eq 0) { $succeeded = $true; break }
    }

    if ($result.Output -match "P1000" -or $result.Output -match "Authentication failed") {
        Write-Host ""
        Write-Host "[!] PostgreSQL rejected the password in DATABASE_URL." -ForegroundColor Yellow
        Write-Host "    PostgreSQL was already installed on this machine with a different password" -ForegroundColor Yellow
        Write-Host "    than this project's default ('postgres')." -ForegroundColor Yellow
        $newPassword = Read-Host "    Enter the correct 'postgres' superuser password for THIS machine's PostgreSQL"
        if ([string]::IsNullOrWhiteSpace($newPassword)) {
            Fail "Cannot continue without the correct password. Edit DATABASE_URL manually in apps\api\.env and packages\db\.env, then re-run this script."
        }
        Set-DatabaseUrlPassword $newPassword
        $dbParts = Get-DatabaseUrlParts
        if ($dbParts -and $hasPsql -and -not (Test-TargetDatabaseExists $dbParts)) {
            New-TargetDatabase $dbParts | Out-Null
        }
        continue
    }
    if ($result.Output -match "P1003" -or $result.Output -match "does not exist") {
        if ($dbParts -and $hasPsql) {
            Write-Host "Database doesn't exist - creating it and retrying..."
            New-TargetDatabase $dbParts | Out-Null
            continue
        }
        Fail "The database doesn't exist and couldn't be created automatically (psql not found on PATH). Create it manually, or install PostgreSQL's command-line tools, then re-run this script."
    }
    if ($result.Output -match "P1001" -or $result.Output -match "ECONNREFUSED") {
        Fail "Can't reach PostgreSQL at the host/port in DATABASE_URL. Make sure PostgreSQL is running, then re-run this script."
    }
    Fail "Database setup failed. See the output above."
}

if (-not $succeeded) {
    Fail "Database setup failed after $maxAttempts attempts."
}

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
