# HUD layout contract

The DOM HUD and the D-pad own the top and bottom of the play column. The 3D board fits in the free rectangle between them. Do not remove or `display: none` these nodes while a stage is on screen; `visibility: hidden` on the planet map is fine because the boxes stay measurable.

## Elements the board already measures

`js/board3d.js` `resize()` reads the canvas:

- `#playfield` `clientWidth` / `clientHeight`
- fallback: the parent `.board-wrap` `clientWidth` / `clientHeight`

`pick()` uses `#playfield.getBoundingClientRect()`.

`.board-wrap` is the flex child between `header.topbar` and `nav.controls`, with `margin: 0`. `#playfield` fills it. That box is the fit target.

## Free rectangle

Viewport CSS pixels, the same space as `getBoundingClientRect`. Updated on resize, orientation change, and font load.

| Read | Meaning |
|------|---------|
| `:root` `--hud-bottom` | Bottom edge of `.topbar`, in px |
| `:root` `--dpad-top` | Top edge of `.controls`, in px |
| `window.RB_LAYOUT.boardRect()` | `{x, y, left, top, right, bottom, width, height}` between those edges, using `.board-wrap`'s left and right |

`--safe-top`, `--safe-right`, `--safe-bottom`, and `--safe-left` mirror `env(safe-area-inset-*)`. `.app` padding includes them, so the HUD and D-pad sit inside the safe area.

During play, `boardRect()` matches `.board-wrap`'s rectangle. On the planet map the column is `visibility: hidden` but still laid out; read the contract while `.app` does not have `.is-map`.
