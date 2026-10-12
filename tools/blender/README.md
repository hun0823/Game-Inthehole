# Blender → GLB (Toy planet experiment)

Headless pipeline for the `?glb=1` toy-planet kit.

```bash
./tools/blender/build.sh
```

- **Input:** `export_toy_planet.py` (procedural meshes, Bevel, vertex-color AO proxy, `ink` hulls)
- **Output:** `assets/models/raw/toy_planet.glb` → `assets/models/toy_planet.glb` (Meshopt via gltf-transform)
- **Blender:** `$ROOT/.tools/blender-4.2.3-linux-x64/blender` or set `BLENDER=`

`palette`/`join` from full `optimize` merge prototypes and break instancing; this experiment uses **meshopt only** so named `proto_*` roots stay cloneable in the game.
