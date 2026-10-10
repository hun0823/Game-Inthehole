/**
 * Arcade trim around the board. Creatures are canvas sprites with the
 * outline baked in, so a near-top-down camera still reads the silhouette.
 * Nothing is placed inside the play cells.
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

function pingpong(t, period) {
  const u = (t % period) / period;
  return u < 0.5 ? u * 2 : (1 - u) * 2;
}

let dotMap = null;
function dotTexture() {
  if (dotMap) return dotMap;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 32, 32);
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(16, 16, 11, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.stroke();
  dotMap = new THREE.CanvasTexture(c);
  dotMap.colorSpace = THREE.SRGBColorSpace;
  return dotMap;
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

function blob(g, x, y, rx, ry, fill) {
  const ox = Math.min(14, Math.max(6, rx * 0.34));
  const oy = Math.min(14, Math.max(6, ry * 0.34));
  g.fillStyle = INK;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, Math.max(1, rx - ox), Math.max(1, ry - oy), 0, 0, Math.PI * 2);
  g.fill();
}

function poly(g, pts, fill) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath();
  g.lineWidth = 12;
  g.strokeStyle = INK;
  g.fillStyle = fill;
  g.stroke();
  g.fill();
}

function eye(g, x, y, r) {
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 2.5;
  g.strokeStyle = INK;
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.arc(x + r * 0.2, y, r * 0.42, 0, Math.PI * 2);
  g.fill();
}

const READ = 1.9;
const REF_SPAN = 6 * 1.16;
let spriteUnit = 1;

function stamp(parent, key, draw, x, y, z, w, h, anchorY = 0.08) {
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

function tilt(sprite, angle) {
  ownMat(sprite).rotation = angle;
}

function ownMat(sprite) {
  if (!sprite.userData.cloned) {
    sprite.material = sprite.material.clone();
    sprite.userData.cloned = true;
    sprite.userData.ownMat = true;
  }
  return sprite.material;
}

function metrics(span, frameT) {
  const inner = span / 2 - 0.02;
  const outer = inner + frameT;
  const unit = span / REF_SPAN;
  return {
    inner,
    outer,
    unit,
    far: -(inner + frameT * 0.8),
    sky: -(outer + 0.62 * unit),
    near: outer + 0.08 * unit,
    groundZ: outer + 0.95 * unit,
    foot: 0.76,
    low: 0.06,
  };
}

function ground() {
  /* Terrain sits on the full-window sky, behind the D-pad. */
}

function flakes(parent, count, color, m, rise) {
  const n = Math.min(count, 18);
  const pos = new Float32Array(n * 3);
  const seeds = Array.from({ length: n }, (_, i) => ({
    lane: i % 3,
    u: (i * 0.37) % 1,
    s: 0.55 + (i % 4) * 0.16,
    drift: (i % 6) * 0.15,
  }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size: 0.24,
    map: dotTexture(),
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  parent.add(points);
  loop((time) => {
    for (let i = 0; i < n; i++) {
      const seed = seeds[i];
      const along = ((seed.u + time * 0.045 * seed.s) % 1) * 2 - 1;
      const fall = (seed.drift + time * (rise ? 0.11 : 0.07) * seed.s) % 1;
      let x = along * (m.outer * 0.92);
      let z = m.sky;
      const y = rise ? 1.55 - fall * 1.15 : 1.15 + Math.sin(time * seed.s + i) * 0.18;
      if (seed.lane === 1) z = m.outer + 0.55;
      if (seed.lane === 2) {
        x = (i % 2 ? 1 : -1) * (m.outer + 0.15);
        z = along * m.outer * 0.8;
      }
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
    }
    geo.attributes.position.needsUpdate = true;
  });
}

function idle(sprite, bob = 0.04, speed = 2.2) {
  const baseY = sprite.position.y;
  loop((time) => {
    sprite.position.y = baseY + Math.sin(time * speed) * bob;
  });
}

function patrol(sprite, m, period, bob) {
  const width = Math.abs(sprite.scale.x);
  const baseY = sprite.position.y;
  loop((time) => {
    const p = pingpong(time, period);
    const dir = time % period < period / 2 ? 1 : -1;
    sprite.position.x = (p * 2 - 1) * (m.outer - 0.85 * m.unit);
    sprite.position.z = m.far;
    sprite.scale.x = dir * width;
    sprite.position.y = baseY + (bob ? Math.abs(Math.sin(time * Math.PI * 2)) * 0.08 : 0);
  });
}

const draw = {
  squirrel(g, S) {
    blob(g, S * 0.34, S * 0.48, S * 0.2, S * 0.24, "#8a4e22");
    blob(g, S * 0.58, S * 0.55, S * 0.2, S * 0.16, "#c47a3a");
    blob(g, S * 0.62, S * 0.6, S * 0.1, S * 0.08, "#f4d2a4");
    blob(g, S * 0.74, S * 0.42, S * 0.13, S * 0.12, "#e8a05a");
    blob(g, S * 0.7, S * 0.3, S * 0.05, S * 0.07, "#c47a3a");
    blob(g, S * 0.8, S * 0.3, S * 0.05, S * 0.07, "#c47a3a");
    eye(g, S * 0.78, S * 0.4, 6);
    poly(g, [[S * 0.86, S * 0.44], [S * 0.96, S * 0.4], [S * 0.86, S * 0.5]], "#e07a6a");
  },
  bird(g, S, body, wing) {
    poly(g, [[S * 0.18, S * 0.48], [S * 0.42, S * 0.28], [S * 0.4, S * 0.55]], wing);
    blob(g, S * 0.48, S * 0.52, S * 0.22, S * 0.14, body);
    blob(g, S * 0.7, S * 0.46, S * 0.12, S * 0.11, body);
    poly(g, [[S * 0.8, S * 0.44], [S * 0.96, S * 0.48], [S * 0.8, S * 0.54]], "#f2c14a");
    eye(g, S * 0.72, S * 0.42, 5);
  },
  redbird(g, S) {
    draw.bird(g, S, "#e23b3b", "#f2c14a");
  },
  bluebird(g, S) {
    draw.bird(g, S, "#2f7dff", "#7eb6ff");
  },
  gull(g, S) {
    draw.bird(g, S, "#f7f7f7", "#d5dde6");
    blob(g, S * 0.46, S * 0.58, S * 0.12, S * 0.05, "#e7eef6");
  },
  tree(g, S) {
    blob(g, S * 0.5, S * 0.78, S * 0.08, S * 0.16, "#6a4424");
    blob(g, S * 0.5, S * 0.48, S * 0.28, S * 0.24, "#2f8a3a");
    blob(g, S * 0.34, S * 0.4, S * 0.16, S * 0.14, "#3daf4a");
    blob(g, S * 0.66, S * 0.36, S * 0.14, S * 0.12, "#7adf5a");
  },
  mushroom(g, S, cap) {
    blob(g, S * 0.5, S * 0.7, S * 0.1, S * 0.16, "#f4f0ea");
    blob(g, S * 0.5, S * 0.46, S * 0.32, S * 0.18, cap);
    blob(g, S * 0.36, S * 0.42, S * 0.05, S * 0.04, "#fff");
    blob(g, S * 0.58, S * 0.4, S * 0.06, S * 0.045, "#fff");
    blob(g, S * 0.7, S * 0.48, S * 0.04, S * 0.035, "#fff");
  },
  grass(g, S) {
    poly(g, [[S * 0.3, S * 0.84], [S * 0.38, S * 0.28], [S * 0.48, S * 0.84]], "#3d9a4a");
    poly(g, [[S * 0.46, S * 0.84], [S * 0.58, S * 0.18], [S * 0.68, S * 0.84]], "#2f8a3a");
    poly(g, [[S * 0.62, S * 0.84], [S * 0.74, S * 0.34], [S * 0.84, S * 0.84]], "#7adf5a");
  },
  lizard(g, S) {
    blob(g, S * 0.58, S * 0.52, S * 0.24, S * 0.1, "#c47a3a");
    blob(g, S * 0.8, S * 0.48, S * 0.12, S * 0.09, "#e8a05a");
    poly(g, [[S * 0.28, S * 0.52], [S * 0.08, S * 0.36], [S * 0.1, S * 0.66]], "#e07a3a");
    eye(g, S * 0.84, S * 0.44, 5);
  },
  cactus(g, S) {
    blob(g, S * 0.5, S * 0.55, S * 0.12, S * 0.32, "#3d9a4a");
    blob(g, S * 0.28, S * 0.46, S * 0.08, S * 0.16, "#2f8a3a");
    blob(g, S * 0.72, S * 0.42, S * 0.08, S * 0.14, "#3d9a4a");
    blob(g, S * 0.5, S * 0.2, S * 0.07, S * 0.07, "#ff5a7a");
  },
  palm(g, S) {
    blob(g, S * 0.5, S * 0.68, S * 0.07, S * 0.24, "#8a5a32");
    poly(g, [[S * 0.5, S * 0.4], [S * 0.12, S * 0.28], [S * 0.5, S * 0.48]], "#3d9a4a");
    poly(g, [[S * 0.5, S * 0.4], [S * 0.88, S * 0.26], [S * 0.5, S * 0.5]], "#2f8a3a");
    poly(g, [[S * 0.5, S * 0.38], [S * 0.22, S * 0.55], [S * 0.48, S * 0.5]], "#7adf5a");
    poly(g, [[S * 0.5, S * 0.38], [S * 0.8, S * 0.56], [S * 0.52, S * 0.5]], "#3d9a4a");
  },
  bone(g, S) {
    blob(g, S * 0.28, S * 0.4, S * 0.1, S * 0.1, "#f4f1ea");
    blob(g, S * 0.28, S * 0.62, S * 0.1, S * 0.1, "#f4f1ea");
    blob(g, S * 0.72, S * 0.4, S * 0.1, S * 0.1, "#f4f1ea");
    blob(g, S * 0.72, S * 0.62, S * 0.1, S * 0.1, "#f4f1ea");
    blob(g, S * 0.5, S * 0.52, S * 0.22, S * 0.07, "#f7f4ee");
  },
  dune(g, S) {
    poly(g, [[S * 0.05, S * 0.78], [S * 0.4, S * 0.28], [S * 0.7, S * 0.78]], "#e6c27a");
    poly(g, [[S * 0.35, S * 0.78], [S * 0.72, S * 0.4], [S * 0.98, S * 0.78]], "#c4924a");
  },
  penguin(g, S) {
    poly(g, [[S * 0.3, S * 0.9], [S * 0.42, S * 0.78], [S * 0.52, S * 0.9]], "#f2a020");
    poly(g, [[S * 0.5, S * 0.9], [S * 0.64, S * 0.78], [S * 0.74, S * 0.9]], "#f2a020");
    blob(g, S * 0.48, S * 0.58, S * 0.24, S * 0.28, "#1c2430");
    blob(g, S * 0.52, S * 0.64, S * 0.13, S * 0.16, "#fff6ea");
    blob(g, S * 0.66, S * 0.34, S * 0.15, S * 0.14, "#1c2430");
    blob(g, S * 0.66, S * 0.4, S * 0.08, S * 0.07, "#fff6ea");
    poly(g, [[S * 0.76, S * 0.34], [S * 0.94, S * 0.4], [S * 0.76, S * 0.46]], "#f2a020");
    eye(g, S * 0.7, S * 0.3, 6);
    blob(g, S * 0.32, S * 0.58, S * 0.07, S * 0.14, "#141820");
  },
  babyPen(g, S) {
    draw.penguin(g, S);
  },
  seal(g, S) {
    blob(g, S * 0.46, S * 0.58, S * 0.28, S * 0.16, "#8aa0b4");
    blob(g, S * 0.72, S * 0.52, S * 0.14, S * 0.12, "#d5e4ee");
    poly(g, [[S * 0.2, S * 0.62], [S * 0.06, S * 0.78], [S * 0.28, S * 0.7]], "#7e96aa");
    eye(g, S * 0.78, S * 0.48, 5);
    blob(g, S * 0.86, S * 0.56, S * 0.05, S * 0.035, "#141414");
  },
  iceberg(g, S) {
    poly(g, [[S * 0.5, S * 0.12], [S * 0.12, S * 0.82], [S * 0.88, S * 0.82]], "#eaf6ff");
    poly(g, [[S * 0.5, S * 0.28], [S * 0.34, S * 0.7], [S * 0.62, S * 0.62]], "#ffffff");
    poly(g, [[S * 0.2, S * 0.82], [S * 0.5, S * 0.82], [S * 0.36, S * 0.62]], "#b7d4ea");
  },
  icicle(g, S) {
    poly(g, [[S * 0.18, S * 0.1], [S * 0.82, S * 0.1], [S * 0.5, S * 0.94]], "#e7f7ff");
    poly(g, [[S * 0.36, S * 0.14], [S * 0.58, S * 0.16], [S * 0.5, S * 0.7]], "#ffffff");
  },
  crab(g, S) {
    blob(g, S * 0.5, S * 0.58, S * 0.22, S * 0.16, "#e23b3b");
    blob(g, S * 0.22, S * 0.48, S * 0.1, S * 0.08, "#ff6a5a");
    blob(g, S * 0.78, S * 0.48, S * 0.1, S * 0.08, "#ff6a5a");
    blob(g, S * 0.4, S * 0.28, S * 0.035, S * 0.1, "#e23b3b");
    blob(g, S * 0.6, S * 0.28, S * 0.035, S * 0.1, "#e23b3b");
    eye(g, S * 0.4, S * 0.2, 6);
    eye(g, S * 0.6, S * 0.2, 6);
  },
  fish(g, S, body, fin) {
    blob(g, S * 0.55, S * 0.52, S * 0.24, S * 0.14, body);
    poly(g, [[S * 0.3, S * 0.52], [S * 0.08, S * 0.32], [S * 0.1, S * 0.72]], fin);
    eye(g, S * 0.7, S * 0.46, 5);
  },
  coral(g, S, color) {
    blob(g, S * 0.5, S * 0.7, S * 0.1, S * 0.2, color);
    blob(g, S * 0.32, S * 0.48, S * 0.08, S * 0.16, color);
    blob(g, S * 0.68, S * 0.46, S * 0.08, S * 0.18, color);
  },
  wave(g, S) {
    g.strokeStyle = INK;
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(S * 0.06, S * 0.62);
    g.quadraticCurveTo(S * 0.28, S * 0.2, S * 0.5, S * 0.55);
    g.quadraticCurveTo(S * 0.72, S * 0.9, S * 0.94, S * 0.4);
    g.stroke();
    g.strokeStyle = "#7fd6ff";
    g.lineWidth = 5;
    g.stroke();
  },
  crystal(g, S, color) {
    poly(g, [[S * 0.5, S * 0.08], [S * 0.18, S * 0.78], [S * 0.5, S * 0.62], [S * 0.82, S * 0.78]], color);
    poly(g, [[S * 0.5, S * 0.16], [S * 0.4, S * 0.5], [S * 0.5, S * 0.42]], "#ffffff");
  },
  butterfly(g, S) {
    poly(g, [[S * 0.5, S * 0.5], [S * 0.12, S * 0.22], [S * 0.28, S * 0.55]], "#d0dcff");
    poly(g, [[S * 0.5, S * 0.5], [S * 0.88, S * 0.22], [S * 0.72, S * 0.55]], "#e4ecff");
    poly(g, [[S * 0.5, S * 0.5], [S * 0.16, S * 0.78], [S * 0.4, S * 0.58]], "#9a78f0");
    poly(g, [[S * 0.5, S * 0.5], [S * 0.84, S * 0.78], [S * 0.6, S * 0.58]], "#b7c6e6");
    blob(g, S * 0.5, S * 0.5, S * 0.04, S * 0.12, "#2a2418");
  },
  robot(g, S) {
    blob(g, S * 0.5, S * 0.62, S * 0.2, S * 0.16, "#3ec4ff");
    blob(g, S * 0.5, S * 0.36, S * 0.14, S * 0.12, "#fff6ea");
    eye(g, S * 0.44, S * 0.34, 5);
    eye(g, S * 0.58, S * 0.34, 5);
    blob(g, S * 0.5, S * 0.2, S * 0.05, S * 0.05, "#c5ced8");
    poly(g, [[S * 0.28, S * 0.58], [S * 0.12, S * 0.72], [S * 0.3, S * 0.7]], "#2f7dff");
  },
  balloon(g, S, color) {
    blob(g, S * 0.5, S * 0.4, S * 0.22, S * 0.26, color);
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(S * 0.5, S * 0.66);
    g.lineTo(S * 0.5, S * 0.9);
    g.stroke();
  },
  block(g, S, color) {
    g.fillStyle = INK;
    g.fillRect(S * 0.16, S * 0.16, S * 0.68, S * 0.68);
    g.fillStyle = color;
    g.fillRect(S * 0.24, S * 0.24, S * 0.52, S * 0.52);
    g.fillStyle = "rgba(255,255,255,0.45)";
    g.fillRect(S * 0.28, S * 0.28, S * 0.22, S * 0.12);
  },
  house(g, S, cap) {
    blob(g, S * 0.5, S * 0.68, S * 0.16, S * 0.2, "#f4f0ea");
    blob(g, S * 0.5, S * 0.42, S * 0.34, S * 0.2, cap);
    blob(g, S * 0.34, S * 0.38, S * 0.05, S * 0.04, "#fff");
    blob(g, S * 0.62, S * 0.36, S * 0.06, S * 0.05, "#fff");
    g.fillStyle = "#f2c14a";
    g.fillRect(S * 0.44, S * 0.62, S * 0.12, S * 0.14);
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.strokeRect(S * 0.44, S * 0.62, S * 0.12, S * 0.14);
  },
  cookie(g, S) {
    blob(g, S * 0.5, S * 0.52, S * 0.32, S * 0.32, "#e7b07a");
    blob(g, S * 0.38, S * 0.44, S * 0.06, S * 0.05, "#6a3a1a");
    blob(g, S * 0.62, S * 0.58, S * 0.05, S * 0.05, "#6a3a1a");
    blob(g, S * 0.55, S * 0.36, S * 0.045, S * 0.04, "#6a3a1a");
  },
  pop(g, S) {
    blob(g, S * 0.5, S * 0.36, S * 0.2, S * 0.2, "#ff5a9a");
    blob(g, S * 0.5, S * 0.72, S * 0.05, S * 0.2, "#f4f7fb");
  },
  cream(g, S) {
    blob(g, S * 0.5, S * 0.62, S * 0.28, S * 0.16, "#fff6ea");
    blob(g, S * 0.5, S * 0.4, S * 0.12, S * 0.12, "#e23b3b");
    blob(g, S * 0.42, S * 0.34, S * 0.04, S * 0.05, "#3d9a4a");
  },
  volcano(g, S) {
    poly(g, [[S * 0.5, S * 0.18], [S * 0.12, S * 0.86], [S * 0.88, S * 0.86]], "#4a2018");
    poly(g, [[S * 0.5, S * 0.28], [S * 0.38, S * 0.48], [S * 0.62, S * 0.48]], "#ff4a18");
    blob(g, S * 0.42, S * 0.16, S * 0.1, S * 0.08, "#6a5348");
    blob(g, S * 0.58, S * 0.1, S * 0.08, S * 0.06, "#8a7568");
  },
  rock(g, S) {
    poly(g, [[S * 0.2, S * 0.75], [S * 0.35, S * 0.35], [S * 0.62, S * 0.28], [S * 0.84, S * 0.55], [S * 0.7, S * 0.8]], "#3a2418");
  },
  monkey(g, S) {
    blob(g, S * 0.5, S * 0.22, S * 0.06, S * 0.16, "#6a4424");
    blob(g, S * 0.5, S * 0.55, S * 0.16, S * 0.18, "#c47a3a");
    blob(g, S * 0.5, S * 0.74, S * 0.13, S * 0.12, "#e8c9a0");
    eye(g, S * 0.44, S * 0.72, 4);
    eye(g, S * 0.56, S * 0.72, 4);
    poly(g, [[S * 0.28, S * 0.5], [S * 0.1, S * 0.7], [S * 0.32, S * 0.62]], "#c47a3a");
    poly(g, [[S * 0.72, S * 0.5], [S * 0.9, S * 0.68], [S * 0.68, S * 0.62]], "#c47a3a");
  },
  parrot(g, S) {
    blob(g, S * 0.48, S * 0.55, S * 0.18, S * 0.16, "#3d9a4a");
    blob(g, S * 0.66, S * 0.46, S * 0.12, S * 0.11, "#e23b3b");
    poly(g, [[S * 0.74, S * 0.48], [S * 0.94, S * 0.52], [S * 0.74, S * 0.58]], "#f2c14a");
    poly(g, [[S * 0.3, S * 0.48], [S * 0.1, S * 0.3], [S * 0.36, S * 0.55]], "#f2c14a");
    eye(g, S * 0.7, S * 0.42, 5);
  },
  leaf(g, S) {
    poly(g, [[S * 0.5, S * 0.15], [S * 0.15, S * 0.7], [S * 0.5, S * 0.55], [S * 0.85, S * 0.72]], "#3d9a4a");
    g.strokeStyle = "#1f5a28";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(S * 0.5, S * 0.22);
    g.lineTo(S * 0.5, S * 0.7);
    g.stroke();
  },
  vine(g, S) {
    g.strokeStyle = "#2f6a32";
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(S * 0.5, S * 0.05);
    g.bezierCurveTo(S * 0.7, S * 0.3, S * 0.3, S * 0.55, S * 0.5, S * 0.95);
    g.stroke();
    g.strokeStyle = INK;
    g.lineWidth = 14;
    g.globalCompositeOperation = "destination-over";
    g.stroke();
    g.globalCompositeOperation = "source-over";
    blob(g, S * 0.32, S * 0.4, S * 0.1, S * 0.06, "#7adf5a");
    blob(g, S * 0.68, S * 0.62, S * 0.1, S * 0.06, "#3d9a4a");
  },
  alien(g, S, color) {
    blob(g, S * 0.5, S * 0.58, S * 0.2, S * 0.22, color);
    blob(g, S * 0.34, S * 0.28, S * 0.035, S * 0.12, color);
    blob(g, S * 0.66, S * 0.28, S * 0.035, S * 0.12, color);
    blob(g, S * 0.34, S * 0.16, S * 0.045, S * 0.045, "#f2e27a");
    blob(g, S * 0.66, S * 0.16, S * 0.045, S * 0.045, "#f2e27a");
    eye(g, S * 0.42, S * 0.54, 8);
    eye(g, S * 0.58, S * 0.54, 8);
  },
  ufo(g, S) {
    blob(g, S * 0.5, S * 0.58, S * 0.34, S * 0.1, "#c5ced8");
    blob(g, S * 0.5, S * 0.46, S * 0.14, S * 0.12, "#9af0c8");
    blob(g, S * 0.5, S * 0.48, S * 0.06, S * 0.05, "#6adf5a");
    blob(g, S * 0.28, S * 0.62, S * 0.04, S * 0.04, "#ffe14a");
    blob(g, S * 0.5, S * 0.64, S * 0.04, S * 0.04, "#ff5a9a");
    blob(g, S * 0.72, S * 0.62, S * 0.04, S * 0.04, "#3ec4ff");
    poly(g, [[S * 0.38, S * 0.68], [S * 0.5, S * 0.95], [S * 0.62, S * 0.68]], "rgba(198,242,160,0.9)");
  },
  sprout(g, S) {
    blob(g, S * 0.5, S * 0.7, S * 0.08, S * 0.18, "#6a4ad0");
    blob(g, S * 0.5, S * 0.4, S * 0.16, S * 0.16, "#c6f25a");
    blob(g, S * 0.5, S * 0.36, S * 0.06, S * 0.06, "#f2e27a");
  },
  gear(g, S) {
    blob(g, S * 0.5, S * 0.5, S * 0.22, S * 0.22, "#b7c0ca");
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      blob(g, S * 0.5 + Math.cos(a) * S * 0.28, S * 0.5 + Math.sin(a) * S * 0.28, S * 0.08, S * 0.08, "#d5dde6");
    }
    blob(g, S * 0.5, S * 0.5, S * 0.08, S * 0.08, "#5c646e");
  },
  pipe(g, S) {
    blob(g, S * 0.5, S * 0.62, S * 0.16, S * 0.28, "#8a929c");
    blob(g, S * 0.5, S * 0.3, S * 0.22, S * 0.08, "#c5ced8");
  },
  bot(g, S) {
    blob(g, S * 0.38, S * 0.78, S * 0.08, S * 0.08, "#5c646e");
    blob(g, S * 0.62, S * 0.78, S * 0.08, S * 0.08, "#5c646e");
    blob(g, S * 0.5, S * 0.55, S * 0.2, S * 0.16, "#3ec4ff");
    blob(g, S * 0.5, S * 0.32, S * 0.14, S * 0.1, "#d5dde6");
    eye(g, S * 0.44, S * 0.3, 4);
    eye(g, S * 0.56, S * 0.3, 4);
  },
};

function buildWood(group, m) {
  const sq = stamp(group, "squirrel", draw.squirrel, 0, m.foot, m.far, 1.3, 1.15, 0.08);
  idle(sq, 0.03, 2.2);
  stamp(group, "tree", draw.tree, -m.outer * 0.82, m.foot, m.sky, 1.45, 1.5, 0.1);
  const bird = stamp(group, "bluebird", draw.bluebird, -m.outer * 0.72, m.foot + 0.35, m.sky - 0.05, 0.9, 0.62, 0.15);
  idle(bird, 0.035, 3);
  stamp(group, "tree", draw.tree, m.outer * 0.82, m.foot, m.sky, 1.25, 1.35, 0.1);
}

function buildDesert(group, m) {
  stamp(group, "dune", draw.dune, -m.outer * 0.48, m.foot, m.sky, 2.2, 1.15, 0.12);
  stamp(group, "dune", draw.dune, m.outer * 0.52, m.foot, m.sky, 1.9, 1.0, 0.12);
  stamp(group, "cactus", draw.cactus, -m.outer * 0.92, m.foot, m.far, 0.75, 1.2, 0.08);
  const liz = stamp(group, "lizard", draw.lizard, 0.15, m.foot, m.far, 1.5, 0.78, 0.1);
  idle(liz, 0.02, 2);
}

function buildIce(group, m) {
  const pen = stamp(group, "penguin", draw.penguin, 0, m.foot, m.far, 1.2, 1.45, 0.06);
  idle(pen, 0.03, 2.1);
  loop((time) => { tilt(pen, Math.sin(time * 2.1) * 0.06); });
  stamp(group, "iceberg", draw.iceberg, -m.outer * 0.9, m.foot, m.sky, 2.05, 1.75, 0.1);
  stamp(group, "iceberg", draw.iceberg, m.outer * 0.9, m.foot, m.sky, 1.7, 1.45, 0.1);
  const count = 11;
  const span = m.outer * 1.75;
  for (let i = 0; i < count; i++) {
    const x = -span / 2 + (i + 0.5) * (span / count);
    const h = 0.32 + (i % 3) * 0.08;
    stamp(group, "icicle", draw.icicle, x, 0.55, m.near - 0.04, 0.34, h, 0.88);
  }
}

function buildOcean(group, m) {
  const crab = stamp(group, "crab", draw.crab, 0, m.foot, m.far, 1.25, 1.05, 0.08);
  idle(crab, 0.03, 2.4);
  const gull = stamp(group, "gull", draw.gull, -m.outer * 0.72, m.foot + 0.45, m.sky, 1.15, 0.72, 0.2);
  idle(gull, 0.04, 2.6);
  stamp(group, "wave", draw.wave, -m.outer * 0.35, m.foot, m.sky, 1.5, 0.7, 0.2);
  stamp(group, "wave", draw.wave, m.outer * 0.55, m.foot, m.sky, 1.35, 0.62, 0.2);
}

function buildCrystal(group, m) {
  [[-0.82, "#9a78f0", 1.15], [0.82, "#7eb6e8", 1.0], [-0.55, "#e4ecff", 0.7]].forEach(([x, color, s], i) => {
    const gem = stamp(group, `gem-${i}`, (g, S) => draw.crystal(g, S, color), x * m.outer, m.foot, m.sky, 0.95 * s, 1.4 * s, 0.08);
    idle(gem, 0.03, 1.8 + i);
  });
  const fly = stamp(group, "butterfly", draw.butterfly, 0.2, m.foot + 0.35, m.sky, 0.8, 0.65, 0.4);
  idle(fly, 0.06, 3);
}

function buildToy(group, m) {
  const bot = stamp(group, "robot", draw.robot, 0, m.foot, m.far, 1.15, 1.25, 0.06);
  idle(bot, 0.03, 2.2);
  stamp(group, "block-r", (g, s) => draw.block(g, s, "#e23b3b"), -m.outer * 0.88, m.foot, m.sky, 0.62, 0.62, 0.12);
  stamp(group, "block-b", (g, s) => draw.block(g, s, "#2f7dff"), -m.outer * 0.88, m.foot + 0.48, m.sky, 0.48, 0.48, 0.12);
  stamp(group, "block-y", (g, s) => draw.block(g, s, "#f2c14a"), m.outer * 0.86, m.foot, m.sky, 0.7, 0.78, 0.12);
  stamp(group, "block-g", (g, s) => draw.block(g, s, "#3d9a4a"), m.outer * 0.62, m.foot + 0.15, m.sky, 0.48, 0.48, 0.12);
}

function buildMushroom(group, m) {
  stamp(group, "house-a", (g, s) => draw.house(g, s, "#e23b3b"), -m.outer * 0.7, m.foot, m.sky, 1.4, 1.45, 0.1);
  stamp(group, "house-b", (g, s) => draw.house(g, s, "#c46eb0"), m.outer * 0.72, m.foot, m.sky, 1.2, 1.25, 0.1);
  stamp(group, "mush-s", (g, s) => draw.mushroom(g, s, "#e23b3b"), -m.outer * 0.28, m.foot, m.far, 0.7, 0.62, 0.1);
  stamp(group, "mush-p", (g, s) => draw.mushroom(g, s, "#f08ab0"), m.outer * 0.3, m.foot, m.far, 0.62, 0.55, 0.1);
}

function buildCandy(group, m) {
  const popA = stamp(group, "pop", draw.pop, -m.outer * 0.82, m.foot, m.sky, 0.95, 1.45, 0.1);
  const popB = stamp(group, "pop", draw.pop, m.outer * 0.82, m.foot, m.sky, 0.85, 1.3, 0.1);
  loop((time) => {
    tilt(popA, Math.sin(time * 1.6) * 0.08);
    tilt(popB, Math.sin(time * 1.6 + 1) * 0.08);
  });
  stamp(group, "cream", draw.cream, -m.outer * 0.45, m.foot, m.far, 0.7, 0.6, 0.1);
  stamp(group, "cream", draw.cream, m.outer * 0.42, m.foot, m.far, 0.62, 0.55, 0.1);
}

function buildLava(group, m) {
  const v1 = stamp(group, "volcano", draw.volcano, -m.outer * 0.78, m.foot, m.sky, 1.6, 1.5, 0.1);
  const v2 = stamp(group, "volcano", draw.volcano, m.outer * 0.78, m.foot, m.sky, 1.3, 1.25, 0.1);
  idle(v1, 0.02, 1.5);
  idle(v2, 0.02, 1.8);
}

function buildJungle(group, m) {
  stamp(group, "leaf", draw.leaf, -m.outer * 0.72, m.foot, m.sky, 1.55, 1.25, 0.12);
  stamp(group, "leaf", draw.leaf, m.outer * 0.35, m.foot, m.sky, 1.2, 1.0, 0.12);
  const vine = stamp(group, "vine", draw.vine, m.outer * 0.86, m.foot, m.far, 0.55, 1.45, 0.05);
  const monk = stamp(group, "monkey", draw.monkey, m.outer * 0.86, m.foot - 0.05, m.far, 0.9, 1.2, 0.08);
  loop((time) => {
    const s = Math.sin(time * 1.6);
    tilt(monk, s * 0.18);
    tilt(vine, s * 0.06);
  });
  const bird = stamp(group, "parrot", draw.parrot, -m.outer * 0.35, m.foot, m.far, 1.0, 0.85, 0.12);
  idle(bird, 0.03, 2.4);
}

function buildAlien(group, m) {
  const alien = stamp(group, "alien-g", (g, s) => draw.alien(g, s, "#6adf5a"), 0, m.foot, m.far, 1.1, 1.25, 0.06);
  idle(alien, 0.03, 2);
  const ufo = stamp(group, "ufo", draw.ufo, m.outer * 0.55, m.foot + 0.35, m.sky, 1.25, 0.85, 0.35);
  idle(ufo, 0.04, 1.6);
  stamp(group, "sprout", draw.sprout, -m.outer * 0.82, m.foot, m.sky, 0.9, 1.15, 0.1);
  stamp(group, "sprout", draw.sprout, m.outer * 0.88, m.foot, m.far, 0.75, 1.0, 0.1);
}

function buildMachine(group, m) {
  const bot = stamp(group, "bot", draw.bot, 0, m.foot, m.far, 1.1, 1.15, 0.06);
  idle(bot, 0.025, 2);
  [[-0.82, m.sky, 0.85, 1], [0.84, m.sky, 0.7, -1]].forEach(([x, z, size, dir], i) => {
    const gear = stamp(group, "gear", draw.gear, x * m.outer, m.foot, z, size, size, 0.12);
    loop((time) => { ownMat(gear).rotation = time * 0.7 * dir; });
  });
  stamp(group, "pipe", draw.pipe, -m.outer * 0.4, m.foot, m.sky, 0.75, 1.2, 0.1);
  stamp(group, "pipe", draw.pipe, m.outer * 0.4, m.foot, m.sky, 0.6, 1.0, 0.1);
}

const BUILDERS = {
  wood: buildWood,
  desert: buildDesert,
  ice: buildIce,
  ocean: buildOcean,
  crystal: buildCrystal,
  toy: buildToy,
  mushroom: buildMushroom,
  candy: buildCandy,
  lava: buildLava,
  jungle: buildJungle,
  alien: buildAlien,
  machine: buildMachine,
};

export function createBoardDeco(planet, span, frameT = 0.46) {
  const group = new THREE.Group();
  group.name = "board-deco";
  const m = metrics(span, frameT);
  spriteUnit = m.unit;
  const build = BUILDERS[planet] || BUILDERS.wood;
  build(group, m);
  return group;
}

function remember(sprite) {
  if (!sprite.userData.home) {
    sprite.userData.home = {
      x: sprite.position.x,
      z: sprite.position.z,
      cx: sprite.center.x,
      cy: sprite.center.y,
      sx: sprite.scale.x,
      sy: sprite.scale.y,
    };
  }
  return sprite.userData.home;
}

// "frame" keeps the mockup placement on the top and bottom rails.
// "sides" parks that trim in the left and right gutters when the board
// is fitted to a short, wide play rectangle.
export function layoutDeco(group, mode, half) {
  if (!group) return;
  const sprites = [];
  group.traverse((obj) => {
    if (obj.isSprite) sprites.push(obj);
  });
  const left = [];
  const right = [];
  sprites.forEach((sprite, i) => {
    const home = remember(sprite);
    if (mode !== "sides") {
      sprite.position.x = home.x;
      sprite.position.z = home.z;
      sprite.center.set(home.cx, home.cy);
      sprite.scale.set(home.sx, home.sy, 1);
      return;
    }
    const sign = home.x < -0.08 ? -1 : home.x > 0.08 ? 1 : (i % 2 ? 1 : -1);
    (sign < 0 ? left : right).push(sprite);
  });
  if (mode !== "sides") return;
  const place = (list, sign) => {
    list.sort((a, b) => a.userData.home.z - b.userData.home.z || a.userData.home.x - b.userData.home.x);
    list.forEach((sprite, i) => {
      const home = sprite.userData.home;
      const t = list.length === 1 ? 0.5 : i / (list.length - 1);
      sprite.position.x = sign * (half - 0.22);
      sprite.position.z = (t - 0.5) * half * 1.15;
      sprite.center.set(sign < 0 ? 0.86 : 0.14, 0.5);
      const flip = Math.sign(home.sx) || 1;
      const fit = 0.62;
      sprite.scale.set(Math.abs(home.sx) * fit * flip, home.sy * fit, 1);
    });
  };
  place(left, -1);
  place(right, 1);
}
