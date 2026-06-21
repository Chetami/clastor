param(
    [ValidateSet("tms", "all")]
    [string]$Target = "tms",

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
# Load shared config + helpers (Invoke-Ssh / Invoke-Scp / Die)
# ---------------------------------------------------------------------------
. "$repoRoot/deploy/config.ps1"

Write-Host ""
Write-Host "==========================================="
Write-Host " Deploy FRONTEND  ->  $($Deploy.frontendUrl)"
Write-Host "==========================================="

# ---------------------------------------------------------------------------
# 1. Build shared types (frontend imports from @examify-tms/interfaces)
# ---------------------------------------------------------------------------
Write-Host "[1/5] Building shared interfaces package..."
Push-Location $repoRoot
try {
    npm run build:interfaces
    if ($LASTEXITCODE -ne 0) { Die "interfaces build failed" }
} finally { Pop-Location }

# ---------------------------------------------------------------------------
# 2. Install frontend deps + inject production env
# ---------------------------------------------------------------------------
Write-Host "[2/5] Installing frontend dependencies + injecting prod env..."
Push-Location "$repoRoot/frontend"
try {
    npm install
    if ($LASTEXITCODE -ne 0) { Die "frontend npm install failed" }

    $prodEnv = "$repoRoot/deploy/frontend.env.production"
    if (-not (Test-Path $prodEnv)) { Die "Missing $prodEnv" }
    Copy-Item -Force $prodEnv "$repoRoot/frontend/.env.production"
    Write-Host "      -> frontend/.env.production (VITE_API_URL=$($Deploy.backendUrl))"

    # 3. Build ---------------------------------------------------------------
    Write-Host "[3/5] Building frontend (vite)..."
    npm run build
    if ($LASTEXITCODE -ne 0) { Die "frontend build failed" }

    if (-not (Test-Path "$repoRoot/frontend/dist/index.html")) {
        Die "frontend/dist/index.html not found after build"
    }
} finally { Pop-Location }

if ($DryRun) {
    Write-Host ""
    Write-Host "DRY RUN - skipping upload. Built bundle at frontend/dist/." -ForegroundColor Yellow
    exit 0
}

# ---------------------------------------------------------------------------
# 4. Upload dist/* to the subdomain document root
# ---------------------------------------------------------------------------
$authParams = @{}
if ($IdentityFile) { $authParams["IdentityFile"] = $IdentityFile }
if ($Password)     { $authParams["Password"] = $Password }

Write-Host "[4/5] Ensuring remote folder exists + uploading build..."
$code = Invoke-Ssh "mkdir -p '$($Deploy.frontendRemote)'" @authParams
if ($code -ne 0) { Die "Could not create/access remote folder" }

# Run scp from inside dist/ with a colon-free relative source. An absolute Windows
# path (C:\...\dist\.) contains a colon, which scp parses as [host]:[path] and
# aborts with a usage error.
Push-Location "$repoRoot/frontend/dist"
try {
    $code = Invoke-Scp "." $Deploy.frontendRemote -Recursive @authParams
    if ($code -ne 0) { Die "Upload of frontend build failed" }
} finally { Pop-Location }

# ---------------------------------------------------------------------------
# 5. Fix permissions (dirs 755, files 644)
# ---------------------------------------------------------------------------
Write-Host "[5/5] Fixing permissions on server..."
$permCmd = "cd '$($Deploy.frontendRemote)' && find . -type d -exec chmod 755 {} + && find . -type f -exec chmod 644 {} + && echo perms-fixed"
$code = Invoke-Ssh $permCmd @authParams
if ($code -ne 0) { Die "Permission fix failed" }

Write-Host ""
Write-Host "Frontend deployed successfully." -ForegroundColor Green
Write-Host "Open: $($Deploy.frontendUrl)"
