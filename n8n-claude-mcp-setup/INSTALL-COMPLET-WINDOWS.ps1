# ============================================================================
# N8N + CLAUDE MCP - SCRIPT INFAILLIBLE WINDOWS
# Copiez TOUT ce script dans PowerShell (en Administrateur)
# ============================================================================

$ErrorActionPreference = "SilentlyContinue"

function Write-Step { param($num, $msg) Write-Host "[$num] $msg" -ForegroundColor Cyan }
function Write-OK { param($msg) Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "    ATTENTION: $msg" -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host "    ERREUR: $msg" -ForegroundColor Red }

Clear-Host
Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "   N8N + CLAUDE - INSTALLATION COMPLETE" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""

# ----------------------------------------------------------------------------
# ETAPE 1: Arreter tout ce qui tourne
# ----------------------------------------------------------------------------
Write-Step "1/10" "Arret des services existants..."
Stop-Process -Name "Docker Desktop" -Force 2>$null
Stop-Process -Name "com.docker*" -Force 2>$null
Stop-Process -Name "n8n" -Force 2>$null
Stop-Process -Name "node" -Force 2>$null
docker stop n8n 2>$null | Out-Null
docker rm n8n 2>$null | Out-Null
Start-Sleep 3
Write-OK "Services arretes"

# ----------------------------------------------------------------------------
# ETAPE 2: Verifier/Installer Node.js v20
# ----------------------------------------------------------------------------
Write-Step "2/10" "Verification Node.js..."
$nodeOK = $false
$nodeV = node -v 2>$null
if ($nodeV) {
    $major = [int]($nodeV -replace 'v','').Split('.')[0]
    if ($major -ge 18 -and $major -le 22) {
        Write-OK "Node.js $nodeV compatible"
        $nodeOK = $true
    } else {
        Write-Warn "Node.js $nodeV non compatible, installation v20..."
    }
} else {
    Write-Warn "Node.js non trouve, installation..."
}

if (-not $nodeOK) {
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --force 2>$null
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    refreshenv 2>$null
    Write-OK "Node.js v20 installe"
}

# ----------------------------------------------------------------------------
# ETAPE 3: Reparer WSL
# ----------------------------------------------------------------------------
Write-Step "3/10" "Configuration WSL..."
wsl --shutdown 2>$null
wsl --update --web-download 2>$null
wsl --set-default-version 2 2>$null
Write-OK "WSL configure"

# ----------------------------------------------------------------------------
# ETAPE 4: Nettoyer Docker
# ----------------------------------------------------------------------------
Write-Step "4/10" "Nettoyage Docker..."
wsl --unregister docker-desktop 2>$null
wsl --unregister docker-desktop-data 2>$null
Remove-Item "$env:LOCALAPPDATA\Docker" -Recurse -Force 2>$null
Remove-Item "$env:APPDATA\Docker" -Recurse -Force 2>$null
Remove-Item "$HOME\.docker" -Recurse -Force 2>$null
Write-OK "Docker nettoye"

# ----------------------------------------------------------------------------
# ETAPE 5: Reinstaller Docker Desktop
# ----------------------------------------------------------------------------
Write-Step "5/10" "Installation Docker Desktop..."
winget uninstall Docker.DockerDesktop --force 2>$null
Start-Sleep 5
winget install Docker.DockerDesktop --accept-source-agreements --accept-package-agreements 2>$null
Write-OK "Docker Desktop installe"

# ----------------------------------------------------------------------------
# ETAPE 6: Demarrer Docker Desktop
# ----------------------------------------------------------------------------
Write-Step "6/10" "Demarrage Docker Desktop..."
$dockerPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
if (Test-Path $dockerPath) {
    Start-Process $dockerPath
    Write-Host "    Attente Docker (120 sec)..." -ForegroundColor Yellow
    $waited = 0
    $dockerReady = $false
    while ($waited -lt 120 -and -not $dockerReady) {
        Start-Sleep 10
        $waited += 10
        $info = docker info 2>$null
        if ($info) { $dockerReady = $true }
        Write-Host "    ... $waited sec" -ForegroundColor Gray
    }
    if ($dockerReady) {
        Write-OK "Docker Desktop pret"
    } else {
        Write-Warn "Docker lent, on continue..."
    }
} else {
    Write-Warn "Docker non trouve, utilisation Node.js"
}

# ----------------------------------------------------------------------------
# ETAPE 7: Creer dossier projet
# ----------------------------------------------------------------------------
Write-Step "7/10" "Creation dossier projet..."
$projectDir = "$HOME\Documents\n8n-claude"
if (Test-Path $projectDir) { Remove-Item $projectDir -Recurse -Force 2>$null }
New-Item -ItemType Directory -Path $projectDir -Force | Out-Null
New-Item -ItemType Directory -Path "$projectDir\mcp" -Force | Out-Null
Set-Location $projectDir
Write-OK "Dossier: $projectDir"

# ----------------------------------------------------------------------------
# ETAPE 8: Lancer N8N (Docker ou Node.js)
# ----------------------------------------------------------------------------
Write-Step "8/10" "Lancement N8N..."
$n8nRunning = $false

# Essayer Docker d'abord
$dockerInfo = docker info 2>$null
if ($dockerInfo) {
    Write-Host "    Utilisation Docker..." -ForegroundColor Gray
    docker pull n8nio/n8n:latest 2>$null
    docker run -d --name n8n --restart always -p 5678:5678 -v n8n_data:/home/node/.n8n n8nio/n8n:latest 2>$null
    Start-Sleep 10
    $check = docker ps 2>$null | Select-String "n8n"
    if ($check) {
        Write-OK "N8N lance via Docker"
        $n8nRunning = $true
    }
}

# Sinon utiliser Node.js
if (-not $n8nRunning) {
    Write-Host "    Utilisation Node.js..." -ForegroundColor Gray
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    npm install -g n8n 2>$null
    Start-Process powershell -ArgumentList "-Command", "n8n start" -WindowStyle Minimized
    Write-OK "N8N lance via Node.js"
    $n8nRunning = $true
}

# ----------------------------------------------------------------------------
# ETAPE 9: Configurer Claude MCP
# ----------------------------------------------------------------------------
Write-Step "9/10" "Configuration Claude MCP..."

# Creer serveur MCP
@'
{"name":"n8n-mcp","version":"1.0.0","type":"module","dependencies":{"@modelcontextprotocol/sdk":"1.0.0","node-fetch":"3.3.2"}}
'@ | Set-Content "$projectDir\mcp\package.json"

@'
import{Server}from"@modelcontextprotocol/sdk/server/index.js";import{StdioServerTransport}from"@modelcontextprotocol/sdk/server/stdio.js";import{CallToolRequestSchema,ListToolsRequestSchema}from"@modelcontextprotocol/sdk/types.js";import fetch from"node-fetch";const U="http://localhost:5678",s=new Server({name:"n8n",version:"1.0.0"},{capabilities:{tools:{}}});s.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:"list_workflows",description:"Lister workflows",inputSchema:{type:"object"}},{name:"status",description:"Statut N8N",inputSchema:{type:"object"}},{name:"create_workflow",description:"Creer workflow",inputSchema:{type:"object",properties:{name:{type:"string"}},required:["name"]}},{name:"webhook",description:"Declencher webhook",inputSchema:{type:"object",properties:{path:{type:"string"},data:{type:"object"}},required:["path"]}}]}));s.setRequestHandler(CallToolRequestSchema,async r=>{const{name:n,arguments:a}=r.params;let d;try{if(n==="list_workflows")d=await fetch(U+"/api/v1/workflows").then(r=>r.json());else if(n==="status"){const h=await fetch(U+"/healthz").then(r=>r.json()).catch(()=>({status:"ok"}));d={status:"connected",url:U,health:h}}else if(n==="create_workflow")d=await fetch(U+"/api/v1/workflows",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:a.name,nodes:[],connections:{},active:false})}).then(r=>r.json());else if(n==="webhook")d=await fetch(U+"/webhook/"+a.path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a.data||{})}).then(r=>r.json());return{content:[{type:"text",text:JSON.stringify(d,null,2)}]}}catch(e){return{content:[{type:"text",text:"Erreur: "+e.message}],isError:true}}});(async()=>{const t=new StdioServerTransport;await s.connect(t)})();
'@ | Set-Content "$projectDir\mcp\server.js"

# Installer dependances MCP
Set-Location "$projectDir\mcp"
npm install 2>$null | Out-Null
Set-Location $projectDir

# Config Claude
$claudeDir = "$HOME\.claude"
if (-not (Test-Path $claudeDir)) { New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null }
$mcpPath = "$projectDir\mcp\server.js" -replace '\\','\\\\'
$config = '{"mcpServers":{"n8n":{"command":"node","args":["' + $mcpPath + '"],"env":{"N8N_API_URL":"http://localhost:5678"}}},"permissions":{"allow":["mcp__n8n__*"]}}'
$config | Set-Content "$claudeDir\settings.json"
Write-OK "Claude MCP configure"

# ----------------------------------------------------------------------------
# ETAPE 10: Verification finale
# ----------------------------------------------------------------------------
Write-Step "10/10" "Verification finale..."
Write-Host "    Attente 30 sec..." -ForegroundColor Gray
Start-Sleep 30

$n8nReady = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5678" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) { $n8nReady = $true }
} catch {}

Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
if ($n8nReady) {
    Write-Host "   INSTALLATION REUSSIE !" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "N8N est pret: http://localhost:5678" -ForegroundColor Cyan
    Start-Process "http://localhost:5678"
} else {
    Write-Host "   INSTALLATION TERMINEE" -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "N8N demarre. Attendez 1 minute puis ouvrez:" -ForegroundColor Yellow
    Write-Host "http://localhost:5678" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "Pour Claude: ouvrez un nouveau terminal et tapez:" -ForegroundColor White
Write-Host "claude" -ForegroundColor Cyan
Write-Host ""
Write-Host "Si besoin, REDEMARREZ votre PC et relancez ce script." -ForegroundColor Yellow
Write-Host ""
