#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    NEMESIS V3.1 - Installation automatisée de la stack IA locale
.DESCRIPTION
    Déploie une infrastructure complète avec Docker:
    - Open WebUI (interface chat IA)
    - Ollama (moteur LLM)
    - N8N (automatisation)
    - PostgreSQL (base de données)
    - Portainer (gestion Docker)
    - Homepage (dashboard)
.NOTES
    Auteur: NEMESIS Project
    Version: 3.1 STABLE
#>

[CmdletBinding()]
param(
    [switch]$SkipDockerInstall,
    [switch]$SkipNodeInstall,
    [switch]$Force,
    [string]$Model = "llama3.2"
)

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ 1. CONFIGURATION & FONCTIONS UTILITAIRES                                   ║
# ╚════════════════════════════════════════════════════════════════════════════╝

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"  # Accélère les téléchargements

# Configuration globale
$Script:Config = @{
    UserHome      = $env:USERPROFILE
    NemesisHome   = "$env:USERPROFILE\Nemesis"
    ConfigDir     = "$env:USERPROFILE\Nemesis\config"
    DataDir       = "$env:USERPROFILE\Nemesis\data"
    LogFile       = "$env:USERPROFILE\Nemesis\nemesis-install.log"
    DockerTimeout = 90  # secondes
    BaseUrl       = "localhost"
    BrainUrl      = "localhost"
}

function Write-Log {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR", "SUCCESS")][string]$Level = "INFO"
    )

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"

    # Couleurs selon le niveau
    $colors = @{
        "INFO"    = "Cyan"
        "WARN"    = "Yellow"
        "ERROR"   = "Red"
        "SUCCESS" = "Green"
    }

    $prefix = switch ($Level) {
        "INFO"    { "ℹ️ " }
        "WARN"    { "⚠️ " }
        "ERROR"   { "❌" }
        "SUCCESS" { "✅" }
    }

    Write-Host "$prefix $Message" -ForegroundColor $colors[$Level]

    # Écriture dans le fichier log
    if (Test-Path (Split-Path $Script:Config.LogFile -Parent)) {
        Add-Content -Path $Script:Config.LogFile -Value $logEntry -ErrorAction SilentlyContinue
    }
}

function Get-RandomString {
    param([int]$Length = 16)
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    return -join (1..$Length | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

function Test-CommandExists {
    param([string]$Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Test-DockerRunning {
    try {
        $null = docker info 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Wait-ForDocker {
    param([int]$TimeoutSeconds = 90)

    $elapsed = 0
    $interval = 3

    Write-Host "   Attente de Docker " -NoNewline -ForegroundColor Gray

    while (-not (Test-DockerRunning) -and $elapsed -lt $TimeoutSeconds) {
        Write-Host "." -NoNewline -ForegroundColor Gray
        Start-Sleep -Seconds $interval
        $elapsed += $interval
    }

    Write-Host ""

    if ($elapsed -ge $TimeoutSeconds) {
        throw "Timeout: Docker n'a pas démarré après $TimeoutSeconds secondes"
    }

    return $true
}

function Pause-And-Exit {
    param([int]$ExitCode = 0)

    Write-Host ""
    Write-Host "Appuyez sur une touche pour quitter..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit $ExitCode
}

function Show-Banner {
    Clear-Host
    Write-Host @"

      ███╗   ███╗███████╗███╗   ███╗███████╗███████╗██╗███████╗
      ████╗ ████║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝
      ██╔████╔██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗
      ██║╚██╔╝██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║
      ██║ ╚═╝ ██║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║
      ╚═╝     ╚═╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝
                    V3.1 STABLE - Infrastructure IA

"@ -ForegroundColor Magenta
}

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ 2. INSTALLATION DES DÉPENDANCES                                            ║
# ╚════════════════════════════════════════════════════════════════════════════╝

function Install-Dependencies {
    Write-Log "Vérification des dépendances..." -Level INFO

    # Docker
    if (-not $SkipDockerInstall -and -not (Test-CommandExists "docker")) {
        Write-Log "Installation de Docker Desktop..." -Level INFO
        try {
            $wingetArgs = @(
                "install", "Docker.DockerDesktop",
                "--accept-source-agreements",
                "--accept-package-agreements",
                "--disable-interactivity",
                "--silent"
            )
            $process = Start-Process -FilePath "winget" -ArgumentList $wingetArgs -Wait -PassThru -NoNewWindow
            if ($process.ExitCode -ne 0) {
                Write-Log "Winget a retourné le code $($process.ExitCode). Vérifiez l'installation manuellement." -Level WARN
            }
        } catch {
            Write-Log "Impossible d'installer Docker automatiquement: $_" -Level WARN
            Write-Log "Téléchargez Docker Desktop depuis https://docker.com/products/docker-desktop" -Level INFO
        }
    } else {
        Write-Log "Docker est déjà installé" -Level SUCCESS
    }

    # Node.js (optionnel, pour extensions futures)
    if (-not $SkipNodeInstall -and -not (Test-CommandExists "node")) {
        Write-Log "Installation de Node.js LTS..." -Level INFO
        try {
            $wingetArgs = @(
                "install", "OpenJS.NodeJS.LTS",
                "--accept-source-agreements",
                "--accept-package-agreements",
                "--disable-interactivity",
                "--silent"
            )
            Start-Process -FilePath "winget" -ArgumentList $wingetArgs -Wait -NoNewWindow
        } catch {
            Write-Log "Installation Node.js échouée (non critique)" -Level WARN
        }
    }
}

function Start-DockerDesktop {
    Write-Log "Vérification de Docker Desktop..." -Level INFO

    # Vérifier si Docker est déjà en cours d'exécution
    if (Test-DockerRunning) {
        Write-Log "Docker est déjà opérationnel" -Level SUCCESS
        return
    }

    # Trouver et lancer Docker Desktop
    $dockerPaths = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
    )

    $dockerExe = $dockerPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $dockerExe) {
        throw "Docker Desktop introuvable. Veuillez l'installer depuis https://docker.com"
    }

    # Vérifier si le processus tourne déjà (même si docker info échoue)
    $dockerProcess = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
    if (-not $dockerProcess) {
        Write-Log "Démarrage de Docker Desktop..." -Level INFO
        Start-Process -FilePath $dockerExe
    }

    # Attendre que Docker soit prêt
    Wait-ForDocker -TimeoutSeconds $Script:Config.DockerTimeout
    Write-Log "Docker est prêt" -Level SUCCESS
}

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ 3. CONFIGURATION DNS                                                       ║
# ╚════════════════════════════════════════════════════════════════════════════╝

function Set-DnsConfiguration {
    Write-Log "Configuration DNS..." -Level INFO

    $hostsPath = "$env:windir\System32\drivers\etc\hosts"
    $entries = @(
        "127.0.0.1       nemesis.ai",
        "127.0.0.1       brain.nemesis.ai"
    )

    try {
        # Forcer la libération du fichier hosts
        [GC]::Collect()
        [GC]::WaitForPendingFinalizers()
        Start-Sleep -Milliseconds 500

        $hostsContent = Get-Content $hostsPath -Raw -ErrorAction Stop
        $modified = $false

        foreach ($entry in $entries) {
            $domain = ($entry -split '\s+')[-1]
            if ($hostsContent -notmatch [regex]::Escape($domain)) {
                Add-Content -Path $hostsPath -Value $entry -ErrorAction Stop
                $modified = $true
            }
        }

        if ($modified) {
            Write-Log "DNS configuré: nemesis.ai et brain.nemesis.ai" -Level SUCCESS
        } else {
            Write-Log "Configuration DNS déjà présente" -Level SUCCESS
        }

        $Script:Config.BaseUrl = "nemesis.ai"
        $Script:Config.BrainUrl = "brain.nemesis.ai"

        # Flush DNS cache
        $null = ipconfig /flushdns 2>&1

    } catch {
        Write-Log "Impossible de modifier le fichier hosts (protégé par antivirus?)" -Level WARN
        Write-Log "Mode localhost activé - les URLs personnalisées ne seront pas disponibles" -Level WARN
        $Script:Config.BaseUrl = "localhost"
        $Script:Config.BrainUrl = "localhost"
    }
}

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ 4. GÉNÉRATION DE LA CONFIGURATION                                          ║
# ╚════════════════════════════════════════════════════════════════════════════╝

function Initialize-Directories {
    Write-Log "Création de l'arborescence..." -Level INFO

    $directories = @(
        $Script:Config.NemesisHome,
        "$($Script:Config.ConfigDir)\homepage",
        "$($Script:Config.ConfigDir)\prometheus",
        "$($Script:Config.DataDir)\n8n",
        "$($Script:Config.DataDir)\postgres",
        "$($Script:Config.DataDir)\ollama",
        "$($Script:Config.DataDir)\open-webui",
        "$($Script:Config.DataDir)\portainer"
    )

    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
        }
    }

    Write-Log "Arborescence créée dans $($Script:Config.NemesisHome)" -Level SUCCESS
}

function Initialize-Environment {
    Write-Log "Configuration des variables d'environnement..." -Level INFO

    $envFile = "$($Script:Config.NemesisHome)\.env"

    if (-not (Test-Path $envFile) -or $Force) {
        $secrets = @{
            COMPOSE_PROJECT_NAME = "nemesis"
            DB_PASSWORD          = Get-RandomString -Length 20
            N8N_PASSWORD         = Get-RandomString -Length 16
            N8N_ENCRYPTION_KEY   = Get-RandomString -Length 32
            POSTGRES_USER        = "nemesis"
            POSTGRES_DB          = "nemesis"
        }

        $envContent = $secrets.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }
        Set-Content -Path $envFile -Value ($envContent -join "`n") -Encoding UTF8 -NoNewline

        # Stocker les secrets pour l'affichage final
        $Script:Secrets = $secrets

        Write-Log "Secrets générés et sauvegardés" -Level SUCCESS
    } else {
        # Charger les secrets existants
        $Script:Secrets = @{}
        Get-Content $envFile | ForEach-Object {
            if ($_ -match "^([^#=]+)=(.*)$") {
                $Script:Secrets[$matches[1].Trim()] = $matches[2].Trim()
            }
        }

        # Ajouter COMPOSE_PROJECT_NAME si manquant
        if (-not $Script:Secrets.ContainsKey("COMPOSE_PROJECT_NAME")) {
            Add-Content -Path $envFile -Value "`nCOMPOSE_PROJECT_NAME=nemesis"
            $Script:Secrets["COMPOSE_PROJECT_NAME"] = "nemesis"
        }

        Write-Log "Secrets existants chargés" -Level SUCCESS
    }

    # Exporter vers l'environnement du processus
    foreach ($key in $Script:Secrets.Keys) {
        [Environment]::SetEnvironmentVariable($key, $Script:Secrets[$key], "Process")
    }
}

function Get-GpuConfiguration {
    Write-Log "Détection GPU..." -Level INFO

    $gpuConfig = ""
    $gpus = Get-CimInstance Win32_VideoController

    # Détection NVIDIA
    $nvidia = $gpus | Where-Object { $_.Name -like "*NVIDIA*" }
    if ($nvidia) {
        Write-Log "GPU NVIDIA détecté: $($nvidia.Name)" -Level SUCCESS
        $gpuConfig = @"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
"@
    }
    # Détection AMD (ROCm) - support expérimental
    elseif ($gpus | Where-Object { $_.Name -like "*AMD*" -or $_.Name -like "*Radeon*" }) {
        Write-Log "GPU AMD détecté (support ROCm expérimental)" -Level WARN
        # ROCm nécessite une configuration différente sous Windows
    }
    else {
        Write-Log "Aucun GPU dédié détecté - utilisation du CPU" -Level INFO
    }

    return $gpuConfig
}

function New-DockerCompose {
    Write-Log "Génération du docker-compose.yml..." -Level INFO

    $gpuConfig = Get-GpuConfiguration
    $dbPassword = $Script:Secrets["DB_PASSWORD"]
    $n8nPassword = $Script:Secrets["N8N_PASSWORD"]
    $encryptionKey = $Script:Secrets["N8N_ENCRYPTION_KEY"]

    $compose = @"
version: '3.8'

networks:
  nemesis-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16

volumes:
  postgres_data:
  n8n_data:
  ollama_data:
  open-webui_data:
  portainer_data:

services:
  # Dashboard principal
  homepage:
    image: ghcr.io/gethomepage/homepage:latest
    container_name: nemesis-cockpit
    volumes:
      - ./config/homepage:/app/config:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    ports:
      - "80:3000"
    networks:
      - nemesis-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Interface Chat IA
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    container_name: nemesis-brain
    volumes:
      - open-webui_data:/app/backend/data
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
      - WEBUI_AUTH=false
      - ENABLE_SIGNUP=true
    ports:
      - "3001:8080"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    networks:
      - nemesis-net
    depends_on:
      ollama:
        condition: service_started
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Moteur LLM
  ollama:
    image: ollama/ollama:latest
    container_name: nemesis-ollama
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"
    networks:
      - nemesis-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 30s
      timeout: 10s
      retries: 3
$gpuConfig

  # Automatisation
  n8n:
    image: n8nio/n8n:latest
    container_name: nemesis-n8n
    ports:
      - "5678:5678"
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=nemesis
      - DB_POSTGRESDB_PASSWORD=$dbPassword
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=nemesis
      - N8N_BASIC_AUTH_PASSWORD=$n8nPassword
      - N8N_ENCRYPTION_KEY=$encryptionKey
      - GENERIC_TIMEZONE=Europe/Paris
      - TZ=Europe/Paris
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - nemesis-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:5678/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Base de données
  postgres:
    image: postgres:16-alpine
    container_name: nemesis-postgres
    environment:
      POSTGRES_USER: nemesis
      POSTGRES_PASSWORD: $dbPassword
      POSTGRES_DB: nemesis
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./config/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - nemesis-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nemesis -d nemesis"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # Gestion Docker
  portainer:
    image: portainer/portainer-ce:latest
    container_name: nemesis-portainer
    command: -H unix:///var/run/docker.sock
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - portainer_data:/data
    ports:
      - "9000:9000"
    networks:
      - nemesis-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:9000/api/status"]
      interval: 30s
      timeout: 10s
      retries: 3
"@

    Set-Content -Path "$($Script:Config.NemesisHome)\docker-compose.yml" -Value $compose -Encoding UTF8
    Write-Log "docker-compose.yml généré" -Level SUCCESS
}

function New-PostgresInit {
    Write-Log "Génération du script d'initialisation PostgreSQL..." -Level INFO

    $initSql = @"
-- Création de la base n8n si elle n'existe pas
SELECT 'CREATE DATABASE n8n OWNER nemesis'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'n8n')\gexec

-- Permissions
GRANT ALL PRIVILEGES ON DATABASE n8n TO nemesis;
"@

    $postgresConfigDir = "$($Script:Config.ConfigDir)\postgres"
    if (-not (Test-Path $postgresConfigDir)) {
        New-Item -ItemType Directory -Force -Path $postgresConfigDir | Out-Null
    }

    Set-Content -Path "$postgresConfigDir\init.sql" -Value $initSql -Encoding UTF8
}

function New-HomepageConfig {
    Write-Log "Génération de la configuration Homepage..." -Level INFO

    $baseUrl = $Script:Config.BaseUrl
    $brainUrl = $Script:Config.BrainUrl

    # Services
    $services = @"
---
- Cerveau IA:
    - Open WebUI:
        icon: si-openai
        href: http://${brainUrl}:3001
        description: Interface de chat IA
        server: my-docker
        container: nemesis-brain
    - Ollama:
        icon: si-ollama
        href: http://${baseUrl}:11434
        description: Moteur LLM local
        server: my-docker
        container: nemesis-ollama

- Automatisation:
    - N8N:
        icon: si-n8n
        href: http://${baseUrl}:5678
        description: Workflows automatisés
        server: my-docker
        container: nemesis-n8n

- Infrastructure:
    - Portainer:
        icon: si-portainer
        href: http://${baseUrl}:9000
        description: Gestion des conteneurs
        server: my-docker
        container: nemesis-portainer
    - PostgreSQL:
        icon: si-postgresql
        description: Base de données
        server: my-docker
        container: nemesis-postgres
"@

    # Settings
    $settings = @"
---
title: NEMESIS Control Center
theme: dark
color: purple
background:
  image: https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920
  opacity: 20
headerStyle: clean
layout:
  Cerveau IA:
    style: row
    columns: 2
  Automatisation:
    style: row
    columns: 1
  Infrastructure:
    style: row
    columns: 2
"@

    # Widgets
    $widgets = @"
---
- resources:
    label: Système
    cpu: true
    memory: true
    disk: /

- datetime:
    text_size: xl
    format:
      dateStyle: long
      timeStyle: short
"@

    # Docker integration
    $docker = @"
---
my-docker:
  socket: /var/run/docker.sock
"@

    # Bookmarks (optionnel)
    $bookmarks = @"
---
- Documentation:
    - Ollama:
        - icon: si-ollama
          href: https://ollama.ai/library
    - N8N:
        - icon: si-n8n
          href: https://docs.n8n.io
    - Open WebUI:
        - icon: si-openai
          href: https://docs.openwebui.com
"@

    $homepageDir = "$($Script:Config.ConfigDir)\homepage"

    Set-Content -Path "$homepageDir\services.yaml" -Value $services -Encoding UTF8
    Set-Content -Path "$homepageDir\settings.yaml" -Value $settings -Encoding UTF8
    Set-Content -Path "$homepageDir\widgets.yaml" -Value $widgets -Encoding UTF8
    Set-Content -Path "$homepageDir\docker.yaml" -Value $docker -Encoding UTF8
    Set-Content -Path "$homepageDir\bookmarks.yaml" -Value $bookmarks -Encoding UTF8

    Write-Log "Configuration Homepage générée" -Level SUCCESS
}

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ 5. DÉPLOIEMENT                                                             ║
# ╚════════════════════════════════════════════════════════════════════════════╝

function Start-Deployment {
    Write-Log "Démarrage du déploiement..." -Level INFO

    Push-Location $Script:Config.NemesisHome

    try {
        # Mode tolérant pour les warnings Docker (stderr)
        $oldErrorAction = $ErrorActionPreference
        $ErrorActionPreference = "Continue"

        Write-Host ""
        Write-Host "   🚀 Lancement de la Matrice NEMESIS..." -ForegroundColor Magenta
        Write-Host ""

        # Pull des images (peut prendre du temps)
        Write-Log "Téléchargement des images Docker (patience...)..." -Level INFO
        docker compose pull 2>&1 | ForEach-Object {
            if ($_ -match "Pulling|Downloaded|Pull complete") {
                Write-Host "   $_" -ForegroundColor Gray
            }
        }

        # Démarrage des conteneurs
        Write-Log "Démarrage des services..." -Level INFO
        $output = docker compose up -d 2>&1

        $ErrorActionPreference = $oldErrorAction

        if ($LASTEXITCODE -ne 0) {
            Write-Log "Sortie Docker: $output" -Level ERROR
            throw "Docker Compose a échoué (code: $LASTEXITCODE)"
        }

        Write-Log "Services démarrés avec succès" -Level SUCCESS

    } finally {
        Pop-Location
    }
}

function Start-ModelDownload {
    param([string]$ModelName = "llama3.2")

    Write-Log "Téléchargement du modèle $ModelName en arrière-plan..." -Level INFO

    # Attendre qu'Ollama soit prêt
    $retries = 0
    $maxRetries = 30

    while ($retries -lt $maxRetries) {
        try {
            $response = docker exec nemesis-ollama curl -s http://localhost:11434/api/tags 2>&1
            if ($LASTEXITCODE -eq 0) { break }
        } catch { }

        Start-Sleep -Seconds 2
        $retries++
    }

    if ($retries -ge $maxRetries) {
        Write-Log "Ollama n'est pas prêt - téléchargement du modèle différé" -Level WARN
        return
    }

    # Lancer le téléchargement en arrière-plan
    Start-Job -Name "OllamaModelDownload" -ScriptBlock {
        param($model)
        docker exec nemesis-ollama ollama pull $model
    } -ArgumentList $ModelName | Out-Null

    Write-Log "Le modèle $ModelName est en cours de téléchargement" -Level INFO
    Write-Log "Vérifiez la progression avec: docker exec nemesis-ollama ollama list" -Level INFO
}

function New-DesktopShortcut {
    Write-Log "Création du raccourci bureau..." -Level INFO

    $shortcutPath = "$([Environment]::GetFolderPath('Desktop'))\NEMESIS.url"
    $baseUrl = $Script:Config.BaseUrl

    $shortcutContent = @"
[InternetShortcut]
URL=http://$baseUrl
IconIndex=0
IconFile=%SystemRoot%\System32\shell32.dll,13
"@

    Set-Content -Path $shortcutPath -Value $shortcutContent -Encoding ASCII
    Write-Log "Raccourci créé sur le bureau" -Level SUCCESS
}

function Show-Summary {
    $baseUrl = $Script:Config.BaseUrl
    $brainUrl = $Script:Config.BrainUrl
    $n8nPassword = $Script:Secrets["N8N_PASSWORD"]

    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                  🔱 NEMESIS EST OPÉRATIONNEL 🔱                          ║" -ForegroundColor Green
    Write-Host "╠══════════════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
    Write-Host "║                                                                          ║" -ForegroundColor Green
    Write-Host "║   📊 Dashboard    : " -NoNewline -ForegroundColor Green
    Write-Host ("http://{0}" -f $baseUrl).PadRight(45) -NoNewline -ForegroundColor White
    Write-Host "║" -ForegroundColor Green
    Write-Host "║   🧠 Chat IA      : " -NoNewline -ForegroundColor Green
    Write-Host ("http://{0}:3001" -f $brainUrl).PadRight(45) -NoNewline -ForegroundColor White
    Write-Host "║" -ForegroundColor Green
    Write-Host "║   ⚡ N8N          : " -NoNewline -ForegroundColor Green
    Write-Host ("http://{0}:5678" -f $baseUrl).PadRight(45) -NoNewline -ForegroundColor White
    Write-Host "║" -ForegroundColor Green
    Write-Host "║   🐳 Portainer    : " -NoNewline -ForegroundColor Green
    Write-Host ("http://{0}:9000" -f $baseUrl).PadRight(45) -NoNewline -ForegroundColor White
    Write-Host "║" -ForegroundColor Green
    Write-Host "║                                                                          ║" -ForegroundColor Green
    Write-Host "╠══════════════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
    Write-Host "║   🔐 Identifiants N8N:                                                   ║" -ForegroundColor Green
    Write-Host "║      Utilisateur : nemesis                                               ║" -ForegroundColor White
    Write-Host "║      Mot de passe: " -NoNewline -ForegroundColor White
    Write-Host $n8nPassword.PadRight(46) -NoNewline -ForegroundColor Yellow
    Write-Host "║" -ForegroundColor Green
    Write-Host "║                                                                          ║" -ForegroundColor Green
    Write-Host "╠══════════════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
    Write-Host "║   📁 Dossier     : $($Script:Config.NemesisHome.PadRight(45))  ║" -ForegroundColor Gray
    Write-Host "║   📋 Logs        : $($Script:Config.LogFile.PadRight(45))  ║" -ForegroundColor Gray
    Write-Host "╚══════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "   💡 Commandes utiles:" -ForegroundColor Cyan
    Write-Host "      docker compose -f $($Script:Config.NemesisHome)\docker-compose.yml logs -f" -ForegroundColor Gray
    Write-Host "      docker compose -f $($Script:Config.NemesisHome)\docker-compose.yml restart" -ForegroundColor Gray
    Write-Host "      docker exec nemesis-ollama ollama list" -ForegroundColor Gray
    Write-Host ""
}

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ 6. POINT D'ENTRÉE PRINCIPAL                                                ║
# ╚════════════════════════════════════════════════════════════════════════════╝

function Main {
    try {
        Show-Banner

        Write-Host "   Initialisation de NEMESIS..." -ForegroundColor Gray
        Write-Host ""

        # Étapes d'installation
        Install-Dependencies
        Start-DockerDesktop
        Initialize-Directories
        Initialize-Environment
        Set-DnsConfiguration

        # Génération de la configuration
        New-DockerCompose
        New-PostgresInit
        New-HomepageConfig

        # Déploiement
        Start-Deployment
        Start-ModelDownload -ModelName $Model
        New-DesktopShortcut

        # Résumé final
        Show-Summary

        # Ouvrir le navigateur
        Start-Process "http://$($Script:Config.BaseUrl)"

        Write-Log "Installation terminée avec succès!" -Level SUCCESS

    } catch {
        Write-Host ""
        Write-Host "╔══════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Red
        Write-Host "║                         ❌ ERREUR D'INSTALLATION                         ║" -ForegroundColor Red
        Write-Host "╚══════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Red
        Write-Host ""
        Write-Log "Erreur: $($_.Exception.Message)" -Level ERROR
        Write-Host "   Ligne: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Yellow
        Write-Host "   Script: $($_.InvocationInfo.ScriptName)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   Consultez le fichier log pour plus de détails:" -ForegroundColor Gray
        Write-Host "   $($Script:Config.LogFile)" -ForegroundColor Gray
        Write-Host ""

        Pause-And-Exit -ExitCode 1
    }
}

# Exécution
Main
Pause-And-Exit -ExitCode 0
