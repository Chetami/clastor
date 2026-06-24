param(
    # SSH auth. Provide ONE of:
    #   -IdentityFile <path to private key>   (recommended)
    #   -Password <cPanel password>           (uses sshpass if installed, else prompts)
    [string]$IdentityFile,
    [string]$Password,

    # Build + stage only, no upload (dry-run)
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot

# ---------------------------------------------------------------------------
# Target: the Clastor marketing site (single, fixed destination).
# ---------------------------------------------------------------------------
$Url    = "https://clastor.xamify.com.au"
$Remote = "/home/xamify/clastor.xamify.com.au"

# ---------------------------------------------------------------------------
# Load shared config + helpers (Invoke-Ssh / Invoke-Scp / Die)
# ---------------------------------------------------------------------------
. "$repoRoot/deploy/config.ps1"

Write-Host ""
Write-Host "==========================================="
Write-Host " Deploy WEBSITE  ->  $Url"
Write-Host "==========================================="

# ---------------------------------------------------------------------------
# 1. Install website deps + build
# ---------------------------------------------------------------------------
Write-Host "[1/4] Installing website dependencies..."
Push-Location "$repoRoot/website"
try {
    npm install
    if ($LASTEXITCODE -ne 0) { Die "website npm install failed" }

    Write-Host "[2/4] Building website (tsc + vite)..."
    npm run build
    if ($LASTEXITCODE -ne 0) { Die "website build failed" }

    if (-not (Test-Path "$repoRoot/website/dist/index.html")) {
        Die "website/dist/index.html not found after build"
    }
} finally { Pop-Location }

if ($DryRun) {
    Write-Host ""
    Write-Host "DRY RUN - skipping upload. Built bundle at website/dist/." -ForegroundColor Yellow
    exit 0
}

# ---------------------------------------------------------------------------
# 2. Upload dist/* to the document root
# ---------------------------------------------------------------------------
$authParams = @{}
if ($IdentityFile) { $authParams["IdentityFile"] = $IdentityFile }
if ($Password)     { $authParams["Password"] = $Password }

Write-Host "[3/4] Ensuring remote folder exists + uploading build..."
$code = Invoke-Ssh "mkdir -p '$Remote'" @authParams
if ($code -ne 0) { Die "Could not create/access remote folder" }

# Run scp from inside dist/ with a colon-free relative source. An absolute Windows
# path (C:\...\dist\.) contains a colon, which scp parses as [host]:[path] and
# aborts with a usage error.
Push-Location "$repoRoot/website/dist"
try {
    $code = Invoke-Scp "." $Remote -Recursive @authParams
    if ($code -ne 0) { Die "Upload of website build failed" }
} finally { Pop-Location }

# ---------------------------------------------------------------------------
# 3. Fix permissions (dirs 755, files 644)
# ---------------------------------------------------------------------------
Write-Host "[4/4] Fixing permissions on server..."
$permCmd = "cd '$Remote' && find . -type d -exec chmod 755 {} + && find . -type f -exec chmod 644 {} + && echo perms-fixed"
$code = Invoke-Ssh $permCmd @authParams
if ($code -ne 0) { Die "Permission fix failed" }

Write-Host ""
Write-Host "Website deployed successfully." -ForegroundColor Green
Write-Host "Open: $Url"
