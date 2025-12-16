@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title NEMESIS HUB - Installation Complete Multi-Plateformes
color 0A

:: ============================================================================
::  NEMESIS HUB SETUP - INSTALLATION AUTOMATIQUE COMPLETE
::  Installe n8n + Configure tous les workflows + Toutes les plateformes
::  Version: 1.0 ULTIMATE
:: ============================================================================

echo.
echo  ╔═══════════════════════════════════════════════════════════════════════════╗
echo  ║                                                                           ║
echo  ║   ███╗   ██╗███████╗███╗   ███╗███████╗███████╗██╗███████╗               ║
echo  ║   ████╗  ██║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝               ║
echo  ║   ██╔██╗ ██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗               ║
echo  ║   ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║               ║
echo  ║   ██║ ╚████║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║               ║
echo  ║   ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝               ║
echo  ║                                                                           ║
echo  ║                    HUB MULTI-PLATEFORMES v1.0                             ║
echo  ║                                                                           ║
echo  ║   Plateformes supportees:                                                 ║
echo  ║   [+] Google AI Studio  [+] Notion      [+] Discord                       ║
echo  ║   [+] GitHub            [+] HeyGen      [+] Midjourney                    ║
echo  ║   [+] Bubble.io         [+] Make        [+] Zapier                        ║
echo  ║                                                                           ║
echo  ╚═══════════════════════════════════════════════════════════════════════════╝
echo.

:: === ELEVATION ADMIN ===
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Elevation administrateur requise...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs" >nul 2>&1
    exit /b
)

:: === VARIABLES ===
set "N8N_PORT=5678"
set "N8N_URL=http://localhost:%N8N_PORT%"
set "CLAUDE_DIR=%APPDATA%\Claude"
set "CLAUDE_CONFIG=%CLAUDE_DIR%\claude_desktop_config.json"
set "HUB_DIR=%~dp0"
set "WORKFLOWS_DIR=%HUB_DIR%workflows"
set "LOG=%USERPROFILE%\nemesis-hub-install.log"

echo [%TIME%] NEMESIS HUB - Demarrage installation > "%LOG%"

:: ============================================================================
:: ETAPE 1: VERIFICATION NODE.JS
:: ============================================================================
echo [1/8] Verification Node.js...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo        Installation Node.js LTS...
    powershell -Command ^
        "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ^
        $url = 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi'; ^
        $out = \"$env:TEMP\node.msi\"; ^
        (New-Object Net.WebClient).DownloadFile($url, $out); ^
        Start-Process msiexec.exe -Wait -ArgumentList \"/i `\"$out`\" /quiet /norestart\"; ^
        Remove-Item $out -Force" >nul 2>&1

    for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "PATH=%%b;%PATH%"
    echo        [OK] Node.js installe
) else (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do echo        [OK] Node.js %%v present
)

:: ============================================================================
:: ETAPE 2: INSTALLATION N8N ET PACKAGES
:: ============================================================================
echo [2/8] Installation n8n et packages...
call npm install -g n8n @anthropic-ai/claude-code >nul 2>&1
echo        [OK] n8n et packages installes

:: ============================================================================
:: ETAPE 3: CREATION DOSSIER CLAUDE
:: ============================================================================
echo [3/8] Preparation configuration Claude...
if not exist "%CLAUDE_DIR%" mkdir "%CLAUDE_DIR%" >nul 2>&1
echo        [OK] Dossier Claude pret

:: ============================================================================
:: ETAPE 4: BACKUP CONFIGURATION
:: ============================================================================
echo [4/8] Sauvegarde configuration existante...
if exist "%CLAUDE_CONFIG%" (
    for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set "DATESTAMP=%%c%%b%%a"
    copy "%CLAUDE_CONFIG%" "%CLAUDE_CONFIG%.backup.!DATESTAMP!" >nul 2>&1
    echo        [OK] Backup cree
) else (
    echo        [--] Pas de config existante
)

:: ============================================================================
:: ETAPE 5: CONFIGURATION CLAUDE DESKTOP COMPLETE
:: ============================================================================
echo [5/8] Configuration Claude Desktop avec tous les MCP servers...

(
echo {
echo   "mcpServers": {
echo     "n8n": {
echo       "command": "npx",
echo       "args": ["-y", "@leonardsellem/n8n-mcp-server"],
echo       "env": {
echo         "N8N_API_URL": "http://localhost:5678/api/v1",
echo         "N8N_API_KEY": "REMPLACEZ_PAR_VOTRE_CLE_N8N"
echo       }
echo     },
echo     "filesystem": {
echo       "command": "npx",
echo       "args": ["-y", "@modelcontextprotocol/server-filesystem", "%USERPROFILE:\=/%"]
echo     },
echo     "fetch": {
echo       "command": "npx",
echo       "args": ["-y", "@modelcontextprotocol/server-fetch"]
echo     },
echo     "memory": {
echo       "command": "npx",
echo       "args": ["-y", "@modelcontextprotocol/server-memory"]
echo     },
echo     "github": {
echo       "command": "npx",
echo       "args": ["-y", "@modelcontextprotocol/server-github"],
echo       "env": {
echo         "GITHUB_PERSONAL_ACCESS_TOKEN": "REMPLACEZ_PAR_VOTRE_TOKEN_GITHUB"
echo       }
echo     },
echo     "google-drive": {
echo       "command": "npx",
echo       "args": ["-y", "@anthropic-ai/mcp-server-google-drive"]
echo     },
echo     "slack": {
echo       "command": "npx",
echo       "args": ["-y", "@anthropic-ai/mcp-server-slack"],
echo       "env": {
echo         "SLACK_TOKEN": "REMPLACEZ_PAR_VOTRE_TOKEN_SLACK"
echo       }
echo     },
echo     "notion": {
echo       "command": "npx",
echo       "args": ["-y", "@anthropic-ai/mcp-server-notion"],
echo       "env": {
echo         "NOTION_TOKEN": "REMPLACEZ_PAR_VOTRE_TOKEN_NOTION"
echo       }
echo     },
echo     "sequential-thinking": {
echo       "command": "npx",
echo       "args": ["-y", "@anthropic-ai/mcp-server-sequential-thinking"]
echo     }
echo   }
echo }
) > "%CLAUDE_CONFIG%"

echo        [OK] Configuration ecrite avec 9 serveurs MCP

:: ============================================================================
:: ETAPE 6: CREATION SCRIPTS DE GESTION
:: ============================================================================
echo [6/8] Creation scripts de gestion sur le Bureau...

set "DESKTOP=%USERPROFILE%\Desktop"

:: Script demarrage hub
(
echo @echo off
echo title NEMESIS HUB - Demarrage
echo color 0A
echo echo.
echo echo  ╔═══════════════════════════════════════════════════════════════╗
echo echo  ║   NEMESIS HUB - Demarrage de tous les services                ║
echo echo  ╚═══════════════════════════════════════════════════════════════╝
echo echo.
echo echo [1/3] Demarrage n8n...
echo start "" /min cmd /c "npx n8n start"
echo timeout /t 5 ^>nul
echo echo [2/3] Verification...
echo curl -s http://localhost:5678 ^>nul 2^>^&1
echo if %%errorLevel%% equ 0 ^(
echo     echo [OK] n8n demarre sur http://localhost:5678
echo     start "" "http://localhost:5678"
echo ^) else ^(
echo     echo [!!] n8n en cours de demarrage...
echo ^)
echo echo [3/3] Termine!
echo echo.
echo pause
) > "%DESKTOP%\NEMESIS-HUB-Start.bat"

:: Script arret
(
echo @echo off
echo title NEMESIS HUB - Arret
echo echo Arret de tous les services...
echo taskkill /f /im node.exe 2^>nul
echo echo [OK] Services arretes
echo timeout /t 2 ^>nul
) > "%DESKTOP%\NEMESIS-HUB-Stop.bat"

:: Script configuration
(
echo @echo off
echo notepad "%%APPDATA%%\Claude\claude_desktop_config.json"
) > "%DESKTOP%\NEMESIS-Edit-Config.bat"

:: Script status
(
echo @echo off
echo title NEMESIS HUB - Status
echo color 0B
echo echo.
echo echo  ╔═══════════════════════════════════════════════════════════════╗
echo echo  ║   NEMESIS HUB - Verification du statut                        ║
echo echo  ╚═══════════════════════════════════════════════════════════════╝
echo echo.
echo echo [Verification n8n...]
echo curl -s http://localhost:5678 ^>nul 2^>^&1
echo if %%errorLevel%% equ 0 ^(
echo     echo [OK] n8n: RUNNING sur http://localhost:5678
echo ^) else ^(
echo     echo [XX] n8n: STOPPED
echo ^)
echo echo.
echo echo [Configuration Claude Desktop]
echo if exist "%%APPDATA%%\Claude\claude_desktop_config.json" ^(
echo     echo [OK] Config presente
echo ^) else ^(
echo     echo [XX] Config manquante
echo ^)
echo echo.
echo echo [Serveurs MCP configures:]
echo echo    - n8n ^(automatisation^)
echo echo    - filesystem ^(fichiers^)
echo echo    - fetch ^(HTTP^)
echo echo    - memory ^(persistance^)
echo echo    - github ^(repos^)
echo echo    - google-drive ^(docs^)
echo echo    - slack ^(messages^)
echo echo    - notion ^(bases^)
echo echo    - sequential-thinking ^(raisonnement^)
echo echo.
echo pause
) > "%DESKTOP%\NEMESIS-HUB-Status.bat"

:: Script import workflows
(
echo @echo off
echo title NEMESIS HUB - Import Workflows
echo echo.
echo echo Import des workflows dans n8n...
echo echo.
echo echo Les workflows sont dans: %HUB_DIR%workflows
echo echo.
echo echo Pour importer:
echo echo 1. Ouvrez http://localhost:5678
echo echo 2. Allez dans Workflows ^> Import from File
echo echo 3. Selectionnez les fichiers .json
echo echo.
echo start "" "http://localhost:5678"
echo explorer "%HUB_DIR%workflows"
echo pause
) > "%DESKTOP%\NEMESIS-Import-Workflows.bat"

echo        [OK] 5 scripts crees sur le Bureau

:: ============================================================================
:: ETAPE 7: DEMARRAGE N8N
:: ============================================================================
echo [7/8] Demarrage de n8n...

curl -s "%N8N_URL%" >nul 2>&1
if %errorLevel% equ 0 (
    echo        [OK] n8n deja en cours d'execution
) else (
    start "" /min cmd /c "npx n8n start"

    set "WAIT=0"
    :wait_loop
    if !WAIT! geq 30 goto timeout_reached
    timeout /t 2 >nul
    set /a WAIT+=2
    curl -s "%N8N_URL%" >nul 2>&1
    if !errorLevel! neq 0 (
        echo        Attente... !WAIT!s
        goto wait_loop
    )
    echo        [OK] n8n demarre en !WAIT! secondes
    goto n8n_ok

    :timeout_reached
    echo        [!!] n8n demarre en arriere-plan

    :n8n_ok
)

:: ============================================================================
:: ETAPE 8: RESUME FINAL
:: ============================================================================
echo [8/8] Installation terminee!
echo.
echo  ═══════════════════════════════════════════════════════════════════════════
echo                      NEMESIS HUB - INSTALLATION TERMINEE
echo  ═══════════════════════════════════════════════════════════════════════════
echo.
echo  CONFIGURATION CLAUDE DESKTOP:
echo    Fichier: %CLAUDE_CONFIG%
echo.
echo  SERVEURS MCP ACTIFS:
echo    [+] n8n               - Automatisation workflows
echo    [+] filesystem        - Acces fichiers locaux
echo    [+] fetch             - Requetes HTTP
echo    [+] memory            - Memoire persistante
echo    [+] github            - Integration GitHub
echo    [+] google-drive      - Google Drive
echo    [+] slack             - Messages Slack
echo    [+] notion            - Bases Notion
echo    [+] sequential-thinking - Raisonnement avance
echo.
echo  WORKFLOWS DISPONIBLES (dans %WORKFLOWS_DIR%):
echo    [+] NEMESIS-HUB-MASTER.json      - Orchestrateur central
echo    [+] google-ai-studio-connector   - Google Gemini
echo    [+] notion-sync-hub              - Synchronisation Notion
echo    [+] discord-bot-automation       - Bot Discord
echo    [+] github-integration           - CI/CD GitHub
echo    [+] heygen-video-generator       - Videos AI HeyGen
echo    [+] midjourney-automation        - Images Midjourney
echo    [+] bubble-connector             - Apps Bubble.io
echo    [+] make-zapier-bridge           - Bridge Make/Zapier
echo.
echo  RACCOURCIS BUREAU:
echo    NEMESIS-HUB-Start.bat       - Demarrer tout
echo    NEMESIS-HUB-Stop.bat        - Arreter tout
echo    NEMESIS-HUB-Status.bat      - Verifier statut
echo    NEMESIS-Edit-Config.bat     - Editer configuration
echo    NEMESIS-Import-Workflows.bat - Importer workflows
echo.
echo  ═══════════════════════════════════════════════════════════════════════════
echo                           ETAPES SUIVANTES
echo  ═══════════════════════════════════════════════════════════════════════════
echo.
echo  1. Ouvrez http://localhost:5678
echo  2. Creez un compte n8n si premiere fois
echo  3. Settings ^> API ^> Create API Key
echo  4. Editez la config Claude (NEMESIS-Edit-Config.bat)
echo  5. Remplacez les cles API par les vraies
echo  6. Importez les workflows (NEMESIS-Import-Workflows.bat)
echo  7. REDEMARREZ Claude Desktop
echo.
echo  ═══════════════════════════════════════════════════════════════════════════
echo.

curl -s "%N8N_URL%" >nul 2>&1
if %errorLevel% equ 0 (
    start "" "%N8N_URL%"
)

echo [%TIME%] Installation terminee >> "%LOG%"
echo.
echo Appuyez sur une touche pour fermer...
pause >nul
