@echo off
REM ==============================================================================
REM AI Orchestrator - Test Runner (Windows)
REM ==============================================================================

setlocal enabledelayedexpansion
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo.
echo ======================================================================
echo              AI ORCHESTRATOR - TEST SUITE
echo ======================================================================
echo.

REM Check Python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found
    pause
    exit /b 1
)

REM Activate venv if exists
if exist "%SCRIPT_DIR%.venv\Scripts\activate.bat" (
    call "%SCRIPT_DIR%.venv\Scripts\activate.bat"
)

echo [INFO] Running tests...
echo.

python -m tests.test_workflow

set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE% equ 0 (
    echo [OK] All tests passed!
) else (
    echo [ERROR] Some tests failed.
)

echo.
pause
exit /b %EXIT_CODE%
