# Glass interface

Rules live in `js/game.js`. The renderer (`js/board3d.js`) already draws an intact pane at hp 2 and its existing crack overlay at hp 1. This document is the contract for reading hp and for playing the crack and shatter.

## Edge

A glass edge is the same identifier the board meshes already use.

```js
{ axis: "h" | "v", r: number, c: number }
```

`board3d.js` `addEdge` stores `axis`, `r`, and `c` on the glass mesh `userData`. `glassMesh(edge)` resolves a pane with:

```js
userData.axis === (edge.axis || edge.kind) && userData.r === edge.r && userData.c === edge.c
```

| `axis` | Meaning |
|--------|---------|
| `"h"` | Between row `r` and `r+1`, column `c` (`0 ≤ r < size-1`, `0 ≤ c < size`) |
| `"v"` | Between column `c` and `c+1`, row `r` (`0 ≤ r < size`, `0 ≤ c < size-1`) |

Level fields `glassH` / `glassV` use `{row, col}` for the same `(r, c)`.

## hp

Each pane starts at **hp 2**.

| hp | Meaning | Blocks? | Current look (boolean grids) |
|----|---------|---------|------------------------------|
| 2 | intact | yes | `hGlass`/`vGlass` true, stress false |
| 1 | cracked | yes | pane true, `hGlassStressed`/`vGlassStressed` true |
| 0 | gone | no, the ball rolls through | pane false |

`game.glass` is the live list, updated as soon as a tilt is simulated:

```js
game.glass[i] = { axis, r, c, hp }
```

`view.sync(game)` already receives this object. Read `game.glass` for the resting hp. Do not infer the hit animation from hp alone: after `simulateTilt`, hp is already the post-hit value.

## State snapshot

`game.snapshot()` returns a copy:

```js
{
  ball: [row, col],
  moves, won, phase, tilts, collapse,
  glass: [ { axis, r, c, hp }, ... ]
}
```

`glass` is every pane on the level, in solver order (horizontal edges, then vertical, row-major). `hp` is 2, 1, or 0. `reset()` restores every pane to hp 2. The hint search packs the same hp into its state (base-3 digit = `2 - hp`).

## Move events

`game.simulateTilt(dir)` returns `{ path, moved, won, events }`.

A **hit** is the ball sliding into that glass edge: the next step of the slide crosses it, and a border, wall, closed gate, one-way, shifting wall, or crumbled floor did not already stop the ball. Lava is not a wall; touching it loses the stage (`docs/MAGMA.md`) and that slide does not continue into a pane beyond the lava cell. The ball stops against a pane that still blocks. That contact is one hit.

| Transition | Event |
|------------|--------|
| hp 2 → 1 | `{ type: "glassCrack", edge }` |
| hp 1 → 0 | `{ type: "glassShatter", edge }` |

`edge` is `{ axis, r, c }` as above. Events are in slide order. A jelly jump skips the edges between the cushion and the landing cell and does not emit an event for them. On ice, the first hit still emits `glassCrack` and still drops hp to 1, but the ball does not stop. The second hit emits `glassShatter` and the ball continues through. hp 0 is not hit again.

`events` is also passed through to the current roll call as `fx.events`, next to the legacy `cracked` / `broken` lists the existing shatter animation still reads:

```js
view.roll(path, dir, won, { cracked, broken, events })
```

`cracked` entries are the `glassCrack` edges. `broken` entries are the `glassShatter` edges with both `axis` and `kind` set to `"h"` or `"v"` so `glassMesh` can find the pane. Prefer `events` and `type` for new visuals.

`shatterPane` marks the group `shattered` and clears `ruleVisible`. `applyEdgeVisibility` keeps a shattered pane hidden, including when fog refresh runs mid-roll. hp 2 is the current intact pane. hp 1 is the current crack overlay (`hGlassStressed` / `vGlassStressed`).

Audio goes through the existing Web Audio bus (`js/sfxCues.js`). `glassCrack` plays on `{ type: "glassCrack" }`. The existing cue `glass` plays on `{ type: "glassShatter" }`.
