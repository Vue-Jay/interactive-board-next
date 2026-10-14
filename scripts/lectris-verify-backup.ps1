# Read-only local verification of Lectris PostgreSQL logical backup.
# Prints file sizes and safe table row counts only. Does not expose database content.
param([string]$BackupDir = '')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$expectedOld = 'vblmywoczinzezcmqrgb'
$expectedNew = 'vznjpfqodjnxnmkrhiqk'

$root = Split-Path -Parent $PSScriptRoot
$backupRoot = Join-Path $root 'migration-backups'
if (-not $BackupDir) {
  if (-not (Test-Path -LiteralPath $backupRoot -PathType Container)) {
    throw 'No local migration-backups folder found. Back up the OLD project first.'
  }
  $folders = @(Get-ChildItem -LiteralPath $backupRoot -Directory | Where-Object {
    $_.Name -like ("old-" + $expectedOld + "-*")
  } | Sort-Object LastWriteTimeUtc -Descending)
  $matched = $null
  foreach ($folder in $folders) {
    $allFound = $true
    foreach ($file in @('roles.sql','schema.sql','data.sql')) {
      if (-not (Test-Path -LiteralPath (Join-Path $folder.FullName $file) -PathType Leaf)) {
        $allFound = $false
        break
      }
    }
    if ($allFound) { $matched = $folder; break }
  }
  if ($null -eq $matched) {
    throw 'No backup folder containing roles.sql, schema.sql and data.sql. Do not restore.'
  }
  $BackupDir = $matched.FullName
}
$folderName = Split-Path -Leaf $BackupDir
if ($folderName -notlike ("old-" + $expectedOld + "-*")) {
  throw 'Backup folder must be for the OLD InteractiveBoard project. Not the new Lectris.'
}
Write-Host ''
Write-Host 'LECTRIS OLD DATABASE BACKUP CHECK (read-only)' -ForegroundColor Cyan
Write-Host ('Source ref: ' + $expectedOld)
Write-Host ('Target project untouched: ' + $expectedNew)
Write-Host ('Backup folder: ' + $BackupDir)
Write-Host ''
foreach ($name in @('roles.sql','schema.sql','data.sql')) {
  $path = Join-Path $BackupDir $name
  $file = Get-Item -LiteralPath $path -ErrorAction Stop
  if ($file.Length -le 0) { throw ('Empty file: ' + $name + '. Stop and investigate.') }
  Write-Host ('FOUND ' + $name + ' - ' + [math]::Round($file.Length / 1KB,1) + ' KiB')
}

$dataFile = Join-Path $BackupDir 'data.sql'
$interesting = @('auth.users','auth.identities','storage.buckets','storage.objects')
$counts = @{}
$found = @{}
foreach ($table in $interesting) { $counts[$table] = [long]0; $found[$table] = $false }
$reader = [System.IO.StreamReader]::new($dataFile)
$current = $null
try {
  while ($null -ne ($line = $reader.ReadLine())) {
    if ($null -ne $current) {
      if ($line -eq '\.') {
        $current = $null
      } else {
        $counts[$current] = $counts[$current] + 1
      }
      continue
    }
    $m = [regex]::Match($line,'^\s*COPY\s+"?([a-z_][\w]*)"?\."?([a-z_][\w]*)"?\s*\(',[System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($m.Success) {
      $key = $m.Groups[1].Value.ToLowerInvariant() + '.' + $m.Groups[2].Value.ToLowerInvariant()
      if ($found.ContainsKey($key)) {
        $found[$key] = $true
        $current = $key
      }
      continue
    }
    $ins = [regex]::Match($line,'^\s*INSERT\s+INTO\s+"?([a-z_][\w]*)"?\."?([a-z_][\w]*)"?\s*', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($ins.Success) {
      $key = $ins.Groups[1].Value.ToLowerInvariant() + '.' + $ins.Groups[2].Value.ToLowerInvariant()
      if ($found.ContainsKey($key)) {
        $found[$key] = $true
        $counts[$key] = $counts[$key] + 1
      }
    }
  }
} finally {
  $reader.Dispose()
}

Write-Host ''
Write-Host 'DATA.SQL / SAFE TABLE CHECK'
foreach ($table in $interesting) {
  if ($found[$table]) {
    Write-Host ('  PRESENT ' + $table + ' ; exported rows = ' + $counts[$table]) -ForegroundColor Green
  } else {
    Write-Host ('  MISSING ' + $table + ' ; no COPY/INSERT found') -ForegroundColor Yellow
  }
}
Write-Host ''
if (-not $found['auth.users'] -or -not $found['auth.identities']) {
  Write-Host 'STOP: user/identity records are not proven to be in data.sql.' -ForegroundColor Red
  Write-Host 'We must export Auth separately before attempting any restore.'
} else {
  Write-Host 'Auth data sections are present. Compare row counts to the OLD Supabase audit.' -ForegroundColor Green
}
if (-not $found['storage.buckets'] -or -not $found['storage.objects']) {
  Write-Host 'Storage metadata sections are missing or empty; compare with source audit.' -ForegroundColor Yellow
}
Write-Host 'IMPORTANT: This SQL check does NOT transfer actual files stored in Storage.'
Write-Host 'SQL files are sensitive and NOT encrypted by this script. Keep them private.'
Write-Host 'Never upload backup files to GitHub or share their contents.'
Write-Host 'Do not run restoration yet.'
