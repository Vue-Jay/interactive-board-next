# Read-only check of the NEW Lectris Supabase database before restoring OLD backups.
# Does not change either project, and never prints credentials.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$newRef='vznjpfqodjnxnmkrhiqk'
$oldRef='vblmywoczinzezcmqrgb'
$root=Split-Path -Parent $PSScriptRoot
$sql=Join-Path $root 'supabase\lectris_new_target_preflight.sql'
if (-not (Test-Path -LiteralPath $sql -PathType Leaf)) { throw 'Missing preflight SQL. Run git pull in InteractiveBoardNext.' }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker is missing.' }
& docker info '--format' '{{.ServerVersion}}' *> $null
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop and retry.' }
Write-Host ''
Write-Host 'LECTRIS NEW TARGET PREFLIGHT (READ ONLY)' -ForegroundColor Cyan
Write-Host ('TARGET: ' + $newRef) -ForegroundColor Yellow
Write-Host ('OLD source remains untouched: ' + $oldRef)
Write-Host 'Supabase Dashboard -> NEW Lectris project -> Connect -> Session pooler -> URI.'
Write-Host 'Leave the [YOUR-PASSWORD] placeholder unchanged and enter NEW database password separately.'
Write-Host 'Never share passwords or database URIs.'
Write-Host ''
$secure=Read-Host 'Paste NEW Lectris database URI (hidden)' -AsSecureString
$bstr=[IntPtr]::Zero
$raw=$null
$pw=$null
$original=@{}
$envNames=@('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE')
try {
  $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $raw=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
$secure=$null
try {
  if ([string]::IsNullOrWhiteSpace($raw)) { throw 'Empty URI. Copy from NEW project > Connect.' }
  if ($raw.Contains('[YOUR-PASSWORD]')) {
    $passwordSecure=Read-Host 'Paste NEW Lectris database password (hidden)' -AsSecureString
    $passwordPtr=[IntPtr]::Zero
    try {
      $passwordPtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($passwordSecure)
      $pw=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)
      if ([string]::IsNullOrEmpty($pw)) { throw 'Password must not be empty.' }
      $raw=$raw.Replace('[YOUR-PASSWORD]',[Uri]::EscapeDataString($pw))
    } finally {
      if ($passwordPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr) }
      $passwordSecure=$null
    }
  }
  $uri=$null
  if (-not [Uri]::TryCreate($raw,[UriKind]::Absolute,[ref]$uri) -or $uri.Scheme -notin @('postgresql','postgres')) {
    throw 'Invalid postgresql:// URI. Copy from NEW Lectris Connect page.'
  }
  $parts=$uri.UserInfo -split ':',2
  if ($parts.Count -ne 2) { throw 'Password absent from URI.' }
  $dbUser=[Uri]::UnescapeDataString($parts[0])
  if ($null -eq $pw) { $pw=[Uri]::UnescapeDataString($parts[1]) }
  if ([string]::IsNullOrEmpty($pw)) { throw 'Password is empty.' }
  $isPooler=$uri.Host -match '\.pooler\.supabase\.com$'
  $isDirect=$uri.Host -ieq ('db.'+$newRef+'.supabase.co')
  if ($isPooler -and $dbUser -cne ('postgres.'+$newRef)) {
    throw 'STOP: Session pooler must use postgres.NEW_REF. This might be OLD project URI.'
  }
  if ($isDirect -and $dbUser -cne 'postgres') {
    throw 'STOP: direct database URI has unexpected username.'
  }
  if (-not $isPooler -and -not $isDirect) { throw 'STOP: unexpected database host. Copy new Lectris URI.' }
  if ($dbUser.Contains($oldRef)) { throw 'STOP: old InteractiveBoard URI. No queries run.' }
  if ($uri.Port -ne 5432 -or $uri.AbsolutePath -ne '/postgres') {
    throw 'Expected session/direct port 5432 and /postgres database.'
  }
  foreach ($key in $envNames) { $original[$key]=[Environment]::GetEnvironmentVariable($key,'Process') }
  $env:PGHOST=$uri.Host
  $env:PGPORT=[string]$uri.Port
  $env:PGUSER=$dbUser
  $env:PGPASSWORD=$pw
  $env:PGDATABASE='postgres'
  $env:PGSSLMODE='require'
  Write-Host ''
  Write-Host ('Checking target ' + $newRef + ' using read-only SQL...')
  Get-Content -LiteralPath $sql -Raw -Encoding UTF8 | & docker run --rm -i --env PGHOST --env PGPORT --env PGUSER --env PGPASSWORD --env PGDATABASE --env PGSSLMODE --entrypoint psql public.ecr.aws/supabase/postgres:17.11.0.004 -X -v ON_ERROR_STOP=1 -f -
  if ($LASTEXITCODE -ne 0) { throw 'Target read-only preflight FAILED. No database data was changed.' }
  Write-Host ''
  Write-Host 'Target SQL connectivity OK. Review auth_users / storage_objects / public_tables before restoring.' -ForegroundColor Green
  Write-Host 'EXPECTED for new empty target: auth_users=0, auth_identities=0, storage_objects=0, storage_buckets=0, public_tables=0.'
  Write-Host 'Do not run SQL restoration yet; next step depends on this output.'
} finally {
  foreach ($key in $envNames) {
    if ($original.ContainsKey($key)) { [Environment]::SetEnvironmentVariable($key,$original[$key],'Process') }
  }
  $pw=$null
  $raw=$null
}
