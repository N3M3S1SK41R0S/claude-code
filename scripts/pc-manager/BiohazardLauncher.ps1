<#
.SYNOPSIS
    Interface graphique Biohazard pour la gestion du PC
.DESCRIPTION
    Interface visuelle avec icône Biohazard pour:
    - Arrêt/Redémarrage propre
    - Gestion du démarrage des applications
    - Diagnostic système
.AUTHOR
    Claude Code Assistant
.DATE
    2025-12-30
#>

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# ============================================
# CRÉATION DE L'ICÔNE BIOHAZARD
# ============================================

function New-BiohazardIcon {
    param([int]$Size = 64)

    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $center = $Size / 2
    $radius = $Size * 0.4

    # Couleurs
    $biohazardColor = [System.Drawing.Color]::FromArgb(255, 180, 0, 180)  # Magenta/Violet
    $pen = New-Object System.Drawing.Pen($biohazardColor, ($Size * 0.08))
    $brush = New-Object System.Drawing.SolidBrush($biohazardColor)

    # Cercle central
    $centralRadius = $Size * 0.08
    $graphics.FillEllipse($brush, ($center - $centralRadius), ($center - $centralRadius), ($centralRadius * 2), ($centralRadius * 2))

    # Trois arcs du symbole biohazard
    $arcRadius = $Size * 0.25
    $arcWidth = $Size * 0.15

    for ($i = 0; $i -lt 3; $i++) {
        $angle = $i * 120 - 90
        $radians = $angle * [Math]::PI / 180

        # Position de l'arc
        $arcX = $center + [Math]::Cos($radians) * $arcRadius * 0.5 - $arcRadius
        $arcY = $center + [Math]::Sin($radians) * $arcRadius * 0.5 - $arcRadius

        # Dessiner un arc
        $arcRect = New-Object System.Drawing.RectangleF($arcX, $arcY, $arcRadius * 2, $arcRadius * 2)
        $graphics.DrawArc($pen, $arcRect, ($angle - 60), 120)

        # Cercle à l'extrémité
        $circleX = $center + [Math]::Cos($radians) * $radius * 0.85
        $circleY = $center + [Math]::Sin($radians) * $radius * 0.85
        $circleRadius = $Size * 0.12
        $graphics.FillEllipse($brush, ($circleX - $circleRadius), ($circleY - $circleRadius), ($circleRadius * 2), ($circleRadius * 2))
    }

    # Anneau externe
    $ringPen = New-Object System.Drawing.Pen($biohazardColor, ($Size * 0.04))
    $ringRadius = $Size * 0.42
    $graphics.DrawEllipse($ringPen, ($center - $ringRadius), ($center - $ringRadius), ($ringRadius * 2), ($ringRadius * 2))

    $graphics.Dispose()

    return [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
}

# ============================================
# CRÉATION DU FORMULAIRE PRINCIPAL
# ============================================

function Show-BiohazardManager {
    # Créer le formulaire
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "☣ BIOHAZARD PC MANAGER ☣"
    $form.Size = New-Object System.Drawing.Size(500, 650)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.BackColor = [System.Drawing.Color]::FromArgb(20, 20, 30)
    $form.ForeColor = [System.Drawing.Color]::FromArgb(180, 0, 180)

    # Icône
    try {
        $form.Icon = New-BiohazardIcon -Size 32
    } catch {}

    # ============================================
    # HEADER AVEC LOGO BIOHAZARD
    # ============================================

    $headerPanel = New-Object System.Windows.Forms.Panel
    $headerPanel.Location = New-Object System.Drawing.Point(0, 0)
    $headerPanel.Size = New-Object System.Drawing.Size(500, 120)
    $headerPanel.BackColor = [System.Drawing.Color]::FromArgb(30, 30, 45)

    # Label du logo (emoji biohazard)
    $logoLabel = New-Object System.Windows.Forms.Label
    $logoLabel.Text = "☣"
    $logoLabel.Font = New-Object System.Drawing.Font("Segoe UI Emoji", 48, [System.Drawing.FontStyle]::Bold)
    $logoLabel.ForeColor = [System.Drawing.Color]::FromArgb(200, 0, 200)
    $logoLabel.Location = New-Object System.Drawing.Point(20, 15)
    $logoLabel.Size = New-Object System.Drawing.Size(80, 80)
    $headerPanel.Controls.Add($logoLabel)

    # Titre
    $titleLabel = New-Object System.Windows.Forms.Label
    $titleLabel.Text = "BIOHAZARD"
    $titleLabel.Font = New-Object System.Drawing.Font("Consolas", 28, [System.Drawing.FontStyle]::Bold)
    $titleLabel.ForeColor = [System.Drawing.Color]::FromArgb(200, 0, 200)
    $titleLabel.Location = New-Object System.Drawing.Point(110, 20)
    $titleLabel.AutoSize = $true
    $headerPanel.Controls.Add($titleLabel)

    # Sous-titre
    $subtitleLabel = New-Object System.Windows.Forms.Label
    $subtitleLabel.Text = "PC MANAGEMENT SYSTEM"
    $subtitleLabel.Font = New-Object System.Drawing.Font("Consolas", 12)
    $subtitleLabel.ForeColor = [System.Drawing.Color]::FromArgb(150, 0, 150)
    $subtitleLabel.Location = New-Object System.Drawing.Point(115, 60)
    $subtitleLabel.AutoSize = $true
    $headerPanel.Controls.Add($subtitleLabel)

    # Version
    $versionLabel = New-Object System.Windows.Forms.Label
    $versionLabel.Text = "v1.0.0"
    $versionLabel.Font = New-Object System.Drawing.Font("Consolas", 10)
    $versionLabel.ForeColor = [System.Drawing.Color]::FromArgb(100, 100, 120)
    $versionLabel.Location = New-Object System.Drawing.Point(115, 85)
    $versionLabel.AutoSize = $true
    $headerPanel.Controls.Add($versionLabel)

    $form.Controls.Add($headerPanel)

    # ============================================
    # SECTION ACTIONS SYSTÈME
    # ============================================

    $actionsGroup = New-Object System.Windows.Forms.GroupBox
    $actionsGroup.Text = "☣ ACTIONS SYSTÈME"
    $actionsGroup.Location = New-Object System.Drawing.Point(15, 130)
    $actionsGroup.Size = New-Object System.Drawing.Size(455, 180)
    $actionsGroup.ForeColor = [System.Drawing.Color]::FromArgb(180, 0, 180)
    $actionsGroup.Font = New-Object System.Drawing.Font("Consolas", 11, [System.Drawing.FontStyle]::Bold)

    # Style des boutons
    $buttonStyle = @{
        Width = 200
        Height = 50
        Font = New-Object System.Drawing.Font("Consolas", 11, [System.Drawing.FontStyle]::Bold)
        FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
        BackColor = [System.Drawing.Color]::FromArgb(50, 50, 70)
        ForeColor = [System.Drawing.Color]::White
        Cursor = [System.Windows.Forms.Cursors]::Hand
    }

    # Bouton Redémarrage Propre
    $restartBtn = New-Object System.Windows.Forms.Button
    $restartBtn.Text = "🔄 REDÉMARRAGE PROPRE"
    $restartBtn.Location = New-Object System.Drawing.Point(20, 30)
    $restartBtn.Size = New-Object System.Drawing.Size($buttonStyle.Width, $buttonStyle.Height)
    $restartBtn.Font = $buttonStyle.Font
    $restartBtn.FlatStyle = $buttonStyle.FlatStyle
    $restartBtn.BackColor = [System.Drawing.Color]::FromArgb(60, 60, 100)
    $restartBtn.ForeColor = $buttonStyle.ForeColor
    $restartBtn.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(100, 0, 180)
    $restartBtn.FlatAppearance.BorderSize = 2
    $restartBtn.Add_Click({
        $result = [System.Windows.Forms.MessageBox]::Show(
            "Voulez-vous vraiment redémarrer le PC?`n`nToutes les applications seront fermées proprement.",
            "☣ Confirmation Redémarrage",
            [System.Windows.Forms.MessageBoxButtons]::YesNo,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        )
        if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
            $scriptPath = Join-Path $PSScriptRoot "CleanShutdownRestart.ps1"
            Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$scriptPath`" -Action Restart" -Verb RunAs
        }
    })
    $actionsGroup.Controls.Add($restartBtn)

    # Bouton Arrêt Propre
    $shutdownBtn = New-Object System.Windows.Forms.Button
    $shutdownBtn.Text = "⏻ ARRÊT PROPRE"
    $shutdownBtn.Location = New-Object System.Drawing.Point(230, 30)
    $shutdownBtn.Size = New-Object System.Drawing.Size($buttonStyle.Width, $buttonStyle.Height)
    $shutdownBtn.Font = $buttonStyle.Font
    $shutdownBtn.FlatStyle = $buttonStyle.FlatStyle
    $shutdownBtn.BackColor = [System.Drawing.Color]::FromArgb(100, 50, 50)
    $shutdownBtn.ForeColor = $buttonStyle.ForeColor
    $shutdownBtn.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(180, 0, 0)
    $shutdownBtn.FlatAppearance.BorderSize = 2
    $shutdownBtn.Add_Click({
        $result = [System.Windows.Forms.MessageBox]::Show(
            "Voulez-vous vraiment éteindre le PC?`n`nToutes les applications seront fermées proprement.",
            "☣ Confirmation Arrêt",
            [System.Windows.Forms.MessageBoxButtons]::YesNo,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        )
        if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
            $scriptPath = Join-Path $PSScriptRoot "CleanShutdownRestart.ps1"
            Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$scriptPath`" -Action Shutdown" -Verb RunAs
        }
    })
    $actionsGroup.Controls.Add($shutdownBtn)

    # Bouton Veille Prolongée
    $hibernateBtn = New-Object System.Windows.Forms.Button
    $hibernateBtn.Text = "💤 VEILLE PROLONGÉE"
    $hibernateBtn.Location = New-Object System.Drawing.Point(20, 90)
    $hibernateBtn.Size = New-Object System.Drawing.Size($buttonStyle.Width, $buttonStyle.Height)
    $hibernateBtn.Font = $buttonStyle.Font
    $hibernateBtn.FlatStyle = $buttonStyle.FlatStyle
    $hibernateBtn.BackColor = [System.Drawing.Color]::FromArgb(50, 80, 80)
    $hibernateBtn.ForeColor = $buttonStyle.ForeColor
    $hibernateBtn.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(0, 150, 150)
    $hibernateBtn.FlatAppearance.BorderSize = 2
    $hibernateBtn.Add_Click({
        $scriptPath = Join-Path $PSScriptRoot "CleanShutdownRestart.ps1"
        Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$scriptPath`" -Action Hibernate" -Verb RunAs
    })
    $actionsGroup.Controls.Add($hibernateBtn)

    # Bouton Veille
    $sleepBtn = New-Object System.Windows.Forms.Button
    $sleepBtn.Text = "😴 MISE EN VEILLE"
    $sleepBtn.Location = New-Object System.Drawing.Point(230, 90)
    $sleepBtn.Size = New-Object System.Drawing.Size($buttonStyle.Width, $buttonStyle.Height)
    $sleepBtn.Font = $buttonStyle.Font
    $sleepBtn.FlatStyle = $buttonStyle.FlatStyle
    $sleepBtn.BackColor = [System.Drawing.Color]::FromArgb(50, 70, 90)
    $sleepBtn.ForeColor = $buttonStyle.ForeColor
    $sleepBtn.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(0, 100, 180)
    $sleepBtn.FlatAppearance.BorderSize = 2
    $sleepBtn.Add_Click({
        $scriptPath = Join-Path $PSScriptRoot "CleanShutdownRestart.ps1"
        Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$scriptPath`" -Action Sleep" -Verb RunAs
    })
    $actionsGroup.Controls.Add($sleepBtn)

    $form.Controls.Add($actionsGroup)

    # ============================================
    # SECTION OUTILS
    # ============================================

    $toolsGroup = New-Object System.Windows.Forms.GroupBox
    $toolsGroup.Text = "☣ OUTILS"
    $toolsGroup.Location = New-Object System.Drawing.Point(15, 320)
    $toolsGroup.Size = New-Object System.Drawing.Size(455, 130)
    $toolsGroup.ForeColor = [System.Drawing.Color]::FromArgb(180, 0, 180)
    $toolsGroup.Font = New-Object System.Drawing.Font("Consolas", 11, [System.Drawing.FontStyle]::Bold)

    # Bouton Configurer Démarrage
    $startupConfigBtn = New-Object System.Windows.Forms.Button
    $startupConfigBtn.Text = "⚙ CONFIGURER DÉMARRAGE"
    $startupConfigBtn.Location = New-Object System.Drawing.Point(20, 30)
    $startupConfigBtn.Size = New-Object System.Drawing.Size($buttonStyle.Width, $buttonStyle.Height)
    $startupConfigBtn.Font = $buttonStyle.Font
    $startupConfigBtn.FlatStyle = $buttonStyle.FlatStyle
    $startupConfigBtn.BackColor = [System.Drawing.Color]::FromArgb(70, 70, 50)
    $startupConfigBtn.ForeColor = $buttonStyle.ForeColor
    $startupConfigBtn.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(180, 180, 0)
    $startupConfigBtn.FlatAppearance.BorderSize = 2
    $startupConfigBtn.Add_Click({
        $configPath = "$env:USERPROFILE\Documents\PCManager\startup_config.json"
        if (Test-Path $configPath) {
            Start-Process notepad $configPath
        } else {
            # Lancer le script pour créer la config par défaut
            $scriptPath = Join-Path $PSScriptRoot "StartupManager.ps1"
            Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$scriptPath`" -Silent"
            Start-Sleep -Seconds 2
            if (Test-Path $configPath) {
                Start-Process notepad $configPath
            }
        }
    })
    $toolsGroup.Controls.Add($startupConfigBtn)

    # Bouton Diagnostic Système
    $diagnosticBtn = New-Object System.Windows.Forms.Button
    $diagnosticBtn.Text = "🔍 DIAGNOSTIC SYSTÈME"
    $diagnosticBtn.Location = New-Object System.Drawing.Point(230, 30)
    $diagnosticBtn.Size = New-Object System.Drawing.Size($buttonStyle.Width, $buttonStyle.Height)
    $diagnosticBtn.Font = $buttonStyle.Font
    $diagnosticBtn.FlatStyle = $buttonStyle.FlatStyle
    $diagnosticBtn.BackColor = [System.Drawing.Color]::FromArgb(50, 70, 50)
    $diagnosticBtn.ForeColor = $buttonStyle.ForeColor
    $diagnosticBtn.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(0, 180, 0)
    $diagnosticBtn.FlatAppearance.BorderSize = 2
    $diagnosticBtn.Add_Click({
        $scriptPath = Join-Path $PSScriptRoot "SystemDiagnostic.ps1"
        if (Test-Path $scriptPath) {
            Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -NoExit -File `"$scriptPath`""
        } else {
            [System.Windows.Forms.MessageBox]::Show("Le script de diagnostic n'est pas encore installé.", "☣ Information", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
        }
    })
    $toolsGroup.Controls.Add($diagnosticBtn)

    # Bouton Voir les Logs
    $logsBtn = New-Object System.Windows.Forms.Button
    $logsBtn.Text = "📋 VOIR LES LOGS"
    $logsBtn.Location = New-Object System.Drawing.Point(125, 85)
    $logsBtn.Size = New-Object System.Drawing.Size($buttonStyle.Width, 35)
    $logsBtn.Font = New-Object System.Drawing.Font("Consolas", 10, [System.Drawing.FontStyle]::Bold)
    $logsBtn.FlatStyle = $buttonStyle.FlatStyle
    $logsBtn.BackColor = [System.Drawing.Color]::FromArgb(60, 60, 60)
    $logsBtn.ForeColor = $buttonStyle.ForeColor
    $logsBtn.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(100, 100, 100)
    $logsBtn.FlatAppearance.BorderSize = 1
    $logsBtn.Add_Click({
        $logsPath = "$env:USERPROFILE\Documents\PCManager\Logs"
        if (Test-Path $logsPath) {
            Start-Process explorer $logsPath
        } else {
            [System.Windows.Forms.MessageBox]::Show("Aucun log disponible.", "☣ Information", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
        }
    })
    $toolsGroup.Controls.Add($logsBtn)

    $form.Controls.Add($toolsGroup)

    # ============================================
    # SECTION OPTIONS
    # ============================================

    $optionsGroup = New-Object System.Windows.Forms.GroupBox
    $optionsGroup.Text = "☣ OPTIONS"
    $optionsGroup.Location = New-Object System.Drawing.Point(15, 460)
    $optionsGroup.Size = New-Object System.Drawing.Size(455, 80)
    $optionsGroup.ForeColor = [System.Drawing.Color]::FromArgb(180, 0, 180)
    $optionsGroup.Font = New-Object System.Drawing.Font("Consolas", 11, [System.Drawing.FontStyle]::Bold)

    # Checkbox: Forcer la fermeture
    $forceCheckbox = New-Object System.Windows.Forms.CheckBox
    $forceCheckbox.Text = "Forcer la fermeture des applications"
    $forceCheckbox.Location = New-Object System.Drawing.Point(20, 25)
    $forceCheckbox.Size = New-Object System.Drawing.Size(300, 20)
    $forceCheckbox.Font = New-Object System.Drawing.Font("Consolas", 10)
    $forceCheckbox.ForeColor = [System.Drawing.Color]::FromArgb(200, 200, 200)
    $optionsGroup.Controls.Add($forceCheckbox)

    # Checkbox: Ignorer les mises à jour
    $skipUpdatesCheckbox = New-Object System.Windows.Forms.CheckBox
    $skipUpdatesCheckbox.Text = "Ignorer la vérification des mises à jour"
    $skipUpdatesCheckbox.Location = New-Object System.Drawing.Point(20, 50)
    $skipUpdatesCheckbox.Size = New-Object System.Drawing.Size(300, 20)
    $skipUpdatesCheckbox.Font = New-Object System.Drawing.Font("Consolas", 10)
    $skipUpdatesCheckbox.ForeColor = [System.Drawing.Color]::FromArgb(200, 200, 200)
    $optionsGroup.Controls.Add($skipUpdatesCheckbox)

    $form.Controls.Add($optionsGroup)

    # ============================================
    # FOOTER
    # ============================================

    $footerLabel = New-Object System.Windows.Forms.Label
    $footerLabel.Text = "☣ BIOHAZARD PC MANAGER - Créé par Claude Code Assistant"
    $footerLabel.Location = New-Object System.Drawing.Point(15, 555)
    $footerLabel.Size = New-Object System.Drawing.Size(455, 20)
    $footerLabel.Font = New-Object System.Drawing.Font("Consolas", 9)
    $footerLabel.ForeColor = [System.Drawing.Color]::FromArgb(100, 100, 120)
    $footerLabel.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
    $form.Controls.Add($footerLabel)

    # Animation du logo (effet pulsation)
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 100
    $script:pulseDirection = 1
    $script:pulseValue = 200
    $timer.Add_Tick({
        $script:pulseValue += (5 * $script:pulseDirection)
        if ($script:pulseValue -ge 255) {
            $script:pulseValue = 255
            $script:pulseDirection = -1
        } elseif ($script:pulseValue -le 150) {
            $script:pulseValue = 150
            $script:pulseDirection = 1
        }
        $logoLabel.ForeColor = [System.Drawing.Color]::FromArgb($script:pulseValue, 0, $script:pulseValue)
    })
    $timer.Start()

    # Afficher le formulaire
    [void]$form.ShowDialog()

    $timer.Stop()
    $timer.Dispose()
}

# ============================================
# POINT D'ENTRÉE
# ============================================

Show-BiohazardManager
