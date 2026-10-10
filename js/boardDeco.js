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

function stamp(parent, key, draw, x, y, z, w, h, anchorY = 0.12) {
  const { mat } = paint(key, draw);
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

const draw = {
  squirrel(g, S) {
    puff(g, S * 0.42, S * 0.58, S * 0.22, S * 0.2, "#c47a3a", "#8a4e22");
    puff(g, S * 0.62, S * 0.4, S * 0.16, S * 0.14, "#e8a05a", "#c47a3a");
    puff(g, S * 0.28, S * 0.42, S * 0.12, S * 0.16, "#c47a3a", "#8a4e22");
    eye(g, S * 0.68, S * 0.36, 7);
  },
  tree(g, S) {
    box(g, S * 0.42, S * 0.62, S * 0.16, S * 0.28, "#8a5a32", "#5c3a1e");
    puff(g, S * 0.5, S * 0.42, S * 0.28, S * 0.26, "#3d9a4a", "#2a6e34");
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
  house(g, S) {
    puff(g, S * 0.5, S * 0.4, S * 0.28, S * 0.18, "#e23b3b", "#a82028");
    box(g, S * 0.38, S * 0.5, S * 0.24, S * 0.32, "#f4f1ea", "#d5c8b4");
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
  stamp(group, left, draw[left], -m.outer * 0.9, m.y, m.top, 0.92, 1.25, 0.32);
  stamp(group, right, draw[right], m.outer * 0.9, m.y, m.top, 0.88, 1.15, 0.32);
}

const SETS = {
  wood: ["squirrel", "tree", "tree"],
  desert: ["lizard", "cactus", "cactus"],
  ice: ["penguin", "peak", "peak"],
  ocean: ["crab", "coral", "coral"],
  crystal: ["gem", "gem", "gem"],
  toy: ["robot", "stack", "stackB"],
  mushroom: ["house", "house", "house"],
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
  const set = SETS[planet] || SETS.wood;
  place(group, set[0], set[1], set[2], m);
  return group;
}
