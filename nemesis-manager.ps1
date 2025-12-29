#Requires -Version 5.1
<#
.SYNOPSIS
    NEMESIS Manager - Gestion complète de l'infrastructure NEMESIS
.DESCRIPTION
    Script de management pour contrôler tous les services NEMESIS:
    - Start/Stop/Restart des services
    - Status et santé des conteneurs
    - Logs en temps réel
    - Backup et restauration
    - Mise à jour des images
    - Nettoyage du système
.PARAMETER Action
    L'action à effectuer: start, stop, restart, status, logs, backup, restore, update, clean, shell, pull
.PARAMETER Service
    Le service cible (optionnel): ollama, n8n, postgres, open-webui, homepage, portainer, prometheus, grafana, all
.PARAMETER BackupName
    Nom du backup (pour backup/restore)
.EXAMPLE
    .\nemesis-manager.ps1 status
    .\nemesis-manager.ps1 logs ollama
    .\nemesis-manager.ps1 restart n8n
    .\nemesis-manager.ps1 backup daily
    .\nemesis-manager.ps1 shell postgres
.NOTES
    Version: 1.0
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet("start", "stop", "restart", "status", "logs", "backup", "restore", "update", "clean", "shell", "pull", "health", "stats", "help")]
    [string]$Action = "help",

    [Parameter(Position = 1)]
    [string]$Service = "all",

    [Parameter(Position = 2)]
    [string]$BackupName = ""
)

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ CONFIGURATION                                                              ║
# ╚════════════════════════════════════════════════════════════════════════════╝

$Script:Config = @{
    NemesisHome = "$env:USERPROFILE\Nemesis"
    BackupDir   = "$env:USERPROFILE\Nemesis\backups"
    ComposeFile = "$env:USERPROFILE\Nemesis\docker-compose.yml"
    Services    = @{
        "ollama"     = "nemesis-ollama"
        "n8n"        = "nemesis-n8n"
        "postgres"   = "nemesis-postgres"
        "open-webui" = "nemesis-brain"
        "homepage"   = "nemesis-cockpit"
        "portainer"  = "nemesis-portainer"
        "prometheus" = "nemesis-prometheus"
        "grafana"    = "nemesis-grafana"
        "redis"      = "nemesis-redis"
        "traefik"    = "nemesis-traefik"
    }
}

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ FONCTIONS UTILITAIRES                                                      ║
# ╚════════════════════════════════════════════════════════════════════════════╝

function Write-Banner {
    Write-Host @"

    ███╗   ██╗███████╗███╗   ███╗███████╗███████╗██╗███████╗
    ████╗  ██║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝
    ██╔██╗ ██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗
    ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║
    ██║ ╚████║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║
    ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝
                    MANAGER v1.0

"@ -ForegroundColor Cyan
}

function Write-Status {
    param(
        [string]$Message,
        [ValidateSet("Info", "Success", "Warning", "Error")]
        [string]$Type = "Info"
    )

    $icons = @{
        "Info"    = "ℹ️"
        "Success" = "✅"
        "Warning" = "⚠️"
        "Error"   = "❌"
    }
    $colors = @{
        "Info"    = "Cyan"
        "Success" = "Green"
        "Warning" = "Yellow"
        "Error"   = "Red"
    }

    Write-Host "$($icons[$Type]) $Message" -ForegroundColor $colors[$Type]
}

function Get-ContainerName {
    param([string]$ServiceName)

    if ($Script:Config.Services.ContainsKey($ServiceName)) {
        return $Script:Config.Services[$ServiceName]
    }
    return $ServiceName
}

function Test-DockerRunning {
    try {
        $null = docker info 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Invoke-DockerCompose {
    param([string[]]$Arguments)

    Push-Location $Script:Config.NemesisHome
    try {
        $env:COMPOSE_PROJECT_NAME = "nemesis"
        & docker compose @Arguments
    } finally {
        Pop-Location
    }
}

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ ACTIONS PRINCIPALES                                                        ║
# ╚════════════════════════════════════════════════════════════════════════════╝

function Show-Help {
    Write-Banner
    Write-Host "  Usage: .\nemesis-manager.ps1 <action> [service] [options]" -ForegroundColor White
    Write-Host ""
    Write-Host "  Actions disponibles:" -ForegroundColor Yellow
    Write-Host "    start    [service]     Démarrer les services" -ForegroundColor Gray
    Write-Host "    stop     [service]     Arrêter les services" -ForegroundColor Gray
    Write-Host "    restart  [service]     Redémarrer les services" -ForegroundColor Gray
    Write-Host "    status                 État de tous les conteneurs" -ForegroundColor Gray
    Write-Host "    health                 Vérification santé détaillée" -ForegroundColor Gray
    Write-Host "    stats                  Statistiques ressources (CPU/RAM)" -ForegroundColor Gray
    Write-Host "    logs     [service]     Voir les logs (temps réel)" -ForegroundColor Gray
    Write-Host "    shell    <service>     Ouvrir un shell dans le conteneur" -ForegroundColor Gray
    Write-Host "    pull                   Télécharger les dernières images" -ForegroundColor Gray
    Write-Host "    update                 Mettre à jour tous les services" -ForegroundColor Gray
    Write-Host "    backup   [name]        Sauvegarder les données" -ForegroundColor Gray
    Write-Host "    restore  <name>        Restaurer une sauvegarde" -ForegroundColor Gray
    Write-Host "    clean                  Nettoyer les ressources inutilisées" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Services: ollama, n8n, postgres, open-webui, homepage, portainer" -ForegroundColor Yellow
    Write-Host "            prometheus, grafana, redis, traefik, all (défaut)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Exemples:" -ForegroundColor Yellow
    Write-Host "    .\nemesis-manager.ps1 status" -ForegroundColor Gray
    Write-Host "    .\nemesis-manager.ps1 logs ollama" -ForegroundColor Gray
    Write-Host "    .\nemesis-manager.ps1 restart n8n" -ForegroundColor Gray
    Write-Host "    .\nemesis-manager.ps1 backup weekly" -ForegroundColor Gray
    Write-Host "    .\nemesis-manager.ps1 shell postgres" -ForegroundColor Gray
    Write-Host ""
}

function Start-Services {
    param([string]$ServiceName = "all")

    Write-Banner
    Write-Status "Démarrage des services..." "Info"

    if ($ServiceName -eq "all") {
        Invoke-DockerCompose @("up", "-d")
    } else {
        $container = Get-ContainerName $ServiceName
        Invoke-DockerCompose @("up", "-d", $ServiceName)
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Status "Services démarrés avec succès" "Success"
    } else {
        Write-Status "Erreur lors du démarrage" "Error"
    }
}

function Stop-Services {
    param([string]$ServiceName = "all")

    Write-Banner
    Write-Status "Arrêt des services..." "Info"

    if ($ServiceName -eq "all") {
        Invoke-DockerCompose @("down")
    } else {
        $container = Get-ContainerName $ServiceName
        docker stop $container 2>$null
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Status "Services arrêtés" "Success"
    } else {
        Write-Status "Erreur lors de l'arrêt" "Error"
    }
}

function Restart-Services {
    param([string]$ServiceName = "all")

    Write-Banner
    Write-Status "Redémarrage des services..." "Info"

    if ($ServiceName -eq "all") {
        Invoke-DockerCompose @("restart")
    } else {
        $container = Get-ContainerName $ServiceName
        docker restart $container
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Status "Services redémarrés" "Success"
    } else {
        Write-Status "Erreur lors du redémarrage" "Error"
    }
}

function Show-Status {
    Write-Banner
    Write-Host "  État des conteneurs NEMESIS:" -ForegroundColor Yellow
    Write-Host ""

    $containers = docker ps -a --filter "name=nemesis-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>$null

    if ($containers) {
        # Header
        Write-Host "  ┌────────────────────┬─────────────────────────┬──────────────────────┐" -ForegroundColor Gray
        Write-Host "  │ SERVICE            │ STATUS                  │ PORTS                │" -ForegroundColor Gray
        Write-Host "  ├────────────────────┼─────────────────────────┼──────────────────────┤" -ForegroundColor Gray

        docker ps -a --filter "name=nemesis-" --format "{{.Names}}|{{.Status}}|{{.Ports}}" 2>$null | ForEach-Object {
            $parts = $_ -split '\|'
            $name = $parts[0].Replace("nemesis-", "").PadRight(18)
            $status = $parts[1].Substring(0, [Math]::Min($parts[1].Length, 23)).PadRight(23)
            $ports = if ($parts[2]) { $parts[2].Substring(0, [Math]::Min($parts[2].Length, 20)) } else { "-" }
            $ports = $ports.PadRight(20)

            $statusColor = if ($parts[1] -like "*Up*") { "Green" } elseif ($parts[1] -like "*Exited*") { "Red" } else { "Yellow" }

            Write-Host "  │ " -NoNewline -ForegroundColor Gray
            Write-Host $name -NoNewline -ForegroundColor White
            Write-Host "│ " -NoNewline -ForegroundColor Gray
            Write-Host $status -NoNewline -ForegroundColor $statusColor
            Write-Host "│ " -NoNewline -ForegroundColor Gray
            Write-Host $ports -NoNewline -ForegroundColor Cyan
            Write-Host "│" -ForegroundColor Gray
        }

        Write-Host "  └────────────────────┴─────────────────────────┴──────────────────────┘" -ForegroundColor Gray
    } else {
        Write-Status "Aucun conteneur NEMESIS trouvé" "Warning"
    }
    Write-Host ""
}

function Show-Health {
    Write-Banner
    Write-Host "  Vérification de santé:" -ForegroundColor Yellow
    Write-Host ""

    $services = @(
        @{ Name = "Homepage (Dashboard)"; Url = "http://localhost:80"; Container = "nemesis-cockpit" },
        @{ Name = "Open WebUI (Chat IA)"; Url = "http://localhost:3001"; Container = "nemesis-brain" },
        @{ Name = "Ollama (LLM)"; Url = "http://localhost:11434/api/tags"; Container = "nemesis-ollama" },
        @{ Name = "N8N (Automation)"; Url = "http://localhost:5678"; Container = "nemesis-n8n" },
        @{ Name = "Portainer (Docker)"; Url = "http://localhost:9000"; Container = "nemesis-portainer" },
        @{ Name = "PostgreSQL"; Url = $null; Container = "nemesis-postgres" },
        @{ Name = "Prometheus"; Url = "http://localhost:9090"; Container = "nemesis-prometheus" },
        @{ Name = "Grafana"; Url = "http://localhost:3000"; Container = "nemesis-grafana" }
    )

    foreach ($svc in $services) {
        $containerStatus = docker inspect --format='{{.State.Status}}' $svc.Container 2>$null

        if ($containerStatus -eq "running") {
            if ($svc.Url) {
                try {
                    $response = Invoke-WebRequest -Uri $svc.Url -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
                    Write-Host "  ✅ $($svc.Name)" -ForegroundColor Green -NoNewline
                    Write-Host " - HTTP $($response.StatusCode)" -ForegroundColor Gray
                } catch {
                    Write-Host "  ⚠️  $($svc.Name)" -ForegroundColor Yellow -NoNewline
                    Write-Host " - Running but not responding" -ForegroundColor Gray
                }
            } else {
                Write-Host "  ✅ $($svc.Name)" -ForegroundColor Green -NoNewline
                Write-Host " - Running" -ForegroundColor Gray
            }
        } elseif ($containerStatus) {
            Write-Host "  ❌ $($svc.Name)" -ForegroundColor Red -NoNewline
            Write-Host " - $containerStatus" -ForegroundColor Gray
        } else {
            Write-Host "  ⬜ $($svc.Name)" -ForegroundColor DarkGray -NoNewline
            Write-Host " - Not deployed" -ForegroundColor DarkGray
        }
    }
    Write-Host ""
}

function Show-Stats {
    Write-Banner
    Write-Host "  Statistiques des ressources:" -ForegroundColor Yellow
    Write-Host ""

    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" --filter "name=nemesis-"
    Write-Host ""
}

function Show-Logs {
    param([string]$ServiceName = "all")

    Write-Banner

    if ($ServiceName -eq "all") {
        Write-Status "Logs de tous les services (Ctrl+C pour quitter):" "Info"
        Invoke-DockerCompose @("logs", "-f", "--tail=50")
    } else {
        $container = Get-ContainerName $ServiceName
        Write-Status "Logs de $ServiceName (Ctrl+C pour quitter):" "Info"
        docker logs -f --tail 100 $container
    }
}

function Open-Shell {
    param([string]$ServiceName)

    if (-not $ServiceName -or $ServiceName -eq "all") {
        Write-Status "Veuillez spécifier un service: .\nemesis-manager.ps1 shell <service>" "Error"
        return
    }

    $container = Get-ContainerName $ServiceName
    Write-Status "Connexion au conteneur $container..." "Info"

    # Déterminer le shell disponible
    $shell = docker exec $container which bash 2>$null
    if (-not $shell) { $shell = "/bin/sh" } else { $shell = "/bin/bash" }

    docker exec -it $container $shell
}

function Update-Images {
    Write-Banner
    Write-Status "Mise à jour des images Docker..." "Info"

    # Pull des nouvelles images
    Invoke-DockerCompose @("pull")

    # Recréer les conteneurs avec les nouvelles images
    Write-Status "Redémarrage avec les nouvelles images..." "Info"
    Invoke-DockerCompose @("up", "-d", "--force-recreate")

    if ($LASTEXITCODE -eq 0) {
        Write-Status "Mise à jour terminée" "Success"
    } else {
        Write-Status "Erreur lors de la mise à jour" "Error"
    }
}

function Pull-Images {
    Write-Banner
    Write-Status "Téléchargement des dernières images..." "Info"
    Invoke-DockerCompose @("pull")

    if ($LASTEXITCODE -eq 0) {
        Write-Status "Images téléchargées" "Success"
    }
}

function Backup-Data {
    param([string]$Name = "")

    Write-Banner

    if (-not $Name) {
        $Name = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    }

    $backupPath = "$($Script:Config.BackupDir)\$Name"

    Write-Status "Création du backup: $Name" "Info"

    # Créer le dossier de backup
    New-Item -ItemType Directory -Force -Path $backupPath | Out-Null

    # Arrêter les services pour un backup cohérent
    Write-Status "Pause des services pour backup cohérent..." "Warning"

    # Backup PostgreSQL
    Write-Status "Backup PostgreSQL..." "Info"
    docker exec nemesis-postgres pg_dumpall -U nemesis > "$backupPath\postgres_dump.sql" 2>$null

    # Backup des volumes Docker
    Write-Status "Backup des volumes Docker..." "Info"

    $volumes = @("postgres_data", "n8n_data", "ollama_data", "open-webui_data", "portainer_data")

    foreach ($vol in $volumes) {
        $volName = "nemesis_$vol"
        $tarFile = "$backupPath\$vol.tar"

        docker run --rm -v "${volName}:/data" -v "${backupPath}:/backup" alpine tar cvf "/backup/$vol.tar" -C /data . 2>$null | Out-Null

        if (Test-Path $tarFile) {
            Write-Host "    ✅ $vol" -ForegroundColor Green
        }
    }

    # Backup des fichiers de config
    Write-Status "Backup des configurations..." "Info"
    Copy-Item -Path "$($Script:Config.NemesisHome)\config" -Destination "$backupPath\config" -Recurse -Force
    Copy-Item -Path "$($Script:Config.NemesisHome)\.env" -Destination "$backupPath\.env" -Force
    Copy-Item -Path "$($Script:Config.NemesisHome)\docker-compose.yml" -Destination "$backupPath\docker-compose.yml" -Force

    # Créer un fichier manifest
    $manifest = @{
        Date       = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Name       = $Name
        Volumes    = $volumes
        Version    = "5.0"
    } | ConvertTo-Json

    Set-Content -Path "$backupPath\manifest.json" -Value $manifest

    Write-Host ""
    Write-Status "Backup créé: $backupPath" "Success"

    # Afficher la taille
    $size = (Get-ChildItem $backupPath -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "    Taille: $([math]::Round($size, 2)) MB" -ForegroundColor Gray
}

function Restore-Data {
    param([string]$Name)

    Write-Banner

    if (-not $Name) {
        Write-Status "Veuillez spécifier le nom du backup" "Error"
        Write-Host ""
        Write-Host "  Backups disponibles:" -ForegroundColor Yellow

        Get-ChildItem $Script:Config.BackupDir -Directory | ForEach-Object {
            Write-Host "    - $($_.Name)" -ForegroundColor Gray
        }
        return
    }

    $backupPath = "$($Script:Config.BackupDir)\$Name"

    if (-not (Test-Path $backupPath)) {
        Write-Status "Backup non trouvé: $Name" "Error"
        return
    }

    Write-Status "Restauration du backup: $Name" "Warning"
    Write-Host ""

    $confirm = Read-Host "  ⚠️  Cette action va ÉCRASER les données actuelles. Continuer? (oui/non)"

    if ($confirm -ne "oui") {
        Write-Status "Restauration annulée" "Info"
        return
    }

    # Arrêter les services
    Write-Status "Arrêt des services..." "Info"
    Invoke-DockerCompose @("down")

    # Restaurer PostgreSQL
    if (Test-Path "$backupPath\postgres_dump.sql") {
        Write-Status "Restauration PostgreSQL..." "Info"
        Invoke-DockerCompose @("up", "-d", "postgres")
        Start-Sleep -Seconds 10
        Get-Content "$backupPath\postgres_dump.sql" | docker exec -i nemesis-postgres psql -U nemesis
    }

    # Restaurer les volumes
    Write-Status "Restauration des volumes..." "Info"
    $volumes = @("postgres_data", "n8n_data", "ollama_data", "open-webui_data", "portainer_data")

    foreach ($vol in $volumes) {
        $tarFile = "$backupPath\$vol.tar"
        $volName = "nemesis_$vol"

        if (Test-Path $tarFile) {
            # Supprimer l'ancien volume et recréer
            docker volume rm $volName 2>$null
            docker volume create $volName | Out-Null

            docker run --rm -v "${volName}:/data" -v "${backupPath}:/backup" alpine tar xvf "/backup/$vol.tar" -C /data 2>$null | Out-Null
            Write-Host "    ✅ $vol" -ForegroundColor Green
        }
    }

    # Restaurer les configs
    if (Test-Path "$backupPath\config") {
        Write-Status "Restauration des configurations..." "Info"
        Copy-Item -Path "$backupPath\config\*" -Destination "$($Script:Config.NemesisHome)\config" -Recurse -Force
    }

    # Redémarrer les services
    Write-Status "Redémarrage des services..." "Info"
    Invoke-DockerCompose @("up", "-d")

    Write-Host ""
    Write-Status "Restauration terminée" "Success"
}

function Clean-System {
    Write-Banner
    Write-Status "Nettoyage du système Docker..." "Info"
    Write-Host ""

    # Images non utilisées
    Write-Host "  Suppression des images non utilisées..." -ForegroundColor Gray
    docker image prune -f

    # Conteneurs arrêtés
    Write-Host "  Suppression des conteneurs arrêtés..." -ForegroundColor Gray
    docker container prune -f

    # Volumes non utilisés (attention!)
    Write-Host "  Suppression des volumes orphelins..." -ForegroundColor Gray
    docker volume prune -f

    # Networks
    Write-Host "  Suppression des réseaux inutilisés..." -ForegroundColor Gray
    docker network prune -f

    # Build cache
    Write-Host "  Nettoyage du cache de build..." -ForegroundColor Gray
    docker builder prune -f

    Write-Host ""
    Write-Status "Nettoyage terminé" "Success"

    # Afficher l'espace récupéré
    docker system df
}

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ POINT D'ENTRÉE                                                             ║
# ╚════════════════════════════════════════════════════════════════════════════╝

# Vérifier Docker
if (-not (Test-DockerRunning)) {
    Write-Status "Docker n'est pas en cours d'exécution" "Error"
    exit 1
}

# Vérifier que NEMESIS est installé
if (-not (Test-Path $Script:Config.NemesisHome)) {
    Write-Status "NEMESIS n'est pas installé. Lancez d'abord nemesis-install.ps1" "Error"
    exit 1
}

# Créer le dossier de backup si nécessaire
if (-not (Test-Path $Script:Config.BackupDir)) {
    New-Item -ItemType Directory -Force -Path $Script:Config.BackupDir | Out-Null
}

# Exécuter l'action demandée
switch ($Action) {
    "start"   { Start-Services -ServiceName $Service }
    "stop"    { Stop-Services -ServiceName $Service }
    "restart" { Restart-Services -ServiceName $Service }
    "status"  { Show-Status }
    "health"  { Show-Health }
    "stats"   { Show-Stats }
    "logs"    { Show-Logs -ServiceName $Service }
    "shell"   { Open-Shell -ServiceName $Service }
    "pull"    { Pull-Images }
    "update"  { Update-Images }
    "backup"  { Backup-Data -Name $BackupName }
    "restore" { Restore-Data -Name $BackupName }
    "clean"   { Clean-System }
    "help"    { Show-Help }
    default   { Show-Help }
}
