import { LEVELS } from "./levels.js";
import { Game } from "./game.js";
import { drawSky } from "./playfield.js";
import { createView } from "./board3d.js";

const STORAGE_KEY = "inthehole_cleared";
const STORAGE_STARS_PREFIX = "inthehole_stars_";

const skyEl = document.getElementById("sky");
const boardWrapEl = document.querySelector(".board-wrap");
const playfieldEl = document.getElementById("playfield");
const scoreLabel = document.getElementById("score-label");
const levelLabel = document.getElementById("btn-select");
const movesLabel = document.getElementById("moves-label");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMsg = document.getElementById("overlay-msg");
const overlayBtn = document.getElementById("overlay-btn");
const stageDialog = document.getElementById("stage-dialog");
const stageList = document.getElementById("stage-list");

const view = createView(playfieldEl);

let stageIndex = 0;
let game = new Game(LEVELS[0]);
let animating = false;
let gameOver = false;

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
  view.resize();
  view.setStage(LEVELS[stageIndex], game);
  updateHud();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function spawnClearStars() {
  overlay.querySelectorAll(".pop-star").forEach((el) => el.remove());
  const colors = ["#ffe14a", "#ffffff", "#ff5b9a", "#7dfff0", "#c44dff", "#ffd23a"];
  for (let i = 0; i < 16; i++) {
    const star = document.createElement("span");
    star.className = "pop-star";
    star.textContent = "★";
    star.style.left = `${6 + Math.random() * 88}%`;
    star.style.top = `${22 + Math.random() * 58}%`;
    star.style.color = colors[i % colors.length];
    star.style.fontSize = `${1.4 + Math.random() * 1.3}rem`;
    star.style.animationDelay = `${Math.random() * 0.12}s`;
    overlay.appendChild(star);
  }
}

function showWin(stars) {
  const level = LEVELS[stageIndex];
  const par = level.par || 0;
  spawnClearStars();
  overlay.classList.remove("hidden");
  overlayTitle.textContent = "Cleared!";
  overlayMsg.textContent = `Lvl. ${level.id} · ${game.moves}/${par} · ${starsText(stars)}`;
  overlayBtn.textContent = stageIndex < LEVELS.length - 1 ? "Next stage" : "From the start";
  overlayBtn.onclick = () => nextStage();
}

function hideOverlay() {
  overlay.classList.add("hidden");
  overlay.querySelectorAll(".pop-star").forEach((el) => el.remove());
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
  view.dipButton(row, col);
  view.sync(game, { ready: false });
  updateHud();
  await wait(160);
  animating = false;
  handleAfterMove(game.won);
}

async function handleTilt(dir) {
  if (animating || game.won || gameOver) return;
  const { path, moved, won } = game.simulateTilt(dir);
  view.nudge(dir);
  if (!moved) {
    view.bump(1);
    await wait(280);
    view.nudge(null);
    return;
  }
  animating = true;
  game.applyTiltResult(path, won, moved);
  view.sync(game, { ready: false });
  updateHud();
  await view.roll(path, dir, won);
  if (!won) view.bump(path.length > 1 ? 0.32 : 0.7);
  view.nudge(null);
  if (won) {
    view.celebrate(path[path.length - 1]);
    await wait(360);
  }
  view.sync(game, { ready: true });
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

document.querySelectorAll(".arcade-btn[data-dir]").forEach((btn) => {
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

let pointer = null;
playfieldEl.addEventListener("pointerdown", (e) => {
  if (stageDialog.open || !overlay.classList.contains("hidden")) return;
  pointer = { x: e.clientX, y: e.clientY, id: e.pointerId };
  playfieldEl.setPointerCapture?.(e.pointerId);
});
playfieldEl.addEventListener("pointerup", (e) => {
  if (!pointer || pointer.id !== e.pointerId) return;
  const dx = e.clientX - pointer.x;
  const dy = e.clientY - pointer.y;
  pointer = null;
  if (animating) return;
  if (Math.hypot(dx, dy) < 28) {
    const hit = view.pick(e.clientX, e.clientY);
    if (hit) handleButtonPress(hit.row, hit.col);
    return;
  }
  if (Math.abs(dx) > Math.abs(dy)) handleTilt(dx > 0 ? "right" : "left");
  else handleTilt(dy > 0 ? "down" : "up");
});
playfieldEl.addEventListener("pointercancel", () => {
  pointer = null;
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
requestAnimationFrame(() => view.resize());

window.addEventListener("resize", () => {
  paintSky();
  view.resize();
});

if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => view.resize()).observe(boardWrapEl);
}
