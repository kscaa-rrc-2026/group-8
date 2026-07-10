@echo off
:: ERMS launcher — double-click this after cloning the repo.
::
:: Checks whether Node.js and PostgreSQL are installed, installs whichever
:: is missing, then sets up and starts the app. Safe to re-run any time —
:: every step is skipped if already done.
::
:: The real logic lives in setup-and-run.ps1 (PowerShell handles installer
:: detection and PATH refresh far more reliably than batch syntax) — this
:: file just launches it. Keep both files together.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-and-run.ps1"
