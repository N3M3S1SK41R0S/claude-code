<#
.SYNOPSIS
    Script de démarrage intelligent des applications après redémarrage
.DESCRIPTION
    - Démarre les applications dans un ordre cohérent
    - Attend que chaque application soit prête avant la suivante
    - Vérifie les ressources système
    - Interface visuelle avec icône Biohazard
.AUTHOR
    Claude Code Assistant
.DATE
    2025-12-30
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$ConfigPath = "$env:USERPROFILE\Documents\PCManager\startup_config.json",

    [Parameter(Mandatory=$false)]
    [switch]$Silent,

    [Parameter(Mandatory=$false)]
    [int]$DelayBetweenApps = 3,

    [Parameter(Mandatory=$false)]
    [switch]$CheckResources
)

# ============================================
# CONFIGURATION
# ============================================
$ErrorActionPreference = "Continue"
$script:LogPath = "$env:USERPROFILE\Documents\PCManager\Logs"
$script:LogFile = Join-Path $script:LogPath "startup_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

# ============================================
# ICÔNE BIOHAZARD ASCII ART
# ============================================
$BiohazardLogo = @"

                    ██████████████
                ████░░░░░░░░░░░░░░████
              ██░░░░░░░░░░░░░░░░░░░░░░██
            ██░░░░░░████████████░░░░░░░░██
          ██░░░░████            ████░░░░░░██
         ██░░░██    ██████████    ██░░░░░░██
        ██░░██    ██░░░░░░░░░░██    ██░░░░░██
       ██░░██    ██░░░░░░░░░░░░██    ██░░░░██
       ██░██    ██░░░░████░░░░░░██    ██░░░██
      ██░░██   ██░░░░██  ██░░░░░░██   ██░░░░██
      ██░██   ██░░░░██    ██░░░░░░██   ██░░░██
      ██░██   ██░░░██      ██░░░░░██   ██░░░██
      ██░██   ██░░░██  ☣️  ██░░░░░██   ██░░░██
      ██░██   ██░░░░██    ██░░░░░░██   ██░░░██
      ██░░██   ██░░░░██  ██░░░░░░██   ██░░░░██
       ██░██    ██░░░░████░░░░░░██    ██░░░██
       ██░░██    ██░░░░░░░░░░░░██    ██░░░░██
        ██░░██    ██░░░░░░░░░░██    ██░░░░░██
         ██░░░██    ██████████    ██░░░░░░██
          ██░░░░████            ████░░░░░░██
            ██░░░░░░████████████░░░░░░░░██
              ██░░░░░░░░░░░░░░░░░░░░░░██
                ████░░░░░░░░░░░░░░████
                    ██████████████

"@

$BiohazardSimple = @"
           ☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️
        ☢️                       ☢️
      ☢️     ▄▄▄▄▄▄▄▄▄▄▄▄▄     ☢️
     ☢️    ▄█▓▓▓▓▓▓▓▓▓▓▓▓█▄    ☢️
    ☢️   ▄█▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓█▄   ☢️
    ☢️  █▓▓▓▓▓▓▓███▓▓▓▓▓▓▓▓█  ☢️
   ☢️  █▓▓▓▓▓▓██   ██▓▓▓▓▓▓█  ☢️
   ☢️  █▓▓▓▓██  ☣️  ██▓▓▓▓█  ☢️
   ☢️  █▓▓▓▓██       ██▓▓▓▓█  ☢️
   ☢️  █▓▓▓▓▓██   ██▓▓▓▓▓▓█  ☢️
    ☢️  █▓▓▓▓▓▓███▓▓▓▓▓▓▓▓█  ☢️
    ☢️   ▀█▓▓▓▓▓▓▓▓▓▓▓▓▓█▀   ☢️
     ☢️    ▀█▓▓▓▓▓▓▓▓▓█▀    ☢️
      ☢️     ▀▀▀▀▀▀▀▀▀     ☢️
        ☢️                       ☢️
           ☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️☢️
"@

$BiohazardCompact = @"

    ░░░░░░░░░░░▄▄▄▄▄▄▄▄▄▄▄░░░░░░░░░░░
    ░░░░░░▄▄█▀▀░░░░░░░░░░░▀▀█▄▄░░░░░░
    ░░░░▄█▀░░░░▄▄▄█████▄▄▄░░░░▀█▄░░░░
    ░░▄█▀░░░▄██▀▀░░░░░░░▀▀██▄░░░▀█▄░░
    ░█▀░░░██▀░░░▄▄███▄▄░░░░▀██░░░▀█░░
    █▀░░▄█▀░░░▄█▀░░░░░▀█▄░░░▀█▄░░▀█░
    █░░██░░░▄█▀░░░███░░░▀█▄░░░██░░█░
    █░██░░░██░░░▄█▀▀▀█▄░░░██░░░██░█░
    █░██░░░██░░░█ ☣️ █░░░██░░░██░█░
    █░██░░░██░░░▀█▄▄▄█▀░░░██░░░██░█░
    █░░██░░░▀█▄░░░███░░░▄█▀░░░██░░█░
    █▄░░▀█▄░░░▀█▄░░░░░▄█▀░░░▄█▀░░▄█░
    ░█▄░░░▀█▄░░░▀██▄▄██▀░░░▄█▀░░░█▀░
    ░░▀█▄░░░▀██▄░░░░░░░░▄██▀░░░▄█▀░░
    ░░░░▀█▄░░░░▀▀██████▀▀░░░░▄█▀░░░░
    ░░░░░░▀▀█▄▄░░░░░░░░░░▄▄█▀▀░░░░░░
    ░░░░░░░░░░░▀▀▀▀▀▀▀▀▀▀▀░░░░░░░░░░

"@

# Configuration par défaut des applications à démarrer
$DefaultStartupConfig = @{
    Groups = @(
        @{
            Name = "Système & Sécurité"
            Priority = 1
            WaitSeconds = 5
            Apps = @(
                @{Name = "Windows Security"; Path = "windowsdefender:"; Type = "URI"; Enabled = $true},
                @{Name = "OneDrive"; Path = "$env:LOCALAPPDATA\Microsoft\OneDrive\OneDrive.exe"; Type = "Exe"; Enabled = $true}
            )
        },
        @{
            Name = "Communication"
            Priority = 2
            WaitSeconds = 3
            Apps = @(
                @{Name = "Microsoft Teams"; Path = "$env:LOCALAPPDATA\Microsoft\Teams\Update.exe"; Args = "--processStart Teams.exe"; Type = "Exe"; Enabled = $true},
                @{Name = "Slack"; Path = "$env:LOCALAPPDATA\slack\slack.exe"; Type = "Exe"; Enabled = $false},
                @{Name = "Discord"; Path = "$env:LOCALAPPDATA\Discord\Update.exe"; Args = "--processStart Discord.exe"; Type = "Exe"; Enabled = $false}
            )
        },
        @{
            Name = "Productivité"
            Priority = 3
            WaitSeconds = 3
            Apps = @(
                @{Name = "Microsoft Outlook"; Path = "outlook"; Type = "AppName"; Enabled = $true},
                @{Name = "Visual Studio Code"; Path = "code"; Type = "Command"; Enabled = $true},
                @{Name = "Notepad++"; Path = "notepad++"; Type = "AppName"; Enabled = $false}
            )
        },
        @{
            Name = "Navigateurs"
            Priority = 4
            WaitSeconds = 2
            Apps = @(
                @{Name = "Google Chrome"; Path = "chrome"; Type = "AppName"; Enabled = $true},
                @{Name = "Microsoft Edge"; Path = "msedge"; Type = "AppName"; Enabled = $false},
                @{Name = "Firefox"; Path = "firefox"; Type = "AppName"; Enabled = $false}
            )
        },
        @{
            Name = "Multimédia & Autres"
            Priority = 5
            WaitSeconds = 2
            Apps = @(
                @{Name = "Spotify"; Path = "$env:APPDATA\Spotify\Spotify.exe"; Type = "Exe"; Enabled = $false},
                @{Name = "Steam"; Path = "C:\Program Files (x86)\Steam\Steam.exe"; Type = "Exe"; Enabled = $false}
            )
        }
    )
    Settings = @{
        CheckSystemResources = $true
        MinFreeRAMPercent = 20
        MinFreeDiskGB = 5
        WaitForNetworkSeconds = 30
    }
}

# ============================================
# FONCTIONS UTILITAIRES
# ============================================

function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("INFO", "WARNING", "ERROR", "SUCCESS", "BIOHAZARD")]
        [string]$Level = "INFO"
    )

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"

    if (-not (Test-Path $script:LogPath)) {
        New-Item -ItemType Directory -Path $script:LogPath -Force | Out-Null
    }

    Add-Content -Path $script:LogFile -Value $logEntry

    $color = switch ($Level) {
        "INFO" { "White" }
        "WARNING" { "Yellow" }
        "ERROR" { "Red" }
        "SUCCESS" { "Green" }
        "BIOHAZARD" { "Magenta" }
    }

    if (-not $Silent) {
        Write-Host $logEntry -ForegroundColor $color
    }
}

function Show-BiohazardBanner {
    if ($Silent) { return }

    Clear-Host
    Write-Host $BiohazardCompact -ForegroundColor Magenta
    Write-Host ""
    Write-Host "    ╔══════════════════════════════════════════════════╗" -ForegroundColor DarkMagenta
    Write-Host "    ║     ☣️  SYSTÈME DE DÉMARRAGE INTELLIGENT  ☣️    ║" -ForegroundColor Magenta
    Write-Host "    ║          BIOHAZARD STARTUP MANAGER               ║" -ForegroundColor DarkMagenta
    Write-Host "    ╚══════════════════════════════════════════════════╝" -ForegroundColor DarkMagenta
    Write-Host ""
}

function Show-StatusBar {
    param(
        [string]$GroupName,
        [int]$Current,
        [int]$Total,
        [string]$CurrentApp
    )

    if ($Silent) { return }

    $percent = [math]::Round(($Current / $Total) * 100)
    $barLength = 40
    $filled = [math]::Round(($percent / 100) * $barLength)
    $empty = $barLength - $filled

    $bar = "█" * $filled + "░" * $empty

    Write-Host "`r" -NoNewline
    Write-Host "  ☣️ [$bar] $percent% " -NoNewline -ForegroundColor Magenta
    Write-Host "| $GroupName " -NoNewline -ForegroundColor Yellow
    Write-Host "| $CurrentApp" -NoNewline -ForegroundColor Cyan
    Write-Host "          " -NoNewline  # Clear extra chars
}

# ============================================
# VÉRIFICATION DES RESSOURCES
# ============================================

function Test-SystemResources {
    param($Settings)

    Write-Log "☣️ Vérification des ressources système..." -Level BIOHAZARD

    $results = @{
        RAM = @{ OK = $true; Message = "" }
        Disk = @{ OK = $true; Message = "" }
        Network = @{ OK = $true; Message = "" }
    }

    # Vérifier la RAM
    $os = Get-CimInstance -ClassName Win32_OperatingSystem
    $freeRAMPercent = [math]::Round(($os.FreePhysicalMemory / $os.TotalVisibleMemorySize) * 100, 1)

    if ($freeRAMPercent -lt $Settings.MinFreeRAMPercent) {
        $results.RAM.OK = $false
        $results.RAM.Message = "RAM libre: $freeRAMPercent% (minimum: $($Settings.MinFreeRAMPercent)%)"
        Write-Log $results.RAM.Message -Level WARNING
    } else {
        $results.RAM.Message = "RAM libre: $freeRAMPercent%"
        Write-Log $results.RAM.Message -Level SUCCESS
    }

    # Vérifier l'espace disque
    $systemDrive = Get-PSDrive -Name C
    $freeGB = [math]::Round($systemDrive.Free / 1GB, 1)

    if ($freeGB -lt $Settings.MinFreeDiskGB) {
        $results.Disk.OK = $false
        $results.Disk.Message = "Espace disque: ${freeGB}GB (minimum: $($Settings.MinFreeDiskGB)GB)"
        Write-Log $results.Disk.Message -Level WARNING
    } else {
        $results.Disk.Message = "Espace disque: ${freeGB}GB libre"
        Write-Log $results.Disk.Message -Level SUCCESS
    }

    # Vérifier le réseau
    Write-Log "Attente de la connexion réseau..." -Level INFO
    $networkReady = $false
    $startTime = Get-Date

    while (-not $networkReady -and ((Get-Date) - $startTime).TotalSeconds -lt $Settings.WaitForNetworkSeconds) {
        try {
            $ping = Test-Connection -ComputerName "8.8.8.8" -Count 1 -Quiet -ErrorAction SilentlyContinue
            if ($ping) {
                $networkReady = $true
            }
        } catch {}

        if (-not $networkReady) {
            Start-Sleep -Seconds 2
        }
    }

    if (-not $networkReady) {
        $results.Network.OK = $false
        $results.Network.Message = "Réseau non disponible après $($Settings.WaitForNetworkSeconds)s"
        Write-Log $results.Network.Message -Level WARNING
    } else {
        $results.Network.Message = "Réseau opérationnel"
        Write-Log $results.Network.Message -Level SUCCESS
    }

    return $results
}

# ============================================
# DÉMARRAGE DES APPLICATIONS
# ============================================

function Start-Application {
    param(
        [hashtable]$App
    )

    if (-not $App.Enabled) {
        return @{ Success = $true; Skipped = $true; Message = "Désactivé" }
    }

    Write-Log "  → Démarrage de $($App.Name)..." -Level INFO

    try {
        switch ($App.Type) {
            "Exe" {
                if (Test-Path $App.Path) {
                    if ($App.Args) {
                        Start-Process -FilePath $App.Path -ArgumentList $App.Args -ErrorAction Stop
                    } else {
                        Start-Process -FilePath $App.Path -ErrorAction Stop
                    }
                } else {
                    return @{ Success = $false; Skipped = $false; Message = "Fichier non trouvé: $($App.Path)" }
                }
            }
            "AppName" {
                Start-Process $App.Path -ErrorAction Stop
            }
            "Command" {
                & cmd /c start "" $App.Path
            }
            "URI" {
                Start-Process $App.Path -ErrorAction Stop
            }
        }

        Write-Log "  ✓ $($App.Name) démarré" -Level SUCCESS
        return @{ Success = $true; Skipped = $false; Message = "OK" }

    } catch {
        Write-Log "  ✗ Erreur: $($App.Name) - $_" -Level ERROR
        return @{ Success = $false; Skipped = $false; Message = $_.Exception.Message }
    }
}

function Start-ApplicationGroup {
    param(
        [hashtable]$Group,
        [int]$GroupIndex,
        [int]$TotalGroups
    )

    Write-Host ""
    Write-Host "  ╔═══════════════════════════════════════════════════╗" -ForegroundColor DarkMagenta
    Write-Host "  ║ ☣️  GROUPE $($GroupIndex)/$($TotalGroups): $($Group.Name.ToUpper().PadRight(30)) ║" -ForegroundColor Magenta
    Write-Host "  ╚═══════════════════════════════════════════════════╝" -ForegroundColor DarkMagenta

    $results = @{
        GroupName = $Group.Name
        Started = 0
        Failed = 0
        Skipped = 0
        Apps = @()
    }

    $enabledApps = $Group.Apps | Where-Object { $_.Enabled }
    $totalApps = $enabledApps.Count
    $current = 0

    foreach ($app in $Group.Apps) {
        if ($app.Enabled) {
            $current++
            Show-StatusBar -GroupName $Group.Name -Current $current -Total $totalApps -CurrentApp $app.Name
        }

        $result = Start-Application -App $app

        $results.Apps += @{
            Name = $app.Name
            Result = $result
        }

        if ($result.Skipped) {
            $results.Skipped++
        } elseif ($result.Success) {
            $results.Started++
        } else {
            $results.Failed++
        }

        if ($app.Enabled -and $current -lt $totalApps) {
            Start-Sleep -Seconds $DelayBetweenApps
        }
    }

    Write-Host ""

    # Attendre avant le prochain groupe
    if ($Group.WaitSeconds -gt 0) {
        Write-Log "  ⏳ Stabilisation: $($Group.WaitSeconds)s..." -Level INFO
        Start-Sleep -Seconds $Group.WaitSeconds
    }

    return $results
}

# ============================================
# GESTION DE LA CONFIGURATION
# ============================================

function Get-StartupConfig {
    if (Test-Path $ConfigPath) {
        try {
            $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json -AsHashtable
            Write-Log "Configuration chargée: $ConfigPath" -Level SUCCESS
            return $config
        } catch {
            Write-Log "Erreur de lecture de la configuration: $_" -Level WARNING
            Write-Log "Utilisation de la configuration par défaut" -Level INFO
        }
    }

    # Sauvegarder la configuration par défaut
    Save-StartupConfig -Config $DefaultStartupConfig
    return $DefaultStartupConfig
}

function Save-StartupConfig {
    param([hashtable]$Config)

    $configDir = Split-Path $ConfigPath -Parent
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }

    $Config | ConvertTo-Json -Depth 10 | Out-File -FilePath $ConfigPath -Encoding UTF8
    Write-Log "Configuration sauvegardée: $ConfigPath" -Level SUCCESS
}

# ============================================
# VÉRIFICATION POST-DÉMARRAGE
# ============================================

function Get-LastShutdownReport {
    $reportPath = Join-Path (Split-Path $ConfigPath -Parent) "Logs\last_shutdown_report.json"

    if (Test-Path $reportPath) {
        try {
            $report = Get-Content $reportPath -Raw | ConvertFrom-Json
            return $report
        } catch {
            return $null
        }
    }
    return $null
}

function Show-ShutdownReport {
    $report = Get-LastShutdownReport

    if ($report) {
        Write-Host ""
        Write-Host "  ╔═══════════════════════════════════════════════════╗" -ForegroundColor DarkYellow
        Write-Host "  ║ ☣️  RAPPORT DU DERNIER ARRÊT                      ║" -ForegroundColor Yellow
        Write-Host "  ╚═══════════════════════════════════════════════════╝" -ForegroundColor DarkYellow
        Write-Host ""
        Write-Host "  Date: $($report.Timestamp)" -ForegroundColor Cyan
        Write-Host "  Action: $($report.Action)" -ForegroundColor Cyan

        if ($report.Errors.Critical.Count -gt 0) {
            Write-Host "  ⚠️  Erreurs critiques détectées: $($report.Errors.Critical.Count)" -ForegroundColor Red
        }

        if ($report.Updates.RequiresReboot) {
            Write-Host "  🔄 Des mises à jour nécessitaient un redémarrage" -ForegroundColor Yellow
        }

        Write-Host ""
    }
}

# ============================================
# GÉNÉRATION DU RAPPORT FINAL
# ============================================

function Show-FinalReport {
    param([array]$GroupResults)

    Write-Host ""
    Write-Host "  ╔═══════════════════════════════════════════════════╗" -ForegroundColor DarkGreen
    Write-Host "  ║ ☣️  RAPPORT DE DÉMARRAGE                          ║" -ForegroundColor Green
    Write-Host "  ╚═══════════════════════════════════════════════════╝" -ForegroundColor DarkGreen
    Write-Host ""

    $totalStarted = 0
    $totalFailed = 0
    $totalSkipped = 0

    foreach ($group in $GroupResults) {
        $statusIcon = if ($group.Failed -eq 0) { "✓" } else { "⚠" }
        $statusColor = if ($group.Failed -eq 0) { "Green" } else { "Yellow" }

        Write-Host "  $statusIcon $($group.GroupName): " -NoNewline -ForegroundColor $statusColor
        Write-Host "$($group.Started) démarré(s), $($group.Failed) échec(s), $($group.Skipped) ignoré(s)" -ForegroundColor Gray

        $totalStarted += $group.Started
        $totalFailed += $group.Failed
        $totalSkipped += $group.Skipped
    }

    Write-Host ""
    Write-Host "  ═══════════════════════════════════════════════════" -ForegroundColor DarkGray
    Write-Host "  TOTAL: " -NoNewline -ForegroundColor White
    Write-Host "$totalStarted " -NoNewline -ForegroundColor Green
    Write-Host "démarré(s), " -NoNewline -ForegroundColor Gray
    Write-Host "$totalFailed " -NoNewline -ForegroundColor $(if ($totalFailed -gt 0) { "Red" } else { "Green" })
    Write-Host "échec(s), " -NoNewline -ForegroundColor Gray
    Write-Host "$totalSkipped " -NoNewline -ForegroundColor Yellow
    Write-Host "ignoré(s)" -ForegroundColor Gray
    Write-Host ""

    if ($totalFailed -eq 0) {
        Write-Host "  ☣️ SYSTÈME OPÉRATIONNEL ☣️" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ DÉMARRAGE AVEC ERREURS - Vérifiez les logs ⚠️" -ForegroundColor Yellow
    }

    Write-Host ""
}

# ============================================
# POINT D'ENTRÉE PRINCIPAL
# ============================================

function Main {
    Show-BiohazardBanner

    Write-Log "☣️ BIOHAZARD STARTUP MANAGER - Initialisation" -Level BIOHAZARD

    # Charger la configuration
    $config = Get-StartupConfig

    # Afficher le rapport du dernier arrêt
    Show-ShutdownReport

    # Vérifier les ressources système
    if ($CheckResources -or $config.Settings.CheckSystemResources) {
        $resources = Test-SystemResources -Settings $config.Settings

        if (-not $resources.RAM.OK -or -not $resources.Disk.OK) {
            Write-Host ""
            Write-Host "  ⚠️ ATTENTION: Ressources système insuffisantes!" -ForegroundColor Red
            Write-Host "  Le démarrage des applications peut être ralenti." -ForegroundColor Yellow
            Write-Host ""

            if (-not $Silent) {
                Start-Sleep -Seconds 3
            }
        }
    }

    # Trier les groupes par priorité
    $sortedGroups = $config.Groups | Sort-Object { $_.Priority }

    # Démarrer les applications
    Write-Log "☣️ Démarrage des applications..." -Level BIOHAZARD
    $groupResults = @()
    $groupIndex = 0
    $totalGroups = $sortedGroups.Count

    foreach ($group in $sortedGroups) {
        $groupIndex++
        $result = Start-ApplicationGroup -Group $group -GroupIndex $groupIndex -TotalGroups $totalGroups
        $groupResults += $result
    }

    # Afficher le rapport final
    Show-FinalReport -GroupResults $groupResults

    # Sauvegarder le rapport de démarrage
    $startupReport = @{
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Groups = $groupResults
        SystemResources = $resources
    }

    $startupReportPath = Join-Path $script:LogPath "last_startup_report.json"
    $startupReport | ConvertTo-Json -Depth 10 | Out-File -FilePath $startupReportPath -Encoding UTF8

    Write-Log "☣️ Démarrage terminé - Rapport: $startupReportPath" -Level BIOHAZARD

    if (-not $Silent) {
        Write-Host ""
        Write-Host "  Appuyez sur une touche pour fermer..." -ForegroundColor DarkGray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
}

# Exécuter
Main
