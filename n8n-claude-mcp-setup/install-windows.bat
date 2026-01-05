@echo off
REM ============================================================================
REM N8N + Claude MCP - Installation Windows
REM ============================================================================

echo.
echo ============================================
echo   N8N + Claude MCP Installation Windows
echo ============================================
echo.

REM Verifier Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Node.js n'est pas installe!
    echo.
    echo Telechargez Node.js depuis: https://nodejs.org/
    echo Installez la version LTS, puis relancez ce script.
    pause
    exit /b 1
)

echo [OK] Node.js trouve:
node --version

REM Verifier npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] npm n'est pas installe!
    pause
    exit /b 1
)

echo [OK] npm trouve:
call npm --version

REM Installer N8N globalement
echo.
echo [INFO] Installation de N8N (peut prendre quelques minutes)...
call npm install -g n8n

if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Installation de N8N echouee
    pause
    exit /b 1
)

echo [OK] N8N installe

REM Creer le dossier MCP server
echo.
echo [INFO] Configuration du serveur MCP...

if not exist "%~dp0mcp-server" mkdir "%~dp0mcp-server"

REM Installer les dependances MCP
cd /d "%~dp0mcp-server"
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo [AVERTISSEMENT] Installation des dependances MCP echouee
)

REM Creer le dossier de config Claude
if not exist "%USERPROFILE%\.claude" mkdir "%USERPROFILE%\.claude"

REM Creer la config Claude
echo [INFO] Creation de la configuration Claude...
(
echo {
echo   "mcpServers": {
echo     "n8n": {
echo       "command": "node",
echo       "args": ["%~dp0mcp-server\server.js"],
echo       "env": {
echo         "N8N_API_URL": "http://localhost:5678",
echo         "N8N_API_KEY": ""
echo       }
echo     }
echo   },
echo   "permissions": {
echo     "allow": ["mcp__n8n__*"]
echo   }
echo }
) > "%USERPROFILE%\.claude\settings.json"

echo.
echo ============================================
echo   INSTALLATION TERMINEE !
echo ============================================
echo.
echo Pour demarrer N8N, lancez: start-n8n.bat
echo Pour arreter N8N, lancez: stop-n8n.bat
echo.
echo N8N sera accessible sur: http://localhost:5678
echo.
echo Ensuite, lancez 'claude' pour utiliser les outils MCP.
echo.
pause
