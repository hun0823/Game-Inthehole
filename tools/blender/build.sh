#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BLENDER="${BLENDER:-$ROOT/.tools/blender-4.2.3-linux-x64/blender}"
RAW="$ROOT/assets/models/raw/toy_planet.glb"
OUT="$ROOT/assets/models/toy_planet.glb"

"$BLENDER" -b --python "$ROOT/tools/blender/export_toy_planet.py" -- --out "$ROOT/assets/models/raw"
npx --yes @gltf-transform/cli meshopt "$RAW" "$OUT"
npx --yes @gltf-transform/cli inspect "$OUT"
