param(
    # Name of the new environment (e.g. staging, prod). Maps to
    # deploy/environments/<Name>.psd1 and deploy/environments/<Name>/.
    [Parameter(Mandatory = $true)][string]$Name,

    # Fully custom URLs + remote paths for this environment (no naming convention
    # is assumed — you set up the cPanel domains/subdomains first, then pass them).
    [Parameter(Mandatory = $true)][string]$FrontendUrl,
    [Parameter(Mandatory = $true)][string]$BackendUrl,
    [Parameter(Mandatory = $true)][string]$FrontendRemote,
    [Parameter(Mandatory = $true)][string]$BackendRemote,

    [string]$Description,

    # Existing environment whose shared secrets to copy from (e.g. -From dev).
    # Copies JWT_SECRET, SMTP_*, EMAIL_FROM, NOTIFY_COOLDOWN_MS, GOOGLE_OAUTH_*,
    # STRIPE_*, PORT. Leaves Firebase + the URL-derived values to this env.
    [string]$From,

    # Overwrite an existing environment of the same name.
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$envsDir  = "$repoRoot/deploy/environments"
$templatesDir = "$repoRoot/deploy/templates"

function Die([string]$Message, [int]$Code = 1) {
    Write-Host ""
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit $Code
}

# --- env-file helpers -------------------------------------------------------

# Set a KEY=value line in an .env file (replace if present, append if not).
# Preserves comments, order, and any other lines.
function Set-EnvKeyValue {
    param([Parameter(Mandatory)][string]$File, [Parameter(Mandatory)][string]$Key, [Parameter(Mandatory)][string]$Value)
    if (-not (Test-Path $File)) { Die "Expected env file not found: $File" }
    $lines = Get-Content $File
    $found = $false
    $out = foreach ($l in $lines) {
        if ($l -match ('^\s*' + [regex]::Escape($Key) + '\s*=')) {
            $found = $true
            "$Key=$Value"
        } else { $l }
    }
    if (-not $found) { $out += "$Key=$Value" }
    $out | Set-Content $File -Encoding utf8
}

# Read a value from an .env file (everything after the first '='), or $null.
function Get-EnvKeyValue {
    param([Parameter(Mandatory)][string]$File, [Parameter(Mandatory)][string]$Key)
    if (-not (Test-Path $File)) { return $null }
    $line = Get-Content $File | Where-Object { $_ -match ('^\s*' + [regex]::Escape($Key) + '\s*=') } | Select-Object -First 1
    if (-not $line) { return $null }
    return ($line -split '=', 2)[1]
}

# Escape a string for single-quoted PowerShell data (.psd1) by doubling quotes.
function ConvertTo-PsdSingle {
    param([string]$Value)
    "'" + ($Value -replace "'", "''") + "'"
}

# --- validate ---------------------------------------------------------------

if ($Name -notmatch '^[A-Za-z0-9_-]+$') {
    Die "Invalid environment name '$Name'. Use letters, digits, dash, underscore only."
}

$psdPath  = "$envsDir/$Name.psd1"
$envDir   = "$envsDir/$Name"
if ((Test-Path $psdPath) -and -not $Force) {
    Die "Environment '$Name' already exists ($psdPath). Re-run with -Force to overwrite."
}
if (-not (Test-Path $templatesDir)) {
    Die "Templates directory missing: $templatesDir"
}

Write-Host ""
Write-Host "==========================================="
Write-Host " Scaffolding environment:  $Name"
Write-Host "==========================================="
Write-Host "  Frontend URL : $FrontendUrl"
Write-Host "  Backend  URL : $BackendUrl"
Write-Host "  Frontend path: $FrontendRemote"
Write-Host "  Backend  path: $BackendRemote"

# --- 1. write the environment definition (.psd1) ----------------------------

$descLine = ''
if ($Description) { $descLine = "    description    = $(ConvertTo-PsdSingle $Description)`r`n" }
$psdContent = @"
@{
    name           = $(ConvertTo-PsdSingle $Name)
$descLine    frontendUrl    = $(ConvertTo-PsdSingle $FrontendUrl)
    backendUrl     = $(ConvertTo-PsdSingle $BackendUrl)
    frontendRemote = $(ConvertTo-PsdSingle $FrontendRemote)
    backendRemote  = $(ConvertTo-PsdSingle $BackendRemote)
}
"@
New-Item -ItemType Directory -Force -Path $envsDir | Out-Null
Set-Content -Path $psdPath -Value $psdContent -Encoding utf8
Write-Host ""
Write-Host "[1/4] Wrote $psdPath" -ForegroundColor Green

# --- 2. create the env folder + copy templates ------------------------------

New-Item -ItemType Directory -Force -Path $envDir | Out-Null
Copy-Item -Force "$templatesDir/backend.env.example"  "$envDir/backend.env"
Copy-Item -Force "$templatesDir/frontend.env.example" "$envDir/frontend.env"
Write-Host "[2/4] Created $envDir/backend.env + frontend.env from templates" -ForegroundColor Green

# --- 3. fill in derivable values --------------------------------------------

$redirectUri = "$BackendUrl/api/auth/google/callback"

Set-EnvKeyValue -File "$envDir/backend.env"  -Key 'CORS_ORIGIN'              -Value $FrontendUrl
Set-EnvKeyValue -File "$envDir/backend.env"  -Key 'FRONTEND_URL'             -Value $FrontendUrl
Set-EnvKeyValue -File "$envDir/backend.env"  -Key 'PUBLIC_API_URL'           -Value $BackendUrl
Set-EnvKeyValue -File "$envDir/backend.env"  -Key 'GOOGLE_OAUTH_REDIRECT_URI'-Value $redirectUri
Set-EnvKeyValue -File "$envDir/frontend.env" -Key 'VITE_API_URL'             -Value $BackendUrl

Write-Host "[3/4] Filled derived values (CORS_ORIGIN, FRONTEND_URL, PUBLIC_API_URL," -ForegroundColor Green
Write-Host "      GOOGLE_OAUTH_REDIRECT_URI, VITE_API_URL) from the URLs you gave."

# --- 3b. optional copy-over from an existing env ----------------------------

# Keys that are usually shared/reusable across environments. Env-specific keys
# (URLs, Firebase) are deliberately excluded — they were set above.
$copyKeys = @(
    'JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'PORT',
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM',
    'NOTIFY_COOLDOWN_MS',
    'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET',
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
    'DISCORD_CONTACT_WEBHOOK_URL'
)

if ($From) {
    $fromEnvDir = "$envsDir/$From"
    $fromBackend = "$fromEnvDir/backend.env"
    if (-not (Test-Path $fromBackend)) {
        Die "-From '$From' has no backend.env at $fromBackend. Nothing to copy."
    }
    Write-Host ""
    Write-Host "      Copying shared secrets from '$From':" -ForegroundColor Cyan
    $copied = @()
    foreach ($k in $copyKeys) {
        $v = Get-EnvKeyValue -File $fromBackend -Key $k
        if ($null -ne $v) {
            Set-EnvKeyValue -File "$envDir/backend.env" -Key $k -Value $v
            $copied += $k
        }
    }
    if ($copied.Count) {
        $list = $copied -join ', '
        Write-Host "        copied: $list"
    } else {
        Write-Host "        (no matching keys found in $From/backend.env)"
    }
    # Reminder: replace dev-only keys when promoting to prod.
    $stripeTest = Get-EnvKeyValue -File "$envDir/backend.env" -Key 'STRIPE_SECRET_KEY'
    if ($stripeTest -match 'sk_test_') {
        Write-Warning "STRIPE_SECRET_KEY looks like a TEST key - swap for a live (sk_live_) key before real prod traffic."
    }
}

# --- 4. Firebase setup checklist -------------------------------------------

$frontendHost = ($FrontendUrl -replace '^https?://', '' -replace '/+$', '')
$checklistTemplate = "$templatesDir/FIREBASE_SETUP.md"
if (-not (Test-Path $checklistTemplate)) { Die "Missing $checklistTemplate" }
$checklist = Get-Content $checklistTemplate -Raw
$checklist = $checklist.Replace('{{NAME}}', $Name).Replace('{{FRONTEND_HOST}}', $frontendHost)
Set-Content -Path "$envDir/FIREBASE_SETUP.md" -Value $checklist -Encoding utf8
Write-Host "[4/4] Wrote $envDir/FIREBASE_SETUP.md (Firebase console checklist)" -ForegroundColor Green

# --- summary / next steps ---------------------------------------------------

Write-Host ""
Write-Host "Environment '$Name' scaffolded." -ForegroundColor Green
Write-Host ""
Write-Host "What's left to fill in by hand:" -ForegroundColor Yellow
Write-Host "  - deploy/environments/$Name/frontend.env  : VITE_FIREBASE_* (from step 5)"
Write-Host "  - deploy/environments/$Name/firebase-service-account.json (from step 6)"
$hasPlaceholder = $false
if (Test-Path "$envDir/backend.env") {
    if (Select-String -Path "$envDir/backend.env" -Pattern '^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*REPLACE_WITH_' -Quiet) { $hasPlaceholder = $true }
}
if ($hasPlaceholder) {
    Write-Host "  - deploy/environments/$Name/backend.env   : still has REPLACE_WITH_ placeholders"
    if ($From) {
        Write-Host "    Confirm the copied values are correct for this env (JWT_SECRET, SMTP, Stripe, OAuth)."
    } else {
        Write-Host "    Fill them in (JWT_SECRET, SMTP, Stripe, OAuth), or re-run with -From to copy from another env."
    }
}
Write-Host ""
Write-Host "Full Firebase steps: deploy/environments/$Name/FIREBASE_SETUP.md"
Write-Host "Verify locally (build only, no upload):"
Write-Host "  .\deploy_backend.ps1  -Environment $Name -DryRun"
Write-Host "  .\deploy_frontend.ps1 -Environment $Name -DryRun"
Write-Host ""
