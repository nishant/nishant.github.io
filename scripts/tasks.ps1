<#
.SYNOPSIS
  start | stop | restart | status for the Startpage scheduled task.
  Task management needs an elevated shell (Task Scheduler denies even queries otherwise).
.EXAMPLE
  .\scripts\tasks.ps1 restart
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)][ValidateSet('start', 'stop', 'restart', 'status')][string]$Action = 'status',
  [string]$TaskName = 'Startpage',
  [int]$Port = 8800
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Stop-Task {
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($task -and $task.State -eq 'Running') { Stop-ScheduledTask -TaskName $TaskName; Write-Host "stopped $TaskName" }
  # Stop-ScheduledTask sends CTRL+BREAK down the console group: the server child dies
  # and the supervisor exits on seeing that (supervise.mjs). Belt and braces: kill any
  # SYSTEM-owned supervisor or child still around, then wait for the task to leave the
  # Running state - Start-ScheduledTask is silently ignored while it is Running
  # (MultipleInstancesPolicy=IgnoreNew). A developer's own `npm start` is never
  # touched: it is not SYSTEM-owned.
  Start-Sleep -Seconds 1
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine -match 'supervise\.mjs|startpage' -and
      ((Invoke-CimMethod -InputObject $_ -MethodName GetOwner).User -eq 'SYSTEM')
  } | ForEach-Object {
    Write-Host "killing straggler node.exe $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
  for ($i = 0; $i -lt 20; $i++) {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $task -or $task.State -ne 'Running') { break }
    Start-Sleep -Milliseconds 500
  }
  if ($task -and $task.State -eq 'Running') { Write-Warning "$TaskName is still Running after stop; Start-ScheduledTask will be ignored" }
}

function Start-Task {
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if (-not $task) {
    Write-Host "$TaskName is not registered - registering from scripts\$TaskName.task.xml"
    Register-ScheduledTask -Xml (Get-Content (Join-Path $PSScriptRoot "$TaskName.task.xml") -Raw) -TaskName $TaskName -Force | Out-Null
  }
  Start-ScheduledTask -TaskName $TaskName
  Write-Host "started $TaskName"
}

function Show-Status {
  Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue |
    Select-Object TaskName, State | Format-Table -AutoSize | Out-String | Write-Host
  $l = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($l) { Write-Host "${Port}: listening on $($l.LocalAddress) (pid $($l.OwningProcess))" } else { Write-Host "${Port}: not listening" }
  $p = Join-Path $root 'logs\app.log'
  if (Test-Path $p) { Write-Host '--- app.log (tail) ---'; Get-Content $p -Tail 8 | Write-Host }
}

switch ($Action) {
  'stop'    { Stop-Task }
  'start'   { Start-Task }
  'restart' { Stop-Task; Start-Task }
  'status'  { Show-Status }
}
