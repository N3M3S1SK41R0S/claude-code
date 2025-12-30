<#
.SYNOPSIS
    Diagnostic complet du système avec interface Biohazard
.DESCRIPTION
    Analyse complète du système:
    - Erreurs système et applications
    - État des disques
    - Utilisation mémoire/CPU
    - Services en échec
    - Mises à jour en attente
.AUTHOR
    Claude Code Assistant
.DATE
    2025-12-30
#>

param(
    [Parameter(Mandatory=$false)]
    [switch]$ExportReport,

    [Parameter(Mandatory=$false)]
    [string]$ReportPath = "$env:USERPROFILE\Documents\PCManager\Reports"
)

# ============================================
# INTERFACE BIOHAZARD
# ============================================

$BiohazardHeader = @"

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

       ☣️  DIAGNOSTIC SYSTÈME BIOHAZARD  ☣️

"@

function Write-BiohazardHeader {
    Clear-Host
    Write-Host $BiohazardHeader -ForegroundColor Magenta
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor DarkMagenta
    Write-Host ""
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "  ╔═══════════════════════════════════════════════════════════╗" -ForegroundColor DarkMagenta
    Write-Host "  ║ ☣️  $($Title.ToUpper().PadRight(53)) ║" -ForegroundColor Magenta
    Write-Host "  ╚═══════════════════════════════════════════════════════════╝" -ForegroundColor DarkMagenta
    Write-Host ""
}

function Write-Result {
    param(
        [string]$Label,
        [string]$Value,
        [ValidateSet("OK", "WARNING", "ERROR", "INFO")]
        [string]$Status = "INFO"
    )

    $icon = switch ($Status) {
        "OK" { "✓"; $color = "Green" }
        "WARNING" { "⚠"; $color = "Yellow" }
        "ERROR" { "✗"; $color = "Red" }
        "INFO" { "ℹ"; $color = "Cyan" }
    }

    Write-Host "  $icon " -NoNewline -ForegroundColor $color
    Write-Host "$($Label): " -NoNewline -ForegroundColor White
    Write-Host $Value -ForegroundColor $color
}

function Write-Progress-Bar {
    param(
        [string]$Label,
        [int]$Percent,
        [int]$WarningThreshold = 70,
        [int]$ErrorThreshold = 90
    )

    $barLength = 30
    $filled = [math]::Round(($Percent / 100) * $barLength)
    $empty = $barLength - $filled

    $color = if ($Percent -ge $ErrorThreshold) { "Red" }
            elseif ($Percent -ge $WarningThreshold) { "Yellow" }
            else { "Green" }

    $bar = "█" * $filled + "░" * $empty

    Write-Host "  $($Label.PadRight(20))" -NoNewline -ForegroundColor White
    Write-Host "[$bar] " -NoNewline -ForegroundColor $color
    Write-Host "$Percent%" -ForegroundColor $color
}

# ============================================
# DIAGNOSTICS
# ============================================

function Get-SystemInfo {
    Write-Section "INFORMATIONS SYSTÈME"

    $os = Get-CimInstance -ClassName Win32_OperatingSystem
    $cs = Get-CimInstance -ClassName Win32_ComputerSystem
    $bios = Get-CimInstance -ClassName Win32_BIOS

    Write-Result -Label "Nom de l'ordinateur" -Value $env:COMPUTERNAME -Status INFO
    Write-Result -Label "Système d'exploitation" -Value "$($os.Caption) $($os.Version)" -Status INFO
    Write-Result -Label "Architecture" -Value $os.OSArchitecture -Status INFO
    Write-Result -Label "Fabricant" -Value $cs.Manufacturer -Status INFO
    Write-Result -Label "Modèle" -Value $cs.Model -Status INFO
    Write-Result -Label "BIOS" -Value "$($bios.Manufacturer) $($bios.SMBIOSBIOSVersion)" -Status INFO

    $uptime = (Get-Date) - $os.LastBootUpTime
    $uptimeStr = "$($uptime.Days)j $($uptime.Hours)h $($uptime.Minutes)m"
    $uptimeStatus = if ($uptime.Days -gt 7) { "WARNING" } else { "OK" }
    Write-Result -Label "Temps de fonctionnement" -Value $uptimeStr -Status $uptimeStatus

    return @{
        ComputerName = $env:COMPUTERNAME
        OS = "$($os.Caption) $($os.Version)"
        Uptime = $uptimeStr
        UptimeDays = $uptime.Days
    }
}

function Get-MemoryStatus {
    Write-Section "MÉMOIRE"

    $os = Get-CimInstance -ClassName Win32_OperatingSystem
    $totalRAM = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
    $freeRAM = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
    $usedRAM = $totalRAM - $freeRAM
    $usedPercent = [math]::Round(($usedRAM / $totalRAM) * 100)

    Write-Result -Label "RAM Totale" -Value "$totalRAM GB" -Status INFO
    Write-Result -Label "RAM Utilisée" -Value "$usedRAM GB" -Status $(if ($usedPercent -gt 90) { "ERROR" } elseif ($usedPercent -gt 70) { "WARNING" } else { "OK" })
    Write-Result -Label "RAM Libre" -Value "$freeRAM GB" -Status INFO
    Write-Progress-Bar -Label "Utilisation RAM" -Percent $usedPercent

    # Mémoire virtuelle
    $totalVirtual = [math]::Round($os.TotalVirtualMemorySize / 1MB, 2)
    $freeVirtual = [math]::Round($os.FreeVirtualMemory / 1MB, 2)
    $usedVirtualPercent = [math]::Round((($totalVirtual - $freeVirtual) / $totalVirtual) * 100)

    Write-Host ""
    Write-Result -Label "Mémoire virtuelle" -Value "$totalVirtual GB total, $freeVirtual GB libre" -Status INFO
    Write-Progress-Bar -Label "Utilisation Virtuelle" -Percent $usedVirtualPercent

    return @{
        TotalRAM = $totalRAM
        UsedRAM = $usedRAM
        FreeRAM = $freeRAM
        UsedPercent = $usedPercent
    }
}

function Get-CPUStatus {
    Write-Section "PROCESSEUR"

    $cpu = Get-CimInstance -ClassName Win32_Processor
    $cpuLoad = (Get-CimInstance -ClassName Win32_Processor).LoadPercentage

    Write-Result -Label "Processeur" -Value $cpu.Name -Status INFO
    Write-Result -Label "Coeurs" -Value "$($cpu.NumberOfCores) coeurs, $($cpu.NumberOfLogicalProcessors) threads" -Status INFO
    Write-Result -Label "Fréquence max" -Value "$($cpu.MaxClockSpeed) MHz" -Status INFO

    $loadStatus = if ($cpuLoad -gt 90) { "ERROR" } elseif ($cpuLoad -gt 70) { "WARNING" } else { "OK" }
    Write-Result -Label "Charge actuelle" -Value "$cpuLoad%" -Status $loadStatus
    Write-Progress-Bar -Label "Utilisation CPU" -Percent $cpuLoad

    return @{
        Name = $cpu.Name
        Cores = $cpu.NumberOfCores
        Load = $cpuLoad
    }
}

function Get-DiskStatus {
    Write-Section "DISQUES"

    $disks = @()
    $physicalDisks = Get-PhysicalDisk -ErrorAction SilentlyContinue

    foreach ($pdisk in $physicalDisks) {
        $healthStatus = if ($pdisk.HealthStatus -eq "Healthy") { "OK" } else { "ERROR" }
        Write-Result -Label "Disque $($pdisk.FriendlyName)" -Value "Santé: $($pdisk.HealthStatus)" -Status $healthStatus

        $disks += @{
            Name = $pdisk.FriendlyName
            Health = $pdisk.HealthStatus
            MediaType = $pdisk.MediaType
        }
    }

    Write-Host ""

    $volumes = Get-Volume | Where-Object { $_.DriveLetter -and $_.DriveType -eq 'Fixed' }

    foreach ($vol in $volumes) {
        $usedPercent = [math]::Round((($vol.Size - $vol.SizeRemaining) / $vol.Size) * 100)
        $freeGB = [math]::Round($vol.SizeRemaining / 1GB, 1)
        $totalGB = [math]::Round($vol.Size / 1GB, 1)

        $status = if ($usedPercent -gt 90) { "ERROR" } elseif ($usedPercent -gt 80) { "WARNING" } else { "OK" }
        Write-Result -Label "Volume $($vol.DriveLetter):" -Value "$freeGB GB libres sur $totalGB GB" -Status $status
        Write-Progress-Bar -Label "  Utilisation $($vol.DriveLetter):" -Percent $usedPercent -WarningThreshold 80 -ErrorThreshold 90

        $disks += @{
            Volume = $vol.DriveLetter
            TotalGB = $totalGB
            FreeGB = $freeGB
            UsedPercent = $usedPercent
        }
    }

    return $disks
}

function Get-NetworkStatus {
    Write-Section "RÉSEAU"

    $adapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' }

    foreach ($adapter in $adapters) {
        Write-Result -Label "Adaptateur" -Value "$($adapter.Name) ($($adapter.InterfaceDescription))" -Status OK
        Write-Result -Label "  Vitesse" -Value "$([math]::Round($adapter.LinkSpeed / 1000000)) Mbps" -Status INFO
    }

    # Test de connectivité
    Write-Host ""
    $pingTests = @(
        @{Host = "8.8.8.8"; Name = "Google DNS"},
        @{Host = "1.1.1.1"; Name = "Cloudflare DNS"},
        @{Host = "www.google.com"; Name = "Google Web"}
    )

    $networkResults = @()

    foreach ($test in $pingTests) {
        try {
            $ping = Test-Connection -ComputerName $test.Host -Count 1 -ErrorAction Stop
            $latency = $ping.ResponseTime
            $status = if ($latency -lt 50) { "OK" } elseif ($latency -lt 100) { "WARNING" } else { "ERROR" }
            Write-Result -Label "Ping $($test.Name)" -Value "$latency ms" -Status $status
            $networkResults += @{ Host = $test.Host; Latency = $latency; Success = $true }
        } catch {
            Write-Result -Label "Ping $($test.Name)" -Value "ÉCHEC" -Status ERROR
            $networkResults += @{ Host = $test.Host; Latency = -1; Success = $false }
        }
    }

    return $networkResults
}

function Get-ServiceStatus {
    Write-Section "SERVICES CRITIQUES"

    $criticalServices = @(
        @{Name = "wuauserv"; DisplayName = "Windows Update"},
        @{Name = "WinDefend"; DisplayName = "Windows Defender"},
        @{Name = "BITS"; DisplayName = "Background Intelligent Transfer"},
        @{Name = "Spooler"; DisplayName = "Print Spooler"},
        @{Name = "W32Time"; DisplayName = "Windows Time"},
        @{Name = "EventLog"; DisplayName = "Windows Event Log"},
        @{Name = "PlugPlay"; DisplayName = "Plug and Play"}
    )

    $serviceResults = @()

    foreach ($svc in $criticalServices) {
        try {
            $service = Get-Service -Name $svc.Name -ErrorAction Stop
            $status = if ($service.Status -eq "Running") { "OK" } else { "WARNING" }
            Write-Result -Label $svc.DisplayName -Value $service.Status -Status $status
            $serviceResults += @{ Name = $svc.DisplayName; Status = $service.Status.ToString() }
        } catch {
            Write-Result -Label $svc.DisplayName -Value "Non trouvé" -Status INFO
        }
    }

    # Services en échec
    Write-Host ""
    $failedServices = Get-Service | Where-Object {
        $_.StartType -eq 'Automatic' -and $_.Status -ne 'Running'
    } | Select-Object -First 10

    if ($failedServices.Count -gt 0) {
        Write-Host "  ⚠️  Services auto non démarrés:" -ForegroundColor Yellow
        foreach ($fs in $failedServices) {
            Write-Host "     - $($fs.DisplayName) ($($fs.Status))" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ✓ Tous les services auto sont démarrés" -ForegroundColor Green
    }

    return @{
        Critical = $serviceResults
        Failed = $failedServices.Count
    }
}

function Get-EventErrors {
    Write-Section "ERREURS SYSTÈME (24H)"

    $yesterday = (Get-Date).AddDays(-1)
    $errorCounts = @{
        Critical = 0
        Error = 0
        Warning = 0
    }

    try {
        # Erreurs système
        $systemErrors = Get-WinEvent -FilterHashtable @{
            LogName = 'System'
            Level = 1,2,3  # Critical, Error, Warning
            StartTime = $yesterday
        } -MaxEvents 100 -ErrorAction SilentlyContinue

        foreach ($err in $systemErrors) {
            switch ($err.Level) {
                1 { $errorCounts.Critical++ }
                2 { $errorCounts.Error++ }
                3 { $errorCounts.Warning++ }
            }
        }

        # Erreurs application
        $appErrors = Get-WinEvent -FilterHashtable @{
            LogName = 'Application'
            Level = 1,2
            StartTime = $yesterday
        } -MaxEvents 100 -ErrorAction SilentlyContinue

        $errorCounts.Error += ($appErrors | Where-Object { $_.Level -eq 2 }).Count
        $errorCounts.Critical += ($appErrors | Where-Object { $_.Level -eq 1 }).Count

    } catch {
        Write-Host "  ⚠️  Impossible de lire les journaux d'événements" -ForegroundColor Yellow
    }

    $critStatus = if ($errorCounts.Critical -gt 0) { "ERROR" } else { "OK" }
    $errorStatus = if ($errorCounts.Error -gt 10) { "WARNING" } elseif ($errorCounts.Error -gt 0) { "INFO" } else { "OK" }

    Write-Result -Label "Erreurs critiques" -Value $errorCounts.Critical -Status $critStatus
    Write-Result -Label "Erreurs" -Value $errorCounts.Error -Status $errorStatus
    Write-Result -Label "Avertissements" -Value $errorCounts.Warning -Status INFO

    # Afficher les dernières erreurs critiques
    if ($errorCounts.Critical -gt 0) {
        Write-Host ""
        Write-Host "  Dernières erreurs critiques:" -ForegroundColor Red
        $criticalEvents = Get-WinEvent -FilterHashtable @{
            LogName = 'System'
            Level = 1
            StartTime = $yesterday
        } -MaxEvents 3 -ErrorAction SilentlyContinue

        foreach ($evt in $criticalEvents) {
            Write-Host "     [$($evt.TimeCreated.ToString('HH:mm'))] $($evt.ProviderName): $($evt.Message.Substring(0, [Math]::Min(60, $evt.Message.Length)))..." -ForegroundColor Red
        }
    }

    return $errorCounts
}

function Get-UpdateStatus {
    Write-Section "MISES À JOUR WINDOWS"

    $updateInfo = @{
        RequiresReboot = $false
        PendingCount = 0
    }

    # Vérifier si redémarrage nécessaire
    $rebootKeys = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending",
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired"
    )

    foreach ($key in $rebootKeys) {
        if (Test-Path $key) {
            $updateInfo.RequiresReboot = $true
            break
        }
    }

    if ($updateInfo.RequiresReboot) {
        Write-Result -Label "Redémarrage requis" -Value "OUI - Mises à jour en attente" -Status WARNING
    } else {
        Write-Result -Label "Redémarrage requis" -Value "Non" -Status OK
    }

    # Vérifier les mises à jour en attente
    try {
        $updateSession = New-Object -ComObject Microsoft.Update.Session
        $updateSearcher = $updateSession.CreateUpdateSearcher()
        $searchResult = $updateSearcher.Search("IsInstalled=0")

        $updateInfo.PendingCount = $searchResult.Updates.Count

        $pendingStatus = if ($updateInfo.PendingCount -gt 5) { "WARNING" } elseif ($updateInfo.PendingCount -gt 0) { "INFO" } else { "OK" }
        Write-Result -Label "Mises à jour en attente" -Value $updateInfo.PendingCount -Status $pendingStatus

        if ($updateInfo.PendingCount -gt 0) {
            Write-Host ""
            Write-Host "  Mises à jour disponibles:" -ForegroundColor Cyan
            foreach ($update in $searchResult.Updates | Select-Object -First 5) {
                $severity = if ($update.MsrcSeverity -eq "Critical") { "🔴" } else { "🔵" }
                Write-Host "     $severity $($update.Title.Substring(0, [Math]::Min(60, $update.Title.Length)))..." -ForegroundColor Gray
            }
            if ($updateInfo.PendingCount -gt 5) {
                Write-Host "     ... et $($updateInfo.PendingCount - 5) autres" -ForegroundColor DarkGray
            }
        }
    } catch {
        Write-Result -Label "Vérification des mises à jour" -Value "Non disponible" -Status INFO
    }

    return $updateInfo
}

function Get-SecurityStatus {
    Write-Section "SÉCURITÉ"

    # Windows Defender
    try {
        $defenderStatus = Get-MpComputerStatus -ErrorAction Stop

        $rtStatus = if ($defenderStatus.RealTimeProtectionEnabled) { "OK" } else { "ERROR" }
        Write-Result -Label "Protection temps réel" -Value $(if ($defenderStatus.RealTimeProtectionEnabled) { "Activée" } else { "DÉSACTIVÉE" }) -Status $rtStatus

        $lastScan = $defenderStatus.QuickScanEndTime
        $daysSinceLastScan = ((Get-Date) - $lastScan).Days
        $scanStatus = if ($daysSinceLastScan -gt 7) { "WARNING" } else { "OK" }
        Write-Result -Label "Dernière analyse" -Value "$lastScan ($daysSinceLastScan jour(s))" -Status $scanStatus

        $sigAge = $defenderStatus.AntivirusSignatureAge
        $sigStatus = if ($sigAge -gt 3) { "WARNING" } else { "OK" }
        Write-Result -Label "Signatures antivirus" -Value "Âge: $sigAge jour(s)" -Status $sigStatus

    } catch {
        Write-Result -Label "Windows Defender" -Value "Non disponible" -Status INFO
    }

    # Pare-feu
    try {
        $firewall = Get-NetFirewallProfile | Where-Object { $_.Enabled -eq $true }
        $fwStatus = if ($firewall.Count -gt 0) { "OK" } else { "ERROR" }
        Write-Result -Label "Pare-feu Windows" -Value "$($firewall.Count) profil(s) actif(s)" -Status $fwStatus
    } catch {
        Write-Result -Label "Pare-feu Windows" -Value "Non vérifié" -Status INFO
    }
}

# ============================================
# RAPPORT FINAL
# ============================================

function Show-Summary {
    param($Results)

    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor DarkMagenta
    Write-Host ""
    Write-Host "               ☣️  RÉSUMÉ DU DIAGNOSTIC  ☣️" -ForegroundColor Magenta
    Write-Host ""

    $score = 100
    $issues = @()

    # Évaluer la mémoire
    if ($Results.Memory.UsedPercent -gt 90) {
        $score -= 20
        $issues += "Mémoire critique (> 90%)"
    } elseif ($Results.Memory.UsedPercent -gt 70) {
        $score -= 10
        $issues += "Mémoire élevée (> 70%)"
    }

    # Évaluer le CPU
    if ($Results.CPU.Load -gt 90) {
        $score -= 15
        $issues += "CPU très sollicité"
    }

    # Évaluer les erreurs
    if ($Results.Errors.Critical -gt 0) {
        $score -= ($Results.Errors.Critical * 5)
        $issues += "$($Results.Errors.Critical) erreur(s) critique(s)"
    }

    # Évaluer les mises à jour
    if ($Results.Updates.RequiresReboot) {
        $score -= 10
        $issues += "Redémarrage requis pour mises à jour"
    }

    # Évaluer les services
    if ($Results.Services.Failed -gt 0) {
        $score -= ($Results.Services.Failed * 2)
        $issues += "$($Results.Services.Failed) service(s) en échec"
    }

    $score = [Math]::Max(0, $score)

    # Afficher le score
    $scoreColor = if ($score -ge 80) { "Green" } elseif ($score -ge 60) { "Yellow" } else { "Red" }
    $scoreIcon = if ($score -ge 80) { "✓" } elseif ($score -ge 60) { "⚠" } else { "✗" }

    Write-Host "  Score de santé système: " -NoNewline -ForegroundColor White
    Write-Host "$scoreIcon $score/100" -ForegroundColor $scoreColor
    Write-Host ""

    if ($issues.Count -gt 0) {
        Write-Host "  Problèmes détectés:" -ForegroundColor Yellow
        foreach ($issue in $issues) {
            Write-Host "     ⚠ $issue" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ✓ Aucun problème majeur détecté" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor DarkMagenta

    return @{
        Score = $score
        Issues = $issues
    }
}

# ============================================
# POINT D'ENTRÉE PRINCIPAL
# ============================================

function Main {
    Write-BiohazardHeader

    $results = @{
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        System = Get-SystemInfo
        Memory = Get-MemoryStatus
        CPU = Get-CPUStatus
        Disks = Get-DiskStatus
        Network = Get-NetworkStatus
        Services = Get-ServiceStatus
        Errors = Get-EventErrors
        Updates = Get-UpdateStatus
    }

    Get-SecurityStatus

    $summary = Show-Summary -Results $results
    $results.Summary = $summary

    # Exporter le rapport si demandé
    if ($ExportReport) {
        if (-not (Test-Path $ReportPath)) {
            New-Item -ItemType Directory -Path $ReportPath -Force | Out-Null
        }

        $reportFile = Join-Path $ReportPath "diagnostic_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
        $results | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportFile -Encoding UTF8

        Write-Host ""
        Write-Host "  📋 Rapport exporté: $reportFile" -ForegroundColor Cyan
    }

    Write-Host ""
    Write-Host "  Appuyez sur une touche pour fermer..." -ForegroundColor DarkGray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Exécuter
Main
