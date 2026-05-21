param(
  [string]$BackendPort = "8001",
  [string]$FrontendPort = "3000",
  [bool]$SingleDomain = $true
)

$ErrorActionPreference = "Stop"

function Get-CloudflaredPath {
  $p1 = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
  $p2 = "C:\Program Files\cloudflared\cloudflared.exe"
  if (Test-Path $p1) { return $p1 }
  if (Test-Path $p2) { return $p2 }
  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "cloudflared not found. Install it first."
}

function Start-QuickTunnel {
  param(
    [string]$Exe,
    [string]$Port,
    [string]$Name
  )
  $logDir = Join-Path $PSScriptRoot "cloudflared-logs"
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $out = Join-Path $logDir "$Name.out.log"
  $err = Join-Path $logDir "$Name.err.log"
  if (Test-Path $out) { Remove-Item $out -Force }
  if (Test-Path $err) { Remove-Item $err -Force }

  Start-Process -FilePath $Exe `
    -ArgumentList @(
      "tunnel",
      "--url", "http://127.0.0.1:$Port",
      "--no-autoupdate",
      "--protocol", "http2",
      "--edge-ip-version", "4"
    ) `
    -RedirectStandardOutput $out `
    -RedirectStandardError $err `
    -WindowStyle Hidden | Out-Null

  return @{ Out = $out; Err = $err }
}

function Read-TunnelUrl {
  param(
    [string]$OutFile,
    [string]$ErrFile
  )
  $text = ""
  if (Test-Path $OutFile) { $text += (Get-Content -Raw -Path $OutFile -ErrorAction SilentlyContinue) + "`n" }
  if (Test-Path $ErrFile) { $text += (Get-Content -Raw -Path $ErrFile -ErrorAction SilentlyContinue) + "`n" }

  $rx = 'https://(?!api\.)[a-z0-9-]+\.trycloudflare\.com'
  $m = [regex]::Match($text, $rx)
  if ($m.Success) { return $m.Value }
  return ""
}

function Upsert-EnvVar {
  param(
    [string]$EnvPath,
    [string]$Key,
    [string]$Value
  )
  $lines = @()
  if (Test-Path $EnvPath) {
    $lines = Get-Content -Path $EnvPath
  }
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^\s*$Key=") {
      $lines[$i] = "$Key=$Value"
      $found = $true
    }
  }
  if (-not $found) {
    $lines += "$Key=$Value"
  }
  [System.IO.File]::WriteAllLines($EnvPath, $lines, (New-Object System.Text.UTF8Encoding($false)))
}

$exe = Get-CloudflaredPath
Write-Host "Using cloudflared: $exe"

Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$b = Start-QuickTunnel -Exe $exe -Port $BackendPort -Name "backend"
$f = $null
if (-not $SingleDomain) {
  $f = Start-QuickTunnel -Exe $exe -Port $FrontendPort -Name "frontend"
}

$backendUrl = ""
$frontendUrl = ""
for ($i = 0; $i -lt 40; $i++) {
  $backendUrl = Read-TunnelUrl -OutFile $b.Out -ErrFile $b.Err
  if ($SingleDomain) {
    $frontendUrl = $backendUrl
  } else {
    $frontendUrl = Read-TunnelUrl -OutFile $f.Out -ErrFile $f.Err
  }
  if ($backendUrl -and $frontendUrl) { break }
  Start-Sleep -Seconds 1
}

if (-not $backendUrl -or -not $frontendUrl) {
  Write-Host "Could not create cloudflared tunnel URLs."
  Write-Host "Check logs:"
  Write-Host "  $($b.Out)"
  Write-Host "  $($b.Err)"
  if ($f) {
    Write-Host "  $($f.Out)"
    Write-Host "  $($f.Err)"
  }
  exit 1
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envFile = Join-Path $root ".env"
Upsert-EnvVar -EnvPath $envFile -Key "REACT_APP_API_BASE" -Value "$backendUrl/api"
Upsert-EnvVar -EnvPath $envFile -Key "FRONTEND_PUBLIC_URL" -Value $frontendUrl
Upsert-EnvVar -EnvPath $envFile -Key "REACT_APP_TELEGRAM_BOT_USERNAME" -Value "EmaeFreebot"
Upsert-EnvVar -EnvPath $envFile -Key "TELEGRAM_BOT_USERNAME" -Value "EmaeFreebot"

$domain = ($frontendUrl -replace "^https://", "")
Write-Host ""
Write-Host "Done."
Write-Host "Backend URL: $backendUrl"
Write-Host "Frontend URL: $frontendUrl"
Write-Host ""
Write-Host "Set in BotFather /setdomain for @EmaeFreebot:"
Write-Host "  $domain"
Write-Host ""
Write-Host "Now restart backend and frontend."
