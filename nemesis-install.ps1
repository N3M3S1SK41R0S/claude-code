#Requires -Version 5.1
<#
.SYNOPSIS
    NEMESIS OMEGA V5 - Installation automatisée de la stack IA locale
.DESCRIPTION
    - GARANTI SANS FERMETURE (Bloc Finally robuste)
    - CORRECTION WARNING DOCKER (Ignore le texte rouge non bloquant)
    - CORRECTION NOM PROJET (Force le nom Nemesis pour éviter le warning)
    - SUPPORT GPU NVIDIA & AMD (détection automatique)
    - CONFIGURATION MCP (Claude Desktop integration)
.NOTES
    Auteur: NEMESIS Project
    Version: 5.0 OMEGA FINAL
#>

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ 1. FONCTIONS UTILITAIRES                                                   ║
# ╚════════════════════════════════════════════════════════════════════════════╝

function Pause-And-Exit {
    param([int]$ExitCode = 0)

    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Gray
    Write-Host "$(if($ExitCode -eq 0){'✅ SCRIPT TERMINÉ'}else{'❌ SCRIPT INTERROMPU'})" -ForegroundColor $(if($ExitCode -eq 0){'Green'}else{'Red'})
    Write-Host "👉 Appuyez sur [ENTRÉE] pour fermer cette fenêtre..." -ForegroundColor Cyan -NoNewline
    $null = Read-Host
    exit $ExitCode
}

function Test-IsAdmin {
    $Identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $Principal = [Security.Principal.WindowsPrincipal]$Identity
    return $Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-RandomString {
    param([int]$Length = 16)
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    return -join (1..$Length | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

function Test-DockerReady {
    try {
        $null = docker info 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Write-Step {
    param([string]$Icon, [string]$Message, [string]$Color = "Cyan")
    Write-Host "$Icon $Message" -ForegroundColor $Color
}

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ 2. VÉRIFICATION ADMIN                                                      ║
# ╚════════════════════════════════════════════════════════════════════════════╝

if (-not (Test-IsAdmin)) {
    Write-Host ""
    Write-Host "⛔ ERREUR : DROITS ADMINISTRATEUR REQUIS" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Solutions :" -ForegroundColor Yellow
    Write-Host "   1. Clic-Droit sur PowerShell > Exécuter en tant qu'administrateur" -ForegroundColor White
    Write-Host "   2. Ou lancez : Start-Process powershell -Verb RunAs" -ForegroundColor White
    Write-Host ""
    Pause-And-Exit -ExitCode 1
}

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ╔════════════════════════════════════════════════════════════════════════════╗
# ║ 3. SCRIPT PRINCIPAL                                                        ║
# ╚════════════════════════════════════════════════════════════════════════════╝

Try {
    Clear-Host
    Write-Host @"

      ███╗   ███╗███████╗███╗   ███╗███████╗███████╗██╗███████╗
      ████╗ ████║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝
      ██╔████╔██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗
      ██║╚██╔╝██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║
      ██║ ╚═╝ ██║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║
      ╚═╝     ╚═╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝
                  V5 OMEGA - ANTI-CLOSE & ANTI-CRASH

"@ -ForegroundColor Magenta

    # --- VARIABLES GLOBALES ---
    $UserHome = $env:USERPROFILE
    $NemesisHome = "$UserHome\Nemesis"
    $ConfigDir = "$NemesisHome\config"
    $DataDir = "$NemesisHome\data"
    $LogFile = "$NemesisHome\install.log"

    # Fix critique : Nom du projet Docker explicite
    $env:COMPOSE_PROJECT_NAME = "nemesis"

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 1 : INSTALLATION DÉPENDANCES
    # ══════════════════════════════════════════════════════════════════════════

    if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
        Write-Step "📦" "Installation Docker Desktop..." "Yellow"
        $wingetArgs = @(
            "install", "Docker.DockerDesktop",
            "--accept-source-agreements", "--accept-package-agreements",
            "--disable-interactivity", "--silent"
        )
        Start-Process -FilePath "winget" -ArgumentList $wingetArgs -Wait -NoNewWindow
    } else {
        Write-Step "✅" "Docker déjà installé" "Green"
    }

    if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
        Write-Step "📦" "Installation Node.js LTS..." "Yellow"
        $wingetArgs = @(
            "install", "OpenJS.NodeJS.LTS",
            "--accept-source-agreements", "--accept-package-agreements",
            "--disable-interactivity", "--silent"
        )
        Start-Process -FilePath "winget" -ArgumentList $wingetArgs -Wait -NoNewWindow
    } else {
        Write-Step "✅" "Node.js déjà installé" "Green"
    }

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 2 : DÉMARRAGE DOCKER DESKTOP
    # ══════════════════════════════════════════════════════════════════════════

    if (-not (Test-DockerReady)) {
        $dockerPaths = @(
            "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
            "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
            "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
        )
        $dockerExe = $dockerPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

        if ($dockerExe) {
            Write-Step "⚡" "Démarrage Docker Desktop..." "Cyan"
            Start-Process -FilePath $dockerExe

            # Attente active avec timeout
            $timeout = 120
            $elapsed = 0
            Write-Host "   Attente de Docker " -NoNewline -ForegroundColor Gray

            while (-not (Test-DockerReady) -and $elapsed -lt $timeout) {
                Write-Host "." -NoNewline -ForegroundColor Gray
                Start-Sleep -Seconds 2
                $elapsed += 2
            }
            Write-Host ""

            if ($elapsed -ge $timeout) {
                Write-Host "⚠️  Docker lent à démarrer, on continue..." -ForegroundColor Yellow
            } else {
                Write-Step "✅" "Docker prêt" "Green"
            }
        } else {
            throw "Docker Desktop introuvable. Installez-le depuis https://docker.com"
        }
    } else {
        Write-Step "✅" "Docker déjà opérationnel" "Green"
    }

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 3 : CONFIGURATION DNS
    # ══════════════════════════════════════════════════════════════════════════

    $BaseUrl = "localhost"
    $BrainUrl = "localhost"
    $HostsPath = "$env:windir\System32\drivers\etc\hosts"

    Try {
        [GC]::Collect(); [GC]::WaitForPendingFinalizers()
        Start-Sleep -Milliseconds 300

        $HostsContent = Get-Content $HostsPath -Raw -ErrorAction Stop
        if ($HostsContent -notmatch "nemesis\.ai") {
            Add-Content -Path $HostsPath -Value "`r`n127.0.0.1       nemesis.ai" -ErrorAction Stop
            Add-Content -Path $HostsPath -Value "127.0.0.1       brain.nemesis.ai" -ErrorAction Stop
            Write-Step "✅" "DNS configuré : nemesis.ai" "Green"
        } else {
            Write-Step "✅" "DNS déjà configuré" "Green"
        }
        $BaseUrl = "nemesis.ai"
        $BrainUrl = "brain.nemesis.ai"

        # Flush DNS cache
        $null = ipconfig /flushdns 2>&1

    } Catch {
        Write-Step "⚠️" "DNS verrouillé (antivirus?) - Mode localhost" "Yellow"
    }

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 4 : CRÉATION ARBORESCENCE & SECRETS
    # ══════════════════════════════════════════════════════════════════════════

    Write-Step "📂" "Création de l'arborescence..." "Cyan"

    $Dirs = @(
        $NemesisHome,
        "$ConfigDir\homepage",
        "$ConfigDir\postgres",
        "$DataDir\n8n",
        "$DataDir\postgres",
        "$DataDir\ollama",
        "$DataDir\open-webui",
        "$DataDir\portainer"
    )
    foreach ($Dir in $Dirs) {
        New-Item -ItemType Directory -Force -Path $Dir -ErrorAction SilentlyContinue | Out-Null
    }

    # Génération des secrets
    $EnvFile = "$NemesisHome\.env"
    if (-not (Test-Path $EnvFile)) {
        $DbPassword = Get-RandomString -Length 20
        $N8nPassword = Get-RandomString -Length 16
        $EncryptionKey = Get-RandomString -Length 32

        $envContent = @"
COMPOSE_PROJECT_NAME=nemesis
DB_PASSWORD=$DbPassword
N8N_PASSWORD=$N8nPassword
N8N_ENCRYPTION_KEY=$EncryptionKey
POSTGRES_USER=nemesis
POSTGRES_DB=nemesis
"@
        Set-Content -Path $EnvFile -Value $envContent -Encoding UTF8

        $env:DB_PASSWORD = $DbPassword
        $env:N8N_PASSWORD = $N8nPassword
        $env:N8N_ENCRYPTION_KEY = $EncryptionKey

        Write-Step "🔐" "Secrets générés" "Green"
    } else {
        # Charger les secrets existants
        Get-Content $EnvFile | ForEach-Object {
            if ($_ -match "^([^#=]+)=(.*)$") {
                [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
            }
        }

        # Ajouter COMPOSE_PROJECT_NAME si manquant
        $content = Get-Content $EnvFile -Raw
        if ($content -notmatch "COMPOSE_PROJECT_NAME") {
            Add-Content -Path $EnvFile -Value "COMPOSE_PROJECT_NAME=nemesis"
        }

        Write-Step "🔐" "Secrets chargés" "Green"
    }

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 5 : DÉTECTION GPU
    # ══════════════════════════════════════════════════════════════════════════

    $GpuConfig = ""
    $gpus = Get-CimInstance Win32_VideoController

    $nvidia = $gpus | Where-Object { $_.Name -like "*NVIDIA*" }
    $amd = $gpus | Where-Object { $_.Name -like "*AMD*" -or $_.Name -like "*Radeon*" }

    if ($nvidia) {
        Write-Step "🎮" "GPU NVIDIA détecté: $($nvidia.Name)" "Green"
        $GpuConfig = @"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
"@
    } elseif ($amd) {
        Write-Step "🎮" "GPU AMD détecté (ROCm expérimental)" "Yellow"
    } else {
        Write-Step "💻" "Mode CPU (aucun GPU dédié)" "Gray"
    }

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 6 : GÉNÉRATION DOCKER-COMPOSE
    # ══════════════════════════════════════════════════════════════════════════

    Write-Step "🐳" "Génération docker-compose.yml..." "Cyan"

    $Compose = @"
version: '3.8'

networks:
  nemesis-net:
    driver: bridge

volumes:
  postgres_data:
  n8n_data:
  ollama_data:
  open-webui_data:
  portainer_data:

services:
  homepage:
    image: ghcr.io/gethomepage/homepage:latest
    container_name: nemesis-cockpit
    volumes:
      - ./config/homepage:/app/config:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    ports:
      - "80:3000"
    networks: [nemesis-net]
    restart: unless-stopped

  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    container_name: nemesis-brain
    volumes:
      - open-webui_data:/app/backend/data
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
      - WEBUI_AUTH=false
    ports:
      - "3001:8080"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    networks: [nemesis-net]
    depends_on: [ollama]
    restart: unless-stopped

  ollama:
    image: ollama/ollama:latest
    container_name: nemesis-ollama
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"
    networks: [nemesis-net]
    restart: unless-stopped
$GpuConfig

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
      - DB_POSTGRESDB_PASSWORD=$($env:DB_PASSWORD)
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=nemesis
      - N8N_BASIC_AUTH_PASSWORD=$($env:N8N_PASSWORD)
      - N8N_ENCRYPTION_KEY=$($env:N8N_ENCRYPTION_KEY)
      - GENERIC_TIMEZONE=Europe/Paris
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      postgres:
        condition: service_healthy
    networks: [nemesis-net]
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    container_name: nemesis-postgres
    environment:
      POSTGRES_USER: nemesis
      POSTGRES_PASSWORD: $($env:DB_PASSWORD)
      POSTGRES_DB: nemesis
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./config/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks: [nemesis-net]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nemesis -d nemesis"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    restart: unless-stopped

  portainer:
    image: portainer/portainer-ce:latest
    container_name: nemesis-portainer
    command: -H unix:///var/run/docker.sock
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - portainer_data:/data
    ports:
      - "9000:9000"
    networks: [nemesis-net]
    restart: unless-stopped
"@
    Set-Content -Path "$NemesisHome\docker-compose.yml" -Value $Compose -Encoding UTF8

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 7 : CONFIGURATION POSTGRES
    # ══════════════════════════════════════════════════════════════════════════

    $initSql = @"
-- Création de la base n8n
CREATE DATABASE n8n OWNER nemesis;
GRANT ALL PRIVILEGES ON DATABASE n8n TO nemesis;
"@
    Set-Content -Path "$ConfigDir\postgres\init.sql" -Value $initSql -Encoding UTF8

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 8 : CONFIGURATION HOMEPAGE
    # ══════════════════════════════════════════════════════════════════════════

    Write-Step "🏠" "Configuration Dashboard..." "Cyan"

    # Services
    $services = @"
---
- Cerveau IA:
    - Open WebUI:
        icon: si-openai
        href: http://${BrainUrl}:3001
        description: Interface Chat IA
        server: my-docker
        container: nemesis-brain
    - Ollama:
        icon: si-ollama
        href: http://${BaseUrl}:11434
        description: Moteur LLM
        server: my-docker
        container: nemesis-ollama

- Automatisation:
    - N8N:
        icon: si-n8n
        href: http://${BaseUrl}:5678
        description: Workflows
        server: my-docker
        container: nemesis-n8n

- Infrastructure:
    - Portainer:
        icon: si-portainer
        href: http://${BaseUrl}:9000
        description: Gestion Docker
        server: my-docker
        container: nemesis-portainer
    - PostgreSQL:
        icon: si-postgresql
        description: Base de données
        server: my-docker
        container: nemesis-postgres
"@

    $settings = @"
---
title: NEMESIS Control Center
theme: dark
color: purple
headerStyle: clean
"@

    $widgets = @"
---
- resources:
    label: Système
    cpu: true
    memory: true
    disk: /
"@

    $docker = @"
---
my-docker:
  socket: /var/run/docker.sock
"@

    Set-Content -Path "$ConfigDir\homepage\services.yaml" -Value $services -Encoding UTF8
    Set-Content -Path "$ConfigDir\homepage\settings.yaml" -Value $settings -Encoding UTF8
    Set-Content -Path "$ConfigDir\homepage\widgets.yaml" -Value $widgets -Encoding UTF8
    Set-Content -Path "$ConfigDir\homepage\docker.yaml" -Value $docker -Encoding UTF8
    Set-Content -Path "$ConfigDir\homepage\bookmarks.yaml" -Value "---`n" -Encoding UTF8

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 9 : CONFIGURATION MCP (CLAUDE DESKTOP)
    # ══════════════════════════════════════════════════════════════════════════

    Write-Step "🤖" "Configuration MCP..." "Cyan"

    $SafeHome = $NemesisHome.Replace('\', '\\')
    $McpConfig = @"
{
  "mcpServers": {
    "filesystem": {
      "command": "npx.cmd",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "$SafeHome"]
    },
    "fetch": {
      "command": "npx.cmd",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    },
    "memory": {
      "command": "npx.cmd",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
"@
    Set-Content -Path "$NemesisHome\claude_desktop_config.json" -Value $McpConfig -Encoding UTF8

    # Copie vers Claude Desktop si disponible
    $claudeConfigDir = "$env:APPDATA\Claude"
    if (Test-Path $claudeConfigDir) {
        Copy-Item -Path "$NemesisHome\claude_desktop_config.json" `
                  -Destination "$claudeConfigDir\claude_desktop_config.json" `
                  -Force -ErrorAction SilentlyContinue
        Write-Step "✅" "MCP copié vers Claude Desktop" "Green"
    }

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 10 : DÉPLOIEMENT DOCKER
    # ══════════════════════════════════════════════════════════════════════════

    Set-Location -Path $NemesisHome
    Write-Host ""
    Write-Step "🚀" "LANCEMENT DE LA MATRICE NEMESIS..." "Magenta"
    Write-Host ""

    # Mode tolérant : Docker écrit souvent en stderr même quand ça marche
    $OriginalPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    # Pull des images
    Write-Host "   Téléchargement des images..." -ForegroundColor Gray
    docker compose pull 2>&1 | Out-Null

    # Démarrage
    docker compose up -d 2>&1

    if ($LASTEXITCODE -ne 0) {
        $ErrorActionPreference = $OriginalPref
        throw "Docker Compose a échoué (Code: $LASTEXITCODE). Docker est-il lancé ?"
    }

    $ErrorActionPreference = $OriginalPref

    Write-Step "✅" "Services démarrés" "Green"

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 11 : TÉLÉCHARGEMENT MODÈLE IA
    # ══════════════════════════════════════════════════════════════════════════

    Write-Step "🧠" "Téléchargement du modèle llama3.2 en arrière-plan..." "Cyan"
    Start-Job -Name "OllamaDownload" -ScriptBlock {
        Start-Sleep -Seconds 10  # Attendre qu'Ollama soit prêt
        docker exec nemesis-ollama ollama pull llama3.2
    } | Out-Null

    # ══════════════════════════════════════════════════════════════════════════
    # ÉTAPE 12 : RACCOURCI BUREAU
    # ══════════════════════════════════════════════════════════════════════════

    $ShortcutPath = "$([Environment]::GetFolderPath('Desktop'))\NEMESIS.url"
    $ShortcutContent = @"
[InternetShortcut]
URL=http://$BaseUrl
IconIndex=0
IconFile=%SystemRoot%\System32\shell32.dll,13
"@
    Set-Content -Path $ShortcutPath -Value $ShortcutContent -Encoding ASCII
    Write-Step "🔗" "Raccourci bureau créé" "Green"

    # ══════════════════════════════════════════════════════════════════════════
    # RÉSUMÉ FINAL
    # ══════════════════════════════════════════════════════════════════════════

    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                    🔱 NEMESIS EST OPÉRATIONNEL 🔱                        ║" -ForegroundColor Green
    Write-Host "╠══════════════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
    Write-Host "║                                                                          ║" -ForegroundColor Green
    Write-Host "║   📊 Dashboard    : http://$($BaseUrl.PadRight(48))║" -ForegroundColor White
    Write-Host "║   🧠 Chat IA      : http://$($BrainUrl):3001".PadRight(65) + "║" -ForegroundColor White
    Write-Host "║   ⚡ N8N          : http://$($BaseUrl):5678".PadRight(65) + "║" -ForegroundColor White
    Write-Host "║   🐳 Portainer    : http://$($BaseUrl):9000".PadRight(65) + "║" -ForegroundColor White
    Write-Host "║                                                                          ║" -ForegroundColor Green
    Write-Host "╠══════════════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
    Write-Host "║   🔐 Identifiants N8N:                                                   ║" -ForegroundColor Green
    Write-Host "║      Utilisateur : nemesis                                               ║" -ForegroundColor White
    Write-Host "║      Mot de passe: $($env:N8N_PASSWORD.PadRight(46))║" -ForegroundColor Yellow
    Write-Host "║                                                                          ║" -ForegroundColor Green
    Write-Host "╠══════════════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
    Write-Host "║   📁 Dossier     : $($NemesisHome.PadRight(46))║" -ForegroundColor Gray
    Write-Host "║   🤖 MCP Config  : claude_desktop_config.json                            ║" -ForegroundColor Gray
    Write-Host "╚══════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "   💡 Commandes utiles:" -ForegroundColor Cyan
    Write-Host "      docker compose -f $NemesisHome\docker-compose.yml logs -f" -ForegroundColor Gray
    Write-Host "      docker exec nemesis-ollama ollama list" -ForegroundColor Gray
    Write-Host ""

    # Ouvrir le navigateur
    Start-Process "http://$BaseUrl"

} Catch {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║                         ❌ ERREUR D'INSTALLATION                         ║" -ForegroundColor Red
    Write-Host "╚══════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Message : $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "   Ligne   : $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Yellow
    Write-Host ""

    Pause-And-Exit -ExitCode 1

} Finally {
    # BLOC FINALLY : LA FENÊTRE NE SE FERMERA JAMAIS AUTOMATIQUEMENT
    if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) {
        Pause-And-Exit -ExitCode 0
    }
}
