# Magma interface

Rules live in `js/game.js`. The look lives in `js/magmaLook.js` and is mounted by `js/board3d.js`. Do not infer the animation from `state` alone: `snapshot().magma` is the post-tilt value once `applyTiltResult` has run. `magmaLook.sync` skips a cell that is already spreading or collapsing, so the roll can play `onMagmaEvent` without a resting sync snapping the cell to lava first.

## Cell

A magma cell is the same square the level already stores.

```js
{ r: number, c: number, at: number, state: "floor" | "warn" | "lava" }
```

Level field `magma` is `[row, col, at]`. `at` is the spent-tilt count at which the cell becomes lava.

| `state` | When (`tilts` is the count at the start of the tilt, before this tilt is spent) | Blocks? |
|---------|----------------------------------------------------------------------------------|---------|
| `floor` | `tilts < at - 1` | no, ordinary floor |
| `warn` | `tilts === at - 1` (cracks, one tilt before lava) | no |
| `lava` | `tilts >= at` | no. Touching it loses the stage |

`at >= 2` starts as floor. `at === 1` starts as warn. `at === 0` is already lava. Generated stages use `at >= 2`.

The counter increments after a tilt that moves the ball or a button press. A bump that does not move the ball does not count. The counter stops rising once it reaches the latest `at` on the board. A board with no magma never increments it.

## State snapshot

`game.snapshot()` returns:

```js
{
  ball: [row, col],
  moves, won, lost, phase, tilts, collapse,
  glass: [ { axis, r, c, hp }, ... ],
  magma: [ { r, c, at, state }, ... ]
}
```

`magma` is every vent on the level. `state` is `"floor"`, `"warn"`, or `"lava"` for the current `tilts`. `lost` is true after the ball has touched lava. `reset()` restores `tilts` to 0, `lost` to false, and every cell to the state for tilt 0.

`view.setStage` calls `magmaLook.mount(level.magma, theme, game)`, which builds a cell per vent and rests it from `snapshot().magma`. `view.sync` calls `magmaLook.sync(game)` on every sync, including retry (`renderBoard` → `setStage` → `sync`). A cell whose `mode` is `spreading` or `collapsing` is left alone so the animation can finish.

## Move events

`game.simulateTilt(dir)` returns `{ path, moved, won, lost, events }`.

The slide uses the tilt count from **before** the counter bumps. Crack and collapse are appended because the tilt was spent, after the slide. A press does the same through `game.shiftEvents`.

| Transition | Event |
|------------|--------|
| floor → warn | `{ type: "magmaCrack", cell: { r, c } }` |
| warn → lava | `{ type: "magmaCollapse", cell: { r, c } }` |
| ball touches lava | `{ type: "lavaDeath", cell: { r, c } }` |

`lavaDeath` is also pushed when the ball is sitting on a cell that collapses on this bump (after the slide, or on a press). The path stops on `cell`. Entering lava, crossing it, landing on it from a jelly jump, or exiting a teleport onto a lava pad all stop there and set `lost`. Lava is not a wall and does not end the slide early the way a wall does: the ball occupies the cell, then the stage is over.

`events` is passed through the roll the same way glass is:

```js
view.roll(path, dir, intoHole, { cracked, broken, events })
```

`view.roll` calls `view.onMagmaEvent(ev)` for `magmaCrack`, `magmaCollapse`, and `lavaDeath`. `r` and `c` may sit on `ev.cell` or on the event itself. `magmaLook.event` accepts both.

| Event | When during the roll |
|-------|----------------------|
| `magmaCrack`, `magmaCollapse` | when the roll ends (the counter bumps after the slide) |
| `lavaDeath` | at the distance along the path where the ball reaches that cell. The roll stops there. `magmaLook` heats and sinks the ball |

A still result (no travel, including a press that collapses the cell under the ball) fires the events immediately. `lavaDeath` does not use the goal sink. The death motion is `magmaLook`.

## View hook

```js
view.onMagmaEvent(ev)  // same function as window.RB_MAGMA
```

`onMagmaEvent` forwards to `magmaLook.event`. Unknown types and cells that were not mounted are ignored. The look is only the lava vents; other planets are unchanged.

| `type` | `magmaLook` |
|--------|-------------|
| `magmaCrack` | cracks spread across the floor tile |
| `magmaCollapse` | the floor falls in and the lava pool stays |
| `lavaDeath` | the ball heats, sinks, and the vent smokes |

## Fail

`lost` is a stage outcome. It is not a clear: no star, `won` stays false. Input (tilt, press, hint) is blocked while `game.lost` or the lose overlay is up. Retry calls `game.reset()` and rebuilds the board, which restores floor, warn, or lava from tilt 0.

The lose overlay is the existing `#overlay.is-lose`. Lava uses the `fell` / `fell-note` strings (Retry on `#overlay-btn`). Running out of moves still uses `out`.

## Solver

`tools/tilt_solver.py` mirrors the slide. Hint search and `solve` do not enqueue a lost state or a state where the next bump would collapse the cell under the ball. A solution that dies is not a solution. Stripping `magma` must shorten par by at least `GAP` (3), and the stage must use the timer: the winning line crosses a vent while `tilts < at`, or the bare solution dies when replayed on the magma board.

Audio cues `magmaCrack`, `magmaCollapse`, and `lavaDeath` are planned from these events in `js/sfxCues.js`.
