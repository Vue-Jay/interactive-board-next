# Lectris database migration: READ-ONLY PRE-FLIGHT.
# Run from C:\Users\user\InteractiveBoardNext after creating a target project.
# This script NEVER connects to, writes to, or modifies either database.
param(
  [string]$OldProjectRef = $(if ($env:LECTRIS_OLD_PROJECT_REF) { $env:LECTRIS_OLD_PROJECT_REF } else { 'vblmywoczinzezcmqrgb' }),
  [string]$NewProjectRef = $(if ($env:LECTRIS_NEW_PROJECT_REF) { $env:LECTRIS_NEW_PROJECT_REF } else { 'vznjpfqodjnxnmkrhiqk' })
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Write-Host ""
Write-Host "LECTRIS / MIGRATION PREFLIGHT" -ForegroundColor Cyan
Write-Host "Only checks local tools and project references. No database changes."
Write-Host ""
function Assert-Ref([string]$Name, [string]$Ref) {
  if ([string]::IsNullOrWhiteSpace($Ref)) {
    Write-Host "  [NOT SET] $Name" -ForegroundColor Yellow
    return $false
  }
  if ($Ref -cnotmatch '^[a-z0-9-]{10,40}$') {
    throw "$Name has invalid format. Enter the PROJECT REF, not the URL or API key."
  }
  Write-Host "  [OK] $Name : $Ref" -ForegroundColor Green
  return $true
}
$oldOk = Assert-Ref 'OLD / Original whiteboard' $OldProjectRef
$newOk = Assert-Ref 'NEW / Lectris only' $NewProjectRef
if ($NewProjectRef -ceq 'qxpocdbzqlgcqgmivtem') {
  throw 'STOP: old target was replaced. Use new Lectris ref vznjpfqodjnxnmkrhiqk.'
}
if ($oldOk -and $newOk -and $OldProjectRef -ceq $NewProjectRef) {
  throw "STOP: OLD and NEW project refs are identical. Never restore into production."
}
Write-Host ""
# Supabase CLI can be run through npx without a global executable.
$cli = Get-Command supabase -ErrorAction SilentlyContinue
$npx = Get-Command npx -ErrorAction SilentlyContinue
if ($null -ne $cli) {
  Write-Host "  [OK] supabase CLI (global)" -ForegroundColor Green
}
elseif ($null -ne $npx) {
  Write-Host "  [AVAILABLE VIA NPX] use npx --yes supabase <command>" -ForegroundColor Green
  Write-Host "    This check does not download anything. The first npx execution may download CLI."
}
else {
  Write-Host "  [MISSING] supabase CLI and npx" -ForegroundColor Yellow
}
$postgresBase = Join-Path $env:ProgramFiles 'PostgreSQL'
foreach ($toolName in @('psql','pg_dump')) {
  $found = Get-Command $toolName -ErrorAction SilentlyContinue
  if ($null -ne $found) {
    Write-Host "  [OK] Found $toolName on PATH" -ForegroundColor Green
    continue
  }
  $candidate = $null
  if (Test-Path $postgresBase) {
    $candidate = Get-ChildItem $postgresBase -Directory -ErrorAction SilentlyContinue |
      Sort-Object -Property Name -Descending |
      ForEach-Object { Join-Path $_.FullName ('bin\\' + $toolName + '.exe') } |
      Where-Object { Test-Path $_ } |
      Select-Object -First 1
  }
  if ($null -ne $candidate) {
    Write-Host "  [FOUND OUTSIDE PATH] $toolName at $candidate" -ForegroundColor Yellow
    Write-Host "    Add this PostgreSQL bin folder to PATH in your current PowerShell session."
  }
  else {
    Write-Host "  [MISSING] $toolName" -ForegroundColor Yellow
  }
}
$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($null -ne $docker) {
  Write-Host "  [OK] Docker command exists (daemon not tested)" -ForegroundColor Green
}
else {
  Write-Host "  [MISSING] Docker CLI (required by Supabase db dump)" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Next: read docs/lectris-full-migration.md before running ANY backup or restore."
Write-Host "Do not put database passwords, service-role keys or backup files in Git."
if (-not $oldOk -or -not $newOk) {
  Write-Host "Project refs can be found in the Supabase project URL: https://PROJECT_REF.supabase.co."
  Write-Host "Provide refs with -OldProjectRef and -NewProjectRef once BOTH projects exist."
}
Write-Host ""
