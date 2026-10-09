import { LEVELS } from "./levels.js";
import { Game } from "./game.js";
import { drawSky } from "./playfield.js";
import { createView } from "./board3d.js";

const STORAGE_KEY = "inthehole_cleared";
const STORAGE_STARS_PREFIX = "inthehole_stars_";
const STORAGE_LESSONS = "inthehole_lessons";

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
const hintNote = document.getElementById("hint-note");
const lessonEl = document.getElementById("lesson");
const lessonTitle = document.getElementById("lesson-title");
const lessonArt = document.getElementById("lesson-art");
const lessonBody = document.getElementById("lesson-body");
const lessonBtn = document.getElementById("lesson-btn");
const lessonButton = document.getElementById("btn-lesson");

const view = createView(playfieldEl);

let stageIndex = 0;
let game = new Game(LEVELS[0]);
let animating = false;
let gameOver = false;
let lessonOpen = false;
let lessonQueue = [];

const LESSON_COPY = {
  sand: {
    title: "Sand",
    body: "Sand stops the ball the moment it rolls in. That tilt ends on the sand square.",
  },
  ice: {
    title: "Ice",
    body: "On ice the ball keeps sliding. It stops on the first normal square after the ice, unless a wall, sand, or the hole stops it sooner. A first glass hit still cracks, but on ice it does not stop the ball.",
  },
  oneway: {
    title: "One-way door",
    body: "The arrow is a door in the floor edge. The ball can cross it only in the arrow's direction.",
  },
  teleport: {
    title: "Teleport holes",
    body: "The two purple holes are a pair. Roll into one and you come out of the other, still moving the same way.",
  },
  glass: {
    title: "Glass",
    body: "The first hit cracks the pane and stops the ball. Hit it again and it shatters, and the ball rolls through.",
  },
  gates: {
    title: "Switches",
    body: "Roll onto the button. The wall with the same pattern sinks open. Until you do, that wall blocks the ball.",
  },
  mixed: {
    title: "Glass and switches",
    body: "This board has both. Crack the glass on the second hit, and press the matching button, or the way stays shut.",
  },
  smog: {
    title: "Smog",
    body: "Fog hides the walls on that square. It clears on every square the ball rolls through. The path itself does not change.",
  },
  coins: {
    title: "Coins",
    body: "Roll over every coin for one extra star. The hole still clears the stage. Three stars stay three, and the clear screen says coin bonus.",
  },
  collapse: {
    title: "Collapsing floor",
    body: "A thin square crumbles after the ball leaves it, and also when a tilt ends there. You cannot roll onto it again.",
  },
  movers: {
    title: "Moving walls",
    body: "The purple bar switches to its other edge after every tilt that moves the ball. A bump that goes nowhere leaves it where it is.",
  },
};

const LESSON_ORDER = ["sand", "ice", "oneway", "teleport", "glass", "gates", "mixed", "smog", "coins", "collapse", "movers"];

function rowHas(grid) {
  return grid.some((row) => row.some(Boolean));
}

function hasGlass(level) {
  return rowHas(level.hGlass) || rowHas(level.vGlass);
}

function hasGates(level) {
  return (level.buttons || []).length > 0;
}

function hasSand(level) {
  return (level.sand || []).length > 0;
}
function hasIce(level) {
  return (level.ice || []).length > 0;
}
function hasOneWay(level) {
  return (level.oneWay || []).length > 0;
}
function hasTeleport(level) {
  return (level.teleports || []).length > 0;
}
function hasSmog(level) {
  return (level.smog || []).length > 0;
}
function hasCoins(level) {
  return (level.coins || []).length > 0;
}
function hasCollapse(level) {
  return (level.collapse || []).length > 0;
}
function hasMovers(level) {
  return (level.shifters || []).length > 0;
}

function lessonsOn(level) {
  const present = {
    sand: hasSand(level),
    ice: hasIce(level),
    oneway: hasOneWay(level),
    teleport: hasTeleport(level),
    glass: hasGlass(level),
    gates: hasGates(level),
    mixed: hasGlass(level) && hasGates(level),
    smog: hasSmog(level),
    coins: hasCoins(level),
    collapse: hasCollapse(level),
    movers: hasMovers(level),
  };
  return LESSON_ORDER.filter((id) => present[id]);
}

let debuts = null;
function debutIndex() {
  if (debuts) return debuts;
  debuts = {};
  LEVELS.forEach((lv, i) => {
    for (const id of lessonsOn(lv)) {
      if (debuts[id] == null) debuts[id] = i;
    }
  });
  return debuts;
}

function seenLessons() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_LESSONS) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function rememberLesson(id) {
  const seen = seenLessons();
  if (seen.includes(id)) return;
  seen.push(id);
  localStorage.setItem(STORAGE_LESSONS, JSON.stringify(seen));
}

function artHtml(id) {
  const toys = {
    sand: `<div class="toy toy-sand"><span class="toy-sand"></span><span class="toy-ball"></span></div>`,
    ice: `<div class="toy toy-ice"><span class="toy-ice"></span><span class="toy-ball"></span></div>`,
    oneway: `<div class="toy toy-oneway"><span class="toy-arrow"></span><span class="toy-ball"></span></div>`,
    teleport: `<div class="toy toy-teleport"><span class="toy-pad"></span><span class="toy-pad toy-pad-b"></span><span class="toy-ball"></span></div>`,
    glass: `<div class="toy toy-glass"><span class="toy-ball"></span><span class="toy-pane"><span class="toy-crack"></span></span><span class="toy-shard"></span><span class="toy-shard"></span><span class="toy-shard"></span><span class="toy-shard"></span></div>`,
    gates: `<div class="toy toy-gate"><span class="toy-wall"></span><span class="toy-switch"></span><span class="toy-ball"></span></div>`,
    mixed: `<div class="toy toy-mix"><span class="toy-pane"><span class="toy-crack"></span></span><span class="toy-wall"></span><span class="toy-switch"></span><span class="toy-ball"></span></div>`,
    smog: `<div class="toy toy-smog"><span class="toy-fog"></span><span class="toy-ball"></span></div>`,
    coins: `<div class="toy toy-coins"><span class="toy-coin"></span><span class="toy-coin toy-coin-b"></span><span class="toy-ball"></span></div>`,
    collapse: `<div class="toy toy-collapse"><span class="toy-pit"></span><span class="toy-ball"></span></div>`,
    movers: `<div class="toy toy-movers"><span class="toy-mover"></span><span class="toy-ball"></span></div>`,
  };
  return toys[id] || toys.mixed;
}

function showLessonCard(id) {
  const copy = LESSON_COPY[id];
  lessonTitle.textContent = copy.title;
  lessonBody.textContent = copy.body;
  lessonArt.innerHTML = artHtml(id);
  lessonEl.hidden = false;
  lessonOpen = true;
}

function hideLesson() {
  lessonEl.hidden = true;
  lessonOpen = false;
  lessonQueue = [];
  lessonArt.innerHTML = "";
}

function playLessonQueue(ids) {
  lessonQueue = ids.filter((id) => LESSON_COPY[id]);
  if (!lessonQueue.length) {
    hideLesson();
    return;
  }
  showLessonCard(lessonQueue[0]);
}

function ackLesson() {
  const id = lessonQueue[0];
  if (id) rememberLesson(id);
  lessonQueue.shift();
  if (lessonQueue.length) showLessonCard(lessonQueue[0]);
  else hideLesson();
}

function updateLessonButton() {
  lessonButton.hidden = lessonsOn(LEVELS[stageIndex]).length === 0;
}

function maybeAutoLesson() {
  const first = debutIndex();
  const seen = new Set(seenLessons());
  const ids = LESSON_ORDER.filter((id) => first[id] === stageIndex && !seen.has(id));
  if (ids.length) playLessonQueue(ids);
  else hideLesson();
  updateLessonButton();
}

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

function earnedStars() {
  const par = LEVELS[stageIndex].par || 0;
  const base = starsForMoves(par, game.moves);
  if (base <= 0 || !game.allCoins()) return { stars: base, coinBonus: false };
  if (base >= 3) return { stars: 3, coinBonus: true };
  return { stars: base + 1, coinBonus: true };
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
  const stars = starsText(earnedStars().stars);
  const ratio = par > 0 ? `${game.moves}/${par}` : String(game.moves);
  movesLabel.innerHTML = `<span class="move-num">${ratio}</span> · <span class="stars">${stars}</span>`;
}

function clearHintUi() {
  view.clearHint();
  document.querySelectorAll(".is-hint").forEach((el) => el.classList.remove("is-hint"));
  hintNote.hidden = true;
  hintNote.textContent = "";
}

function renderBoard() {
  clearHintUi();
  view.resize();
  view.setStage(LEVELS[stageIndex], game);
  updateHud();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const overlayStars = document.getElementById("overlay-stars");

function showClearStars(count) {
  overlayStars.hidden = false;
  const stars = overlayStars.querySelectorAll(".clear-star");
  stars.forEach((el) => el.classList.remove("is-on"));
  requestAnimationFrame(() => {
    stars.forEach((el, i) => {
      if (i < count) el.classList.add("is-on");
    });
  });
}

function hideClearStars() {
  overlayStars.hidden = true;
  overlayStars.querySelectorAll(".clear-star").forEach((el) => el.classList.remove("is-on"));
}

function showGameOver() {
  const level = LEVELS[stageIndex];
  const par = level.par || 0;
  hideClearStars();
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

function showWin(stars, coinBonus) {
  const level = LEVELS[stageIndex];
  const par = level.par || 0;
  spawnClearStars();
  overlay.classList.remove("hidden");
  overlayTitle.textContent = "Cleared!";
  overlayMsg.textContent = coinBonus
    ? `Lvl. ${level.id} · ${game.moves}/${par} · coin bonus`
    : `Lvl. ${level.id} · ${game.moves}/${par}`;
  showClearStars(stars);
  overlayBtn.textContent = stageIndex < LEVELS.length - 1 ? "Next stage" : "From the start";
  overlayBtn.onclick = () => nextStage();
}

function hideOverlay() {
  overlay.classList.add("hidden");
  overlay.querySelectorAll(".pop-star").forEach((el) => el.remove());
  hideClearStars();
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
  const award = earnedStars();
  if (award.stars <= 0) {
    gameOver = true;
    updateHud();
    showGameOver();
    return;
  }
  markCleared(level.id);
  saveStars(level.id, award.stars);
  updateHud();
  showWin(award.stars, award.coinBonus);
}

function showHint() {
  if (lessonOpen || animating || game.won || gameOver) return;
  clearHintUi();
  const route = game.hintRoute();
  if (!route) {
    document.getElementById("btn-reset").classList.add("is-hint");
    hintNote.hidden = false;
    hintNote.textContent = "No path — Retry";
    return;
  }
  const move = route.action;
  if (move === "press") {
    view.showHint("press", game.ball[0], game.ball[1], route);
    hintNote.hidden = false;
    hintNote.textContent = "Press the switch";
    return;
  }
  view.showHint(move, game.ball[0], game.ball[1], route);
  const btn = document.querySelector(`.arcade-btn[data-dir="${move}"]`);
  if (btn) btn.classList.add("is-hint");
}

function snapshotGlass(state) {
  return {
    hs: state.hGlassStressed.map((row) => row.slice()),
    vs: state.vGlassStressed.map((row) => row.slice()),
  };
}

function cracksSince(before, state) {
  const out = [];
  const scan = (axis, prev, stress, alive) => {
    for (let r = 0; r < stress.length; r++) {
      for (let c = 0; c < stress[r].length; c++) {
        if (stress[r][c] && !(prev[r] && prev[r][c]) && alive[r][c]) out.push({ axis, r, c });
      }
    }
  };
  scan("h", before.hs, state.hGlassStressed, state.hGlass);
  scan("v", before.vs, state.vGlassStressed, state.vGlass);
  return out;
}

async function handleButtonPress(row, col) {
  if (lessonOpen || animating || game.won || gameOver) return;
  if (game.ball[0] !== row || game.ball[1] !== col) return;
  clearHintUi();
  if (!game.pressButton()) return;
  animating = true;
  view.dipButton(row, col);
  view.sync(game, { ready: false, animateGates: true });
  updateHud();
  await wait(280);
  animating = false;
  handleAfterMove(game.won);
}

async function handleTilt(dir) {
  if (lessonOpen || animating || game.won || gameOver) return;
  clearHintUi();
  const glassBefore = snapshotGlass(game);
  const { path, moved, won, glassBroken } = game.simulateTilt(dir);
  const cracked = cracksSince(glassBefore, game);
  view.nudge(dir);
  if (!moved) {
    view.bump(0.45);
    await wait(240);
    view.nudge(null);
    return;
  }
  animating = true;
  game.applyTiltResult(path, won, moved);
  view.sync(game, { ready: false, skipGlass: true, skipGates: true, adoptReveal: false, skipShift: true });
  view.armGateOpen(game);
  updateHud();
  await view.roll(path, dir, won, { cracked, broken: glassBroken });
  if (!won) view.bump(path.length > 1 ? 0.16 : 0.32);
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
  maybeAutoLesson();
}

function nextStage() {
  hideOverlay();
  loadStage(stageIndex < LEVELS.length - 1 ? stageIndex + 1 : 0);
}

function resetStage() {
  if (lessonOpen || animating) return;
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
document.getElementById("btn-hint").addEventListener("click", () => showHint());
lessonButton.addEventListener("click", () => {
  if (lessonOpen || animating) return;
  playLessonQueue(lessonsOn(LEVELS[stageIndex]));
});
lessonBtn.addEventListener("click", () => ackLesson());
document.getElementById("btn-prev").addEventListener("click", () => {
  if (!lessonOpen && !animating) loadStage(stageIndex - 1);
});
document.getElementById("btn-next").addEventListener("click", () => {
  if (!lessonOpen && !animating) loadStage(stageIndex + 1);
});
document.getElementById("btn-select").addEventListener("click", () => {
  if (lessonOpen) return;
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
    if (!lessonOpen && !animating) nextStage();
    return;
  }
  if (key === "?") {
    e.preventDefault();
    if (lessonOpen) return;
    const lessons = lessonsOn(LEVELS[stageIndex]);
    if (e.shiftKey && lessons.length) {
      playLessonQueue(lessons);
      return;
    }
    showHint();
    return;
  }
  const dir = KEY_MAP[e.key] || KEY_MAP[key];
  if (!dir) return;
  e.preventDefault();
  handleTilt(dir);
});

let pointer = null;
playfieldEl.addEventListener("pointerdown", (e) => {
  if (lessonOpen || stageDialog.open || !overlay.classList.contains("hidden")) return;
  pointer = { x: e.clientX, y: e.clientY, id: e.pointerId };
  playfieldEl.setPointerCapture?.(e.pointerId);
});
playfieldEl.addEventListener("pointerup", (e) => {
  if (!pointer || pointer.id !== e.pointerId) return;
  const dx = e.clientX - pointer.x;
  const dy = e.clientY - pointer.y;
  pointer = null;
  if (lessonOpen || animating) return;
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
  if (lessonOpen || animating) return;
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
