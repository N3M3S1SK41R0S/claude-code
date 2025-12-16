################################################################################
#  NEMESIS HUB - Installation Complete Multi-Plateformes
#  Script PowerShell 100% Automatique
#  Version: 1.0 ULTIMATE
################################################################################

$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

# === CONFIGURATION ===
$N8N_PORT = 5678
$N8N_URL = "http://localhost:$N8N_PORT"
$ClaudeConfigPath = "$env:APPDATA\Claude\claude_desktop_config.json"
$HubDir = $PSScriptRoot
$WorkflowsDir = "$HubDir\workflows"
$LogFile = "$env:USERPROFILE\nemesis-hub-install.log"

# === FONCTIONS ===
function Log { param($msg)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $msg" | Tee-Object -FilePath $LogFile -Append | Write-Host
}
function Log-OK { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Log-Info { param($msg) Write-Host "[>>] $msg" -ForegroundColor Cyan }
function Log-Warn { param($msg) Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Log-Error { param($msg) Write-Host "[XX] $msg" -ForegroundColor Red }

# === BANNIERE ===
Clear-Host
Write-Host @"

    ╔═══════════════════════════════════════════════════════════════════════════╗
    ║                                                                           ║
    ║   ███╗   ██╗███████╗███╗   ███╗███████╗███████╗██╗███████╗               ║
    ║   ████╗  ██║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝               ║
    ║   ██╔██╗ ██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗               ║
    ║   ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║               ║
    ║   ██║ ╚████║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║               ║
    ║   ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝               ║
    ║                                                                           ║
    ║                    HUB MULTI-PLATEFORMES v1.0                             ║
    ║                                                                           ║
    ║   [+] Google AI Studio  [+] Notion      [+] Discord                       ║
    ║   [+] GitHub            [+] HeyGen      [+] Midjourney                    ║
    ║   [+] Bubble.io         [+] Make        [+] Zapier                        ║
    ║                                                                           ║
    ╚═══════════════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Magenta

Log "NEMESIS HUB - Demarrage installation"

# ============================================================================
# ETAPE 1: NODE.JS
# ============================================================================
Log-Info "Etape 1/8: Verification Node.js..."

$nodeInstalled = $false
try {
    $nodeVersion = & node --version 2>$null
    if ($nodeVersion) { $nodeInstalled = $true; Log-OK "Node.js $nodeVersion present" }
} catch {}

if (-not $nodeInstalled) {
    Log-Info "Installation Node.js LTS..."
    $nodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
    $nodeInstaller = "$env:TEMP\node-installer.msi"

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller -UseBasicParsing
    Start-Process msiexec.exe -Wait -ArgumentList "/i `"$nodeInstaller`" /quiet /norestart"
    Remove-Item $nodeInstaller -Force -ErrorAction SilentlyContinue

    $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
    Log-OK "Node.js installe"
}

# ============================================================================
# ETAPE 2: N8N ET PACKAGES
# ============================================================================
Log-Info "Etape 2/8: Installation n8n et packages..."
& npm install -g n8n @anthropic-ai/claude-code 2>$null | Out-Null
Log-OK "n8n et packages installes"

# ============================================================================
# ETAPE 3: DOSSIER CLAUDE
# ============================================================================
Log-Info "Etape 3/8: Preparation dossier Claude..."
$claudeDir = Split-Path $ClaudeConfigPath -Parent
if (-not (Test-Path $claudeDir)) {
    New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
}
Log-OK "Dossier Claude pret"

# ============================================================================
# ETAPE 4: BACKUP
# ============================================================================
Log-Info "Etape 4/8: Sauvegarde configuration..."
if (Test-Path $ClaudeConfigPath) {
    $backupPath = "$ClaudeConfigPath.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
    Copy-Item $ClaudeConfigPath $backupPath -Force
    Log-OK "Backup cree: $backupPath"
} else {
    Log-Warn "Pas de configuration existante"
}

# ============================================================================
# ETAPE 5: CONFIGURATION CLAUDE DESKTOP
# ============================================================================
Log-Info "Etape 5/8: Configuration Claude Desktop..."

$config = @{
    mcpServers = @{
        n8n = @{
            command = "npx"
            args = @("-y", "@leonardsellem/n8n-mcp-server")
            env = @{
                N8N_API_URL = "http://localhost:5678/api/v1"
                N8N_API_KEY = "REMPLACEZ_PAR_VOTRE_CLE_N8N"
            }
        }
        filesystem = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-filesystem", $env:USERPROFILE)
        }
        fetch = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-fetch")
        }
        memory = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-memory")
        }
        github = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-github")
            env = @{
                GITHUB_PERSONAL_ACCESS_TOKEN = "REMPLACEZ_PAR_VOTRE_TOKEN_GITHUB"
            }
        }
        "google-drive" = @{
            command = "npx"
            args = @("-y", "@anthropic-ai/mcp-server-google-drive")
        }
        slack = @{
            command = "npx"
            args = @("-y", "@anthropic-ai/mcp-server-slack")
            env = @{
                SLACK_TOKEN = "REMPLACEZ_PAR_VOTRE_TOKEN_SLACK"
            }
        }
        notion = @{
            command = "npx"
            args = @("-y", "@anthropic-ai/mcp-server-notion")
            env = @{
                NOTION_TOKEN = "REMPLACEZ_PAR_VOTRE_TOKEN_NOTION"
            }
        }
        "sequential-thinking" = @{
            command = "npx"
            args = @("-y", "@anthropic-ai/mcp-server-sequential-thinking")
        }
    }
}

$configJson = $config | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($ClaudeConfigPath, $configJson, [System.Text.Encoding]::UTF8)
Log-OK "Configuration ecrite avec 9 serveurs MCP"

# ============================================================================
# ETAPE 6: SCRIPTS DE GESTION
# ============================================================================
Log-Info "Etape 6/8: Creation scripts Bureau..."

$desktop = [Environment]::GetFolderPath("Desktop")

# Start script
@"
@echo off
title NEMESIS HUB - Start
echo Demarrage n8n...
start "" /min cmd /c "npx n8n start"
timeout /t 5 >nul
start "" "http://localhost:5678"
echo [OK] n8n demarre
pause
"@ | Out-File "$desktop\NEMESIS-HUB-Start.bat" -Encoding ASCII

# Stop script
@"
@echo off
taskkill /f /im node.exe 2>nul
echo [OK] Services arretes
timeout /t 2 >nul
"@ | Out-File "$desktop\NEMESIS-HUB-Stop.bat" -Encoding ASCII

# Edit config
@"
@echo off
notepad "%APPDATA%\Claude\claude_desktop_config.json"
"@ | Out-File "$desktop\NEMESIS-Edit-Config.bat" -Encoding ASCII

# Status
@"
@echo off
title NEMESIS HUB - Status
curl -s http://localhost:5678 >nul 2>&1
if %errorLevel% equ 0 (echo [OK] n8n: RUNNING) else (echo [XX] n8n: STOPPED)
pause
"@ | Out-File "$desktop\NEMESIS-HUB-Status.bat" -Encoding ASCII

# Import workflows
@"
@echo off
echo Import workflows dans n8n...
start "" "http://localhost:5678"
explorer "$WorkflowsDir"
pause
"@ | Out-File "$desktop\NEMESIS-Import-Workflows.bat" -Encoding ASCII

Log-OK "5 scripts crees sur le Bureau"

# ============================================================================
# ETAPE 7: DEMARRAGE N8N
# ============================================================================
Log-Info "Etape 7/8: Demarrage n8n..."

$n8nRunning = $false
try {
    $response = Invoke-WebRequest -Uri $N8N_URL -TimeoutSec 2 -UseBasicParsing
    if ($response.StatusCode -eq 200) { $n8nRunning = $true }
} catch {}

if (-not $n8nRunning) {
    Start-Process cmd.exe -ArgumentList "/c npx n8n start" -WindowStyle Minimized

    $waited = 0
    while ($waited -lt 30) {
        Start-Sleep -Seconds 2
        $waited += 2
        Write-Host "." -NoNewline

        try {
            $r = Invoke-WebRequest -Uri $N8N_URL -TimeoutSec 2 -UseBasicParsing
            if ($r.StatusCode -eq 200) {
                $n8nRunning = $true
                Write-Host ""
                Log-OK "n8n demarre en $waited secondes"
                break
            }
        } catch {}
    }

    if (-not $n8nRunning) { Log-Warn "n8n demarre en arriere-plan" }
} else {
    Log-OK "n8n deja en cours d'execution"
}

# ============================================================================
# ETAPE 8: RESUME
# ============================================================================
Log-Info "Etape 8/8: Installation terminee!"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "                  NEMESIS HUB - INSTALLATION TERMINEE                       " -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "CONFIGURATION: $ClaudeConfigPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "SERVEURS MCP ACTIFS:" -ForegroundColor Yellow
Write-Host "  [+] n8n, filesystem, fetch, memory, github" -ForegroundColor White
Write-Host "  [+] google-drive, slack, notion, sequential-thinking" -ForegroundColor White
Write-Host ""
Write-Host "WORKFLOWS DISPONIBLES:" -ForegroundColor Yellow
Write-Host "  $WorkflowsDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "PROCHAINES ETAPES:" -ForegroundColor Yellow
Write-Host "  1. Ouvrez http://localhost:5678" -ForegroundColor White
Write-Host "  2. Settings > API > Create API Key" -ForegroundColor White
Write-Host "  3. Editez config et ajoutez vos cles" -ForegroundColor White
Write-Host "  4. Importez les workflows" -ForegroundColor White
Write-Host "  5. REDEMARREZ Claude Desktop" -ForegroundColor White
Write-Host ""

if ($n8nRunning) { Start-Process $N8N_URL }

Write-Host "Appuyez sur une touche..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
