@echo off
chcp 65001 >nul 2>&1
title Configuration MCP pour Claude Desktop

:: =============================================================================
:: AUTO-ELEVATION ADMINISTRATEUR
:: =============================================================================
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Demande de privileges administrateur...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: =============================================================================
:: SCRIPT PRINCIPAL EN POWERSHELL EMBARQUE
:: =============================================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
$ErrorActionPreference = 'SilentlyContinue'; ^
^
function W($m,$c='White'){Write-Host $m -ForegroundColor $c}; ^
function OK($m){W \"  [OK] $m\" Green}; ^
function ERR($m){W \"  [X] $m\" Red}; ^
function WARN($m){W \"  [!] $m\" Yellow}; ^
function Step($m){W \"`n=== $m ===\" Cyan}; ^
^
Clear-Host; ^
W '============================================================' Cyan; ^
W '   INSTALLATION MCP AUTOMATIQUE - CLAUDE DESKTOP' Cyan; ^
W '============================================================' Cyan; ^
W ''; ^
^
$mcpDir = \"$env:USERPROFILE\.mcp-servers\"; ^
$venvDir = \"$mcpDir\venv\"; ^
$configPath = \"$env:APPDATA\Claude\claude_desktop_config.json\"; ^
^
Step 'VERIFICATION NODE.JS'; ^
$node = Get-Command node -EA SilentlyContinue; ^
if ($node) { ^
    $v = (node --version 2^>^&1); ^
    OK \"Node.js $v installe\"; ^
    $nodeOk = $true; ^
} else { ^
    WARN 'Node.js non trouve - Installation...'; ^
    if (Get-Command winget -EA SilentlyContinue) { ^
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements; ^
        $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); ^
        if (Get-Command node -EA SilentlyContinue) { OK 'Node.js installe'; $nodeOk = $true } ^
        else { ERR 'Echec installation Node.js'; $nodeOk = $false } ^
    } else { ^
        ERR 'winget non disponible - Installez Node.js manuellement: https://nodejs.org'; ^
        $nodeOk = $false; ^
    } ^
}; ^
^
Step 'VERIFICATION PYTHON'; ^
$py = Get-Command python -EA SilentlyContinue; ^
if ($py) { ^
    $v = (python --version 2^>^&1); ^
    OK \"$v installe\"; ^
    $pyOk = $true; ^
} else { ^
    WARN 'Python non trouve - Installation...'; ^
    if (Get-Command winget -EA SilentlyContinue) { ^
        winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements; ^
        $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'); ^
        if (Get-Command python -EA SilentlyContinue) { OK 'Python installe'; $pyOk = $true } ^
        else { ERR 'Echec installation Python'; $pyOk = $false } ^
    } else { ^
        ERR 'winget non disponible - Installez Python manuellement: https://python.org'; ^
        $pyOk = $false; ^
    } ^
}; ^
^
Step 'CREATION ENVIRONNEMENT VIRTUEL MCP'; ^
if (-not (Test-Path $mcpDir)) { New-Item -ItemType Directory -Path $mcpDir -Force ^| Out-Null }; ^
$venvPy = \"$venvDir\Scripts\python.exe\"; ^
if (Test-Path $venvPy) { ^
    OK \"Venv existe: $venvDir\"; ^
} elseif ($pyOk) { ^
    W '  Creation du venv...' Yellow; ^
    python -m venv $venvDir; ^
    if (Test-Path $venvPy) { ^
        OK 'Venv cree'; ^
        ^& $venvPy -m pip install --upgrade pip -q; ^
        ^& $venvPy -m pip install mcp -q 2^>$null; ^
        OK 'Packages pip installes'; ^
    } else { ERR 'Echec creation venv' } ^
} else { WARN 'Python requis pour le venv' }; ^
^
Step 'INSTALLATION SERVEURS MCP NPM'; ^
if ($nodeOk) { ^
    W '  Installation @modelcontextprotocol/server-filesystem...' Yellow; ^
    npm install -g @modelcontextprotocol/server-filesystem 2^>$null; ^
    W '  Installation @modelcontextprotocol/server-memory...' Yellow; ^
    npm install -g @modelcontextprotocol/server-memory 2^>$null; ^
    OK 'Serveurs MCP npm installes'; ^
} else { WARN 'Node.js requis pour les serveurs npm' }; ^
^
Step 'CONFIGURATION CLAUDE DESKTOP'; ^
$configDir = Split-Path $configPath; ^
if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir -Force ^| Out-Null }; ^
^
$npx = (Get-Command npx -EA SilentlyContinue).Source; ^
if (-not $npx) { $npx = 'npx' }; ^
^
$config = @{ ^
    mcpServers = @{ ^
        filesystem = @{ ^
            command = $npx; ^
            args = @('-y', '@modelcontextprotocol/server-filesystem', \"$env:USERPROFILE\Documents\", \"$env:USERPROFILE\Desktop\") ^
        }; ^
        memory = @{ ^
            command = $npx; ^
            args = @('-y', '@modelcontextprotocol/server-memory') ^
        } ^
    } ^
}; ^
^
if (Test-Path $configPath) { ^
    $backup = \"$configPath.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')\"; ^
    Copy-Item $configPath $backup; ^
    WARN \"Backup: $backup\"; ^
}; ^
^
$config ^| ConvertTo-Json -Depth 10 ^| Out-File $configPath -Encoding UTF8; ^
OK \"Config creee: $configPath\"; ^
^
Step 'VERIFICATION FINALE'; ^
if (Get-Command node -EA SilentlyContinue) { OK 'Node.js: OK' } else { ERR 'Node.js: MANQUANT' }; ^
if (Get-Command python -EA SilentlyContinue) { OK 'Python: OK' } else { ERR 'Python: MANQUANT' }; ^
if (Test-Path \"$venvDir\Scripts\python.exe\") { OK 'Venv MCP: OK' } else { WARN 'Venv MCP: MANQUANT' }; ^
if (Test-Path $configPath) { OK 'Config Claude: OK' } else { ERR 'Config Claude: MANQUANT' }; ^
^
W ''; ^
W '============================================================' Cyan; ^
W '   INSTALLATION TERMINEE!' Green; ^
W '============================================================' Cyan; ^
W ''; ^
W 'Prochaines etapes:' Yellow; ^
W '  1. Redemarrez Claude Desktop'; ^
W '  2. Les serveurs MCP seront disponibles automatiquement'; ^
W ''; ^
W 'Config creee:' Yellow; ^
Get-Content $configPath; ^
W '';

echo.
echo Appuyez sur une touche pour fermer...
pause >nul
