# =============================================================================
# NEMESIS - Installation automatique complète (Windows PowerShell)
# Neural Expert Multi-agent Efficient System for Integrated Solutions
# Exécuter en tant qu'Administrateur: powershell -ExecutionPolicy Bypass -File install_nemesis.ps1
# =============================================================================

#Requires -Version 5.1

$ErrorActionPreference = "Stop"

# Paths
$NEMESIS_DIR = "$env:USERPROFILE\claude-code\ai-orchestrator"
$CONFIG_DIR = "$env:APPDATA\nemesis"
$DATA_DIR = "$env:LOCALAPPDATA\nemesis"
$LOG_DIR = "$env:LOCALAPPDATA\nemesis\logs"
$RESULTS_DIR = "$env:USERPROFILE\nemesis_results"

# Colors
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

# Banner
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Blue
Write-Host ""
Write-Host "   NEMESIS v2.0 - Installation Automatique Windows" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Neural Expert Multi-agent Efficient System" -ForegroundColor Cyan
Write-Host "   for Integrated Solutions" -ForegroundColor Cyan
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Blue
Write-Host ""

# =============================================================================
# 1. Vérifications préliminaires
# =============================================================================
Write-Host "[1/7] Verifications preliminaires..." -ForegroundColor Yellow

# Check Python
$pythonPath = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonPath) {
    Write-Host "   X Python non trouve. Installe-le depuis python.org" -ForegroundColor Red
    exit 1
}
$pythonVersion = python --version 2>&1
Write-Host "   OK $pythonVersion trouve" -ForegroundColor Green

# Check pip
$pipPath = Get-Command pip -ErrorAction SilentlyContinue
if (-not $pipPath) {
    Write-Host "   X pip non trouve. Reinstalle Python avec pip" -ForegroundColor Red
    exit 1
}
Write-Host "   OK pip trouve" -ForegroundColor Green

# Check NEMESIS directory
if (-not (Test-Path $NEMESIS_DIR)) {
    Write-Host "   X Repertoire NEMESIS non trouve: $NEMESIS_DIR" -ForegroundColor Red
    Write-Host "   Clone d'abord: git clone https://github.com/N3M3S1SK41R0S/claude-code.git $env:USERPROFILE\claude-code"
    exit 1
}
Write-Host "   OK Repertoire NEMESIS trouve" -ForegroundColor Green

# =============================================================================
# 2. Créer les répertoires
# =============================================================================
Write-Host ""
Write-Host "[2/7] Creation des repertoires..." -ForegroundColor Yellow

$directories = @($CONFIG_DIR, $DATA_DIR, $LOG_DIR, $RESULTS_DIR)
foreach ($dir in $directories) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Write-Host "   OK $dir" -ForegroundColor Green
}

# =============================================================================
# 3. Créer le fichier de configuration
# =============================================================================
Write-Host ""
Write-Host "[3/7] Creation de la configuration..." -ForegroundColor Yellow

$configContent = @"
# =============================================================================
# NEMESIS Configuration - Fichier utilisateur Windows
# =============================================================================

nemesis:
  version: "2.0.0"
  environment: production

# Mode par defaut
defaults:
  mode: auto
  rounds: 1
  timeout: 300
  headless: false

# Navigateur
browser:
  type: chrome
  profile: default

# Repertoires (Windows paths)
paths:
  results: $RESULTS_DIR
  cache: $DATA_DIR\cache
  logs: $LOG_DIR

# Agents IA
agents:
  enabled:
    - claude
    - chatgpt
    - gemini
    - mistral
    - perplexity
    - deepseek
    - grok

  urls:
    claude: https://claude.ai/new
    chatgpt: https://chat.openai.com/
    gemini: https://gemini.google.com/
    mistral: https://chat.mistral.ai/
    perplexity: https://www.perplexity.ai/
    deepseek: https://chat.deepseek.com/
    grok: https://grok.x.ai/

# Service HTTP local
server:
  enabled: true
  host: 127.0.0.1
  port: 8765

# MCP Server
mcp:
  enabled: true
  auto_start: false

# Logging
logging:
  level: INFO
  file: $LOG_DIR\nemesis.log
  max_size_mb: 10
  backup_count: 5
"@

$configContent | Out-File -FilePath "$CONFIG_DIR\config.yaml" -Encoding UTF8
Write-Host "   OK Configuration creee: $CONFIG_DIR\config.yaml" -ForegroundColor Green

# =============================================================================
# 4. Créer le wrapper batch
# =============================================================================
Write-Host ""
Write-Host "[4/7] Creation du wrapper executable..." -ForegroundColor Yellow

# Batch file pour cmd.exe
$batchContent = @"
@echo off
REM NEMESIS CLI Wrapper for Windows
REM Auto-generated by install_nemesis.ps1

set NEMESIS_HOME=$NEMESIS_DIR
set NEMESIS_CONFIG=$CONFIG_DIR\config.yaml
set NEMESIS_DATA=$DATA_DIR
set NEMESIS_RESULTS=$RESULTS_DIR

python "%NEMESIS_HOME%\nemesis.py" %*
"@

$batchPath = "$NEMESIS_DIR\nemesis.bat"
$batchContent | Out-File -FilePath $batchPath -Encoding ASCII
Write-Host "   OK Wrapper batch cree: $batchPath" -ForegroundColor Green

# Also create in System32 if admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    $systemBatch = "C:\Windows\System32\nemesis.bat"
    $batchContent | Out-File -FilePath $systemBatch -Encoding ASCII
    Write-Host "   OK Wrapper systeme cree: $systemBatch" -ForegroundColor Green
} else {
    Write-Host "   ! Lance en admin pour installer dans System32" -ForegroundColor Yellow
}

# =============================================================================
# 5. Ajouter au PATH et créer aliases PowerShell
# =============================================================================
Write-Host ""
Write-Host "[5/7] Configuration PATH et aliases..." -ForegroundColor Yellow

# Add to User PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$NEMESIS_DIR*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$NEMESIS_DIR", "User")
    Write-Host "   OK NEMESIS_DIR ajoute au PATH utilisateur" -ForegroundColor Green
} else {
    Write-Host "   -> PATH deja configure" -ForegroundColor Cyan
}

# Set environment variables
[Environment]::SetEnvironmentVariable("NEMESIS_CONFIG", "$CONFIG_DIR\config.yaml", "User")
[Environment]::SetEnvironmentVariable("NEMESIS_RESULTS", "$RESULTS_DIR", "User")
Write-Host "   OK Variables d'environnement configurees" -ForegroundColor Green

# Create/Update PowerShell profile
$profilePath = $PROFILE.CurrentUserAllHosts
$profileDir = Split-Path $profilePath -Parent

if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
}

if (-not (Test-Path $profilePath)) {
    New-Item -ItemType File -Force -Path $profilePath | Out-Null
}

$profileContent = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
if ($profileContent -notlike "*NEMESIS aliases*") {
    $aliasContent = @"

# =============================================================================
# NEMESIS aliases and functions
# =============================================================================
`$env:NEMESIS_CONFIG = "$CONFIG_DIR\config.yaml"
`$env:NEMESIS_RESULTS = "$RESULTS_DIR"

# Quick commands
function nq { nemesis run --quick `$args }
function nr { nemesis run --rounds 3 `$args }
function ns { nemesis stats }
function nh { nemesis history }
function nv { nemesis verify `$args }
function nm { nemesis memory stats }

# Server management
function Start-Nemesis { nemesis server start }
function Stop-Nemesis { nemesis server stop }
function Get-NemesisLogs { Get-Content "$LOG_DIR\nemesis.log" -Tail 50 -Wait }

# Alias
Set-Alias -Name nemesis-server -Value Start-Nemesis
Set-Alias -Name nemesis-logs -Value Get-NemesisLogs
"@
    Add-Content -Path $profilePath -Value $aliasContent
    Write-Host "   OK Aliases PowerShell ajoutes a $profilePath" -ForegroundColor Green
} else {
    Write-Host "   -> Aliases deja configures" -ForegroundColor Cyan
}

# =============================================================================
# 6. Installer les dépendances Python
# =============================================================================
Write-Host ""
Write-Host "[6/7] Installation des dependances Python..." -ForegroundColor Yellow

$packages = @("flask", "flask-cors", "pyyaml", "pyperclip", "requests", "cryptography")
foreach ($pkg in $packages) {
    pip install --quiet $pkg 2>$null
}
Write-Host "   OK Dependances Python installees" -ForegroundColor Green

# =============================================================================
# 7. Créer la tâche planifiée pour le daemon
# =============================================================================
Write-Host ""
Write-Host "[7/7] Configuration du service daemon..." -ForegroundColor Yellow

Write-Host "   Veux-tu creer une tache planifiee pour le daemon NEMESIS ?" -ForegroundColor Cyan
Write-Host "   Cela permet de lancer NEMESIS au demarrage et d'utiliser l'API HTTP."
$response = Read-Host "   Creer la tache (O/n)?"

if ($response -eq "" -or $response -match "^[OoYy]") {
    if ($isAdmin) {
        # Remove existing task if any
        Unregister-ScheduledTask -TaskName "NEMESIS Service" -Confirm:$false -ErrorAction SilentlyContinue

        # Create new task
        $action = New-ScheduledTaskAction -Execute "python" -Argument "$NEMESIS_DIR\nemesis_server.py" -WorkingDirectory $NEMESIS_DIR
        $trigger = New-ScheduledTaskTrigger -AtLogOn
        $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

        Register-ScheduledTask -TaskName "NEMESIS Service" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

        # Start immediately
        Start-ScheduledTask -TaskName "NEMESIS Service" -ErrorAction SilentlyContinue

        Write-Host "   OK Tache planifiee creee et demarree" -ForegroundColor Green
        Write-Host "   API disponible sur http://localhost:8765" -ForegroundColor Cyan
    } else {
        Write-Host "   ! Lance PowerShell en Administrateur pour creer la tache" -ForegroundColor Yellow
    }
} else {
    Write-Host "   -> Tache planifiee non creee" -ForegroundColor Cyan
}

# =============================================================================
# Créer les raccourcis Bureau
# =============================================================================
Write-Host ""
Write-Host "Creation des raccourcis Bureau..." -ForegroundColor Yellow

$desktopPath = [Environment]::GetFolderPath("Desktop")

# Raccourci NEMESIS
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut("$desktopPath\NEMESIS.lnk")
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoExit -Command `"cd '$NEMESIS_DIR'; Write-Host 'NEMESIS Ready!' -ForegroundColor Green; nemesis --help`""
$shortcut.WorkingDirectory = $NEMESIS_DIR
$shortcut.Description = "NEMESIS Multi-AI Orchestrator"
$shortcut.Save()
Write-Host "   OK Raccourci Bureau cree" -ForegroundColor Green

# =============================================================================
# Fin de l'installation
# =============================================================================
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "   INSTALLATION TERMINEE !" -ForegroundColor Green
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""

Write-Host "Utilisation:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  # Analyse simple"
Write-Host '  nemesis run "Explique-moi les microservices"'
Write-Host ""
Write-Host "  # Analyse d'un fichier"
Write-Host "  nemesis run --file architecture.md"
Write-Host ""
Write-Host "  # Analyse rapide (1 round)"
Write-Host '  nq "Question rapide"'
Write-Host ""
Write-Host "  # Analyse approfondie (3 rounds)"
Write-Host '  nr "Analyse complexe"'
Write-Host ""
Write-Host "  # Verifier du code"
Write-Host "  nemesis verify --file script.py"
Write-Host ""
Write-Host "  # Statistiques"
Write-Host "  nemesis stats"
Write-Host ""

Write-Host "N'oublie pas de redemarrer PowerShell pour activer les aliases!" -ForegroundColor Yellow
Write-Host ""
Write-Host "NEMESIS est pret !" -ForegroundColor Green
