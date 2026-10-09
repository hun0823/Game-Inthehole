import { LEVELS } from "./levels.js";
import { Game } from "./game.js";
import { drawPlayfield } from "./playfield.js";

const STORAGE_KEY = "inthehole_cleared";
const STORAGE_STARS_PREFIX = "inthehole_stars_";

function gameOverAt(par) {
  return par > 0 ? par + 3 : Number.POSITIVE_INFINITY;
}

function moveCountTone(par, moves) {
  if (par <= 0) return "normal";
  const over = moves - par;
  if (over <= 0) return "normal";
  if (over === 1) return "warn";
  if (over === 2) return "danger";
  return "danger";
}

function starsForMoves(par, moves) {
  if (par <= 0) return moves <= 0 ? 3 : 1;
  const over = moves - par;
  if (over <= 0) return 3;
  if (over === 1) return 2;
  if (over === 2) return 1;
  return 0;
}

function isGameOver(par, moves) {
  return par > 0 && moves >= gameOverAt(par);
}

function starsText(stars) {
  if (stars <= 0) return "—";
  return "★".repeat(stars) + "☆".repeat(3 - stars);
}

function getStars(id) {
  return parseInt(localStorage.getItem(STORAGE_STARS_PREFIX + id) || "0", 10) || 0;
}

function saveStars(id, stars) {
  if (stars <= 0) return;
  const prev = getStars(id);
  if (stars > prev) localStorage.setItem(STORAGE_STARS_PREFIX + id, String(stars));
}
const CELL_GAP = 6;
const BOARD_PAD = 16;
const STEP_MS = 95;
const IDLE_TILT_X = 18;
const TILT_ADD = 22;

const boardWrapEl = document.querySelector(".board-wrap");
const boardTiltEl = document.getElementById("board-tilt");
const boardEl = document.getElementById("board");
const cellsEl = document.getElementById("cells");
const wallsEl = document.getElementById("walls");
const playfieldEl = document.getElementById("playfield");
const ballShadowEl = document.getElementById("ball-shadow");
const ballEl = document.getElementById("ball");
const stageLabel = document.getElementById("stage-label");
const sizeLabel = document.getElementById("size-label");
const movesLabel = document.getElementById("moves-label");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMsg = document.getElementById("overlay-msg");
const overlayBtn = document.getElementById("overlay-btn");
const stageDialog = document.getElementById("stage-dialog");
const stageList = document.getElementById("stage-list");

let stageIndex = 0;
let game = new Game(LEVELS[0]);
let animating = false;
let gameOver = false;
let layout = { cell: 72, n: 3, ballZ: 24, wallDepth: 18 };

function getCleared() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setCleared(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

function markCleared(id) {
  const cleared = getCleared();
  if (!cleared.includes(id)) {
    cleared.push(id);
    setCleared(cleared);
  }
}

function cellPixel(r, c) {
  const step = layout.cell + CELL_GAP;
  return {
    x: c * step,
    y: r * step,
  };
}

function placeBallAt(r, c, dir, spinDeg = 0) {
  const { x, y } = cellPixel(r, c);
  const ballSize = Math.round(layout.cell * 0.64);
  const cx = x + (layout.cell - ballSize) / 2;
  const cy = y + (layout.cell - ballSize) / 2;
  const lean = layout.cell * 0.14;
  let ox = 0;
  let oy = 0;
  if (dir === "up") oy = -lean;
  if (dir === "down") oy = lean;
  if (dir === "left") ox = -lean;
  if (dir === "right") ox = lean;

  const inHole = game.isHole(r, c);
  const scale = inHole ? 0.72 : 1;

  const tx = Math.round(cx + ox);
  const ty = Math.round(cy + oy);
  const ballZ = inHole ? Math.round(layout.ballZ * 0.35) : layout.ballZ;
  const shadowScale = inHole ? 0.45 : 1;
  const shadowY = Math.round(ty + ballSize * 0.42);
  const shadowZ = 2;

  ballEl.style.transform = `translate3d(${tx}px, ${ty}px, ${ballZ}px) rotate(${spinDeg}deg) scale(${scale})`;
  ballShadowEl.style.width = `${ballSize}px`;
  ballShadowEl.style.height = `${Math.round(ballSize * 0.32)}px`;
  ballShadowEl.style.transform = `translate3d(${tx}px, ${shadowY}px, ${shadowZ}px) scale(${shadowScale})`;
  ballShadowEl.style.opacity = inHole ? "0.3" : "0.6";
}

/** 보드 영역에 맞춰 칸 크기 계산 (가능한 한 크게) */
function computeCellSize(n) {
  const rect = boardWrapEl.getBoundingClientRect();
  const pad = 8;
  const budgetW = Math.min(rect.width, window.innerWidth * 0.96) - pad;
  const budgetH = rect.height - pad;
  const budget = Math.max(budgetW, budgetH > 120 ? budgetH : budgetW);

  const inner = budget - BOARD_PAD * 2;
  const cell = Math.floor((inner - CELL_GAP * (n - 1)) / n);
  return Math.max(52, cell);
}

function updateHud() {
  const level = LEVELS[stageIndex];
  const par = level.par || 0;
  stageLabel.textContent = `#${level.id}`;
  sizeLabel.textContent = `${level.size}×${level.size}`;
  if (par > 0) {
    const live = starsForMoves(par, game.moves);
    const tone = moveCountTone(par, game.moves);
    movesLabel.classList.remove("move-warn", "move-danger", "move-over");
    if (gameOver) movesLabel.classList.add("move-over");
    else if (tone === "warn") movesLabel.classList.add("move-warn");
    else if (tone === "danger") movesLabel.classList.add("move-danger");
    movesLabel.innerHTML = gameOver
      ? `<span class="move-num">${game.moves}</span><span class="move-par">/${par}</span> GAME OVER`
      : `<span class="move-num">${game.moves}</span><span class="move-par">/${par}</span> · ${starsText(live)}`;
  } else {
    movesLabel.classList.remove("move-warn", "move-danger", "move-over");
    movesLabel.textContent = String(game.moves);
  }
}

function handleAfterMove(won) {
  const level = LEVELS[stageIndex];
  const par = level.par || 0;

  if (isGameOver(par, game.moves)) {
    gameOver = true;
    updateHud();
    showGameOver();
    return;
  }

  if (!won) {
    updateHud();
    return;
  }

  const stars = starsForMoves(par, game.moves);
  if (stars <= 0) {
    gameOver = true;
    updateHud();
    showGameOver();
    return;
  }

  markCleared(level.id);
  saveStars(level.id, stars);
  showWin(stars);
}

function showGameOver() {
  const level = LEVELS[stageIndex];
  const par = level.par || 0;
  overlay.classList.remove("hidden");
  overlayTitle.textContent = "이동 초과!";
  overlayMsg.textContent =
    par > 0
      ? `#${level.id} · ${game.moves}/${par} — 게임오버`
      : `#${level.id} · 이동 초과`;
  overlayBtn.textContent = "다시 하기";
  overlayBtn.onclick = () => {
    hideOverlay();
    game.reset();
    gameOver = false;
    renderBoard();
  };
}

function renderBoard() {
  boardEl.querySelectorAll(".cell-button").forEach((el) => el.remove());

  const level = LEVELS[stageIndex];
  const n = level.size;
  layout.n = n;
  layout.cell = computeCellSize(n);
  layout.pad = BOARD_PAD;
  layout.ballZ = Math.round(layout.cell * 0.32);
  layout.wallDepth = Math.round(layout.cell * 0.26);
  const frameH = Math.max(10, Math.round(layout.cell * 0.14));

  document.documentElement.style.setProperty("--cell-size", `${layout.cell}px`);
  document.documentElement.style.setProperty("--frame-h", `${frameH}px`);
  document.documentElement.style.setProperty("--wall-depth", `${layout.wallDepth}px`);
  document.documentElement.style.setProperty("--ball-z", `${layout.ballZ}px`);
  document.documentElement.style.setProperty("--cell-gap", `${CELL_GAP}px`);
  document.documentElement.style.setProperty("--board-pad", `${BOARD_PAD}px`);

  const step = layout.cell + CELL_GAP;
  const innerW = n * layout.cell + (n - 1) * CELL_GAP;
  const boardSize = innerW + BOARD_PAD * 2;
  boardEl.style.width = `${boardSize}px`;
  boardEl.style.height = `${boardSize}px`;
  cellsEl.style.width = `${innerW}px`;
  cellsEl.style.height = `${innerW}px`;

  drawPlayfield(playfieldEl, {
    n,
    cell: layout.cell,
    gap: CELL_GAP,
    hole: level.hole,
  });

  wallsEl.innerHTML = "";
  const wallThick = Math.max(10, Math.floor(layout.cell * 0.18));

  const addWall = (cls, left, top, width, height) => {
    const seg = document.createElement("div");
    seg.className = `wall-seg ${cls}`;
    seg.style.left = `${left}px`;
    seg.style.top = `${top}px`;
    seg.style.width = `${width}px`;
    seg.style.height = `${height}px`;
    const kind = cls === "wall-h" ? "h" : "v";
    seg.innerHTML = `
      <div class="wall-3d wall-3d-${kind}">
        <span class="w3d-top"></span>
        <span class="w3d-front"></span>
        <span class="w3d-side"></span>
      </div>`;
    wallsEl.appendChild(seg);
  };

  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n; c++) {
      if (!level.hWalls[r][c]) continue;
      addWall(
        "wall-h",
        c * step,
        (r + 1) * layout.cell + r * CELL_GAP - wallThick / 2,
        layout.cell,
        wallThick
      );
    }
  }

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n - 1; c++) {
      if (!level.vWalls[r][c]) continue;
      addWall(
        "wall-v",
        (c + 1) * layout.cell + c * CELL_GAP - wallThick / 2,
        r * step,
        wallThick,
        layout.cell
      );
    }
  }

  const addColored = (cls, left, top, width, height) => {
    const seg = document.createElement("div");
    seg.className = `wall-seg colored-wall ${cls}`;
    seg.style.left = `${left}px`;
    seg.style.top = `${top}px`;
    seg.style.width = `${width}px`;
    seg.style.height = `${height}px`;
    wallsEl.appendChild(seg);
  };

  if (level.hColored) {
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n; c++) {
        if (!level.hColored[r][c]) continue;
        addColored(
          "wall-h",
          c * step,
          (r + 1) * layout.cell + r * CELL_GAP - wallThick / 2,
          layout.cell,
          wallThick
        );
      }
    }
  }

  if (level.vColored) {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n - 1; c++) {
        if (!level.vColored[r][c]) continue;
        addColored(
          "wall-v",
          (c + 1) * layout.cell + c * CELL_GAP - wallThick / 2,
          r * step,
          wallThick,
          layout.cell
        );
      }
    }
  }

  if (level.buttons) {
    for (const btn of level.buttons) {
      const { x, y } = cellPixel(btn.row, btn.col);
      const pad = layout.cell * 0.22;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cell-button";
      b.dataset.row = String(btn.row);
      b.dataset.col = String(btn.col);
      b.style.left = `${BOARD_PAD + x + pad}px`;
      b.style.top = `${BOARD_PAD + y + pad}px`;
      b.style.width = `${layout.cell - pad * 2}px`;
      b.style.height = `${layout.cell - pad * 2}px`;
      b.title = "버튼";
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        handleButtonPress(btn.row, btn.col);
      });
      boardEl.appendChild(b);
    }
  }

  const ballD = Math.round(layout.cell * 0.64);
  ballEl.style.width = `${ballD}px`;
  ballEl.style.height = `${ballD}px`;
  wallsEl.style.inset = `${BOARD_PAD}px`;
  syncBallLayerOrigin();
  placeBallAt(game.ball[0], game.ball[1], null, 0);
  updateHud();
}

function syncBallLayerOrigin() {
  const origin = `${BOARD_PAD}px`;
  ballEl.style.left = origin;
  ballEl.style.top = origin;
  ballShadowEl.style.left = origin;
  ballShadowEl.style.top = origin;
}

const TILT_LIGHT = {
  up: { x: 50, y: 12, rx: IDLE_TILT_X + TILT_ADD, ry: 0 },
  down: { x: 50, y: 88, rx: IDLE_TILT_X - TILT_ADD, ry: 0 },
  left: { x: 12, y: 50, rx: IDLE_TILT_X, ry: -TILT_ADD },
  right: { x: 88, y: 50, rx: IDLE_TILT_X, ry: TILT_ADD },
};

function setTableTilt(dir, active) {
  boardTiltEl.classList.remove("tilt-active");
  let rx = IDLE_TILT_X;
  let ry = 0;
  let lx = 50;
  let ly = 22;

  if (active && dir && TILT_LIGHT[dir]) {
    boardTiltEl.classList.add("tilt-active");
    const t = TILT_LIGHT[dir];
    rx = t.rx;
    ry = t.ry;
    lx = t.x;
    ly = t.y;
  }

  boardTiltEl.style.setProperty("--tilt-rx", `${rx}deg`);
  boardTiltEl.style.setProperty("--tilt-ry", `${ry}deg`);
  boardEl.style.setProperty("--light-x", `${lx}%`);
  boardEl.style.setProperty("--light-y", `${ly}%`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spinForDir(dir, steps) {
  const perStep = dir === "left" || dir === "up" ? -92 : 92;
  return perStep * steps;
}

async function animateRoll(path, dir) {
  const duration = Math.max(70, STEP_MS - path.length * 4);
  let spin = 0;

  for (let i = 1; i < path.length; i++) {
    const [r, c] = path[i];
    spin += spinForDir(dir, 1);
    ballEl.classList.add("rolling");
    const easing = `transform ${duration}ms cubic-bezier(0.22, 0.85, 0.32, 1)`;
    ballEl.style.transition = easing;
    ballShadowEl.style.transition = easing;
    placeBallAt(r, c, dir, spin);
    await wait(duration);
  }

  ballEl.classList.remove("rolling");
  const [fr, fc] = path[path.length - 1];
  ballEl.style.transition = "transform 120ms ease-out";
  placeBallAt(fr, fc, null, spin);
}

async function handleButtonPress(row, col) {
  if (animating || game.won || gameOver) return;
  if (game.ball[0] !== row || game.ball[1] !== col) return;
  if (!game.pressButton()) return;

  animating = true;
  document.querySelectorAll(".cell-button").forEach((el) => {
    if (+el.dataset.row === row && +el.dataset.col === col) el.classList.add("pressed");
  });
  renderBoard();
  handleAfterMove(game.won);
  await wait(150);
  animating = false;
}

async function handleTilt(dir) {
  if (animating || game.won || gameOver) return;

  const { path, moved, won } = game.simulateTilt(dir);
  if (!moved) {
    setTableTilt(dir, true);
    await wait(140);
    setTableTilt(null, false);
    return;
  }

  animating = true;
  setTableTilt(dir, true);
  boardEl.classList.add("board-active");
  ballShadowEl.style.transition = ballEl.style.transition;

  game.applyTiltResult(path, won, moved);
  wallsEl.querySelectorAll(".colored-wall").forEach((el) => el.remove());
  updateHud();

  placeBallAt(path[0][0], path[0][1], null, 0);
  await wait(80);
  if (path.length > 1) await animateRoll(path, dir);
  else await wait(90);

  await wait(120);
  setTableTilt(null, false);
  boardEl.classList.remove("board-active");
  animating = false;

  handleAfterMove(won);
}

function showWin(stars) {
  const level = LEVELS[stageIndex];
  overlay.classList.remove("hidden");
  overlayTitle.textContent = "스테이지 클리어!";
  overlayMsg.textContent = `#${level.id} · ${game.moves}/${par} · ${starsText(stars)}`;
  overlayBtn.textContent = stageIndex < LEVELS.length - 1 ? "다음 스테이지" : "처음부터";
  overlayBtn.onclick = () => nextStage();
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function loadStage(index) {
  stageIndex = Math.max(0, Math.min(index, LEVELS.length - 1));
  game = new Game(LEVELS[stageIndex]);
  gameOver = false;
  hideOverlay();
  renderBoard();
  updateHud();
}

function nextStage() {
  hideOverlay();
  loadStage(stageIndex < LEVELS.length - 1 ? stageIndex + 1 : 0);
}

function buildStageList() {
  const cleared = getCleared();
  stageList.innerHTML = "";
  LEVELS.forEach((lv, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `#${lv.id} (${lv.size}×${lv.size})`;
    if (cleared.includes(lv.id)) btn.classList.add("cleared");
    if (i === stageIndex) btn.classList.add("current");
    btn.addEventListener("click", () => {
      loadStage(i);
      stageDialog.close();
    });
    li.appendChild(btn);
    stageList.appendChild(li);
  });
}

document.querySelectorAll(".tilt[data-dir]").forEach((btn) => {
  btn.addEventListener("click", () => handleTilt(btn.dataset.dir));
});

document.getElementById("btn-reset").addEventListener("click", () => {
  if (animating) return;
  game.reset();
  hideOverlay();
  renderBoard();
});

document.getElementById("btn-prev").addEventListener("click", () => {
  if (!animating) loadStage(stageIndex - 1);
});

document.getElementById("btn-next").addEventListener("click", () => {
  if (!animating) loadStage(stageIndex + 1);
});

document.getElementById("btn-select").addEventListener("click", () => {
  buildStageList();
  stageDialog.showModal();
});

document.getElementById("dialog-close").addEventListener("click", () => {
  stageDialog.close();
});

overlayBtn.addEventListener("click", () => nextStage());

const KEY_MAP = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

document.addEventListener("keydown", (e) => {
  const dir = KEY_MAP[e.key];
  if (!dir) return;
  e.preventDefault();
  handleTilt(dir);
});

let touchStart = null;

boardEl.addEventListener(
  "touchstart",
  (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  },
  { passive: true }
);

boardEl.addEventListener(
  "touchend",
  (e) => {
    if (!touchStart || animating) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    const minSwipe = 28;
    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      handleTilt(dx > 0 ? "right" : "left");
    } else {
      handleTilt(dy > 0 ? "down" : "up");
    }
  },
  { passive: true }
);

renderBoard();
setTableTilt(null, false);

window.addEventListener("resize", () => {
  if (!animating) renderBoard();
});

if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => {
    if (!animating) renderBoard();
  }).observe(boardWrapEl);
}
