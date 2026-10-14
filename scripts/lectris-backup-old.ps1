# Backup the OLD Supabase database only. Does not restore or write to either project.
# NOTE: the database URL is passed to the CLI process while it runs. Do not run
# on an untrusted/shared computer or share command-line/process/log output unredacted.
param(
  [string]$OldProjectRef = 'vblmywoczinzezcmqrgb',
  [string]$NewProjectRef = 'qxpocdbzqlgcqgmivtem'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($OldProjectRef -notmatch '^[a-z0-9]{20}$' -or $NewProjectRef -notmatch '^[a-z0-9]{20}$' -or $OldProjectRef -ceq $NewProjectRef) {
  throw 'STOP: source and destination project references must be valid and different.'
}
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  throw 'npx not found. Install Node.js and verify: npx --yes supabase --version'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'docker not found. Start Docker Desktop.'
}
& docker info '--format' '{{.ServerVersion}}' *> $null
if ($LASTEXITCODE -ne 0) {
  throw 'Docker Engine is not running. Start Docker Desktop before backing up.'
}

Write-Host ''
Write-Host 'LECTRIS: READ-ONLY DATABASE BACKUP' -ForegroundColor Cyan
Write-Host ('SOURCE project reference: ' + $OldProjectRef) -ForegroundColor Yellow
Write-Host ('DESTINATION (NEVER USED BY THIS SCRIPT): ' + $NewProjectRef)
Write-Host 'This script only runs supabase db dump against the SOURCE.'
Write-Host 'Use the OLD project Dashboard > Connect > Session pooler > URI.'
Write-Host 'Replace the [YOUR-PASSWORD] placeholder locally with the OLD DATABASE password.'
Write-Host 'If password contains special URI characters, percent-encode them.'
Write-Host 'Do not paste the URI or any token/password into ChatGPT or GitHub.'
Write-Host ''
$secure = Read-Host 'Paste the complete OLD database URI (hidden input)' -AsSecureString
$bstr = [IntPtr]::Zero
$dbUrl = $null
try {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $dbUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
}
finally {
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}
$secure = $null
try {
  $uri = $null
  if (-not [Uri]::TryCreate($dbUrl, [UriKind]::Absolute, [ref]$uri)) {
    throw 'STOP: invalid database URI.'
  }
  if ($uri.Scheme -ne 'postgresql' -and $uri.Scheme -ne 'postgres') {
    throw 'STOP: this must be a PostgreSQL database URI, not the HTTPS Supabase URL.'
  }
  $sourceInHost = $uri.Host -ieq ('db.' + $OldProjectRef + '.supabase.co')
  $sourceInUser = $uri.UserInfo -like ('postgres.' + $OldProjectRef + ':*')
  if (-not $sourceInHost -and -not $sourceInUser) {
    throw 'STOP: project ref does not match the old project. Verify OLD database URI in Dashboard > Connect.'
  }
  if ($dbUrl -match '\[YOUR-PASSWORD\]' -or $uri.UserInfo -notmatch ':') {
    throw 'STOP: missing database password. Paste the full OLD DB URI with password.'
  }
  if ($uri.Host -ieq ('db.' + $NewProjectRef + '.supabase.co') -or $uri.UserInfo -like ('postgres.' + $NewProjectRef + ':*')) {
    throw 'STOP: database URL seems to belong to the NEW project.'
  }

  $repoRoot = Split-Path -Parent $PSScriptRoot
  $backupRoot = Join-Path $repoRoot 'migration-backups'
  $stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + $PID
  $backupDir = Join-Path $backupRoot ('old-' + $OldProjectRef + '-' + $stamp)
  New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
  Write-Host ''
  Write-Host ('Saving encrypted-at-rest-sensitive backups to LOCAL folder: ' + $backupDir)
  Write-Host 'These SQL files contain account data and password hashes. Never publish/share them.'
  $dumps = @(
    @{ Name='roles.sql'; Args=@('--role-only') },
    @{ Name='schema.sql'; Args=@() },
    @{ Name='data.sql'; Args=@('--use-copy','--data-only','-x','storage.buckets_vectors','-x','storage.vector_indexes') }
  )
  foreach ($dump in $dumps) {
    $file = Join-Path $backupDir $dump.Name
    Write-Host ('Starting ' + $dump.Name + ' ...') -ForegroundColor Cyan
    $argsForCli = @('--yes','supabase','db','dump','--db-url',$dbUrl,'-f',$file) + $dump.Args
    & npx @argsForCli
    if ($LASTEXITCODE -ne 0) {
      throw ('BACKUP FAILED at ' + $dump.Name + '. Do not restore or delete the old project.')
    }
    $created = Get-Item $file -ErrorAction SilentlyContinue
    if ($null -eq $created -or $created.Length -eq 0) {
      throw ('BACKUP FILE MISSING OR EMPTY: ' + $dump.Name)
    }
    Write-Host ('  OK ' + $dump.Name + ' : ' + $created.Length + ' bytes') -ForegroundColor Green
  }
  Write-Host ''
  Write-Host 'All three read-only backup commands finished. The old project is unchanged.' -ForegroundColor Green
  Write-Host ('LOCAL backup folder: ' + $backupDir)
  Write-Host 'Do not restore anything yet. Next: separately back up Storage files and audit records.'
}
finally {
  # Strings are immutable; this only drops references. Run on a trusted PC.
  $dbUrl = $null
  $uri = $null
}
