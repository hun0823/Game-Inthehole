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
        table[r * n + c] = {
          wall: !!wall,
          colorBit: colorName ? COLOR_BIT[colorName] || 1 : 0,
          glassIndex: gi === undefined ? -1 : gi,
        };
      }
    }
    return table;
  });

  return {
    n,
    glass,
    buttons,
    leave,
    holeR: level.hole[0],
    holeC: level.hole[1],
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
// A tilt counts only when the ball moves or glass takes a hit. A button
// under the ball opens during that tilt. Pressing without tilting is separate.
function slide(board, r, c, dirIndex, gstate, act) {
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
      return { r, c, gstate, act: newAct, moved: true, won: true, path, broken };
    }
  }

  return { r, c, gstate, act: newAct, moved, won: false, path, broken };
}

function stateKey(r, c, gstate, act, n) {
  return ((gstate * 32 + act) * n + r) * n + c;
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
    this.board = prepareBoard(level);
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
    const result = slide(this.board, this.ball[0], this.ball[1], dirIndex, this.packGlass(), this.packAct());
    this.writeGlass(result.gstate);
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
    }
    if (path.length > 0) this.ball = path[path.length - 1].slice();
    if (spent) this.moves += 1;
    if (won) this.won = true;
  }

  pressButton() {
    if (this.won) return false;
    if (!this.tryActivateButton()) return false;
    this.moves += 1;
    return true;
  }

  // Next optimal action from the current ball, glass, and gate state.
  // "up" | "down" | "left" | "right" | "press", or null if none within the cap.
  // Hints are unlimited; each call is cached by state.
  nextMove(limit = 40) {
    if (this.won) return null;
    const board = this.board;
    const n = board.n;
    const sr = this.ball[0];
    const sc = this.ball[1];
    if (sr === board.holeR && sc === board.holeC) return null;
    const g0 = this.packGlass();
    const a0 = this.packAct();
    const startKey = stateKey(sr, sc, g0, a0, n);
    if (this.hintCache.has(startKey)) return this.hintCache.get(startKey);

    const parent = new Map();
    parent.set(startKey, null);
    const queue = [[sr, sc, g0, a0, 0]];
    let answer = null;

    for (let qi = 0; qi < queue.length; qi++) {
      const [r, c, gstate, act, depth] = queue[qi];
      if (depth >= limit) continue;
      const here = stateKey(r, c, gstate, act, n);

      const pressBit = activateAt(board, r, c, act) ^ act;
      if (pressBit) {
        const nextAct = act | pressBit;
        const key = stateKey(r, c, gstate, nextAct, n);
        if (!parent.has(key)) {
          parent.set(key, { prev: here, action: "press" });
          queue.push([r, c, gstate, nextAct, depth + 1]);
        }
      }

      for (let dirIndex = 0; dirIndex < DIR_LIST.length; dirIndex++) {
        const result = slide(board, r, c, dirIndex, gstate, act);
        if (!result.moved) continue;
        const key = stateKey(result.r, result.c, result.gstate, result.act, n);
        if (result.won) {
          let action = DIR_LIST[dirIndex].name;
          let cursor = here;
          while (parent.get(cursor)) {
            const link = parent.get(cursor);
            action = link.action;
            cursor = link.prev;
          }
          answer = action;
          qi = queue.length;
          break;
        }
        if (!parent.has(key)) {
          parent.set(key, { prev: here, action: DIR_LIST[dirIndex].name });
          queue.push([result.r, result.c, result.gstate, result.act, depth + 1]);
        }
      }
    }

    this.hintCache.set(startKey, answer);
    return answer;
  }
}
