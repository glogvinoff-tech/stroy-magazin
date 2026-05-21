@echo off
setlocal

set CF_EXE_LOCAL=%~dp0cloudflared-2026.2.0.exe
set CF_EXE_SYSTEM=C:\Program Files (x86)\cloudflared\cloudflared.exe
set CF_CFG=C:\Users\tema\.cloudflared\config.yml
set TUNNEL_NAME=vashenazvanie-app

set CF_EXE=
if exist "%CF_EXE_LOCAL%" set CF_EXE=%CF_EXE_LOCAL%
if not defined CF_EXE if exist "%CF_EXE_SYSTEM%" set CF_EXE=%CF_EXE_SYSTEM%

if not defined CF_EXE (
  echo cloudflared.exe not found.
  echo Checked:
  echo   "%CF_EXE_LOCAL%"
  echo   "%CF_EXE_SYSTEM%"
  pause
  exit /b 1
)

if not exist "%CF_CFG%" (
  echo config.yml not found: "%CF_CFG%"
  pause
  exit /b 1
)

echo Starting named tunnel "%TUNNEL_NAME%" with config "%CF_CFG%"
echo Keep this window open. If tunnel drops, it will restart automatically.
echo.

:loop
"%CF_EXE%" tunnel --config "%CF_CFG%" run %TUNNEL_NAME%
echo.
echo Tunnel stopped/crashed. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto loop
