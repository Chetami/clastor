param(
    # Which environment to deploy (dev | staging | prod | ...).
    [Parameter(Mandatory = $true)][string]$Environment,

    # What to deploy.
    [Parameter(Mandatory = $true)]
    [ValidateSet("backend", "frontend", "both")][string]$Component,

    # Forwarded to the underlying deploy scripts.
    [ValidateSet("tms", "all")][string]$Target = "tms",
    [string]$IdentityFile,
    [string]$Password,
    [string]$FirebaseKeyPath,

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent

function Run-Script([string]$Script, [string]$Label) {
    Write-Host ""
    Write-Host "########## $Label ##########" -ForegroundColor Cyan
    $scriptArgs = @(
        "-NoProfile", "-ExecutionPolicy", "Bypass",
        "-File", "$repoRoot/$Script",
        "-Environment", $Environment,
        "-Target", $Target
    )
    if ($IdentityFile)   { $scriptArgs += @("-IdentityFile", $IdentityFile) }
    if ($Password)       { $scriptArgs += @("-Password", $Password) }
    if ($FirebaseKeyPath) { $scriptArgs += @("-FirebaseKeyPath", $FirebaseKeyPath) }
    if ($DryRun)         { $scriptArgs += "-DryRun" }

    # Run each deploy script in its own powershell process so its `exit` (on Die)
    # does not kill the whole "both" run.
    & powershell.exe @scriptArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "ERROR: $Label failed (exit $LASTEXITCODE). Aborting." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

switch ($Component) {
    "backend"  { Run-Script "deploy_backend.ps1"  "BACKEND" }
    "frontend" { Run-Script "deploy_frontend.ps1" "FRONTEND" }
    "both"     {
        Run-Script "deploy_backend.ps1"  "BACKEND"
        Run-Script "deploy_frontend.ps1" "FRONTEND"
    }
}

Write-Host ""
Write-Host "Deploy of '$Component' to '$Environment' complete." -ForegroundColor Green
