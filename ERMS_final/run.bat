@echo off
setlocal enabledelayedexpansion

:: ERMS dev launcher - double-click this or run it from a terminal.
:: Installs deps (first run only), sets up the database, then starts the
:: API (http://localhost:4000) and Web (http://localhost:5173) dev servers
:: each in their own window. Close those windows to stop the servers.

cd /d "%~dp0"

echo ============================================
echo  ERMS - Expense Reimbursement Management System
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found on PATH.
    echo Install it from https://nodejs.org (LTS, 18.18+) and re-run this script.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [1/5] Installing dependencies - this can take a few minutes the first time...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed. See the output above.
        pause
        exit /b 1
    )
) else (
    echo [1/5] Dependencies already installed, skipping npm install.
)
echo.

if not exist "apps\api\.env" (
    echo [2/5] Creating apps\api\.env from .env.example
    copy /y ".env.example" "apps\api\.env" >nul
    echo         Edit apps\api\.env if your PostgreSQL connection differs from the default.
)
if not exist "packages\db\.env" (
    echo [2/5] Creating packages\db\.env from .env.example
    copy /y ".env.example" "packages\db\.env" >nul
)
echo.

echo [3/5] Generating Prisma client...
call npm run db:generate
if errorlevel 1 (
    echo [ERROR] Prisma generate failed. Check DATABASE_URL in apps\api\.env and packages\db\.env.
    pause
    exit /b 1
)
echo.

if not exist "packages\db\prisma\migrations" (
    echo [4/5] No migrations yet - creating the initial migration...
    echo         (Commit the generated packages\db\prisma\migrations folder to git
    echo          afterwards so teammates don't have to do this step again.)
    call npm run migrate --workspace=packages/db -- --name init
) else (
    echo [4/5] Applying existing migrations...
    call npm run db:migrate:deploy
)
if errorlevel 1 (
    echo [ERROR] Migration failed. Is PostgreSQL running and DATABASE_URL correct?
    pause
    exit /b 1
)
echo.

echo [4/5] Seeding sample data (safe to run repeatedly)...
call npm run db:seed
echo.

echo [5/5] Starting API and Web servers in separate windows...
start "ERMS API - http://localhost:4000" cmd /k "npm run dev:api"
timeout /t 2 /nobreak >nul
start "ERMS Web - http://localhost:5173" cmd /k "npm run dev:web"

timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Servers are starting in their own windows - close those windows to stop them.
echo.
echo Log in with any of the seeded accounts (password: ChangeMe123!):
echo   employee@erms.local   (Employee)
echo   manager@erms.local    (Manager)
echo   accounts@erms.local   (Accounts)
echo   admin@erms.local      (Admin)
echo.
pause
