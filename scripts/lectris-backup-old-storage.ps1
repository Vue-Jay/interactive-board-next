# Safely back up FILE CONTENTS from OLD Supabase Storage to ignored local folder.
# Credentials are entered in hidden local prompt. Never paste them into chat.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$oldRef='vblmywoczinzezcmqrgb'
$newRef='vznjpfqodjnxnmkrhiqk'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is not installed.' }
$repoRoot=Split-Path -Parent $PSScriptRoot
$backupRoot=Join-Path $repoRoot 'migration-backups'
$folder=Join-Path $backupRoot ('old-'+$oldRef+'-storage-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')+'-'+$PID)
Write-Host ''
Write-Host 'LECTRIS / OLD SUPABASE STORAGE FILE BACKUP' -ForegroundColor Cyan
Write-Host ('SOURCE only: '+$oldRef) -ForegroundColor Yellow
Write-Host ('NEW Lectris WILL NOT BE ACCESSED: '+$newRef)
Write-Host 'This downloads files to local disk. It does not upload, restore, delete, or modify any Supabase files.'
Write-Host 'Get OLD project API key from InteractiveBoard Dashboard > Settings > API Keys.'
Write-Host 'Use old Secret API key (sb_secret_...) or legacy service_role key.'
Write-Host 'Never use publishable/anon key and NEVER share a secret key.'
Write-Host ''
$secure=Read-Host 'Paste OLD Supabase Secret API key (hidden)' -AsSecureString
$bstr=[IntPtr]::Zero
$secret=$null
$prior=[Environment]::GetEnvironmentVariable('LECTRIS_OLD_SUPABASE_SECRET_KEY','Process')
try {
  $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $secret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  if ([string]::IsNullOrWhiteSpace($secret)) { throw 'Secret key was empty.' }
  if (-not ($secret.StartsWith('sb_secret_') -or $secret.StartsWith('eyJ'))) {
    throw 'Expected old Secret API key or legacy service_role key. Do not use anon/publishable key.'
  }
  New-Item -ItemType Directory -Path $folder -Force | Out-Null
  $env:LECTRIS_OLD_SUPABASE_SECRET_KEY=$secret
  Write-Host 'Downloading old Storage files...'
  & node (Join-Path $PSScriptRoot 'lectris-backup-old-storage.mjs') $folder
  $exitCode=$LASTEXITCODE
  if ($exitCode -ne 0) {
    throw ('Storage backup FAILED or requires review. Exit code: '+$exitCode+'. Partial local files are at '+$folder+'. Do NOT restore.')
  }
  Write-Host ('Storage files backed up locally: '+$folder) -ForegroundColor Green
  Write-Host 'Keep this folder PRIVATE (contains file contents and object paths).'
} finally {
  [Environment]::SetEnvironmentVariable('LECTRIS_OLD_SUPABASE_SECRET_KEY',$prior,'Process')
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  $secure=$null
  $secret=$null
}
