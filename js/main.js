import { LEVELS } from "./levels.js";
import { Game } from "./game.js";
import { drawSky } from "./playfield.js";
import { createView } from "./board3d.js";
import { createConstellation, mapLayout } from "./constellation.js";
import { beginShots, endShots, shotBall, shotGoal, shotGoalBadge } from "./showcase.js";
import { resolveTestUnlock } from "./testUnlock.js";
import { BALLS, ballById } from "./balls.js";
import { BACKGROUNDS, CELEBRATIONS, TRAILS, backgroundById, celebrationById, trailById } from "./cosmetics.js";
import { detectLang, t, planetName, ballCopy, cosmeticCopy, lessonCopy } from "./i18n.js";
import { bloomPreference, bloomWanted, setBloomPreference } from "./quality.js";
import { PLANET_ORDER, PLANET_BALL, themeById } from "./themes.js";
import { createAudio } from "./audio.js";
import { bootPerf } from "./perf.js";

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
const STORAGE_UNLOCK_SEEN = "inthehole_unlock_seen";

/** Shop tabs on the counter. Trails and backgrounds stay in the catalog and
 *  in saves; flip a flag to show that tab again. Equipped ones still apply. */
const SHOP_TAB_ON = {
  balls: true,
  trails: false,
  bgs: false,
  celes: true,
};

const testUnlockOn = resolveTestUnlock(
  location.hostname,
  location.search,
  (key) => localStorage.getItem(key),
  (key, value) => localStorage.setItem(key, value),
);

const skyEl = document.getElementById("sky");
const boardWrapEl = document.querySelector(".board-wrap");
const playfieldEl = document.getElementById("playfield");
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
const pauseMenuEl = document.getElementById("pause-menu");
const pauseHowBtn = document.getElementById("pause-how");
const unlockToast = document.getElementById("unlock-toast");
const storeEl = document.getElementById("store");
const storeList = document.getElementById("store-list");
const storeStars = document.getElementById("store-stars");
const storeConfirm = document.getElementById("store-confirm");
const storeConfirmText = document.getElementById("store-confirm-text");
const storeClose = document.getElementById("store-close");
const storeSpend = document.getElementById("store-spend");
const storeDetail = document.getElementById("store-detail");
const storeDetailBall = document.getElementById("store-detail-ball");
const storeDetailGoal = document.getElementById("store-detail-goal");
const storeDetailName = document.getElementById("store-detail-name");
const storeDetailBlurb = document.getElementById("store-detail-blurb");
const storeDetailPrice = document.getElementById("store-detail-price");
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
const audio = createAudio();

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
let overlayLoseReason = "moves";
let overlayReward = null;
let overlayCoin = false;
let overlayStarsN = 0;
let listPlanet = 0;
let zooming = false;
let unlockToastTimer = 0;
let unlockToastIds = [];
const sessionUnlockBadges = new Set();

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
    plain: `<div class="toy toy-plain"><span class="toy-ball"></span></div>`,
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
  if (!pauseHowBtn) return;
  pauseHowBtn.disabled = false;
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

function ballUnlockEntries() {
  const entries = [];
  for (let p = 0; p < PLANET_ORDER.length; p++) {
    const planetId = PLANET_ORDER[p];
    const ballId = PLANET_BALL[planetId];
    if (!ballId || entries.some((row) => row.ballId === ballId)) continue;
    let stage = 0;
    for (let i = 0; i < 12; i++) {
      if (LEVELS[p * 12 + i]) stage = i + 1;
    }
    if (stage <= 0) continue;
    entries.push({ ballId, planetIndex: p + 1, stage, planetZero: p, planetId });
  }
  return entries;
}

let unlockByBall = null;
function ballUnlock(ballId) {
  if (!unlockByBall) {
    unlockByBall = new Map(ballUnlockEntries().map((row) => [row.ballId, row]));
  }
  return unlockByBall.get(ballId) || null;
}

function unlockLabel(ballId) {
  const info = ballUnlock(ballId);
  if (!info) return "";
  return t(lang, "unlock-at", { planet: info.planetIndex, stage: info.stage });
}

function readStringList(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(raw) ? raw.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function ownedIds() {
  const owned = new Set();
  for (const ball of BALLS) {
    if (ball.price === 0 && !ballUnlock(ball.id)) owned.add(ball.id);
  }
  for (const id of readStringList(STORAGE_OWNED)) {
    if (BALLS.some((ball) => ball.id === id)) owned.add(id);
  }
  return owned;
}

function writeOwned(owned) {
  const ids = [];
  for (const id of owned) {
    const ball = BALLS.find((item) => item.id === id);
    if (!ball) continue;
    if (ball.price === 0 && !ballUnlock(id)) continue;
    ids.push(id);
  }
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
  if (tab === "balls") return ownedIds();
  const spec = SHOP_TABS[tab];
  const known = new Set(spec.items.map((item) => item.id));
  const owned = new Set([spec.free]);
  for (const id of readStringList(spec.ownedKey)) {
    if (known.has(id)) owned.add(id);
  }
  return owned;
}

function writeOwnedFor(tab, owned) {
  if (tab === "balls") {
    writeOwned(owned);
    return;
  }
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
  if (testUnlockOn) return p >= 0 && p < PLANET_ORDER.length;
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
  if (!ballId) return null;
  const fresh = grantClearedPlanetBalls();
  if (!fresh.includes(ballId)) return null;
  celebrateUnlocks([ballId]);
  return ballId;
}

/** Planet-reward balls join the owned list only when that planet is cleared.
 *  testUnlock opens stages to play; it does not write clears and does not grant.
 */
function grantClearedPlanetBalls() {
  const owned = ownedIds();
  const fresh = [];
  for (const row of ballUnlockEntries()) {
    if (!planetCleared(row.planetZero)) continue;
    if (owned.has(row.ballId)) continue;
    owned.add(row.ballId);
    fresh.push(row.ballId);
  }
  if (fresh.length) writeOwned(owned);
  return fresh;
}

function celebrateUnlocks(ids) {
  const seen = new Set(readStringList(STORAGE_UNLOCK_SEEN));
  const fresh = ids.filter((id) => !seen.has(id));
  if (!fresh.length) return;
  markUnlockSeen(fresh);
  for (const id of fresh) sessionUnlockBadges.add(id);
  showUnlockToast(fresh);
}

function markUnlockSeen(ids) {
  const seen = new Set(readStringList(STORAGE_UNLOCK_SEEN));
  for (const id of ids) seen.add(id);
  localStorage.setItem(STORAGE_UNLOCK_SEEN, JSON.stringify([...seen]));
}

function pendingUnlockBadges() {
  const owned = ownedIds();
  const seen = new Set(readStringList(STORAGE_UNLOCK_SEEN));
  const ids = [];
  for (const row of ballUnlockEntries()) {
    if (owned.has(row.ballId) && !seen.has(row.ballId)) ids.push(row.ballId);
  }
  for (const id of sessionUnlockBadges) {
    if (owned.has(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function showUnlockToast(ids) {
  if (!unlockToast || !ids.length) return;
  unlockToastIds = ids.slice();
  paintUnlockToast();
  unlockToast.hidden = false;
  clearTimeout(unlockToastTimer);
  unlockToastTimer = setTimeout(() => {
    unlockToast.hidden = true;
    unlockToastIds = [];
  }, 3400);
}

function paintUnlockToast() {
  if (!unlockToast || !unlockToastIds.length) return;
  const name = unlockToastIds.map((id) => ballCopy(lang, id).name).join(", ");
  unlockToast.textContent = t(lang, "unlocked-toast", { name });
}

function mapOpen() {
  return !mapEl.hidden;
}

function settingsOpen() {
  return !settingsEl.hidden;
}

function pauseMenuOpen() {
  return pauseMenuEl && !pauseMenuEl.hidden;
}

function uiBlocked() {
  return storeOpen() || mapOpen() || settingsOpen() || lessonOpen || pauseMenuOpen();
}

function stageTitle(level, index) {
  const name = planetName(lang, level.planet || PLANET_ORDER[planetOf(index)]);
  return t(lang, "stage-label", { planet: name, n: (index % 12) + 1 });
}

function updateHud() {
  const level = LEVELS[stageIndex];
  const par = level.par || 0;
  const starsLeft = purse();
  if (mapStars) mapStars.textContent = String(starsLeft);
  const starLabel = `${starsLeft} ${t(lang, "stars")}`;
  if (mapStarbox) mapStarbox.setAttribute("aria-label", starLabel);
  paintStoreBalance(starsLeft);
  levelLabel.textContent = stageTitle(level, stageIndex);
  const tone = moveCountTone(par, game.moves);
  movesLabel.className = "moves";
  if (gameOver) movesLabel.classList.add("move-over");
  else if (tone === "warn") movesLabel.classList.add("move-warn");
  else if (tone === "danger") movesLabel.classList.add("move-danger");
  const earned = earnedStars().stars;
  const ratio = par > 0 ? `${game.moves}/${par}` : String(game.moves);
  movesLabel.replaceChildren();
  const hudStars = document.createElement("span");
  hudStars.className = "hud-stars";
  hudStars.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 3; i++) hudStars.append(hudStar(i < earned));
  const pill = document.createElement("span");
  pill.className = "move-pill";
  const num = document.createElement("span");
  num.className = "move-num";
  num.textContent = ratio;
  pill.append(num);
  movesLabel.append(hudStars, pill);
  movesLabel.setAttribute("aria-label", `${starsText(earned)} ${ratio}`);
  syncPauseLocks();
  fitStageTitle();
}

function hudStar(on) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("class", on ? "hud-star is-on" : "hud-star");
  const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  poly.setAttribute("points", "32,6 39.5,24 59,25.5 44,38.5 48.5,58 32,48 15.5,58 20,38.5 5,25.5 24.5,24");
  svg.append(poly);
  return svg;
}

function fitStageTitle() {
  const el = levelLabel;
  if (!el) return;
  el.style.fontSize = "";
  if (el.clientWidth < 24) return;
  const width = el.scrollWidth;
  const box = el.clientWidth;
  if (width <= box + 1) return;
  const natural = parseFloat(getComputedStyle(el).fontSize);
  el.style.fontSize = `${Math.max(14, Math.floor(natural * (box / width) * 0.94))}px`;
}

function syncPauseLocks() {
  updateLessonButton();
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

function showGameOver(reason = "moves") {
  const level = LEVELS[stageIndex];
  const par = level.par || 0;
  overlayMode = "lose";
  overlayLoseReason = reason === "lava" ? "lava" : "moves";
  hideClearStars();
  hideReward();
  overlay.classList.remove("hidden", "is-win");
  overlay.classList.add("is-lose");
  overlayKicker.textContent = stageTitle(level, stageIndex);
  if (overlayLoseReason === "lava") {
    overlayTitle.textContent = t(lang, "fell");
    overlayMsg.textContent = t(lang, "fell-note");
  } else {
    overlayTitle.textContent = t(lang, "out");
    overlayMsg.textContent = par > 0 ? `${game.moves}/${par}` : String(game.moves);
  }
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
    showGameOver("moves");
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
    showGameOver("moves");
    return;
  }
  const starsBefore = getStars(level.id);
  markCleared(level.id);
  saveStars(level.id, award.stars);
  const reward = maybeGrantPlanet(level);
  updateHud();
  showWin(award.stars, award.coinBonus, reward);
  audio.playClear(Math.max(0, award.stars - starsBefore));
}

function showHint() {
  if (uiBlocked() || animating || game.won || game.lost || gameOver) return;
  clearHintUi();
  const route = game.hintRoute();
  if (!route) {
    audio.play("denied");
    document.getElementById("btn-reset").classList.add("is-hint");
    hintNote.hidden = false;
    hintNote.textContent = t(lang, "no-path");
    return;
  }
  audio.play("ui");
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

// Map rule events onto the roll fx. view.roll calls view.onGlassEvent(ev)
// for each glassCrack / glassShatter when the ball reaches that pane, and
// view.onMagmaEvent(ev) for magmaCrack / magmaCollapse / lavaDeath.
// edge is { axis, r, c }. board3d glassMesh also accepts kind as that axis.
function glassRollFx(events) {
  const cracked = [];
  const broken = [];
  for (const ev of events || []) {
    const edge = ev.edge;
    if (!edge) continue;
    if (ev.type === "glassCrack") cracked.push(edge);
    else if (ev.type === "glassShatter") {
      broken.push({ axis: edge.axis, kind: edge.axis, r: edge.r, c: edge.c });
    }
  }
  return { cracked, broken, events: events || [] };
}

async function handleButtonPress(row, col) {
  if (uiBlocked() || animating || game.won || game.lost || gameOver) return;
  if (game.ball[0] !== row || game.ball[1] !== col) return;
  clearHintUi();
  if (!game.pressButton()) {
    audio.playPress(game, false);
    return;
  }
  audio.playPress(game, true);
  animating = true;
  view.dipButton(row, col);
  const lost = game.lost;
  updateHud();
  if (lost) {
    await view.roll([[row, col]], "down", false, { events: game.shiftEvents || [] });
    view.sync(game, { ready: true, animateGates: true });
    await wait(700);
    animating = false;
    gameOver = true;
    updateHud();
    showGameOver("lava");
    return;
  }
  view.sync(game, { ready: false, animateGates: true });
  await wait(280);
  animating = false;
  handleAfterMove(game.won);
}

async function handleTilt(dir) {
  if (uiBlocked() || animating || game.won || game.lost || gameOver) return;
  clearHintUi();
  const tiltsBefore = game.tilts;
  const phaseBefore = game.phase;
  const { path, moved, won, lost, events } = game.simulateTilt(dir);
  const glassFx = glassRollFx(events);
  audio.playTilt(game, { path, moved, won, lost, events, dir, tilts: tiltsBefore, phase: phaseBefore });
  view.nudge(dir);
  if (!moved) {
    view.bump(0.45);
    await wait(240);
    view.nudge(null);
    return;
  }
  animating = true;
  // Sync while the tilt counter is still the pre-bump value. magmaLook.sync
  // reads snapshot().magma, and a post-bump sync would rest a collapse to
  // lava before onMagmaEvent can play it. Glass and gates stay on the roll.
  view.sync(game, { ready: false, skipGlass: true, skipGates: true, adoptReveal: false, skipShift: true });
  game.applyTiltResult(path, won, moved, lost);
  view.armGateOpen(game);
  updateHud();
  await view.roll(path, dir, won && !lost, glassFx);
  view.nudge(null);
  if (lost) {
    view.sync(game, { ready: true });
    await wait(700);
    animating = false;
    gameOver = true;
    updateHud();
    showGameOver("lava");
    return;
  }
  if (!won) view.bump(path.length > 1 ? 0.16 : 0.32);
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
  closePause();
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
  audio.setScene("game");
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

function pressFeedback(btn) {
  const down = () => btn.classList.add("is-down");
  const up = () => btn.classList.remove("is-down");
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
  btn.addEventListener("pointerleave", up);
}

document.querySelectorAll(".arcade-btn[data-dir]").forEach((btn) => {
  pressFeedback(btn);
  btn.addEventListener("click", () => handleTilt(btn.dataset.dir));
});
pressFeedback(document.getElementById("btn-reset"));
pressFeedback(document.getElementById("btn-pause"));
pressFeedback(document.getElementById("btn-hint"));

document.getElementById("btn-reset").addEventListener("click", () => resetStage());
document.getElementById("btn-hint").addEventListener("click", () => showHint());
lessonBtn.addEventListener("click", () => ackLesson());
document.getElementById("dialog-close").addEventListener("click", () => stageDialog.close());

function setPauseChrome(paused) {
  document.querySelector(".topbar").inert = paused;
  document.querySelector(".board-wrap").inert = paused;
  document.querySelector(".controls").inert = paused;
}

function openPause() {
  if (pauseMenuOpen() || uiBlocked() || animating || !overlay.classList.contains("hidden")) return;
  pauseMenuEl.hidden = false;
  document.getElementById("btn-pause").setAttribute("aria-expanded", "true");
  syncPauseLocks();
  setPauseChrome(true);
  document.getElementById("pause-resume").focus();
}

function closePause() {
  if (!pauseMenuEl || pauseMenuEl.hidden) return;
  pauseMenuEl.hidden = true;
  document.getElementById("btn-pause").setAttribute("aria-expanded", "false");
  setPauseChrome(false);
}

document.getElementById("btn-pause").addEventListener("click", () => openPause());
document.getElementById("pause-resume").addEventListener("click", () => closePause());
pauseMenuEl.addEventListener("click", (e) => {
  if (e.target === pauseMenuEl) closePause();
});
document.getElementById("pause-stages").addEventListener("click", () => {
  openStageList(planetOf(stageIndex));
});
pauseHowBtn.addEventListener("click", () => {
  if (animating) return;
  const ids = lessonsOn(LEVELS[stageIndex]);
  closePause();
  playLessonQueue(ids.length ? ids : ["plain"]);
});
document.getElementById("pause-settings").addEventListener("click", () => openSettings());
document.getElementById("pause-shop").addEventListener("click", () => openStore());

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
    if (pauseMenuOpen()) {
      e.preventDefault();
      closePause();
      return;
    }
    if (mapOpen()) return;
  }
  if (storeOpen() || mapOpen() || settingsOpen() || pauseMenuOpen()) return;
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
    if (pauseMenuOpen() && pauseMenuEl.contains(e.target)) return;
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

let bakeToken = 0;
let detailId = null;

function closeBallDetail() {
  detailId = null;
  if (storeDetail) storeDetail.hidden = true;
}

function openBallDetail(id) {
  const item = ballById(id);
  if (!item || item.id !== id || storeTab !== "balls") return;
  detailId = id;
  const copy = ballCopy(lang, id);
  storeDetail.hidden = false;
  storeDetailName.textContent = copy.name;
  storeDetailBlurb.textContent = copy.blurb;
  storeDetailPrice.textContent = itemPriceText("balls", item);
  document.getElementById("store-detail-ball-label").textContent = t(lang, "ball-word");
  document.getElementById("store-detail-goal-label").textContent = t(lang, "goal-word");
  storeDetailBall.alt = copy.name;
  storeDetailGoal.alt = t(lang, "goal-word");
  shotBall(id, 168).then((url) => {
    if (detailId === id) storeDetailBall.src = url;
  });
  shotGoalBadge(id, 220).then((url) => {
    if (detailId === id) storeDetailGoal.src = url;
  });
}

function paintBallThumbs(token, nodes) {
  beginShots().then(async () => {
    try {
      for (const node of nodes) {
        if (token !== bakeToken) return;
        try {
          const ballUrl = await shotBall(node.id, 168);
          const goalUrl = await shotGoalBadge(node.id, 128);
          if (token !== bakeToken) return;
          node.ball.src = ballUrl;
          node.goal.src = goalUrl;
        } catch (err) {
          console.error(err);
        }
      }
    } finally {
      await endShots();
    }
  });
}

function shopTabOn(tab) {
  return !!(SHOP_TABS[tab] && SHOP_TAB_ON[tab]);
}

function syncShopTabs() {
  document.querySelectorAll(".store-tabs button").forEach((btn) => {
    btn.hidden = !SHOP_TAB_ON[btn.dataset.tab];
  });
  if (!shopTabOn(storeTab)) storeTab = "balls";
}

function paintStoreBalance(starsLeft = purse()) {
  if (storeStars) storeStars.textContent = String(starsLeft);
  const balance = document.getElementById("store-balance");
  if (balance) balance.setAttribute("aria-label", t(lang, "balance-label", { n: starsLeft }));
}

function itemPriceText(tab, item) {
  if (tab === "balls" && ballUnlock(item.id)) return unlockLabel(item.id);
  if (item.price === 0) return t(lang, "free");
  return `${item.price} ${t(lang, "stars")}`;
}

function canBuy(tab, item) {
  if (!item || ownedFor(tab).has(item.id)) return false;
  if (tab === "balls" && ballUnlock(item.id)) return false;
  return item.price > 0 && purse() >= item.price;
}

function renderStore() {
  syncShopTabs();
  const tab = shopTabOn(storeTab) ? storeTab : "balls";
  storeTab = tab;
  const spec = SHOP_TABS[tab];
  const owned = ownedFor(tab);
  const equipped = equippedFor(tab);
  const stars = purse();
  const pending = new Set(tab === "balls" ? pendingUnlockBadges() : []);
  paintStoreBalance(stars);
  storeList.replaceChildren();
  const thumbs = [];
  bakeToken += 1;
  const token = bakeToken;
  for (const item of spec.items) {
    const locked = tab === "balls" && !!ballUnlock(item.id) && !owned.has(item.id);
    const showEquipped = item.id === equipped && owned.has(item.id);
    const li = document.createElement("li");
    li.className = "store-row" + (showEquipped ? " is-equipped" : "") + (locked ? " is-locked" : "");
    let preview;
    if (tab === "balls") {
      const copy = itemCopy(tab, item.id);
      preview = document.createElement("button");
      preview.type = "button";
      preview.className = "ball-pair";
      preview.dataset.act = "detail";
      preview.dataset.id = item.id;
      const lockNote = locked ? `, ${unlockLabel(item.id)}` : "";
      preview.setAttribute("aria-label", `${copy.name}, ${t(lang, "goal-word")}${lockNote}`);
      const ballWrap = document.createElement("span");
      ballWrap.className = "ball-pair-ball";
      const ballImg = document.createElement("img");
      ballImg.alt = "";
      ballImg.setAttribute("aria-hidden", "true");
      ballWrap.append(ballImg);
      const goalWrap = document.createElement("span");
      goalWrap.className = "ball-pair-goal";
      const goalImg = document.createElement("img");
      goalImg.alt = "";
      goalImg.setAttribute("aria-hidden", "true");
      goalWrap.append(goalImg);
      preview.append(ballWrap, goalWrap);
      thumbs.push({ id: item.id, ball: ballImg, goal: goalImg });
    } else {
      preview = document.createElement("span");
      preview.className = `shop-swatch shop-swatch--${tab}-${item.id}`;
      preview.setAttribute("aria-hidden", "true");
    }
    const copy = document.createElement("span");
    copy.className = "store-copy";
    const copyText = itemCopy(tab, item.id);
    const name = document.createElement("strong");
    name.textContent = copyText.name;
    const price = document.createElement("em");
    price.textContent = itemPriceText(tab, item);
    const blurb = document.createElement("span");
    blurb.textContent = copyText.blurb;
    copy.append(name);
    if (pending.has(item.id)) {
      const badge = document.createElement("span");
      badge.className = "store-badge";
      badge.textContent = t(lang, "unlocked");
      copy.append(badge);
    }
    copy.append(price, blurb);
    li.append(preview, copy);
    if (showEquipped) {
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
    } else if (locked) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "store-act";
      btn.disabled = true;
      btn.textContent = t(lang, "locked");
      li.append(btn);
    } else if (canBuy(tab, item)) {
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
      btn.textContent = `${t(lang, "need")} ${Math.max(0, item.price - stars)}`;
      li.append(btn);
    }
    storeList.append(li);
  }
  if (tab === "balls" && pending.size) {
    const migrated = [...pending].filter((id) => !sessionUnlockBadges.has(id));
    if (migrated.length) markUnlockSeen(migrated);
    for (const id of pending) sessionUnlockBadges.delete(id);
  }
  if (tab === "balls" && thumbs.length) paintBallThumbs(token, thumbs);
  if (tab === "balls" && detailId && spec.items.some((item) => item.id === detailId)) openBallDetail(detailId);
  else closeBallDetail();
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
  closeBallDetail();
  storeEl.hidden = true;
}

function askBuy(id) {
  const tab = storeTab;
  const item = catalogItem(tab, id);
  if (!item || item.id !== id || !canBuy(tab, item)) return;
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
  if (!item || item.id !== pending.id || !canBuy(pending.tab, item)) {
    audio.play("denied");
    renderStore();
    return;
  }
  audio.play("buy");
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
  if (!shopTabOn(tab)) return;
  storeTab = tab;
  closeBallDetail();
  document.querySelectorAll(".store-tabs button").forEach((btn) => {
    const on = btn.dataset.tab === tab;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  cancelBuy();
  renderStore();
}

storeClose.addEventListener("click", () => closeStore());
storeSpend.addEventListener("click", () => confirmBuy());
document.getElementById("store-cancel").addEventListener("click", () => cancelBuy());
storeList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn || !storeList.contains(btn)) return;
  if (btn.dataset.act === "detail") openBallDetail(btn.dataset.id);
  else if (btn.dataset.act === "buy") askBuy(btn.dataset.id);
  else if (btn.dataset.act === "equip") equipOwned(btn.dataset.id);
});
document.getElementById("store-detail-close").addEventListener("click", () => closeBallDetail());
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
  if (!open) {
    let downX = 0;
    let downY = 0;
    btn.addEventListener("pointerdown", (e) => {
      downX = e.clientX;
      downY = e.clientY;
    });
    btn.addEventListener("pointerup", (e) => {
      if ((e.clientX - downX) ** 2 + (e.clientY - downY) ** 2 > 18 * 18) return;
      audio.play("denied");
    });
  }
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
  closePause();
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
  audio.setScene("menu");
}

function applyBloom() {
  const on = bloomWanted() && !view.bloomSuppressed();
  view.setBloom(on);
  mapView.setBloom(on);
}

function syncAudioControls() {
  const mix = audio.settings();
  const bgm = document.getElementById("bgm-volume");
  const sfx = document.getElementById("sfx-volume");
  const mute = document.getElementById("audio-mute");
  bgm.value = String(Math.round(mix.bgm * 100));
  sfx.value = String(Math.round(mix.sfx * 100));
  bgm.setAttribute("aria-valuenow", bgm.value);
  sfx.setAttribute("aria-valuenow", sfx.value);
  mute.classList.toggle("is-on", mix.mute);
  mute.setAttribute("aria-pressed", mix.mute ? "true" : "false");
  mute.textContent = t(lang, mix.mute ? "unmute" : "mute");
}

function openSettings() {
  settingsEl.hidden = false;
  document.querySelectorAll(".lang-row button[data-lang]").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.lang === lang);
  });
  const pref = bloomPreference();
  document.querySelectorAll("[data-glow]").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.glow === pref);
    btn.textContent = t(lang, `glow-${btn.dataset.glow}`);
  });
  const held = view.bloomSuppressed();
  document.getElementById("glow-note").textContent = held ? t(lang, "glow-held") : t(lang, "glow-note");
  syncAudioControls();
}

function closeSettings() {
  settingsEl.hidden = true;
}

function applyLang() {
  document.documentElement.lang = lang;
  document.getElementById("map-starbox").setAttribute("aria-label", t(lang, "shop"));
  document.getElementById("map-shop").textContent = t(lang, "shop");
  document.getElementById("map-play").textContent = t(lang, "play");
  document.getElementById("btn-pause").setAttribute("aria-label", t(lang, "pause"));
  document.getElementById("map-settings").setAttribute("aria-label", t(lang, "settings"));
  document.getElementById("pause-title").textContent = t(lang, "paused");
  document.getElementById("pause-resume").textContent = t(lang, "resume");
  document.getElementById("pause-how").textContent = t(lang, "how");
  document.getElementById("pause-stages").textContent = t(lang, "stage-list");
  document.getElementById("pause-shop").textContent = t(lang, "shop");
  document.getElementById("pause-settings").textContent = t(lang, "settings");
  document.querySelector(".lesson-replay").textContent = t(lang, "replay");
  lessonBtn.textContent = t(lang, "got-it");
  document.getElementById("store-title").textContent = t(lang, "shop-title");
  syncShopTabs();
  document.querySelectorAll(".store-tabs button").forEach((btn) => {
    btn.textContent = t(lang, `tab-${btn.dataset.tab}`);
  });
  document.getElementById("store-balance-prefix").textContent = t(lang, "balance-prefix");
  document.getElementById("store-balance-suffix").textContent = t(lang, "balance-suffix");
  paintUnlockToast();
  storeClose.setAttribute("aria-label", t(lang, "close"));
  document.getElementById("store-detail-close").setAttribute("aria-label", t(lang, "close"));
  storeSpend.textContent = t(lang, "spend");
  document.getElementById("store-cancel").textContent = t(lang, "not-now");
  document.getElementById("dialog-close").textContent = t(lang, "close");
  document.getElementById("dialog-map").textContent = t(lang, "map-back");
  document.getElementById("settings-title").textContent = t(lang, "settings");
  document.getElementById("lang-label").textContent = t(lang, "language");
  document.getElementById("glow-label").textContent = t(lang, "glow");
  document.getElementById("audio-label").textContent = t(lang, "audio");
  document.getElementById("bgm-name").textContent = t(lang, "music");
  document.getElementById("sfx-name").textContent = t(lang, "effects");
  document.getElementById("bgm-volume").setAttribute("aria-label", t(lang, "music"));
  document.getElementById("sfx-volume").setAttribute("aria-label", t(lang, "effects"));
  document.getElementById("settings-close").textContent = t(lang, "close");
  syncAudioControls();
  document.querySelector(".dpad-up .face-caption").textContent = t(lang, "up");
  document.querySelector(".dpad-down .face-caption").textContent = t(lang, "down");
  document.querySelector(".dpad-left .face-caption").textContent = t(lang, "left");
  document.querySelector(".dpad-right .face-caption").textContent = t(lang, "right");
  document.querySelector(".retry-btn .face-caption").textContent = t(lang, "retry");
  document.getElementById("btn-reset").setAttribute("aria-label", t(lang, "retry"));
  document.getElementById("btn-hint").setAttribute("aria-label", t(lang, "hint"));
  if (lessonOpen && lessonQueue[0]) showLessonCard(lessonQueue[0]);
  if (!storeEl.hidden) renderStore();
  if (!mapEl.hidden) renderMap();
  if (stageDialog.open) buildStageList();
  updateHud();
  paintSky();
  if (overlayMode === "win") showWin(overlayStarsN, overlayCoin, overlayReward);
  else if (overlayMode === "lose") showGameOver(overlayLoseReason);
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
document.getElementById("bgm-volume").addEventListener("input", (e) => {
  audio.setBgm(Number(e.target.value) / 100);
  e.target.setAttribute("aria-valuenow", e.target.value);
});
document.getElementById("sfx-volume").addEventListener("input", (e) => {
  audio.setSfx(Number(e.target.value) / 100);
  e.target.setAttribute("aria-valuenow", e.target.value);
});
document.getElementById("sfx-volume").addEventListener("change", () => audio.play("ui"));
document.getElementById("audio-mute").addEventListener("click", () => {
  const next = !audio.settings().mute;
  audio.setMute(next);
  syncAudioControls();
  if (!next) audio.play("ui");
});
document.addEventListener("pointerup", (e) => {
  const btn = e.target.closest("button");
  if (!btn || btn.disabled) return;
  if (btn.dataset.dir || btn.id === "btn-hint" || btn.id === "store-spend" || btn.id === "audio-mute") return;
  audio.play("ui");
}, true);
storeList.addEventListener("pointerup", (e) => {
  const btn = e.target.closest("button");
  if (btn && !btn.disabled) return;
  const row = e.target.closest(".store-row");
  if (row && row.querySelector("button:disabled")) audio.play("denied");
});
document.querySelectorAll(".lang-row button[data-lang]").forEach((btn) => {
  btn.addEventListener("click", () => setLang(btn.dataset.lang));
});
document.querySelectorAll("[data-glow]").forEach((btn) => {
  btn.addEventListener("click", () => {
    setBloomPreference(btn.dataset.glow);
    applyBloom();
    openSettings();
  });
});
view.onBloomSuppressed(() => {
  mapView.setBloom(false);
  if (settingsOpen()) openSettings();
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

bootPerf([
  { watch: () => view.watchRender(true), read: () => view.renderInfo() },
  { watch: () => mapView.watchRender(true), read: () => (mapEl.hidden ? null : mapView.renderInfo()) },
]);
window.RB_AUDIO = {
  played: () => audio.played(),
  settings: () => audio.settings(),
  whenReady: () => audio.whenReady(),
  scene: () => audio.sceneState(),
};
applyLang();
applyBloom();
grantClearedPlanetBalls();
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
function measureBoardRect() {
  const hud = document.querySelector(".topbar").getBoundingClientRect();
  const controls = document.querySelector(".controls").getBoundingClientRect();
  const wrap = boardWrapEl.getBoundingClientRect();
  const up = document.querySelector(".dpad-up");
  const upTop = up ? up.getBoundingClientRect().top : controls.top;
  const top = hud.bottom;
  const bottom = wrap.bottom;
  const left = wrap.left;
  const right = wrap.right;
  return {
    x: left,
    y: top,
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    dpadOverlap: Math.max(0, Math.round(bottom - upTop)),
  };
}

function publishLayout() {
  const hud = document.querySelector(".topbar").getBoundingClientRect();
  const controls = document.querySelector(".controls").getBoundingClientRect();
  const root = document.documentElement;
  root.style.setProperty("--hud-bottom", `${Math.round(hud.bottom)}px`);
  root.style.setProperty("--dpad-top", `${Math.round(controls.top)}px`);
}

window.RB_LAYOUT = {
  boardRect() {
    return measureBoardRect();
  },
};

function refreshLayout() {
  fitStageTitle();
  publishLayout();
  paintSky();
  view.resize();
  if (!mapEl.hidden) positionMap();
}

requestAnimationFrame(() => refreshLayout());
window.addEventListener("resize", () => refreshLayout());
window.addEventListener("orientationchange", () => refreshLayout());
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => refreshLayout());
}
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => refreshLayout());
}

if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => {
    publishLayout();
    view.resize();
  }).observe(boardWrapEl);
  new ResizeObserver(() => {
    if (!mapEl.hidden) positionMap();
  }).observe(constellationEl);
}
