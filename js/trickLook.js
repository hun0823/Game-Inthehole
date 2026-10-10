/**
 * Trick skins. Positions, sizes, and which edge blocks stay with board3d.js.
 * This file only builds the meshes and a few idle loops.
 */
import * as THREE from "./vendor/three.module.js";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";

const BOARD_TOP = 0.5;
const WALL_H = 0.46;
const CELL = 0.98;
const INK = 0x141414;
const ARROW = 0xf0a020;
const ARROW_GLOW = 0xc47a08;
const PAIR = 0xd946ef;
const GEM = { red: 0xe23b3b, blue: 0x2f7dff, green: 0x1ea85a, purple: 0xa43adf };
const GLYPH = { red: "circle", blue: "square", green: "triangle", purple: "star" };

const actors = [];
const stds = new Map();
const boxes = new Map();
const ghostOf = new Map();

export function trickVariant(planet) {
  if (planet === "alien") return "alien";
  if (planet === "machine") return "machine";
  return "home";
}

export function beginTricks() {
  actors.length = 0;
}

export function tickTricks(time, dt) {
  for (const step of actors) step(time, dt);
}

function std(hex, extra = {}) {
  const key = `${hex}|${extra.roughness ?? ""}|${extra.emissive ?? ""}|${extra.opacity ?? ""}|${extra.metal ?? ""}`;
  let mat = stds.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: extra.roughness ?? 0.72,
      metalness: extra.metal ?? 0,
      emissive: extra.emissive ?? 0x000000,
      emissiveIntensity: extra.emissiveIntensity ?? (extra.emissive ? 0.35 : 0),
      transparent: (extra.opacity ?? 1) < 1,
      opacity: extra.opacity ?? 1,
      depthWrite: (extra.opacity ?? 1) >= 0.95,
      polygonOffset: true,
      polygonOffsetFactor: extra.offset ?? -1,
      polygonOffsetUnits: extra.offset ?? -1,
    });
    stds.set(key, mat);
  }
  return mat;
}

function ghost(mat) {
  let next = ghostOf.get(mat.uuid);
  if (!next) {
    next = mat.clone();
    next.transparent = true;
    next.opacity = 0.32;
    next.depthWrite = false;
    ghostOf.set(mat.uuid, next);
  }
  return next;
}

function roundBox(w, h, d, rad = 0.12) {
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${rad.toFixed(3)}`;
  let geo = boxes.get(key);
  if (!geo) {
    const radius = Math.min(rad, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    geo = new RoundedBoxGeometry(w, h, d, 2, Math.max(0.02, radius));
    boxes.set(key, geo);
  }
  return geo;
}

function slab(parent, w, h, d, material, y) {
  const mesh = new THREE.Mesh(roundBox(w, h, d), material);
  mesh.position.y = y;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function canvasTex(draw, size = 128) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const rippleTex = {
  home: null,
  alien: null,
  machine: null,
};
function sandRipple(variant) {
  if (rippleTex[variant]) return rippleTex[variant];
  const pal = {
    home: ["#e2b15a", "#c4842a", "#8a4e12"],
    alien: ["#b49aff", "#6a4ad0", "#3a2868"],
    machine: ["#6a737e", "#3a4048", "#f2c14a"],
  }[variant];
  rippleTex[variant] = canvasTex((g, s) => {
    g.fillStyle = pal[1];
    g.fillRect(0, 0, s, s);
    g.strokeStyle = pal[0];
    g.lineWidth = 3;
    for (let i = 1; i <= 5; i++) {
      g.beginPath();
      g.ellipse(s * 0.5, s * 0.55, 10 + i * 10, 6 + i * 6, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = pal[2];
    for (const [x, y, r] of [[28, 36, 5], [96, 44, 4], [70, 88, 6], [40, 78, 3]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    if (variant === "machine") {
      g.strokeStyle = pal[2];
      g.lineWidth = 6;
      for (let y = 18; y < s; y += 22) {
        g.beginPath();
        g.moveTo(8, y);
        g.lineTo(36, y);
        g.moveTo(64, y + 8);
        g.lineTo(100, y + 8);
        g.stroke();
      }
    }
  });
  return rippleTex[variant];
}

const iceTex = { home: null, alien: null, machine: null };
function iceStreak(variant) {
  if (iceTex[variant]) return iceTex[variant];
  const line = variant === "alien" ? "rgba(255,255,255,0.8)" : variant === "machine" ? "rgba(180,230,255,0.9)" : "rgba(255,255,255,0.85)";
  const fill = variant === "alien" ? "#7a5ad8" : variant === "machine" ? "#8aa0b0" : "#7fe0ff";
  iceTex[variant] = canvasTex((g, s) => {
    g.fillStyle = fill;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = line;
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(8, s - 16);
    g.lineTo(s - 16, 12);
    g.moveTo(28, s - 8);
    g.lineTo(s - 8, 36);
    g.stroke();
  });
  return iceTex[variant];
}

let swirlTex = null;
function swirlMap() {
  if (swirlTex) return swirlTex;
  swirlTex = canvasTex((g, s) => {
    g.clearRect(0, 0, s, s);
    g.translate(s / 2, s / 2);
    for (let arm = 0; arm < 3; arm++) {
      g.rotate((Math.PI * 2) / 3);
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.lineWidth = 8;
      g.beginPath();
      for (let i = 0; i < 28; i++) {
        const t = i / 28;
        const r = 8 + t * 52;
        const a = t * 3.4;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
  });
  return swirlTex;
}

const glyphTex = {};
function glyphMap(kind) {
  if (glyphTex[kind]) return glyphTex[kind];
  glyphTex[kind] = canvasTex((g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = "#fffaf0";
    g.translate(s / 2, s / 2);
    if (kind === "circle") {
      g.beginPath();
      g.arc(0, 0, 28, 0, Math.PI * 2);
      g.fill();
    } else if (kind === "square") {
      g.fillRect(-24, -24, 48, 48);
    } else if (kind === "triangle") {
      g.beginPath();
      g.moveTo(0, -30);
      g.lineTo(28, 22);
      g.lineTo(-28, 22);
      g.fill();
    } else {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 ? 14 : 32;
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const x = Math.cos(a) * rad;
        const y = Math.sin(a) * rad;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.closePath();
      g.fill();
    }
  }, 128);
  glyphTex[kind].premultiplyAlpha = false;
  return glyphTex[kind];
}

let faceTex = null;
function jellyFace() {
  if (faceTex) return faceTex;
  faceTex = canvasTex((g, s) => {
    g.clearRect(0, 0, s, s);
    g.strokeStyle = "#3a1830";
    g.lineWidth = 8;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(36, 48);
    g.lineTo(48, 64);
    g.lineTo(60, 48);
    g.moveTo(68, 48);
    g.lineTo(80, 64);
    g.lineTo(92, 48);
    g.stroke();
  });
  return faceTex;
}

const basicCache = new Map();
const mappedCache = new Map();
function mapped(map, roughness) {
  const key = `${map.uuid}|${roughness}`;
  let mat = mappedCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      map,
      color: 0xffffff,
      roughness,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    mappedCache.set(key, mat);
  }
  return mat;
}

const tintedCache = new Map();
function tinted(map, hex) {
  const key = `${map.uuid}|${hex}`;
  let mat = tintedCache.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      map,
      color: hex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    tintedCache.set(key, mat);
  }
  return mat;
}

function basic(map, opacity = 1) {
  const key = `${map.uuid}|${opacity}`;
  let mat = basicCache.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      map,
      color: 0xffffff,
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    basicCache.set(key, mat);
  }
  return mat;
}

function disc(parent, radius, material, y) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 22), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  parent.add(mesh);
  return mesh;
}

function cellGroup(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  return group;
}

const SAND = {
  home: { fill: 0xd0892a, rim: 0x8a4e12, deep: 0xc47a28, ink: 0x141414 },
  alien: { fill: 0x6a4ad0, rim: 0x3a2868, deep: 0x4a32a0, ink: 0x141414 },
  machine: { fill: 0x3a4048, rim: 0x1c2026, deep: 0x2a2e34, ink: 0x141414 },
};

export function makeSand(x, z, variant) {
  const pal = SAND[variant] || SAND.home;
  const group = cellGroup(x, z);
  slab(group, CELL * 1.06, 0.028, CELL * 1.06, std(INK, { roughness: 0.9, offset: -1 }), BOARD_TOP + 0.02);
  slab(group, CELL, 0.045, CELL, std(pal.rim, { roughness: 0.88 }), BOARD_TOP + 0.032);
  slab(group, CELL * 0.78, 0.03, CELL * 0.78, std(pal.deep, { roughness: 0.95 }), BOARD_TOP + 0.04);
  disc(group, CELL * 0.34, mapped(sandRipple(variant), 0.92), BOARD_TOP + 0.058);
  return group;
}

const ICE = {
  home: { fill: 0x7fe7ff, rim: 0xeaf8ff, glow: 0x1aa8ee },
  alien: { fill: 0x9a78f0, rim: 0xe4d8ff, glow: 0x6a3ad0 },
  machine: { fill: 0x9eb4c4, rim: 0xd7f4ff, glow: 0x3ec4ff },
};

export function makeIce(x, z, variant) {
  const pal = ICE[variant] || ICE.home;
  const group = cellGroup(x, z);
  slab(group, CELL * 1.05, 0.026, CELL * 1.05, std(INK, { roughness: 0.6 }), BOARD_TOP + 0.02);
  const body = slab(group, CELL, 0.04, CELL, std(pal.fill, { roughness: 0.22, emissive: pal.glow, emissiveIntensity: 0.25 }), BOARD_TOP + 0.034);
  disc(group, CELL * 0.36, mapped(iceStreak(variant), 0.18), BOARD_TOP + 0.058);
  actors.push((time) => {
    body.material.emissiveIntensity = 0.18 + Math.sin(time * 1.6) * 0.07;
  });
  return group;
}

const JELLY = {
  home: { fill: 0xff5a9a, glow: 0xff4d88, face: 0x3a1830 },
  alien: { fill: 0x6adf5a, glow: 0x1c8a2c, face: 0x143018 },
  machine: { fill: 0xc5ced8, glow: 0x8a929c, face: 0x2a3038 },
};

export function makeJelly(x, z, variant) {
  const pal = JELLY[variant] || JELLY.home;
  const group = cellGroup(x, z);
  slab(group, CELL * 1.04, 0.03, CELL * 1.04, std(INK, { roughness: 0.5 }), BOARD_TOP + 0.02);
  const cushion = slab(
    group,
    CELL * 0.92,
    0.09,
    CELL * 0.92,
    std(pal.fill, { roughness: 0.22, emissive: pal.glow, emissiveIntensity: 0.28, opacity: variant === "machine" ? 1 : 0.94 }),
    BOARD_TOP + 0.06
  );
  if (variant === "machine") {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 12), std(0xe07a3a, { roughness: 0.4, metal: 0.4 }));
    coil.rotation.x = Math.PI / 2;
    coil.position.y = BOARD_TOP + 0.1;
    group.add(coil);
    const coil2 = coil.clone();
    coil2.scale.setScalar(0.62);
    coil2.position.y = BOARD_TOP + 0.14;
    group.add(coil2);
  } else {
    const face = disc(group, 0.22, basic(jellyFace()), BOARD_TOP + 0.11);
    face.renderOrder = 2;
  }
  actors.push((time) => {
    const bob = 1 + Math.sin(time * 3) * 0.04;
    cushion.scale.y = bob;
  });
  return group;
}

export function makeSmog(x, z, row, col, variant) {
  const group = cellGroup(x, z);
  const cover = new THREE.Group();
  const cloud = variant === "alien" ? 0x7adf5a : variant === "machine" ? 0xe8eef4 : 0xc06ad8;
  const shade = variant === "alien" ? 0x3d9a4a : variant === "machine" ? 0xb7c4d0 : 0x7a3a98;
  const puffGeo = new THREE.SphereGeometry(0.22, 7, 5);
  const spots = [[-0.22, 0.42, 0.05], [0.18, 0.5, -0.08], [0.02, 0.58, 0.12], [-0.08, 0.36, -0.16], [0.24, 0.38, 0.14], [-0.28, 0.5, 0.1]];
  spots.forEach(([px, py, pz], i) => {
    const mesh = new THREE.Mesh(puffGeo, std(i % 2 ? cloud : shade, { roughness: 0.85, opacity: 0.9 }));
    mesh.position.set(px, BOARD_TOP + py, pz);
    mesh.scale.set(1.15, 0.78, 1);
    cover.add(mesh);
  });
  group.add(cover);
  const capColor = variant === "machine" ? 0x8a929c : variant === "alien" ? 0xc6f25a : 0xe23b3b;
  const stemColor = variant === "machine" ? 0x5c646e : 0xf4f0ea;
  for (const side of [-1, 1]) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 6), std(stemColor, { roughness: 0.7 }));
    stem.position.set(side * 0.32, BOARD_TOP + 0.08, side * 0.22);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), std(capColor, { roughness: 0.55 }));
    cap.scale.y = 0.55;
    cap.position.set(side * 0.32, BOARD_TOP + 0.15, side * 0.22);
    group.add(stem, cap);
  }
  const spores = [];
  const dot = new THREE.SphereGeometry(0.03, 5, 4);
  for (let i = 0; i < 4; i++) {
    const mote = new THREE.Mesh(dot, std(cloud, { emissive: cloud, emissiveIntensity: 0.4, roughness: 0.5 }));
    mote.position.set((i - 1.5) * 0.12, BOARD_TOP + 0.2, 0.05);
    group.add(mote);
    spores.push(mote);
  }
  group.userData = { row, col, cover };
  actors.push((time) => {
    cover.children.forEach((puff, i) => {
      puff.position.x = spots[i][0] + Math.sin(time * 2.1 + i) * 0.04;
    });
    spores.forEach((mote, i) => {
      mote.position.y = BOARD_TOP + 0.18 + ((time * 0.35 + i * 0.2) % 0.45);
    });
  });
  return group;
}

const MAGMA = {
  home: { calm: 0x5a2818, hot: 0xff4a18, rock: 0x3a1812 },
  alien: { calm: 0x4a2880, hot: 0xc07aff, rock: 0x2a1848 },
  machine: { calm: 0x3a4048, hot: 0xff6a18, rock: 0x5c646e },
};

function crackFan(material) {
  const group = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.42, 0.02, 0.045);
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Mesh(geo, material);
    arm.rotation.y = (i / 5) * Math.PI;
    arm.position.y = BOARD_TOP + 0.03;
    group.add(arm);
  }
  return group;
}

export function makeMagma(x, z, at, variant) {
  const pal = MAGMA[variant] || MAGMA.home;
  const group = cellGroup(x, z);
  const calmMat = std(pal.calm, { roughness: 0.8, emissive: pal.calm, emissiveIntensity: 0.25 });
  const warnMat = std(pal.hot, { roughness: 0.35, emissive: pal.hot, emissiveIntensity: 0.85 });
  const calm = crackFan(calmMat);
  const warn = crackFan(warnMat);
  const hot = new THREE.Group();
  const rockGeo = new THREE.ConeGeometry(0.16, 0.42, 5);
  for (let i = 0; i < 5; i++) {
    const rock = new THREE.Mesh(rockGeo, std(pal.rock, { roughness: 0.86 }));
    const a = (i / 5) * Math.PI * 2;
    rock.position.set(Math.cos(a) * 0.16, BOARD_TOP + 0.24, Math.sin(a) * 0.16);
    rock.rotation.z = Math.cos(a) * 0.25;
    rock.rotation.x = Math.sin(a) * 0.2;
    hot.add(rock);
  }
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(0.2, 12),
    std(pal.hot, { roughness: 0.3, emissive: pal.hot, emissiveIntensity: 0.7 })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = BOARD_TOP + 0.42;
  hot.add(pool);
  group.add(calm, warn, hot);
  if (variant === "machine") {
    const grate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.08), std(0x2a3038, { metal: 0.5, roughness: 0.4 }));
    grate.position.y = BOARD_TOP + 0.08;
    const grate2 = grate.clone();
    grate2.rotation.y = Math.PI / 2;
    group.add(grate, grate2);
  }
  group.userData = { at, calm, warn, hot };
  actors.push((time) => {
    calmMat.emissiveIntensity = 0.15 + Math.sin(time * 2) * 0.08;
    warnMat.emissiveIntensity = 0.85 + Math.sin(time * 8) * 0.25;
    if (hot.visible) pool.position.y = BOARD_TOP + 0.4 + Math.sin(time * 6) * 0.03;
  });
  return group;
}

export function makeTeleport(x, z, variant) {
  const group = cellGroup(x, z);
  const well = variant === "alien" ? 0x3a1868 : variant === "machine" ? 0x2a3138 : 0x0c4a66;
  const arm = variant === "alien" ? 0xd0b6ff : variant === "machine" ? 0x7fd6ff : 0x9ee7ff;
  slab(group, CELL * 0.92, 0.03, CELL * 0.92, std(INK), BOARD_TOP + 0.018);
  disc(group, 0.4, std(well, { roughness: 0.4, emissive: well, emissiveIntensity: 0.35 }), BOARD_TOP + 0.03);
  const spin = disc(group, 0.36, tinted(swirlMap(), arm), BOARD_TOP + 0.04);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 8, 20), std(PAIR, { roughness: 0.4, emissive: 0xa21caf, emissiveIntensity: 0.35 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = BOARD_TOP + 0.06;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), std(PAIR, { emissive: 0xa21caf, emissiveIntensity: 0.4 }));
  dot.position.y = BOARD_TOP + 0.12;
  group.add(ring, dot);
  actors.push((time) => {
    spin.rotation.z = time * ((Math.PI * 2) / 3);
  });
  return group;
}

let arrowGeo = null;
function flatArrow() {
  if (arrowGeo) return arrowGeo;
  const shape = new THREE.Shape();
  shape.moveTo(0.26, 0);
  shape.lineTo(-0.08, 0.16);
  shape.lineTo(-0.08, 0.06);
  shape.lineTo(-0.28, 0.06);
  shape.lineTo(-0.28, -0.06);
  shape.lineTo(-0.08, -0.06);
  shape.lineTo(-0.08, -0.16);
  shape.closePath();
  arrowGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false });
  arrowGeo.translate(0, 0, -0.03);
  arrowGeo.rotateX(-Math.PI / 2);
  return arrowGeo;
}

const YAW = { right: 0, left: Math.PI, up: Math.PI / 2, down: -Math.PI / 2 };
const SLIDE = { left: [-0.22, 0], right: [0.22, 0], up: [0, -0.22], down: [0, 0.22] };

export function makeCurrent(x, z, dir, variant) {
  const group = new THREE.Group();
  const off = SLIDE[dir] || SLIDE.right;
  group.position.set(x + off[0], 0, z + off[1]);
  if (variant === "machine") {
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.28), std(0x3a4048, { roughness: 0.45, metal: 0.35 }));
    belt.position.y = BOARD_TOP + 0.03;
    group.add(belt);
  } else if (variant === "alien") {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.04, 12), std(0x4a2880, { roughness: 0.5, emissive: 0x6a3ad0, emissiveIntensity: 0.25 }));
    pad.position.y = BOARD_TOP + 0.03;
    group.add(pad);
  } else {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12), std(0x146080, { roughness: 0.35, emissive: 0x0c4a66, emissiveIntensity: 0.2 }));
    pad.position.y = BOARD_TOP + 0.03;
    group.add(pad);
  }
  const arrow = new THREE.Mesh(flatArrow(), std(ARROW, { roughness: 0.4, emissive: ARROW_GLOW, emissiveIntensity: 0.25 }));
  arrow.position.y = BOARD_TOP + 0.07;
  const yaw = YAW[dir] || 0;
  arrow.rotation.y = yaw;
  group.add(arrow);
  const bubbles = [];
  const bubbleMat = std(0xeaf8ff, { roughness: 0.2, opacity: 0.85, emissive: 0xffffff, emissiveIntensity: 0.15 });
  for (let i = 0; i < 3; i++) {
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), bubbleMat);
    bubble.position.y = BOARD_TOP + 0.08;
    group.add(bubble);
    bubbles.push(bubble);
  }
  actors.push((time) => {
    const backX = -Math.cos(yaw);
    const backZ = Math.sin(yaw);
    bubbles.forEach((bubble, i) => {
      const t = (time * 0.7 + i * 0.33) % 1;
      bubble.position.x = backX * (0.05 + t * 0.32);
      bubble.position.z = backZ * (0.05 + t * 0.32);
      bubble.scale.setScalar(0.6 + t);
    });
  });
  return group;
}

const buttonGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.12, 16);
const baseGeo = new THREE.CylinderGeometry(0.3, 0.32, 0.05, 16);
const glyphGeo = new THREE.CircleGeometry(0.11, 16);

export function makeButton(x, z, color, row, col, variant) {
  const key = GEM[color] ? color : "red";
  const mat = new THREE.MeshStandardMaterial({
    color: GEM[key],
    emissive: GEM[key],
    emissiveIntensity: 0,
    roughness: 0.48,
  });
  const mesh = new THREE.Mesh(buttonGeo, mat);
  mesh.position.set(x, BOARD_TOP + 0.11, z);
  mesh.castShadow = true;
  const baseColor = variant === "alien" ? 0x4a3878 : variant === "machine" ? 0x8a929c : 0xfff6ea;
  const base = new THREE.Mesh(baseGeo, std(baseColor, { roughness: variant === "machine" ? 0.35 : 0.6, metal: variant === "machine" ? 0.4 : 0 }));
  base.position.y = -0.08;
  const mark = new THREE.Mesh(glyphGeo, basic(glyphMap(GLYPH[key] || "circle")));
  mark.rotation.x = -Math.PI / 2;
  mark.position.y = 0.065;
  mesh.add(base, mark);
  mesh.userData = {
    kind: "button",
    row,
    col,
    color,
    baseY: BOARD_TOP + 0.11,
    ownMat: true,
  };
  return mesh;
}

const GLASS = {
  home: { face: 0x2fd3f5, side: 0x0e7fa8, shard: 0xdffbff },
  alien: { face: 0xb49aff, side: 0x5a2ab0, shard: 0xe4d8ff },
  machine: { face: 0xb7e4f0, side: 0x5c646e, shard: 0xe8eef4 },
};
const glassMats = {};
function glassMaterial(variant) {
  if (!glassMats[variant]) {
    const pal = GLASS[variant] || GLASS.home;
    glassMats[variant] = new THREE.MeshPhysicalMaterial({
      color: pal.face,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: variant === "machine" ? 0.55 : 0.72,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      depthWrite: false,
    });
  }
  return glassMats[variant];
}

let zigTex = null;
function zigzag() {
  if (zigTex) return zigTex;
  zigTex = canvasTex((g, s) => {
    g.clearRect(0, 0, s, s);
    g.strokeStyle = "#ffffff";
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(8, s * 0.7);
    for (let i = 0; i < 6; i++) {
      g.lineTo(16 + i * 18, i % 2 ? s * 0.35 : s * 0.7);
    }
    g.stroke();
  }, 128);
  return zigTex;
}

export function dressGlass(group, mesh, w, d, variant) {
  const pal = GLASS[variant] || GLASS.home;
  mesh.material = glassMaterial(variant);
  mesh.userData.shardColor = pal.shard;
  const alongX = w >= d;
  const long = Math.max(w, d);
  const grain = std(0xf7ffff, { roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.25 });
  for (let i = 0; i < 3; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), grain);
    if (alongX) line.scale.set(long * 0.72, 0.012, 0.02);
    else line.scale.set(0.02, 0.012, long * 0.72);
    line.position.y = WALL_H / 2 + 0.008;
    const shift = (i - 1) * 0.06;
    if (alongX) line.position.z = shift;
    else line.position.x = shift;
    group.add(line);
  }
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.06, d * 0.92), std(pal.side, { roughness: 0.35 }));
  skirt.position.y = -WALL_H * 0.36;
  group.add(skirt);
  if (variant === "machine") {
    const steel = std(0x5c646e, { roughness: 0.35, metal: 0.55 });
    const frameT = 0.045;
    const rails = alongX
      ? [[w, frameT, d], [w, frameT, d]]
      : [[w, frameT, d], [w, frameT, d]];
    rails.forEach((scale, i) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), steel);
      rail.scale.set(scale[0], 0.04, scale[1] === frameT ? d : scale[2]);
      rail.position.y = (i === 0 ? 1 : -1) * WALL_H * 0.42;
      group.add(rail);
    });
  }
  if (mesh.userData.cracks) {
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(w, d) * 0.8, WALL_H * 0.7), basic(zigzag()));
    if (alongX) crack.position.z = d * 0.55;
    else {
      crack.rotation.y = Math.PI / 2;
      crack.position.x = w * 0.55;
    }
    mesh.userData.cracks.add(crack);
  }
}

export function dressGate(group, mesh, w, d, color, variant) {
  const key = GEM[color] ? color : "red";
  if (variant === "alien") {
    mesh.material = new THREE.MeshPhysicalMaterial({
      color: GEM[key],
      roughness: 0.15,
      transparent: true,
      opacity: 0.62,
      emissive: GEM[key],
      emissiveIntensity: 0.2,
      depthWrite: false,
    });
    mesh.userData.ownMat = true;
  } else if (variant === "machine") {
    mesh.material = std(0x4a525c, { roughness: 0.4, metal: 0.45 });
    const slat = new THREE.BoxGeometry(1, 1, 1);
    const slatMat = std(GEM[key], { roughness: 0.45 });
    for (let i = 0; i < 3; i++) {
      const bar = new THREE.Mesh(slat, slatMat);
      bar.scale.set(w * 0.92, 0.045, d * 0.92);
      bar.position.y = (i - 1) * 0.1;
      group.add(bar);
    }
  } else {
    const stud = new THREE.CylinderGeometry(0.045, 0.05, 0.04, 8);
    const studMat = std(0xfff6ea, { roughness: 0.45 });
    const alongX = w >= d;
    const long = Math.max(w, d);
    const count = Math.max(2, Math.round(long / 0.34));
    for (let i = 0; i < count; i++) {
      const nub = new THREE.Mesh(stud, studMat);
      const t = ((i + 0.5) / count - 0.5) * long * 0.7;
      nub.position.set(alongX ? t : 0, WALL_H / 2 + 0.02, alongX ? 0 : t);
      group.add(nub);
    }
  }
  const mark = new THREE.Mesh(glyphGeo, basic(glyphMap(GLYPH[key] || "circle")));
  mark.rotation.x = -Math.PI / 2;
  mark.position.y = WALL_H / 2 + 0.045;
  mark.scale.setScalar(1.35);
  group.add(mark);
}

export function makeGateGroove(x, z, w, d, color) {
  const key = GEM[color] ? color : "red";
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.92, 0.02, d * 0.92),
    std(GEM[key], { roughness: 0.5, emissive: GEM[key], emissiveIntensity: 0.15, offset: -2 })
  );
  mesh.position.set(x, BOARD_TOP + 0.02, z);
  return mesh;
}

const VINE = {
  home: { rope: 0x3d7a32, rope2: 0x5a8a3a, leaf: 0x7adf5a, root: 0x6a4a28 },
  alien: { rope: 0x6a4ad0, rope2: 0x9a78f0, leaf: 0xc8b0ff, root: 0x3a2868 },
  machine: { rope: 0x8a929c, rope2: 0xc5ced8, leaf: 0xf2c14a, root: 0x3a4048 },
};

export function dressVine(group, mesh, w, d, variant) {
  mesh.visible = false;
  mesh.castShadow = false;
  const pal = VINE[variant] || VINE.home;
  const visual = new THREE.Group();
  const alongX = w >= d;
  const length = Math.max(w, d) * 0.92;
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 6);
  if (variant === "machine") {
    const rod = new THREE.Mesh(cyl, std(pal.rope, { roughness: 0.35, metal: 0.6 }));
    rod.scale.set(0.1, length, 0.1);
    if (alongX) rod.rotation.z = Math.PI / 2;
    else rod.rotation.x = Math.PI / 2;
    const band = new THREE.Mesh(cyl, std(pal.leaf, { roughness: 0.4, emissive: pal.leaf, emissiveIntensity: 0.2 }));
    band.scale.set(0.14, 0.08, 0.14);
    visual.add(rod, band);
    for (const end of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.2), std(pal.root, { metal: 0.4, roughness: 0.4 }));
      if (alongX) cap.position.x = end * length * 0.48;
      else cap.position.z = end * length * 0.48;
      visual.add(cap);
    }
  } else {
    for (let i = 0; i < 2; i++) {
      const rope = new THREE.Mesh(cyl, std(i ? pal.rope2 : pal.rope, { roughness: 0.75 }));
      rope.scale.set(0.09, length, 0.09);
      if (alongX) {
        rope.rotation.z = Math.PI / 2;
        rope.position.z = i ? 0.04 : -0.04;
      } else {
        rope.rotation.x = Math.PI / 2;
        rope.position.x = i ? 0.04 : -0.04;
      }
      visual.add(rope);
    }
    const leafGeo = new THREE.SphereGeometry(1, 6, 4);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(leafGeo, std(pal.leaf, { roughness: 0.6 }));
      leaf.scale.set(0.16, 0.05, 0.1);
      const t = (i + 0.5) / 6 - 0.5;
      leaf.position.y = 0.06;
      if (alongX) {
        leaf.position.x = t * length * 0.85;
        leaf.position.z = i % 2 ? 0.1 : -0.1;
      } else {
        leaf.position.z = t * length * 0.85;
        leaf.position.x = i % 2 ? 0.1 : -0.1;
      }
      leaf.userData.leaf = i;
      visual.add(leaf);
    }
    for (const end of [-1, 1]) {
      const root = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), std(pal.root, { roughness: 0.9 }));
      root.scale.set(1.4, 0.6, 1);
      if (alongX) root.position.x = end * length * 0.46;
      else root.position.z = end * length * 0.46;
      root.position.y = -0.06;
      visual.add(root);
    }
    const leaves = [];
    visual.traverse((node) => {
      if (node.userData.leaf != null) leaves.push(node);
    });
    actors.push((time) => {
      leaves.forEach((leaf) => {
        leaf.rotation.z = Math.sin(time * Math.PI + leaf.userData.leaf) * 0.4;
      });
    });
  }
  visual.traverse((node) => {
    if (node.isMesh) node.userData.solidMat = node.material;
  });
  group.add(visual);
  mesh.userData.setPreview = (on) => {
    visual.traverse((node) => {
      if (!node.isMesh || !node.userData.solidMat) return;
      node.material = on ? ghost(node.userData.solidMat) : node.userData.solidMat;
    });
  };
}
