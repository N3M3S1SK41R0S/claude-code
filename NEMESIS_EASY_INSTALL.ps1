<#
.SYNOPSIS
    NEMESIS OMEGA V3 - EASY INSTALLER
    Copier-coller ce script pour installer et lancer NEMESIS
#>

#Requires -RunAsAdministrator

$ErrorActionPreference = "SilentlyContinue"

Clear-Host
Write-Host @"

    ███╗   ██╗███████╗███╗   ███╗███████╗███████╗██╗███████╗
    ████╗  ██║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝
    ██╔██╗ ██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗
    ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║
    ██║ ╚████║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║
    ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝

            ⚡ EASY INSTALLER v3.0 ⚡

"@ -ForegroundColor Magenta

$installDir = "C:\NEMESIS"
$repoUrl = "https://github.com/N3M3S1SK41R0S/claude-code.git"
$branch = "claude/system-maintenance-script-Dx0vp"
$scriptName = "NEMESIS_OMEGA_ARCHITECT_V3_ULTIMATE.ps1"

# Méthode 1: Git Clone
function Install-ViaGit {
    Write-Host "📥 Installation via Git..." -ForegroundColor Cyan
    
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Host "⚠️ Git non trouvé, tentative installation via winget..." -ForegroundColor Yellow
        winget install Git.Git --silent --accept-package-agreements 2>$null
        $env:PATH += ";C:\Program Files\Git\bin"
    }
    
    if (Test-Path $installDir) {
        Remove-Item $installDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    git clone -b $branch --single-branch --depth 1 $repoUrl $installDir 2>$null
    
    if (Test-Path "$installDir\$scriptName") {
        return "$installDir\$scriptName"
    }
    return $null
}

# Méthode 2: Download direct
function Install-ViaDownload {
    Write-Host "📥 Téléchargement direct..." -ForegroundColor Cyan
    
    $urls = @(
        "https://raw.githubusercontent.com/N3M3S1SK41R0S/claude-code/$branch/$scriptName",
        "https://cdn.jsdelivr.net/gh/N3M3S1SK41R0S/claude-code@$branch/$scriptName"
    )
    
    if (-not (Test-Path $installDir)) {
        New-Item -Path $installDir -ItemType Directory -Force | Out-Null
    }
    
    $destPath = "$installDir\$scriptName"
    
    foreach ($url in $urls) {
        try {
            # Bypass cache with timestamp
            $cacheBuster = [DateTime]::Now.Ticks
            Invoke-WebRequest -Uri "$url`?v=$cacheBuster" -OutFile $destPath -UseBasicParsing -TimeoutSec 30
            if ((Test-Path $destPath) -and (Get-Item $destPath).Length -gt 10000) {
                return $destPath
            }
        } catch {
            continue
        }
    }
    return $null
}

# Installation
Write-Host ""
$scriptPath = $null

# Essayer Git d'abord
$scriptPath = Install-ViaGit

# Si Git échoue, essayer téléchargement direct
if (-not $scriptPath) {
    $scriptPath = Install-ViaDownload
}

if ($scriptPath -and (Test-Path $scriptPath)) {
    Write-Host ""
    Write-Host "✅ Installation réussie!" -ForegroundColor Green
    Write-Host "📍 Emplacement: $scriptPath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🚀 Lancement de NEMESIS OMEGA V3 ULTIMATE..." -ForegroundColor Yellow
    Write-Host ""
    Start-Sleep -Seconds 2
    
    & $scriptPath
}
else {
    Write-Host ""
    Write-Host "❌ Échec de l'installation automatique" -ForegroundColor Red
    Write-Host ""
    Write-Host "📋 Installation manuelle:" -ForegroundColor Yellow
    Write-Host "   1. Installez Git: winget install Git.Git" -ForegroundColor Gray
    Write-Host "   2. Clonez: git clone -b $branch $repoUrl" -ForegroundColor Gray
    Write-Host "   3. Lancez: .\claude-code\$scriptName" -ForegroundColor Gray
}
