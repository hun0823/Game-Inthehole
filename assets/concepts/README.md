# Wood visual concepts

Four optional skins for the Wood planet (stages 1–12). Rules, levels, and the other planets stay as they are. With no `look` param the board is the current game.

| Look | Open |
| --- | --- |
| Diorama | `?look=diorama` |
| Pixel | `?look=pixel` |
| Clay | `?look=clay` |
| Neon | `?look=neon` |

Stage links still use the hash. Wood 1 is `#1`. Wood 8 is `#8`.

```
https://hun0823.github.io/Game-Inthehole/?look=diorama#1
```

GitHub Pages publishes `main` only. Before that merge, serve this branch from the repo root:

```
python3 -m http.server 8080
```

Then open `http://127.0.0.1:8080/?look=diorama#1` (and `pixel`, `clay`, `neon`).

`look`, `fps`, and `perf` stay in the address bar when you change stage or open the map. The skin applies only while the planet is Wood.

## What each look changes

The camera, HUD boxes, and board size are unchanged. The skin replaces materials, the sky canvas, the frame props, and the HUD colors.

**Diorama.** Warm dawn sky, grass pads with dirt grout, bark-colored walls that keep the red/blue/green/purple identity, an acorn-colored ball, and an amber goal ring. A modelled squirrel, two low-poly trees, a stump, and an acorn sit on the frame, not on the hole. No fullscreen pass.

**Pixel.** Limited green palette, nearest-filter tiles, billboard squirrel and trees, and a flat nut-colored ball. A 2-device-pixel grid plus scanlines (original) and three.js r170 film grain. The DOM HUD stays sharp.

**Clay.** Soft terracotta and pastel tiles with edge darkening baked into the albedo, a fingerprint normal that is not a radial target, a peach ball, and a terracotta goal. A short glow plus the three.js vignette. No SSAO.

**Neon.** Night sky, emissive grid and gem walls, a cyan ball, a magenta goal, fireflies, and a stronger glow plus vignette.

Glass, gates, and magma hooks are still the existing meshes. Wood stages do not use them. Other planets ignore `look`.

## Art

Tiles, skies, the squirrel, trees, and sprites are drawn in code at runtime. There are no extra image files to download. Licenses for the two vendored three.js shaders are in `CREDITS.md`.

## Size

Figures are gzip of the modules the browser fetches. `js/woodLook.js` (about 0.5 KB) and the HUD rules in `css/style.css` (about 1.1 KB) load with every visit. A look’s modules load only when that `look` is set.

| Look | Gzip when selected | Also loads |
| --- | --- | --- |
| Diorama | 7.5 KB | `diorama.js`, `props.js`, `sky.js` |
| Pixel | 9.6 KB | those, plus `pass.js` and `FilmShader.js` |
| Clay | 8.9 KB | those, plus `pass.js` and `VignetteShader.js` |
| Neon | 8.9 KB | those, plus `pass.js` and `VignetteShader.js` |

## Performance notes

One shadow map stays at 1024. The pixel-ratio cap is unchanged. Diorama does not add a post pass. Clay and neon add one scene target and two fullscreen blits, and they do not run on top of the existing bloom. Decorative props do not cast shadows. Clay’s contact darkening is painted into the tile, not a screen-space AO pass.

## Stills

430×932, captured in headless Chromium with an iPhone-sized viewport. These files are documentation. The game does not request them.

![Diorama, Wood 1](diorama-wood1.webp)
![Diorama, Wood 8](diorama-wood8.webp)
![Diorama, mid roll](diorama-roll.webp)

![Pixel, Wood 1](pixel-wood1.webp)
![Pixel, Wood 8](pixel-wood8.webp)
![Pixel, mid roll](pixel-roll.webp)

![Clay, Wood 1](clay-wood1.webp)
![Clay, Wood 8](clay-wood8.webp)
![Clay, mid roll](clay-roll.webp)

![Neon, Wood 1](neon-wood1.webp)
![Neon, Wood 8](neon-wood8.webp)
![Neon, mid roll](neon-roll.webp)
