# Credits

## Music

**Flowerbed Fields [Loop]**  
Author: Zane Little Music  
Source: https://opengameart.org/content/flowerbed-fields-loop  
License: CC0

Menu and stage background music. Files: `assets/audio/bgm/flowerbed_fields.m4a` (preferred) and `assets/audio/bgm/flowerbed_fields.mp3` (fallback).

## Code

Wood looks (`?look=diorama|pixel|clay|neon`) are original geometry, canvas textures, and GLSL, except the two shaders below. No Kenney, Poly Haven, or other texture packs are bundled. The looks are not loaded unless the query param is set.

**FilmShader.js** (`js/vendor/look/FilmShader.js`)  
Grain pass used by the pixel look.  
Source: https://github.com/mrdoob/three.js/blob/r170/examples/jsm/shaders/FilmShader.js  
License: MIT (three.js r170). Copyright 2010-2024 three.js authors. See `js/vendor/look/LICENSE`.  
The scanline term in the pixel look is original and is not the CC-BY FilmShader from older three.js releases.

**VignetteShader.js** (`js/vendor/look/VignetteShader.js`)  
Vignette used by the clay and neon looks.  
Source: https://github.com/mrdoob/three.js/blob/r170/examples/jsm/shaders/VignetteShader.js  
License: MIT (three.js r170). Copyright 2010-2024 three.js authors. See `js/vendor/look/LICENSE`.

**Glow and pixelate passes** (`js/looks/pass.js`, `js/looks/pixel.js`)  
Original. No third-party postprocessing package is bundled.

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
