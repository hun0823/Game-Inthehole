# Nunito Bold (Google Fonts) -> Unity Resources/Fonts/UiSans.ttf
$dstDir = Join-Path $PSScriptRoot "..\unity\InTheHole\Assets\Resources\Fonts"
$dst = Join-Path $dstDir "UiSans.ttf"
New-Item -ItemType Directory -Force -Path $dstDir | Out-Null

# Resolve Bold (700) TTF via Google Fonts CSS API
$cssUrl = "https://fonts.googleapis.com/css2?family=Nunito:wght@700&display=swap"
$css = Invoke-WebRequest -Uri $cssUrl -UseBasicParsing -Headers @{ "User-Agent" = "Mozilla/5.0" }
$m = [regex]::Match($css.Content, "src:\s*url\(([^)]+\.ttf)\)")
if (-not $m.Success) {
    Write-Error "Could not find TTF URL in Google Fonts CSS."
    exit 1
}

$ttfUrl = $m.Groups[1].Value
Write-Host "Downloading $ttfUrl"
Invoke-WebRequest -Uri $ttfUrl -OutFile $dst -UseBasicParsing

$bytes = [System.IO.File]::ReadAllBytes($dst)
if ($bytes.Length -lt 10000) {
    Write-Error "Downloaded file too small — likely not a valid TTF."
    exit 1
}

$kb = [math]::Round($bytes.Length / 1KB, 1)
Write-Host "OK: $dst ($kb KB)"
Write-Host "Unity will import on next editor focus. Play to use via UiFont.cs."
