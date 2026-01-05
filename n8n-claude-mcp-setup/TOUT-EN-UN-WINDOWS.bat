@echo off
REM ============================================================================
REM N8N + Claude MCP - SCRIPT COMPLET WINDOWS
REM Double-cliquez sur ce fichier pour tout installer et lancer
REM ============================================================================

title N8N + Claude MCP Installation

echo.
echo  _   _  ___  _   _   _       ____ _                 _
echo ^| \ ^| ^|/ _ \^| \ ^| ^| ^| ^|     / ___^| ^| __ _ _   _  __^| ^| ___
echo ^|  \^| ^| ^(_) ^|  \^| ^| ^|_^|    ^| ^|   ^| ^|/ _` ^| ^| ^| ^|/ _` ^|/ _ \
echo ^| ^|\  ^|\__, ^| ^|\  ^|  _     ^| ^|___^| ^| ^(_^| ^| ^|_^| ^| ^(_^| ^|  __/
echo ^|_^| \_^|  /_/^|_^| \_^| ^(_^)    \____^|_^|\__,_^|\__,_^|\__,_^|\___|
echo.
echo              Installation Windows Complete
echo.
echo ============================================================
echo.

REM Verifier Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Node.js n'est pas installe!
    echo.
    echo ============================================================
    echo   ETAPE 1: Installez Node.js
    echo ============================================================
    echo.
    echo 1. Ouvrez votre navigateur
    echo 2. Allez sur: https://nodejs.org/
    echo 3. Telechargez la version LTS ^(recommandee^)
    echo 4. Installez Node.js
    echo 5. REDEMARREZ votre ordinateur
    echo 6. Relancez ce script
    echo.
    echo Ouverture du site Node.js...
    start https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js installe:
node --version
echo.

REM Verifier si N8N est installe
where n8n >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Installation de N8N...
    echo Cela peut prendre 2-5 minutes, veuillez patienter...
    echo.
    call npm install -g n8n
    if %ERRORLEVEL% NEQ 0 (
        echo [ERREUR] Installation N8N echouee
        pause
        exit /b 1
    )
) else (
    echo [OK] N8N deja installe
)

n8n --version 2>nul
echo.

REM Installer dependances MCP
echo [INFO] Installation des dependances MCP...
cd /d "%~dp0mcp-server"
call npm install 2>nul
echo [OK] Dependances MCP installees
echo.

REM Configurer Claude
echo [INFO] Configuration de Claude...
if not exist "%USERPROFILE%\.claude" mkdir "%USERPROFILE%\.claude"

REM Obtenir le chemin absolu du script
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:\=\\%"

echo {"mcpServers":{"n8n":{"command":"node","args":["%SCRIPT_DIR%mcp-server\\server.js"],"env":{"N8N_API_URL":"http://localhost:5678","N8N_API_KEY":""}}},"permissions":{"allow":["mcp__n8n__*"]}} > "%USERPROFILE%\.claude\settings.json"

echo [OK] Claude configure
echo.

REM Demarrer N8N
echo ============================================================
echo   DEMARRAGE DE N8N
echo ============================================================
echo.
echo N8N va demarrer dans une nouvelle fenetre.
echo.
echo Interface N8N: http://localhost:5678
echo.
echo Pour utiliser Claude avec N8N:
echo   Ouvrez un nouveau terminal et tapez: claude
echo.
echo ============================================================
echo.

set N8N_PORT=5678
set N8N_HOST=0.0.0.0

start "N8N Server" cmd /k "n8n start"

echo N8N demarre! Attendez 30 secondes puis ouvrez:
echo.
echo    http://localhost:5678
echo.
echo Appuyez sur une touche pour ouvrir N8N dans le navigateur...
pause >nul

start http://localhost:5678

echo.
echo Installation terminee!
echo Pour utiliser Claude avec N8N, ouvrez un nouveau terminal et tapez: claude
echo.
pause
