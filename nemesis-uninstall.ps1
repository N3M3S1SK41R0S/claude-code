#Requires -Version 5.1
<#
.SYNOPSIS
    NEMESIS Uninstaller - Désinstallation complète de NEMESIS
.DESCRIPTION
    Supprime tous les composants NEMESIS:
    - Conteneurs Docker
    - Volumes de données
    - Fichiers de configuration
    - Entrées DNS
    - Raccourcis bureau
.PARAMETER KeepData
    Conserver les données (volumes Docker)
.PARAMETER KeepBackups
    Conserver les sauvegardes
.PARAMETER Force
    Ne pas demander de confirmation
.EXAMPLE
    .\nemesis-uninstall.ps1
    .\nemesis-uninstall.ps1 -KeepData
    .\nemesis-uninstall.ps1 -Force
#>

[CmdletBinding()]
param(
    [switch]$KeepData,
    [switch]$KeepBackups,
    [switch]$Force
)

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ CONFIGURATION                                                              ║
# ╚════════════════════════════════════════════════════════════════════════════╝

$NemesisHome = "$env:USERPROFILE\Nemesis"
$HostsPath = "$env:windir\System32\drivers\etc\hosts"

function Write-Status {
    param([string]$Message, [string]$Type = "Info")
    $icons = @{ "Info" = "ℹ️"; "Success" = "✅"; "Warning" = "⚠️"; "Error" = "❌" }
    $colors = @{ "Info" = "Cyan"; "Success" = "Green"; "Warning" = "Yellow"; "Error" = "Red" }
    Write-Host "$($icons[$Type]) $Message" -ForegroundColor $colors[$Type]
}

function Pause-And-Exit {
    param([int]$ExitCode = 0)
    Write-Host ""
    Write-Host "Appuyez sur [ENTRÉE] pour fermer..." -ForegroundColor Gray -NoNewline
    $null = Read-Host
    exit $ExitCode
}

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ VÉRIFICATIONS                                                              ║
# ╚════════════════════════════════════════════════════════════════════════════╝

Clear-Host
Write-Host @"

    ███╗   ██╗███████╗███╗   ███╗███████╗███████╗██╗███████╗
    ████╗  ██║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝
    ██╔██╗ ██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗
    ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║
    ██║ ╚████║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║
    ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝
                    UNINSTALLER v1.0

"@ -ForegroundColor Red

# Vérifier Admin
$Identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$Principal = [Security.Principal.WindowsPrincipal]$Identity
if (-not $Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Status "Droits administrateur requis pour la désinstallation complète" "Error"
    Pause-And-Exit -ExitCode 1
}

# Vérifier si NEMESIS est installé
if (-not (Test-Path $NemesisHome)) {
    Write-Status "NEMESIS n'est pas installé sur ce système" "Warning"
    Pause-And-Exit -ExitCode 0
}

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ CONFIRMATION                                                               ║
# ╚════════════════════════════════════════════════════════════════════════════╝

Write-Host "  Cette action va supprimer:" -ForegroundColor Yellow
Write-Host ""
Write-Host "    🐳 Tous les conteneurs NEMESIS" -ForegroundColor White
if (-not $KeepData) {
    Write-Host "    💾 Toutes les données (volumes Docker)" -ForegroundColor Red
} else {
    Write-Host "    💾 Données conservées (volumes Docker)" -ForegroundColor Green
}
if (-not $KeepBackups) {
    Write-Host "    📦 Toutes les sauvegardes" -ForegroundColor Red
} else {
    Write-Host "    📦 Sauvegardes conservées" -ForegroundColor Green
}
Write-Host "    📁 Fichiers de configuration ($NemesisHome)" -ForegroundColor White
Write-Host "    🌐 Entrées DNS (nemesis.ai)" -ForegroundColor White
Write-Host "    🔗 Raccourci bureau" -ForegroundColor White
Write-Host ""

if (-not $Force) {
    $confirm = Read-Host "  Êtes-vous sûr de vouloir désinstaller NEMESIS? (oui/non)"
    if ($confirm -ne "oui") {
        Write-Status "Désinstallation annulée" "Info"
        Pause-And-Exit -ExitCode 0
    }
    Write-Host ""
}

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ DÉSINSTALLATION                                                            ║
# ╚════════════════════════════════════════════════════════════════════════════╝

$ErrorActionPreference = "Continue"

# 1. Arrêter et supprimer les conteneurs
Write-Status "Arrêt des conteneurs..." "Info"
Push-Location $NemesisHome
$env:COMPOSE_PROJECT_NAME = "nemesis"
docker compose down --remove-orphans 2>$null
Pop-Location

# Supprimer les conteneurs restants
$containers = docker ps -aq --filter "name=nemesis-" 2>$null
if ($containers) {
    docker rm -f $containers 2>$null
}
Write-Status "Conteneurs supprimés" "Success"

# 2. Supprimer les volumes (si pas -KeepData)
if (-not $KeepData) {
    Write-Status "Suppression des volumes de données..." "Warning"

    $volumes = @(
        "nemesis_postgres_data",
        "nemesis_n8n_data",
        "nemesis_ollama_data",
        "nemesis_open-webui_data",
        "nemesis_portainer_data",
        "nemesis_prometheus_data",
        "nemesis_grafana_data",
        "nemesis_redis_data"
    )

    foreach ($vol in $volumes) {
        docker volume rm $vol 2>$null | Out-Null
    }

    Write-Status "Volumes supprimés" "Success"
} else {
    Write-Status "Volumes conservés" "Info"
}

# 3. Supprimer le réseau Docker
Write-Status "Suppression du réseau Docker..." "Info"
docker network rm nemesis_nemesis-net 2>$null | Out-Null
docker network rm nemesis-net 2>$null | Out-Null
Write-Status "Réseau supprimé" "Success"

# 4. Supprimer les images (optionnel)
Write-Host ""
$removeImages = Read-Host "  Supprimer aussi les images Docker téléchargées? (oui/non)"
if ($removeImages -eq "oui") {
    Write-Status "Suppression des images..." "Info"

    $images = @(
        "ghcr.io/gethomepage/homepage",
        "ghcr.io/open-webui/open-webui",
        "ollama/ollama",
        "n8nio/n8n",
        "postgres",
        "portainer/portainer-ce",
        "prom/prometheus",
        "grafana/grafana",
        "redis",
        "traefik"
    )

    foreach ($img in $images) {
        docker rmi $img 2>$null | Out-Null
    }

    Write-Status "Images supprimées" "Success"
}
Write-Host ""

# 5. Supprimer les fichiers de configuration
Write-Status "Suppression des fichiers de configuration..." "Info"

if ($KeepBackups -and (Test-Path "$NemesisHome\backups")) {
    # Déplacer les backups avant de supprimer
    $backupDest = "$env:USERPROFILE\Nemesis_Backups_$(Get-Date -Format 'yyyyMMdd')"
    Move-Item -Path "$NemesisHome\backups" -Destination $backupDest -Force
    Write-Status "Backups déplacés vers: $backupDest" "Info"
}

Remove-Item -Path $NemesisHome -Recurse -Force -ErrorAction SilentlyContinue
Write-Status "Fichiers supprimés" "Success"

# 6. Supprimer les entrées DNS
Write-Status "Nettoyage des entrées DNS..." "Info"
try {
    $hostsContent = Get-Content $HostsPath -Raw
    $hostsContent = $hostsContent -replace "127\.0\.0\.1\s+nemesis\.ai\r?\n?", ""
    $hostsContent = $hostsContent -replace "127\.0\.0\.1\s+brain\.nemesis\.ai\r?\n?", ""
    $hostsContent = $hostsContent.Trim()
    Set-Content -Path $HostsPath -Value $hostsContent -Force
    ipconfig /flushdns | Out-Null
    Write-Status "Entrées DNS supprimées" "Success"
} catch {
    Write-Status "Impossible de modifier le fichier hosts (protégé?)" "Warning"
}

# 7. Supprimer le raccourci bureau
Write-Status "Suppression du raccourci..." "Info"
$shortcut = "$([Environment]::GetFolderPath('Desktop'))\NEMESIS.url"
if (Test-Path $shortcut) {
    Remove-Item -Path $shortcut -Force
}
Write-Status "Raccourci supprimé" "Success"

# 8. Nettoyage Docker final
Write-Status "Nettoyage Docker..." "Info"
docker system prune -f 2>$null | Out-Null

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ RÉSUMÉ                                                                     ║
# ╚════════════════════════════════════════════════════════════════════════════╝

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    ✅ DÉSINSTALLATION TERMINÉE                           ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  NEMESIS a été complètement supprimé de votre système." -ForegroundColor White
Write-Host ""

if ($KeepBackups) {
    Write-Host "  📦 Vos sauvegardes ont été préservées dans:" -ForegroundColor Yellow
    Write-Host "     $backupDest" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "  Pour réinstaller NEMESIS:" -ForegroundColor Cyan
Write-Host "     .\nemesis-install.ps1" -ForegroundColor Gray
Write-Host ""

Pause-And-Exit -ExitCode 0
