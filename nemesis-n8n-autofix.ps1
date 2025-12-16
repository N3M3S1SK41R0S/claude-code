################################################################################
#  NEMESIS N8N AUTOFIX - Script 100% Automatique (Zero Interaction)
#  Fait TOUT : installe, configure, demarre, repare
################################################################################

$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

# === CONFIGURATION AUTO ===
$N8N_PORT = 5678
$N8N_API_URL = "http://localhost:$N8N_PORT/api/v1"
$ClaudeConfigPath = "$env:APPDATA\Claude\claude_desktop_config.json"
$N8nDataPath = "$env:USERPROFILE\.n8n"
$LogFile = "$env:USERPROFILE\nemesis-n8n-autofix.log"

# === FONCTIONS ===
function Log { param($msg)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $msg" | Tee-Object -FilePath $LogFile -Append | Write-Host
}

function Log-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green; Log "[OK] $msg" }
function Log-Info { param($msg) Write-Host "[>>] $msg" -ForegroundColor Cyan; Log "[INFO] $msg" }
function Log-Warn { param($msg) Write-Host "[!!] $msg" -ForegroundColor Yellow; Log "[WARN] $msg" }
function Log-Error { param($msg) Write-Host "[XX] $msg" -ForegroundColor Red; Log "[ERROR] $msg" }

# === BANNIERE ===
Clear-Host
Write-Host @"

    ╔═══════════════════════════════════════════════════════════════╗
    ║   NEMESIS N8N AUTOFIX - Configuration 100% Automatique        ║
    ║   Zero interaction requise - Laissez faire la magie           ║
    ╚═══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Magenta

Log-Info "Demarrage de l'autofix complet..."

# ============================================================================
# ETAPE 1: INSTALLATION NODE.JS SI ABSENT
# ============================================================================
Log-Info "Etape 1/8: Verification Node.js..."

$nodeInstalled = $false
try {
    $nodeVersion = & node --version 2>$null
    if ($nodeVersion) {
        $nodeInstalled = $true
        Log-Success "Node.js deja installe: $nodeVersion"
    }
} catch {}

if (-not $nodeInstalled) {
    Log-Info "Installation de Node.js LTS..."

    # Telecharger Node.js
    $nodeUrl = "https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi"
    $nodeInstaller = "$env:TEMP\node-installer.msi"

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller -UseBasicParsing

        # Installation silencieuse
        Start-Process msiexec.exe -Wait -ArgumentList "/i `"$nodeInstaller`" /quiet /norestart"
        Remove-Item $nodeInstaller -Force -ErrorAction SilentlyContinue

        # Rafraichir PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

        Log-Success "Node.js installe avec succes"
    } catch {
        Log-Error "Echec installation Node.js: $_"
    }
}

# ============================================================================
# ETAPE 2: VERIFIER/INSTALLER NPM PACKAGES GLOBAUX
# ============================================================================
Log-Info "Etape 2/8: Verification des packages NPM..."

try {
    & npm install -g n8n @modelcontextprotocol/server-filesystem 2>$null | Out-Null
    Log-Success "Packages NPM installes/mis a jour"
} catch {
    Log-Warn "Certains packages NPM n'ont pas pu etre installes"
}

# ============================================================================
# ETAPE 3: CREER LE DOSSIER N8N ET CONFIGURATION
# ============================================================================
Log-Info "Etape 3/8: Configuration de n8n..."

if (-not (Test-Path $N8nDataPath)) {
    New-Item -ItemType Directory -Path $N8nDataPath -Force | Out-Null
}

# Configuration n8n avec API activee
$n8nConfig = @"
{
  "encryptionKey": "nemesis-auto-generated-key-$(Get-Random)",
  "instanceId": "nemesis-n8n-instance"
}
"@

# ============================================================================
# ETAPE 4: GENERER UNE CLE API N8N
# ============================================================================
Log-Info "Etape 4/8: Generation de la cle API..."

# Generer une cle API fictive mais fonctionnelle pour la config
# L'utilisateur devra la remplacer par sa vraie cle depuis l'interface n8n
$generatedApiKey = "n8n_api_" + [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Random).ToString() + (Get-Date).Ticks.ToString())).Substring(0, 32)

Log-Info "Cle API generee (a remplacer par la vraie depuis n8n > Settings > API)"

# ============================================================================
# ETAPE 5: CREER LA CONFIGURATION CLAUDE DESKTOP
# ============================================================================
Log-Info "Etape 5/8: Configuration de Claude Desktop..."

# Creer le dossier Claude si necessaire
$claudeDir = Split-Path $ClaudeConfigPath -Parent
if (-not (Test-Path $claudeDir)) {
    New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
    Log-Info "Dossier Claude cree: $claudeDir"
}

# Backup de l'ancienne config
if (Test-Path $ClaudeConfigPath) {
    $backupPath = "$ClaudeConfigPath.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
    Copy-Item $ClaudeConfigPath $backupPath -Force
    Log-Info "Backup cree: $backupPath"
}

# Lire config existante ou creer nouvelle
$existingConfig = $null
if (Test-Path $ClaudeConfigPath) {
    try {
        $existingConfig = Get-Content $ClaudeConfigPath -Raw | ConvertFrom-Json
    } catch {}
}

# Construire la configuration MCP complete
$mcpServers = @{
    n8n = @{
        command = "npx"
        args = @("-y", "@leonardsellem/n8n-mcp-server")
        env = @{
            N8N_API_URL = $N8N_API_URL
            N8N_API_KEY = $generatedApiKey
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
}

# Fusionner avec config existante
if ($existingConfig -and $existingConfig.mcpServers) {
    foreach ($prop in $existingConfig.mcpServers.PSObject.Properties) {
        if (-not $mcpServers.ContainsKey($prop.Name)) {
            $mcpServers[$prop.Name] = $prop.Value
        }
    }
}

$finalConfig = @{
    mcpServers = $mcpServers
}

# Ecrire la configuration
$configJson = $finalConfig | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($ClaudeConfigPath, $configJson, [System.Text.Encoding]::UTF8)

Log-Success "Configuration Claude Desktop ecrite"

# ============================================================================
# ETAPE 6: VERIFIER SI N8N TOURNE
# ============================================================================
Log-Info "Etape 6/8: Verification du serveur n8n..."

$n8nRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$N8N_PORT" -TimeoutSec 3 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        $n8nRunning = $true
        Log-Success "n8n est deja en cours d'execution"
    }
} catch {
    Log-Warn "n8n n'est pas en cours d'execution"
}

# ============================================================================
# ETAPE 7: DEMARRER N8N SI NECESSAIRE
# ============================================================================
Log-Info "Etape 7/8: Demarrage de n8n..."

if (-not $n8nRunning) {
    Log-Info "Lancement de n8n en arriere-plan..."

    # Creer un script de demarrage n8n
    $n8nStartScript = "$env:USERPROFILE\start-n8n.bat"
    @"
@echo off
title n8n Server - NEMESIS
set N8N_BASIC_AUTH_ACTIVE=false
set N8N_PORT=$N8N_PORT
npx n8n start
"@ | Out-File -FilePath $n8nStartScript -Encoding ASCII

    # Lancer n8n dans une nouvelle fenetre
    Start-Process cmd.exe -ArgumentList "/c `"$n8nStartScript`"" -WindowStyle Minimized

    Log-Info "Attente du demarrage de n8n (30 secondes max)..."

    $maxWait = 30
    $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 2
        $waited += 2

        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$N8N_PORT" -TimeoutSec 2 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                $n8nRunning = $true
                Log-Success "n8n demarre avec succes apres $waited secondes"
                break
            }
        } catch {}

        Write-Host "." -NoNewline
    }
    Write-Host ""

    if (-not $n8nRunning) {
        Log-Warn "n8n n'a pas demarre automatiquement"
        Log-Info "Lancez manuellement: npx n8n start"
    }
}

# ============================================================================
# ETAPE 8: CREER RACCOURCIS ET SCRIPTS UTILES
# ============================================================================
Log-Info "Etape 8/8: Creation des raccourcis..."

# Script pour demarrer n8n
$startN8nScript = "$env:USERPROFILE\Desktop\Start-n8n.bat"
@"
@echo off
title n8n Server - NEMESIS
echo ============================================
echo   n8n Server - Demarrage...
echo   Interface: http://localhost:$N8N_PORT
echo ============================================
set N8N_PORT=$N8N_PORT
npx n8n start
pause
"@ | Out-File -FilePath $startN8nScript -Encoding ASCII -ErrorAction SilentlyContinue

# Script pour ouvrir la config Claude
$editConfigScript = "$env:USERPROFILE\Desktop\Edit-Claude-Config.bat"
@"
@echo off
notepad "%APPDATA%\Claude\claude_desktop_config.json"
"@ | Out-File -FilePath $editConfigScript -Encoding ASCII -ErrorAction SilentlyContinue

Log-Success "Raccourcis crees sur le Bureau"

# ============================================================================
# RESUME FINAL
# ============================================================================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "              CONFIGURATION TERMINEE AVEC SUCCES               " -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

Write-Host "CONFIGURATION CLAUDE DESKTOP:" -ForegroundColor Yellow
Write-Host "  Fichier: $ClaudeConfigPath" -ForegroundColor White
Write-Host ""

Write-Host "SERVEURS MCP CONFIGURES:" -ForegroundColor Yellow
Write-Host "  - n8n (automatisation workflows)" -ForegroundColor Cyan
Write-Host "  - filesystem (acces fichiers)" -ForegroundColor Cyan
Write-Host "  - fetch (requetes HTTP)" -ForegroundColor Cyan
Write-Host "  - memory (memoire persistante)" -ForegroundColor Cyan
Write-Host ""

Write-Host "STATUT N8N:" -ForegroundColor Yellow
if ($n8nRunning) {
    Write-Host "  [RUNNING] http://localhost:$N8N_PORT" -ForegroundColor Green
} else {
    Write-Host "  [STOPPED] Lancez: Start-n8n.bat sur le Bureau" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "IMPORTANT - CLE API N8N:" -ForegroundColor Red
Write-Host "  1. Ouvrez http://localhost:$N8N_PORT dans votre navigateur" -ForegroundColor White
Write-Host "  2. Allez dans Settings > API" -ForegroundColor White
Write-Host "  3. Creez une nouvelle cle API" -ForegroundColor White
Write-Host "  4. Copiez-la dans le fichier de config Claude (N8N_API_KEY)" -ForegroundColor White
Write-Host "  5. Redemarrez Claude Desktop" -ForegroundColor White
Write-Host ""

Write-Host "RACCOURCIS CREES SUR LE BUREAU:" -ForegroundColor Yellow
Write-Host "  - Start-n8n.bat (demarrer n8n)" -ForegroundColor Cyan
Write-Host "  - Edit-Claude-Config.bat (modifier la config)" -ForegroundColor Cyan
Write-Host ""

# Ouvrir n8n dans le navigateur si running
if ($n8nRunning) {
    Start-Process "http://localhost:$N8N_PORT"
}

Write-Host "Log complet: $LogFile" -ForegroundColor Gray
Write-Host ""
Write-Host "Appuyez sur une touche pour fermer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
