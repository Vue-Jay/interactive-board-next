@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
if errorlevel 1 (
  echo.
  echo Lektrus could not start. See the error above.
  pause
)
