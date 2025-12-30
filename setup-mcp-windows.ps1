#Requires -RunAsAdministrator
# =============================================================================
# SCRIPT DE CONFIGURATION MCP POUR CLAUDE DESKTOP - WINDOWS
# =============================================================================

param(
    [switch]$SkipNodeInstall,
    [switch]$SkipPythonInstall,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Couleurs
function Write-Step { param($msg) Write-Host "`n[$((Get-Date).ToString('HH:mm:ss'))] $msg" -ForegroundColor Cyan }
function Write-OK { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host "  [X] $msg" -ForegroundColor Red }

# =============================================================================
# CONFIGURATION
# =============================================================================
$CONFIG = @{
    McpServersDir = "$env:USERPROFILE\.mcp-servers"
    VenvDir = "$env:USERPROFILE\.mcp-servers\venv"
    ClaudeConfigPath = "$env:APPDATA\Claude\claude_desktop_config.json"
    NodeMinVersion = [version]"18.0.0"
    PythonMinVersion = [version]"3.10.0"
}

# =============================================================================
# FONCTIONS UTILITAIRES
# =============================================================================

function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

function Get-InstalledVersion {
    param([string]$Command, [string]$VersionArg = "--version")
    try {
        $output = & $Command $VersionArg 2>&1
        if ($output -match '(\d+\.\d+\.\d+)') {
            return [version]$matches[1]
        }
    } catch {}
    return $null
}

function Install-WithWinget {
    param([string]$PackageId, [string]$Name)

    if (-not (Test-CommandExists "winget")) {
        Write-Err "winget non disponible. Installez $Name manuellement."
        return $false
    }

    Write-Host "  Installation de $Name via winget..." -ForegroundColor Yellow
    $result = winget install --id $PackageId --accept-source-agreements --accept-package-agreements 2>&1

    # Rafraichir le PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    return $LASTEXITCODE -eq 0
}

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# =============================================================================
# ETAPE 1: VERIFIER/INSTALLER NODE.JS
# =============================================================================
function Install-NodeJS {
    Write-Step "Verification de Node.js..."

    $nodeVersion = Get-InstalledVersion "node"

    if ($nodeVersion -and $nodeVersion -ge $CONFIG.NodeMinVersion) {
        Write-OK "Node.js $nodeVersion deja installe"
        return $true
    }

    if ($SkipNodeInstall) {
        Write-Warn "Installation de Node.js ignoree (parametre -SkipNodeInstall)"
        return $false
    }

    if ($nodeVersion) {
        Write-Warn "Node.js $nodeVersion trouve mais version $($CONFIG.NodeMinVersion)+ requise"
    } else {
        Write-Warn "Node.js non installe"
    }

    Write-Host "  Installation de Node.js LTS..." -ForegroundColor Yellow

    # Methode 1: winget
    if (Test-CommandExists "winget") {
        winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        Refresh-Path

        if (Test-CommandExists "node") {
            Write-OK "Node.js installe avec succes"
            return $true
        }
    }

    # Methode 2: Telechargement direct
    Write-Host "  Telechargement de l'installateur Node.js..." -ForegroundColor Yellow
    $nodeInstaller = "$env:TEMP\node-setup.msi"
    $nodeUrl = "https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi"

    try {
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller -UseBasicParsing
        Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /qn" -Wait -NoNewWindow
        Remove-Item $nodeInstaller -Force -ErrorAction SilentlyContinue
        Refresh-Path

        if (Test-CommandExists "node") {
            Write-OK "Node.js installe avec succes"
            return $true
        }
    } catch {
        Write-Err "Echec du telechargement: $_"
    }

    Write-Err "Impossible d'installer Node.js automatiquement"
    Write-Host "  Installez manuellement depuis: https://nodejs.org/" -ForegroundColor Yellow
    return $false
}

# =============================================================================
# ETAPE 2: VERIFIER/INSTALLER PYTHON
# =============================================================================
function Install-Python {
    Write-Step "Verification de Python..."

    $pythonVersion = Get-InstalledVersion "python"

    if ($pythonVersion -and $pythonVersion -ge $CONFIG.PythonMinVersion) {
        Write-OK "Python $pythonVersion deja installe"
        return $true
    }

    if ($SkipPythonInstall) {
        Write-Warn "Installation de Python ignoree (parametre -SkipPythonInstall)"
        return $false
    }

    if ($pythonVersion) {
        Write-Warn "Python $pythonVersion trouve mais version $($CONFIG.PythonMinVersion)+ requise"
    } else {
        Write-Warn "Python non installe"
    }

    Write-Host "  Installation de Python..." -ForegroundColor Yellow

    # Methode 1: winget
    if (Test-CommandExists "winget") {
        winget install --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
        Refresh-Path

        if (Test-CommandExists "python") {
            $newVersion = Get-InstalledVersion "python"
            if ($newVersion -ge $CONFIG.PythonMinVersion) {
                Write-OK "Python $newVersion installe avec succes"
                return $true
            }
        }
    }

    # Methode 2: Telechargement direct
    Write-Host "  Telechargement de l'installateur Python..." -ForegroundColor Yellow
    $pythonInstaller = "$env:TEMP\python-setup.exe"
    $pythonUrl = "https://www.python.org/ftp/python/3.12.1/python-3.12.1-amd64.exe"

    try {
        Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonInstaller -UseBasicParsing
        Start-Process $pythonInstaller -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1" -Wait -NoNewWindow
        Remove-Item $pythonInstaller -Force -ErrorAction SilentlyContinue
        Refresh-Path

        if (Test-CommandExists "python") {
            Write-OK "Python installe avec succes"
            return $true
        }
    } catch {
        Write-Err "Echec du telechargement: $_"
    }

    Write-Err "Impossible d'installer Python automatiquement"
    Write-Host "  Installez manuellement depuis: https://www.python.org/" -ForegroundColor Yellow
    return $false
}

# =============================================================================
# ETAPE 3: CREER L'ENVIRONNEMENT VIRTUEL PYTHON
# =============================================================================
function New-McpVenv {
    Write-Step "Configuration de l'environnement virtuel MCP..."

    # Creer le dossier MCP servers
    if (-not (Test-Path $CONFIG.McpServersDir)) {
        New-Item -ItemType Directory -Path $CONFIG.McpServersDir -Force | Out-Null
        Write-OK "Dossier cree: $($CONFIG.McpServersDir)"
    }

    $venvPython = Join-Path $CONFIG.VenvDir "Scripts\python.exe"

    # Verifier si le venv existe deja
    if ((Test-Path $venvPython) -and -not $Force) {
        Write-OK "Environnement virtuel deja present"
        return $true
    }

    # Supprimer l'ancien venv si -Force
    if ($Force -and (Test-Path $CONFIG.VenvDir)) {
        Write-Warn "Suppression de l'ancien environnement virtuel..."
        Remove-Item -Recurse -Force $CONFIG.VenvDir
    }

    # Creer le venv
    Write-Host "  Creation de l'environnement virtuel..." -ForegroundColor Yellow

    try {
        & python -m venv $CONFIG.VenvDir

        if (Test-Path $venvPython) {
            Write-OK "Environnement virtuel cree: $($CONFIG.VenvDir)"

            # Mettre a jour pip
            Write-Host "  Mise a jour de pip..." -ForegroundColor Yellow
            & $venvPython -m pip install --upgrade pip --quiet

            # Installer des packages MCP courants
            Write-Host "  Installation des packages MCP..." -ForegroundColor Yellow
            & $venvPython -m pip install mcp --quiet 2>$null

            Write-OK "Packages MCP installes"
            return $true
        }
    } catch {
        Write-Err "Erreur lors de la creation du venv: $_"
    }

    return $false
}

# =============================================================================
# ETAPE 4: INSTALLER LES SERVEURS MCP NPM
# =============================================================================
function Install-McpServers {
    Write-Step "Installation des serveurs MCP Node.js..."

    if (-not (Test-CommandExists "npm")) {
        Write-Err "npm non disponible, impossible d'installer les serveurs MCP"
        return $false
    }

    $servers = @(
        "@modelcontextprotocol/server-filesystem"
        "@modelcontextprotocol/server-memory"
    )

    foreach ($server in $servers) {
        Write-Host "  Installation de $server..." -ForegroundColor Yellow
        $result = npm install -g $server 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-OK "$server installe"
        } else {
            Write-Warn "Echec de l'installation de $server (optionnel)"
        }
    }

    return $true
}

# =============================================================================
# ETAPE 5: CONFIGURER CLAUDE DESKTOP
# =============================================================================
function Set-ClaudeConfig {
    Write-Step "Configuration de Claude Desktop..."

    $configDir = Split-Path $CONFIG.ClaudeConfigPath -Parent

    # Creer le dossier si necessaire
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
        Write-OK "Dossier de configuration cree"
    }

    # Configuration MCP de base
    $venvPython = Join-Path $CONFIG.VenvDir "Scripts\python.exe"
    $npxPath = (Get-Command npx -ErrorAction SilentlyContinue).Source
    if (-not $npxPath) { $npxPath = "npx" }

    $defaultConfig = @{
        mcpServers = @{
            filesystem = @{
                command = $npxPath
                args = @(
                    "-y"
                    "@modelcontextprotocol/server-filesystem"
                    "$env:USERPROFILE\Documents"
                    "$env:USERPROFILE\Desktop"
                )
            }
            memory = @{
                command = $npxPath
                args = @(
                    "-y"
                    "@modelcontextprotocol/server-memory"
                )
            }
        }
    }

    # Ajouter le serveur Python si le venv existe
    if (Test-Path $venvPython) {
        $defaultConfig.mcpServers["python-executor"] = @{
            command = $venvPython
            args = @("-m", "mcp")
        }
    }

    # Verifier si une config existe deja
    if (Test-Path $CONFIG.ClaudeConfigPath) {
        if (-not $Force) {
            Write-Warn "Configuration existante detectee"

            try {
                $existingConfig = Get-Content $CONFIG.ClaudeConfigPath -Raw | ConvertFrom-Json
                Write-Host "  Configuration actuelle:" -ForegroundColor Yellow
                Write-Host ($existingConfig | ConvertTo-Json -Depth 10) -ForegroundColor Gray

                $response = Read-Host "  Voulez-vous la remplacer? (o/N)"
                if ($response -notmatch '^[oOyY]') {
                    Write-OK "Configuration existante conservee"
                    return $true
                }
            } catch {
                Write-Warn "Configuration existante invalide, elle sera remplacee"
            }
        }

        # Backup
        $backupPath = "$($CONFIG.ClaudeConfigPath).backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item $CONFIG.ClaudeConfigPath $backupPath
        Write-OK "Backup cree: $backupPath"
    }

    # Ecrire la nouvelle configuration
    $configJson = $defaultConfig | ConvertTo-Json -Depth 10
    $configJson | Out-File -FilePath $CONFIG.ClaudeConfigPath -Encoding UTF8

    Write-OK "Configuration Claude Desktop creee"
    Write-Host "`n  Fichier: $($CONFIG.ClaudeConfigPath)" -ForegroundColor Gray
    Write-Host $configJson -ForegroundColor Gray

    return $true
}

# =============================================================================
# ETAPE 6: VERIFICATION FINALE
# =============================================================================
function Test-Installation {
    Write-Step "Verification finale de l'installation..."

    $success = $true

    # Node.js
    if (Test-CommandExists "node") {
        $v = Get-InstalledVersion "node"
        Write-OK "Node.js: $v"
    } else {
        Write-Err "Node.js: Non installe"
        $success = $false
    }

    # npm
    if (Test-CommandExists "npm") {
        $v = Get-InstalledVersion "npm"
        Write-OK "npm: $v"
    } else {
        Write-Err "npm: Non installe"
        $success = $false
    }

    # Python
    if (Test-CommandExists "python") {
        $v = Get-InstalledVersion "python"
        Write-OK "Python: $v"
    } else {
        Write-Err "Python: Non installe"
        $success = $false
    }

    # Venv
    $venvPython = Join-Path $CONFIG.VenvDir "Scripts\python.exe"
    if (Test-Path $venvPython) {
        Write-OK "Venv MCP: $($CONFIG.VenvDir)"
    } else {
        Write-Warn "Venv MCP: Non configure"
    }

    # Claude config
    if (Test-Path $CONFIG.ClaudeConfigPath) {
        Write-OK "Config Claude: $($CONFIG.ClaudeConfigPath)"
    } else {
        Write-Err "Config Claude: Non trouvee"
        $success = $false
    }

    return $success
}

# =============================================================================
# MAIN
# =============================================================================
function Main {
    Clear-Host
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "   CONFIGURATION MCP POUR CLAUDE DESKTOP - WINDOWS" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Ce script va:" -ForegroundColor White
    Write-Host "  1. Installer Node.js (si necessaire)" -ForegroundColor Gray
    Write-Host "  2. Installer Python (si necessaire)" -ForegroundColor Gray
    Write-Host "  3. Creer un environnement virtuel MCP" -ForegroundColor Gray
    Write-Host "  4. Installer les serveurs MCP" -ForegroundColor Gray
    Write-Host "  5. Configurer Claude Desktop" -ForegroundColor Gray
    Write-Host ""

    # Verifier les privileges admin
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Warn "Execution sans privileges administrateur"
        Write-Host "  Certaines installations peuvent echouer." -ForegroundColor Yellow
        Write-Host "  Relancez en tant qu'administrateur si necessaire." -ForegroundColor Yellow
    }

    $response = Read-Host "Continuer? (O/n)"
    if ($response -match '^[nN]') {
        Write-Host "Installation annulee." -ForegroundColor Yellow
        return
    }

    # Executer les etapes
    $nodeOk = Install-NodeJS
    $pythonOk = Install-Python

    if ($pythonOk) {
        New-McpVenv | Out-Null
    }

    if ($nodeOk) {
        Install-McpServers | Out-Null
    }

    Set-ClaudeConfig | Out-Null

    # Verification finale
    Write-Host ""
    $allOk = Test-Installation

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    if ($allOk) {
        Write-Host "   INSTALLATION TERMINEE AVEC SUCCES!" -ForegroundColor Green
        Write-Host "============================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Prochaines etapes:" -ForegroundColor Yellow
        Write-Host "  1. Redemarrez Claude Desktop" -ForegroundColor White
        Write-Host "  2. Verifiez que les serveurs MCP apparaissent" -ForegroundColor White
        Write-Host "  3. Testez avec: 'Liste mes fichiers sur le bureau'" -ForegroundColor White
    } else {
        Write-Host "   INSTALLATION INCOMPLETE" -ForegroundColor Yellow
        Write-Host "============================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Certains composants n'ont pas pu etre installes." -ForegroundColor Yellow
        Write-Host "Verifiez les erreurs ci-dessus et reessayez." -ForegroundColor Yellow
    }

    Write-Host ""
    Read-Host "Appuyez sur Entree pour fermer"
}

# Lancer le script
Main
