# Run from the Lektrus repository root in the VS Code PowerShell terminal:
# powershell -ExecutionPolicy Bypass -File .\scripts\install-android-dev.ps1
# Creates and installs ru.lektrus.board.dev without uninstalling ru.lektrus.board.
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Require-Command([string]$name) {
  $command = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $command) { throw "Missing '$name'. Install it and restart the VS Code terminal." }
  return $command.Source
}

$npm = Require-Command "npm.cmd"
$null = Require-Command "node.exe"
$null = Require-Command "java.exe"

if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) {
  $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
  if (Test-Path $sdk) { $env:ANDROID_HOME = $sdk }
}
if (-not $env:ANDROID_HOME -and $env:ANDROID_SDK_ROOT) {
  $env:ANDROID_HOME = $env:ANDROID_SDK_ROOT
}
if (-not $env:ANDROID_HOME -or -not (Test-Path $env:ANDROID_HOME)) {
  throw "Android SDK not found. Install Android Studio / Android SDK, set ANDROID_HOME, restart VS Code."
}
$adbPath = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
if (-not (Test-Path $adbPath)) {
  throw "adb.exe not found in Android SDK platform-tools. Install Android SDK Platform-Tools."
}

Write-Host "[1/5] Checking USB debugging and device authorization..." -ForegroundColor Cyan
& $adbPath start-server | Out-Null
$deviceLines = @(& $adbPath devices | Select-String '^\S+\s+device$')
if ($deviceLines.Count -eq 0) {
  & $adbPath devices
  throw "No authorized phone detected. Enable USB debugging and approve this PC on your phone."
}
if ($deviceLines.Count -gt 1) {
  & $adbPath devices
  throw "Multiple devices detected. Leave one device connected before continuing."
}
$serial = ($deviceLines[0].ToString() -split '\s+')[0]
Write-Host "Device: $serial" -ForegroundColor Green

Write-Host "[2/5] Checking dependencies..." -ForegroundColor Cyan
# A node_modules lockfile can exist even if Capacitor packages are missing.
# Verify installed packages, not just the existence of the lockfile.
$needsInstall = -not (Test-Path (Join-Path $root "node_modules\.package-lock.json"))
if (-not $needsInstall) {
  & $npm ls --depth=0 --all=false --silent *> $null
  $needsInstall = $LASTEXITCODE -ne 0
}
if ($needsInstall) {
  Write-Host "Installing or repairing missing npm packages (including Capacitor)..." -ForegroundColor Yellow
  & $npm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
}

Write-Host "[3/5] Building Lektrus web assets..." -ForegroundColor Cyan
& $npm run build
if ($LASTEXITCODE -ne 0) { throw "Web build failed" }

Write-Host "[4/5] Synchronizing Capacitor Android project..." -ForegroundColor Cyan
& (Join-Path $root "node_modules\.bin\cap.cmd") sync android
if ($LASTEXITCODE -ne 0) { throw "Capacitor sync failed" }

Write-Host "[5/5] Building and installing Lektrus Dev via USB..." -ForegroundColor Cyan
Push-Location (Join-Path $root "android")
try {
  & .\gradlew.bat :app:installDebug --no-daemon
  if ($LASTEXITCODE -ne 0) { throw "Gradle build/install failed" }
} finally {
  Pop-Location
}

Write-Host "Opening Lektrus Dev on your phone..." -ForegroundColor Cyan
& $adbPath -s $serial shell monkey -p ru.lektrus.board.dev -c android.intent.category.LAUNCHER 1
if ($LASTEXITCODE -ne 0) { throw "App installed, but automatic launch failed. Open Lektrus Dev manually." }
Write-Host "Done! Lektrus Dev is installed; production Lektrus remains untouched." -ForegroundColor Green
