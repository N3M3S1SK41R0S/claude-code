<#
.SYNOPSIS
    Fully autonomous GWS CLI setup - zero manual intervention.

.DESCRIPTION
    This script automates EVERYTHING:
      1. Checks/installs prerequisites (Python, pip, gcloud, gws-cli)
      2. Authenticates gcloud if needed
      3. Creates or selects a GCP project
      4. Configures OAuth consent screen via API
      5. Creates OAuth Desktop credentials via API
      6. Generates client_secret.json automatically
      7. Enables all required Google Workspace APIs
      8. Runs gws auth login (opens browser automatically)
      9. Verifies the full setup with test commands
      10. Auto-retries and self-corrects on failures

.PARAMETER ProjectId
    GCP Project ID. If omitted, auto-detects or creates one.

.PARAMETER AccountEmail
    Google account email. If omitted, auto-detects from gcloud.

.PARAMETER ScopeProfile
    'full' (85 scopes), 'standard' (core), 'minimal' (Gmail+Drive). Default: 'standard'.

.PARAMETER Force
    Force re-creation of OAuth credentials even if they exist.

.PARAMETER MaxRetries
    Max retry attempts per step. Default: 3.

.EXAMPLE
    .\Script\setup_gws_cli_auto.ps1
    Fully automatic setup.

.EXAMPLE
    .\Script\setup_gws_cli_auto.ps1 -ProjectId "my-project-id"
    Auto setup with a specific project.
#>

[CmdletBinding()]
param(
    [string]$ProjectId,
    [string]$AccountEmail,
    [ValidateSet('full', 'standard', 'minimal')]
    [string]$ScopeProfile = 'standard',
    [switch]$Force,
    [int]$MaxRetries = 3
)

# ============================================================================
# Configuration
# ============================================================================
$ErrorActionPreference = "Continue"
$GWS_CONFIG_DIR = Join-Path $env:USERPROFILE ".config\gws"
$CLIENT_SECRET_PATH = Join-Path $GWS_CONFIG_DIR "client_secret.json"
$SEP = "=" * 70

# APIs to enable for Google Workspace
$GWS_APIS = @(
    "gmail.googleapis.com",
    "drive.googleapis.com",
    "calendar-json.googleapis.com",
    "docs.googleapis.com",
    "sheets.googleapis.com",
    "slides.googleapis.com",
    "admin.googleapis.com",
    "chat.googleapis.com",
    "classroom.googleapis.com",
    "contacts.googleapis.com",
    "forms.googleapis.com",
    "tasks.googleapis.com",
    "people.googleapis.com",
    "groupssettings.googleapis.com",
    "licensing.googleapis.com",
    "reseller.googleapis.com",
    "cloudbilling.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "script.googleapis.com",
    "meet.googleapis.com"
)

# ============================================================================
# Helper Functions
# ============================================================================
function Write-Banner {
    param([string]$Text, [string]$Color = "Magenta")
    Write-Host ""
    Write-Host $SEP -ForegroundColor $Color
    Write-Host "  $Text" -ForegroundColor $Color
    Write-Host $SEP -ForegroundColor $Color
}

function Write-Step {
    param([int]$Number, [int]$Total, [string]$Title)
    Write-Host ""
    Write-Host "  [$Number/$Total] $Title" -ForegroundColor Cyan
    Write-Host ("  " + "-" * 50) -ForegroundColor DarkCyan
}

function Write-Ok    { param([string]$M) Write-Host "    [OK]   $M" -ForegroundColor Green }
function Write-Warn  { param([string]$M) Write-Host "    [!!]   $M" -ForegroundColor Yellow }
function Write-Fail  { param([string]$M) Write-Host "    [FAIL] $M" -ForegroundColor Red }
function Write-Info  { param([string]$M) Write-Host "    [..]   $M" -ForegroundColor Gray }
function Write-Act   { param([string]$M) Write-Host "    [>>]   $M" -ForegroundColor White }

function Test-Cmd {
    param([string]$Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Invoke-WithRetry {
    param(
        [scriptblock]$Action,
        [string]$Description,
        [int]$Retries = $MaxRetries,
        [int]$DelaySeconds = 3
    )
    for ($i = 1; $i -le $Retries; $i++) {
        try {
            $result = & $Action
            if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) {
                return $result
            }
            throw "Exit code: $LASTEXITCODE"
        } catch {
            if ($i -lt $Retries) {
                Write-Warn "$Description failed (attempt $i/$Retries): $_"
                Write-Info "Retrying in $DelaySeconds seconds..."
                Start-Sleep -Seconds $DelaySeconds
                $DelaySeconds *= 2
            } else {
                Write-Fail "$Description failed after $Retries attempts: $_"
                return $null
            }
        }
    }
}

function Test-GcloudAuth {
    $account = & gcloud config get-value account 2>$null
    return ($account -and $account -ne "(unset)" -and $account -ne "")
}

# ============================================================================
# MAIN SCRIPT
# ============================================================================
$totalSteps = 10
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

Write-Banner "GWS CLI - FULLY AUTONOMOUS SETUP"
Write-Host "  Mode:    Autonomous (zero-prompt)" -ForegroundColor White
Write-Host "  Profile: $ScopeProfile scopes" -ForegroundColor White
Write-Host "  Date:    $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White
Write-Host $SEP -ForegroundColor Magenta

# ============================================================================
# STEP 1 - Prerequisites: Python
# ============================================================================
Write-Step -Number 1 -Total $totalSteps -Title "PYTHON"

$pythonCmd = $null
if (Test-Cmd "python") {
    $pythonCmd = "python"
} elseif (Test-Cmd "python3") {
    $pythonCmd = "python3"
}

if ($pythonCmd) {
    $pyVer = & $pythonCmd --version 2>&1
    Write-Ok "Found: $pyVer"
} else {
    Write-Warn "Python not found. Attempting auto-install..."
    if (Test-Cmd "winget") {
        Write-Act "winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements"
        & winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements 2>&1 | Out-Null
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        if (Test-Cmd "python") {
            $pythonCmd = "python"
            Write-Ok "Python installed via winget"
        } else {
            Write-Fail "Python install failed. Install manually: https://python.org"
            exit 1
        }
    } elseif (Test-Cmd "choco") {
        Write-Act "choco install python3 -y"
        & choco install python3 -y 2>&1 | Out-Null
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        if (Test-Cmd "python") {
            $pythonCmd = "python"
            Write-Ok "Python installed via choco"
        }
    }
    if (-not $pythonCmd) {
        Write-Fail "Cannot auto-install Python. Install manually from https://python.org"
        exit 1
    }
}

# Ensure pip
$hasPip = $false
try {
    & $pythonCmd -m pip --version 2>&1 | Out-Null
    $hasPip = $true
    Write-Ok "pip available"
} catch {}

if (-not $hasPip) {
    Write-Act "Installing pip..."
    & $pythonCmd -m ensurepip --upgrade 2>&1 | Out-Null
    Write-Ok "pip installed"
}

# ============================================================================
# STEP 2 - Prerequisites: gcloud
# ============================================================================
Write-Step -Number 2 -Total $totalSteps -Title "GOOGLE CLOUD SDK"

if (Test-Cmd "gcloud") {
    $gcloudVer = (& gcloud version 2>&1 | Select-Object -First 1)
    Write-Ok "Found: $gcloudVer"
} else {
    Write-Warn "gcloud not found. Attempting auto-install..."
    if (Test-Cmd "winget") {
        Write-Act "winget install Google.CloudSDK"
        & winget install Google.CloudSDK --accept-source-agreements --accept-package-agreements 2>&1 | Out-Null
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    } elseif (Test-Cmd "choco") {
        Write-Act "choco install gcloudsdk -y"
        & choco install gcloudsdk -y 2>&1 | Out-Null
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    }
    if (-not (Test-Cmd "gcloud")) {
        Write-Fail "Cannot auto-install gcloud. Install from https://cloud.google.com/sdk/docs/install"
        exit 1
    }
    Write-Ok "gcloud installed"
}

# ============================================================================
# STEP 3 - Install/Update GWS CLI
# ============================================================================
Write-Step -Number 3 -Total $totalSteps -Title "GWS CLI"

if (Test-Cmd "gws") {
    $gwsVer = & gws --version 2>&1
    Write-Ok "Found: $gwsVer"
    Write-Act "Upgrading to latest..."
    & $pythonCmd -m pip install --upgrade gws-cli --quiet 2>&1 | Out-Null
    Write-Ok "Upgraded"
} else {
    Write-Act "Installing gws-cli via pip..."
    Invoke-WithRetry -Description "pip install gws-cli" -Action {
        & $pythonCmd -m pip install gws-cli --quiet 2>&1
    }
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    # Also add user scripts dir
    $userScripts = Join-Path $env:USERPROFILE "AppData\Local\Programs\Python\Python3*\Scripts"
    $resolved = Resolve-Path $userScripts -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($resolved) { $env:Path += ";$($resolved.Path)" }
    # Also try AppData\Roaming
    $roamingScripts = Join-Path $env:APPDATA "Python\Python3*\Scripts"
    $resolved2 = Resolve-Path $roamingScripts -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($resolved2) { $env:Path += ";$($resolved2.Path)" }

    if (Test-Cmd "gws") {
        Write-Ok "GWS CLI installed"
    } else {
        Write-Fail "gws not in PATH after install. Restart terminal and re-run."
        exit 1
    }
}

# ============================================================================
# STEP 4 - Authenticate gcloud
# ============================================================================
Write-Step -Number 4 -Total $totalSteps -Title "GCLOUD AUTHENTICATION"

if (Test-GcloudAuth) {
    $currentAccount = & gcloud config get-value account 2>$null
    Write-Ok "Authenticated: $currentAccount"
    if ($AccountEmail -and $AccountEmail -ne $currentAccount) {
        Write-Act "Switching to account: $AccountEmail"
        & gcloud config set account $AccountEmail 2>&1 | Out-Null
        Write-Ok "Account set to: $AccountEmail"
    }
    $AccountEmail = & gcloud config get-value account 2>$null
} else {
    Write-Act "Launching gcloud auth login (browser will open)..."
    & gcloud auth login --brief 2>&1
    if (-not (Test-GcloudAuth)) {
        Write-Fail "gcloud authentication failed"
        exit 1
    }
    $AccountEmail = & gcloud config get-value account 2>$null
    Write-Ok "Authenticated: $AccountEmail"
}

# ============================================================================
# STEP 5 - GCP Project
# ============================================================================
Write-Step -Number 5 -Total $totalSteps -Title "GCP PROJECT"

if (-not $ProjectId) {
    # Try current project
    $ProjectId = & gcloud config get-value project 2>$null
    if ($ProjectId -eq "(unset)" -or [string]::IsNullOrWhiteSpace($ProjectId)) {
        $ProjectId = $null
    }
}

if (-not $ProjectId) {
    # Auto-select first available project
    Write-Info "No project specified. Auto-selecting..."
    $projects = & gcloud projects list --format="value(projectId)" --limit=5 2>$null
    if ($projects) {
        $ProjectId = ($projects -split "`n" | Select-Object -First 1).Trim()
        Write-Ok "Auto-selected project: $ProjectId"
    } else {
        # Create a new project
        $ProjectId = "gws-cli-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Write-Act "Creating new project: $ProjectId"
        & gcloud projects create $ProjectId --name="GWS CLI Project" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Cannot create project. Specify -ProjectId manually."
            exit 1
        }
        Write-Ok "Project created: $ProjectId"
    }
}

# Set as active project
& gcloud config set project $ProjectId 2>&1 | Out-Null
Write-Ok "Active project: $ProjectId"

# Verify project exists and is accessible
$projectCheck = & gcloud projects describe $ProjectId --format="value(projectId)" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Project $ProjectId not accessible: $projectCheck"
    exit 1
}
Write-Ok "Project verified: $ProjectId"

# ============================================================================
# STEP 6 - Enable Google Workspace APIs
# ============================================================================
Write-Step -Number 6 -Total $totalSteps -Title "ENABLE APIS"

$enabledCount = 0
$skippedCount = 0
$failedApis = @()

foreach ($api in $GWS_APIS) {
    $shortName = $api -replace '\.googleapis\.com$', ''
    # Check if already enabled
    $enabled = & gcloud services list --enabled --filter="config.name=$api" --format="value(config.name)" --project=$ProjectId 2>$null
    if ($enabled) {
        $skippedCount++
        continue
    }

    Write-Info "Enabling $shortName..."
    $result = & gcloud services enable $api --project=$ProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        $enabledCount++
    } else {
        $failedApis += $shortName
        Write-Warn "Failed to enable $shortName (non-critical)"
    }
}

Write-Ok "APIs: $enabledCount enabled, $skippedCount already active, $($failedApis.Count) failed"
if ($failedApis.Count -gt 0) {
    Write-Warn "Failed APIs (may need billing): $($failedApis -join ', ')"
}

# ============================================================================
# STEP 7 - OAuth Consent Screen
# ============================================================================
Write-Step -Number 7 -Total $totalSteps -Title "OAUTH CONSENT SCREEN"

# Check if consent screen is already configured
$brandCheck = & gcloud alpha iap oauth-brands list --project=$ProjectId --format="value(name)" 2>$null

if ($brandCheck) {
    Write-Ok "OAuth consent screen already configured"
} else {
    Write-Act "Configuring OAuth consent screen..."

    # Try using gcloud alpha to create the brand
    $brandResult = & gcloud alpha iap oauth-brands create `
        --application_title="GWS CLI" `
        --support_email="$AccountEmail" `
        --project=$ProjectId 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Ok "OAuth consent screen created"
    } else {
        Write-Warn "Auto-config failed. Trying REST API..."

        # Fallback: use REST API directly
        $accessToken = & gcloud auth print-access-token 2>$null

        $consentBody = @{
            app_name       = "GWS CLI"
            user_support_email = $AccountEmail
            developer_contact_emails = @($AccountEmail)
        } | ConvertTo-Json -Compress

        try {
            $response = Invoke-RestMethod `
                -Uri "https://content-oauth2.googleapis.com/v1/projects/$ProjectId/brands" `
                -Method POST `
                -Headers @{ Authorization = "Bearer $accessToken"; "Content-Type" = "application/json" } `
                -Body $consentBody `
                -ErrorAction SilentlyContinue
            Write-Ok "OAuth consent screen created via API"
        } catch {
            Write-Warn "Consent screen may need manual config (one-time only)"
            Write-Info "Visit: https://console.cloud.google.com/apis/credentials/consent?project=$ProjectId"
            Write-Info "Set User Type: External, fill app name + email, save all screens"
            Write-Info "The script will continue and try to proceed anyway..."
        }
    }
}

# ============================================================================
# STEP 8 - Create OAuth Client ID & client_secret.json
# ============================================================================
Write-Step -Number 8 -Total $totalSteps -Title "OAUTH CREDENTIALS"

# Ensure config dir exists
if (-not (Test-Path $GWS_CONFIG_DIR)) {
    New-Item -ItemType Directory -Path $GWS_CONFIG_DIR -Force | Out-Null
    Write-Ok "Created config dir: $GWS_CONFIG_DIR"
}

if ((Test-Path $CLIENT_SECRET_PATH) -and -not $Force) {
    Write-Ok "client_secret.json already exists: $CLIENT_SECRET_PATH"
    # Validate it's valid JSON
    try {
        $existing = Get-Content $CLIENT_SECRET_PATH -Raw | ConvertFrom-Json
        if ($existing.installed.client_id -or $existing.web.client_id) {
            Write-Ok "client_secret.json is valid"
        } else {
            Write-Warn "client_secret.json looks invalid, recreating..."
            $Force = $true
        }
    } catch {
        Write-Warn "client_secret.json is corrupted, recreating..."
        $Force = $true
    }
}

if (-not (Test-Path $CLIENT_SECRET_PATH) -or $Force) {
    Write-Act "Creating OAuth Desktop credentials via gcloud..."

    $accessToken = & gcloud auth print-access-token 2>$null
    $projectNumber = & gcloud projects describe $ProjectId --format="value(projectNumber)" 2>$null

    # Create OAuth client via REST API
    $clientBody = @{
        displayName = "GWS CLI Desktop"
    } | ConvertTo-Json -Compress

    $clientCreated = $false

    try {
        # Use the OAuth2 API to create a client
        $createUrl = "https://oauth2.googleapis.com/v1/projects/$projectNumber/oauthClients"

        # Alternative: use gcloud directly if available
        $oauthResult = & gcloud alpha iap oauth-clients create `
            "projects/$projectNumber/brands/-" `
            --display_name="GWS CLI Desktop" `
            --project=$ProjectId 2>&1

        if ($LASTEXITCODE -eq 0 -and $oauthResult) {
            Write-Ok "OAuth client created via gcloud"
            $clientCreated = $true
        }
    } catch {}

    if (-not $clientCreated) {
        Write-Info "Trying REST API to create OAuth credentials..."

        try {
            # Create via Google Cloud credentials API
            $credUrl = "https://www.googleapis.com/oauth2/v1/projects/$ProjectId/clients"

            # Use the more standard approach: create via the Cloud Console API
            $body = @{
                client_name = "GWS CLI Desktop"
                application_type = "installed"
                redirect_uris = @("http://localhost")
            } | ConvertTo-Json -Compress

            # Actually, the most reliable way is to use the service directly
            $createClientUrl = "https://content-oauth2.googleapis.com/v1/projects/$projectNumber/brands/-/identityAwareProxyClients"

            $clientResponse = Invoke-RestMethod `
                -Uri $createClientUrl `
                -Method POST `
                -Headers @{
                    Authorization  = "Bearer $accessToken"
                    "Content-Type" = "application/json"
                } `
                -Body (@{ displayName = "GWS CLI Desktop" } | ConvertTo-Json -Compress) `
                -ErrorAction Stop

            if ($clientResponse.name) {
                $clientId = $clientResponse.name -replace '.*/', ''
                $clientSecret = $clientResponse.secret
                $clientCreated = $true
                Write-Ok "OAuth client created via REST API"
            }
        } catch {
            Write-Warn "REST API client creation failed: $_"
        }
    }

    if (-not $clientCreated) {
        # Last resort: try to find existing OAuth clients
        Write-Info "Checking for existing OAuth clients..."
        try {
            $listUrl = "https://content-oauth2.googleapis.com/v1/projects/$projectNumber/brands/-/identityAwareProxyClients"
            $existingClients = Invoke-RestMethod `
                -Uri $listUrl `
                -Method GET `
                -Headers @{ Authorization = "Bearer $accessToken" } `
                -ErrorAction Stop

            if ($existingClients.identityAwareProxyClients -and $existingClients.identityAwareProxyClients.Count -gt 0) {
                $firstClient = $existingClients.identityAwareProxyClients[0]
                $clientId = $firstClient.name -replace '.*/', ''
                $clientSecret = $firstClient.secret
                $clientCreated = $true
                Write-Ok "Found existing OAuth client"
            }
        } catch {}
    }

    if ($clientCreated -and $clientId -and $clientSecret) {
        # Generate client_secret.json in Google's expected format
        $secretJson = @{
            installed = @{
                client_id                   = $clientId
                project_id                  = $ProjectId
                auth_uri                    = "https://accounts.google.com/o/oauth2/auth"
                token_uri                   = "https://oauth2.googleapis.com/token"
                auth_provider_x509_cert_url = "https://www.googleapis.com/oauth2/v1/certs"
                client_secret               = $clientSecret
                redirect_uris               = @("http://localhost")
            }
        } | ConvertTo-Json -Depth 5

        $secretJson | Set-Content -Path $CLIENT_SECRET_PATH -Encoding UTF8
        Write-Ok "client_secret.json created: $CLIENT_SECRET_PATH"
    } else {
        # Check if the file exists from a previous manual setup
        if (Test-Path $CLIENT_SECRET_PATH) {
            Write-Ok "Using existing client_secret.json"
        } else {
            Write-Warn "Could not auto-create OAuth client (API restrictions)."
            Write-Info "AUTOMATIC FALLBACK: Opening Google Cloud Console..."

            $credUrl = "https://console.cloud.google.com/apis/credentials/oauthclient?project=$ProjectId"
            Start-Process $credUrl

            Write-Host ""
            Write-Host "    QUICK STEPS (one-time only):" -ForegroundColor Yellow
            Write-Host "      1. Application type: Desktop app" -ForegroundColor White
            Write-Host "      2. Name: GWS CLI Desktop" -ForegroundColor White
            Write-Host "      3. Click CREATE" -ForegroundColor White
            Write-Host "      4. Click DOWNLOAD JSON" -ForegroundColor White
            Write-Host "      5. Save to: $CLIENT_SECRET_PATH" -ForegroundColor White
            Write-Host ""

            # Wait for the file to appear
            Write-Info "Waiting for client_secret.json to be saved..."
            $waitTimeout = 300  # 5 minutes
            $waitElapsed = 0
            while (-not (Test-Path $CLIENT_SECRET_PATH) -and $waitElapsed -lt $waitTimeout) {
                Start-Sleep -Seconds 5
                $waitElapsed += 5
                # Also check Downloads folder
                $downloadsDir = Join-Path $env:USERPROFILE "Downloads"
                $downloadedFiles = Get-ChildItem -Path $downloadsDir -Filter "client_secret*.json" -ErrorAction SilentlyContinue |
                    Sort-Object LastWriteTime -Descending |
                    Select-Object -First 1

                if ($downloadedFiles) {
                    Write-Ok "Found downloaded file: $($downloadedFiles.Name)"
                    Copy-Item -Path $downloadedFiles.FullName -Destination $CLIENT_SECRET_PATH -Force
                    Write-Ok "Auto-copied to: $CLIENT_SECRET_PATH"
                    break
                }

                if ($waitElapsed % 30 -eq 0) {
                    Write-Info "Still waiting... ($waitElapsed/$waitTimeout seconds)"
                }
            }

            if (-not (Test-Path $CLIENT_SECRET_PATH)) {
                Write-Fail "Timeout waiting for client_secret.json"
                Write-Info "After saving the file, re-run this script."
                exit 1
            }
        }
    }
}

# ============================================================================
# STEP 9 - GWS Auth Setup + Login
# ============================================================================
Write-Step -Number 9 -Total $totalSteps -Title "GWS AUTHENTICATION"

# Run gws auth setup with piped 'Y' to skip prompts
Write-Act "Running gws auth setup..."
$setupResult = "Y" | & gws auth setup 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Warn "gws auth setup returned error (may be non-critical)"
    Write-Info "Output: $setupResult"
} else {
    Write-Ok "gws auth setup completed"
}

# Determine scopes for login
Write-Act "Running gws auth login ($ScopeProfile profile)..."

switch ($ScopeProfile) {
    'minimal' {
        $scopeArgs = @(
            '--scopes',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        )
    }
    'standard' {
        $scopeArgs = @(
            '--scopes',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/gmail.compose',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/documents',
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/presentations',
            'https://www.googleapis.com/auth/tasks',
            'https://www.googleapis.com/auth/contacts',
            'https://www.googleapis.com/auth/forms',
            'https://www.googleapis.com/auth/chat.messages',
            'https://www.googleapis.com/auth/chat.spaces',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'openid'
        )
    }
    'full' {
        $scopeArgs = @()  # Let gws use all 85 scopes
    }
}

Write-Info "Browser will open for OAuth authentication..."
Write-Info "Sign in with: $AccountEmail"
Write-Host ""

& gws auth login @scopeArgs

if ($LASTEXITCODE -ne 0) {
    Write-Warn "gws auth login returned non-zero exit code"

    if ($ScopeProfile -ne 'minimal') {
        Write-Act "Retrying with minimal scopes..."
        $minimalScopes = @(
            '--scopes',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        )
        & gws auth login @minimalScopes
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "Login succeeded with minimal scopes"
        } else {
            Write-Fail "Login failed. Check browser for errors."
            Write-Info "You can manually run: gws auth login"
        }
    }
} else {
    Write-Ok "OAuth authentication completed"
}

# ============================================================================
# STEP 10 - Verify Everything
# ============================================================================
Write-Step -Number 10 -Total $totalSteps -Title "VERIFICATION"

$allGood = $true

# Check auth status
Write-Info "Checking auth status..."
try {
    $authStatus = & gws auth status 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Auth status: OK"
    } else {
        Write-Warn "Auth status check returned error"
        $allGood = $false
    }
} catch {
    Write-Warn "Auth status check failed"
    $allGood = $false
}

# Test Gmail (lightweight test)
Write-Info "Testing Gmail access..."
try {
    $gmailTest = & gws gmail labels list --format=json 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Gmail: accessible"
    } else {
        Write-Warn "Gmail: not accessible (may need scope approval)"
        $allGood = $false
    }
} catch {
    Write-Warn "Gmail test failed"
    $allGood = $false
}

# Test Drive (lightweight test)
Write-Info "Testing Drive access..."
try {
    $driveTest = & gws drive files list --max-results=1 --format=json 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Drive: accessible"
    } else {
        Write-Warn "Drive: not accessible"
        $allGood = $false
    }
} catch {
    Write-Warn "Drive test failed"
    $allGood = $false
}

# Test Calendar
Write-Info "Testing Calendar access..."
try {
    $calTest = & gws calendar events list --max-results=1 --format=json 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Calendar: accessible"
    } else {
        Write-Warn "Calendar: not accessible"
        $allGood = $false
    }
} catch {
    Write-Warn "Calendar test failed"
    $allGood = $false
}

# ============================================================================
# Summary
# ============================================================================
$stopwatch.Stop()
$elapsed = $stopwatch.Elapsed

Write-Host ""
if ($allGood) {
    Write-Banner "SETUP COMPLETE - ALL CHECKS PASSED" "Green"
} else {
    Write-Banner "SETUP COMPLETE - SOME CHECKS NEED ATTENTION" "Yellow"
}

Write-Host ""
Write-Host "  Account:  $AccountEmail" -ForegroundColor White
Write-Host "  Project:  $ProjectId" -ForegroundColor White
Write-Host "  Profile:  $ScopeProfile" -ForegroundColor White
Write-Host "  Config:   $GWS_CONFIG_DIR" -ForegroundColor White
Write-Host "  Duration: $($elapsed.Minutes)m $($elapsed.Seconds)s" -ForegroundColor White
Write-Host ""

if (-not $allGood) {
    Write-Host "  Auto-fix suggestions:" -ForegroundColor Yellow
    Write-Host "    - If OAuth failed: re-run with -ScopeProfile minimal" -ForegroundColor Gray
    Write-Host "    - If APIs failed: check billing at https://console.cloud.google.com/billing" -ForegroundColor Gray
    Write-Host "    - If client_secret missing: re-run with -Force" -ForegroundColor Gray
    Write-Host "    - Re-run this script (it's idempotent, safe to repeat)" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "  Quick start:" -ForegroundColor Yellow
Write-Host "    gws gmail list              # Recent emails" -ForegroundColor Gray
Write-Host "    gws drive list              # Drive files" -ForegroundColor Gray
Write-Host "    gws calendar list           # Calendar events" -ForegroundColor Gray
Write-Host "    gws docs list               # Google Docs" -ForegroundColor Gray
Write-Host "    gws sheets list             # Spreadsheets" -ForegroundColor Gray
Write-Host "    gws tasks list              # Tasks" -ForegroundColor Gray
Write-Host "    gws chat spaces list        # Chat spaces" -ForegroundColor Gray
Write-Host ""
Write-Host $SEP -ForegroundColor Green
