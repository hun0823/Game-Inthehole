import { LEVELS } from "./levels.js";
import { Game } from "./game.js";
import { drawSky } from "./playfield.js";
import { createView } from "./board3d.js";
import { createConstellation, mapLayout } from "./constellation.js";
import { shotBall, shotGoal } from "./showcase.js";
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
const overlayRetry = document.getElementById("overlay-retry");
const overlayKicker = document.getElementById("overlay-kicker");
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
const mapTrack = document.getElementById("constellation-track");
const mapScroll = document.getElementById("constellation-scroll");
const mapStars = document.getElementById("map-stars");
const mapStarbox = document.getElementById("map-starbox");
const constellationEl = document.querySelector(".constellation");
const rewardReveal = document.getElementById("reward-reveal");
const rewardKicker = document.getElementById("reward-kicker");
const rewardBallImg = document.getElementById("reward-ball");
const rewardGoalImg = document.getElementById("reward-goal");
const rewardName = document.getElementById("reward-name");
const settingsEl = document.getElementById("settings");

const view = createView(playfieldEl);
const mapView = createConstellation(document.getElementById("constellation"));

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
let listPlanet = 0;
let zooming = false;

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
  if (mapStars) mapStars.textContent = String(starsLeft);
  const starLabel = `${starsLeft} ${t(lang, "stars")}`;
  document.getElementById("btn-store").setAttribute("aria-label", starLabel);
  if (mapStarbox) mapStarbox.setAttribute("aria-label", starLabel);
  if (storeOpen()) storeStars.textContent = String(starsLeft);
  levelLabel.textContent = stageTitle(level, stageIndex);
  const tone = moveCountTone(par, game.moves);
  movesLabel.className = "moves";
  if (gameOver) movesLabel.classList.add("move-over");
  else if (tone === "warn") movesLabel.classList.add("move-warn");
  else if (tone === "danger") movesLabel.classList.add("move-danger");
  const stars = starsText(earnedStars().stars);
  const ratio = par > 0 ? `${game.moves}/${par}` : String(game.moves);
  movesLabel.replaceChildren();
  const hudStars = document.createElement("span");
  hudStars.className = "hud-stars";
  hudStars.textContent = stars;
  const pill = document.createElement("span");
  pill.className = "move-pill";
  const num = document.createElement("span");
  num.className = "move-num";
  num.textContent = ratio;
  pill.append(num);
  movesLabel.append(hudStars, pill);
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

function hideReward() {
  rewardReveal.hidden = true;
}

function showFinaleReward(level) {
  if (stageIndex % 12 !== 11) {
    hideReward();
    return;
  }
  const ballId = PLANET_BALL[level.planet] || "oak";
  const copy = ballCopy(lang, ballId);
  rewardReveal.hidden = false;
  rewardKicker.textContent = t(lang, "reward-kicker");
  rewardName.textContent = copy.name;
  rewardBallImg.alt = copy.name;
  rewardGoalImg.alt = copy.name;
  shotBall(ballId, 168).then((url) => {
    rewardBallImg.src = url;
  });
  shotGoal(ballId, 168).then((url) => {
    rewardGoalImg.src = url;
  });
}

function replayStage() {
  hideOverlay();
  game.reset();
  gameOver = false;
  renderBoard();
}

function showGameOver() {
  const level = LEVELS[stageIndex];
  const par = level.par || 0;
  overlayMode = "lose";
  hideClearStars();
  hideReward();
  overlay.classList.remove("hidden", "is-win");
  overlay.classList.add("is-lose");
  overlayKicker.textContent = stageTitle(level, stageIndex);
  overlayTitle.textContent = t(lang, "out");
  overlayMsg.textContent = par > 0 ? `${game.moves}/${par}` : String(game.moves);
  overlayBtn.textContent = t(lang, "retry");
  overlayBtn.onclick = () => replayStage();
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
  overlay.classList.remove("hidden", "is-lose");
  overlay.classList.add("is-win");
  const label = stageTitle(level, stageIndex);
  overlayKicker.textContent = label;
  overlayTitle.textContent = t(lang, "cleared");
  const perfect = par > 0 && game.moves <= par;
  overlayMsg.textContent = perfect
    ? `${t(lang, "optimal")} ${game.moves}/${par}`
    : (par > 0 ? `${game.moves}/${par}` : String(game.moves));
  overlayRetry.textContent = t(lang, "retry");
  overlayRetry.onclick = () => replayStage();
  showFinaleReward(level);
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
  overlay.classList.remove("is-win", "is-lose");
  overlayMode = null;
  overlay.querySelectorAll(".pop-star").forEach((el) => el.remove());
  hideClearStars();
  hideReward();
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
  document.body.classList.remove("map-open");
  mapEl.hidden = true;
  mapView.stop();
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

function planetProgress(p) {
  const cleared = getCleared();
  let n = 0;
  for (let i = 0; i < 12; i++) {
    const level = LEVELS[p * 12 + i];
    if (level && cleared.includes(level.id)) n += 1;
  }
  return n;
}

function planetStars(p) {
  let n = 0;
  for (let i = 0; i < 12; i++) {
    const level = LEVELS[p * 12 + i];
    if (!level) continue;
    n += Math.max(0, Math.min(3, getStars(level.id)));
  }
  return n;
}

function focusPlanet() {
  const n = PLANET_ORDER.length;
  for (let i = 0; i < n; i++) {
    if (!planetUnlocked(i)) return Math.max(0, i - 1);
    if (!planetCleared(i)) return i;
  }
  return n - 1;
}

function segmentKind(i) {
  if (planetCleared(i)) return "cleared";
  if (planetUnlocked(i)) return "progress";
  return "locked";
}

function openStageList(planetIndex) {
  listPlanet = planetIndex;
  buildStageList();
  if (!stageDialog.open) stageDialog.showModal();
}

function buildStageList() {
  const cleared = getCleared();
  const planet = listPlanet;
  const start = planet * 12;
  const theme = themeById(LEVELS[start].planet);
  stageDialog.style.setProperty("--dlg", theme.sky0);
  stageDialog.style.setProperty("--dlg-deep", theme.sky2);
  stageDialog.style.setProperty("--dlg-floor", theme.floor);
  document.querySelector("#stage-dialog h2").textContent = planetName(lang, LEVELS[start].planet);
  stageList.replaceChildren();
  for (let i = start; i < start + 12 && i < LEVELS.length; i++) {
    const lv = LEVELS[i];
    const li = document.createElement("li");
    const finale = i % 12 === 11;
    if (finale) li.classList.add("is-finale");
    const btn = document.createElement("button");
    btn.type = "button";
    const stars = getStars(lv.id);
    const meta = `${lv.size}×${lv.size}${stars ? " · " + starsText(stars) : ""}`;
    const title = document.createElement("span");
    title.textContent = finale ? `${stageTitle(lv, i)} · ${t(lang, "finale")}` : stageTitle(lv, i);
    const metaEl = document.createElement("span");
    metaEl.className = "stage-meta";
    metaEl.textContent = meta;
    btn.append(title, metaEl);
    if (cleared.includes(lv.id)) btn.classList.add("cleared");
    if (i === stageIndex) btn.classList.add("current");
    btn.addEventListener("click", () => {
      loadStage(i);
      stageDialog.close();
    });
    li.append(btn);
    if (finale) {
      const ballId = PLANET_BALL[lv.planet] || "oak";
      const copy = ballCopy(lang, ballId);
      const set = document.createElement("div");
      set.className = "finale-set";
      const ballImg = document.createElement("img");
      const goalImg = document.createElement("img");
      ballImg.alt = copy.name;
      goalImg.alt = copy.name;
      const caption = document.createElement("span");
      caption.className = "finale-copy";
      const strong = document.createElement("strong");
      strong.textContent = `${ballCopy("ko", ballId).name} · ${ballCopy("en", ballId).name}`;
      const em = document.createElement("em");
      em.textContent = t(lang, "finale");
      caption.append(strong, em);
      set.append(ballImg, goalImg, caption);
      li.append(set);
      shotBall(ballId, 112).then((url) => {
        ballImg.src = url;
      });
      shotGoal(ballId, 112).then((url) => {
        goalImg.src = url;
      });
    }
    stageList.append(li);
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
  openStageList(planetOf(stageIndex));
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

const SVG_NS = "http://www.w3.org/2000/svg";
let pinMapToFocus = true;

function svgEl(name, attrs) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

function buildSpaceStars() {
  const host = document.getElementById("space-stars");
  if (!host || host.childElementCount) return;
  for (let i = 0; i < 42; i++) {
    const star = document.createElement("span");
    star.className = "space-star";
    star.style.left = `${(i * 53 + 7) % 100}%`;
    star.style.top = `${(i * 37 + 11) % 100}%`;
    const size = 1.6 + (i % 4) * 0.85;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.animationDelay = `${(i % 10) * 0.28}s`;
    star.style.animationDuration = `${2.4 + (i % 5) * 0.4}s`;
    host.append(star);
  }
}

function lockGraphic() {
  const svg = svgEl("svg", { viewBox: "0 0 32 32", "aria-hidden": "true" });
  svg.append(
    svgEl("rect", { x: 7, y: 14, width: 18, height: 13, rx: 3, fill: "#f7f9ff", stroke: "#1a2040", "stroke-width": 2 }),
    svgEl("path", { d: "M11 14.5v-3.2a5 5 0 0 1 10 0v3.2", fill: "none", stroke: "#f7f9ff", "stroke-width": 2.6, "stroke-linecap": "round" })
  );
  return svg;
}

function checkGraphic() {
  const svg = svgEl("svg", { viewBox: "0 0 32 32", "aria-hidden": "true" });
  svg.append(
    svgEl("circle", { cx: 16, cy: 16, r: 13, fill: "#1ec96a", stroke: "#06381c", "stroke-width": 3 }),
    svgEl("path", { d: "M9 16.6l4.2 4.1L23 11.4", fill: "none", stroke: "#fff", "stroke-width": 3.2, "stroke-linecap": "round", "stroke-linejoin": "round" })
  );
  return svg;
}

function starGraphic() {
  return svgEl("svg", { viewBox: "0 0 20 20", "aria-hidden": "true" });
}

function rectHits(x, y, pad, rect) {
  const cx = Math.max(rect.l, Math.min(x, rect.r));
  const cy = Math.max(rect.t, Math.min(y, rect.b));
  return (x - cx) ** 2 + (y - cy) ** 2 < pad * pad;
}

function dotBlocked(x, y, layout) {
  const pad = 8;
  for (const node of layout.nodes) {
    const nx = (x - node.x) / (node.hReach + pad);
    const ny = (y - node.y) / (node.vReach + pad);
    if (nx * nx + ny * ny < 1) return true;
    const pin = {
      l: node.x - 58,
      r: node.x + 58,
      t: node.y - node.vReach - 100,
      b: node.y - node.vReach + 4,
    };
    if (rectHits(x, y, pad, pin)) return true;
    const reach = node.hReach + node.cardGap;
    const card = node.left
      ? { l: node.x + reach - 4, r: node.x + reach + node.cardW + 4, t: node.y - 46, b: node.y + 46 }
      : { l: node.x - reach - node.cardW - 4, r: node.x - reach + 4, t: node.y - 46, b: node.y + 46 };
    if (rectHits(x, y, pad, card)) return true;
    const bx = node.x + (node.left ? -1 : 1) * node.sphere * 0.36;
    const by = node.y + node.sphere * 0.3;
    if ((x - bx) ** 2 + (y - by) ** 2 < (18 + pad) ** 2) return true;
  }
  return false;
}

function drawPathDots(layout) {
  const svg = document.getElementById("path-dots");
  if (!svg) return;
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("width", String(layout.width));
  svg.setAttribute("height", String(layout.height));
  svg.replaceChildren();
  const colors = { cleared: "#ffc21a", progress: "#ff6a00", locked: "#8e93b8" };
  const glows = {
    cleared: "rgba(255, 194, 26, 0.55)",
    progress: "rgba(255, 106, 0, 0.5)",
    locked: "rgba(142, 147, 184, 0.28)",
  };
  const rims = { cleared: "#fff6d2", progress: "#ffd0b0", locked: "#5c6278" };
  for (let i = 0; i < layout.nodes.length - 1; i++) {
    const a = layout.nodes[i];
    const b = layout.nodes[i + 1];
    const kind = segmentKind(i);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const mx = (a.x + b.x) / 2 - (dy / len) * 18;
    const my = (a.y + b.y) / 2 + (dx / len) * 18;
    const steps = Math.max(8, Math.round(len / 14));
    let last = null;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      const x = u * u * a.x + 2 * u * t * mx + t * t * b.x;
      const y = u * u * a.y + 2 * u * t * my + t * t * b.y;
      if (dotBlocked(x, y, layout)) continue;
      if (last && Math.hypot(x - last.x, y - last.y) < 18) continue;
      last = { x, y };
      const halo = svgEl("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: 9, fill: glows[kind] });
      const dot = svgEl("circle", {
        cx: x.toFixed(1),
        cy: y.toFixed(1),
        r: 5.5,
        fill: colors[kind],
        stroke: rims[kind],
        "stroke-width": 2,
      });
      svg.append(halo, dot);
    }
  }
}

function placeNode(btn, node) {
  btn.style.left = `${node.x}px`;
  btn.style.top = `${node.y}px`;
  btn.style.setProperty("--sphere", String(Math.round(node.sphere)));
  btn.style.setProperty("--reach", String(Math.round(node.hReach + node.cardGap)));
  btn.style.setProperty("--card-max", `${Math.floor(node.cardW)}px`);
  btn.style.setProperty("--pin", String(Math.round(node.vReach + 16)));
  btn.dataset.x = String(Math.round(node.x));
  btn.dataset.y = String(Math.round(node.y));
  btn.dataset.h = String(Math.round(node.hReach));
  btn.dataset.v = String(Math.round(node.vReach));
}

function buildPlanetNode(id, p, node, focus) {
  const open = planetUnlocked(p);
  const cleared = open && planetCleared(p);
  const current = open && !cleared && p === focus;
  const name = planetName(lang, id);
  const stages = planetProgress(p);
  const stars = planetStars(p);
  const prev = p > 0 ? planetName(lang, PLANET_ORDER[p - 1]) : "";
  const note = open ? "" : t(lang, "unlock-note", { planet: prev });
  const btn = document.createElement("div");
  btn.className = "star-node"
    + (node.left ? " is-left" : " is-right")
    + (cleared ? " is-cleared" : "")
    + (current ? " is-current" : "")
    + (open ? "" : " is-locked");
  btn.dataset.planet = id;
  btn.dataset.state = cleared ? "cleared" : current ? "current" : "locked";
  placeNode(btn, node);

  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "star-hit";
  hit.disabled = !open;
  hit.tabIndex = -1;
  hit.setAttribute("aria-hidden", "true");
  const ring = document.createElement("span");
  ring.className = "star-ring";
  btn.append(hit, ring);

  if (!open) {
    const lock = document.createElement("span");
    lock.className = "star-lock";
    lock.append(lockGraphic());
    btn.append(lock);
  }
  if (cleared) {
    const badge = document.createElement("span");
    badge.className = "star-check";
    badge.append(checkGraphic());
    btn.append(badge);
  }
  if (current) {
    const pin = document.createElement("span");
    pin.className = "star-pin";
    pin.textContent = t(lang, "here");
    btn.append(pin);
    const left = 12 - stages;
    if (left > 0) {
      const more = document.createElement("span");
      more.className = "star-more";
      more.textContent = t(lang, "more-left", { n: left });
      btn.append(more);
    }
  }

  const card = document.createElement("button");
  card.type = "button";
  card.className = "star-card";
  card.disabled = !open;
  const line = document.createElement("span");
  line.className = "star-line";
  const num = document.createElement("span");
  num.className = "star-num";
  num.textContent = String(p + 1);
  const label = document.createElement("span");
  label.className = "star-name";
  label.textContent = name;
  line.append(num, label);
  const meta = document.createElement("span");
  meta.className = "star-meta";
  const earn = document.createElement("span");
  earn.className = "star-earn";
  const star = starGraphic();
  star.append(svgEl("polygon", {
    points: "10,1.4 12.7,7.1 18.8,7.7 14.2,11.8 15.6,17.8 10,14.7 4.4,17.8 5.8,11.8 1.2,7.7 7.3,7.1",
    fill: "#ffe14a",
  }));
  earn.append(star, document.createTextNode(`${stars}/36`));
  const stage = document.createElement("span");
  stage.className = "star-stages";
  stage.textContent = t(lang, "stage-count", { n: stages });
  meta.append(earn, stage);
  card.append(line, meta);
  if (note) {
    const noteEl = document.createElement("span");
    noteEl.className = "star-note";
    noteEl.textContent = note;
    card.append(noteEl);
  }
  btn.append(card);
  const activate = () => openFromMap(p);
  hit.addEventListener("click", activate);
  card.addEventListener("click", activate);
  return btn;
}

function positionMap() {
  const w = mapScroll.clientWidth;
  const h = mapScroll.clientHeight;
  if (w < 2 || h < 2) return;
  const layout = mapLayout(w);
  mapTrack.style.height = `${layout.height}px`;
  const buttons = mapTrack.querySelectorAll(".star-node");
  layout.nodes.forEach((node, i) => {
    if (buttons[i]) placeNode(buttons[i], node);
  });
  drawPathDots(layout);
  if (pinMapToFocus) {
    const focus = focusPlanet();
    const node = layout.nodes[focus];
    if (node) {
      const margin = 16;
      const prev = layout.nodes[focus - 1];
      const pinTop = node.y - node.vReach - 102;
      const nodeBottom = node.y + node.vReach + 12;
      const botLimit = prev ? Math.max(nodeBottom, prev.y + prev.vReach + 14) : nodeBottom;
      const span = botLimit - pinTop;
      let top = node.y - h * 0.46;
      if (span + margin * 2 <= h) {
        const minTop = botLimit - (h - margin);
        const maxTop = pinTop - margin;
        top = Math.min(maxTop, Math.max(minTop, top));
      }
      const maxScroll = Math.max(0, layout.height - h);
      mapScroll.scrollTop = Math.max(0, Math.min(top, maxScroll));
    }
    pinMapToFocus = false;
  }
  mapView.sync(mapScroll.scrollTop, w, h);
  mapView.resize();
}

async function openFromMap(p) {
  if (!planetUnlocked(p) || zooming) return;
  zooming = true;
  constellationEl.classList.add("is-zooming");
  try {
    await mapView.zoomTo(p);
    openStageList(p);
  } catch (err) {
    constellationEl.classList.remove("is-zooming");
    throw err;
  } finally {
    zooming = false;
  }
}

function playFocusPlanet() {
  const p = focusPlanet();
  const start = p * 12;
  const cleared = getCleared();
  let index = Math.min(start + 11, LEVELS.length - 1);
  for (let i = 0; i < 12; i++) {
    const level = LEVELS[start + i];
    if (!level) break;
    if (!cleared.includes(level.id)) {
      index = start + i;
      break;
    }
  }
  loadStage(index);
}

function renderMap() {
  document.getElementById("map-title").textContent = t(lang, "map-title");
  document.getElementById("map-shop").textContent = t(lang, "shop");
  document.getElementById("map-play").textContent = t(lang, "play");
  buildSpaceStars();
  mapTrack.querySelectorAll(".star-node").forEach((node) => node.remove());
  const w = mapScroll.clientWidth || 375;
  const layout = mapLayout(w);
  const focus = focusPlanet();
  PLANET_ORDER.forEach((id, p) => {
    mapTrack.append(buildPlanetNode(id, p, layout.nodes[p], focus));
  });
  mapView.setLocked((index) => !planetUnlocked(index));
  pinMapToFocus = true;
  positionMap();
}

function showMap() {
  hideLesson();
  hideOverlay();
  if (stageDialog.open) stageDialog.close();
  document.body.classList.add("map-open");
  document.querySelector(".app").classList.add("is-map");
  mapEl.hidden = false;
  constellationEl.classList.remove("is-zooming");
  if (location.hash || location.search) history.replaceState(null, "", location.pathname);
  renderMap();
  mapView.start();
  requestAnimationFrame(() => positionMap());
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
  document.getElementById("btn-store").setAttribute("aria-label", t(lang, "shop"));
  document.getElementById("map-starbox").setAttribute("aria-label", t(lang, "shop"));
  document.getElementById("map-shop").textContent = t(lang, "shop");
  document.getElementById("map-play").textContent = t(lang, "play");
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
document.getElementById("map-shop").addEventListener("click", () => {
  if (storeOpen()) closeStore();
  else openStore();
});
document.getElementById("map-starbox").addEventListener("click", () => {
  if (storeOpen()) closeStore();
  else openStore();
});
document.getElementById("map-play").addEventListener("click", () => {
  if (storeOpen() || settingsOpen() || zooming) return;
  playFocusPlanet();
});
mapScroll.addEventListener("scroll", () => {
  if (mapEl.hidden) return;
  mapView.sync(mapScroll.scrollTop, mapScroll.clientWidth, mapScroll.clientHeight);
}, { passive: true });
document.getElementById("settings-close").addEventListener("click", () => closeSettings());
document.querySelectorAll(".lang-row button").forEach((btn) => {
  btn.addEventListener("click", () => setLang(btn.dataset.lang));
});
document.getElementById("dialog-map").addEventListener("click", () => {
  stageDialog.close();
  showMap();
});
stageDialog.addEventListener("close", () => {
  if (!mapEl.hidden) {
    constellationEl.classList.remove("is-zooming");
    mapView.resetCamera();
  }
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
  if (!mapEl.hidden) positionMap();
});

if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => view.resize()).observe(boardWrapEl);
  new ResizeObserver(() => {
    if (!mapEl.hidden) positionMap();
  }).observe(constellationEl);
}
