# Lectris database migration: READ-ONLY PRE-FLIGHT.
# Run from C:\Users\user\InteractiveBoardNext after creating a target project.
# This script NEVER connects to, writes to, or modifies either database.
param(
  [string]$OldProjectRef = $env:LECTRIS_OLD_PROJECT_REF,
  [string]$NewProjectRef = $env:LECTRIS_NEW_PROJECT_REF
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
if ($oldOk -and $newOk -and $OldProjectRef -ceq $NewProjectRef) {
  throw "STOP: OLD and NEW project refs are identical. Never restore into production."
}
Write-Host ""
foreach ($toolName in @('supabase', 'psql', 'pg_dump')) {
  $found = Get-Command $toolName -ErrorAction SilentlyContinue
  if ($null -ne $found) {
    Write-Host "  [OK] Found $toolName" -ForegroundColor Green
  }
  else {
    Write-Host "  [MISSING] $toolName" -ForegroundColor Yellow
  }
}
Write-Host ""
Write-Host "Next: read docs/lectris-full-migration.md before running ANY backup or restore."
Write-Host "Do not put database passwords, service-role keys or backup files in Git."
if (-not $oldOk -or -not $newOk) {
  Write-Host "Project refs can be found in the Supabase project URL: https://PROJECT_REF.supabase.co."
  Write-Host "Provide refs with -OldProjectRef and -NewProjectRef once BOTH projects exist."
}
Write-Host ""
