@echo off
:: ============================================================================
:: FIX N8N MCP SERVER - Lanceur pour Windows
:: Double-cliquez sur ce fichier pour executer le script de configuration
:: ============================================================================

echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║       FIX N8N MCP SERVER - Lancement du script...             ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

:: Verifier si PowerShell est disponible
where powershell >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] PowerShell n'est pas installe sur ce systeme.
    pause
    exit /b 1
)

:: Executer le script PowerShell avec les bonnes permissions
powershell -ExecutionPolicy Bypass -File "%~dp0fix-n8n-mcp.ps1"

:: Si le script PowerShell n'existe pas, le telecharger/creer
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [INFO] Tentative de creation du script inline...
    echo.

    powershell -ExecutionPolicy Bypass -Command ^
    "$configPath = \"$env:APPDATA\Claude\claude_desktop_config.json\"; ^
    $claudeDir = Split-Path $configPath -Parent; ^
    if (-not (Test-Path $claudeDir)) { New-Item -ItemType Directory -Path $claudeDir -Force }; ^
    $config = @{ mcpServers = @{ n8n = @{ command = 'npx'; args = @('-y', '@leonardsellem/n8n-mcp-server'); env = @{ N8N_API_URL = 'http://localhost:5678/api/v1'; N8N_API_KEY = 'REMPLACEZ_PAR_VOTRE_CLE' } } } }; ^
    $config | ConvertTo-Json -Depth 10 | Out-File -FilePath $configPath -Encoding UTF8; ^
    Write-Host 'Configuration creee: ' $configPath -ForegroundColor Green; ^
    Write-Host 'IMPORTANT: Editez le fichier pour ajouter votre vraie cle API n8n' -ForegroundColor Yellow; ^
    notepad $configPath"
)

echo.
echo Termine. Appuyez sur une touche pour fermer...
pause >nul
