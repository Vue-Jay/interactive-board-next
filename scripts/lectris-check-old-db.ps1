# Read-only OLD Supabase PostgreSQL connectivity test.
# Reads a URI and password without echo; never modifies any database.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$oldRef='vblmywoczinzezcmqrgb'
$newRef='vznjpfqodjnxnmkrhiqk'
Write-Host ''
Write-Host 'LECTRIS: OLD DATABASE AUTHENTICATION TEST' -ForegroundColor Cyan
Write-Host 'Tests SELECT 1 only. No backup/restore or changes.'
Write-Host 'Copy OLD InteractiveBoard > Connect > Session pooler > URI.'
Write-Host 'Leave [YOUR-PASSWORD] unchanged; enter the database password separately.'
Write-Host 'Never share the URI or password.'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker command missing.' }
& docker info '--format' '{{.ServerVersion}}' *> $null
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop.' }

$secureUri=Read-Host 'OLD Session pooler URI (hidden)' -AsSecureString
$bstr=[IntPtr]::Zero
$raw=$null
try {
  $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUri)
  $raw=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
$secureUri=$null
$secret=$null
$previous=@{}
$envNames=@('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE')
try {
  if ([string]::IsNullOrWhiteSpace($raw)) { throw 'Empty URI.' }
  if ($raw.Contains('[YOUR-PASSWORD]')) {
    $pw=Read-Host 'OLD database password (hidden)' -AsSecureString
    $pbstr=[IntPtr]::Zero
    try {
      $pbstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw)
      $secret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pbstr)
      if ([string]::IsNullOrEmpty($secret)) { throw 'Empty database password.' }
      $raw=$raw.Replace('[YOUR-PASSWORD]',[Uri]::EscapeDataString($secret))
    } finally {
      if ($pbstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pbstr) }
      $pw=$null
    }
  }
  $uri=$null
  if (-not [Uri]::TryCreate($raw,[UriKind]::Absolute,[ref]$uri)) { throw 'Invalid database URI.' }
  if ($uri.Scheme -notin @('postgres','postgresql')) { throw 'Use a postgresql:// URI.' }
  $pieces=$uri.UserInfo -split ':',2
  if ($pieces.Count -ne 2) { throw 'Password is missing in URI.' }
  $username=[Uri]::UnescapeDataString($pieces[0])
  if ($null -eq $secret) { $secret=[Uri]::UnescapeDataString($pieces[1]) }
  if ([string]::IsNullOrEmpty($secret)) { throw 'Empty password.' }
  $pooler=$uri.Host -match '\.pooler\.supabase\.com$'
  $direct=$uri.Host -ieq ('db.'+$oldRef+'.supabase.co')
  if (-not $pooler -and -not $direct) { throw 'Unexpected host, copy the OLD project URI.' }
  if ($pooler -and $username -cne ('postgres.'+$oldRef)) { throw 'Pooler username must include OLD project reference.' }
  if ($direct -and $username -cne 'postgres') { throw 'Direct username must be postgres.' }
  if ($username.Contains($newRef)) { throw 'STOP: new Lectris project username.' }
  if ($uri.Port -ne 5432 -or $uri.AbsolutePath -ne '/postgres') { throw 'Expected port 5432 and database /postgres.' }
  foreach ($key in $envNames) { $previous[$key]=[Environment]::GetEnvironmentVariable($key,'Process') }
  $env:PGHOST=$uri.Host
  $env:PGPORT=[string]$uri.Port
  $env:PGUSER=$username
  $env:PGPASSWORD=$secret
  $env:PGDATABASE='postgres'
  Write-Host ('Testing '+$uri.Host+':5432 as '+$username+' ...')
  & docker run --rm --env PGHOST --env PGPORT --env PGUSER --env PGPASSWORD --env PGDATABASE --entrypoint psql public.ecr.aws/supabase/postgres:17.11.0.004 -w -X -A -t -c 'SELECT 1;'
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'FAILED: independent PostgreSQL login failed. This is not a dump problem.' -ForegroundColor Yellow
    Write-Host 'Verify the OLD database password; do not reset it without checking production integrations.'
    throw 'Read-only authentication test failed.'
  }
  Write-Host 'SUCCESS: database accepted credentials and returned 1.' -ForegroundColor Green
  Write-Host 'The backup script can be investigated separately if it still fails.'
} finally {
  foreach ($key in $envNames) {
    if ($previous.ContainsKey($key)) { [Environment]::SetEnvironmentVariable($key,$previous[$key],'Process') }
  }
  $raw=$null
  $secret=$null
}
