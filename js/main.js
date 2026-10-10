import { LEVELS } from "./levels.js";
import { Game } from "./game.js";
import { drawSky } from "./playfield.js";
import { createView } from "./board3d.js";
import { BALLS, ballById } from "./balls.js";
import { BACKGROUNDS, CELEBRATIONS, TRAILS, backgroundById, celebrationById, trailById } from "./cosmetics.js";
import { detectLang, t, planetName, ballCopy, cosmeticCopy, lessonCopy } from "./i18n.js";
import { PLANET_ORDER, PLANET_BALL, themeById } from "./themes.js";

const STORAGE_KEY = "inthehole_cleared";
const STORAGE_STARS_PREFIX = "inthehole_stars_";
const STORAGE_LESSONS = "inthehole_lessons";
const STORAGE_SPENT = "inthehole_stars_spent";
const STORAGE_OWNED = "inthehole_balls_owned";
const STORAGE_EQUIPPED = "inthehole_ball_equipped";
const STORAGE_TRAILS = "inthehole_trails_owned";
const STORAGE_TRAIL = "inthehole_trail_equipped";
const STORAGE_BGS = "inthehole_bgs_owned";
const STORAGE_BG = "inthehole_bg_equipped";
const STORAGE_CELES = "inthehole_celes_owned";
const STORAGE_CELE = "inthehole_cele_equipped";

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
const storeEl = document.getElementById("store");
const storeList = document.getElementById("store-list");
const storeStars = document.getElementById("store-stars");
const storeConfirm = document.getElementById("store-confirm");
const storeConfirmText = document.getElementById("store-confirm-text");
const storeClose = document.getElementById("store-close");
const storeSpend = document.getElementById("store-spend");
const mapEl = document.getElementById("map");
const mapList = document.getElementById("map-list");
const settingsEl = document.getElementById("settings");

const view = createView(playfieldEl);

let lang = detectLang();
let stageIndex = 0;
let game = new Game(LEVELS[0]);
let animating = false;
let gameOver = false;
let lessonOpen = false;
let lessonQueue = [];
let pendingBuy = null;
let storeTab = "balls";
let overlayMode = null;
let overlayReward = null;
let overlayCoin = false;
let overlayStarsN = 0;

const LESSON_ORDER = ["sand", "ice", "oneway", "teleport", "glass", "gates", "mixed", "smog", "jelly", "magma", "collapse", "movers"];

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
function hasCollapse(level) {
  return (level.collapse || []).length > 0;
}
function hasMovers(level) {
  return (level.shifters || []).length > 0;
}
function hasJelly(level) {
  return (level.jelly || []).length > 0;
}
function hasMagma(level) {
  return (level.magma || []).length > 0;
}

function lessonsOn(level) {
  const present = {
    sand: hasSand(level),
    ice: hasIce(level),
    oneway: hasOneWay(level),
    teleport: hasTeleport(level),
    glass: hasGlass(level),
    gates: hasGates(level),
    smog: hasSmog(level),
    jelly: hasJelly(level),
    magma: hasMagma(level),
    collapse: hasCollapse(level),
    movers: hasMovers(level),
  };
  const count = Object.values(present).filter(Boolean).length;
  present.mixed = count >= 2;
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
    jelly: `<div class="toy toy-jelly"><span class="toy-ball"></span></div>`,
    magma: `<div class="toy toy-magma"><span class="toy-ball"></span></div>`,
    collapse: `<div class="toy toy-collapse"><span class="toy-pit"></span><span class="toy-ball"></span></div>`,
    movers: `<div class="toy toy-movers"><span class="toy-mover"></span><span class="toy-ball"></span></div>`,
  };
  return toys[id] || toys.mixed;
}

function showLessonCard(id) {
  const copy = lessonCopy(lang, id);
  if (!copy) return;
  lessonTitle.textContent = copy.title;
  lessonBody.textContent = copy.body;
  document.querySelector(".lesson-replay").textContent = t(lang, "replay");
  lessonBtn.textContent = t(lang, "got-it");
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
  lessonQueue = ids.filter((id) => lessonCopy(lang, id));
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

function earnedTotal() {
  let stars = 0;
  for (const lv of LEVELS) stars += getStars(lv.id);
  return stars;
}

function spentTotal() {
  const spent = parseInt(localStorage.getItem(STORAGE_SPENT) || "0", 10);
  return Number.isFinite(spent) && spent > 0 ? spent : 0;
}

function purse() {
  return Math.max(0, earnedTotal() - spentTotal());
}

function ownedIds() {
  const owned = new Set(["oak"]);
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_OWNED) || "[]");
    if (Array.isArray(raw)) {
      for (const id of raw) {
        if (BALLS.some((ball) => ball.id === id)) owned.add(id);
      }
    }
  } catch {
    /* keep the free ball */
  }
  return owned;
}

function writeOwned(owned) {
  const ids = [...owned].filter((id) => id !== "oak");
  localStorage.setItem(STORAGE_OWNED, JSON.stringify(ids));
}

function equippedId() {
  const id = localStorage.getItem(STORAGE_EQUIPPED) || "oak";
  return ownedIds().has(id) ? id : "oak";
}

const SHOP_TABS = {
  balls: { items: BALLS, free: "oak", ownedKey: STORAGE_OWNED, equipKey: STORAGE_EQUIPPED },
  trails: { items: TRAILS, free: "none", ownedKey: STORAGE_TRAILS, equipKey: STORAGE_TRAIL },
  bgs: { items: BACKGROUNDS, free: "planet", ownedKey: STORAGE_BGS, equipKey: STORAGE_BG },
  celes: { items: CELEBRATIONS, free: "burst", ownedKey: STORAGE_CELES, equipKey: STORAGE_CELE },
};

function catalogItem(tab, id) {
  if (tab === "balls") return ballById(id);
  if (tab === "trails") return trailById(id);
  if (tab === "bgs") return backgroundById(id);
  return celebrationById(id);
}

function ownedFor(tab) {
  const spec = SHOP_TABS[tab];
  const known = new Set(spec.items.map((item) => item.id));
  const owned = new Set([spec.free]);
  try {
    const raw = JSON.parse(localStorage.getItem(spec.ownedKey) || "[]");
    if (Array.isArray(raw)) {
      for (const id of raw) if (known.has(id)) owned.add(id);
    }
  } catch {
    /* keep the free item */
  }
  return owned;
}

function writeOwnedFor(tab, owned) {
  const spec = SHOP_TABS[tab];
  const ids = [...owned].filter((id) => id !== spec.free);
  localStorage.setItem(spec.ownedKey, JSON.stringify(ids));
}

function equippedFor(tab) {
  const spec = SHOP_TABS[tab];
  const id = localStorage.getItem(spec.equipKey) || spec.free;
  return ownedFor(tab).has(id) ? id : spec.free;
}

function itemCopy(tab, id) {
  if (tab === "balls") return ballCopy(lang, id);
  return cosmeticCopy(lang, tab, id);
}

function applyCosmetic(tab, id) {
  if (tab === "balls") view.setBall(id);
  else if (tab === "trails") view.setTrail(id);
  else if (tab === "bgs") paintSky();
  else view.setCelebration(id);
}

function storeOpen() {
  return !storeEl.hidden;
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

function planetOf(index) {
  return Math.floor(index / 12);
}

function planetCleared(p) {
  const cleared = getCleared();
  for (let i = 0; i < 12; i++) {
    const level = LEVELS[p * 12 + i];
    if (!level || !cleared.includes(level.id)) return false;
  }
  return true;
}

function planetUnlocked(p) {
  return p <= 0 || planetCleared(p - 1);
}

function canStepTo(index) {
  if (index < 0 || index >= LEVELS.length) return false;
  const dest = planetOf(index);
  if (dest === planetOf(stageIndex)) return true;
  return planetUnlocked(dest);
}

function maybeGrantPlanet(level) {
  const p = PLANET_ORDER.indexOf(level.planet);
  if (p < 0 || !planetCleared(p)) return null;
  const ballId = PLANET_BALL[level.planet];
  if (!ballId || ballId === "oak") return null;
  const owned = ownedIds();
  if (owned.has(ballId)) return null;
  owned.add(ballId);
  writeOwned(owned);
  return ballId;
}

function mapOpen() {
  return !mapEl.hidden;
}

function settingsOpen() {
  return !settingsEl.hidden;
}

function uiBlocked() {
  return storeOpen() || mapOpen() || settingsOpen() || lessonOpen;
}

function stageTitle(level, index) {
  const name = planetName(lang, level.planet || PLANET_ORDER[planetOf(index)]);
  return t(lang, "stage-label", { planet: name, n: (index % 12) + 1 });
}

function updateHud() {
  const level = LEVELS[stageIndex];
  const par = level.par || 0;
  const starsLeft = purse();
  scoreLabel.textContent = String(starsLeft);
  if (storeOpen()) storeStars.textContent = String(starsLeft);
  levelLabel.textContent = stageTitle(level, stageIndex);
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
  overlayMode = "lose";
  hideClearStars();
  overlay.classList.remove("hidden");
  overlayTitle.textContent = t(lang, "out");
  const label = stageTitle(level, stageIndex);
  overlayMsg.textContent = par > 0 ? `${label} · ${game.moves}/${par}` : label;
  overlayBtn.textContent = t(lang, "retry");
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

function showWin(stars, coinBonus, rewardBall) {
  const level = LEVELS[stageIndex];
  const par = level.par || 0;
  overlayMode = "win";
  overlayReward = rewardBall || null;
  overlayCoin = !!coinBonus;
  overlayStarsN = stars;
  spawnClearStars();
  overlay.classList.remove("hidden");
  overlayTitle.textContent = t(lang, "cleared");
  const label = stageTitle(level, stageIndex);
  let msg = coinBonus
    ? `${label} · ${game.moves}/${par} · ${t(lang, "coin-bonus")}`
    : `${label} · ${game.moves}/${par}`;
  if (rewardBall) {
    const copy = ballCopy(lang, rewardBall);
    msg += ` ${t(lang, "reward", { planet: planetName(lang, level.planet), ball: copy.name })}`;
  }
  overlayMsg.textContent = msg;
  showClearStars(stars);
  const more = stageIndex < LEVELS.length - 1 && canStepTo(stageIndex + 1);
  overlayBtn.textContent = more ? t(lang, "next") : t(lang, "map-back");
  overlayBtn.onclick = () => {
    if (more) nextStage();
    else {
      hideOverlay();
      showMap();
    }
  };
}

function hideOverlay() {
  overlay.classList.add("hidden");
  overlayMode = null;
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
  const reward = maybeGrantPlanet(level);
  updateHud();
  showWin(award.stars, award.coinBonus, reward);
}

function showHint() {
  if (uiBlocked() || animating || game.won || gameOver) return;
  clearHintUi();
  const route = game.hintRoute();
  if (!route) {
    document.getElementById("btn-reset").classList.add("is-hint");
    hintNote.hidden = false;
    hintNote.textContent = t(lang, "no-path");
    return;
  }
  const move = route.action;
  if (move === "press") {
    view.showHint("press", game.ball[0], game.ball[1], route);
    hintNote.hidden = false;
    hintNote.textContent = t(lang, "press");
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
  if (uiBlocked() || animating || game.won || gameOver) return;
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
  if (uiBlocked() || animating || game.won || gameOver) return;
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

function hasDeepLink() {
  if (/^#(\d+)$/.test(location.hash || "")) return true;
  return new URLSearchParams(location.search).has("stage");
}

function loadStage(index) {
  stageIndex = Math.max(0, Math.min(index, LEVELS.length - 1));
  game = new Game(LEVELS[stageIndex]);
  gameOver = false;
  hideOverlay();
  document.querySelector(".app").classList.remove("is-map");
  mapEl.hidden = true;
  const hash = `#${LEVELS[stageIndex].id}`;
  if (location.hash !== hash || location.search) history.replaceState(null, "", hash);
  renderBoard();
  paintSky();
  maybeAutoLesson();
}

function nextStage() {
  hideOverlay();
  if (stageIndex < LEVELS.length - 1 && canStepTo(stageIndex + 1)) loadStage(stageIndex + 1);
  else showMap();
}

function resetStage() {
  if (uiBlocked() || animating) return;
  game.reset();
  gameOver = false;
  hideOverlay();
  renderBoard();
}

function buildStageList() {
  const cleared = getCleared();
  const planet = planetOf(stageIndex);
  const start = planet * 12;
  document.querySelector("#stage-dialog h2").textContent = planetName(lang, LEVELS[start].planet);
  stageList.innerHTML = "";
  for (let i = start; i < start + 12 && i < LEVELS.length; i++) {
    const lv = LEVELS[i];
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    const stars = getStars(lv.id);
    const meta = `${lv.size}×${lv.size}${stars ? " · " + starsText(stars) : ""}`;
    btn.innerHTML = `<span>${stageTitle(lv, i)}</span><span class="stage-meta">${meta}</span>`;
    if (cleared.includes(lv.id)) btn.classList.add("cleared");
    if (i === stageIndex) btn.classList.add("current");
    btn.addEventListener("click", () => {
      loadStage(i);
      stageDialog.close();
    });
    li.appendChild(btn);
    stageList.appendChild(li);
  }
}

document.querySelectorAll(".arcade-btn[data-dir]").forEach((btn) => {
  btn.addEventListener("click", () => handleTilt(btn.dataset.dir));
});

document.getElementById("btn-reset").addEventListener("click", () => resetStage());
document.getElementById("btn-hint").addEventListener("click", () => showHint());
lessonButton.addEventListener("click", () => {
  if (uiBlocked() || animating) return;
  playLessonQueue(lessonsOn(LEVELS[stageIndex]));
});
lessonBtn.addEventListener("click", () => ackLesson());
document.getElementById("btn-prev").addEventListener("click", () => {
  if (!uiBlocked() && !animating && canStepTo(stageIndex - 1)) loadStage(stageIndex - 1);
});
document.getElementById("btn-next").addEventListener("click", () => {
  if (!uiBlocked() && !animating && canStepTo(stageIndex + 1)) loadStage(stageIndex + 1);
});
document.getElementById("btn-select").addEventListener("click", () => {
  if (uiBlocked()) return;
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
  if (e.key === "Escape") {
    if (settingsOpen()) {
      e.preventDefault();
      closeSettings();
      return;
    }
    if (storeOpen()) {
      e.preventDefault();
      if (!storeConfirm.hidden) cancelBuy();
      else closeStore();
      return;
    }
    if (mapOpen()) return;
  }
  if (storeOpen() || mapOpen() || settingsOpen()) return;
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
  if (uiBlocked() || stageDialog.open || !overlay.classList.contains("hidden")) return;
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
    if (storeOpen() && storeEl.contains(e.target)) return;
    if (mapOpen() && mapEl.contains(e.target)) return;
    if (settingsOpen() && settingsEl.contains(e.target)) return;
    e.preventDefault();
  },
  { passive: false }
);
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());

window.addEventListener("hashchange", () => {
  if (storeOpen() || settingsOpen() || lessonOpen || animating) return;
  if (!hasDeepLink()) {
    showMap();
    return;
  }
  const idx = indexFromLocation();
  if (idx !== stageIndex || mapOpen()) loadStage(idx);
});

function paintSky() {
  if (mapOpen()) {
    drawSky(skyEl, null);
    return;
  }
  const override = backgroundById(equippedFor("bgs"));
  drawSky(skyEl, override.sky || themeById(LEVELS[stageIndex].planet));
}

function renderStore() {
  const tab = SHOP_TABS[storeTab] ? storeTab : "balls";
  const spec = SHOP_TABS[tab];
  const owned = ownedFor(tab);
  const equipped = equippedFor(tab);
  const stars = purse();
  storeStars.textContent = String(stars);
  storeList.replaceChildren();
  for (const item of spec.items) {
    const li = document.createElement("li");
    li.className = "store-row" + (item.id === equipped ? " is-equipped" : "");
    const preview = document.createElement("span");
    preview.className = tab === "balls"
      ? `ball-preview ball-preview--${item.id}`
      : `shop-swatch shop-swatch--${tab}-${item.id}`;
    preview.setAttribute("aria-hidden", "true");
    const copy = document.createElement("span");
    copy.className = "store-copy";
    const copyText = itemCopy(tab, item.id);
    const name = document.createElement("strong");
    name.textContent = copyText.name;
    const price = document.createElement("em");
    price.textContent = item.price === 0 ? t(lang, "free") : `${item.price} ${t(lang, "stars")}`;
    const blurb = document.createElement("span");
    blurb.textContent = copyText.blurb;
    copy.append(name, price, blurb);
    li.append(preview, copy);
    if (item.id === equipped) {
      const state = document.createElement("span");
      state.className = "store-state";
      state.textContent = t(lang, "equipped");
      li.append(state);
    } else if (owned.has(item.id)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "store-act";
      btn.dataset.act = "equip";
      btn.dataset.id = item.id;
      btn.textContent = t(lang, "equip");
      li.append(btn);
    } else if (stars >= item.price) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "store-act store-act--buy";
      btn.dataset.act = "buy";
      btn.dataset.id = item.id;
      btn.textContent = `${t(lang, "buy")} ${item.price}`;
      li.append(btn);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "store-act";
      btn.disabled = true;
      btn.textContent = `${t(lang, "need")} ${item.price - stars}`;
      li.append(btn);
    }
    storeList.append(li);
  }
}

function openStore() {
  pendingBuy = null;
  storeConfirm.hidden = true;
  storeEl.hidden = false;
  renderStore();
  storeClose.focus();
}

function closeStore() {
  pendingBuy = null;
  storeConfirm.hidden = true;
  storeEl.hidden = true;
}

function askBuy(id) {
  const tab = storeTab;
  const item = catalogItem(tab, id);
  if (!item || item.id !== id || ownedFor(tab).has(item.id) || purse() < item.price || item.price <= 0) return;
  pendingBuy = { tab, id: item.id };
  storeConfirmText.textContent = t(lang, "spend-on", {
    price: item.price,
    name: itemCopy(tab, item.id).name,
  });
  storeConfirm.hidden = false;
  storeSpend.focus();
}

function cancelBuy() {
  pendingBuy = null;
  storeConfirm.hidden = true;
}

function confirmBuy() {
  const pending = pendingBuy;
  cancelBuy();
  if (!pending) return;
  const item = catalogItem(pending.tab, pending.id);
  if (!item || item.id !== pending.id || ownedFor(pending.tab).has(item.id) || purse() < item.price) {
    renderStore();
    return;
  }
  localStorage.setItem(STORAGE_SPENT, String(spentTotal() + item.price));
  const owned = ownedFor(pending.tab);
  owned.add(item.id);
  writeOwnedFor(pending.tab, owned);
  localStorage.setItem(SHOP_TABS[pending.tab].equipKey, item.id);
  applyCosmetic(pending.tab, item.id);
  updateHud();
  renderStore();
}

function equipOwned(id) {
  const tab = storeTab;
  if (!ownedFor(tab).has(id)) return;
  localStorage.setItem(SHOP_TABS[tab].equipKey, id);
  applyCosmetic(tab, id);
  updateHud();
  renderStore();
}

function selectStoreTab(tab) {
  if (!SHOP_TABS[tab]) return;
  storeTab = tab;
  document.querySelectorAll(".store-tabs button").forEach((btn) => {
    const on = btn.dataset.tab === tab;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  cancelBuy();
  renderStore();
}

document.getElementById("btn-store").addEventListener("click", () => {
  if (storeOpen()) closeStore();
  else openStore();
});
storeClose.addEventListener("click", () => closeStore());
storeSpend.addEventListener("click", () => confirmBuy());
document.getElementById("store-cancel").addEventListener("click", () => cancelBuy());
storeList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn || !storeList.contains(btn)) return;
  if (btn.dataset.act === "buy") askBuy(btn.dataset.id);
  else if (btn.dataset.act === "equip") equipOwned(btn.dataset.id);
});
document.querySelector(".store-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-tab]");
  if (!btn) return;
  selectStoreTab(btn.dataset.tab);
});

function renderMap() {
  document.getElementById("map-title").textContent = t(lang, "map-title");
  const cleared = new Set(getCleared());
  mapList.replaceChildren();
  PLANET_ORDER.forEach((id, p) => {
    const li = document.createElement("li");
    const open = planetUnlocked(p);
    const done = planetCleared(p);
    let stars = 0;
    for (let i = 0; i < 12; i++) stars += getStars(LEVELS[p * 12 + i].id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "map-planet" + (open ? "" : " is-locked") + (done ? " is-done" : "");
    btn.disabled = !open;
    const theme = themeById(id);
    btn.style.setProperty("--planet", theme.floor);
    btn.style.setProperty("--planet-edge", theme.sky0);
    const status = !open ? t(lang, "map-locked") : done ? t(lang, "map-done") : `${stars}/36`;
    btn.innerHTML = `<span class="map-orb"></span><span class="map-copy"><strong></strong><em></em></span>`;
    btn.querySelector("strong").textContent = planetName(lang, id);
    btn.querySelector("em").textContent = `${p + 1} · ${status}`;
    btn.addEventListener("click", () => {
      if (!planetUnlocked(p)) return;
      let idx = p * 12;
      let found = false;
      for (let i = 0; i < 12; i++) {
        if (!cleared.has(LEVELS[p * 12 + i].id)) {
          idx = p * 12 + i;
          found = true;
          break;
        }
      }
      if (!found) idx = p * 12 + 11;
      loadStage(idx);
    });
    li.append(btn);
    mapList.append(li);
  });
}

function showMap() {
  hideLesson();
  hideOverlay();
  if (stageDialog.open) stageDialog.close();
  document.querySelector(".app").classList.add("is-map");
  mapEl.hidden = false;
  if (location.hash || location.search) history.replaceState(null, "", location.pathname);
  renderMap();
  paintSky();
}

function openSettings() {
  settingsEl.hidden = false;
  document.querySelectorAll(".lang-row button").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.lang === lang);
  });
}

function closeSettings() {
  settingsEl.hidden = true;
}

function applyLang() {
  document.documentElement.lang = lang;
  document.getElementById("btn-store").textContent = t(lang, "shop");
  document.getElementById("btn-gear").setAttribute("aria-label", t(lang, "settings"));
  document.getElementById("map-settings").setAttribute("aria-label", t(lang, "settings"));
  lessonButton.textContent = t(lang, "how");
  document.querySelector(".lesson-replay").textContent = t(lang, "replay");
  lessonBtn.textContent = t(lang, "got-it");
  document.getElementById("store-title").textContent = t(lang, "shop-title");
  document.querySelectorAll(".store-tabs button").forEach((btn) => {
    btn.textContent = t(lang, `tab-${btn.dataset.tab}`);
  });
  document.querySelector(".store-balance").lastChild.textContent = ` ${t(lang, "stars")}`;
  storeClose.setAttribute("aria-label", t(lang, "close"));
  storeSpend.textContent = t(lang, "spend");
  document.getElementById("store-cancel").textContent = t(lang, "not-now");
  document.getElementById("dialog-close").textContent = t(lang, "close");
  document.getElementById("dialog-map").textContent = t(lang, "map-back");
  document.getElementById("settings-title").textContent = t(lang, "settings");
  document.getElementById("lang-label").textContent = t(lang, "language");
  document.getElementById("settings-close").textContent = t(lang, "close");
  document.querySelector(".dpad-up .face-caption").textContent = t(lang, "up");
  document.querySelector(".dpad-down .face-caption").textContent = t(lang, "down");
  document.querySelector(".dpad-left .face-caption").textContent = t(lang, "left");
  document.querySelector(".dpad-right .face-caption").textContent = t(lang, "right");
  document.querySelector(".retry-btn .face-caption").textContent = t(lang, "retry");
  document.getElementById("btn-reset").setAttribute("aria-label", t(lang, "retry"));
  document.getElementById("btn-prev").setAttribute("aria-label", t(lang, "prev"));
  document.getElementById("btn-next").setAttribute("aria-label", t(lang, "next"));
  document.getElementById("btn-hint").setAttribute("aria-label", t(lang, "hint"));
  if (lessonOpen && lessonQueue[0]) showLessonCard(lessonQueue[0]);
  if (!storeEl.hidden) renderStore();
  if (!mapEl.hidden) renderMap();
  if (stageDialog.open) buildStageList();
  updateHud();
  paintSky();
  if (overlayMode === "win") showWin(overlayStarsN, overlayCoin, overlayReward);
  else if (overlayMode === "lose") showGameOver();
}

function setLang(next) {
  lang = next === "ko" ? "ko" : "en";
  try {
    localStorage.setItem("inthehole_lang", lang);
  } catch {
    /* keep the session language */
  }
  applyLang();
  if (settingsOpen()) openSettings();
}

document.getElementById("btn-gear").addEventListener("click", () => {
  if (storeOpen() || lessonOpen || animating) return;
  openSettings();
});
document.getElementById("map-settings").addEventListener("click", () => openSettings());
document.getElementById("settings-close").addEventListener("click", () => closeSettings());
document.querySelectorAll(".lang-row button").forEach((btn) => {
  btn.addEventListener("click", () => setLang(btn.dataset.lang));
});
document.getElementById("dialog-map").addEventListener("click", () => {
  stageDialog.close();
  showMap();
});

applyLang();
view.setBall(equippedId());
view.setTrail(equippedFor("trails"));
view.setCelebration(equippedFor("celes"));
if (hasDeepLink()) loadStage(indexFromLocation());
else {
  stageIndex = 0;
  game = new Game(LEVELS[0]);
  renderBoard();
  showMap();
}
requestAnimationFrame(() => view.resize());

window.addEventListener("resize", () => {
  paintSky();
  view.resize();
});

if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => view.resize()).observe(boardWrapEl);
}
