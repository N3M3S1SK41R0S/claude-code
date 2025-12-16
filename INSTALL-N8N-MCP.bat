@echo off
:: ============================================================================
:: NEMESIS N8N AUTOFIX - UN SEUL CLIC - FAIT TOUT AUTOMATIQUEMENT
:: ============================================================================
title NEMESIS N8N AUTOFIX - Installation en cours...
color 0A

echo.
echo  ╔═══════════════════════════════════════════════════════════════╗
echo  ║   NEMESIS N8N AUTOFIX - Installation Automatique              ║
echo  ║   Ne touchez a rien - Le script fait TOUT pour vous          ║
echo  ╚═══════════════════════════════════════════════════════════════╝
echo.

:: Verifier les droits administrateur
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Elevation des privileges requise...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: Executer le script PowerShell principal
powershell -ExecutionPolicy Bypass -Command ^
"$ErrorActionPreference = 'SilentlyContinue'; ^
$ProgressPreference = 'SilentlyContinue'; ^
^
Write-Host ''; ^
Write-Host '  NEMESIS N8N AUTOFIX - Execution...' -ForegroundColor Magenta; ^
Write-Host ''; ^
^
# Variables ^
$N8N_PORT = 5678; ^
$ClaudeConfigPath = \"$env:APPDATA\Claude\claude_desktop_config.json\"; ^
^
# 1. Installer Node.js si absent ^
Write-Host '[1/6] Verification Node.js...' -ForegroundColor Cyan; ^
$node = Get-Command node -ErrorAction SilentlyContinue; ^
if (-not $node) { ^
    Write-Host '      Installation Node.js...' -ForegroundColor Yellow; ^
    $url = 'https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi'; ^
    $msi = \"$env:TEMP\node.msi\"; ^
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ^
    Invoke-WebRequest -Uri $url -OutFile $msi -UseBasicParsing; ^
    Start-Process msiexec.exe -Wait -ArgumentList \"/i `\"$msi`\" /quiet\"; ^
    $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); ^
    Write-Host '      [OK] Node.js installe' -ForegroundColor Green; ^
} else { ^
    Write-Host '      [OK] Node.js present' -ForegroundColor Green; ^
} ^
^
# 2. Creer dossier Claude ^
Write-Host '[2/6] Creation dossier Claude...' -ForegroundColor Cyan; ^
$claudeDir = Split-Path $ClaudeConfigPath -Parent; ^
if (-not (Test-Path $claudeDir)) { New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null }; ^
Write-Host '      [OK] Dossier pret' -ForegroundColor Green; ^
^
# 3. Backup config existante ^
Write-Host '[3/6] Backup configuration...' -ForegroundColor Cyan; ^
if (Test-Path $ClaudeConfigPath) { ^
    Copy-Item $ClaudeConfigPath \"$ClaudeConfigPath.backup\" -Force; ^
    Write-Host '      [OK] Backup cree' -ForegroundColor Green; ^
} else { ^
    Write-Host '      [--] Pas de config existante' -ForegroundColor Gray; ^
} ^
^
# 4. Ecrire nouvelle config ^
Write-Host '[4/6] Configuration MCP servers...' -ForegroundColor Cyan; ^
$config = @{ ^
    mcpServers = @{ ^
        n8n = @{ ^
            command = 'npx'; ^
            args = @('-y', '@leonardsellem/n8n-mcp-server'); ^
            env = @{ ^
                N8N_API_URL = 'http://localhost:5678/api/v1'; ^
                N8N_API_KEY = 'REMPLACEZ_PAR_VOTRE_CLE_API_N8N' ^
            } ^
        }; ^
        filesystem = @{ ^
            command = 'npx'; ^
            args = @('-y', '@modelcontextprotocol/server-filesystem', $env:USERPROFILE) ^
        }; ^
        fetch = @{ ^
            command = 'npx'; ^
            args = @('-y', '@modelcontextprotocol/server-fetch') ^
        }; ^
        memory = @{ ^
            command = 'npx'; ^
            args = @('-y', '@modelcontextprotocol/server-memory') ^
        } ^
    } ^
}; ^
$config | ConvertTo-Json -Depth 10 | Out-File -FilePath $ClaudeConfigPath -Encoding UTF8; ^
Write-Host '      [OK] Configuration ecrite' -ForegroundColor Green; ^
^
# 5. Creer script demarrage n8n ^
Write-Host '[5/6] Creation raccourcis...' -ForegroundColor Cyan; ^
$desktop = [Environment]::GetFolderPath('Desktop'); ^
\"@echo off`r`ntitle n8n Server`r`necho Demarrage n8n sur http://localhost:5678`r`nnpx n8n start`r`npause\" | Out-File \"$desktop\Start-n8n.bat\" -Encoding ASCII; ^
\"@echo off`r`nnotepad `\"%APPDATA%\Claude\claude_desktop_config.json`\"\" | Out-File \"$desktop\Edit-Claude-Config.bat\" -Encoding ASCII; ^
Write-Host '      [OK] Raccourcis crees sur le Bureau' -ForegroundColor Green; ^
^
# 6. Verifier n8n ^
Write-Host '[6/6] Verification n8n...' -ForegroundColor Cyan; ^
try { ^
    $r = Invoke-WebRequest -Uri 'http://localhost:5678' -TimeoutSec 2 -UseBasicParsing; ^
    Write-Host '      [OK] n8n fonctionne' -ForegroundColor Green; ^
} catch { ^
    Write-Host '      [!!] n8n non demarre - Lancez Start-n8n.bat' -ForegroundColor Yellow; ^
} ^
^
Write-Host ''; ^
Write-Host '═══════════════════════════════════════════════════════════' -ForegroundColor Green; ^
Write-Host '              INSTALLATION TERMINEE !' -ForegroundColor Green; ^
Write-Host '═══════════════════════════════════════════════════════════' -ForegroundColor Green; ^
Write-Host ''; ^
Write-Host 'PROCHAINES ETAPES:' -ForegroundColor Yellow; ^
Write-Host '1. Lancez Start-n8n.bat sur votre Bureau' -ForegroundColor White; ^
Write-Host '2. Ouvrez http://localhost:5678 > Settings > API' -ForegroundColor White; ^
Write-Host '3. Creez une cle API et copiez-la' -ForegroundColor White; ^
Write-Host '4. Lancez Edit-Claude-Config.bat et remplacez la cle' -ForegroundColor White; ^
Write-Host '5. Redemarrez Claude Desktop' -ForegroundColor White; ^
Write-Host ''; ^
Write-Host 'Fichier config: ' -NoNewline; Write-Host $ClaudeConfigPath -ForegroundColor Cyan; ^
Write-Host ''; ^
"

echo.
echo Installation terminee !
echo.
pause
