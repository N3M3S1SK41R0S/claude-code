@echo off
REM ============================================================
REM NEMESIS Hub - Test Runner for Windows
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   NEMESIS Hub - Workflow Test Suite
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Set n8n URL (default localhost:5678)
if "%N8N_URL%"=="" set N8N_URL=http://localhost:5678

echo [INFO] n8n URL: %N8N_URL%
echo.

REM Check if n8n is running
echo [INFO] Checking if n8n is running...
curl -s -o nul -w "%%{http_code}" %N8N_URL%/healthz > temp_status.txt 2>nul
set /p STATUS=<temp_status.txt
del temp_status.txt 2>nul

if "%STATUS%"=="" (
    echo [WARNING] n8n does not appear to be running!
    echo.
    echo Would you like to start n8n? (Y/N)
    choice /c YN /n
    if !errorlevel!==1 (
        echo [INFO] Starting n8n in background...
        start "n8n" cmd /c "npx n8n"
        echo [INFO] Waiting 10 seconds for n8n to start...
        timeout /t 10 /nobreak >nul
    ) else (
        echo [INFO] Exiting...
        pause
        exit /b 1
    )
)

echo [INFO] Running tests...
echo.

REM Run the test suite
node "%~dp0test-all-workflows.js" %*

echo.
echo ========================================
echo   Tests Complete
echo ========================================
echo.

pause
