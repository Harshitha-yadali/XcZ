# The Auto Apply runner on a Windows server (Windows Server 2022/2025).
# Run in PowerShell as Administrator, from the repository folder:
#
#   powershell -ExecutionPolicy Bypass -File worker\setup-windows.ps1          # install + register
#   powershell -ExecutionPolicy Bypass -File worker\setup-windows.ps1 -Update  # pull new code, restart
#
# It installs Node and Chrome, then registers a task that starts the runner at
# boot and starts it again if it stops. Secrets live in worker\.env only.
param([switch]$Update)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$task = 'PrimoBoost Apply Worker'

if ($Update) {
  Stop-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue
  git -C $repo pull --ff-only
  Start-ScheduledTask -TaskName $task
  Write-Host 'Updated and restarted.'
  exit 0
}

foreach ($id in 'OpenJS.NodeJS.LTS', 'Google.Chrome', 'Git.Git') {
  winget install --id $id -e --silent --accept-source-agreements --accept-package-agreements
}

$envFile = Join-Path $repo 'worker\.env'
if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $repo 'worker\.env.example') $envFile
  Write-Host "Fill in $envFile (notepad $envFile), then run this script again."
  exit 0
}

# A small loop so a crash is followed by a restart 10 seconds later; output goes to worker\worker.log.
$runner = Join-Path $repo 'worker\run-worker.cmd'
@"
@echo off
cd /d "$repo"
:loop
"C:\Program Files\nodejs\node.exe" --env-file=worker\.env --experimental-strip-types worker\index.mjs >> worker\worker.log 2>&1
timeout /t 10 /nobreak >nul
goto loop
"@ | Set-Content -Encoding ASCII $runner

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$runner`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $task -Action $action -Trigger $trigger -Settings $settings -User 'SYSTEM' -RunLevel Highest -Force | Out-Null
Start-ScheduledTask -TaskName $task
Start-Sleep 15
Get-Content (Join-Path $repo 'worker\worker.log') -Tail 20
