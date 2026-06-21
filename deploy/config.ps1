# ============================================================================
# Shared deployment configuration for cPanel / Verpex
# ============================================================================
# Edit the values below ONCE. Both deploy_frontend.ps1 and deploy_backend.ps1
# dot-source this file (`. "$PSScriptRoot/deploy/config.ps1"`).
# ============================================================================

$Deploy = @{
    # SSH / cPanel account
    sshUser = "xamify"
    sshHost = "xamify.com.au"

    # Frontend: static Vite build destination (subdomain document root)
    frontendRemote = "/home/xamify/tms-dev.xamify.com.au"

    # Backend: Phusion Passenger "Application root" for the Node.js app
    backendRemote  = "/home/xamify/tms-dev-backend.xamify.com.au"

    # Public URLs (used for health checks + wiring env files)
    frontendUrl = "https://tms-dev.xamify.com.au"
    backendUrl  = "https://tms-dev-backend.xamify.com.au"

    # CloudLinux Node selector script on the server. npm runs over SSH inside
    # this environment. Verpex/CloudLinux typically exposes /opt/alt/alt-nodejsXX/enable.
    # The deploy script tries this first, then falls back to common versions.
    nodeEnable = "/opt/alt/alt-nodejs20/enable"
}

# ----------------------------------------------------------------------------
# Auth helpers
# ----------------------------------------------------------------------------
# Usage from a script:
#   . "$PSScriptRoot/deploy/config.ps1"
#   Invoke-Ssh  "mkdir -p /some/path"
#   Invoke-Scp  "./local/file" "/remote/path"
#
# Auth priority:
#   1. -IdentityFile <path>   -> ssh -i <key>            (recommended; works in CI)
#   2. sshpass installed      -> sshpass -e ssh ...       (password, one prompt avoided)
#   3. fallback               -> plain ssh/scp           (password prompted per call)

function Get-SshTarget {
    "$($Deploy.sshUser)@$($Deploy.sshHost)"
}

# Returns the ssh/scp auth argument list for the chosen auth mode.
function Get-SshAuthArgs {
    param([string]$IdentityFile, [string]$Password)
    $args = @()
    if ($IdentityFile) {
        $args += @("-i", $IdentityFile, "-o", "StrictHostKeyChecking=accept-new")
    }
    elseif ($Password) {
        $sshpass = (Get-Command sshpass -ErrorAction SilentlyContinue)
        if ($sshpass) {
            $env:SSHPASS = $Password
            $args += @("-o", "StrictHostKeyChecking=accept-new")
        }
        else {
            Write-Warning "sshpass not found — you will be prompted for the password for each command."
            Write-Warning "Install it once to avoid repeated prompts:  scoop install sshpass"
            $args += @("-o", "StrictHostKeyChecking=accept-new")
        }
    }
    else {
        $args += @("-o", "StrictHostKeyChecking=accept-new")
    }
    return , $args
}

function Get-SshPre {
    param([string]$IdentityFile, [string]$Password)
    $pre = @()
    if (-not $IdentityFile -and $Password) {
        $sshpass = (Get-Command sshpass -ErrorAction SilentlyContinue)
        if ($sshpass) { $pre += "sshpass", "-e" }
    }
    return , $pre
}

# Runs an ssh/scp invocation, echoing the command and capturing stderr so we can
# surface the real failure instead of just an exit code. Writes the captured
# stderr/stdout to the host on non-zero exit, and always to the verbose stream.
function Invoke-SshCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Binary,   # "ssh" or "scp"
        [Parameter(Mandatory = $true)][string[]]$ArgList # full arg list AFTER the binary
    )
    $cmd = ($ArgList | ForEach-Object {
            $s = "$_"
            if ($s -match '\s') { "`"$s`"" } else { $s }
        }) -join ' '
    Write-Verbose "$Binary $cmd"

    $errFile = [System.IO.Path]::GetTempFileName()
    $outFile = [System.IO.Path]::GetTempFileName()
    # Relax Stop while running native ssh/scp: stderr lines are captured to file,
    # not allowed to become terminating errors.
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $Binary @ArgList 2>$errFile >$outFile
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $prevEAP
    }
    $errText = if (Test-Path $errFile) { Get-Content $errFile -Raw } else { "" }
    $outText = if (Test-Path $outFile) { Get-Content $outFile -Raw } else { "" }
    Remove-Item $errFile, $outFile -Force -ErrorAction SilentlyContinue

    if ($outText) { Write-Verbose $outText.Trim() }
    if ($errText) { Write-Verbose $errText.Trim() }

    if ($code -ne 0) {
        Write-Host "---- $Binary exit code: $code ----" -ForegroundColor DarkGray
        if ($outText) { Write-Host $outText.Trim() -ForegroundColor DarkGray }
        if ($errText) {
            Write-Host "---- stderr ----" -ForegroundColor DarkRed
            Write-Host $errText.Trim() -ForegroundColor DarkRed
        }
        Write-Host "----" -ForegroundColor DarkGray
    }
    return $code
}

function Invoke-Ssh {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [string]$IdentityFile,
        [string]$Password,
        [switch]$Trace
    )
    $target = Get-SshTarget
    $pre = Get-SshPre -IdentityFile $IdentityFile -Password $Password
    $sshArgs = Get-SshAuthArgs -IdentityFile $IdentityFile -Password $Password

    # Normalize to LF. Multi-line commands authored in a CRLF-saved .ps1 would
    # otherwise ship '\r' to the remote bash, which rejects them with errors
    # like "set: -: invalid option" or "$'...path...\r': No such file or directory".
    $Command = $Command -replace "`r`n", "`n" -replace "`r", "`n"
    if ($Trace -or $env:DEPLOY_SSH_VERBOSE) { $sshArgs += @("-v") }

    $argList = @()
    if ($pre) { $argList += $pre }
    $argList += $sshArgs + @($target) + @($Command)
    return Invoke-SshCommand -Binary "ssh" -ArgList $argList
}

function Invoke-Scp {
    param(
        [Parameter(Mandatory = $true)][string]$LocalPath,
        [Parameter(Mandatory = $true)][string]$RemotePath,
        [string]$IdentityFile,
        [string]$Password,
        [switch]$Recursive,
        [switch]$Trace
    )
    $target = Get-SshTarget
    $pre = Get-SshPre -IdentityFile $IdentityFile -Password $Password
    $scpArgs = Get-SshAuthArgs -IdentityFile $IdentityFile -Password $Password
    if ($Recursive) { $scpArgs += "-r" }
    if ($Trace -or $env:DEPLOY_SSH_VERBOSE) { $scpArgs += "-v" }

    $argList = @()
    if ($pre) { $argList += $pre }
    $argList += $scpArgs + @($LocalPath, "${target}:${RemotePath}")
    return Invoke-SshCommand -Binary "scp" -ArgList $argList
}

function Die([string]$Message, [int]$Code = 1) {
    Write-Host ""
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit $Code
}
