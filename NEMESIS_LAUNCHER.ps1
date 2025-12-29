<#
.SYNOPSIS
    NEMESIS OMEGA V3 ULTIMATE - LAUNCHER
    Script de lancement automatique depuis GitHub
#>

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Write-Host @"

    ███╗   ██╗███████╗███╗   ███╗███████╗███████╗██╗███████╗
    ████╗  ██║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝
    ██╔██╗ ██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗
    ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║
    ██║ ╚████║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║
    ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝

              ⚡ LAUNCHER ULTIMATE ⚡

"@ -ForegroundColor Magenta

$scriptUrl = "https://raw.githubusercontent.com/N3M3S1SK41R0S/claude-code/claude/system-maintenance-script-Dx0vp/NEMESIS_OMEGA_ARCHITECT_V3_ULTIMATE.ps1"
$localPath = Join-Path $env:TEMP "NEMESIS_OMEGA_V3.ps1"

try {
    Write-Host "📥 Téléchargement du script..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $scriptUrl -OutFile $localPath -UseBasicParsing

    Write-Host "✅ Téléchargé: $localPath" -ForegroundColor Green
    Write-Host "🚀 Lancement NEMESIS OMEGA V3 ULTIMATE..." -ForegroundColor Yellow
    Write-Host ""

    & $localPath @args
}
catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Alternative - Téléchargement manuel:" -ForegroundColor Yellow
    Write-Host "   git clone -b claude/system-maintenance-script-Dx0vp https://github.com/N3M3S1SK41R0S/claude-code.git" -ForegroundColor Gray
}
