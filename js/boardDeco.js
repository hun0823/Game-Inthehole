/**
 * A few cel-shaded props around the frame. No icicles, no crowds.
 * localStorage inthehole_deco = "on" | "off" | "auto".
 */
import * as THREE from "./vendor/three.module.js";

const jobs = [];
const texCache = new Map();
const INK = "#141414";

export function decoWanted() {
  try {
    const value = localStorage.getItem("inthehole_deco");
    if (value === "off") return false;
    if (value === "on") return true;
  } catch {
    /* private mode keeps the auto choice */
  }
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const memory = navigator.deviceMemory;
  if (memory && memory <= 2) return false;
  if ((navigator.hardwareConcurrency || 8) <= 2) return false;
  return true;
}

export function beginDeco() {
  jobs.length = 0;
  woodGen += 1;
  hideSquirrelChip();
}

export function tickDeco(time) {
  for (const step of jobs) step(time);
}

function loop(fn) {
  jobs.push(fn);
}

function paint(key, draw, size = 160) {
  let entry = texCache.get(key);
  if (entry) return entry;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.lineJoin = "round";
  g.lineCap = "round";
  draw(g, size);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  entry = { mat };
  texCache.set(key, entry);
  return entry;
}

function puff(g, x, y, rx, ry, fill, shade) {
  g.fillStyle = INK;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, Math.max(2, rx - 7), Math.max(2, ry - 7), 0, 0, Math.PI * 2);
  g.fill();
  if (!shade) return;
  g.save();
  g.beginPath();
  g.ellipse(x, y, Math.max(2, rx - 7), Math.max(2, ry - 7), 0, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = shade;
  g.fillRect(x - rx, y, rx * 2, ry);
  g.restore();
}

function box(g, x, y, w, h, fill, shade) {
  const r = Math.min(10, w * 0.18, h * 0.18);
  const path = () => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  g.lineWidth = 8;
  g.strokeStyle = INK;
  g.fillStyle = fill;
  path();
  g.fill();
  g.stroke();
  if (shade) {
    g.save();
    path();
    g.clip();
    g.fillStyle = shade;
    g.fillRect(x, y + h * 0.55, w, h);
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.fillRect(x + 6, y + 5, w - 12, h * 0.18);
    g.restore();
  }
}

function eye(g, x, y, r) {
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = INK;
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.arc(x + r * 0.15, y, r * 0.4, 0, Math.PI * 2);
  g.fill();
}

const READ = 1.28;
let spriteUnit = 1;

function stamp(parent, key, draw, x, y, z, w, h, anchorY = 0.12, size = 160) {
  const { mat } = paint(key, draw, size);
  const sprite = new THREE.Sprite(mat);
  sprite.center.set(0.5, anchorY);
  const s = READ * spriteUnit;
  sprite.scale.set(w * s, h * s, 1);
  sprite.position.set(x, y, z);
  sprite.renderOrder = 6;
  sprite.frustumCulled = false;
  parent.add(sprite);
  return sprite;
}

function bob(sprite) {
  const base = sprite.position.y;
  loop((time) => {
    sprite.position.y = base + Math.sin(time * 2.1) * 0.03;
  });
}


function metrics(span, frameT) {
  const inner = span / 2 - 0.01;
  const outer = inner + frameT;
  const unit = span / (6 * 1.16);
  return {
    outer,
    unit,
    top: -(inner + frameT * 0.2),
    y: 0.72,
  };
}

const SQUIRREL_URL = new URL("../assets/deco/squirrel.png", import.meta.url).href;
const SQUIRREL_PX = 35;
const TREE_PX = 35 * (1.78 / 1.5);
const LEAN_PAD = 8;
const HUD_PAD = 4;
const REST_X = 0.045;
let squirrelMap = null;
let squirrelAspect = 758 / 701;
const squirrelFitters = [];
let woodRelayout = () => {};
let woodGen = 0;
let woodWatchBound = false;

function bindWoodWatch() {
  if (woodWatchBound || typeof window === "undefined") return;
  woodWatchBound = true;
  const run = () => woodRelayout();
  window.addEventListener("resize", run);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", run);
}

function woodSquirrelMap() {
  if (squirrelMap) return squirrelMap;
  squirrelMap = new THREE.TextureLoader().load(SQUIRREL_URL, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const image = tex.image;
    if (image && image.width) squirrelAspect = image.width / Math.max(1, image.height);
    for (const fit of squirrelFitters) fit(image);
    squirrelFitters.length = 0;
    woodRelayout();
  });
  squirrelMap.colorSpace = THREE.SRGBColorSpace;
  squirrelMap.generateMipmaps = true;
  squirrelMap.minFilter = THREE.LinearMipmapLinearFilter;
  squirrelMap.magFilter = THREE.LinearFilter;
  return squirrelMap;
}

function woodSquirrel(parent, x, y, z) {
  const map = woodSquirrelMap();
  const mat = new THREE.SpriteMaterial({
    map,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  // Feet sit on the anchor. The PNG is cropped tight to the mockup squirrel.
  sprite.center.set(0.5, 0.06);
  if (map.image && map.image.width) squirrelAspect = map.image.width / Math.max(1, map.image.height);
  sprite.scale.set(0.2, 0.2, 1);
  sprite.position.set(x, y, z);
  sprite.renderOrder = 6;
  sprite.frustumCulled = false;
  sprite.name = "wood-squirrel";
  parent.add(sprite);
  return sprite;
}

// Same fit the board camera uses, so a pixel target lines up with the HUD.
const fitCam = new THREE.PerspectiveCamera(28, 1, 0.1, 80);
const fitWorld = new THREE.Vector3();
const fitProj = new THREE.Vector3();

function viewHalfOf(span, frameT) {
  const n = span / 1.16;
  const unit = n / 6;
  const inner = span / 2 - 0.01;
  return inner + frameT + 0.05 * unit;
}

function layoutRect() {
  const canvas = document.querySelector("canvas.playfield");
  if (canvas) {
    const box = canvas.getBoundingClientRect();
    if (box.width > 2 && box.height > 2) return box;
  }
  const api = typeof window !== "undefined" ? window.RB_LAYOUT : null;
  if (api && typeof api.boardRect === "function") {
    try {
      const rect = api.boardRect();
      if (rect && rect.width > 2 && rect.height > 2) return rect;
    } catch {
      /* publisher not ready */
    }
  }
  return null;
}

function syncFitCamera(rect, half) {
  const w = rect.width;
  const h = rect.height;
  const aspect = w / Math.max(1, h);
  const fov = 28;
  fitCam.fov = fov;
  fitCam.aspect = aspect;
  const vFov = THREE.MathUtils.degToRad(fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const elev = THREE.MathUtils.degToRad(82);
  const sinE = Math.sin(elev);
  const cosE = Math.cos(elev);
  const screenW = window.innerWidth || w;
  const want = Math.min(w * 0.99, screenW * 0.92);
  const fillW = Math.min(1.02, (want / Math.max(1, w)) * 1.035);
  const fillH = 0.98;
  const distW = half / (fillW * Math.tan(hFov / 2)) + half * cosE;
  const distH = (half * sinE) / (fillH * Math.tan(vFov / 2)) + half * cosE;
  const dist = Math.max(distW, distH);
  const lookY = 0.42;
  fitCam.position.set(0, lookY + dist * sinE, dist * cosE);
  fitCam.lookAt(0, lookY, 0);
  fitCam.updateProjectionMatrix();
  fitCam.updateMatrixWorld(true);
  fitCam.matrixWorldInverse.copy(fitCam.matrixWorld).invert();
  return vFov;
}

function localToWorld(x, y, z, rig) {
  fitWorld.set(x, y, z);
  if (rig) {
    rig.updateWorldMatrix(true, false);
    fitWorld.applyMatrix4(rig.matrixWorld);
  } else {
    const c = Math.cos(REST_X);
    const s = Math.sin(REST_X);
    const y1 = fitWorld.y * c - fitWorld.z * s;
    const z1 = fitWorld.y * s + fitWorld.z * c;
    fitWorld.y = y1;
    fitWorld.z = z1;
  }
  return fitWorld;
}

function projectAnchor(x, y, z, rig, rect) {
  localToWorld(x, y, z, rig);
  const e = fitCam.matrixWorldInverse.elements;
  const depth = -(e[2] * fitWorld.x + e[6] * fitWorld.y + e[10] * fitWorld.z + e[14]);
  fitProj.copy(fitWorld).project(fitCam);
  return {
    x: rect.left + (fitProj.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-fitProj.y * 0.5 + 0.5) * rect.height,
    depth: Math.max(0.2, depth),
  };
}

// The board canvas stops above the D-pad. The squirrel sits on the grass
// below that, in the open column beside the acorn, drawn on its own chip.
let squirrelChipEl = null;
let squirrelImg = null;

function hideSquirrelChip() {
  if (squirrelChipEl) squirrelChipEl.style.display = "none";
}

function squirrelImage() {
  if (squirrelImg) return squirrelImg;
  squirrelImg = new Image();
  squirrelImg.src = SQUIRREL_URL;
  squirrelImg.onload = () => woodRelayout();
  return squirrelImg;
}

function squirrelChip() {
  if (squirrelChipEl) return squirrelChipEl;
  const chip = document.createElement("canvas");
  chip.className = "wood-squirrel-chip";
  chip.style.position = "fixed";
  chip.style.pointerEvents = "none";
  chip.style.zIndex = "4";
  chip.style.display = "none";
  document.body.appendChild(chip);
  squirrelChipEl = chip;
  return chip;
}

function grassSquirrelBox() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const s = Math.max(0.72, Math.min(1, vw / 430));
  const sqH = SQUIRREL_PX;
  const sqW = SQUIRREL_PX * squirrelAspect;
  const edge = 14;
  const gap = 12;
  const buttons = [...document.querySelectorAll(".dpad-up, .dpad-down, .dpad-left, .dpad-right, .retry-btn")];
  let leftLimit = vw;
  for (const el of buttons) {
    const box = el.getBoundingClientRect();
    if (box.width > 2) leftLimit = Math.min(leftLimit, box.left);
  }
  const maxX = leftLimit - gap - sqW;
  const acornX = (18 + 48) * s;
  const x = Math.max(edge, Math.min(acornX - sqW * 0.45, maxX));
  const y = vh - edge - sqH;
  return { x, y, sqW, sqH };
}

function paintGrassSquirrel(angle, bob) {
  const app = document.querySelector(".app");
  if (app && app.classList.contains("is-map")) {
    hideSquirrelChip();
    return;
  }
  const img = squirrelImage();
  const chip = squirrelChip();
  if (!img.naturalWidth) {
    chip.style.display = "none";
    return;
  }
  const home = grassSquirrelBox();
  const extra = 22;
  const cw = home.sqW + extra * 2;
  const ch = home.sqH + extra * 2;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const bw = Math.max(1, Math.round(cw * dpr));
  const bh = Math.max(1, Math.round(ch * dpr));
  if (chip.width !== bw || chip.height !== bh) {
    chip.width = bw;
    chip.height = bh;
  }
  const shift = -angle * SQUIRREL_PX * 0.28;
  chip.style.width = `${cw}px`;
  chip.style.height = `${ch}px`;
  chip.style.left = `${home.x - extra + shift}px`;
  chip.style.top = `${home.y - extra + bob}px`;
  chip.style.display = "block";
  const ctx = chip.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  ctx.save();
  ctx.translate(extra + home.sqW / 2, extra + home.sqH / 2);
  ctx.rotate(-angle);
  ctx.drawImage(img, -home.sqW / 2, -home.sqH / 2, home.sqW, home.sqH);
  ctx.restore();
}

const draw = {
  tree(g, S) {
    const ink = Math.max(9, S * 0.046);
    g.lineJoin = "round";
    g.lineWidth = ink;
    g.strokeStyle = INK;
    const trunk = () => {
      g.beginPath();
      g.moveTo(S * 0.40, S * 0.56);
      g.lineTo(S * 0.60, S * 0.56);
      g.lineTo(S * 0.68, S * 0.90);
      g.lineTo(S * 0.32, S * 0.90);
      g.closePath();
    };
    g.fillStyle = "#8a5a32";
    trunk();
    g.fill();
    g.stroke();
    g.save();
    trunk();
    g.clip();
    g.fillStyle = "#5c3a1e";
    g.fillRect(S * 0.52, S * 0.56, S * 0.2, S * 0.36);
    g.fillStyle = "rgba(255,255,255,0.28)";
    g.fillRect(S * 0.36, S * 0.62, S * 0.1, S * 0.2);
    g.restore();
    const lobes = [
      [0.5, 0.34, 0.30, 0.26, "#46d25a"],
      [0.28, 0.44, 0.20, 0.18, "#2e9a40"],
      [0.72, 0.46, 0.19, 0.16, "#1f7a32"],
    ];
    for (const [cx, cy, rx, ry] of lobes) {
      g.fillStyle = INK;
      g.beginPath();
      g.ellipse(S * cx, S * cy, S * rx, S * ry, 0, 0, Math.PI * 2);
      g.fill();
    }
    for (const [cx, cy, rx, ry, fill] of lobes) {
      g.fillStyle = fill;
      g.beginPath();
      g.ellipse(S * cx, S * cy, Math.max(2, S * rx - ink), Math.max(2, S * ry - ink), 0, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.beginPath();
      g.ellipse(S * cx, S * cy, Math.max(2, S * rx - ink), Math.max(2, S * ry - ink), 0, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = "rgba(255,255,255,0.22)";
      g.beginPath();
      g.ellipse(S * cx - S * rx * 0.25, S * cy - S * ry * 0.28, S * rx * 0.28, S * ry * 0.18, -0.5, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  },
  lizard(g, S) {
    puff(g, S * 0.48, S * 0.55, S * 0.28, S * 0.14, "#7ec85a", "#3d8a34");
    puff(g, S * 0.74, S * 0.46, S * 0.12, S * 0.1, "#7ec85a", "#3d8a34");
    eye(g, S * 0.78, S * 0.42, 6);
  },
  cactus(g, S) {
    box(g, S * 0.4, S * 0.22, S * 0.2, S * 0.62, "#3d9a4a", "#2a6e34");
    box(g, S * 0.18, S * 0.38, S * 0.28, S * 0.16, "#3d9a4a", "#2a6e34");
    box(g, S * 0.54, S * 0.32, S * 0.28, S * 0.16, "#3d9a4a", "#2a6e34");
  },
  penguin(g, S) {
    puff(g, S * 0.5, S * 0.58, S * 0.22, S * 0.28, "#1c2430", "#0e141c");
    puff(g, S * 0.5, S * 0.66, S * 0.12, S * 0.16, "#f7fbff", "#d5dde6");
    puff(g, S * 0.36, S * 0.8, S * 0.09, S * 0.05, "#f2a020", "#c47a10");
    puff(g, S * 0.64, S * 0.8, S * 0.09, S * 0.05, "#f2a020", "#c47a10");
    g.fillStyle = "#f2a020";
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(S * 0.58, S * 0.5);
    g.lineTo(S * 0.74, S * 0.54);
    g.lineTo(S * 0.58, S * 0.58);
    g.closePath();
    g.fill();
    g.stroke();
    eye(g, S * 0.44, S * 0.46, 6);
    eye(g, S * 0.58, S * 0.46, 6);
  },
  peak(g, S) {
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.fillStyle = "#d7eef8";
    g.beginPath();
    g.moveTo(S * 0.5, S * 0.16);
    g.lineTo(S * 0.86, S * 0.82);
    g.lineTo(S * 0.14, S * 0.82);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#f7fbff";
    g.beginPath();
    g.moveTo(S * 0.5, S * 0.16);
    g.lineTo(S * 0.62, S * 0.48);
    g.lineTo(S * 0.38, S * 0.48);
    g.closePath();
    g.fill();
  },
  crab(g, S) {
    puff(g, S * 0.5, S * 0.58, S * 0.22, S * 0.16, "#e23b3b", "#a82028");
    puff(g, S * 0.24, S * 0.5, S * 0.1, S * 0.08, "#ff6a5a", "#e23b3b");
    puff(g, S * 0.76, S * 0.5, S * 0.1, S * 0.08, "#ff6a5a", "#e23b3b");
    eye(g, S * 0.42, S * 0.5, 6);
    eye(g, S * 0.58, S * 0.5, 6);
  },
  coral(g, S) {
    box(g, S * 0.42, S * 0.4, S * 0.16, S * 0.42, "#ff5a7a", "#c43058");
    puff(g, S * 0.5, S * 0.32, S * 0.16, S * 0.14, "#ff8aa0", "#ff5a7a");
    puff(g, S * 0.3, S * 0.48, S * 0.1, S * 0.12, "#ff8aa0", "#ff5a7a");
  },
  gem(g, S) {
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.fillStyle = "#7eb6ff";
    g.beginPath();
    g.moveTo(S * 0.5, S * 0.12);
    g.lineTo(S * 0.84, S * 0.42);
    g.lineTo(S * 0.5, S * 0.88);
    g.lineTo(S * 0.16, S * 0.42);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#d6e8ff";
    g.beginPath();
    g.moveTo(S * 0.5, S * 0.12);
    g.lineTo(S * 0.68, S * 0.42);
    g.lineTo(S * 0.5, S * 0.5);
    g.lineTo(S * 0.32, S * 0.42);
    g.closePath();
    g.fill();
  },
  robot(g, S) {
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(S * 0.5, S * 0.28);
    g.lineTo(S * 0.5, S * 0.14);
    g.stroke();
    puff(g, S * 0.5, S * 0.12, S * 0.07, S * 0.07, "#e23b3b", "#a82028");
    box(g, S * 0.28, S * 0.26, S * 0.44, S * 0.26, "#d7dee8", "#8a929c");
    eye(g, S * 0.42, S * 0.38, 7);
    eye(g, S * 0.58, S * 0.38, 7);
    box(g, S * 0.3, S * 0.52, S * 0.4, S * 0.26, "#f08a2a", "#c45e12");
    box(g, S * 0.66, S * 0.54, S * 0.22, S * 0.12, "#f08a2a", "#c45e12");
    box(g, S * 0.32, S * 0.78, S * 0.14, S * 0.1, "#8a929c", "#5c646e");
    box(g, S * 0.54, S * 0.78, S * 0.14, S * 0.1, "#8a929c", "#5c646e");
  },
  stack(g, S) {
    box(g, S * 0.3, S * 0.7, S * 0.4, S * 0.16, "#e25b8a", "#a82048");
    box(g, S * 0.32, S * 0.54, S * 0.36, S * 0.16, "#3d9a4a", "#2a6e34");
    box(g, S * 0.28, S * 0.38, S * 0.4, S * 0.16, "#2f7dff", "#1a4ec0");
    box(g, S * 0.32, S * 0.2, S * 0.34, S * 0.16, "#f2c14a", "#c49220");
  },
  stackB(g, S) {
    box(g, S * 0.3, S * 0.58, S * 0.4, S * 0.2, "#3d9a4a", "#2a6e34");
    box(g, S * 0.34, S * 0.36, S * 0.36, S * 0.2, "#f08a2a", "#c45e12");
  },
  pop(g, S) {
    puff(g, S * 0.5, S * 0.28, S * 0.2, S * 0.2, "#ff5a9a", "#d43070");
    box(g, S * 0.44, S * 0.46, S * 0.12, S * 0.4, "#f4f7fb", "#d5dde6");
  },
  flame(g, S) {
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.fillStyle = "#e23b3b";
    g.beginPath();
    g.moveTo(S * 0.5, S * 0.12);
    g.quadraticCurveTo(S * 0.86, S * 0.48, S * 0.7, S * 0.84);
    g.quadraticCurveTo(S * 0.5, S * 0.7, S * 0.3, S * 0.84);
    g.quadraticCurveTo(S * 0.14, S * 0.48, S * 0.5, S * 0.12);
    g.fill();
    g.stroke();
    g.fillStyle = "#f2c14a";
    g.beginPath();
    g.moveTo(S * 0.5, S * 0.36);
    g.quadraticCurveTo(S * 0.66, S * 0.58, S * 0.56, S * 0.76);
    g.quadraticCurveTo(S * 0.44, S * 0.64, S * 0.5, S * 0.36);
    g.fill();
  },
  rock(g, S) {
    puff(g, S * 0.5, S * 0.58, S * 0.28, S * 0.2, "#6a4038", "#3a2018");
  },
  leaf(g, S) {
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.fillStyle = "#3d9a4a";
    g.beginPath();
    g.ellipse(S * 0.5, S * 0.48, S * 0.22, S * 0.32, 0.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.strokeStyle = "#1e5a28";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(S * 0.32, S * 0.7);
    g.lineTo(S * 0.68, S * 0.28);
    g.stroke();
  },
  parrot(g, S) {
    puff(g, S * 0.48, S * 0.55, S * 0.2, S * 0.16, "#e23b3b", "#a82028");
    puff(g, S * 0.66, S * 0.42, S * 0.12, S * 0.1, "#f2c14a", "#c49220");
    g.fillStyle = "#f2c14a";
    g.beginPath();
    g.moveTo(S * 0.74, S * 0.4);
    g.lineTo(S * 0.9, S * 0.44);
    g.lineTo(S * 0.74, S * 0.5);
    g.closePath();
    g.fill();
    eye(g, S * 0.7, S * 0.38, 5);
  },
  alien(g, S) {
    puff(g, S * 0.5, S * 0.48, S * 0.2, S * 0.24, "#6adf5a", "#3d9a3a");
    eye(g, S * 0.42, S * 0.44, 8);
    eye(g, S * 0.58, S * 0.44, 8);
    puff(g, S * 0.34, S * 0.22, S * 0.06, S * 0.1, "#6adf5a", "#3d9a3a");
    puff(g, S * 0.66, S * 0.22, S * 0.06, S * 0.1, "#6adf5a", "#3d9a3a");
  },
  sprout(g, S) {
    box(g, S * 0.44, S * 0.48, S * 0.12, S * 0.34, "#3d9a4a", "#2a6e34");
    puff(g, S * 0.5, S * 0.36, S * 0.16, S * 0.14, "#7adf5a", "#3d9a4a");
  },
  gear(g, S) {
    puff(g, S * 0.5, S * 0.5, S * 0.22, S * 0.22, "#d0d8e4", "#8a929c");
    puff(g, S * 0.5, S * 0.5, S * 0.08, S * 0.08, "#5c646e", "#3a424c");
    g.fillStyle = "#d0d8e4";
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.fillRect(S * 0.5 + Math.cos(a) * S * 0.2 - 6, S * 0.5 + Math.sin(a) * S * 0.2 - 6, 12, 12);
    }
  },
  bot(g, S) {
    box(g, S * 0.28, S * 0.28, S * 0.44, S * 0.28, "#d5dde6", "#8a929c");
    box(g, S * 0.34, S * 0.54, S * 0.32, S * 0.28, "#3ec4ff", "#1a8ec4");
    eye(g, S * 0.42, S * 0.4, 5);
    eye(g, S * 0.58, S * 0.4, 5);
  },
};

function place(group, mascot, left, right, m) {
  // Anchor partway up the sprite so the body sits on the frame. A short
  // board rect has only a few pixels above the frame, and a feet-anchor
  // would hide the face against the HUD.
  const hero = stamp(group, mascot, draw[mascot], 0, m.y, m.top, 1.15, 1.3, 0.38);
  bob(hero);
  if (left) stamp(group, left, draw[left], -m.outer * 0.9, m.y, m.top, 0.92, 1.25, 0.32);
  if (right) stamp(group, right, draw[right], m.outer * 0.9, m.y, m.top, 0.88, 1.15, 0.32);
}

function placeWood(group, m, span, frameT) {
  const hero = woodSquirrel(group, 0, m.y, m.top);
  hero.visible = false;
  // Inset from the left edge so a left roll does not clip the canopy.
  const tree = stamp(group, "tree", draw.tree, -m.outer * 0.70, m.y, m.top, 1.28, 1.78, 0.26, 256);
  const baseY = m.y;
  const baseZ = m.top;
  const treeX = -m.outer * 0.70;
  let angle = 0;
  let vel = 0;
  let prev = null;
  let side = false;
  const half = viewHalfOf(span, frameT);
  const gen = ++woodGen;

  const relayout = (time) => {
    if (gen !== woodGen) return;
    const rect = layoutRect();
    const rig = tree.parent && tree.parent.parent;
    if (!rect) return;
    const vFov = syncFitCamera(rect, half);
    const hudTop = rect.top + HUD_PAD;
    const pxPerAt = (depth) => (rect.height * 0.5) / (depth * Math.tan(vFov / 2));
    const sq = projectAnchor(0, baseY, baseZ, rig, rect);
    const sqTop = sq.y - (1 - 0.06) * SQUIRREL_PX;
    const clearance = sqTop - LEAN_PAD - hudTop;
    if (side) side = clearance < 10;
    else side = clearance < 0;
    const bob = Math.sin(time * 2.1);
    hero.visible = false;
    tree.visible = true;
    if (!side) {
      tree.center.set(0.5, 0.26);
      const treeAnchor = projectAnchor(treeX, baseY, baseZ, rig, rect);
      const room = Math.max(16, treeAnchor.y - hudTop);
      const treePx = Math.min(TREE_PX, room / 0.74);
      const treeScale = treePx / pxPerAt(treeAnchor.depth);
      tree.scale.set(treeScale * (1.28 / 1.78), treeScale, 1);
      tree.position.set(treeX, baseY, baseZ);
    } else {
      tree.center.set(0.5, 0.5);
      const localXForScreen = (sign, targetX) => {
        let lo = 0;
        let hi = half * 1.35;
        for (let i = 0; i < 14; i++) {
          const mid = (lo + hi) / 2;
          const sx = projectAnchor(sign * mid, baseY, 0, rig, rect).x;
          if (sign < 0 ? sx > targetX : sx < targetX) lo = mid;
          else hi = mid;
        }
        return sign * (lo + hi) / 2;
      };
      const treeHalf = TREE_PX * (1.28 / 1.78) * 0.5;
      const treeLocal = localXForScreen(-1, rect.left + treeHalf + 6);
      const treeAt = projectAnchor(treeLocal, baseY, 0, rig, rect);
      const treeScale = TREE_PX / pxPerAt(treeAt.depth);
      tree.scale.set(treeScale * (1.28 / 1.78), treeScale, 1);
      tree.position.set(treeLocal, baseY, 0);
    }
    // Same spring the frame sprite used: rotate, shift, and a quiet bob.
    paintGrassSquirrel(angle, bob * 0.8);
  };
  woodRelayout = () => relayout(performance.now() / 1000);
  bindWoodWatch();

  loop((time) => {
    const dt = prev == null ? 0.016 : Math.min(0.033, Math.max(0, time - prev));
    prev = time;
    const rig = hero.parent && hero.parent.parent;
    const roll = rig ? rig.rotation.z : 0;
    const target = roll * 1.55;
    const omega = 9;
    vel += (omega * omega * (target - angle) - 2 * omega * vel) * dt;
    angle += vel * dt;
    relayout(time);
  });
  woodRelayout();
  requestAnimationFrame(woodRelayout);
}

const SETS = {
  wood: ["squirrel", "tree"],
  desert: ["lizard", "cactus", "cactus"],
  ice: ["penguin", "peak", "peak"],
  ocean: ["crab", "coral", "coral"],
  crystal: ["gem", "gem", "gem"],
  toy: ["robot", "stack", "stackB"],
  candy: ["pop", "pop", "pop"],
  lava: ["flame", "rock", "rock"],
  jungle: ["parrot", "leaf", "leaf"],
  alien: ["alien", "sprout", "sprout"],
  machine: ["bot", "gear", "gear"],
};

export function createBoardDeco(planet, span, frameT = 0.4) {
  const group = new THREE.Group();
  group.name = "board-deco";
  const m = metrics(span, frameT);
  spriteUnit = m.unit;
  if (planet === "wood") {
    placeWood(group, m, span, frameT);
    return group;
  }
  const set = SETS[planet];
  if (!set) {
    placeWood(group, m, span, frameT);
    return group;
  }
  place(group, set[0], set[1], set[2], m);
  return group;
}
