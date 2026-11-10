# Credits

## Music

**Flowerbed Fields [Loop]**  
Author: Zane Little Music  
Source: https://opengameart.org/content/flowerbed-fields-loop  
License: CC0

Menu and stage background music. Files: `assets/audio/bgm/flowerbed_fields.m4a` (preferred) and `assets/audio/bgm/flowerbed_fields.mp3` (fallback).

## Code

Wood looks (`?look=diorama|pixel|clay|neon`) are original meshes authored in Blender and drawn with vertex colors. They are not loaded unless the query param is set. No Kenney, Poly Haven, or other model or texture packs are bundled. Lighting and ambient occlusion are baked into those vertex colors; the looks do not ship a runtime post pass.

**Look meshes** (`assets/looks/*.glb`, authored by `tools/blender/build_looks.py`)  
Original geometry. Built with Blender 4.5.16 LTS.  
Blender itself is GPL and is not distributed. The exported meshes are original project content.  
Canonical Blender build: https://download.blender.org/release/Blender4.5/blender-4.5.16-linux-x64.tar.xz  
(The build used here was fetched from the NLUUG mirror of that same tarball, because download.blender.org returned a Cloudflare challenge to the agent.)

**GLTFLoader.js** (`js/vendor/look/GLTFLoader.js`)  
Loads the look kits. Loaded only with a look.  
Source: https://github.com/mrdoob/three.js/blob/r170/examples/jsm/loaders/GLTFLoader.js  
License: MIT (three.js r170). Copyright 2010-2024 three.js authors. See `js/vendor/look/LICENSE`.  
Local edits are the import path and a triangle-draw stub. The kits are triangle lists, so the stub is not exercised.

**meshopt_decoder.module.js** (`js/vendor/look/meshopt_decoder.module.js`)  
Decodes `EXT_meshopt_compression` on the look GLBs. Loaded only with a look.  
Source: https://github.com/zeux/meshoptimizer (the copy shipped with three.js r170 `examples/jsm/libs/meshopt_decoder.module.js`)  
License: MIT. Copyright (C) 2016-2022 Arseny Kapoulkine.  
The GLBs were compressed with gltfpack 1.3 from the same project: https://github.com/zeux/meshoptimizer/releases/tag/v1.3

Vertex colors carry the baked lighting, so the kits do not use KTX2 or WebP textures. A texture transcoder would have been larger than the meshes.

## Agent skills

Vendored for future agents. Not deployed to GitHub Pages (`.cursor/` is outside the Pages copy).

| Skill | Source | License |
| --- | --- | --- |
| `threejs-materials-lighting` | https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/main/skills/web-engines/threejs-materials-lighting | Apache-2.0 |
| `threejs-scene-setup` | https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/main/skills/web-engines/threejs-scene-setup | Apache-2.0 |
| `create-game-assets` | https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/main/skills/disciplines/create-game-assets | Apache-2.0 |
| `threejs-ops` | https://github.com/0xdarkmatter/claude-mods/tree/main/skills/threejs-ops | MIT |
| `genart-ops` | https://github.com/0xdarkmatter/claude-mods/tree/main/skills/genart-ops | MIT |
| `pixel-art-workflow` | https://github.com/0xdarkmatter/claude-mods/blob/main/skills/isometric-ops/references/pixel-art-workflow.md | MIT |

`pixel-art-workflow` is only that reference. The rest of isometric-ops is not vendored, and the board camera stays top-down.
