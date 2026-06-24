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

    # Path to the Firebase Admin service-account JSON on your machine.
    # If omitted, the script resolves it from deploy/environments/<Environment>/
    # (firebase-service-account.json), backend/.env
    # (FIREBASE_SERVICE_ACCOUNT_KEY_PATH), or backend/firebase-service-account.json.
    [string]$FirebaseKeyPath,

    # Build + stage only, no upload (dry-run)
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot

# ---------------------------------------------------------------------------
# Load shared config + helpers
# ---------------------------------------------------------------------------
. "$repoRoot/deploy/config.ps1"
$EnvCfg = Import-EnvironmentConfig -Name $Environment
$envDir = "$repoRoot/deploy/environments/$Environment"

Write-Host ""
Write-Host "==========================================="
Write-Host " Deploy BACKEND [$Environment]  ->  $($EnvCfg.backendUrl)"
Write-Host "==========================================="

# ---------------------------------------------------------------------------
# 1. Build shared types + backend
# ---------------------------------------------------------------------------
Write-Host "[1/7] Building interfaces + backend..."
Push-Location $repoRoot
try {
    npm run build:interfaces
    if ($LASTEXITCODE -ne 0) { Die "interfaces build failed" }
    npm run build:backend
    if ($LASTEXITCODE -ne 0) { Die "backend build failed" }
} finally { Pop-Location }

if (-not (Test-Path "$repoRoot/backend/dist/server.js")) {
    Die "backend/dist/server.js not found after build"
}

# ---------------------------------------------------------------------------
# 2. Stage a deploy bundle (backend/.deploy-stage)
# ---------------------------------------------------------------------------
$stage = "$repoRoot/backend/.deploy-stage"
Write-Host "[2/7] Staging deploy bundle -> $stage"
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

# 2a. compiled output + Passenger entry point
Copy-Item -Recurse "$repoRoot/backend/dist" "$stage/dist"
Copy-Item "$repoRoot/deploy/app.js" "$stage/app.js"

# 2b. production .env for this environment (refuse placeholders)
$prodEnv   = "$envDir/backend.env"
if (-not (Test-Path $prodEnv)) {
    Die "Missing $prodEnv. Run:  .\deploy\new-environment.ps1 -Name $Environment ..."
}
if (Select-String -Path $prodEnv -Pattern '^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*REPLACE_WITH_') {
    Die "$prodEnv still contains REPLACE_WITH_ placeholder values. Fill in real secrets first."
}
Copy-Item $prodEnv "$stage/.env"

# 2c. Firebase service-account key (env dir > -FirebaseKeyPath > backend/.env path)
$resolvedKey = $FirebaseKeyPath
if (-not $resolvedKey -and (Test-Path "$envDir/firebase-service-account.json")) {
    $resolvedKey = "$envDir/firebase-service-account.json"
}
if (-not $resolvedKey) {
    $beEnv = "$repoRoot/backend/.env"
    if (Test-Path $beEnv) {
        $line = Get-Content $beEnv | Where-Object { $_ -match '^\s*FIREBASE_SERVICE_ACCOUNT_KEY_PATH\s*=' }
        if ($line) {
            $rel = ($line -split '=', 2)[1].Trim()
            $candidate = [System.IO.Path]::GetFullPath((Join-Path "$repoRoot/backend" $rel))
            if (Test-Path $candidate) { $resolvedKey = $candidate }
        }
    }
    if (-not $resolvedKey -and (Test-Path "$repoRoot/deploy/firebase-service-account.json")) {
        $resolvedKey = "$repoRoot/deploy/firebase-service-account.json"
    }
}
if (-not $resolvedKey -or -not (Test-Path $resolvedKey)) {
    Die "Firebase key not found. Place deploy/environments/$Environment/firebase-service-account.json or pass -FirebaseKeyPath."
}
Copy-Item $resolvedKey "$stage/firebase-service-account.json"
Write-Host "      Firebase key: $resolvedKey"

# 2d. Scrubbed package.json - drop the @examify-tms/interfaces workspace dep
#      (type-only at runtime; npm would fail to resolve it from the registry).
#      All backend imports from interfaces must stay type-only so tsc erases
#      them — no runtime require("@examify-tms/interfaces") survives into dist.
$pj = Get-Content "$repoRoot/backend/package.json" -Raw | ConvertFrom-Json
if ($pj.dependencies.PSObject.Properties.Name -contains "@examify-tms/interfaces") {
    $pj.dependencies.PSObject.Properties.Remove("@examify-tms/interfaces")
}
$pj | ConvertTo-Json -Depth 20 | Set-Content "$stage/package.json" -Encoding utf8
Write-Host "      package.json staged (interfaces dep stripped for runtime)"

if ($DryRun) {
    Write-Host ""
    Write-Host "DRY RUN - staged bundle at $stage (no upload)." -ForegroundColor Yellow
    exit 0
}

# ---------------------------------------------------------------------------
# 3. Tar, upload, extract on the server
# ---------------------------------------------------------------------------
$authParams = @{}
if ($IdentityFile) { $authParams["IdentityFile"] = $IdentityFile }
if ($Password)     { $authParams["Password"] = $Password }

Write-Host "[3/7] Packaging + uploading bundle..."
# Build the tar in TEMP but pass scp a bare filename (relative path). An absolute
# Windows path like C:\...\Temp\file.tar.gz contains a colon, which scp parses as
# [host]:[path] and aborts with a usage error. A colon-free relative name is
# always treated as a local source.
$tarName = "examify-backend-deploy.tar.gz"
Push-Location $env:TEMP
try {
    tar -czf $tarName -C $stage .
    if ($LASTEXITCODE -ne 0) { Die "tar failed" }

    $remoteTar = "$($EnvCfg.backendRemote)/__deploy.tar.gz"
    $code = Invoke-Ssh "echo connected && mkdir -p '$($EnvCfg.backendRemote)' && echo done" @authParams
    if ($code -ne 0) { Die "Could not create/access remote app root" }

    $code = Invoke-Scp $tarName $remoteTar @authParams
    if ($code -ne 0) { Die "Upload of backend bundle failed" }
} finally { Pop-Location }

# ---------------------------------------------------------------------------
# 4. Extract on server
# ---------------------------------------------------------------------------
Write-Host "[4/7] Extracting bundle on server..."
$extract = "set -e`ncd '$($EnvCfg.backendRemote)'`ntar -xzf __deploy.tar.gz`nrm -f __deploy.tar.gz`necho extracted-ok"
$code = Invoke-Ssh $extract @authParams
if ($code -ne 0) { Die "Remote extract failed" }

# ---------------------------------------------------------------------------
# 5. Install production deps on the server
# ---------------------------------------------------------------------------
Write-Host "[5/7] Installing production node_modules on server..."
$install = @"
set -e
cd '$($EnvCfg.backendRemote)'
for v in $($Deploy.nodeEnable) /opt/alt/alt-nodejs20/enable /opt/alt/alt-nodejs18/enable /opt/alt/alt-nodejs16/enable; do
  if [ -f "`$v" ]; then source "`$v"; break; fi
done
node -v
npm install --omit=dev --no-audit --no-fund
echo install-ok
"@
$code = Invoke-Ssh $install @authParams
if ($code -ne 0) { Die "Remote npm install failed" }

# ---------------------------------------------------------------------------
# 6. Restart Passenger (touch tmp/restart.txt)
# ---------------------------------------------------------------------------
Write-Host "[6/7] Restarting Passenger app..."
$restart = "cd '$($EnvCfg.backendRemote)' && mkdir -p tmp && touch tmp/restart.txt && echo restarted"
$code = Invoke-Ssh $restart @authParams
if ($code -ne 0) { Die "Passenger restart trigger failed" }

# ---------------------------------------------------------------------------
# 7. Health check
# ---------------------------------------------------------------------------
Write-Host "[7/7] Health check..."
Start-Sleep -Seconds 3
try {
    $resp = Invoke-WebRequest -UseBasicParsing "$($EnvCfg.backendUrl)/health" -TimeoutSec 20
    if ($resp.StatusCode -eq 200) {
        Write-Host "HEALTH OK: $($resp.Content)" -ForegroundColor Green
    } else {
        Write-Warning "Health endpoint returned HTTP $($resp.StatusCode)"
    }
} catch {
    Write-Warning "Health check request failed (app may still be starting): $($_.Exception.Message)"
    Write-Host "Retry later:  curl $($EnvCfg.backendUrl)/health"
}

Write-Host ""
Write-Host "Backend deployed successfully." -ForegroundColor Green
