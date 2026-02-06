@echo off
setlocal EnableDelayedExpansion

:: Claude Code Windows Installer
:: Installs Claude Code via npm with prerequisite checks.
:: Usage: curl -fsSL <url>/install.cmd -o install.cmd && install.cmd && del install.cmd

echo.
echo  Claude Code Installer for Windows
echo  ==================================
echo.

:: -------------------------------------------------------------------
:: 1. Check for Node.js
:: -------------------------------------------------------------------
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed or not in PATH.
    echo.
    echo  Claude Code requires Node.js 18 or later.
    echo  Download it from: https://nodejs.org/
    echo.
    exit /b 1
)

:: -------------------------------------------------------------------
:: 2. Verify Node.js version (must be >= 18)
:: -------------------------------------------------------------------
for /f "tokens=1 delims=v" %%a in ('node -v') do set "NODE_RAW=%%a"
for /f "tokens=1 delims=." %%a in ('node -v') do set "NODE_MAJOR=%%a"
set "NODE_MAJOR=%NODE_MAJOR:v=%"

if %NODE_MAJOR% lss 18 (
    echo  [ERROR] Node.js version is too old: %NODE_RAW%
    echo.
    echo  Claude Code requires Node.js 18 or later.
    echo  Download the latest version from: https://nodejs.org/
    echo.
    exit /b 1
)

echo  [OK] Node.js %NODE_RAW% detected.

:: -------------------------------------------------------------------
:: 3. Check for npm
:: -------------------------------------------------------------------
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] npm is not installed or not in PATH.
    echo.
    echo  npm is required to install Claude Code. It usually comes with Node.js.
    echo  Reinstall Node.js from: https://nodejs.org/
    echo.
    exit /b 1
)

for /f "delims=" %%v in ('npm -v') do set "NPM_VERSION=%%v"
echo  [OK] npm %NPM_VERSION% detected.
echo.

:: -------------------------------------------------------------------
:: 4. Install Claude Code
:: -------------------------------------------------------------------
echo  Installing Claude Code...
echo.

npm install -g @anthropic-ai/claude-code

if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Installation failed.
    echo.
    echo  Common fixes:
    echo    - Run this script as Administrator
    echo    - Check your network connection
    echo    - Try: npm install -g @anthropic-ai/claude-code --force
    echo.
    exit /b 1
)

echo.

:: -------------------------------------------------------------------
:: 5. Verify installation
:: -------------------------------------------------------------------
where claude >nul 2>&1
if %errorlevel% neq 0 (
    echo  [WARN] 'claude' command not found in PATH.
    echo         You may need to restart your terminal.
    echo.
    exit /b 0
)

for /f "delims=" %%v in ('claude --version 2^>nul') do set "CLAUDE_VERSION=%%v"
echo  [OK] Claude Code %CLAUDE_VERSION% installed successfully.
echo.
echo  Get started:
echo    1. Navigate to your project directory
echo    2. Run: claude
echo.
echo  Documentation: https://docs.anthropic.com/en/docs/claude-code/overview
echo.

endlocal
exit /b 0
