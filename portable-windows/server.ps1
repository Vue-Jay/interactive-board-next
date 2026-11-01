# Portable Lektrus static server. Uses Windows PowerShell / .NET only.
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'site'))
if (-not (Test-Path -LiteralPath (Join-Path $root 'index.html') -PathType Leaf)) {
  throw 'Missing site/index.html. Download and extract the complete portable build.'
}
$prefix = 'http://localhost:4173/'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'
  '.svg' = 'image/svg+xml'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.gif' = 'image/gif'
  '.ico' = 'image/x-icon'
  '.woff' = 'font/woff'
  '.woff2' = 'font/woff2'
  '.ttf' = 'font/ttf'
  '.wasm' = 'application/wasm'
  '.pdf' = 'application/pdf'
  '.txt' = 'text/plain; charset=utf-8'
  '.mp3' = 'audio/mpeg'
  '.mp4' = 'video/mp4'
}
try {
  $listener.Start()
  Write-Host ''
  Write-Host 'Lektrus is running at http://localhost:4173/' -ForegroundColor Green
  Write-Host 'Keep this window open. Close it to stop Lektrus.'
  Start-Process $prefix
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response
    try {
      if ($context.Request.HttpMethod -ne 'GET' -and $context.Request.HttpMethod -ne 'HEAD') {
        $response.StatusCode = 405
        continue
      }
      $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
      if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
      $path = [IO.Path]::GetFullPath((Join-Path $root $relative))
      if (-not $path.StartsWith(($root.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) {
        $response.StatusCode = 403
        continue
      }
      if (-not [IO.File]::Exists($path)) {
        # Client-side routes get index.html; missing assets remain 404.
        if ([string]::IsNullOrEmpty([IO.Path]::GetExtension($relative))) {
          $path = Join-Path $root 'index.html'
        } else {
          $response.StatusCode = 404
          continue
        }
      }
      $extension = [IO.Path]::GetExtension($path).ToLowerInvariant()
      $response.ContentType = if ($mime.ContainsKey($extension)) { $mime[$extension] } else { 'application/octet-stream' }
      $response.Headers.Add('Cache-Control', 'no-cache')
      $stream = [IO.File]::OpenRead($path)
      try {
        $response.ContentLength64 = $stream.Length
        if ($context.Request.HttpMethod -eq 'GET') { $stream.CopyTo($response.OutputStream) }
      } finally { $stream.Dispose() }
    } catch {
      Write-Warning $_.Exception.Message
      if (-not $response.OutputStream.CanWrite) { continue }
      $response.StatusCode = 500
    } finally {
      $response.Close()
    }
  }
} catch {
  Write-Host ('Server error: ' + $_.Exception.Message) -ForegroundColor Red
  exit 1
} finally {
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}
