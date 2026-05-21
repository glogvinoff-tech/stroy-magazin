param(
  [string]$BackendAddr = "http://127.0.0.1:8001",
  [string]$FrontendAddr = "http://127.0.0.1:3000",
  [string]$Authtoken = ""
)

$ErrorActionPreference = "Stop"

function Get-NgrokPath {
  $cmd = Get-Command ngrok -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $fallback = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter "ngrok.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($fallback) { return $fallback.FullName }
  throw "ngrok is not installed. Install it first."
}

function Start-NgrokApiTunnel {
  param([string]$Addr, [string]$Token)
  $args = @("http", $Addr, "--log=stdout")
  if ($Token) { $args += @("--authtoken", $Token) }
  Start-Process -FilePath (Get-NgrokPath) -ArgumentList $args -WindowStyle Hidden | Out-Null
}

function Get-Tunnels {
  $resp = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 5
  return ($resp.Content | ConvertFrom-Json).tunnels
}

function Wait-TunnelUrl {
  param([string]$Match)
  for ($i=0; $i -lt 30; $i++) {
    try {
      $tunnels = Get-Tunnels
      $hit = $tunnels | Where-Object { $_.config.addr -like "*$Match*" -and $_.public_url -like "https://*" } | Select-Object -First 1
      if ($hit) { return $hit.public_url }
    } catch {}
    Start-Sleep -Seconds 1
  }
  throw "Could not get ngrok public URL for $Match"
}

Write-Host "Starting ngrok tunnels..."
Start-NgrokApiTunnel -Addr $BackendAddr -Token $Authtoken
Start-NgrokApiTunnel -Addr $FrontendAddr -Token $Authtoken
Start-Sleep -Seconds 1

$backendUrl = Wait-TunnelUrl -Match "8001"
$frontendUrl = Wait-TunnelUrl -Match "3000"
Write-Host "Backend HTTPS URL: $backendUrl"
Write-Host "Frontend HTTPS URL: $frontendUrl"

Write-Host ""
Write-Host "Set these values in .env:"
Write-Host "FRONTEND_PUBLIC_URL=$frontendUrl"
Write-Host "REACT_APP_API_BASE=$backendUrl/api"
Write-Host "REACT_APP_TELEGRAM_BOT_USERNAME=EmaeFreebot"
Write-Host "TELEGRAM_BOT_USERNAME=EmaeFreebot"
Write-Host ""
Write-Host "Then set Telegram Login Widget auth URL to:"
Write-Host "$backendUrl/api/auth/telegram/official/callback"
