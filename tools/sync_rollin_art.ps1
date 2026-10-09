# Rollin' Board — 바탕화면 AI PNG → Unity Resources/Art
# 우선순위: game_asset2 (Unity 파일명) → game_asset/png (removebg 이름)
$src2 = "C:\Users\ckdgn\Desktop\Rollin' Board\game_asset2"
$src = "C:\Users\ckdgn\Desktop\Rollin' Board\game_asset\png"
$dst = Join-Path $PSScriptRoot "..\unity\InTheHole\Assets\Resources\Art"
if (-not (Test-Path -LiteralPath $dst)) {
    $dst = (Resolve-Path (Join-Path $PSScriptRoot "..\unity\InTheHole\Assets\Resources\Art")).Path
}

$map = [ordered]@{
    "wood_a.png" = @("wood_a.png", "wood_a-removebg-preview.png")
    "wood_b.png" = @("wood_b.png", "wood_b-removebg-preview.png")
    "wall_coral.png" = @("wall_coral.png", "wall_coral-removebg-preview.png")
    "wall_blue.png" = @("wall_blue.png", "wall_blue-removebg-preview.png")
    "wall_purple.png" = @("wall_purple.png", "wall_purple-removebg-preview.png")
    "wall_green.png" = @("wall_green.png", "wall_green-removebg-preview.png")
    "star.png" = @("star.png", "star-removebg-preview.png")
    "frame_mint.png" = @("frame_mint.png")
    "ball.png" = @("ball.png")
    "ball_shadow.png" = @("ball_shadow.png")
    "hole_ring.png" = @("hole_ring.png")
    "hole_core.png" = @("hole_core.png")
    "bg_gradient.png" = @("bg_gradient.png")
    "wall_h.png" = @("wall_h.png")
    "wall_v.png" = @("wall_v.png")
}

$folders = @($src2, $src)
$ok = 0
foreach ($entry in $map.GetEnumerator()) {
    $copied = $false
    foreach ($folder in $folders) {
        if (-not (Test-Path -LiteralPath $folder)) { continue }
        foreach ($candidate in $entry.Value) {
            $from = Join-Path $folder $candidate
            if (Test-Path -LiteralPath $from) {
                Copy-Item -LiteralPath $from -Destination (Join-Path $dst $entry.Key) -Force
                Write-Host "OK $($entry.Key) <- $candidate"
                $ok++
                $copied = $true
                break
            }
        }
        if ($copied) { break }
    }
    if (-not $copied) {
        Write-Warning "Missing $($entry.Key)"
    }
}

$ballPath = Join-Path $dst "ball.png"
if (-not (Test-Path -LiteralPath $ballPath) -or ((Get-Item -LiteralPath $ballPath).Length -lt 80000)) {
    $proj = Join-Path $PSScriptRoot ".."
    Push-Location $proj
    python -c "from pathlib import Path; import importlib.util; spec=importlib.util.spec_from_file_location('ga','tools/generate_reference_art.py'); ga=importlib.util.module_from_spec(spec); spec.loader.exec_module(ga); w,h,p=ga.make_ball(256); ga.write_png(Path('unity/InTheHole/Assets/Resources/Art/ball.png'),w,h,p); print('OK ball.png generated')"
    Pop-Location
}

Write-Host "`nSynced $ok file(s) -> $dst"
Write-Host "Unity: InTheHole -> Ensure Game Art Imported"
