<#
.SYNOPSIS
    ☣️ DÉPLOIEMENT COMPLET DU BIOHAZARD PC MANAGER
.DESCRIPTION
    - Crée l'icône Biohazard personnalisée
    - Installe les raccourcis sur le Bureau
    - Configure le démarrage automatique
    - Met en service le système complet
.NOTES
    Exécuter en tant qu'Administrateur pour toutes les fonctionnalités
#>

param(
    [switch]$NoDesktopShortcut,
    [switch]$NoStartMenu,
    [switch]$NoAutoStart,
    [switch]$Uninstall
)

# ============================================
# CONFIGURATION
# ============================================

$ErrorActionPreference = "Continue"
$ScriptDir = $PSScriptRoot
$DataDir = "$env:USERPROFILE\Documents\PCManager"
$IconPath = "$DataDir\biohazard.ico"

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

# ============================================
# LOGO ET INTERFACE
# ============================================

$Logo = @"

    ███████████████████████████████████████████████
    █                                             █
    █     ░░░░░░░▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄░░░░░░░          █
    █     ░░░░▄██▀▀▀░░░░░░░░░▀▀▀██▄░░░░          █
    █     ░░▄█▀░░░░▄▄▄███████▄▄▄░░░▀█▄░░          █
    █     ░█▀░░░▄██▀▀▀░░░░░░░▀▀▀██▄░░▀█░          █
    █     █▀░░▄█▀░░░▄▄█████▄▄░░░▀█▄░░▀█          █
    █     █░░██░░░▄█▀░░░░░░░▀█▄░░░██░░█          █
    █     █░██░░░█▀░░▄█████▄░░▀█░░░██░█          █
    █     █░██░░░█░░█▀░░░░░▀█░░█░░░██░█          █
    █     █░██░░░█░░█░ ☣️ ░█░░█░░░██░█          █
    █     █░██░░░█░░█▄░░░░░▄█░░█░░░██░█          █
    █     █░██░░░█▄░░▀█████▀░░▄█░░░██░█          █
    █     █░░██░░░▀█▄░░░░░░░▄█▀░░░██░░█          █
    █     █▄░░▀█▄░░░▀██▄▄▄██▀░░░▄█▀░░▄█          █
    █     ░█▄░░░▀██▄░░░░░░░░░▄██▀░░░▄█░          █
    █     ░░▀█▄░░░░▀▀███████▀▀░░░░▄█▀░░          █
    █     ░░░░▀██▄▄░░░░░░░░░░░▄▄██▀░░░░          █
    █     ░░░░░░░▀▀▀█████████▀▀▀░░░░░░░          █
    █                                             █
    █       ☣️  BIOHAZARD PC MANAGER  ☣️         █
    █           DÉPLOIEMENT v1.0                  █
    █                                             █
    ███████████████████████████████████████████████

"@

function Write-Banner {
    Clear-Host
    Write-Host $Logo -ForegroundColor Magenta
}

function Write-Step {
    param(
        [string]$Message,
        [ValidateSet("WAIT", "OK", "FAIL", "SKIP", "INFO")]
        [string]$Status = "WAIT"
    )

    $icon = switch ($Status) {
        "WAIT" { "⏳"; $color = "Cyan" }
        "OK"   { "✅"; $color = "Green" }
        "FAIL" { "❌"; $color = "Red" }
        "SKIP" { "⏭️"; $color = "Yellow" }
        "INFO" { "ℹ️"; $color = "White" }
    }

    Write-Host "  $icon " -NoNewline -ForegroundColor $color
    Write-Host $Message -ForegroundColor White
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "  ╔════════════════════════════════════════════════════════╗" -ForegroundColor DarkMagenta
    Write-Host "  ║ ☣️  $($Title.ToUpper().PadRight(50)) ║" -ForegroundColor Magenta
    Write-Host "  ╚════════════════════════════════════════════════════════╝" -ForegroundColor DarkMagenta
    Write-Host ""
}

# ============================================
# CRÉATION DE L'ICÔNE BIOHAZARD
# ============================================

function New-BiohazardIconFile {
    param([string]$Path)

    Write-Step "Génération de l'icône Biohazard..." "WAIT"

    try {
        $sizes = @(16, 32, 48, 64, 128, 256)
        $bitmaps = @()

        foreach ($size in $sizes) {
            $bitmap = New-Object System.Drawing.Bitmap($size, $size)
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.Clear([System.Drawing.Color]::FromArgb(25, 25, 35))

            $center = $size / 2
            $scale = $size / 256

            # Couleur principale
            $color = [System.Drawing.Color]::FromArgb(255, 200, 0, 230)
            $brush = New-Object System.Drawing.SolidBrush($color)

            # Cercle central
            $r1 = 18 * $scale
            $graphics.FillEllipse($brush, ($center - $r1), ($center - $r1), ($r1 * 2), ($r1 * 2))

            # Anneau central
            $r2 = 35 * $scale
            $pen = New-Object System.Drawing.Pen($color, (10 * $scale))
            $graphics.DrawEllipse($pen, ($center - $r2), ($center - $r2), ($r2 * 2), ($r2 * 2))

            # 3 pétales
            for ($i = 0; $i -lt 3; $i++) {
                $angle = ($i * 120 - 90) * [Math]::PI / 180

                # Arc
                $arcR = 65 * $scale
                $arcX = $center + [Math]::Cos($angle) * (40 * $scale) - $arcR
                $arcY = $center + [Math]::Sin($angle) * (40 * $scale) - $arcR
                $arcRect = New-Object System.Drawing.RectangleF($arcX, $arcY, ($arcR * 2), ($arcR * 2))
                $arcPen = New-Object System.Drawing.Pen($color, (12 * $scale))
                $graphics.DrawArc($arcPen, $arcRect, ($i * 120 + 30), 120)

                # Cercle au bout
                $cDist = 90 * $scale
                $cX = $center + [Math]::Cos($angle) * $cDist
                $cY = $center + [Math]::Sin($angle) * $cDist
                $cR = 20 * $scale
                $graphics.FillEllipse($brush, ($cX - $cR), ($cY - $cR), ($cR * 2), ($cR * 2))
            }

            # Anneau externe
            $r3 = 110 * $scale
            $outerPen = New-Object System.Drawing.Pen($color, (5 * $scale))
            $graphics.DrawEllipse($outerPen, ($center - $r3), ($center - $r3), ($r3 * 2), ($r3 * 2))

            $graphics.Dispose()
            $bitmaps += $bitmap
        }

        # Créer le fichier ICO avec la plus grande taille
        $mainBitmap = $bitmaps[-1]  # 256x256
        $hIcon = $mainBitmap.GetHicon()
        $icon = [System.Drawing.Icon]::FromHandle($hIcon)

        # Sauvegarder
        $folder = Split-Path $Path -Parent
        if (-not (Test-Path $folder)) {
            New-Item -ItemType Directory -Path $folder -Force | Out-Null
        }

        $fs = [System.IO.File]::Create($Path)
        $icon.Save($fs)
        $fs.Close()

        # Sauvegarder aussi en PNG
        $pngPath = $Path -replace '\.ico$', '.png'
        $mainBitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

        # Nettoyer
        foreach ($bmp in $bitmaps) { $bmp.Dispose() }

        Write-Step "Icône créée: $Path" "OK"
        return $true

    } catch {
        Write-Step "Erreur création icône: $_" "FAIL"
        return $false
    }
}

# ============================================
# CRÉATION DES RACCOURCIS
# ============================================

function New-Shortcut {
    param(
        [string]$ShortcutPath,
        [string]$TargetScript,
        [string]$IconPath,
        [string]$Description,
        [switch]$RunAsAdmin
    )

    try {
        $WshShell = New-Object -ComObject WScript.Shell
        $shortcut = $WshShell.CreateShortcut($ShortcutPath)

        $shortcut.TargetPath = "powershell.exe"
        $shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$TargetScript`""
        $shortcut.WorkingDirectory = $ScriptDir

        if (Test-Path $IconPath) {
            $shortcut.IconLocation = "$IconPath,0"
        }

        $shortcut.Description = $Description
        $shortcut.Save()

        # Si RunAsAdmin, modifier les propriétés
        if ($RunAsAdmin) {
            $bytes = [System.IO.File]::ReadAllBytes($ShortcutPath)
            $bytes[0x15] = $bytes[0x15] -bor 0x20  # Set "Run as Administrator" flag
            [System.IO.File]::WriteAllBytes($ShortcutPath, $bytes)
        }

        return $true
    } catch {
        return $false
    }
}

# ============================================
# INSTALLATION PRINCIPALE
# ============================================

function Install-BiohazardManager {
    Write-Banner

    # Vérifier les privilèges admin
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

    if (-not $isAdmin) {
        Write-Host ""
        Write-Host "  ⚠️  ATTENTION: Exécutez en tant qu'Administrateur" -ForegroundColor Yellow
        Write-Host "      pour toutes les fonctionnalités." -ForegroundColor Yellow
        Write-Host ""
        Start-Sleep -Seconds 2
    }

    # ========================================
    # 1. VÉRIFICATION DES FICHIERS
    # ========================================
    Write-Section "VÉRIFICATION DES FICHIERS"

    $requiredFiles = @(
        "BiohazardLauncher.ps1",
        "CleanShutdownRestart.ps1",
        "StartupManager.ps1",
        "SystemDiagnostic.ps1"
    )

    $allPresent = $true
    foreach ($file in $requiredFiles) {
        $path = Join-Path $ScriptDir $file
        if (Test-Path $path) {
            Write-Step $file "OK"
        } else {
            Write-Step "$file - MANQUANT!" "FAIL"
            $allPresent = $false
        }
    }

    if (-not $allPresent) {
        Write-Host ""
        Write-Host "  ❌ Fichiers manquants. Installation annulée." -ForegroundColor Red
        return
    }

    # ========================================
    # 2. CRÉATION DES DOSSIERS
    # ========================================
    Write-Section "CRÉATION DES DOSSIERS"

    $folders = @(
        $DataDir,
        "$DataDir\Logs",
        "$DataDir\Reports"
    )

    foreach ($folder in $folders) {
        if (-not (Test-Path $folder)) {
            New-Item -ItemType Directory -Path $folder -Force | Out-Null
            Write-Step "Créé: $folder" "OK"
        } else {
            Write-Step "Existe: $folder" "OK"
        }
    }

    # ========================================
    # 3. CRÉATION DE L'ICÔNE
    # ========================================
    Write-Section "CRÉATION DE L'ICÔNE BIOHAZARD"

    $iconCreated = New-BiohazardIconFile -Path $IconPath

    # ========================================
    # 4. RACCOURCI BUREAU
    # ========================================
    if (-not $NoDesktopShortcut) {
        Write-Section "RACCOURCI BUREAU"

        $desktopPath = [Environment]::GetFolderPath("Desktop")
        $shortcutPath = "$desktopPath\☣ Biohazard PC Manager.lnk"
        $targetScript = Join-Path $ScriptDir "BiohazardLauncher.ps1"

        Write-Step "Création du raccourci Bureau..." "WAIT"

        if (New-Shortcut -ShortcutPath $shortcutPath -TargetScript $targetScript -IconPath $IconPath -Description "Biohazard PC Manager") {
            Write-Step "Raccourci créé sur le Bureau" "OK"
        } else {
            Write-Step "Erreur création raccourci Bureau" "FAIL"
        }
    }

    # ========================================
    # 5. MENU DÉMARRER
    # ========================================
    if (-not $NoStartMenu) {
        Write-Section "MENU DÉMARRER"

        $startMenuPath = [Environment]::GetFolderPath("StartMenu")
        $programsPath = Join-Path $startMenuPath "Programs\Biohazard PC Manager"

        if (-not (Test-Path $programsPath)) {
            New-Item -ItemType Directory -Path $programsPath -Force | Out-Null
        }

        # Raccourci principal
        $mainShortcut = "$programsPath\Biohazard PC Manager.lnk"
        if (New-Shortcut -ShortcutPath $mainShortcut -TargetScript (Join-Path $ScriptDir "BiohazardLauncher.ps1") -IconPath $IconPath -Description "Interface principale") {
            Write-Step "Menu Démarrer: Interface principale" "OK"
        }

        # Raccourci Diagnostic
        $diagShortcut = "$programsPath\Diagnostic Système.lnk"
        if (New-Shortcut -ShortcutPath $diagShortcut -TargetScript (Join-Path $ScriptDir "SystemDiagnostic.ps1") -IconPath $IconPath -Description "Diagnostic système") {
            Write-Step "Menu Démarrer: Diagnostic" "OK"
        }

        # Raccourci Redémarrage rapide
        $restartShortcut = "$programsPath\Redémarrage Propre.lnk"
        if (New-Shortcut -ShortcutPath $restartShortcut -TargetScript (Join-Path $ScriptDir "CleanShutdownRestart.ps1") -IconPath $IconPath -Description "Redémarrage propre") {
            Write-Step "Menu Démarrer: Redémarrage" "OK"
        }
    }

    # ========================================
    # 6. DÉMARRAGE AUTOMATIQUE
    # ========================================
    if (-not $NoAutoStart) {
        Write-Section "DÉMARRAGE AUTOMATIQUE"

        Write-Host "  Voulez-vous que le gestionnaire de démarrage" -ForegroundColor Cyan
        Write-Host "  s'exécute automatiquement au démarrage de Windows?" -ForegroundColor Cyan
        Write-Host ""
        $response = Read-Host "  [O]ui / [N]on"

        if ($response -match "^[OoYy]") {
            $startupPath = [Environment]::GetFolderPath("Startup")
            $startupShortcut = "$startupPath\Biohazard Startup Manager.lnk"

            if (New-Shortcut -ShortcutPath $startupShortcut -TargetScript (Join-Path $ScriptDir "StartupManager.ps1") -IconPath $IconPath -Description "Démarrage automatique des applications") {
                Write-Step "Ajouté au démarrage Windows" "OK"
            } else {
                Write-Step "Erreur ajout démarrage auto" "FAIL"
            }
        } else {
            Write-Step "Démarrage auto ignoré" "SKIP"
        }
    }

    # ========================================
    # 7. CONFIGURATION INITIALE
    # ========================================
    Write-Section "CONFIGURATION INITIALE"

    $configPath = "$DataDir\startup_config.json"
    if (-not (Test-Path $configPath)) {
        Write-Step "Création de la configuration par défaut..." "WAIT"
        try {
            # Lancer le script pour créer la config
            & (Join-Path $ScriptDir "StartupManager.ps1") -Silent
            Start-Sleep -Seconds 2
            Write-Step "Configuration créée" "OK"
        } catch {
            Write-Step "Config sera créée au premier lancement" "SKIP"
        }
    } else {
        Write-Step "Configuration existante conservée" "OK"
    }

    # ========================================
    # RÉSUMÉ FINAL
    # ========================================
    Write-Host ""
    Write-Host "  ╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "  ║                                                        ║" -ForegroundColor Green
    Write-Host "  ║     ☣️  INSTALLATION TERMINÉE AVEC SUCCÈS  ☣️        ║" -ForegroundColor Green
    Write-Host "  ║                                                        ║" -ForegroundColor Green
    Write-Host "  ╚════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "  📁 Dossier d'installation: $ScriptDir" -ForegroundColor Cyan
    Write-Host "  📁 Dossier de données: $DataDir" -ForegroundColor Cyan
    Write-Host "  🎨 Icône: $IconPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  ═══════════════════════════════════════════════════════" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  Pour lancer le gestionnaire:" -ForegroundColor White
    Write-Host "    • Double-cliquez sur le raccourci Bureau" -ForegroundColor Yellow
    Write-Host "    • Ou Menu Démarrer → Biohazard PC Manager" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Commandes PowerShell:" -ForegroundColor White
    Write-Host "    .\BiohazardLauncher.ps1        # Interface graphique" -ForegroundColor Gray
    Write-Host "    .\CleanShutdownRestart.ps1     # Redémarrage propre" -ForegroundColor Gray
    Write-Host "    .\SystemDiagnostic.ps1         # Diagnostic système" -ForegroundColor Gray
    Write-Host ""
}

# ============================================
# DÉSINSTALLATION
# ============================================

function Uninstall-BiohazardManager {
    Write-Banner
    Write-Host ""
    Write-Host "  ⚠️  DÉSINSTALLATION EN COURS..." -ForegroundColor Red
    Write-Host ""

    # Supprimer les raccourcis
    $shortcuts = @(
        "$([Environment]::GetFolderPath('Desktop'))\☣ Biohazard PC Manager.lnk",
        "$([Environment]::GetFolderPath('Startup'))\Biohazard Startup Manager.lnk"
    )

    $startMenuFolder = "$([Environment]::GetFolderPath('StartMenu'))\Programs\Biohazard PC Manager"

    foreach ($shortcut in $shortcuts) {
        if (Test-Path $shortcut) {
            Remove-Item $shortcut -Force
            Write-Step "Supprimé: $shortcut" "OK"
        }
    }

    if (Test-Path $startMenuFolder) {
        Remove-Item $startMenuFolder -Recurse -Force
        Write-Step "Supprimé: Menu Démarrer" "OK"
    }

    Write-Host ""
    Write-Host "  ℹ️  Les données dans $DataDir n'ont pas été supprimées." -ForegroundColor Yellow
    Write-Host "     Supprimez manuellement si nécessaire." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  ✅ Désinstallation terminée." -ForegroundColor Green
}

# ============================================
# POINT D'ENTRÉE
# ============================================

if ($Uninstall) {
    Uninstall-BiohazardManager
} else {
    Install-BiohazardManager
}

Write-Host ""
Write-Host "  Appuyez sur une touche pour fermer..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
