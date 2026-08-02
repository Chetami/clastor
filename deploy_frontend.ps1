param(
    # Which environment to deploy (dev | staging | prod | ...). Maps to a
    # deploy/environments/<Environment>.psd1 file. See deploy/new-environment.ps1
    # to scaffold a new one.
    [Parameter(Mandatory = $true)]
    [string]$Environment,

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
$EnvCfg = Import-EnvironmentConfig -Name $Environment
$envDir = "$repoRoot/deploy/environments/$Environment"

Write-Host ""
Write-Host "==========================================="
Write-Host " Deploy FRONTEND [$Environment]  ->  $($EnvCfg.frontendUrl)"
Write-Host "==========================================="

# ---------------------------------------------------------------------------
# 1. Build the shared packages the frontend compiles against:
#    - @examify-tms/interfaces  → generated type declarations
#    - @examify-tms/shared      → runtime data layer (shared/dist), which Vite
#                                 bundles into the frontend. shared/dist is
#                                 gitignored, so it MUST be built here or the
#                                 frontend resolves stale/missing code.
#                                 Order matters — shared itself imports from
#                                 interfaces, so interfaces goes first.
# ---------------------------------------------------------------------------
Write-Host "[1/5] Building interfaces + shared packages..."
Push-Location $repoRoot
try {
    npm run build:interfaces
    if ($LASTEXITCODE -ne 0) { Die "interfaces build failed" }
    npm run build:shared
    if ($LASTEXITCODE -ne 0) { Die "shared build failed" }
} finally { Pop-Location }

# ---------------------------------------------------------------------------
# 2. Install frontend deps + inject production env
# ---------------------------------------------------------------------------
Write-Host "[2/5] Installing frontend dependencies + injecting prod env..."
Push-Location "$repoRoot/frontend"
try {
    npm install
    if ($LASTEXITCODE -ne 0) { Die "frontend npm install failed" }

    $prodEnv = "$envDir/frontend.env"
    if (-not (Test-Path $prodEnv)) {
        Die "Missing $prodEnv. Run:  .\deploy\new-environment.ps1 -Name $Environment ..."
    }
    Copy-Item -Force $prodEnv "$repoRoot/frontend/.env.production"
    Write-Host "      -> frontend/.env.production (VITE_API_URL=$($EnvCfg.backendUrl))"

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
$code = Invoke-Ssh "mkdir -p '$($EnvCfg.frontendRemote)'" @authParams
if ($code -ne 0) { Die "Could not create/access remote folder" }

# Run scp from inside dist/ with a colon-free relative source. An absolute Windows
# path (C:\...\dist\.) contains a colon, which scp parses as [host]:[path] and
# aborts with a usage error.
Push-Location "$repoRoot/frontend/dist"
try {
    $code = Invoke-Scp "." $EnvCfg.frontendRemote -Recursive @authParams
    if ($code -ne 0) { Die "Upload of frontend build failed" }
} finally { Pop-Location }

# ---------------------------------------------------------------------------
# 5. Fix permissions (dirs 755, files 644)
# ---------------------------------------------------------------------------
Write-Host "[5/5] Fixing permissions on server..."
$permCmd = "cd '$($EnvCfg.frontendRemote)' && find . -type d -exec chmod 755 {} + && find . -type f -exec chmod 644 {} + && echo perms-fixed"
$code = Invoke-Ssh $permCmd @authParams
if ($code -ne 0) { Die "Permission fix failed" }

Write-Host ""
Write-Host "Frontend deployed successfully." -ForegroundColor Green
Write-Host "Open: $($EnvCfg.frontendUrl)"
