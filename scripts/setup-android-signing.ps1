# Run on your own Windows PC. The private keystore is NEVER committed or uploaded
# anywhere except as an encrypted GitHub Actions secret.
$ErrorActionPreference = 'Stop'
$repo = 'Vue-Jay/interactive-board-next'
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw 'Install GitHub CLI: winget install GitHub.cli; then run gh auth login'
}
if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
  throw 'Install JDK 21 (for example winget install EclipseAdoptium.Temurin.21.JDK)'
}
gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Run gh auth login first' }
$dir = Join-Path $env:USERPROFILE 'Documents\LektrusSigning'
New-Item -ItemType Directory -Force $dir | Out-Null
$path = Join-Path $dir 'lektrus-release.jks'
if (-not (Test-Path -LiteralPath $path)) {
  Write-Host 'Creating your permanent signing key. Record passwords safely!'
  & keytool -genkeypair -v -keystore $path -storetype PKCS12 -alias lektrus -keyalg RSA -keysize 3072 -validity 10000
  if ($LASTEXITCODE -ne 0) { throw 'Key generation failed' }
} else {
  Write-Host "Reusing existing keystore $path (required to preserve future update compatibility)."
}
$storeSecure = Read-Host 'Keystore password' -AsSecureString
$keySecure = Read-Host 'Key password (usually the same for PKCS12)' -AsSecureString
$store = [System.Net.NetworkCredential]::new('', $storeSecure).Password
$key = [System.Net.NetworkCredential]::new('', $keySecure).Password
try {
  # Verify alias AND password before saving secrets.
  & keytool -list -keystore $path -alias lektrus -storepass $store | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Incorrect keystore password or alias' }
  $encoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes($path))
  $encoded | gh secret set LEKTRUS_SIGNING_STORE_BASE64 --repo $repo
  if ($LASTEXITCODE -ne 0) { throw 'Could not save keystore secret' }
  $store | gh secret set LEKTRUS_SIGNING_STORE_PASSWORD --repo $repo
  if ($LASTEXITCODE -ne 0) { throw 'Could not save store password secret' }
  'lektrus' | gh secret set LEKTRUS_SIGNING_KEY_ALIAS --repo $repo
  if ($LASTEXITCODE -ne 0) { throw 'Could not save key alias secret' }
  $key | gh secret set LEKTRUS_SIGNING_KEY_PASSWORD --repo $repo
  if ($LASTEXITCODE -ne 0) { throw 'Could not save key password secret' }
  Write-Host 'Permanent signing configured. Back up this file offline:' $path
} finally {
  Remove-Variable store,key,encoded -ErrorAction SilentlyContinue
}
