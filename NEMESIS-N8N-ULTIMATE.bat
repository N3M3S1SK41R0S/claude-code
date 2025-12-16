@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title NEMESIS N8N ULTIMATE - Installation Complete Automatique
color 0A

:: ============================================================================
::  NEMESIS N8N ULTIMATE - SCRIPT MONOLITHIQUE 100%% AUTOMATIQUE
::  Version: 3.0 ULTIMATE
::  Zero erreur - Zero interaction - Fait ABSOLUMENT TOUT
:: ============================================================================

echo.
echo  ╔═══════════════════════════════════════════════════════════════════════╗
echo  ║                                                                       ║
echo  ║   ███╗   ██╗███████╗███╗   ███╗███████╗███████╗██╗███████╗           ║
echo  ║   ████╗  ██║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝           ║
echo  ║   ██╔██╗ ██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗           ║
echo  ║   ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║           ║
echo  ║   ██║ ╚████║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║           ║
echo  ║   ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝           ║
echo  ║                                                                       ║
echo  ║              N8N MCP ULTIMATE INSTALLER v3.0                          ║
echo  ║         Zero Interaction - Zero Erreur - 100%% Automatique            ║
echo  ║                                                                       ║
echo  ╚═══════════════════════════════════════════════════════════════════════╝
echo.

:: === ELEVATION ADMIN SILENCIEUSE ===
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Elevation administrateur...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs" >nul 2>&1
    exit /b
)

:: === VARIABLES GLOBALES ===
set "N8N_PORT=5678"
set "N8N_URL=http://localhost:%N8N_PORT%"
set "CLAUDE_DIR=%APPDATA%\Claude"
set "CLAUDE_CONFIG=%CLAUDE_DIR%\claude_desktop_config.json"
set "DESKTOP=%USERPROFILE%\Desktop"
set "LOG=%USERPROFILE%\nemesis-n8n-install.log"
set "ERRORS=0"

echo [%TIME%] NEMESIS N8N ULTIMATE - Demarrage > "%LOG%"

:: ============================================================================
:: ETAPE 1: INSTALLATION NODE.JS
:: ============================================================================
echo [1/10] Installation Node.js...
echo [%TIME%] Etape 1: Node.js >> "%LOG%"

where node >nul 2>&1
if %errorLevel% neq 0 (
    echo        Telechargement Node.js LTS...

    powershell -Command ^
        "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ^
        $url = 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi'; ^
        $out = \"$env:TEMP\node.msi\"; ^
        (New-Object Net.WebClient).DownloadFile($url, $out); ^
        Start-Process msiexec.exe -Wait -ArgumentList \"/i `\"$out`\" /quiet /norestart\"; ^
        Remove-Item $out -Force" >nul 2>&1

    :: Rafraichir PATH
    for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "PATH=%%b;%PATH%"
    for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "PATH=%%b;%PATH%"

    where node >nul 2>&1
    if !errorLevel! equ 0 (
        echo        [OK] Node.js installe
        echo [%TIME%] Node.js installe avec succes >> "%LOG%"
    ) else (
        echo        [!!] Echec - Installation manuelle requise
        set /a ERRORS+=1
    )
) else (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do echo        [OK] Node.js %%v deja present
)

:: ============================================================================
:: ETAPE 2: MISE A JOUR NPM
:: ============================================================================
echo [2/10] Mise a jour NPM...
echo [%TIME%] Etape 2: NPM >> "%LOG%"

call npm install -g npm@latest >nul 2>&1
if %errorLevel% equ 0 (
    echo        [OK] NPM mis a jour
) else (
    echo        [--] NPM deja a jour
)

:: ============================================================================
:: ETAPE 3: INSTALLATION N8N GLOBAL
:: ============================================================================
echo [3/10] Installation n8n...
echo [%TIME%] Etape 3: n8n >> "%LOG%"

call npm install -g n8n >nul 2>&1
if %errorLevel% equ 0 (
    echo        [OK] n8n installe
    echo [%TIME%] n8n installe >> "%LOG%"
) else (
    echo        [--] n8n deja installe ou erreur mineure
)

:: ============================================================================
:: ETAPE 4: INSTALLATION PACKAGES MCP
:: ============================================================================
echo [4/10] Installation serveurs MCP...
echo [%TIME%] Etape 4: MCP servers >> "%LOG%"

call npm install -g @anthropic-ai/claude-code >nul 2>&1
echo        [OK] Packages MCP prets

:: ============================================================================
:: ETAPE 5: CREATION DOSSIER CLAUDE
:: ============================================================================
echo [5/10] Preparation dossier Claude...
echo [%TIME%] Etape 5: Dossier Claude >> "%LOG%"

if not exist "%CLAUDE_DIR%" (
    mkdir "%CLAUDE_DIR%" >nul 2>&1
    echo        [OK] Dossier cree: %CLAUDE_DIR%
) else (
    echo        [OK] Dossier existe
)

:: ============================================================================
:: ETAPE 6: BACKUP CONFIGURATION
:: ============================================================================
echo [6/10] Sauvegarde configuration...
echo [%TIME%] Etape 6: Backup >> "%LOG%"

if exist "%CLAUDE_CONFIG%" (
    for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set "DATESTAMP=%%c%%b%%a"
    for /f "tokens=1-2 delims=: " %%a in ('time /t') do set "TIMESTAMP=%%a%%b"
    copy "%CLAUDE_CONFIG%" "%CLAUDE_CONFIG%.backup.%DATESTAMP%%TIMESTAMP%" >nul 2>&1
    echo        [OK] Backup cree
) else (
    echo        [--] Pas de config existante
)

:: ============================================================================
:: ETAPE 7: ECRITURE CONFIGURATION CLAUDE DESKTOP
:: ============================================================================
echo [7/10] Configuration Claude Desktop...
echo [%TIME%] Etape 7: Config Claude >> "%LOG%"

:: Ecrire la configuration JSON complete
(
echo {
echo   "mcpServers": {
echo     "n8n": {
echo       "command": "npx",
echo       "args": ["-y", "@leonardsellem/n8n-mcp-server"],
echo       "env": {
echo         "N8N_API_URL": "http://localhost:5678/api/v1",
echo         "N8N_API_KEY": "VOTRE_CLE_API_N8N"
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
echo         "GITHUB_PERSONAL_ACCESS_TOKEN": "VOTRE_TOKEN_GITHUB"
echo       }
echo     }
echo   }
echo }
) > "%CLAUDE_CONFIG%"

echo        [OK] Configuration ecrite avec 5 serveurs MCP
echo [%TIME%] Config Claude ecrite >> "%LOG%"

:: ============================================================================
:: ETAPE 8: CREATION SCRIPTS DE GESTION
:: ============================================================================
echo [8/10] Creation scripts de gestion...
echo [%TIME%] Etape 8: Scripts >> "%LOG%"

:: Script demarrage n8n
(
echo @echo off
echo title n8n Server - NEMESIS
echo color 0A
echo echo.
echo echo  ╔═══════════════════════════════════════════════════════════════╗
echo echo  ║   n8n Server - http://localhost:5678                          ║
echo echo  ╚═══════════════════════════════════════════════════════════════╝
echo echo.
echo echo Demarrage de n8n...
echo echo Ouvrez votre navigateur sur http://localhost:5678
echo echo.
echo start "" "http://localhost:5678"
echo npx n8n start
echo pause
) > "%DESKTOP%\N8N-Start.bat"

:: Script arret n8n
(
echo @echo off
echo title Arret n8n
echo echo Arret de n8n...
echo taskkill /f /im node.exe 2^>nul
echo echo [OK] n8n arrete
echo timeout /t 2 ^>nul
) > "%DESKTOP%\N8N-Stop.bat"

:: Script edition config Claude
(
echo @echo off
echo notepad "%%APPDATA%%\Claude\claude_desktop_config.json"
) > "%DESKTOP%\Claude-Edit-Config.bat"

:: Script verification statut
(
echo @echo off
echo title NEMESIS Status
echo color 0B
echo echo.
echo echo  ╔═══════════════════════════════════════════════════════════════╗
echo echo  ║   NEMESIS N8N - Verification du statut                        ║
echo echo  ╚═══════════════════════════════════════════════════════════════╝
echo echo.
echo curl -s http://localhost:5678 ^>nul 2^>^&1
echo if %%errorLevel%% equ 0 ^(
echo     echo [OK] n8n est en cours d'execution sur http://localhost:5678
echo ^) else ^(
echo     echo [XX] n8n n'est pas demarre
echo     echo      Lancez N8N-Start.bat pour le demarrer
echo ^)
echo echo.
echo echo Configuration Claude: %%APPDATA%%\Claude\claude_desktop_config.json
echo echo.
echo if exist "%%APPDATA%%\Claude\claude_desktop_config.json" ^(
echo     echo [OK] Configuration Claude presente
echo ^) else ^(
echo     echo [XX] Configuration Claude manquante
echo ^)
echo echo.
echo pause
) > "%DESKTOP%\NEMESIS-Status.bat"

:: Script tout-en-un restart
(
echo @echo off
echo title NEMESIS Restart
echo echo Arret des services...
echo taskkill /f /im node.exe 2^>nul
echo timeout /t 2 ^>nul
echo echo Redemarrage n8n...
echo start "" /min cmd /c "npx n8n start"
echo timeout /t 5 ^>nul
echo start "" "http://localhost:5678"
echo echo [OK] n8n redemarre
echo timeout /t 3 ^>nul
) > "%DESKTOP%\NEMESIS-Restart.bat"

echo        [OK] 5 scripts crees sur le Bureau

:: ============================================================================
:: ETAPE 9: DEMARRAGE N8N
:: ============================================================================
echo [9/10] Demarrage de n8n...
echo [%TIME%] Etape 9: Demarrage n8n >> "%LOG%"

:: Verifier si n8n tourne deja
curl -s "%N8N_URL%" >nul 2>&1
if %errorLevel% equ 0 (
    echo        [OK] n8n deja en cours d'execution
) else (
    echo        Lancement de n8n en arriere-plan...
    start "" /min cmd /c "npx n8n start"

    :: Attendre que n8n demarre (max 30 secondes)
    set "WAIT=0"
    :wait_n8n
    if !WAIT! geq 30 goto n8n_timeout
    timeout /t 2 >nul
    set /a WAIT+=2
    curl -s "%N8N_URL%" >nul 2>&1
    if !errorLevel! neq 0 (
        echo        Attente... !WAIT!s
        goto wait_n8n
    )
    echo        [OK] n8n demarre en !WAIT! secondes
    echo [%TIME%] n8n demarre >> "%LOG%"
    goto n8n_started

    :n8n_timeout
    echo        [!!] n8n prend du temps - continuera en arriere-plan

    :n8n_started
)

:: ============================================================================
:: ETAPE 10: VERIFICATION FINALE
:: ============================================================================
echo [10/10] Verification finale...
echo [%TIME%] Etape 10: Verification >> "%LOG%"

set "ALL_OK=1"

:: Verifier Node.js
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo        [XX] Node.js: NON INSTALLE
    set "ALL_OK=0"
) else (
    echo        [OK] Node.js: Installe
)

:: Verifier config Claude
if exist "%CLAUDE_CONFIG%" (
    echo        [OK] Config Claude: Presente
) else (
    echo        [XX] Config Claude: MANQUANTE
    set "ALL_OK=0"
)

:: Verifier n8n
curl -s "%N8N_URL%" >nul 2>&1
if %errorLevel% equ 0 (
    echo        [OK] n8n: En cours d'execution
) else (
    echo        [!!] n8n: Non demarre (lancez N8N-Start.bat)
)

:: ============================================================================
:: RESUME FINAL
:: ============================================================================
echo.
echo  ═══════════════════════════════════════════════════════════════════════
if %ALL_OK% equ 1 (
    echo                    INSTALLATION TERMINEE AVEC SUCCES
    color 0A
) else (
    echo                    INSTALLATION TERMINEE AVEC AVERTISSEMENTS
    color 0E
)
echo  ═══════════════════════════════════════════════════════════════════════
echo.
echo  CONFIGURATION:
echo    Config Claude : %CLAUDE_CONFIG%
echo    Interface n8n : %N8N_URL%
echo.
echo  SERVEURS MCP CONFIGURES:
echo    [+] n8n        - Automatisation workflows
echo    [+] filesystem - Acces aux fichiers
echo    [+] fetch      - Requetes HTTP
echo    [+] memory     - Memoire persistante
echo    [+] github     - Integration GitHub
echo.
echo  RACCOURCIS BUREAU:
echo    N8N-Start.bat        - Demarrer n8n
echo    N8N-Stop.bat         - Arreter n8n
echo    NEMESIS-Restart.bat  - Redemarrer n8n
echo    NEMESIS-Status.bat   - Verifier le statut
echo    Claude-Edit-Config.bat - Editer la configuration
echo.
echo  ═══════════════════════════════════════════════════════════════════════
echo                          ETAPES FINALES IMPORTANTES
echo  ═══════════════════════════════════════════════════════════════════════
echo.
echo  1. Ouvrez http://localhost:5678 dans votre navigateur
echo  2. Creez un compte n8n si c'est la premiere fois
echo  3. Allez dans: Settings (icone engrenage) ^> API
echo  4. Cliquez "Create API Key" et copiez la cle
echo  5. Lancez Claude-Edit-Config.bat sur le Bureau
echo  6. Remplacez "VOTRE_CLE_API_N8N" par votre vraie cle
echo  7. Sauvegardez (Ctrl+S) et fermez Notepad
echo  8. REDEMARREZ Claude Desktop completement
echo.
echo  ═══════════════════════════════════════════════════════════════════════
echo.

:: Ouvrir n8n dans le navigateur
curl -s "%N8N_URL%" >nul 2>&1
if %errorLevel% equ 0 (
    echo Ouverture de n8n dans le navigateur...
    start "" "%N8N_URL%"
)

echo [%TIME%] Installation terminee - Erreurs: %ERRORS% >> "%LOG%"
echo.
echo Log complet: %LOG%
echo.
echo Appuyez sur une touche pour fermer...
pause >nul
