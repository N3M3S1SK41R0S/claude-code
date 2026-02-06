@echo off
REM ==============================================================================
REM AI Orchestrator - Windows Launcher
REM Double-click this file to start the AI Orchestrator
REM ==============================================================================

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo.
echo ======================================================================
echo                        AI ORCHESTRATOR
echo                Multi-AI Collaboration System
echo ======================================================================
echo.

REM Check for Python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.8 or higher from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

REM Check Python version
for /f "tokens=*" %%i in ('python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"') do set PYTHON_VERSION=%%i
echo [OK] Python %PYTHON_VERSION% detected

REM Check/create virtual environment
set "VENV_DIR=%SCRIPT_DIR%.venv"

if not exist "%VENV_DIR%" (
    echo [INFO] Creating virtual environment...
    python -m venv "%VENV_DIR%"
)

REM Activate virtual environment
call "%VENV_DIR%\Scripts\activate.bat"

REM Check/install dependencies
if exist "%SCRIPT_DIR%requirements.txt" (
    echo [INFO] Checking dependencies...
    pip install -q -r "%SCRIPT_DIR%requirements.txt" 2>nul
    echo [OK] Dependencies ready
)

REM Create necessary directories
if not exist "%USERPROFILE%\.ai-orchestrator\logs" mkdir "%USERPROFILE%\.ai-orchestrator\logs"
if not exist "%USERPROFILE%\.ai-orchestrator\projects" mkdir "%USERPROFILE%\.ai-orchestrator\projects"

echo.
echo [INFO] Starting AI Orchestrator...
echo.

REM Run the orchestrator
python orchestrator.py

REM Deactivate virtual environment
call deactivate 2>nul

echo.
echo [INFO] AI Orchestrator session ended
pause
