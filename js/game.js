const DIRS = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

const DIR_LIST = [
  { name: "up", dr: -1, dc: 0 },
  { name: "down", dr: 1, dc: 0 },
  { name: "left", dr: 0, dc: -1 },
  { name: "right", dr: 0, dc: 1 },
];

const DIR_INDEX = { up: 0, down: 1, left: 2, right: 3 };

const COLOR_BIT = { red: 1, blue: 2, green: 4, purple: 8 };

const POW3 = [1];
for (let i = 1; i < 16; i++) POW3.push(POW3[i - 1] * 3);

function emptyH(size) {
  return Array.from({ length: size - 1 }, () => Array(size).fill(false));
}

function emptyV(size) {
  return Array.from({ length: size }, () => Array(size - 1).fill(false));
}

function emptyColorH(size) {
  return Array.from({ length: size - 1 }, () => Array(size).fill(null));
}

function emptyColorV(size) {
  return Array.from({ length: size }, () => Array(size - 1).fill(null));
}

function prepareBoard(level) {
  const n = level.size;
  const glass = [];
  const glassIndex = new Map();
  const addGlass = (axis, grid) => {
    if (!grid) return;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (!grid[r][c]) continue;
        glassIndex.set(`${axis}:${r}:${c}`, glass.length);
        glass.push({ axis, r, c });
      }
    }
  };
  addGlass("h", level.hGlass);
  addGlass("v", level.vGlass);

  const buttons = (level.buttons || []).map((b) => ({
    row: b.row,
    col: b.col,
    bit: COLOR_BIT[b.color] || 1,
    color: b.color,
  }));

  const leave = DIR_LIST.map((dir) => {
    const table = new Array(n * n);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const nr = r + dir.dr;
        const nc = c + dir.dc;
        if (nr < 0 || nc < 0 || nr >= n || nc >= n) {
          table[r * n + c] = null;
          continue;
        }
        let axis;
        let er;
        let ec;
        if (dir.name === "right") {
          axis = "v";
          er = r;
          ec = c;
        } else if (dir.name === "left") {
          axis = "v";
          er = r;
          ec = nc;
        } else if (dir.name === "down") {
          axis = "h";
          er = r;
          ec = c;
        } else {
          axis = "h";
          er = nr;
          ec = c;
        }
        const wall = axis === "h" ? level.hWalls[er][ec] : level.vWalls[er][ec];
        const colorName = axis === "h" ? level.hColored[er][ec] : level.vColored[er][ec];
        const gi = glassIndex.get(`${axis}:${er}:${ec}`);
        const edgeKey = `${axis}:${er}:${ec}`;
        table[r * n + c] = {
          wall: !!wall,
          colorBit: colorName ? COLOR_BIT[colorName] || 1 : 0,
          glassIndex: gi === undefined ? -1 : gi,
          edgeKey,
          nr,
          nc,
        };
      }
    }
    return table;
  });

  const asPairs = (list) => (list || []).map((p) => (Array.isArray(p) ? p : [p.row, p.col]));
  const ice = new Set(asPairs(level.ice).map(([r, c]) => `${r},${c}`));
  const sand = new Set(asPairs(level.sand).map(([r, c]) => `${r},${c}`));
  const collapse = asPairs(level.collapse);
  const collapseIndex = new Map(collapse.map(([r, c], i) => [`${r},${c}`, 1 << i]));
  const oneWays = new Map((level.oneWay || []).map((e) => [`${e[0]}:${e[1]}:${e[2]}`, e[3]]));
  const teleport = new Map();
  for (const pair of level.teleports || []) {
    const a = pair[0];
    const b = pair[1];
    teleport.set(`${a[0]},${a[1]}`, b);
    teleport.set(`${b[0]},${b[1]}`, a);
  }
  const shifters = (level.shifters || []).map((pair) => ({
    home: { axis: pair[0][0], r: pair[0][1], c: pair[0][2] },
    alt: { axis: pair[1][0], r: pair[1][1], c: pair[1][2] },
  }));
  const coins = asPairs(level.coins);
  const smog = asPairs(level.smog);
  const jelly = new Set(asPairs(level.jelly).map(([r, c]) => `${r},${c}`));
  const magma = new Map();
  let magmaCap = 0;
  for (const vent of level.magma || []) {
    const r = Array.isArray(vent) ? vent[0] : vent.row;
    const c = Array.isArray(vent) ? vent[1] : vent.col;
    const at = Array.isArray(vent) ? vent[2] : vent.at;
    magma.set(`${r},${c}`, at);
    if (at > magmaCap) magmaCap = at;
  }

  return {
    n,
    glass,
    buttons,
    leave,
    holeR: level.hole[0],
    holeC: level.hole[1],
    ice,
    sand,
    collapse,
    collapseIndex,
    oneWays,
    teleport,
    shifters,
    coins,
    smog,
    jelly,
    magma,
    magmaCap,
    special:
      ice.size + sand.size + collapse.length + oneWays.size + teleport.size + shifters.length + jelly.size + magma.size > 0,
  };
}

// First unactivated button on this cell, matching tryActivateButton.
function activateAt(board, r, c, act) {
  for (const btn of board.buttons) {
    if (btn.row !== r || btn.col !== c) continue;
    if (act & btn.bit) continue;
    return act | btn.bit;
  }
  return act;
}

// One tilt. Shared by the live board and the hint search.
// A tilt counts only when the ball moves, glass takes a hit, or a button
// under the ball opens. Pressing without tilting is separate and does not
// flip shifting walls.
//
// Ice: once a tilt steps on ice, the ball keeps going in that direction. A
// first glass hit does not stop it while it is on ice (the pane still cracks).
// The tilt ends on the first non-ice cell after that ice, or sooner on sand,
// the goal, or a hard block. A hard block (border, wall, closed gate, one-way
// facing the wrong way, shifting wall, crumbled floor) always stops the ball,
// even on ice.
// Sand: entering a sand cell ends the tilt on that cell.
// Teleport: entering one pad of a pair exits on the other and the slide
// continues in the same direction. The exit pad does not teleport again.
// One-way: the edge can be crossed only in its arrow direction.
// Shifting walls: each pair occupies `home` on even phase and `alt` on odd
// phase. A spent tilt flips the phase afterward. A pure button press does not.
// Collapsing floor: a listed cell crumbles when the ball leaves it, or when a
// spent tilt ends on it. A crumbled cell cannot be entered again.
// Jelly: rolling INTO a jelly cell (not starting a tilt already on one) jumps
// two cells ahead in the travel direction and keeps sliding. The jump ignores
// every edge between the jelly and the landing cell — walls, glass (a jumped
// pane does not crack), gates, one-ways, and shifting walls. The skipped cell
// is not entered; the path records the jelly cell, then the landing cell.
// If the landing cell is out of bounds, erupted magma, or a crumbled floor,
// the ball stops on the jelly and the tilt ends, even on ice. Landing on
// jelly jumps again, up to size*2 times. After a successful landing the hole
// wins, sand stops, and ice applies to that landing cell.
// Magma: each vent is [row, col, at]. The cell is blocked once completed spent
// tilts >= at, so the ball cannot enter it. `tilts` is the count at the START
// of this tilt and stays fixed for the whole slide; callers increment it after
// a spent tilt or a press. Standing on a vent when it erupts does not bury the
// ball: leaving is allowed, re-entry is not. Telegraph (tilts == at-1) is
// visual only. Once tilts reaches the latest `at`, further tilts do not change
// the schedule.
// Smog does not change the slide. It only hides walls until the ball has been
// on that cell. Coins, when present, are collected along the path; the hole
// is still the only clear condition. New stages do not use coins.
function slide(board, r, c, dirIndex, gstate, act, collapse = 0, phase = 0, tilts = 0) {
  if (!board.special) return slideClassic(board, r, c, dirIndex, gstate, act, collapse, phase);
  const dir = DIR_LIST[dirIndex];
  const table = board.leave[dirIndex];
  const n = board.n;
  let newAct = activateAt(board, r, c, act);
  const path = [[r, c]];
  const broken = [];
  let moved = false;
  let coll = collapse | 0;
  let iceRun = board.ice.has(`${r},${c}`);
  const limit = n * n * 6;

  const crumble = (rr, cc) => {
    const bit = board.collapseIndex.get(`${rr},${cc}`);
    if (bit) coll |= bit;
  };

  const jellyChain = () => {
    let guard = 0;
    while (board.jelly.has(`${r},${c}`) && guard < n * 2) {
      guard += 1;
      const lr = r + dir.dr * 2;
      const lc = c + dir.dc * 2;
      if (lr < 0 || lc < 0 || lr >= n || lc >= n) return "stop";
      if (magmaBlocks(board, lr, lc, tilts)) return "stop";
      const landBit = board.collapseIndex.get(`${lr},${lc}`);
      if (landBit && coll & landBit) return "stop";
      crumble(r, c);
      r = lr;
      c = lc;
      path.push([r, c]);
      moved = true;
      newAct = activateAt(board, r, c, newAct);
      if (r === board.holeR && c === board.holeC) return "won";
      if (board.sand.has(`${r},${c}`)) return "stop";
    }
    return "go";
  };

  for (let steps = 0; steps < limit; steps++) {
    const info = table[r * n + c];
    if (blocked(board, info, dir.name, newAct, coll, phase, tilts)) break;
    if (info.glassIndex >= 0) {
      const base = POW3[info.glassIndex];
      const st = Math.floor(gstate / base) % 3;
      if (st === 0) {
        gstate += base;
        moved = true;
        if (!board.ice.has(`${r},${c}`)) break;
      } else if (st === 1) {
        gstate += base;
        broken.push(board.glass[info.glassIndex]);
      }
    }
    const hop = board.teleport.get(`${info.nr},${info.nc}`);
    let destR = info.nr;
    let destC = info.nc;
    let via = null;
    if (hop) {
      const exitBit = board.collapseIndex.get(`${hop[0]},${hop[1]}`);
      if (exitBit && coll & exitBit) break;
      if (magmaBlocks(board, hop[0], hop[1], tilts)) break;
      via = [info.nr, info.nc];
      destR = hop[0];
      destC = hop[1];
    }
    crumble(r, c);
    moved = true;
    if (via) path.push(via);
    r = destR;
    c = destC;
    path.push([r, c]);
    newAct = activateAt(board, r, c, newAct);
    if (r === board.holeR && c === board.holeC) {
      return finish(board, r, c, gstate, act, newAct, coll, phase, true, true, path, broken);
    }
    if (board.sand.has(`${r},${c}`)) break;
    if (board.jelly.has(`${r},${c}`)) {
      const outcome = jellyChain();
      if (outcome === "won") {
        return finish(board, r, c, gstate, act, newAct, coll, phase, true, true, path, broken);
      }
      if (outcome === "stop") break;
    }
    const nowIce = board.ice.has(`${r},${c}`);
    if (iceRun && !nowIce) break;
    if (nowIce) iceRun = true;
  }
  if (moved) crumble(r, c);
  return finish(board, r, c, gstate, act, newAct, coll, phase, moved, false, path, broken);
}

function slideClassic(board, r, c, dirIndex, gstate, act, collapse, phase) {
  const dir = DIR_LIST[dirIndex];
  const table = board.leave[dirIndex];
  const n = board.n;
  let newAct = activateAt(board, r, c, act);
  const path = [[r, c]];
  const broken = [];
  let moved = false;

  while (true) {
    const info = table[r * n + c];
    if (!info || info.wall) break;
    if (info.colorBit && (newAct & info.colorBit) === 0) break;
    if (info.glassIndex >= 0) {
      const base = POW3[info.glassIndex];
      const st = Math.floor(gstate / base) % 3;
      if (st === 0) {
        gstate += base;
        moved = true;
        break;
      }
      if (st === 1) {
        gstate += base;
        broken.push(board.glass[info.glassIndex]);
      }
    }
    r += dir.dr;
    c += dir.dc;
    path.push([r, c]);
    moved = true;
    newAct = activateAt(board, r, c, newAct);
    if (r === board.holeR && c === board.holeC) {
      return finish(board, r, c, gstate, act, newAct, collapse, phase, true, true, path, broken);
    }
  }

  return finish(board, r, c, gstate, act, newAct, collapse, phase, moved, false, path, broken);
}

function magmaBlocks(board, r, c, tilts) {
  const at = board.magma.get(`${r},${c}`);
  return at !== undefined && tilts >= at;
}

function blocked(board, info, dirName, act, collapse, phase, tilts = 0) {
  if (!info || info.wall) return true;
  if (info.colorBit && (act & info.colorBit) === 0) return true;
  const allow = board.oneWays.get(info.edgeKey);
  if (allow && allow !== dirName) return true;
  if (shifterBlocks(board, info.edgeKey, phase)) return true;
  const bit = board.collapseIndex.get(`${info.nr},${info.nc}`);
  if (bit && collapse & bit) return true;
  if (magmaBlocks(board, info.nr, info.nc, tilts)) return true;
  return false;
}

function shifterBlocks(board, edgeKey, phase) {
  for (const shifter of board.shifters) {
    const spot = phase & 1 ? shifter.alt : shifter.home;
    if (`${spot.axis}:${spot.r}:${spot.c}` === edgeKey) return true;
  }
  return false;
}

function finish(board, r, c, gstate, act, newAct, collapse, phase, moved, won, path, broken) {
  const nextPhase = board.shifters.length && moved ? phase ^ 1 : phase;
  return { r, c, gstate, act: newAct, collapse, phase: nextPhase, moved, won, path, broken };
}

function stateKey(r, c, gstate, act, collapse, phase, tilts) {
  return `${r},${c},${gstate},${act},${collapse},${phase},${tilts}`;
}

function bumpTilts(board, tilts) {
  return tilts >= board.magmaCap ? tilts : tilts + 1;
}

export class Game {
  constructor(level) {
    this.loadLevel(level);
  }

  loadLevel(level) {
    this.level = level;
    this.rows = level.size;
    this.cols = level.size;
    this.hWalls = level.hWalls.map((row) => row.slice());
    this.vWalls = level.vWalls.map((row) => row.slice());
    this.hGlass = level.hGlass ? level.hGlass.map((row) => row.slice()) : emptyH(level.size);
    this.vGlass = level.vGlass ? level.vGlass.map((row) => row.slice()) : emptyV(level.size);
    this.hGlassStressed = emptyH(level.size);
    this.vGlassStressed = emptyV(level.size);
    this.hColored = level.hColored ? level.hColored.map((row) => row.slice()) : emptyColorH(level.size);
    this.vColored = level.vColored ? level.vColored.map((row) => row.slice()) : emptyColorV(level.size);
    this.buttons = level.buttons ? level.buttons.map((b) => ({ ...b })) : [];
    this.activatedColors = new Set();
    this.ball = [...level.ball];
    this.hole = [...level.hole];
    this.moves = 0;
    this.won = false;
    this.collapse = 0;
    this.phase = 0;
    this.tilts = 0;
    this.board = prepareBoard(level);
    this.coinsGot = new Set();
    this.revealed = new Set([`${this.ball[0]},${this.ball[1]}`]);
    if (this.board.coins.some(([r, c]) => r === this.ball[0] && c === this.ball[1])) {
      this.coinsGot.add(`${this.ball[0]},${this.ball[1]}`);
    }
    this.hintCache = new Map();
  }

  reset() {
    this.loadLevel(this.level);
  }

  isHole(r, c) {
    return r === this.hole[0] && c === this.hole[1];
  }

  packGlass() {
    let state = 0;
    const glass = this.board.glass;
    for (let i = 0; i < glass.length; i++) {
      const pane = glass[i];
      const grid = pane.axis === "h" ? this.hGlass : this.vGlass;
      const stress = pane.axis === "h" ? this.hGlassStressed : this.vGlassStressed;
      let digit = 0;
      if (!grid[pane.r][pane.c]) digit = 2;
      else if (stress[pane.r][pane.c]) digit = 1;
      state += digit * POW3[i];
    }
    return state;
  }

  writeGlass(gstate) {
    const glass = this.board.glass;
    for (let i = 0; i < glass.length; i++) {
      const pane = glass[i];
      const grid = pane.axis === "h" ? this.hGlass : this.vGlass;
      const stress = pane.axis === "h" ? this.hGlassStressed : this.vGlassStressed;
      const digit = Math.floor(gstate / POW3[i]) % 3;
      grid[pane.r][pane.c] = digit !== 2;
      stress[pane.r][pane.c] = digit === 1;
    }
  }

  packAct() {
    let act = 0;
    for (const btn of this.board.buttons) {
      if (this.activatedColors.has(btn.color)) act |= btn.bit;
    }
    return act;
  }

  tryActivateButton() {
    for (const btn of this.buttons) {
      if (this.ball[0] !== btn.row || this.ball[1] !== btn.col) continue;
      if (this.activatedColors.has(btn.color)) continue;
      this.activatedColors.add(btn.color);
      for (let r = 0; r < this.hColored.length; r++) {
        for (let c = 0; c < this.hColored[0].length; c++) {
          if (this.hColored[r][c] === btn.color) this.hColored[r][c] = null;
        }
      }
      for (let r = 0; r < this.vColored.length; r++) {
        for (let c = 0; c < this.vColored[0].length; c++) {
          if (this.vColored[r][c] === btn.color) this.vColored[r][c] = null;
        }
      }
      return true;
    }
    return false;
  }

  simulateTilt(direction) {
    if (this.won) {
      return { path: [this.ball.slice()], moved: false, won: true, glassBroken: [] };
    }
    const dirIndex = DIR_INDEX[direction];
    if (dirIndex === undefined) {
      return { path: [this.ball.slice()], moved: false, won: false, glassBroken: [] };
    }
    const result = slide(
      this.board, this.ball[0], this.ball[1], dirIndex, this.packGlass(), this.packAct(),
      this.collapse, this.phase, this.tilts
    );
    this.writeGlass(result.gstate);
    if (result.moved) {
      this.collapse = result.collapse;
      this.phase = result.phase;
    }
    return {
      path: result.path,
      moved: result.moved,
      won: result.won,
      glassBroken: result.broken.map((edge) => ({ kind: edge.axis, r: edge.r, c: edge.c })),
    };
  }

  applyTiltResult(path, won, moved) {
    let spent = false;
    if (moved) {
      if (path.length > 1) this.ball = path[path.length - 1].slice();
      spent = true;
    }
    for (const cell of path) {
      const saved = this.ball.slice();
      this.ball = cell.slice();
      if (this.tryActivateButton()) spent = true;
      this.ball = saved;
      this.revealed.add(`${cell[0]},${cell[1]}`);
      if (this.board.coins.some(([r, c]) => r === cell[0] && c === cell[1])) {
        this.coinsGot.add(`${cell[0]},${cell[1]}`);
      }
    }
    if (path.length > 0) this.ball = path[path.length - 1].slice();
    if (spent) {
      this.moves += 1;
      this.tilts = bumpTilts(this.board, this.tilts);
    }
    if (won) this.won = true;
  }

  allCoins() {
    return this.board.coins.length > 0 && this.coinsGot.size >= this.board.coins.length;
  }

  pressButton() {
    if (this.won) return false;
    if (!this.tryActivateButton()) return false;
    this.moves += 1;
    this.tilts = bumpTilts(this.board, this.tilts);
    return true;
  }

  // Next optimal action from the current ball, glass, and gate state.
  // "up" | "down" | "left" | "right" | "press", or null if none within the cap.
  // Hints are unlimited; each call is cached by state.
  nextMove(limit = 40) {
    const route = this.hintRoute(limit);
    return route ? route.action : null;
  }

  // Full remaining optimal route from the current state.
  // cells follows every square of each slide; stops are where a slide ends.
  // Read-only replay of slide(). Does not change rules or board state.
  hintRoute(limit = 40) {
    const actions = this._hintActions(limit);
    if (!actions) return null;
    let r = this.ball[0];
    let c = this.ball[1];
    let gstate = this.packGlass();
    let act = this.packAct();
    let collapse = this.collapse;
    let phase = this.phase;
    let tilts = this.tilts;
    const cells = [[r, c]];
    const stops = [[r, c]];
    for (const action of actions) {
      if (action === "press") {
        act = activateAt(this.board, r, c, act);
        tilts = bumpTilts(this.board, tilts);
        continue;
      }
      const result = slide(this.board, r, c, DIR_INDEX[action], gstate, act, collapse, phase, tilts);
      if (result.moved) tilts = bumpTilts(this.board, tilts);
      for (let i = 1; i < result.path.length; i++) cells.push(result.path[i].slice());
      r = result.r;
      c = result.c;
      gstate = result.gstate;
      act = result.act;
      collapse = result.collapse;
      phase = result.phase;
      stops.push([r, c]);
    }
    return { action: actions[0], actions, cells, stops };
  }

  _hintActions(limit) {
    if (this.won) return null;
    const board = this.board;
    const n = board.n;
    const sr = this.ball[0];
    const sc = this.ball[1];
    if (sr === board.holeR && sc === board.holeC) return null;
    const g0 = this.packGlass();
    const a0 = this.packAct();
    const c0 = this.collapse;
    const p0 = this.phase;
    const t0 = this.tilts;
    const startKey = stateKey(sr, sc, g0, a0, c0, p0, t0);
    if (this.hintCache.has(startKey)) return this.hintCache.get(startKey);

    const parent = new Map();
    parent.set(startKey, null);
    const queue = [[sr, sc, g0, a0, c0, p0, t0, 0]];
    let answer = null;

    for (let qi = 0; qi < queue.length; qi++) {
      const [r, c, gstate, act, collapse, phase, tilts, depth] = queue[qi];
      if (depth >= limit) continue;
      const here = stateKey(r, c, gstate, act, collapse, phase, tilts);

      const pressBit = activateAt(board, r, c, act) ^ act;
      if (pressBit) {
        const nextAct = act | pressBit;
        const nextTilts = bumpTilts(board, tilts);
        const key = stateKey(r, c, gstate, nextAct, collapse, phase, nextTilts);
        if (!parent.has(key)) {
          parent.set(key, { prev: here, action: "press" });
          queue.push([r, c, gstate, nextAct, collapse, phase, nextTilts, depth + 1]);
        }
      }

      for (let dirIndex = 0; dirIndex < DIR_LIST.length; dirIndex++) {
        const result = slide(board, r, c, dirIndex, gstate, act, collapse, phase, tilts);
        if (!result.moved) continue;
        const nextTilts = bumpTilts(board, tilts);
        const key = stateKey(result.r, result.c, result.gstate, result.act, result.collapse, result.phase, nextTilts);
        if (result.won) {
          const actions = [DIR_LIST[dirIndex].name];
          let cursor = here;
          while (parent.get(cursor)) {
            const link = parent.get(cursor);
            actions.push(link.action);
            cursor = link.prev;
          }
          actions.reverse();
          answer = actions;
          qi = queue.length;
          break;
        }
        if (!parent.has(key)) {
          parent.set(key, { prev: here, action: DIR_LIST[dirIndex].name });
          queue.push([
            result.r, result.c, result.gstate, result.act, result.collapse, result.phase, nextTilts, depth + 1,
          ]);
        }
      }
    }

    this.hintCache.set(startKey, answer);
    return answer;
  }
}
