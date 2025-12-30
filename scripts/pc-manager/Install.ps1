<#
.SYNOPSIS
    Script d'installation du BIOHAZARD PC MANAGER
.DESCRIPTION
    - Configure les permissions d'exécution
    - Crée les raccourcis
    - Configure le démarrage automatique (optionnel)
.AUTHOR
    Claude Code Assistant
.DATE
    2025-12-30
#>

param(
    [switch]$AddToStartup,
    [switch]$CreateShortcuts,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

$BiohazardLogo = @"

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

         ☣️  BIOHAZARD PC MANAGER  ☣️
              INSTALLATION v1.0

"@

function Write-Step {
    param([string]$Message, [string]$Status = "...")
    $icon = switch ($Status) {
        "OK" { "✓"; $color = "Green" }
        "SKIP" { "○"; $color = "Yellow" }
        "FAIL" { "✗"; $color = "Red" }
        default { "→"; $color = "Cyan" }
    }
    Write-Host "  $icon " -NoNewline -ForegroundColor $color
    Write-Host $Message -ForegroundColor White
}

function Install-BiohazardManager {
    Clear-Host
    Write-Host $BiohazardLogo -ForegroundColor Magenta
    Write-Host ""

    $scriptDir = $PSScriptRoot

    # 1. Vérifier les scripts
    Write-Host "  ═══════════════════════════════════════════" -ForegroundColor DarkMagenta
    Write-Host "  VÉRIFICATION DES FICHIERS" -ForegroundColor Magenta
    Write-Host "  ═══════════════════════════════════════════" -ForegroundColor DarkMagenta
    Write-Host ""

    $requiredScripts = @(
        "BiohazardLauncher.ps1",
        "CleanShutdownRestart.ps1",
        "StartupManager.ps1",
        "SystemDiagnostic.ps1"
    )

    $missingScripts = @()
    foreach ($script in $requiredScripts) {
        $path = Join-Path $scriptDir $script
        if (Test-Path $path) {
            Write-Step "$script" "OK"
        } else {
            Write-Step "$script - MANQUANT" "FAIL"
            $missingScripts += $script
        }
    }

    if ($missingScripts.Count -gt 0) {
        Write-Host ""
        Write-Host "  ⚠️  Scripts manquants! Installation annulée." -ForegroundColor Red
        return
    }

    Write-Host ""

    # 2. Configurer la politique d'exécution
    Write-Host "  ═══════════════════════════════════════════" -ForegroundColor DarkMagenta
    Write-Host "  CONFIGURATION POWERSHELL" -ForegroundColor Magenta
    Write-Host "  ═══════════════════════════════════════════" -ForegroundColor DarkMagenta
    Write-Host ""

    try {
        $currentPolicy = Get-ExecutionPolicy -Scope CurrentUser
        if ($currentPolicy -eq "Restricted" -or $currentPolicy -eq "AllSigned") {
            Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
            Write-Step "Politique d'exécution: RemoteSigned" "OK"
        } else {
            Write-Step "Politique d'exécution: $currentPolicy (OK)" "OK"
        }
    } catch {
        Write-Step "Politique d'exécution: Impossible de modifier" "SKIP"
    }

    Write-Host ""

    # 3. Créer le dossier de données
    Write-Host "  ═══════════════════════════════════════════" -ForegroundColor DarkMagenta
    Write-Host "  CRÉATION DES DOSSIERS" -ForegroundColor Magenta
    Write-Host "  ═══════════════════════════════════════════" -ForegroundColor DarkMagenta
    Write-Host ""

    $dataPath = "$env:USERPROFILE\Documents\PCManager"
    $logsPath = "$dataPath\Logs"
    $reportsPath = "$dataPath\Reports"

    foreach ($path in @($dataPath, $logsPath, $reportsPath)) {
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
            Write-Step "Créé: $path" "OK"
        } else {
            Write-Step "Existe: $path" "OK"
        }
    }

    Write-Host ""

    # 4. Créer les raccourcis (optionnel)
    if ($CreateShortcuts) {
        Write-Host "  ═══════════════════════════════════════════" -ForegroundColor DarkMagenta
        Write-Host "  CRÉATION DES RACCOURCIS" -ForegroundColor Magenta
        Write-Host "  ═══════════════════════════════════════════" -ForegroundColor DarkMagenta
        Write-Host ""

        $WshShell = New-Object -ComObject WScript.Shell
        $desktopPath = [Environment]::GetFolderPath("Desktop")

        # Raccourci Bureau
        try {
            $shortcut = $WshShell.CreateShortcut("$desktopPath\Biohazard PC Manager.lnk")
            $shortcut.TargetPath = "powershell.exe"
            $shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptDir\BiohazardLauncher.ps1`""
            $shortcut.WorkingDirectory = $scriptDir
            $shortcut.IconLocation = "shell32.dll,294"
            $shortcut.Description = "Biohazard PC Manager - Gestion système"
            $shortcut.Save()
            Write-Step "Raccourci Bureau créé" "OK"
        } catch {
            Write-Step "Raccourci Bureau: Échec" "FAIL"
        }

        # Raccourci Menu Démarrer
        try {
            $startMenuPath = [Environment]::GetFolderPath("StartMenu")
            $programsPath = Join-Path $startMenuPath "Programs"

            $shortcut = $WshShell.CreateShortcut("$programsPath\Biohazard PC Manager.lnk")
            $shortcut.TargetPath = "powershell.exe"
            $shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptDir\BiohazardLauncher.ps1`""
            $shortcut.WorkingDirectory = $scriptDir
            $shortcut.IconLocation = "shell32.dll,294"
            $shortcut.Description = "Biohazard PC Manager - Gestion système"
            $shortcut.Save()
            Write-Step "Raccourci Menu Démarrer créé" "OK"
        } catch {
            Write-Step "Raccourci Menu Démarrer: Échec" "FAIL"
        }

        Write-Host ""
    }

    # 5. Ajouter au démarrage (optionnel)
    if ($AddToStartup) {
        Write-Host "  ═══════════════════════════════════════════" -ForegroundColor DarkMagenta
        Write-Host "  CONFIGURATION DÉMARRAGE AUTO" -ForegroundColor Magenta
        Write-Host "  ═══════════════════════════════════════════" -ForegroundColor DarkMagenta
        Write-Host ""

        try {
            $startupPath = [Environment]::GetFolderPath("Startup")
            $WshShell = New-Object -ComObject WScript.Shell

            $shortcut = $WshShell.CreateShortcut("$startupPath\Biohazard Startup Manager.lnk")
            $shortcut.TargetPath = "powershell.exe"
            $shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Minimized -File `"$scriptDir\StartupManager.ps1`""
            $shortcut.WorkingDirectory = $scriptDir
            $shortcut.IconLocation = "shell32.dll,294"
            $shortcut.Description = "Biohazard Startup Manager"
            $shortcut.Save()
            Write-Step "Ajouté au démarrage automatique" "OK"
        } catch {
            Write-Step "Démarrage automatique: Échec" "FAIL"
        }

        Write-Host ""
    }

    # 6. Créer la configuration par défaut
    Write-Host "  ═══════════════════════════════════════════" -ForegroundColor DarkMagenta
    Write-Host "  CONFIGURATION INITIALE" -ForegroundColor Magenta
    Write-Host "  ═══════════════════════════════════════════" -ForegroundColor DarkMagenta
    Write-Host ""

    $configPath = "$dataPath\startup_config.json"
    if (-not (Test-Path $configPath)) {
        # Exécuter le StartupManager en mode silencieux pour créer la config
        try {
            & "$scriptDir\StartupManager.ps1" -Silent
            Write-Step "Configuration par défaut créée" "OK"
        } catch {
            Write-Step "Configuration: Créée au premier lancement" "SKIP"
        }
    } else {
        Write-Step "Configuration existante conservée" "OK"
    }

    Write-Host ""

    # Résumé
    Write-Host "  ═══════════════════════════════════════════" -ForegroundColor DarkMagenta
    Write-Host "  ☣️  INSTALLATION TERMINÉE  ☣️" -ForegroundColor Green
    Write-Host "  ═══════════════════════════════════════════" -ForegroundColor DarkMagenta
    Write-Host ""
    Write-Host "  Dossier d'installation: $scriptDir" -ForegroundColor Cyan
    Write-Host "  Dossier de données: $dataPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Pour lancer le gestionnaire:" -ForegroundColor White
    Write-Host "    .\BiohazardLauncher.ps1" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Ou depuis PowerShell:" -ForegroundColor White
    Write-Host "    .\CleanShutdownRestart.ps1 -Action Restart" -ForegroundColor Yellow
    Write-Host ""
}

function Uninstall-BiohazardManager {
    Clear-Host
    Write-Host $BiohazardLogo -ForegroundColor Red
    Write-Host ""
    Write-Host "  ═══════════════════════════════════════════" -ForegroundColor DarkRed
    Write-Host "  DÉSINSTALLATION" -ForegroundColor Red
    Write-Host "  ═══════════════════════════════════════════" -ForegroundColor DarkRed
    Write-Host ""

    # Supprimer les raccourcis
    $WshShell = New-Object -ComObject WScript.Shell
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $startMenuPath = [Environment]::GetFolderPath("StartMenu")
    $startupPath = [Environment]::GetFolderPath("Startup")

    $shortcuts = @(
        "$desktopPath\Biohazard PC Manager.lnk",
        "$startMenuPath\Programs\Biohazard PC Manager.lnk",
        "$startupPath\Biohazard Startup Manager.lnk"
    )

    foreach ($shortcut in $shortcuts) {
        if (Test-Path $shortcut) {
            Remove-Item $shortcut -Force
            Write-Step "Supprimé: $shortcut" "OK"
        }
    }

    Write-Host ""
    Write-Host "  ⚠️  Les données dans PCManager n'ont pas été supprimées." -ForegroundColor Yellow
    Write-Host "  Supprimez manuellement: $env:USERPROFILE\Documents\PCManager" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Désinstallation terminée." -ForegroundColor Green
}

# Point d'entrée
if ($Uninstall) {
    Uninstall-BiohazardManager
} else {
    Install-BiohazardManager
}

Write-Host ""
Write-Host "  Appuyez sur une touche pour fermer..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
