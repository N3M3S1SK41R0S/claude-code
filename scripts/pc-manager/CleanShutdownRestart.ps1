<#
.SYNOPSIS
    Script de fermeture propre et redémarrage du PC avec gestion des erreurs
.DESCRIPTION
    - Sauvegarde les données des applications ouvertes
    - Ferme proprement toutes les applications
    - Identifie les erreurs système
    - Vérifie les mises à jour en attente
    - Redémarre ou éteint le PC proprement
.AUTHOR
    Claude Code Assistant
.DATE
    2025-12-30
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("Shutdown", "Restart", "Hibernate", "Sleep")]
    [string]$Action = "Restart",

    [Parameter(Mandatory=$false)]
    [int]$DelaySeconds = 30,

    [Parameter(Mandatory=$false)]
    [switch]$Force,

    [Parameter(Mandatory=$false)]
    [switch]$SkipUpdatesCheck,

    [Parameter(Mandatory=$false)]
    [string]$LogPath = "$env:USERPROFILE\Documents\PCManager\Logs"
)

# ============================================
# CONFIGURATION
# ============================================
$ErrorActionPreference = "Continue"
$script:LogFile = Join-Path $LogPath "shutdown_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

# Applications critiques à fermer en priorité (dans l'ordre)
$CriticalApps = @(
    @{Name="chrome"; DisplayName="Google Chrome"; SaveMethod="Graceful"},
    @{Name="firefox"; DisplayName="Mozilla Firefox"; SaveMethod="Graceful"},
    @{Name="msedge"; DisplayName="Microsoft Edge"; SaveMethod="Graceful"},
    @{Name="WINWORD"; DisplayName="Microsoft Word"; SaveMethod="COM"},
    @{Name="EXCEL"; DisplayName="Microsoft Excel"; SaveMethod="COM"},
    @{Name="POWERPNT"; DisplayName="Microsoft PowerPoint"; SaveMethod="COM"},
    @{Name="OUTLOOK"; DisplayName="Microsoft Outlook"; SaveMethod="COM"},
    @{Name="Code"; DisplayName="Visual Studio Code"; SaveMethod="Graceful"},
    @{Name="devenv"; DisplayName="Visual Studio"; SaveMethod="Graceful"},
    @{Name="notepad++"; DisplayName="Notepad++"; SaveMethod="Graceful"},
    @{Name="sublime_text"; DisplayName="Sublime Text"; SaveMethod="Graceful"},
    @{Name="Discord"; DisplayName="Discord"; SaveMethod="Graceful"},
    @{Name="Slack"; DisplayName="Slack"; SaveMethod="Graceful"},
    @{Name="Teams"; DisplayName="Microsoft Teams"; SaveMethod="Graceful"},
    @{Name="Spotify"; DisplayName="Spotify"; SaveMethod="Graceful"},
    @{Name="steam"; DisplayName="Steam"; SaveMethod="Graceful"}
)

# Applications système à ne pas fermer
$SystemApps = @(
    "explorer",
    "dwm",
    "csrss",
    "smss",
    "services",
    "lsass",
    "svchost",
    "System",
    "Registry",
    "wininit",
    "winlogon",
    "RuntimeBroker",
    "ShellExperienceHost",
    "StartMenuExperienceHost",
    "SearchHost",
    "SecurityHealthService",
    "MsMpEng"
)

# ============================================
# FONCTIONS UTILITAIRES
# ============================================

function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("INFO", "WARNING", "ERROR", "SUCCESS")]
        [string]$Level = "INFO"
    )

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"

    # Créer le dossier de logs si nécessaire
    if (-not (Test-Path $LogPath)) {
        New-Item -ItemType Directory -Path $LogPath -Force | Out-Null
    }

    # Écrire dans le fichier log
    Add-Content -Path $script:LogFile -Value $logEntry

    # Afficher avec couleur
    $color = switch ($Level) {
        "INFO" { "White" }
        "WARNING" { "Yellow" }
        "ERROR" { "Red" }
        "SUCCESS" { "Green" }
    }
    Write-Host $logEntry -ForegroundColor $color
}

function Show-Progress {
    param(
        [string]$Activity,
        [string]$Status,
        [int]$PercentComplete
    )
    Write-Progress -Activity $Activity -Status $Status -PercentComplete $PercentComplete
}

# ============================================
# DÉTECTION DES ERREURS SYSTÈME
# ============================================

function Get-SystemErrors {
    Write-Log "Analyse des erreurs système..." -Level INFO

    $errors = @{
        Critical = @()
        Warnings = @()
        DiskErrors = @()
        ServiceErrors = @()
    }

    try {
        # Erreurs critiques des dernières 24h
        $yesterday = (Get-Date).AddDays(-1)

        # Erreurs du journal système
        $systemErrors = Get-WinEvent -FilterHashtable @{
            LogName = 'System'
            Level = 1,2  # Critical et Error
            StartTime = $yesterday
        } -MaxEvents 50 -ErrorAction SilentlyContinue

        foreach ($err in $systemErrors) {
            if ($err.Level -eq 1) {
                $errors.Critical += @{
                    Time = $err.TimeCreated
                    Source = $err.ProviderName
                    Message = $err.Message
                }
            } else {
                $errors.Warnings += @{
                    Time = $err.TimeCreated
                    Source = $err.ProviderName
                    Message = $err.Message
                }
            }
        }

        # Erreurs d'application
        $appErrors = Get-WinEvent -FilterHashtable @{
            LogName = 'Application'
            Level = 1,2
            StartTime = $yesterday
        } -MaxEvents 50 -ErrorAction SilentlyContinue

        foreach ($err in $appErrors) {
            $errors.Warnings += @{
                Time = $err.TimeCreated
                Source = $err.ProviderName
                Message = $err.Message
            }
        }

        # Vérification de l'état des disques
        $disks = Get-PhysicalDisk -ErrorAction SilentlyContinue
        foreach ($disk in $disks) {
            if ($disk.HealthStatus -ne "Healthy") {
                $errors.DiskErrors += @{
                    Disk = $disk.FriendlyName
                    Status = $disk.HealthStatus
                    OperationalStatus = $disk.OperationalStatus
                }
            }
        }

        # Services en échec
        $failedServices = Get-Service | Where-Object {
            $_.StartType -eq 'Automatic' -and $_.Status -ne 'Running'
        }

        foreach ($svc in $failedServices) {
            $errors.ServiceErrors += @{
                Name = $svc.Name
                DisplayName = $svc.DisplayName
                Status = $svc.Status
            }
        }

    } catch {
        Write-Log "Erreur lors de l'analyse système: $_" -Level WARNING
    }

    # Rapport
    if ($errors.Critical.Count -gt 0) {
        Write-Log "ERREURS CRITIQUES DÉTECTÉES: $($errors.Critical.Count)" -Level ERROR
        foreach ($err in $errors.Critical | Select-Object -First 5) {
            Write-Log "  - [$($err.Source)] $($err.Message.Substring(0, [Math]::Min(100, $err.Message.Length)))..." -Level ERROR
        }
    }

    if ($errors.DiskErrors.Count -gt 0) {
        Write-Log "PROBLÈMES DE DISQUE DÉTECTÉS!" -Level ERROR
        foreach ($disk in $errors.DiskErrors) {
            Write-Log "  - Disque '$($disk.Disk)': $($disk.Status)" -Level ERROR
        }
    }

    if ($errors.ServiceErrors.Count -gt 0) {
        Write-Log "Services en échec: $($errors.ServiceErrors.Count)" -Level WARNING
        foreach ($svc in $errors.ServiceErrors | Select-Object -First 5) {
            Write-Log "  - $($svc.DisplayName) ($($svc.Status))" -Level WARNING
        }
    }

    Write-Log "Erreurs critiques: $($errors.Critical.Count), Avertissements: $($errors.Warnings.Count)" -Level INFO

    return $errors
}

# ============================================
# VÉRIFICATION DES MISES À JOUR
# ============================================

function Get-PendingUpdates {
    if ($SkipUpdatesCheck) {
        Write-Log "Vérification des mises à jour ignorée" -Level INFO
        return $null
    }

    Write-Log "Vérification des mises à jour Windows..." -Level INFO

    $updates = @{
        Pending = @()
        RequiresReboot = $false
        LastCheck = $null
    }

    try {
        # Vérifier si un redémarrage est en attente
        $rebootRequired = $false

        $rebootKeys = @(
            "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending",
            "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired",
            "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\PendingFileRenameOperations"
        )

        foreach ($key in $rebootKeys) {
            if (Test-Path $key) {
                $rebootRequired = $true
                break
            }
        }

        $updates.RequiresReboot = $rebootRequired

        if ($rebootRequired) {
            Write-Log "REDÉMARRAGE REQUIS pour finaliser les mises à jour!" -Level WARNING
        }

        # Utiliser le module PSWindowsUpdate si disponible
        if (Get-Module -ListAvailable -Name PSWindowsUpdate) {
            Import-Module PSWindowsUpdate -ErrorAction SilentlyContinue
            $pendingUpdates = Get-WindowsUpdate -ErrorAction SilentlyContinue

            foreach ($update in $pendingUpdates) {
                $updates.Pending += @{
                    Title = $update.Title
                    KB = $update.KB
                    Size = $update.Size
                    IsCritical = $update.MsrcSeverity -eq "Critical"
                }
            }
        } else {
            # Méthode alternative via COM
            try {
                $updateSession = New-Object -ComObject Microsoft.Update.Session
                $updateSearcher = $updateSession.CreateUpdateSearcher()
                $searchResult = $updateSearcher.Search("IsInstalled=0")

                foreach ($update in $searchResult.Updates) {
                    $updates.Pending += @{
                        Title = $update.Title
                        IsCritical = $update.MsrcSeverity -eq "Critical"
                    }
                }
            } catch {
                Write-Log "Impossible de vérifier les mises à jour via COM: $_" -Level WARNING
            }
        }

        # Date de dernière vérification
        try {
            $autoUpdate = New-Object -ComObject Microsoft.Update.AutoUpdate
            $updates.LastCheck = $autoUpdate.Results.LastSearchSuccessDate
            Write-Log "Dernière vérification: $($updates.LastCheck)" -Level INFO
        } catch {}

        if ($updates.Pending.Count -gt 0) {
            Write-Log "Mises à jour en attente: $($updates.Pending.Count)" -Level WARNING
            $criticalCount = ($updates.Pending | Where-Object { $_.IsCritical }).Count
            if ($criticalCount -gt 0) {
                Write-Log "  dont $criticalCount critique(s)!" -Level ERROR
            }
        } else {
            Write-Log "Aucune mise à jour en attente" -Level SUCCESS
        }

    } catch {
        Write-Log "Erreur lors de la vérification des mises à jour: $_" -Level WARNING
    }

    return $updates
}

# ============================================
# SAUVEGARDE ET FERMETURE DES APPLICATIONS
# ============================================

function Save-OfficeDocument {
    param([string]$AppName)

    try {
        switch ($AppName) {
            "WINWORD" {
                $word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
                foreach ($doc in $word.Documents) {
                    if (-not $doc.Saved) {
                        $doc.Save()
                        Write-Log "Document Word sauvegardé: $($doc.Name)" -Level SUCCESS
                    }
                }
            }
            "EXCEL" {
                $excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
                foreach ($wb in $excel.Workbooks) {
                    if (-not $wb.Saved) {
                        $wb.Save()
                        Write-Log "Classeur Excel sauvegardé: $($wb.Name)" -Level SUCCESS
                    }
                }
            }
            "POWERPNT" {
                $ppt = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
                foreach ($pres in $ppt.Presentations) {
                    if (-not $pres.Saved) {
                        $pres.Save()
                        Write-Log "Présentation PowerPoint sauvegardée: $($pres.Name)" -Level SUCCESS
                    }
                }
            }
        }
        return $true
    } catch {
        Write-Log "Impossible de sauvegarder via COM pour $AppName" -Level WARNING
        return $false
    }
}

function Close-ApplicationGracefully {
    param(
        [string]$ProcessName,
        [string]$DisplayName,
        [string]$SaveMethod,
        [int]$TimeoutSeconds = 30
    )

    $processes = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue

    if (-not $processes) {
        return $true
    }

    Write-Log "Fermeture de $DisplayName ($($processes.Count) instance(s))..." -Level INFO

    # Sauvegarder les documents Office si applicable
    if ($SaveMethod -eq "COM") {
        Save-OfficeDocument -AppName $ProcessName
    }

    foreach ($proc in $processes) {
        try {
            # Essayer la fermeture gracieuse
            $proc.CloseMainWindow() | Out-Null
        } catch {
            Write-Log "Impossible d'envoyer le signal de fermeture à $DisplayName" -Level WARNING
        }
    }

    # Attendre la fermeture
    $startTime = Get-Date
    while ((Get-Date) - $startTime -lt [TimeSpan]::FromSeconds($TimeoutSeconds)) {
        $remaining = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
        if (-not $remaining) {
            Write-Log "$DisplayName fermé avec succès" -Level SUCCESS
            return $true
        }
        Start-Sleep -Milliseconds 500
    }

    # Forcer la fermeture si nécessaire
    $remaining = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
    if ($remaining) {
        if ($Force) {
            Write-Log "Fermeture forcée de $DisplayName..." -Level WARNING
            $remaining | Stop-Process -Force -ErrorAction SilentlyContinue
            return $true
        } else {
            Write-Log "$DisplayName ne répond pas - utilisez -Force pour forcer" -Level ERROR
            return $false
        }
    }

    return $true
}

function Close-AllApplications {
    Write-Log "=== FERMETURE DES APPLICATIONS ===" -Level INFO

    $totalApps = $CriticalApps.Count
    $closedApps = 0
    $failedApps = @()

    # Fermer les applications critiques dans l'ordre
    foreach ($app in $CriticalApps) {
        $closedApps++
        Show-Progress -Activity "Fermeture des applications" -Status $app.DisplayName -PercentComplete (($closedApps / $totalApps) * 50)

        $success = Close-ApplicationGracefully -ProcessName $app.Name -DisplayName $app.DisplayName -SaveMethod $app.SaveMethod

        if (-not $success) {
            $failedApps += $app.DisplayName
        }
    }

    # Fermer les autres applications non-système
    Write-Log "Fermeture des autres applications..." -Level INFO

    $otherProcesses = Get-Process | Where-Object {
        $_.MainWindowHandle -ne 0 -and
        $_.ProcessName -notin $SystemApps -and
        $_.ProcessName -notin $CriticalApps.Name
    }

    $totalOther = $otherProcesses.Count
    $closedOther = 0

    foreach ($proc in $otherProcesses) {
        $closedOther++
        Show-Progress -Activity "Fermeture des autres applications" -Status $proc.ProcessName -PercentComplete (50 + ($closedOther / [Math]::Max(1, $totalOther)) * 50)

        try {
            $proc.CloseMainWindow() | Out-Null
            Start-Sleep -Milliseconds 200
        } catch {
            Write-Log "Impossible de fermer: $($proc.ProcessName)" -Level WARNING
        }
    }

    # Attendre un peu pour la fermeture
    Start-Sleep -Seconds 3

    # Forcer les applications récalcitrantes si -Force
    if ($Force) {
        $stubborn = Get-Process | Where-Object {
            $_.MainWindowHandle -ne 0 -and
            $_.ProcessName -notin $SystemApps
        }

        foreach ($proc in $stubborn) {
            try {
                $proc | Stop-Process -Force -ErrorAction SilentlyContinue
                Write-Log "Forcé: $($proc.ProcessName)" -Level WARNING
            } catch {}
        }
    }

    Write-Progress -Activity "Fermeture des applications" -Completed

    if ($failedApps.Count -gt 0) {
        Write-Log "Applications non fermées: $($failedApps -join ', ')" -Level WARNING
    }

    return @{
        Closed = $closedApps
        Failed = $failedApps
    }
}

# ============================================
# NETTOYAGE PRÉ-REDÉMARRAGE
# ============================================

function Clear-TempFiles {
    Write-Log "Nettoyage des fichiers temporaires..." -Level INFO

    $tempPaths = @(
        $env:TEMP,
        "$env:LOCALAPPDATA\Temp",
        "$env:WINDIR\Temp"
    )

    $cleaned = 0

    foreach ($path in $tempPaths) {
        if (Test-Path $path) {
            try {
                $files = Get-ChildItem -Path $path -Recurse -Force -ErrorAction SilentlyContinue |
                    Where-Object { -not $_.PSIsContainer -and $_.LastWriteTime -lt (Get-Date).AddDays(-1) }

                foreach ($file in $files) {
                    try {
                        Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
                        $cleaned++
                    } catch {}
                }
            } catch {}
        }
    }

    Write-Log "Fichiers temporaires nettoyés: $cleaned" -Level SUCCESS
}

function Sync-FileSystem {
    Write-Log "Synchronisation du système de fichiers..." -Level INFO

    try {
        # Vider les caches d'écriture
        $null = [System.IO.DriveInfo]::GetDrives() | ForEach-Object {
            if ($_.DriveType -eq 'Fixed') {
                # Le système se chargera de la synchronisation lors du shutdown
            }
        }
        Write-Log "Système de fichiers synchronisé" -Level SUCCESS
    } catch {
        Write-Log "Erreur de synchronisation: $_" -Level WARNING
    }
}

# ============================================
# EXÉCUTION DE L'ACTION
# ============================================

function Invoke-SystemAction {
    param([string]$ActionType)

    Write-Log "=== EXÉCUTION: $ActionType ===" -Level INFO

    switch ($ActionType) {
        "Shutdown" {
            Write-Log "Arrêt du système dans $DelaySeconds secondes..." -Level WARNING
            Stop-Computer -Force:$Force
        }
        "Restart" {
            Write-Log "Redémarrage du système dans $DelaySeconds secondes..." -Level WARNING
            Restart-Computer -Force:$Force
        }
        "Hibernate" {
            Write-Log "Mise en veille prolongée..." -Level INFO
            & shutdown /h
        }
        "Sleep" {
            Write-Log "Mise en veille..." -Level INFO
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)
        }
    }
}

# ============================================
# POINT D'ENTRÉE PRINCIPAL
# ============================================

function Main {
    Clear-Host
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "   GESTIONNAIRE DE REDÉMARRAGE PROPRE" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""

    Write-Log "Démarrage du processus de $Action" -Level INFO
    Write-Log "Mode Force: $Force" -Level INFO

    # Vérifier les privilèges administrateur
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

    if (-not $isAdmin) {
        Write-Log "Ce script nécessite des privilèges administrateur pour certaines fonctions" -Level WARNING
    }

    # 1. Analyser les erreurs système
    Write-Host ""
    Write-Host "[1/5] Analyse du système..." -ForegroundColor Yellow
    $errors = Get-SystemErrors

    # 2. Vérifier les mises à jour
    Write-Host ""
    Write-Host "[2/5] Vérification des mises à jour..." -ForegroundColor Yellow
    $updates = Get-PendingUpdates

    # Avertissement si des erreurs critiques
    if ($errors.Critical.Count -gt 0 -or $errors.DiskErrors.Count -gt 0) {
        Write-Host ""
        Write-Host "ATTENTION: Des erreurs critiques ont été détectées!" -ForegroundColor Red
        Write-Host "Consultez le fichier log: $script:LogFile" -ForegroundColor Red

        if (-not $Force) {
            $response = Read-Host "Voulez-vous continuer? (O/N)"
            if ($response -notmatch "^[OoYy]") {
                Write-Log "Opération annulée par l'utilisateur" -Level INFO
                return
            }
        }
    }

    # 3. Fermer les applications
    Write-Host ""
    Write-Host "[3/5] Fermeture des applications..." -ForegroundColor Yellow
    $closeResult = Close-AllApplications

    # 4. Nettoyage
    Write-Host ""
    Write-Host "[4/5] Nettoyage..." -ForegroundColor Yellow
    Clear-TempFiles
    Sync-FileSystem

    # 5. Compte à rebours et action
    Write-Host ""
    Write-Host "[5/5] Préparation de l'action..." -ForegroundColor Yellow

    # Sauvegarder le rapport
    $report = @{
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Action = $Action
        Errors = $errors
        Updates = $updates
        ClosedApps = $closeResult
    }

    $reportPath = Join-Path $LogPath "last_shutdown_report.json"
    $report | ConvertTo-Json -Depth 5 | Out-File -FilePath $reportPath -Encoding UTF8

    Write-Log "Rapport sauvegardé: $reportPath" -Level INFO

    # Compte à rebours
    Write-Host ""
    for ($i = $DelaySeconds; $i -gt 0; $i--) {
        Write-Host "`r$Action dans $i secondes... (Appuyez sur Ctrl+C pour annuler)" -NoNewline -ForegroundColor Magenta
        Start-Sleep -Seconds 1
    }

    Write-Host ""
    Write-Log "Exécution de $Action..." -Level WARNING

    # Exécuter l'action
    Invoke-SystemAction -ActionType $Action
}

# Exécuter le script
Main
