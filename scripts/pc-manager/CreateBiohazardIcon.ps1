<#
.SYNOPSIS
    Génère une icône Biohazard en fichier .ico
.DESCRIPTION
    Crée un fichier icône Biohazard pour les raccourcis Windows
#>

param(
    [string]$OutputPath = "$env:USERPROFILE\Documents\PCManager\biohazard.ico",
    [int]$Size = 256
)

Add-Type -AssemblyName System.Drawing

function New-BiohazardIcon {
    param(
        [string]$Path,
        [int]$IconSize = 256
    )

    # Créer le dossier si nécessaire
    $folder = Split-Path $Path -Parent
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
    }

    # Créer le bitmap
    $bitmap = New-Object System.Drawing.Bitmap($IconSize, $IconSize)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Fond transparent/noir
    $graphics.Clear([System.Drawing.Color]::FromArgb(30, 30, 40))

    $center = $IconSize / 2
    $scale = $IconSize / 256  # Échelle de base

    # Couleurs Biohazard (violet/magenta)
    $mainColor = [System.Drawing.Color]::FromArgb(255, 180, 0, 220)
    $darkColor = [System.Drawing.Color]::FromArgb(255, 120, 0, 160)
    $glowColor = [System.Drawing.Color]::FromArgb(100, 200, 0, 255)

    # Pinceaux et stylos
    $mainBrush = New-Object System.Drawing.SolidBrush($mainColor)
    $darkBrush = New-Object System.Drawing.SolidBrush($darkColor)
    $glowBrush = New-Object System.Drawing.SolidBrush($glowColor)

    $thickPen = New-Object System.Drawing.Pen($mainColor, (12 * $scale))
    $thickPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $thickPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $thinPen = New-Object System.Drawing.Pen($mainColor, (6 * $scale))
    $ringPen = New-Object System.Drawing.Pen($mainColor, (8 * $scale))

    # ========================================
    # DESSIN DU SYMBOLE BIOHAZARD
    # ========================================

    # Cercle central (petit cercle au milieu)
    $centralRadius = 18 * $scale
    $graphics.FillEllipse($mainBrush,
        ($center - $centralRadius),
        ($center - $centralRadius),
        ($centralRadius * 2),
        ($centralRadius * 2))

    # Anneau central (autour du cercle central)
    $innerRingRadius = 35 * $scale
    $ringWidth = 12 * $scale
    $innerRingPen = New-Object System.Drawing.Pen($mainColor, $ringWidth)
    $graphics.DrawEllipse($innerRingPen,
        ($center - $innerRingRadius),
        ($center - $innerRingRadius),
        ($innerRingRadius * 2),
        ($innerRingRadius * 2))

    # Les 3 "pétales" du biohazard
    for ($i = 0; $i -lt 3; $i++) {
        $angle = ($i * 120 - 90) * [Math]::PI / 180

        # Grand arc extérieur (forme de croissant)
        $arcRadius = 70 * $scale
        $arcCenterX = $center + [Math]::Cos($angle) * (45 * $scale)
        $arcCenterY = $center + [Math]::Sin($angle) * (45 * $scale)

        # Dessiner l'arc
        $arcRect = New-Object System.Drawing.RectangleF(
            ($arcCenterX - $arcRadius),
            ($arcCenterY - $arcRadius),
            ($arcRadius * 2),
            ($arcRadius * 2))

        $startAngle = (($i * 120) + 30)
        $sweepAngle = 120

        $arcPen = New-Object System.Drawing.Pen($mainColor, (14 * $scale))
        $arcPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $arcPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $graphics.DrawArc($arcPen, $arcRect, $startAngle, $sweepAngle)

        # Cercle à l'extrémité de chaque pétale
        $circleDistance = 95 * $scale
        $circleX = $center + [Math]::Cos($angle) * $circleDistance
        $circleY = $center + [Math]::Sin($angle) * $circleDistance
        $circleRadius = 22 * $scale

        $graphics.FillEllipse($mainBrush,
            ($circleX - $circleRadius),
            ($circleY - $circleRadius),
            ($circleRadius * 2),
            ($circleRadius * 2))
    }

    # Anneau externe
    $outerRingRadius = 115 * $scale
    $outerRingPen = New-Object System.Drawing.Pen($mainColor, (6 * $scale))
    $graphics.DrawEllipse($outerRingPen,
        ($center - $outerRingRadius),
        ($center - $outerRingRadius),
        ($outerRingRadius * 2),
        ($outerRingRadius * 2))

    # ========================================
    # SAUVEGARDE EN ICO
    # ========================================

    # Libérer les ressources graphiques
    $graphics.Dispose()

    # Convertir en icône et sauvegarder
    $icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())

    # Sauvegarder comme fichier ICO
    $fileStream = [System.IO.File]::Create($Path)
    $icon.Save($fileStream)
    $fileStream.Close()

    # Aussi sauvegarder comme PNG pour référence
    $pngPath = $Path -replace '\.ico$', '.png'
    $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $bitmap.Dispose()

    Write-Host "Icône créée: $Path" -ForegroundColor Green
    Write-Host "PNG créé: $pngPath" -ForegroundColor Green

    return $Path
}

# Exécuter
New-BiohazardIcon -Path $OutputPath -IconSize $Size
