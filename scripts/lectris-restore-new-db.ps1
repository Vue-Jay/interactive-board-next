# Guarded Lectris restore. Default: READ-ONLY PREVIEW. Use -Apply ONLY after checking preview.
# All SQL commands are restricted to the exact NEW Supabase project ref.
# Any failed restore rolls back via psql --single-transaction --set ON_ERROR_STOP=1.
param([switch]$Apply)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$oldRef = 'vblmywoczinzezcmqrgb'
$newRef = 'vznjpfqodjnxnmkrhiqk'
$root = Split-Path -Parent $PSScriptRoot
$backupRoot = Join-Path $root 'migration-backups'

Write-Host ''
Write-Host 'LECTRIS / GUARDED SQL RESTORE' -ForegroundColor Cyan
Write-Host ('SOURCE snapshot ref: ' + $oldRef)
Write-Host ('DESTINATION only: ' + $newRef) -ForegroundColor Yellow
if ($Apply) {
  Write-Host 'MODE: APPLY (will write to NEW project after explicit confirmation)' -ForegroundColor Yellow
} else {
  Write-Host 'MODE: PREVIEW ONLY (does not write to any database)' -ForegroundColor Green
}
if (-not (Test-Path -LiteralPath $backupRoot -PathType Container)) {
  throw 'Local migration-backups folder does not exist.'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker is not installed.' }
& docker info '--format' '{{.ServerVersion}}' *> $null
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop first.' }

$folders = @(Get-ChildItem -LiteralPath $backupRoot -Directory |
  Where-Object { $_.Name -like ('old-' + $oldRef + '-*') -and $_.Name -notlike '*-storage-*' } |
  Sort-Object LastWriteTimeUtc -Descending)
$backup = $null
foreach ($candidate in $folders) {
  $complete = $true
  foreach ($n in @('roles.sql','schema.sql','data.sql')) {
    $p = Join-Path $candidate.FullName $n
    $item = Get-Item -LiteralPath $p -ErrorAction SilentlyContinue
    if ($null -eq $item -or $item.Length -le 0) { $complete = $false; break }
  }
  if ($complete) { $backup = $candidate; break }
}
if ($null -eq $backup) { throw 'Cannot find a complete OLD SQL snapshot. No changes made.' }
$backupPath = $backup.FullName
Write-Host ('LOCAL SQL backup folder: ' + $backupPath)
Write-Host 'SQL files contain personal data and password hashes. Never publish them.'
$flags = @{}
foreach ($key in @('auth.users','auth.identities','storage.buckets','storage.objects')) { $flags[$key] = $false }
$vaultSecretsRows = [long]0
$insideVaultCopy = $false
$reader = [System.IO.StreamReader]::new((Join-Path $backupPath 'data.sql'))
try {
  while ($null -ne ($line = $reader.ReadLine())) {
    if ($insideVaultCopy) {
      if ($line -eq '\.') { $insideVaultCopy = $false } else { $vaultSecretsRows++ }
      continue
    }
    $match = [regex]::Match($line, '^\s*COPY\s+"?([a-z_][a-z_0-9]*)"?\."?([a-z_][a-z_0-9]*)"?\s*\(', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($match.Success) {
      $key = $match.Groups[1].Value.ToLowerInvariant() + '.' + $match.Groups[2].Value.ToLowerInvariant()
      if ($flags.ContainsKey($key)) { $flags[$key] = $true }
      if ($key -eq 'vault.secrets') { $insideVaultCopy = $true }
    }
  }
} finally {
  $reader.Dispose()
}
foreach ($key in $flags.Keys) {
  if (-not $flags[$key]) { throw ('Missing required COPY section in data.sql: ' + $key + '. Do not restore.') }
}
Write-Host 'Local SQL sections verified: Auth users/identities and Storage buckets/objects.'
if ($vaultSecretsRows -gt 0) {
  throw ('STOP: backup contains ' + $vaultSecretsRows + ' Vault secret rows. Manual Vault encryption root-key migration must be planned first. Nothing restored.')
}
Write-Host 'No Vault secret rows found in SQL snapshot (other encryption use still requires review).'
foreach ($n in @('roles.sql','schema.sql','data.sql')) {
  $file = Get-Item -LiteralPath (Join-Path $backupPath $n)
  Write-Host ('  ' + $n + ': ' + [math]::Round($file.Length / 1KB,1) + ' KiB')
}

Write-Host ''
Write-Host 'OPEN NEW Lectris > Connect > Session pooler > URI.'
Write-Host 'Paste its URI with [YOUR-PASSWORD] unchanged. Password is requested separately.'
Write-Host 'Neither URI nor password may be shared in chat, GitHub or logs.'
$secure = Read-Host 'Paste NEW database URI (hidden)' -AsSecureString
$bstr = [IntPtr]::Zero
$raw = $null
try {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $raw = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
$secure = $null
$password = $null
$original = @{}
$envNames = @('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE')
try {
  if ([string]::IsNullOrWhiteSpace($raw)) { throw 'Empty URI.' }
  if ($raw.Contains('[YOUR-PASSWORD]')) {
    $securePassword = Read-Host 'NEW Lectris database password (hidden)' -AsSecureString
    $passBstr = [IntPtr]::Zero
    try {
      $passBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
      $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passBstr)
      if ([string]::IsNullOrEmpty($password)) { throw 'Password is empty.' }
      $raw = $raw.Replace('[YOUR-PASSWORD]', [Uri]::EscapeDataString($password))
    } finally {
      if ($passBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passBstr) }
      $securePassword = $null
    }
  }
  $uri = $null
  if (-not [Uri]::TryCreate($raw, [UriKind]::Absolute, [ref]$uri)) { throw 'Invalid database URI.' }
  if ($uri.Scheme -notin @('postgres','postgresql')) { throw 'Expected postgresql:// URI.' }
  $pieces = $uri.UserInfo -split ':',2
  if ($pieces.Count -ne 2) { throw 'URI does not include a password field.' }
  $dbUser = [Uri]::UnescapeDataString($pieces[0])
  if ($null -eq $password) { $password = [Uri]::UnescapeDataString($pieces[1]) }
  if ([string]::IsNullOrEmpty($password)) { throw 'Password is empty.' }
  $pooler = $uri.Host -match '\.pooler\.supabase\.com$'
  $direct = $uri.Host -ieq ('db.' + $newRef + '.supabase.co')
  if (-not $pooler -and -not $direct) { throw 'STOP: unknown DB host. Use NEW project Connect URI.' }
  if ($pooler -and $dbUser -cne ('postgres.' + $newRef)) { throw 'STOP: wrong Session pooler user. NEW ref is required.' }
  if ($direct -and $dbUser -cne 'postgres') { throw 'STOP: wrong direct DB username.' }
  if ($dbUser.Contains($oldRef)) { throw 'STOP: detected OLD project account.' }
  if ($uri.Port -ne 5432 -or $uri.AbsolutePath -ne '/postgres') { throw 'Expected port 5432 and database /postgres.' }

  foreach ($key in $envNames) { $original[$key] = [Environment]::GetEnvironmentVariable($key,'Process') }
  $env:PGHOST = $uri.Host
  $env:PGPORT = [string]$uri.Port
  $env:PGUSER = $dbUser
  $env:PGPASSWORD = $password
  $env:PGDATABASE = 'postgres'
  $env:PGSSLMODE = 'require'
  $query = "SELECT (SELECT count(*) FROM auth.users)::text || '|' || (SELECT count(*) FROM auth.identities) || '|' || (SELECT count(*) FROM storage.buckets) || '|' || (SELECT count(*) FROM storage.objects) || '|' || (SELECT count(*) FROM pg_tables WHERE schemaname = 'public');"
  $psqlBase = @('run','--rm','--env','PGHOST','--env','PGPORT','--env','PGUSER','--env','PGPASSWORD','--env','PGDATABASE','--env','PGSSLMODE','--entrypoint','psql','public.ecr.aws/supabase/postgres:17.11.0.004')
  $state = & docker @psqlBase '-X' '-w' '-t' '-A' '-v' 'ON_ERROR_STOP=1' '-c' $query
  if ($LASTEXITCODE -ne 0) { throw 'Cannot query NEW Lectris database. Nothing was restored.' }
  $last = (($state | Out-String).Trim() -split '\r?\n')[-1].Trim()
  Write-Host ('NEW project row counts (Auth users|identities|buckets|objects|public tables): ' + $last)
  if ($last -cne '0|0|0|0|0') {
    throw 'STOP: NEW target is not empty. Refusing to restore or overwrite existing data.'
  }
  Write-Host 'NEW target is empty; project ref and connection passed guards.' -ForegroundColor Green
  if (-not $Apply) {
    Write-Host ''
    Write-Host 'PREVIEW SUCCESS: all checks passed. No SQL was imported.' -ForegroundColor Green
    Write-Host 'Restore will only run with the explicit -Apply switch and typed confirmation.'
    Write-Host 'Before applying, confirm you do not use Supabase Vault/column encryption on the old project.'
    return
  }

  Write-Host ''
  Write-Host 'WARNING: Next step WRITES restored data into NEW Lectris only.' -ForegroundColor Yellow
  Write-Host 'Backups remain on local disk. The OLD database is never used by this script.'
  Write-Host 'One failed SQL command will roll back the entire SQL restore transaction.'
  $confirmation = Read-Host 'Type RESTORE LECTRIS to proceed'
  if ($confirmation -cne 'RESTORE LECTRIS') {
    throw 'Canceled. No SQL restore was started.'
  }
  $mount = 'type=bind,source=' + $backupPath + ',target=/lectris-backup,readonly'
  Write-Host 'Starting transactional restore...'
  & docker run --rm --env PGHOST --env PGPORT --env PGUSER --env PGPASSWORD --env PGDATABASE --env PGSSLMODE --mount $mount --entrypoint psql public.ecr.aws/supabase/postgres:17.11.0.004 -X -w -q -v ON_ERROR_STOP=1 -v VERBOSITY=terse --single-transaction -f /lectris-backup/roles.sql -f /lectris-backup/schema.sql -c 'SET session_replication_role = replica' -f /lectris-backup/data.sql
  if ($LASTEXITCODE -ne 0) {
    throw 'SQL restore FAILED. Single-transaction mode should roll back. Do not upload Storage or switch the app. Inspect the error.'
  }
  Write-Host 'SQL RESTORE completed without psql errors.' -ForegroundColor Green
  $after = & docker @psqlBase '-X' '-w' '-t' '-A' '-v' 'ON_ERROR_STOP=1' '-c' $query
  if ($LASTEXITCODE -ne 0) { throw 'SQL imported, but post-import read-only validation failed. Do not switch app.' }
  $afterText = (($after | Out-String).Trim() -split '\r?\n')[-1].Trim()
  Write-Host ('NEW project counts after import (users|identities|buckets|objects|public tables): ' + $afterText)
  Write-Host 'Do not switch the app yet; actual Storage file bytes still require uploading and verification.'
} finally {
  foreach ($key in $envNames) {
    if ($original.ContainsKey($key)) { [Environment]::SetEnvironmentVariable($key,$original[$key],'Process') }
  }
  $password = $null
  $raw = $null
}
