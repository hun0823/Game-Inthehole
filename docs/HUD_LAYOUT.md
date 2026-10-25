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
| `:root` `--dpad-top` | Top edge of `.controls`, which is the top of the up button, in px |
| `:root` `--dpad-overlap` | How far the up button overlaps the board, authored as `12px` |
| `window.RB_LAYOUT.boardRect()` | `{x, y, left, top, right, bottom, width, height, dpadOverlap}` of `.board-wrap` |

`boardRect()` matches `.board-wrap` during play. The wrap extends under the up button, so `bottom` is about 12px below `--dpad-top`. `dpadOverlap` is that measured inset (`bottom` minus the up button's top), rounded to whole pixels. The 3D board can use the extra strip; the up button paints above it.

`.controls` is `pointer-events: none`. The D-pad buttons and the retry button set `pointer-events: auto`, so a swipe on the overlapped strip still hits the board unless it lands on the up button.

`--safe-top`, `--safe-right`, `--safe-bottom`, and `--safe-left` mirror `env(safe-area-inset-*)`. `.app` is `100dvh` and its padding is those insets plus 4px, so the HUD and the D-pad caption sit inside the safe area. `viewport-fit=cover` is set on the page.

On the planet map the column is `visibility: hidden` but still laid out. Read the contract while `.app` does not have `.is-map`.

## Measured play column

The in-game top bar is one row: pause, the stage banner, and hint. The star balance is not on this bar (it stays on the shop header and the planet map). Toy 8, Korean and English (same boxes). No safe-area insets, so these match a layout viewport of exactly that size. Heights are CSS pixels, rounded.

| Viewport | `.topbar` | `.controls` | Up-button face | `boardRect().height` | `dpadOverlap` |
|----------|-----------|-------------|----------------|----------------------|---------------|
| 375×667 | 64 | 228 | 62×68 | 380 | 12 |
| 390×844 | 65 | 228 | 62×68 | 556 | 12 |
| 430×932 | 77 | 244 | 66×72 | 616 | 12 |

`--hud-bottom` is the measured bottom edge of that bar, not its height. With the 4px app padding and no safe-area inset it is 68 / 69 / 81 at these three viewports. A shorter bar publishes a smaller `--hud-bottom`, and the board grows by the freed strip. `--dpad-top`, `--dpad-overlap` (12px), and the D-pad box are unchanged.

Widths under 400px, or heights under 720px, use the compact tier (68px slots, 3px cross gaps, 62px faces). Wider, taller phones use 72px slots, 4px gaps, and 66px faces. The cross stays a 3×3 grid; only the gap between buttons got tighter. The retry circle's bottom lines up with the down button, and its caption hangs in the reserved space under that row.

Same stages with iPhone insets (status bar, and a home-indicator inset where the phone has one). The caption stays above the inset.

| Viewport | Insets (top / bottom) | HUD top | Gap under `.controls` | `boardRect().height` |
|----------|----------------------|---------|------------------------|----------------------|
| 375×667 | 20 / 0 | 24 | 4 | 360 |
| 390×844 | 47 / 34 | 51 | 38 | 475 |
| 430×932 | 59 / 34 | 63 | 38 | 523 |

With the in-game star chip still on the bar, the free board was 332 / 508 / 559 at these three viewports (top bar 111 / 112 / 133, controls 228 / 228 / 244). On `main` before the arcade HUD the free board was 309 / 484 / 497 (HUD 127 / 128 / 151, controls 216 / 216 / 268).
