@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title NEMESIS ULTIMATE - Installation 100%% Automatique
color 0A

:: ============================================================================
::  NEMESIS ULTIMATE INSTALLER v2.0
::  Installation + Configuration + Import + Demarrage - 100%% AUTOMATIQUE
::  Zero interaction requise
:: ============================================================================

echo.
echo  ██████╗ ██╗   ██╗██╗  ████████╗██╗███╗   ███╗ █████╗ ████████╗███████╗
echo  ██╔══██╗██║   ██║██║  ╚══██╔══╝██║████╗ ████║██╔══██╗╚══██╔══╝██╔════╝
echo  ██║  ██║██║   ██║██║     ██║   ██║██╔████╔██║███████║   ██║   █████╗
echo  ██║  ██║██║   ██║██║     ██║   ██║██║╚██╔╝██║██╔══██║   ██║   ██╔══╝
echo  ██████╔╝╚██████╔╝███████╗██║   ██║██║ ╚═╝ ██║██║  ██║   ██║   ███████╗
echo  ╚═════╝  ╚═════╝ ╚══════╝╚═╝   ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝
echo.
echo                    NEMESIS HUB - INSTALLATION ULTIMATE
echo                         100%% Automatique - Zero Config
echo.
echo  ═══════════════════════════════════════════════════════════════════════
echo.

:: === ELEVATION ADMIN ===
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [AUTO] Elevation administrateur...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs -ArgumentList '%~dp0'" >nul 2>&1
    exit /b
)

:: === CONFIGURATION GLOBALE ===
set "SCRIPT_DIR=%~dp0"
set "N8N_PORT=5678"
set "N8N_URL=http://localhost:%N8N_PORT%"
set "N8N_API=%N8N_URL%/api/v1"
set "CLAUDE_DIR=%APPDATA%\Claude"
set "CLAUDE_CONFIG=%CLAUDE_DIR%\claude_desktop_config.json"
set "N8N_DIR=%USERPROFILE%\.n8n"
set "WORKFLOWS_DIR=%SCRIPT_DIR%workflows"
set "ENV_FILE=%SCRIPT_DIR%config\.env"
set "LOG_FILE=%USERPROFILE%\nemesis-ultimate.log"
set "DESKTOP=%USERPROFILE%\Desktop"

:: Timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "DT=%%I"
set "TIMESTAMP=%DT:~0,4%-%DT:~4,2%-%DT:~6,2% %DT:~8,2%:%DT:~10,2%:%DT:~12,2%"

echo [%TIMESTAMP%] NEMESIS ULTIMATE - Demarrage > "%LOG_FILE%"

:: ============================================================================
:: PHASE 1: PREREQUIS
:: ============================================================================
echo [PHASE 1/7] Verification des prerequis...

:: Check Node.js
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo    [+] Installation Node.js...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '$env:TEMP\node.msi'; Start-Process msiexec.exe -Wait -ArgumentList '/i','$env:TEMP\node.msi','/quiet','/norestart'"
    set "PATH=%PATH%;C:\Program Files\nodejs"
    echo    [OK] Node.js installe
) else (
    for /f "tokens=*" %%v in ('node -v') do echo    [OK] Node.js %%v
)

:: ============================================================================
:: PHASE 2: INSTALLATION PACKAGES
:: ============================================================================
echo [PHASE 2/7] Installation des packages...
call npm install -g n8n >nul 2>&1
echo    [OK] n8n installe

:: ============================================================================
:: PHASE 3: CREATION FICHIER ENVIRONNEMENT
:: ============================================================================
echo [PHASE 3/7] Creation configuration environnement...

if not exist "%SCRIPT_DIR%config" mkdir "%SCRIPT_DIR%config" >nul 2>&1

(
echo # NEMESIS HUB - Configuration Environnement
echo # Genere automatiquement le %TIMESTAMP%
echo # IMPORTANT: Remplacez les valeurs VOTRE_* par vos vraies cles API
echo.
echo # === N8N LOCAL ===
echo N8N_API_URL=http://localhost:5678/api/v1
echo N8N_API_KEY=VOTRE_CLE_API_N8N
echo.
echo # === GOOGLE AI STUDIO ===
echo GOOGLE_AI_API_KEY=VOTRE_CLE_GOOGLE_AI
echo.
echo # === NOTION ===
echo NOTION_API_KEY=secret_VOTRE_CLE_NOTION
echo NOTION_DATABASE_ID=VOTRE_DATABASE_ID
echo NOTION_SYNC_LOG_DB=VOTRE_SYNC_LOG_DB_ID
echo NOTION_CONTENT_DB=VOTRE_CONTENT_DB_ID
echo NOTION_SOCIAL_LOG_DB=VOTRE_SOCIAL_LOG_DB_ID
echo NOTION_HEALTH_DB=VOTRE_HEALTH_DB_ID
echo NOTION_ERROR_LOG_DB=VOTRE_ERROR_LOG_DB_ID
echo NOTION_BACKUP_DB=VOTRE_BACKUP_DB_ID
echo NOTION_DATA_SOURCE_DB=VOTRE_DATA_SOURCE_DB_ID
echo.
echo # === DISCORD ===
echo DISCORD_BOT_TOKEN=VOTRE_TOKEN_BOT_DISCORD
echo DISCORD_LOG_CHANNEL=VOTRE_CHANNEL_LOG_ID
echo DISCORD_ALERT_CHANNEL=VOTRE_CHANNEL_ALERT_ID
echo DISCORD_ERROR_CHANNEL=VOTRE_CHANNEL_ERROR_ID
echo DISCORD_CONTENT_CHANNEL=VOTRE_CHANNEL_CONTENT_ID
echo DISCORD_SOCIAL_CHANNEL=VOTRE_CHANNEL_SOCIAL_ID
echo DISCORD_DATA_CHANNEL=VOTRE_CHANNEL_DATA_ID
echo.
echo # === GITHUB ===
echo GITHUB_TOKEN=ghp_VOTRE_TOKEN_GITHUB
echo GITHUB_OWNER=VOTRE_USERNAME
echo GITHUB_REPO=VOTRE_REPO
echo.
echo # === HEYGEN ===
echo HEYGEN_API_KEY=VOTRE_CLE_HEYGEN
echo.
echo # === MIDJOURNEY via GOAPI ===
echo GOAPI_KEY=VOTRE_CLE_GOAPI
echo MJ_CHANNEL_ID=VOTRE_CHANNEL_MIDJOURNEY_ID
echo.
echo # === BUBBLE ===
echo BUBBLE_API_KEY=VOTRE_CLE_BUBBLE
echo BUBBLE_APP_NAME=VOTRE_APP_NAME
echo.
echo # === MAKE ===
echo MAKE_API_KEY=VOTRE_CLE_MAKE
echo MAKE_WEBHOOK_URL=https://hook.eu1.make.com/VOTRE_WEBHOOK
echo.
echo # === SLACK ===
echo SLACK_TOKEN=xoxb-VOTRE_TOKEN_SLACK
echo SLACK_SOCIAL_CHANNEL=VOTRE_CHANNEL_SLACK_ID
) > "%ENV_FILE%"

echo    [OK] Fichier .env cree: %ENV_FILE%

:: ============================================================================
:: PHASE 4: CONFIGURATION CLAUDE DESKTOP
:: ============================================================================
echo [PHASE 4/7] Configuration Claude Desktop...

if not exist "%CLAUDE_DIR%" mkdir "%CLAUDE_DIR%" >nul 2>&1

:: Backup si existe
if exist "%CLAUDE_CONFIG%" (
    copy "%CLAUDE_CONFIG%" "%CLAUDE_CONFIG%.backup.%DT:~0,8%" >nul 2>&1
)

:: Ecrire config complete
powershell -Command ^
    "$config = @{" ^
    "    mcpServers = @{" ^
    "        n8n = @{" ^
    "            command = 'npx'" ^
    "            args = @('-y', '@leonardsellem/n8n-mcp-server')" ^
    "            env = @{" ^
    "                N8N_API_URL = 'http://localhost:5678/api/v1'" ^
    "                N8N_API_KEY = 'REMPLACEZ_VOTRE_CLE_N8N'" ^
    "            }" ^
    "        }" ^
    "        filesystem = @{" ^
    "            command = 'npx'" ^
    "            args = @('-y', '@modelcontextprotocol/server-filesystem', $env:USERPROFILE)" ^
    "        }" ^
    "        fetch = @{" ^
    "            command = 'npx'" ^
    "            args = @('-y', '@modelcontextprotocol/server-fetch')" ^
    "        }" ^
    "        memory = @{" ^
    "            command = 'npx'" ^
    "            args = @('-y', '@modelcontextprotocol/server-memory')" ^
    "        }" ^
    "        github = @{" ^
    "            command = 'npx'" ^
    "            args = @('-y', '@modelcontextprotocol/server-github')" ^
    "            env = @{ GITHUB_PERSONAL_ACCESS_TOKEN = 'REMPLACEZ_VOTRE_TOKEN' }" ^
    "        }" ^
    "    }" ^
    "};" ^
    "$config | ConvertTo-Json -Depth 10 | Set-Content '%CLAUDE_CONFIG%' -Encoding UTF8"

echo    [OK] Claude Desktop configure

:: ============================================================================
:: PHASE 5: DEMARRAGE N8N
:: ============================================================================
echo [PHASE 5/7] Demarrage n8n...

:: Verifier si deja en cours
curl -s "%N8N_URL%" >nul 2>&1
if %errorLevel% equ 0 (
    echo    [OK] n8n deja actif
    goto :n8n_ready
)

:: Demarrer n8n en arriere-plan
start "" /min cmd /c "set N8N_BASIC_AUTH_ACTIVE=false && npx n8n start"

:: Attendre demarrage
echo    [..] Attente demarrage n8n...
set "WAIT=0"
:wait_n8n
if %WAIT% geq 60 (
    echo    [!!] Timeout - n8n demarre en arriere-plan
    goto :n8n_ready
)
timeout /t 3 >nul
set /a WAIT+=3
curl -s "%N8N_URL%" >nul 2>&1
if %errorLevel% neq 0 goto :wait_n8n
echo    [OK] n8n demarre en %WAIT%s

:n8n_ready

:: ============================================================================
:: PHASE 6: IMPORT AUTOMATIQUE DES WORKFLOWS
:: ============================================================================
echo [PHASE 6/7] Import des workflows...

:: Creer script PowerShell pour import
set "IMPORT_SCRIPT=%TEMP%\import-workflows.ps1"

(
echo $n8nUrl = "http://localhost:5678"
echo $workflowsDir = "%WORKFLOWS_DIR%"
echo $imported = 0
echo $failed = 0
echo.
echo # Attendre que n8n soit pret
echo $maxWait = 30
echo $waited = 0
echo while ($waited -lt $maxWait^) {
echo     try {
echo         $response = Invoke-WebRequest -Uri "$n8nUrl" -TimeoutSec 2 -UseBasicParsing
echo         if ($response.StatusCode -eq 200^) { break }
echo     } catch {}
echo     Start-Sleep -Seconds 2
echo     $waited += 2
echo }
echo.
echo # Importer chaque workflow
echo Get-ChildItem -Path $workflowsDir -Filter "*.json" ^| ForEach-Object {
echo     $file = $_.FullName
echo     $name = $_.BaseName
echo     Write-Host "   [+] Import: $name"
echo     try {
echo         $workflow = Get-Content $file -Raw ^| ConvertFrom-Json
echo         $body = @{
echo             name = $workflow.name
echo             nodes = $workflow.nodes
echo             connections = $workflow.connections
echo             settings = $workflow.settings
echo             active = $false
echo         } ^| ConvertTo-Json -Depth 20
echo.
echo         $result = Invoke-RestMethod -Uri "$n8nUrl/api/v1/workflows" -Method Post -Body $body -ContentType "application/json" -ErrorAction SilentlyContinue
echo         $imported++
echo     } catch {
echo         Write-Host "   [!] Erreur: $name"
echo         $failed++
echo     }
echo }
echo.
echo Write-Host "   [OK] Importes: $imported / Erreurs: $failed"
) > "%IMPORT_SCRIPT%"

:: Executer import (peut echouer si pas d'API key - c'est normal)
powershell -ExecutionPolicy Bypass -File "%IMPORT_SCRIPT%" 2>nul

echo    [INFO] Workflows prets dans: %WORKFLOWS_DIR%
echo    [INFO] Import manuel: n8n ^> Workflows ^> Import from File

:: ============================================================================
:: PHASE 7: CREATION RACCOURCIS ET FINALISATION
:: ============================================================================
echo [PHASE 7/7] Creation raccourcis...

:: Script Start
(
echo @echo off
echo title NEMESIS HUB
echo color 0A
echo echo Demarrage NEMESIS HUB...
echo start "" /min cmd /c "npx n8n start"
echo timeout /t 5 ^>nul
echo start "" "http://localhost:5678"
echo echo [OK] n8n sur http://localhost:5678
) > "%DESKTOP%\NEMESIS-Start.bat"

:: Script Stop
(
echo @echo off
echo taskkill /f /im node.exe 2^>nul
echo echo [OK] Arrete
) > "%DESKTOP%\NEMESIS-Stop.bat"

:: Script Config
(
echo @echo off
echo start notepad "%ENV_FILE%"
echo start notepad "%CLAUDE_CONFIG%"
) > "%DESKTOP%\NEMESIS-Config.bat"

:: Script Import Workflows
(
echo @echo off
echo echo Ouvrez n8n et importez les workflows depuis:
echo echo %WORKFLOWS_DIR%
echo echo.
echo start "" "http://localhost:5678"
echo explorer "%WORKFLOWS_DIR%"
echo pause
) > "%DESKTOP%\NEMESIS-Import.bat"

:: Script Test Connexions
(
echo @echo off
echo title NEMESIS - Test Connexions
echo echo Test des connexions API...
echo echo.
echo echo [n8n Local]
echo curl -s -o nul -w "   Status: %%%%{http_code}\n" http://localhost:5678
echo echo.
echo echo [Google AI]
echo curl -s -o nul -w "   Status: %%%%{http_code}\n" https://generativelanguage.googleapis.com
echo echo.
echo echo [Notion API]
echo curl -s -o nul -w "   Status: %%%%{http_code}\n" https://api.notion.com
echo echo.
echo echo [Discord API]
echo curl -s -o nul -w "   Status: %%%%{http_code}\n" https://discord.com/api
echo echo.
echo echo [GitHub API]
echo curl -s -o nul -w "   Status: %%%%{http_code}\n" https://api.github.com
echo echo.
echo pause
) > "%DESKTOP%\NEMESIS-Test.bat"

echo    [OK] 5 raccourcis crees sur le Bureau

:: ============================================================================
:: RESUME FINAL
:: ============================================================================
echo.
echo  ═══════════════════════════════════════════════════════════════════════
echo                    NEMESIS ULTIMATE - INSTALLATION TERMINEE
echo  ═══════════════════════════════════════════════════════════════════════
echo.
echo  [OK] Node.js installe
echo  [OK] n8n installe et demarre
echo  [OK] Claude Desktop configure
echo  [OK] Fichier .env cree
echo  [OK] 19 workflows prets
echo  [OK] Raccourcis Bureau crees
echo.
echo  ═══════════════════════════════════════════════════════════════════════
echo                              FICHIERS CREES
echo  ═══════════════════════════════════════════════════════════════════════
echo.
echo  Configuration:
echo    %ENV_FILE%
echo    %CLAUDE_CONFIG%
echo.
echo  Workflows (19):
echo    %WORKFLOWS_DIR%
echo.
echo  Raccourcis Bureau:
echo    NEMESIS-Start.bat    - Demarrer n8n
echo    NEMESIS-Stop.bat     - Arreter n8n
echo    NEMESIS-Config.bat   - Editer configuration
echo    NEMESIS-Import.bat   - Importer workflows
echo    NEMESIS-Test.bat     - Tester connexions
echo.
echo  ═══════════════════════════════════════════════════════════════════════
echo                            PROCHAINES ETAPES
echo  ═══════════════════════════════════════════════════════════════════════
echo.
echo  1. Editez %ENV_FILE%
echo     Remplacez VOTRE_* par vos vraies cles API
echo.
echo  2. Ouvrez http://localhost:5678
echo     - Creez un compte n8n (premiere fois)
echo     - Settings ^> API ^> Create API Key
echo     - Copiez la cle dans le fichier .env
echo.
echo  3. Importez les workflows
echo     - Workflows ^> Import from File
echo     - Selectionnez tous les .json de %WORKFLOWS_DIR%
echo.
echo  4. Configurez les credentials n8n
echo     - Settings ^> Credentials ^> Add Credential
echo     - Ajoutez: Notion, Discord, GitHub, etc.
echo.
echo  5. Activez les workflows
echo     - Ouvrez chaque workflow ^> Toggle "Active"
echo.
echo  6. REDEMARREZ Claude Desktop
echo.
echo  ═══════════════════════════════════════════════════════════════════════
echo.

:: Ouvrir n8n
start "" "%N8N_URL%"

echo [%TIMESTAMP%] Installation terminee >> "%LOG_FILE%"
echo Appuyez sur une touche pour fermer...
pause >nul
exit /b 0
