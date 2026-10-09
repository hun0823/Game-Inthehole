const DIRS = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

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
  }

  reset() {
    this.loadLevel(this.level);
  }

  isHole(r, c) {
    return r === this.hole[0] && c === this.hole[1];
  }

  isPillarBlocked(r, c, direction) {
    const { dr, dc } = DIRS[direction];
    const nr = r + dr;
    const nc = c + dc;

    if (nr < 0 || nc < 0 || nr >= this.rows || nc >= this.cols) return true;

    if (direction === "right") return this.vWalls[r][c];
    if (direction === "left") return this.vWalls[r][nc];
    if (direction === "down") return this.hWalls[r][c];
    if (direction === "up") return this.hWalls[nr][c];

    return true;
  }

  isColoredBlocked(r, c, direction) {
    const { dr, dc } = DIRS[direction];
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= this.rows || nc >= this.cols) return false;

    let color = null;
    if (direction === "right") color = this.vColored[r][c];
    else if (direction === "left") color = this.vColored[r][nc];
    else if (direction === "down") color = this.hColored[r][c];
    else if (direction === "up") color = this.hColored[nr][c];

    return color != null && !this.activatedColors.has(color);
  }

  isSolidBlocked(r, c, direction) {
    return this.isPillarBlocked(r, c, direction) || this.isColoredBlocked(r, c, direction);
  }

  glassEdge(r, c, direction) {
    const { dr, dc } = DIRS[direction];
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= this.rows || nc >= this.cols) return null;

    if (direction === "right" && this.vGlass[r][c]) return { kind: "v", r, c };
    if (direction === "left" && this.vGlass[r][nc]) return { kind: "v", r, c: nc };
    if (direction === "down" && this.hGlass[r][c]) return { kind: "h", r, c };
    if (direction === "up" && this.hGlass[nr][c]) return { kind: "h", r: nr, c };

    return null;
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

    const hGlass = cloneGrid(this.hGlass);
    const vGlass = cloneGrid(this.vGlass);
    const hStress = cloneGrid(this.hGlassStressed);
    const vStress = cloneGrid(this.vGlassStressed);
    const hCol = cloneGrid(this.hColored);
    const vCol = cloneGrid(this.vColored);
    const activated = new Set(this.activatedColors);

    const tryActivateAt = (ballPos) => {
      for (const btn of this.buttons) {
        if (ballPos[0] !== btn.row || ballPos[1] !== btn.col) continue;
        if (activated.has(btn.color)) continue;
        activated.add(btn.color);
        for (let r = 0; r < hCol.length; r++)
          for (let c = 0; c < hCol[0].length; c++)
            if (hCol[r][c] === btn.color) hCol[r][c] = null;
        for (let r = 0; r < vCol.length; r++)
          for (let c = 0; c < vCol[0].length; c++)
            if (vCol[r][c] === btn.color) vCol[r][c] = null;
        return true;
      }
      return false;
    };

    const isBlocked = (r, c) => {
      if (this.isPillarBlocked(r, c, direction)) return true;
      const { dr, dc } = DIRS[direction];
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= this.rows || nc >= this.cols) return false;
      let color = null;
      if (direction === "right") color = vCol[r][c];
      else if (direction === "left") color = vCol[r][nc];
      else if (direction === "down") color = hCol[r][c];
      else if (direction === "up") color = hCol[nr][c];
      return color != null && !activated.has(color);
    };

    const glassAt = (r, c) => {
      const { dr, dc } = DIRS[direction];
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= this.rows || nc >= this.cols) return null;
      if (direction === "right" && vGlass[r][c]) return { kind: "v", r, c };
      if (direction === "left" && vGlass[r][nc]) return { kind: "v", r, c: nc };
      if (direction === "down" && hGlass[r][c]) return { kind: "h", r, c };
      if (direction === "up" && hGlass[nr][c]) return { kind: "h", r: nr, c };
      return null;
    };

    const { dr, dc } = DIRS[direction];
    const path = [this.ball.slice()];
    const glassBroken = [];
    let [r, c] = this.ball;
    let moved = false;

    tryActivateAt([r, c]);

    while (true) {
      if (isBlocked(r, c)) break;

      const edge = glassAt(r, c);
      if (edge) {
        if (edge.kind === "h") {
          if (hStress[edge.r][edge.c]) {
            hGlass[edge.r][edge.c] = false;
            hStress[edge.r][edge.c] = false;
            glassBroken.push(edge);
          } else {
            hStress[edge.r][edge.c] = true;
            moved = true;
            break;
          }
        } else if (vStress[edge.r][edge.c]) {
          vGlass[edge.r][edge.c] = false;
          vStress[edge.r][edge.c] = false;
          glassBroken.push(edge);
        } else {
          vStress[edge.r][edge.c] = true;
          moved = true;
          break;
        }
      }

      r += dr;
      c += dc;
      path.push([r, c]);
      moved = true;
      tryActivateAt([r, c]);

      if (this.isHole(r, c)) {
        return { path, moved, won: true, glassBroken };
      }
    }

    return { path, moved, won: false, glassBroken };
  }

  applyTiltResult(path, won, moved) {
    let spent = false;
    if (moved && path.length > 1) {
      this.ball = path[path.length - 1].slice();
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
}
