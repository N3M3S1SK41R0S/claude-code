################################################################################
#  FIX N8N MCP SERVER - Script All-in-One pour Claude Desktop (Windows)
#  Auteur: Claude Code
#  Usage: Clic-droit > Executer avec PowerShell (en tant qu'administrateur)
################################################################################

param(
    [string]$N8N_API_URL = "http://localhost:5678/api/v1",
    [string]$N8N_API_KEY = ""
)

# === CONFIGURATION ===
$ErrorActionPreference = "Stop"
$ClaudeConfigPath = "$env:APPDATA\Claude\claude_desktop_config.json"
$LogFile = "$env:USERPROFILE\fix-n8n-mcp.log"

# === COULEURS ===
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# === BANNIERE ===
Clear-Host
Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║       FIX N8N MCP SERVER - Claude Desktop Configuration       ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Magenta

# === ETAPE 1: Verification Node.js / NPM ===
Write-Info "Etape 1/6: Verification de Node.js..."
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Success "Node.js installe: $nodeVersion"
    } else {
        throw "Node.js non trouve"
    }
} catch {
    Write-Err "Node.js n'est pas installe!"
    Write-Info "Telechargement de Node.js..."

    $nodeInstaller = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi" -OutFile $nodeInstaller
    Start-Process msiexec.exe -Wait -ArgumentList "/i $nodeInstaller /quiet"
    Remove-Item $nodeInstaller -Force

    # Rafraichir PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Success "Node.js installe avec succes"
}

# === ETAPE 2: Verification n8n en cours d'execution ===
Write-Info "Etape 2/6: Verification de n8n..."
$n8nRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5678/healthz" -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $n8nRunning = $true
        Write-Success "n8n est en cours d'execution sur localhost:5678"
    }
} catch {
    Write-Warn "n8n ne repond pas sur localhost:5678"
    Write-Info "Assurez-vous que n8n est demarre avant d'utiliser le serveur MCP"
}

# === ETAPE 3: Demander la cle API si non fournie ===
Write-Info "Etape 3/6: Configuration de la cle API..."
if ([string]::IsNullOrEmpty($N8N_API_KEY)) {
    Write-Host ""
    Write-Host "Entrez votre cle API n8n (ou appuyez sur Entree pour utiliser une cle de demo):" -ForegroundColor Yellow
    $inputKey = Read-Host

    if ([string]::IsNullOrEmpty($inputKey)) {
        # Cle de demo (l'utilisateur devra la remplacer)
        $N8N_API_KEY = "VOTRE_CLE_API_N8N_ICI"
        Write-Warn "Cle de demo utilisee - Remplacez-la par votre vraie cle API n8n"
    } else {
        $N8N_API_KEY = $inputKey
        Write-Success "Cle API configuree"
    }
}

# === ETAPE 4: Creation du dossier Claude si necessaire ===
Write-Info "Etape 4/6: Preparation du dossier de configuration..."
$claudeDir = Split-Path $ClaudeConfigPath -Parent
if (-not (Test-Path $claudeDir)) {
    New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
    Write-Success "Dossier Claude cree: $claudeDir"
} else {
    Write-Success "Dossier Claude existe: $claudeDir"
}

# === ETAPE 5: Backup et creation de la configuration ===
Write-Info "Etape 5/6: Configuration du serveur MCP n8n..."

# Backup si fichier existe
if (Test-Path $ClaudeConfigPath) {
    $backupPath = "$ClaudeConfigPath.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $ClaudeConfigPath $backupPath -Force
    Write-Info "Backup cree: $backupPath"

    # Lire config existante
    try {
        $existingConfig = Get-Content $ClaudeConfigPath -Raw | ConvertFrom-Json
    } catch {
        $existingConfig = $null
    }
} else {
    $existingConfig = $null
}

# Construire la nouvelle configuration
$mcpConfig = @{
    mcpServers = @{
        n8n = @{
            command = "npx"
            args = @("-y", "@leonardsellem/n8n-mcp-server")
            env = @{
                N8N_API_URL = $N8N_API_URL
                N8N_API_KEY = $N8N_API_KEY
            }
        }
        filesystem = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-filesystem", $env:USERPROFILE)
        }
    }
}

# Fusionner avec config existante si present
if ($existingConfig -and $existingConfig.mcpServers) {
    foreach ($server in $existingConfig.mcpServers.PSObject.Properties) {
        if ($server.Name -ne "n8n") {
            $mcpConfig.mcpServers[$server.Name] = $server.Value
        }
    }
}

# Ecrire la configuration
$configJson = $mcpConfig | ConvertTo-Json -Depth 10
$configJson | Out-File -FilePath $ClaudeConfigPath -Encoding UTF8 -Force
Write-Success "Configuration MCP ecrite: $ClaudeConfigPath"

# === ETAPE 6: Test du serveur MCP ===
Write-Info "Etape 6/6: Test du serveur MCP n8n..."
Write-Host ""

# Definir les variables d'environnement pour le test
$env:N8N_API_URL = $N8N_API_URL
$env:N8N_API_KEY = $N8N_API_KEY

Write-Info "Test de lancement du serveur MCP (5 secondes)..."
$testJob = Start-Job -ScriptBlock {
    $env:N8N_API_URL = $using:N8N_API_URL
    $env:N8N_API_KEY = $using:N8N_API_KEY
    npx -y @leonardsellem/n8n-mcp-server 2>&1
}

Start-Sleep -Seconds 5
$testResult = Receive-Job $testJob -ErrorAction SilentlyContinue
Stop-Job $testJob -ErrorAction SilentlyContinue
Remove-Job $testJob -ErrorAction SilentlyContinue

if ($testResult -match "error|Error|ERROR|Missing") {
    Write-Warn "Le serveur MCP a retourne des erreurs:"
    Write-Host $testResult -ForegroundColor Yellow
} else {
    Write-Success "Le serveur MCP semble fonctionner correctement"
}

# === RESUME FINAL ===
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "                    CONFIGURATION TERMINEE                      " -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""
Write-Host "Fichier de configuration: " -NoNewline; Write-Host $ClaudeConfigPath -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration actuelle:" -ForegroundColor Yellow
Write-Host $configJson
Write-Host ""

# Instructions
Write-Host "PROCHAINES ETAPES:" -ForegroundColor Yellow
Write-Host "1. " -NoNewline; Write-Host "Assurez-vous que n8n est demarre (npx n8n ou docker)" -ForegroundColor White
Write-Host "2. " -NoNewline; Write-Host "Redemarrez Claude Desktop completement" -ForegroundColor White
Write-Host "3. " -NoNewline; Write-Host "Verifiez dans Parametres > Claude Code que n8n est 'connected'" -ForegroundColor White
Write-Host ""

if (-not $n8nRunning) {
    Write-Host "IMPORTANT:" -ForegroundColor Red
    Write-Host "n8n n'est pas detecte sur localhost:5678" -ForegroundColor Yellow
    Write-Host "Lancez n8n avec: " -NoNewline; Write-Host "npx n8n" -ForegroundColor Cyan
    Write-Host ""
}

# Ouvrir le fichier de config dans Notepad pour verification
Write-Host "Voulez-vous ouvrir le fichier de configuration dans Notepad? (O/N): " -NoNewline -ForegroundColor Yellow
$openConfig = Read-Host
if ($openConfig -eq "O" -or $openConfig -eq "o" -or $openConfig -eq "Y" -or $openConfig -eq "y") {
    Start-Process notepad.exe $ClaudeConfigPath
}

# Log
"$(Get-Date) - Configuration MCP n8n terminee" | Out-File -FilePath $LogFile -Append

Write-Host ""
Write-Host "Appuyez sur une touche pour fermer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
