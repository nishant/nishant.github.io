<#
.SYNOPSIS
  Deploys the pushed commit into the live checkout, builds server/, and restarts the
  Startpage scheduled task. Run by the GitHub Actions self-hosted runner (as SYSTEM) on
  every push to master; can also be run by hand from an elevated shell.
  Never touches server\.env. The Angular bundle is the committed docs/ folder, so no
  frontend build happens here (run `npm run deploy` at the repo root before committing).
.EXAMPLE
  .\scripts\deploy.ps1                      # C:\Apps\startpage from origin/master
  .\scripts\deploy.ps1 -NoRestart           # update + build only
#>
[CmdletBinding()]
param(
  [string]$Target = 'C:\Apps\startpage',
  [string]$Repo = 'https://github.com/nishant/nishant.github.io.git',
  [string]$Branch = 'master',
  # Where to fetch the new commit from. 'origin' (GitHub) works for this public repo,
  # but the Actions workflow passes its own checkout so every deploy behaves the same
  # way as the private repos' deploys.
  [string]$FetchFrom = 'origin',
  [int]$Port = 8800,
  [switch]$NoRestart
)
$ErrorActionPreference = 'Stop'

function Run([string]$Label, [scriptblock]$Block) {
  Write-Host ">> $Label"
  $global:LASTEXITCODE = 0
  # Windows PowerShell 5.1 turns a native command's stderr into a terminating error
  # when $ErrorActionPreference is Stop and the output is captured - and git and npm
  # write ordinary progress to stderr. Relax it for the call; the exit code is the verdict.
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Block } finally { $ErrorActionPreference = $prev }
  if ($LASTEXITCODE) { throw "$Label failed (exit $LASTEXITCODE)" }
}

# The live checkout may be owned by a different account than the one deploying
# (SYSTEM vs the user); git refuses to touch such a directory unless it is marked safe.
$gitTarget = $Target -replace '\\', '/'
$safe = @(git config --global --get-all safe.directory)
if (-not ($safe -contains $gitTarget)) { git config --global --add safe.directory $gitTarget }

if (-not (Test-Path (Join-Path $Target '.git'))) {
  New-Item -ItemType Directory -Force (Split-Path -Parent $Target) | Out-Null
  $src = if ($FetchFrom -eq 'origin') { $Repo } else { $FetchFrom }
  Run "clone $src" { git clone --no-hardlinks --branch $Branch $src $Target }
  if ($FetchFrom -ne 'origin') { git -C $Target remote set-url origin $Repo }
}

Push-Location $Target
$stopped = $false
try {
  if ($FetchFrom -eq 'origin') {
    Run 'fetch origin' { git fetch --prune origin }
    Run "reset to origin/$Branch" { git reset --hard "origin/$Branch" }
  } else {
    Run "fetch $Branch from $FetchFrom" { git fetch $FetchFrom $Branch }
    Run 'reset to fetched commit' { git reset --hard FETCH_HEAD }
  }

  # npm ci deletes node_modules first, and Windows refuses to delete files the running
  # process holds open - so the site is down for the install + build (a few seconds).
  if (-not $NoRestart) {
    & "$Target\scripts\tasks.ps1" stop
    $stopped = $true
  }
  Push-Location 'server'
  try {
    Run 'npm ci (server)' { npm ci --no-audit --no-fund }
    Run 'build server' { npm run build }
  } finally { Pop-Location }

  if (-not (Test-Path 'server\.env')) {
    Write-Warning 'server\.env is missing in the live checkout - weather will answer 503 until it exists (see server\.env.example)'
  }
  if (-not (Test-Path 'docs\index.html')) { throw 'docs\index.html is missing - the Angular bundle was not committed' }

  if (-not $NoRestart) {
    & "$Target\scripts\tasks.ps1" start
    $stopped = $false
    $ok = $false
    for ($i = 0; $i -lt 30 -and -not $ok; $i++) {
      Start-Sleep -Seconds 2
      try {
        $resp = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 3
        if ($resp.StatusCode -eq 200) { $ok = $true }
      } catch { }
    }
    if (-not $ok) { throw "app did not answer on http://127.0.0.1:$Port/health within 60 s - see logs\app.log" }
  }
  Write-Host "deployed $(git rev-parse --short HEAD) ($Branch) to $Target"
} finally {
  # A failed install or build must not leave the site down: bring the task back on
  # whatever is on disk (the supervisor keeps retrying if that is broken too).
  if ($stopped) {
    Write-Warning 'deploy failed after stopping the task - starting it again'
    try { & "$Target\scripts\tasks.ps1" start } catch { Write-Warning "could not restart task: $_" }
  }
  Pop-Location
}
