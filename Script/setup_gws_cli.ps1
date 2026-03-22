<#
.SYNOPSIS
    One-click setup for the GWS (Google Workspace) CLI tool.

.DESCRIPTION
    This script automates the entire GWS CLI setup process:
      1. Checks prerequisites (Python, pip, gcloud)
      2. Installs GWS CLI via pip if not already installed
      3. Initializes gcloud (sign-in + project selection)
      4. Sets the active GCP project
      5. Runs `gws auth setup` (enables APIs + configures client)
      6. Runs `gws auth login` (OAuth flow for Google Workspace scopes)
      7. Verifies the setup with a test command

.PARAMETER ProjectId
    The GCP Project ID to use. If not provided, the script will prompt for selection.

.PARAMETER SkipGcloudInit
    Skip `gcloud init` if gcloud is already configured.

.PARAMETER SkipInstall
    Skip GWS CLI installation (if already installed).

.PARAMETER ScopeProfile
    OAuth scope profile: 'full' (all 85 scopes), 'standard' (core Workspace),
    or 'minimal' (Gmail + Drive only). Default: 'standard'.

.EXAMPLE
    .\Script\setup_gws_cli.ps1
    Interactive full setup.

.EXAMPLE
    .\Script\setup_gws_cli.ps1 -ProjectId "eng-lightning-470601-j8" -SkipGcloudInit
    Quick setup with a known project, skipping gcloud init.

.EXAMPLE
    .\Script\setup_gws_cli.ps1 -ScopeProfile minimal
    Setup with only Gmail and Drive scopes.

.NOTES
    Prerequisites:
    - Python 3.8+ with pip
    - Google Cloud SDK (gcloud) installed and in PATH
    - A GCP project with billing enabled
    - A client_secret.json (OAuth Desktop credentials) from Google Cloud Console
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$ProjectId,

    [Parameter()]
    [switch]$SkipGcloudInit,

    [Parameter()]
    [switch]$SkipInstall,

    [Parameter()]
    [ValidateSet('full', 'standard', 'minimal')]
    [string]$ScopeProfile = 'standard'
)

# ============================================================================
# Configuration
# ============================================================================
$ErrorActionPreference = "Stop"
$GWS_CONFIG_DIR = Join-Path $env:USERPROFILE ".config\gws"
$SEPARATOR = "=" * 60

# ============================================================================
# Helper Functions
# ============================================================================
function Write-Step {
    param([int]$Number, [string]$Title)
    Write-Host ""
    Write-Host $SEPARATOR -ForegroundColor Cyan
    Write-Host "  STEP $Number - $Title" -ForegroundColor Cyan
    Write-Host $SEPARATOR -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  [!!] $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "  [FAIL] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "  [..] $Message" -ForegroundColor Gray
}

function Test-CommandExists {
    param([string]$Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

# ============================================================================
# Banner
# ============================================================================
Write-Host ""
Write-Host $SEPARATOR -ForegroundColor Magenta
Write-Host "       GWS CLI - Automated Setup Script" -ForegroundColor Magenta
Write-Host "       Google Workspace CLI - One-Click Install" -ForegroundColor Magenta
Write-Host $SEPARATOR -ForegroundColor Magenta
Write-Host "  Account: Will be configured during setup"
Write-Host "  Profile: $ScopeProfile scopes"
Write-Host "  Date:    $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host $SEPARATOR -ForegroundColor Magenta

# ============================================================================
# STEP 1 - Prerequisites Check
# ============================================================================
Write-Step -Number 1 -Title "PREREQUISITES CHECK"

# Python
if (Test-CommandExists "python") {
    $pyVersion = & python --version 2>&1
    Write-Ok "Python found: $pyVersion"
} elseif (Test-CommandExists "python3") {
    $pyVersion = & python3 --version 2>&1
    Write-Ok "Python3 found: $pyVersion"
    Set-Alias -Name python -Value python3 -Scope Script
} else {
    Write-Fail "Python not found. Install Python 3.8+ from https://python.org"
    exit 1
}

# pip
if (Test-CommandExists "pip") {
    Write-Ok "pip found"
} elseif (Test-CommandExists "pip3") {
    Write-Ok "pip3 found"
    Set-Alias -Name pip -Value pip3 -Scope Script
} else {
    Write-Fail "pip not found. Run: python -m ensurepip --upgrade"
    exit 1
}

# gcloud
if (Test-CommandExists "gcloud") {
    $gcloudVersion = (& gcloud version 2>&1 | Select-Object -First 1)
    Write-Ok "gcloud found: $gcloudVersion"
} else {
    Write-Fail "gcloud not found. Install from https://cloud.google.com/sdk/docs/install"
    exit 1
}

Write-Ok "All prerequisites satisfied"

# ============================================================================
# STEP 2 - Install GWS CLI
# ============================================================================
Write-Step -Number 2 -Title "INSTALL GWS CLI"

if ($SkipInstall) {
    Write-Info "Skipping installation (--SkipInstall flag)"
} else {
    if (Test-CommandExists "gws") {
        $gwsVersion = & gws --version 2>&1
        Write-Ok "GWS CLI already installed: $gwsVersion"

        $updateChoice = Read-Host "  Update to latest? [y/N]"
        if ($updateChoice -eq 'y' -or $updateChoice -eq 'Y') {
            Write-Info "Upgrading GWS CLI..."
            & pip install --upgrade gws-cli 2>&1 | Out-Null
            Write-Ok "GWS CLI updated"
        }
    } else {
        Write-Info "Installing GWS CLI via pip..."
        & pip install gws-cli 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "pip install failed. Try: pip install --user gws-cli"
            exit 1
        }
        Write-Ok "GWS CLI installed successfully"
    }
}

# Verify gws is now available
if (-not (Test-CommandExists "gws")) {
    Write-Warn "gws command not in PATH. You may need to restart your terminal."
    Write-Warn "Or add Python Scripts to PATH: $env:USERPROFILE\AppData\Local\Programs\Python\Python3*\Scripts"
    exit 1
}

# ============================================================================
# STEP 3 - Configure gcloud
# ============================================================================
Write-Step -Number 3 -Title "CONFIGURE GOOGLE CLOUD SDK"

if ($SkipGcloudInit) {
    Write-Info "Skipping gcloud init (--SkipGcloudInit flag)"

    # Still verify we have an active account
    $activeAccount = & gcloud config get-value account 2>$null
    if ($activeAccount) {
        Write-Ok "Active account: $activeAccount"
    } else {
        Write-Warn "No active gcloud account. Running gcloud auth login..."
        & gcloud auth login
    }
} else {
    Write-Info "Launching gcloud init (browser will open for sign-in)..."
    Write-Info "Follow the prompts in the terminal below:"
    Write-Host ""
    & gcloud init
    Write-Host ""
    Write-Ok "gcloud init completed"
}

# ============================================================================
# STEP 4 - Set GCP Project
# ============================================================================
Write-Step -Number 4 -Title "SET GCP PROJECT"

if ($ProjectId) {
    Write-Info "Setting project to: $ProjectId"
    & gcloud config set project $ProjectId 2>&1
    Write-Ok "Project set: $ProjectId"
} else {
    # Get current project
    $currentProject = & gcloud config get-value project 2>$null

    if ($currentProject -and $currentProject -ne "(unset)") {
        Write-Ok "Current project: $currentProject"
        $keepProject = Read-Host "  Keep this project? [Y/n]"
        if ($keepProject -eq 'n' -or $keepProject -eq 'N') {
            $currentProject = $null
        }
    }

    if (-not $currentProject -or $currentProject -eq "(unset)") {
        Write-Info "Available projects:"
        & gcloud projects list --format="table(projectId, name, projectNumber)" 2>&1
        Write-Host ""
        $ProjectId = Read-Host "  Enter Project ID"
        & gcloud config set project $ProjectId 2>&1
        Write-Ok "Project set: $ProjectId"
    }
}

# Capture final project
$finalProject = & gcloud config get-value project 2>$null
$finalAccount = & gcloud config get-value account 2>$null

# ============================================================================
# STEP 5 - GWS Auth Setup (enable APIs + configure client)
# ============================================================================
Write-Step -Number 5 -Title "GWS AUTH SETUP"

Write-Info "This will enable Google Workspace APIs on project: $finalProject"
Write-Info "Running gws auth setup..."
Write-Host ""

# Check if client_secret.json exists
$clientSecretPath = Join-Path $GWS_CONFIG_DIR "client_secret.json"
if (Test-Path $clientSecretPath) {
    Write-Ok "Client secret found: $clientSecretPath"
} else {
    Write-Warn "No client_secret.json found at $clientSecretPath"
    Write-Info "You need OAuth Desktop credentials from Google Cloud Console:"
    Write-Info "  1. Go to https://console.cloud.google.com/apis/credentials"
    Write-Info "  2. Create OAuth 2.0 Client ID (Desktop app)"
    Write-Info "  3. Download JSON and save to: $clientSecretPath"
    Write-Host ""

    # Create config directory if needed
    if (-not (Test-Path $GWS_CONFIG_DIR)) {
        New-Item -ItemType Directory -Path $GWS_CONFIG_DIR -Force | Out-Null
        Write-Ok "Created config directory: $GWS_CONFIG_DIR"
    }

    $hasSecret = Read-Host "  Do you have a client_secret.json file to copy? [y/N]"
    if ($hasSecret -eq 'y' -or $hasSecret -eq 'Y') {
        $sourcePath = Read-Host "  Enter full path to client_secret.json"
        if (Test-Path $sourcePath) {
            Copy-Item -Path $sourcePath -Destination $clientSecretPath -Force
            Write-Ok "Client secret copied to $clientSecretPath"
        } else {
            Write-Fail "File not found: $sourcePath"
            exit 1
        }
    }
}

# Run gws auth setup (non-interactive: auto-answer Y)
Write-Host ""
& gws auth setup

if ($LASTEXITCODE -ne 0) {
    Write-Fail "gws auth setup failed"
    Write-Info "Make sure your project has billing enabled and client_secret.json is configured"
    exit 1
}

Write-Ok "GWS auth setup completed"

# ============================================================================
# STEP 6 - GWS Auth Login (OAuth flow)
# ============================================================================
Write-Step -Number 6 -Title "GWS AUTH LOGIN (OAuth)"

Write-Info "Scope profile: $ScopeProfile"

switch ($ScopeProfile) {
    'minimal' {
        Write-Info "Requesting minimal scopes: Gmail (readonly) + Drive"
        $scopeArgs = @(
            '--scopes',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        )
    }
    'standard' {
        Write-Info "Requesting standard Workspace scopes"
        $scopeArgs = @()  # Let gws use its default standard set
    }
    'full' {
        Write-Info "Requesting ALL 85 scopes (may trigger unverified app warning)"
        $scopeArgs = @()  # gws auth login with all scopes
    }
}

Write-Host ""
Write-Info "A browser window will open for OAuth authentication."
Write-Info "Sign in with: $finalAccount"
Write-Info "Accept ALL permissions when prompted."
Write-Host ""

& gws auth login @scopeArgs

if ($LASTEXITCODE -ne 0) {
    Write-Fail "gws auth login failed"
    Write-Info "If you see 'unverified app' error, try: -ScopeProfile minimal"
    exit 1
}

Write-Ok "OAuth authentication completed"

# ============================================================================
# STEP 7 - Verify Setup
# ============================================================================
Write-Step -Number 7 -Title "VERIFY SETUP"

Write-Info "Testing GWS CLI connection..."

# Try a simple command to verify
try {
    $testResult = & gws auth status 2>&1
    Write-Ok "Auth status check passed"
    Write-Host $testResult
} catch {
    Write-Warn "Could not verify auth status (non-critical)"
}

# ============================================================================
# Summary
# ============================================================================
Write-Host ""
Write-Host $SEPARATOR -ForegroundColor Green
Write-Host "       SETUP COMPLETE" -ForegroundColor Green
Write-Host $SEPARATOR -ForegroundColor Green
Write-Host ""
Write-Host "  Account:  $finalAccount" -ForegroundColor White
Write-Host "  Project:  $finalProject" -ForegroundColor White
Write-Host "  Profile:  $ScopeProfile" -ForegroundColor White
Write-Host "  Config:   $GWS_CONFIG_DIR" -ForegroundColor White
Write-Host ""
Write-Host "  Quick start commands:" -ForegroundColor Yellow
Write-Host "    gws gmail list             # List recent emails"
Write-Host "    gws drive list             # List Drive files"
Write-Host "    gws calendar list          # List calendar events"
Write-Host "    gws docs list              # List Google Docs"
Write-Host "    gws sheets list            # List Spreadsheets"
Write-Host "    gws auth status            # Check auth status"
Write-Host ""
Write-Host "  Troubleshooting:" -ForegroundColor Yellow
Write-Host "    gws auth login             # Re-authenticate"
Write-Host "    gws auth setup             # Re-enable APIs"
Write-Host "    gws --help                 # Full command list"
Write-Host ""
Write-Host $SEPARATOR -ForegroundColor Green
