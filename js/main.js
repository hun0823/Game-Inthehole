import { LEVELS } from "./levels.js";
import { Game } from "./game.js";
import { drawPlayfield, drawSky, holeMarkup } from "./playfield.js";

const STORAGE_KEY = "inthehole_cleared";
const STORAGE_STARS_PREFIX = "inthehole_stars_";
const GEM_CYCLE = ["red", "blue", "green", "purple", "blue", "red", "purple", "green"];
const BTN_COLORS = {
  red: ["#ff5a4c", "#9d1c24"],
  blue: ["#3d8dff", "#1a3f9a"],
  green: ["#2ec86a", "#0e6b32"],
  purple: ["#c56bff", "#5a1e96"],
};

const STEP_MS = 95;
const TILT_NUDGE = 6.5;

const skyEl = document.getElementById("sky");
const boardWrapEl = document.querySelector(".board-wrap");
const boardTiltEl = document.getElementById("board-tilt");
const boardEl = document.getElementById("board");
const wellEl = document.getElementById("board-well");
const playfieldEl = document.getElementById("playfield");
const holeEl = document.getElementById("hole");
const ballShadowEl = document.getElementById("ball-shadow");
const ballEl = document.getElementById("ball");
const ballSpinEl = document.getElementById("ball-spin");
const scoreLabel = document.getElementById("score-label");
const levelLabel = document.getElementById("btn-select");
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
let layout = { cell: 72, gap: 4, pad: 16, n: 3 };
let holeBuilt = false;

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

function totalScore() {
  let score = 0;
  for (const lv of LEVELS) score += getStars(lv.id) * 100;
  return score;
}

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
  const step = layout.cell + layout.gap;
  return { x: c * step, y: r * step };
}

function pillarColor(r, c) {
  return GEM_CYCLE[(r * 3 + c * 5) % GEM_CYCLE.length];
}

function findPillars(level) {
  const n = level.size;
  const out = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (r === level.hole[0] && c === level.hole[1]) continue;
      const up = r === 0 || level.hWalls[r - 1][c];
      const down = r === n - 1 || level.hWalls[r][c];
      const left = c === 0 || level.vWalls[r][c - 1];
      const right = c === n - 1 || level.vWalls[r][c];
      const hasWall =
        (r > 0 && level.hWalls[r - 1][c]) ||
        (r < n - 1 && level.hWalls[r][c]) ||
        (c > 0 && level.vWalls[r][c - 1]) ||
        (c < n - 1 && level.vWalls[r][c]);
      if (up && down && left && right && hasWall) out.push({ r, c, color: pillarColor(r, c) });
    }
  }
  return out;
}

function edgeList(grid, stressed) {
  const out = [];
  if (!grid) return out;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (!grid[r][c]) continue;
      out.push({
        r,
        c,
        stressed: stressed ? !!stressed[r][c] : false,
        color: grid[r][c],
      });
    }
  }
  return out;
}

function boardBudget() {
  const rect = boardWrapEl.getBoundingClientRect();
  const w = (rect.width > 40 ? rect.width : window.innerWidth) - 4;
  const h = (rect.height > 40 ? rect.height : window.innerHeight * 0.52) - 4;
  return { w: Math.max(140, w), h: Math.max(140, h) };
}

function computeLayout(n, maxW, maxH) {
  const gapR = 0.08;
  const padR = 0.4;
  const div = n + (n - 1) * gapR + 2 * padR;
  let cell = Math.floor(Math.min(maxW, maxH) / div);
  cell = Math.max(32, cell);
  let gap = Math.max(2, Math.round(cell * gapR));
  let pad = Math.max(12, Math.round(cell * padR));
  let inner = n * cell + (n - 1) * gap;
  let board = inner + pad * 2;
  const limit = Math.min(maxW, maxH);
  while (board > limit && cell > 32) {
    cell -= 1;
    gap = Math.max(2, Math.round(cell * gapR));
    pad = Math.max(12, Math.round(cell * padR));
    inner = n * cell + (n - 1) * gap;
    board = inner + pad * 2;
  }
  return { cell, gap, pad, inner };
}

function paintBoard() {
  const level = LEVELS[stageIndex];
  drawPlayfield(playfieldEl, {
    n: level.size,
    cell: layout.cell,
    gap: layout.gap,
    hole: level.hole,
    pillars: findPillars(level),
    glassH: edgeList(game.hGlass, game.hGlassStressed),
    glassV: edgeList(game.vGlass, game.vGlassStressed),
    coloredH: edgeList(game.hColored).filter((e) => e.color),
    coloredV: edgeList(game.vColored).filter((e) => e.color),
  });
}

function ensureHole() {
  if (holeBuilt) return;
  holeEl.innerHTML = holeMarkup();
  holeBuilt = true;
}

function placeHole() {
  ensureHole();
  const level = LEVELS[stageIndex];
  const { x, y } = cellPixel(level.hole[0], level.hole[1]);
  const s = layout.cell * 0.74;
  holeEl.style.width = `${s}px`;
  holeEl.style.height = `${s}px`;
  holeEl.style.transform = `translate(${x + (layout.cell - s) / 2}px, ${y + (layout.cell - s) / 2}px)`;
}

function placeBallAt(r, c, dir, spinDeg = 0) {
  const { x, y } = cellPixel(r, c);
  const ballSize = Math.round(layout.cell * 0.68);
  const cx = x + (layout.cell - ballSize) / 2;
  const cy = y + (layout.cell - ballSize) / 2;
  const lean = layout.cell * 0.05;
  let ox = 0;
  let oy = 0;
  if (dir === "up") oy = -lean;
  if (dir === "down") oy = lean;
  if (dir === "left") ox = -lean;
  if (dir === "right") ox = lean;
  const inHole = game.isHole(r, c);
  const scale = inHole ? 0.4 : 1;
  const tx = Math.round(cx + ox);
  const ty = Math.round(cy + oy);
  ballEl.style.width = `${ballSize}px`;
  ballEl.style.height = `${ballSize}px`;
  ballEl.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
  ballEl.style.opacity = inHole ? "0.5" : "1";
  ballSpinEl.style.transform = `rotate(${spinDeg}deg)`;
  const sw = Math.round(ballSize * 0.72);
  const sh = Math.round(ballSize * 0.28);
  ballShadowEl.style.width = `${sw}px`;
  ballShadowEl.style.height = `${sh}px`;
  ballShadowEl.style.transform = `translate3d(${tx + ballSize * 0.16}px, ${ty + ballSize * 0.7}px, 0) scale(${inHole ? 0.35 : 1})`;
  ballShadowEl.style.opacity = inHole ? "0.12" : "0.55";
}

function syncButtons(includeReady) {
  wellEl.querySelectorAll(".cell-button").forEach((el) => {
    const spent = game.activatedColors.has(el.dataset.color);
    el.classList.toggle("spent", spent);
    const ready =
      includeReady &&
      !spent &&
      game.ball[0] === +el.dataset.row &&
      game.ball[1] === +el.dataset.col;
    el.classList.toggle("ready", ready);
  });
}

function buildButtons() {
  wellEl.querySelectorAll(".cell-button").forEach((el) => el.remove());
  const level = LEVELS[stageIndex];
  if (!level.buttons) return;
  for (const btn of level.buttons) {
    const { x, y } = cellPixel(btn.row, btn.col);
    const s = layout.cell * 0.42;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cell-button";
    b.dataset.row = String(btn.row);
    b.dataset.col = String(btn.col);
    b.dataset.color = btn.color;
    b.style.left = `${x + (layout.cell - s) / 2}px`;
    b.style.top = `${y + (layout.cell - s) / 2}px`;
    b.style.width = `${s}px`;
    b.style.height = `${s}px`;
    b.setAttribute("aria-label", `${btn.color} switch`);
    const pair = BTN_COLORS[btn.color] || BTN_COLORS.red;
    b.style.setProperty("--btn", pair[0]);
    b.style.setProperty("--btn-deep", pair[1]);
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      handleButtonPress(btn.row, btn.col);
    });
    wellEl.appendChild(b);
  }
  syncButtons(true);
}

function updateHud() {
  const level = LEVELS[stageIndex];
  const par = level.par || 0;
  scoreLabel.textContent = String(totalScore());
  levelLabel.textContent = `Lvl. ${level.id}`;
  const tone = moveCountTone(par, game.moves);
  movesLabel.className = "moves";
  if (gameOver) movesLabel.classList.add("move-over");
  else if (tone === "warn") movesLabel.classList.add("move-warn");
  else if (tone === "danger") movesLabel.classList.add("move-danger");
  const stars = starsText(starsForMoves(par, game.moves));
  const ratio = par > 0 ? `${game.moves}/${par}` : String(game.moves);
  movesLabel.innerHTML = `<span class="move-num">${ratio}</span> · <span class="stars">${stars}</span>`;
}

function renderBoard() {
  const level = LEVELS[stageIndex];
  const n = level.size;
  const budget = boardBudget();
  const geom = computeLayout(n, budget.w, budget.h);
  layout = { cell: geom.cell, gap: geom.gap, pad: geom.pad, n };
  const radius = Math.round(geom.pad * 0.85);
  boardEl.style.width = `${geom.inner + geom.pad * 2}px`;
  boardEl.style.height = `${geom.inner + geom.pad * 2}px`;
  boardEl.style.padding = `${geom.pad}px`;
  boardEl.style.borderRadius = `${radius}px`;
  wellEl.style.borderRadius = `${Math.max(8, Math.round(geom.pad * 0.42))}px`;
  paintBoard();
  placeHole();
  buildButtons();
  ballEl.style.transition = "none";
  ballShadowEl.style.transition = "none";
  placeBallAt(game.ball[0], game.ball[1], null, 0);
  updateHud();
}

function setTableTilt(dir, active) {
  const map = {
    up: { rx: TILT_NUDGE, ry: 0 },
    down: { rx: -TILT_NUDGE, ry: 0 },
    left: { rx: 0, ry: -TILT_NUDGE },
    right: { rx: 0, ry: TILT_NUDGE },
  };
  const t = active && dir && map[dir] ? map[dir] : { rx: 0, ry: 0 };
  boardTiltEl.style.setProperty("--tilt-rx", `${t.rx}deg`);
  boardTiltEl.style.setProperty("--tilt-ry", `${t.ry}deg`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spinForDir(dir) {
  return dir === "left" || dir === "up" ? -92 : 92;
}

async function animateRoll(path, dir) {
  const duration = Math.max(70, STEP_MS - path.length * 4);
  let spin = 0;
  for (let i = 1; i < path.length; i++) {
    const [r, c] = path[i];
    spin += spinForDir(dir);
    const easing = `transform ${duration}ms cubic-bezier(0.22, 0.85, 0.32, 1), opacity ${duration}ms ease`;
    ballEl.style.transition = easing;
    ballShadowEl.style.transition = easing;
    placeBallAt(r, c, dir, spin);
    await wait(duration);
  }
  const [fr, fc] = path[path.length - 1];
  ballEl.style.transition = "transform 120ms ease-out, opacity 120ms ease-out";
  ballShadowEl.style.transition = "transform 120ms ease-out, opacity 120ms ease-out";
  placeBallAt(fr, fc, null, spin);
}

function showGameOver() {
  const level = LEVELS[stageIndex];
  const par = level.par || 0;
  overlay.classList.remove("hidden");
  overlayTitle.textContent = "Out of moves";
  overlayMsg.textContent = par > 0 ? `Lvl. ${level.id} · ${game.moves}/${par}` : `Lvl. ${level.id}`;
  overlayBtn.textContent = "Retry";
  overlayBtn.onclick = () => {
    hideOverlay();
    game.reset();
    gameOver = false;
    renderBoard();
  };
}

function showWin(stars) {
  const level = LEVELS[stageIndex];
  const par = level.par || 0;
  overlay.classList.remove("hidden");
  overlayTitle.textContent = "Cleared!";
  overlayMsg.textContent = `Lvl. ${level.id} · ${game.moves}/${par} · ${starsText(stars)}`;
  overlayBtn.textContent = stageIndex < LEVELS.length - 1 ? "Next stage" : "From the start";
  overlayBtn.onclick = () => nextStage();
}

function hideOverlay() {
  overlay.classList.add("hidden");
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
  updateHud();
  showWin(stars);
}

async function handleButtonPress(row, col) {
  if (animating || game.won || gameOver) return;
  if (game.ball[0] !== row || game.ball[1] !== col) return;
  if (!game.pressButton()) return;
  animating = true;
  paintBoard();
  syncButtons(false);
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
  game.applyTiltResult(path, won, moved);
  paintBoard();
  syncButtons(false);
  updateHud();
  ballEl.style.transition = "none";
  ballShadowEl.style.transition = "none";
  placeBallAt(path[0][0], path[0][1], null, 0);
  await wait(80);
  if (path.length > 1) await animateRoll(path, dir);
  else await wait(90);
  await wait(120);
  setTableTilt(null, false);
  syncButtons(true);
  animating = false;
  handleAfterMove(won);
}

function indexFromLocation() {
  const hash = /^#(\d+)$/.exec(location.hash || "");
  const query = new URLSearchParams(location.search).get("stage");
  const raw = (hash && hash[1]) || query;
  if (!raw) return 0;
  const idx = LEVELS.findIndex((lv) => lv.id === Number(raw));
  return idx >= 0 ? idx : 0;
}

function loadStage(index) {
  stageIndex = Math.max(0, Math.min(index, LEVELS.length - 1));
  game = new Game(LEVELS[stageIndex]);
  gameOver = false;
  hideOverlay();
  const hash = `#${LEVELS[stageIndex].id}`;
  if (location.hash !== hash || location.search) history.replaceState(null, "", hash);
  renderBoard();
}

function nextStage() {
  hideOverlay();
  loadStage(stageIndex < LEVELS.length - 1 ? stageIndex + 1 : 0);
}

function resetStage() {
  if (animating) return;
  game.reset();
  gameOver = false;
  hideOverlay();
  renderBoard();
}

function buildStageList() {
  const cleared = getCleared();
  stageList.innerHTML = "";
  LEVELS.forEach((lv, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    const stars = getStars(lv.id);
    const meta = `${lv.size}×${lv.size}${stars ? " · " + starsText(stars) : ""}`;
    btn.innerHTML = `<span>Lvl. ${lv.id} · ${lv.name}</span><span class="stage-meta">${meta}</span>`;
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

document.querySelectorAll(".wood-control[data-dir]").forEach((btn) => {
  btn.addEventListener("click", () => handleTilt(btn.dataset.dir));
});

document.getElementById("btn-reset").addEventListener("click", () => resetStage());
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
document.getElementById("dialog-close").addEventListener("click", () => stageDialog.close());

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
  if (stageDialog.open) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === "r") {
    e.preventDefault();
    resetStage();
    return;
  }
  if (key === "n") {
    e.preventDefault();
    if (!animating) nextStage();
    return;
  }
  const dir = KEY_MAP[e.key] || KEY_MAP[key];
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
  "touchmove",
  (e) => {
    if (touchStart) e.preventDefault();
  },
  { passive: false }
);
boardEl.addEventListener(
  "touchend",
  (e) => {
    if (!touchStart || animating) {
      touchStart = null;
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    const minSwipe = 28;
    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;
    if (Math.abs(dx) > Math.abs(dy)) handleTilt(dx > 0 ? "right" : "left");
    else handleTilt(dy > 0 ? "down" : "up");
  },
  { passive: true }
);
boardEl.addEventListener("touchcancel", () => {
  touchStart = null;
});

document.addEventListener(
  "touchmove",
  (e) => {
    if (stageDialog.open && stageDialog.contains(e.target)) return;
    e.preventDefault();
  },
  { passive: false }
);
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());

window.addEventListener("hashchange", () => {
  if (animating) return;
  const idx = indexFromLocation();
  if (idx !== stageIndex) loadStage(idx);
});

function paintSky() {
  drawSky(skyEl);
}

paintSky();
loadStage(indexFromLocation());
setTableTilt(null, false);
requestAnimationFrame(() => renderBoard());

window.addEventListener("resize", () => {
  paintSky();
  if (!animating) renderBoard();
});

if (typeof ResizeObserver !== "undefined") {
  let framing = false;
  new ResizeObserver(() => {
    if (animating || framing) return;
    framing = true;
    renderBoard();
    framing = false;
  }).observe(boardWrapEl);
}
