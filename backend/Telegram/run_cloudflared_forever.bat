@echo off
setlocal

set CF_EXE=C:\Program Files (x86)\cloudflared\cloudflared.exe
if not exist "%CF_EXE%" (
  echo cloudflared.exe not found at "%CF_EXE%"
  pause
  exit /b 1
)

echo Starting persistent Cloudflare quick tunnel to http://127.0.0.1:8001
echo Keep this window open.
echo.

:loop
"%CF_EXE%" tunnel --url http://127.0.0.1:8001 --no-autoupdate --protocol http2 --edge-ip-version 4
echo.
echo Tunnel stopped. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto loop

