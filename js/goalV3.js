/**
 * Goal v3 props. The hole stays a floor recess (see addFloorSocket).
 * Pair props sit low, with a charcoal hull and a contact shadow.
 * Goal-in motion is goalGroup.userData.play(env, wobble, k).
 * Hole radius and board position are not changed here.
 */
import * as THREE from "./vendor/three.module.js";

const Y0 = 0.5;

const mats = new Map();
function shade(hex, rough = 0.58, metal = 0) {
  const key = `${hex}|${rough}|${metal}`;
  let mat = mats.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: rough,
      metalness: metal,
      emissiveIntensity: 0,
      envMapIntensity: metal > 0.3 ? 0.12 : 0.05,
    });
    mats.set(key, mat);
  }
  return mat;
}

const flats = new Map();
function flat(hex) {
  let mat = flats.get(hex);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color: hex });
    flats.set(hex, mat);
  }
  return mat;
}

let inkMat = null;
function inkMaterial() {
  if (!inkMat) {
    inkMat = new THREE.MeshBasicMaterial({
      color: 0x141414,
      side: THREE.BackSide,
      toneMapped: false,
    });
  }
  return inkMat;
}

let shadowMat = null;
function contactShadowMat() {
  if (shadowMat) return shadowMat;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 6, 32, 32, 32);
  grd.addColorStop(0, "rgba(20,20,20,0.45)");
  grd.addColorStop(0.5, "rgba(20,20,20,0.22)");
  grd.addColorStop(1, "rgba(20,20,20,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const map = new THREE.CanvasTexture(c);
  shadowMat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
  return shadowMat;
}

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  sph: new THREE.SphereGeometry(1, 10, 8),
  cone: new THREE.ConeGeometry(1, 1, 8),
  torus: new THREE.TorusGeometry(1, 0.16, 6, 16),
  thinTorus: new THREE.TorusGeometry(1, 0.045, 6, 20),
  shadow: new THREE.CircleGeometry(1, 18),
};

const SOCKET = {
  knot: {},
  oasis: { lip: 0xd08a3a, lipRough: 0.84, mouth: 0x1a120c, carpet: 0xe0b15a, carpetR: 0.52 },
  crystal: { lip: 0xd8e4ff, lipRough: 0.28, mouth: 0x141820 },
  net: { mouth: 0x14301c },
  rim: { lip: 0x2a2a2a, lipRough: 0.92, mouth: 0x141416 },
  puddle: { lip: 0x2fbf3e, lipRough: 0.32, mouth: 0x146622, carpet: 0x228a32, carpetR: 0.5 },
  snowman: { lip: 0xf7fbff, lipRough: 0.55, mouth: 0x9bb8cc, lipOuter: 0.38 },
  hoop: {},
  bucket: { lip: 0xe6c27a, lipRough: 0.8, mouth: 0xc9a060, carpet: 0xd7b06a, carpetR: 0.5 },
  pins: {},
  crater: { lip: 0x3a2018, lipRough: 0.9, mouth: 0xff6a18 },
  pedestal: {},
  stump: { lip: 0x6a3c1c, lipRough: 0.86 },
  dish: {},
  nest: { lip: 0x3d7a3a, lipRough: 0.8 },
  glow: { mouth: 0x241448 },
  cog: { lip: 0x8a929c, lipRough: 0.4, mouth: 0x2a3038 },
  plate: { lip: 0xb8742e, lipRough: 0.7, carpet: 0xc4843a, carpetR: 0.62, mouth: 0x6a3a18 },
  cup: { lip: 0x2e8a4a, lipRough: 0.78, carpet: 0x3ba85a, carpetR: 0.62, mouth: 0x1a4a28 },
  flag: { lip: 0x3baa4a, lipRough: 0.8, carpet: 0x2f8a3a, carpetR: 0.52, mouth: 0x242420 },
  spool: { lip: 0xc5ced8, lipRough: 0.35, mouth: 0x141414 },
  mug: {},
  rind: { lip: 0xc9843c, lipRough: 0.72, carpet: 0xd7a15a, carpetR: 0.58 },
  lamp: { mouth: 0x161628 },
  hoard: { lip: 0xf2c14a, lipRough: 0.4, mouth: 0x8a5a10 },
  paw: {},
  pixels: { mouth: 0x141432 },
  rocket: { lip: 0xe9d9ae, lipRough: 0.84, carpet: 0xf0e2c0, carpetR: 0.62 },
  cauldron: { lip: 0x3a2458, lipRough: 0.5, mouth: 0x5a28a0 },
};

export function socketFor(kind) {
  const spec = SOCKET[kind] || {};
  const opts = {};
  if (spec.lip != null) opts.lip = shade(spec.lip, spec.lipRough ?? 0.7);
  if (spec.mouth != null) opts.mouth = flat(spec.mouth);
  if (spec.carpet != null) {
    opts.carpet = shade(spec.carpet, spec.carpetRough ?? 0.78);
    opts.carpetR = spec.carpetR || 0.56;
  }
  if (spec.lipOuter != null) opts.lipOuter = spec.lipOuter;
  return opts;
}

function mesh(parent, geo, material, x, y, z, opt = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  if (opt.rot) m.rotation.set(opt.rot[0], opt.rot[1], opt.rot[2]);
  if (opt.s != null) {
    const s = opt.s;
    if (Array.isArray(s)) m.scale.set(s[0], s[1], s[2]);
    else m.scale.setScalar(s);
  }
  if (opt.shadow) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  if (opt.ink) {
    const ink = new THREE.Mesh(geo, inkMaterial());
    ink.scale.setScalar(opt.ink === true ? 1.1 : opt.ink);
    ink.raycast = () => {};
    m.add(ink);
  }
  parent.add(m);
  return m;
}

function grp(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function makeApi(tuck, actors) {
  return {
    tuck,
    // Top-row holes sit ~0.56 from the rail. Keep props behind the mouth
    // and only compress the part that would cross that rail.
    zb(z) {
      if (!tuck || z > -0.46) return z;
      return -0.46 + (z + 0.46) * 0.4;
    },
    hh(h) { return tuck ? h * 0.86 : h; },
    act(node, fn) {
      const base = {
        node,
        x: node.position.x,
        y: node.position.y,
        z: node.position.z,
        rx: node.rotation.x,
        ry: node.rotation.y,
        rz: node.rotation.z,
        sx: node.scale.x,
        sy: node.scale.y,
        sz: node.scale.z,
      };
      actors.push((env, wob, k) => fn(base, env, wob, k));
    },
    shadow(parent, x, z, sx, sz) {
      const m = new THREE.Mesh(G.shadow, contactShadowMat());
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, Y0 + 0.012, z);
      m.scale.set(sx, sz, 1);
      m.renderOrder = 3;
      parent.add(m);
      return m;
    },
  };
}

const hoopFlash = new THREE.MeshStandardMaterial({
  color: 0xfff6c8,
  roughness: 0.45,
  emissive: 0xffe36b,
  emissiveIntensity: 0,
  envMapIntensity: 0.05,
});
const lineFlash = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.55,
  emissive: 0xfff6c8,
  emissiveIntensity: 0,
  envMapIntensity: 0.04,
});
const beamMat = new THREE.MeshBasicMaterial({
  color: 0xb6ff8a,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const routeMat = new THREE.MeshBasicMaterial({
  color: 0xe23b3b,
  transparent: true,
  opacity: 0.15,
});
const emberMat = new THREE.MeshBasicMaterial({
  color: 0xff6a18,
  transparent: true,
  opacity: 0.35,
});
const lavaMat = new THREE.MeshStandardMaterial({
  color: 0xffb020,
  emissive: 0xff4a10,
  emissiveIntensity: 0.9,
  roughness: 0.32,
});
const smokeMat = new THREE.MeshStandardMaterial({
  color: 0x6a645e,
  transparent: true,
  opacity: 0,
  roughness: 0.95,
  depthWrite: false,
});
const steamMat = new THREE.MeshStandardMaterial({
  color: 0xe7eef3,
  transparent: true,
  opacity: 0.88,
  roughness: 0.9,
  depthWrite: false,
});
const plumeMat = new THREE.MeshStandardMaterial({
  color: 0xd2b0ff,
  emissive: 0xa060ff,
  emissiveIntensity: 0.85,
  roughness: 0.45,
});

function acorn(parent, api, x, z, delay) {
  const nut = grp(parent, x, Y0 + 0.08, z);
  mesh(nut, G.sph, shade(0x6a3414, 0.72), 0, 0, 0, { s: [0.12, 0.1, 0.12], ink: 1.12, shadow: true });
  mesh(nut, G.sph, shade(0x3d6b28, 0.72), 0, 0.075, 0, { s: [0.075, 0.05, 0.075], ink: 1.1 });
  api.shadow(parent, x, z, 0.2, 0.15);
  api.act(nut, (b, env, wob, k) => {
    const pop = Math.sin(Math.min(1, Math.max(0, k * 1.35 - delay)) * Math.PI);
    b.node.position.y = b.y + pop * 0.16;
    b.node.rotation.z = b.rz + wob * 0.45 * (delay ? -1 : 1);
  });
}

function knotGoal(group, api) {
  mesh(group, G.thinTorus, shade(0x4a2810, 0.82), 0, Y0 + 0.028, 0, { rot: [Math.PI / 2, 0, 0], s: 0.36, ink: 1.08 });
  acorn(group, api, -0.46, 0.08, 0);
  acorn(group, api, 0.46, 0.02, 0.28);
}

function cactus(parent, api, x, z) {
  const h = api.hh(0.44);
  const root = grp(parent, x, Y0, api.zb(z));
  mesh(root, G.cyl, shade(0x3bc94a, 0.7), 0, h * 0.5, 0, { s: [0.1, h, 0.1], ink: 1.1, shadow: true });
  mesh(root, G.cyl, shade(0x2f9a3a, 0.7), -0.12, h * 0.55, 0, { rot: [0, 0, Math.PI / 2], s: [0.06, 0.16, 0.06], ink: 1.1 });
  mesh(root, G.cyl, shade(0x2f9a3a, 0.7), 0.12, h * 0.42, 0, { rot: [0, 0, -Math.PI / 2], s: [0.055, 0.14, 0.055], ink: 1.1 });
  const flower = mesh(root, G.sph, shade(0xffe14a, 0.45), 0, h + 0.03, 0, { s: 0.07, ink: 1.14 });
  api.shadow(parent, x, api.zb(z), 0.28, 0.18);
  api.act(flower, (b, env) => {
    const s = 0.07 * (1 + env * 1.3);
    b.node.scale.set(s, s, s);
  });
  return root;
}

function oasisGoal(group, api) {
  cactus(group, api, -0.42, -0.16);
  cactus(group, api, 0.4, -0.22);
  const ring = mesh(group, G.thinTorus, shade(0x3bc94a, 0.55), 0, Y0 + 0.03, 0, {
    rot: [Math.PI / 2, 0, 0],
    s: 0.4,
    ink: 1.08,
  });
  api.act(ring, (b, env) => {
    const s = 0.4 * (1 + env * 0.08);
    b.node.scale.set(s, s, s);
  });
}

function crystalGoal(group, api) {
  const cols = [0x9ad4ff, 0xc9b6ff, 0x7ee0ff];
  cols.forEach((hex, i) => {
    const a = -Math.PI / 2 + (i - 1) * 0.85;
    const eye = grp(group, Math.cos(a) * 0.46, Y0 + 0.08, Math.sin(a) * 0.46);
    mesh(eye, G.sph, shade(0xf4fbff, 0.18, 0.04), 0, 0, 0, { s: [0.11, 0.09, 0.1], ink: 1.1, shadow: true });
    mesh(eye, G.sph, shade(hex, 0.2, 0.05), 0, 0.01, 0.05, { s: 0.055, ink: 1.08 });
    mesh(eye, G.sph, shade(0x141820, 0.4), 0, 0.012, 0.08, { s: 0.028 });
    api.shadow(group, Math.cos(a) * 0.46, Math.sin(a) * 0.46, 0.16, 0.12);
    api.act(eye, (b, env, wob, k) => {
      const blink = Math.sin(Math.min(1, Math.max(0, k * 1.4 - i * 0.12)) * Math.PI);
      b.node.scale.y = 1 - blink * 0.72;
      b.node.position.y = b.y + blink * 0.03;
    });
  });
}

function netGoal(group, api, kit) {
  const near = api.zb(-0.28);
  const far = api.zb(-0.62);
  const mid = (near + far) * 0.5;
  const h = api.hh(0.56);
  const goal = grp(group, 0, Y0, 0);
  goal.rotation.x = api.tuck ? 0.12 : 0.22;
  const white = kit.netMat;
  const depth = Math.abs(far - near);
  const postX = api.tuck ? 0.36 : 0.5;
  mesh(goal, G.box, white, -postX, h * 0.45, mid, { s: [0.08, h * 0.95, depth], ink: 1.08, shadow: true });
  mesh(goal, G.box, white, postX, h * 0.45, mid, { s: [0.08, h * 0.95, depth], ink: 1.08, shadow: true });
  mesh(goal, G.box, white, 0, h * 0.95, far, { s: [postX * 2 + 0.1, 0.1, 0.08], ink: 1.06 });
  const net = grp(goal, 0, h * 0.5, mid);
  const cord = shade(0xdde6ee, 0.7);
  for (let i = 0; i < 5; i++) {
    mesh(net, G.box, cord, -0.28 + i * 0.14, 0, 0, { s: [0.016, h * 0.7, depth * 0.86] });
  }
  for (let i = 0; i < 3; i++) {
    mesh(net, G.box, cord, 0, -h * 0.18 + i * (h * 0.22), 0, { s: [0.64, 0.016, 0.016] });
  }
  api.shadow(group, 0, mid, 0.7, depth * 0.7);
  mesh(group, G.box, white, 0, Y0 + 0.024, 0.26, { s: [0.7, 0.016, 0.03] });
  api.act(net, (b, env) => {
    b.node.position.z = b.z - env * 0.24;
    b.node.scale.z = 1 + env * 1.45;
    b.node.scale.x = 1 + env * 0.38;
  });
}

function rimGoal(group, api) {
  const rubber = shade(0x2a2a2a, 0.92);
  const tread = shade(0x4a4a4a, 0.88);
  const stack = grp(group, api.tuck ? -0.3 : -0.42, Y0, api.zb(-0.12));
  for (let i = 0; i < 3; i++) {
    mesh(stack, G.torus, i === 1 ? tread : rubber, 0, 0.08 + i * 0.09, 0, {
      rot: [Math.PI / 2, 0, i * 0.4],
      s: [0.15, 0.15, 0.1],
      ink: 1.1,
      shadow: i === 0,
    });
  }
  api.shadow(group, stack.position.x, stack.position.z, 0.3, 0.2);
  const pole = grp(group, api.tuck ? 0.28 : 0.4, Y0, api.zb(-0.18));
  mesh(pole, G.cyl, shade(0xc5ced8, 0.4, 0.3), 0, api.hh(0.22), 0, { s: [0.028, api.hh(0.44), 0.028], ink: 1.16 });
  const flag = grp(pole, 0, api.hh(0.4), 0);
  const dark = shade(0x141414, 0.7);
  const light = shade(0xf4f4f4, 0.5);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      mesh(flag, G.box, (r + c) % 2 ? dark : light, 0.09 + c * 0.06, 0.05 - r * 0.055, 0, { s: [0.06, 0.055, 0.02], ink: 1.08 });
    }
  }
  api.act(flag, (b, env, wob) => {
    b.node.rotation.y = wob * 1.1;
  });
}

function puddleGoal(group, api) {
  const goo = shade(0x2fbf3e, 0.28);
  const face = grp(group, 0, Y0 + 0.045, 0.02);
  mesh(face, G.sph, shade(0x141414, 0.5), -0.1, 0.02, 0.02, { s: [0.045, 0.05, 0.03], ink: 1.1 });
  mesh(face, G.sph, shade(0x141414, 0.5), 0.1, 0.02, 0.02, { s: [0.045, 0.05, 0.03], ink: 1.1 });
  mesh(face, G.sph, shade(0xf4fff0, 0.3), -0.088, 0.03, 0.04, { s: 0.016 });
  mesh(face, G.sph, shade(0xf4fff0, 0.3), 0.112, 0.03, 0.04, { s: 0.016 });
  for (let i = 0; i < 5; i++) {
    const a = -0.5 + i * 0.25;
    mesh(face, G.sph, shade(0x141414, 0.5), Math.sin(a) * 0.1, -0.02, 0.03, { s: [0.02, 0.016, 0.016] });
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const blob = mesh(group, G.sph, goo, Math.cos(a) * 0.38, Y0 + 0.03, Math.sin(a) * 0.3, {
      s: [0.07, 0.04, 0.06],
      ink: 1.14,
    });
    api.act(blob, (b, env, wob, k) => {
      const pop = Math.sin(Math.min(1, Math.max(0, k * 1.15 - i * 0.06)) * Math.PI);
      b.node.position.y = b.y + pop * 0.18;
      b.node.scale.set(0.07, 0.04 + pop * 0.05, 0.06);
    });
  }
  api.act(face, (b, env) => {
    b.node.position.y = b.y + env * 0.06;
    b.node.scale.setScalar(1 + env * 0.12);
  });
}

function snowmanGoal(group, api) {
  const z = api.zb(-0.38);
  const snow = shade(0xf7fbff, 0.55);
  const man = grp(group, 0, Y0, z);
  const scales = [0.17, 0.13, 0.095].map((s) => (api.tuck ? s * 0.88 : s));
  let y = scales[0];
  scales.forEach((s, i) => {
    mesh(man, G.sph, snow, 0, y, 0, { s, ink: 1.08, shadow: i === 0 });
    y += s + scales[Math.min(i + 1, 2)] * 0.85;
  });
  const hat = grp(man, 0, y - 0.02, 0);
  mesh(hat, G.cyl, shade(0x141414, 0.7), 0, 0.025, 0, { s: [0.1, 0.028, 0.1], ink: 1.06 });
  mesh(hat, G.cyl, shade(0x141414, 0.7), 0, 0.09, 0, { s: [0.06, 0.1, 0.06], ink: 1.08 });
  const armL = mesh(man, G.box, shade(0x6a3a18, 0.8), -0.2, scales[0] + scales[1], 0, { rot: [0, 0, 0.8], s: [0.2, 0.028, 0.028], ink: 1.16 });
  const armR = mesh(man, G.box, shade(0x6a3a18, 0.8), 0.2, scales[0] + scales[1], 0, { rot: [0, 0, -0.8], s: [0.2, 0.028, 0.028], ink: 1.16 });
  mesh(man, G.cone, shade(0xff8a2a, 0.5), 0, scales[0] + scales[1] + 0.05, 0.09, { rot: [Math.PI / 2, 0, 0], s: [0.035, 0.09, 0.035] });
  api.shadow(group, 0, z, 0.38, 0.24);
  api.act(hat, (b, env) => {
    b.node.position.y = b.y + env * 0.22;
    b.node.scale.set(b.sx * (1 + env * 0.15), b.sy * (1 + env * 0.35), b.sz);
  });
  api.act(armL, (b, env) => {
    b.node.rotation.z = b.rz + env * 1.35;
  });
  api.act(armR, (b, env) => {
    b.node.rotation.z = b.rz - env * 1.35;
  });
}

function hoopGoal(group, api, kit) {
  const z = api.zb(api.tuck ? -0.5 : -0.7);
  const boardW = api.tuck ? 0.62 : 0.92;
  const boardH = api.tuck ? 0.2 : 0.5;
  const board = grp(group, 0, Y0 + (api.tuck ? 0.03 : 0.18), z);
  // Top-row holes have no room to stand a board, so the face lies on the floor
  // behind the rim. Elsewhere a small pitch shows the face from 82°.
  if (!api.tuck) board.rotation.x = 0.4;
  const face = api.tuck ? [boardW, 0.02, boardH] : [boardW, boardH, 0.045];
  mesh(board, G.box, shade(0xffffff, 0.45), 0, 0, 0, {
    s: face,
    ink: 1.06,
    shadow: true,
  });
  const flash = mesh(board, G.box, hoopFlash, 0, api.tuck ? 0.012 : -boardH * 0.02, api.tuck ? 0 : 0.03, {
    s: api.tuck ? [boardW * 0.46, 0.012, boardH * 0.52] : [boardW * 0.46, boardH * 0.52, 0.012],
  });
  mesh(board, G.box, kit.rimMat, 0, api.tuck ? 0.02 : -boardH * 0.02, api.tuck ? 0 : 0.04, {
    s: api.tuck ? [boardW * 0.5, 0.01, boardH * 0.58] : [boardW * 0.5, boardH * 0.58, 0.01],
  });
  mesh(board, G.box, shade(0xffffff, 0.45), 0, api.tuck ? 0.028 : -boardH * 0.02, api.tuck ? 0 : 0.05, {
    s: api.tuck ? [boardW * 0.26, 0.008, boardH * 0.3] : [boardW * 0.26, boardH * 0.3, 0.008],
  });
  const rimScale = api.tuck ? 0.34 : 0.4;
  mesh(group, G.thinTorus, kit.rimMat, 0, Y0 + 0.06, 0, {
    rot: [Math.PI / 2, 0, 0],
    s: rimScale,
    ink: 1.08,
  });
  const net = grp(group, 0, Y0 + 0.05, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = rimScale * 0.62;
    mesh(net, G.box, kit.netMat, Math.cos(a) * r, 0.012, Math.sin(a) * r, {
      rot: [0, -a, 0],
      s: [rimScale * 0.5, 0.012, 0.016],
    });
  }
  api.shadow(group, 0, z, boardW * 0.55, 0.18);
  api.act(net, (b, env, wob) => {
    b.node.rotation.x = b.rx + wob * 0.95;
    b.node.scale.y = 1 + env * 1.05;
    b.node.scale.x = 1 + env * 0.32;
    b.node.scale.z = 1 + env * 0.32;
  });
  api.act(board, (b, env) => {
    hoopFlash.emissiveIntensity = env * 1.6;
    b.node.scale.y = b.sy * (1 + env * 0.12);
  });
}

function bucketGoal(group, api) {
  const bucket = grp(group, api.tuck ? -0.3 : -0.42, Y0, api.zb(-0.08));
  mesh(bucket, G.cyl, shade(0xf2c15a, 0.45), 0, api.hh(0.16), 0, { s: [0.16, api.hh(0.28), 0.16], ink: 1.08, shadow: true });
  mesh(bucket, G.torus, shade(0xe23b3b, 0.45), 0.16, api.hh(0.16), 0, { rot: [0, 0, Math.PI / 2], s: [0.07, 0.07, 0.05] });
  api.shadow(group, bucket.position.x, bucket.position.z, 0.28, 0.2);
  const castle = grp(group, api.tuck ? 0.26 : 0.38, Y0, api.zb(-0.16));
  mesh(castle, G.cyl, shade(0xf0d7a0, 0.84), 0, 0.07, 0, { s: [0.16, 0.12, 0.16], ink: 1.08, shadow: true });
  mesh(castle, G.cone, shade(0xf0d7a0, 0.84), 0, 0.2, 0, { s: [0.14, 0.16, 0.14], ink: 1.08 });
  const flag = mesh(castle, G.box, shade(0xe23b3b, 0.5), 0.05, api.hh(0.34), 0, { s: [0.08, 0.055, 0.016], ink: 1.12 });
  api.act(bucket, (b, env) => {
    b.node.rotation.z = env * 0.45;
  });
  api.act(flag, (b, env) => {
    b.node.position.y = b.y + env * 0.08;
  });
}

function pinsGoal(group, api, kit, pins) {
  const spots = api.tuck
    ? [
      [0, -0.12],
      [-0.08, -0.2], [0.08, -0.2],
      [-0.16, -0.28], [0, -0.28], [0.16, -0.28],
      [-0.24, -0.36], [-0.08, -0.36], [0.08, -0.36], [0.24, -0.36],
    ]
    : [
      [0, -0.2],
      [-0.11, -0.32], [0.11, -0.32],
      [-0.22, -0.44], [0, -0.44], [0.22, -0.44],
      [-0.33, -0.56], [-0.11, -0.56], [0.11, -0.56], [0.33, -0.56],
    ];
  const scale = api.tuck ? 0.78 : 1.18;
  spots.forEach(([x, z]) => {
    const pin = grp(group, x, Y0, z);
    pin.scale.setScalar(scale);
    mesh(pin, kit.pinBodyGeo, kit.pinWhite, 0, 0.16, 0, { ink: 1.08, shadow: true });
    mesh(pin, kit.pinNeckGeo, kit.pinRed, 0, 0.34, 0, { ink: 1.1 });
    mesh(pin, kit.pinHeadGeo, kit.pinWhite, 0, 0.42, 0, { ink: 1.1 });
    pins.push(pin);
  });
  api.shadow(group, 0, api.tuck ? -0.24 : -0.4, api.tuck ? 0.4 : 0.55, api.tuck ? 0.28 : 0.4);
  return { pins };
}

function craterGoal(group, api) {
  const rock = shade(0x4a2018, 0.86);
  mesh(group, G.thinTorus, rock, 0, Y0 + 0.04, 0, { rot: [Math.PI / 2, 0, 0], s: 0.42, ink: 1.08 });
  const lava = mesh(group, G.cyl, lavaMat, 0, Y0 + 0.03, 0, { s: [0.22, 0.02, 0.22] });
  lava.renderOrder = 6;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const chip = mesh(group, G.sph, rock, Math.cos(a) * 0.46, Y0 + 0.05, Math.sin(a) * 0.36, {
      s: [0.07, 0.045, 0.06],
      ink: 1.12,
      shadow: true,
    });
    api.act(chip, (b, env, wob, k) => {
      const pop = Math.sin(Math.min(1, Math.max(0, k * 1.3 - i * 0.05)) * Math.PI);
      b.node.position.x = b.x + Math.cos(a) * pop * 0.08;
      b.node.position.z = b.z + Math.sin(a) * pop * 0.08;
      b.node.position.y = b.y + pop * 0.1;
    });
  }
  const smoke = mesh(group, G.sph, smokeMat, 0.08, Y0 + 0.1, api.zb(-0.2), { s: 0.06 });
  api.act(smoke, (b, env) => {
    b.node.position.y = b.y + env * 0.22;
    b.node.material.opacity = 0.15 + env * 0.55;
    b.node.scale.setScalar(0.06 + env * 0.1);
  });
  api.act(lava, (b, env) => {
    lavaMat.emissiveIntensity = 0.85 + env * 0.7;
    const s = 0.22 + env * 0.04;
    b.node.scale.set(s, 0.02, s);
  });
}

function starBadge(parent, y, size) {
  const star = grp(parent, 0, y, 0);
  const yellow = shade(0xffe14a, 0.4);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    const arm = grp(star, 0, 0.045, 0);
    arm.rotation.y = -a;
    mesh(arm, G.box, yellow, 0, 0, size * 0.22, { s: [size * 0.05, 0.05, size * 0.5], ink: 1.14 });
  }
  return star;
}

function pedestalGoal(group, api) {
  const z = api.zb(-0.42);
  const stand = grp(group, 0, Y0, z);
  const h = api.hh(0.22);
  mesh(stand, G.cyl, shade(0xe23b3b, 0.5), 0, h * 0.35, 0, { s: [0.22, h * 0.7, 0.22], ink: 1.08, shadow: true });
  mesh(stand, G.cyl, shade(0xffc21a, 0.45), 0, h * 0.72, 0, { s: [0.28, 0.04, 0.28], ink: 1.08 });
  const star = starBadge(stand, h * 0.95, 0.92);
  api.shadow(group, 0, z, 0.36, 0.22);
  api.act(star, (b, env) => {
    b.node.position.y = b.y + env * api.hh(0.14);
    b.node.rotation.y = env * 0.8;
  });
}

function stumpGoal(group, api) {
  const z = api.zb(-0.42);
  mesh(group, G.cyl, shade(0x8a5a32, 0.84), 0, Y0 + api.hh(0.1), z, { s: [0.22, api.hh(0.18), 0.22], ink: 1.06, shadow: true });
  mesh(group, G.cyl, shade(0xb07a48, 0.8), 0, Y0 + api.hh(0.2), z, { s: [0.2, 0.03, 0.2] });
  api.shadow(group, 0, z, 0.36, 0.24);
  [[-0.28, -0.06], [0.26, -0.14], [0.02, 0.2]].forEach(([x, dz], i) => {
    const cap = grp(group, x, Y0, z + dz);
    mesh(cap, G.cyl, shade(0xf4f1ea, 0.7), 0, 0.05, 0, { s: [0.04, 0.08, 0.04] });
    mesh(cap, G.sph, shade(i === 2 ? 0xf2c14a : 0xe23b3b, 0.5), 0, 0.11, 0, { s: [0.09, 0.055, 0.09], ink: 1.1 });
    api.act(cap, (b, env, wob, k) => {
      const pop = Math.sin(Math.min(1, Math.max(0, k * 1.4 - i * 0.15)) * Math.PI);
      b.node.position.y = b.y + pop * 0.1;
    });
  });
}

function dishGoal(group, api) {
  const z = api.zb(-0.46);
  const jar = grp(group, 0, Y0, z);
  const h = api.hh(0.28);
  mesh(jar, G.cyl, shade(0xcdefff, 0.18, 0.02), 0, h * 0.45, 0, { s: [0.2, h * 0.9, 0.2], ink: 1.08, shadow: true });
  const lid = grp(jar, 0, h * 0.92, -0.02);
  lid.rotation.x = -0.7;
  mesh(lid, G.cyl, shade(0xff5a9a, 0.4), 0, 0.02, 0, { s: [0.2, 0.04, 0.2], ink: 1.08 });
  const gums = [0xff5a9a, 0x7adf5a, 0xffe14a, 0x4ec8ff].map((hex, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    return mesh(jar, G.sph, shade(hex, 0.35), (col - 0.5) * 0.08, h * 0.78, 0.06 - row * 0.05, {
      s: 0.05,
      ink: 1.12,
    });
  });
  api.shadow(group, 0, z, 0.32, 0.22);
  api.act(lid, (b, env) => {
    b.node.position.y = b.y + env * 0.1;
    b.node.rotation.z = env * 0.4;
  });
  gums.forEach((gummy, i) => {
    api.act(gummy, (b, env, wob, k) => {
      const pop = Math.sin(Math.min(1, Math.max(0, k * 1.3 - i * 0.1)) * Math.PI);
      b.node.position.y = b.y + pop * 0.08;
    });
  });
}

function nestGoal(group, api) {
  const vine = shade(0x3d7a3a, 0.7);
  mesh(group, G.torus, vine, 0, Y0 + 0.04, 0, { rot: [Math.PI / 2, 0, 0], s: [0.4, 0.4, 0.22], ink: 1.08 });
  mesh(group, G.torus, shade(0x2f6a32, 0.75), 0, Y0 + 0.07, 0, { rot: [Math.PI / 2, 0.4, 0], s: [0.34, 0.34, 0.16], ink: 1.06 });
  const z = api.zb(-0.24);
  const tree = grp(group, api.tuck ? 0.06 : 0.16, Y0, z);
  const h = api.hh(0.34);
  mesh(tree, G.cyl, shade(0x8a5a32, 0.84), 0, h * 0.42, 0, { s: [0.07, h * 0.9, 0.07], ink: 1.1, shadow: true });
  const leaves = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leaf = mesh(tree, G.box, shade(i % 2 ? 0x3d7a3a : 0x7adf5a, 0.7), Math.cos(a) * 0.12, h * 0.92, Math.sin(a) * 0.1, {
      rot: [0.9, a, 0],
      s: [0.08, 0.16, 0.03],
      ink: 1.1,
    });
    leaves.push(leaf);
  }
  const nut = mesh(tree, G.sph, shade(0x6a3c18, 0.75), 0.08, h * 0.62, 0.04, { s: 0.06, ink: 1.12 });
  api.shadow(group, tree.position.x, z, 0.32, 0.2);
  leaves.forEach((leaf, i) => {
    api.act(leaf, (b, env, wob) => {
      b.node.rotation.z = b.rz + wob * 0.35 * (i % 2 ? 1 : -1);
    });
  });
  api.act(nut, (b, env, wob, k) => {
    const drop = Math.sin(Math.min(1, k) * Math.PI);
    b.node.position.y = b.y - drop * 0.12;
  });
}

function glowGoal(group, api) {
  const z = api.zb(-0.5);
  const y = Y0 + api.hh(0.36);
  const ship = grp(group, 0, y, z);
  mesh(ship, G.sph, shade(0xc5ced8, 0.35, 0.45), 0, 0, 0, { s: [0.32, 0.09, 0.32], ink: 1.08, shadow: true });
  mesh(ship, G.sph, shade(0x9af0c8, 0.2, 0.05), 0, 0.08, 0, { s: [0.13, 0.1, 0.13], ink: 1.1 });
  mesh(ship, G.sph, shade(0x6adf5a, 0.4), 0, 0.1, 0.04, { s: 0.045 });
  const beamH = api.hh(0.48);
  const beam = mesh(group, G.cone, beamMat, 0, Y0 + beamH * 0.42, z * 0.35, { s: [0.26, beamH, 0.26] });
  beam.renderOrder = 7;
  api.shadow(group, 0, z, 0.36, 0.18);
  api.act(ship, (b, env) => {
    b.node.position.y = b.y - env * 0.06;
  });
  api.act(beam, (b, env) => {
    beamMat.opacity = 0.7 + env * 0.25;
    b.node.scale.set(0.26 + env * 0.04, beamH * (1 + env * 0.12), 0.26 + env * 0.04);
  });
}

function cogGoal(group, api) {
  const metal = shade(0xb0b8c4, 0.38, 0.55);
  const dark = shade(0x7a848e, 0.45, 0.4);
  function gear(x, z, radius) {
    const g = grp(group, x, Y0 + 0.04, z);
    mesh(g, G.cyl, metal, 0, 0, 0, { s: [radius, 0.06, radius], ink: 1.08, shadow: true });
    mesh(g, G.cyl, dark, 0, 0.02, 0, { s: [radius * 0.28, 0.04, radius * 0.28] });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      mesh(g, G.box, metal, Math.cos(a) * radius * 0.85, 0, Math.sin(a) * radius * 0.85, {
        rot: [0, -a, 0],
        s: [radius * 0.38, 0.05, radius * 0.28],
        ink: 1.08,
      });
    }
    return g;
  }
  const a = gear(api.tuck ? -0.18 : -0.26, api.zb(-0.32), 0.16);
  const b = gear(api.tuck ? 0.16 : 0.22, api.zb(-0.1), 0.13);
  api.shadow(group, 0, api.zb(-0.2), 0.4, 0.28);
  api.act(a, (bse, env, wob, k) => {
    bse.node.rotation.y = k * Math.PI * 2;
  });
  api.act(b, (bse, env, wob, k) => {
    bse.node.rotation.y = -k * Math.PI * 2;
  });
}

function plateGoal(group, api) {
  const leather = shade(0xb8742e, 0.68);
  const pocket = shade(0x8a4e1e, 0.75);
  const lace = shade(0xe8c9a0, 0.5);
  mesh(group, G.torus, leather, 0, Y0 + 0.035, 0.04, { rot: [Math.PI / 2, 0, 0], s: [0.42, 0.42, 0.26], ink: 1.06, shadow: true });
  mesh(group, G.cyl, pocket, 0, Y0 + 0.03, 0.02, { s: [0.24, 0.025, 0.22] });
  for (let i = 0; i < 3; i++) {
    mesh(group, G.box, lace, -0.1 + i * 0.1, Y0 + 0.05, 0.16, { s: [0.016, 0.016, 0.14] });
  }
  for (let i = 0; i < 4; i++) {
    const spread = -0.27 + i * 0.18;
    const finger = grp(group, spread, Y0 + 0.04, api.zb(-0.22));
    mesh(finger, G.box, leather, 0, 0.03, -0.14, { s: [0.1, 0.07, 0.28], ink: 1.08, shadow: true });
    mesh(finger, G.sph, leather, 0, 0.035, -0.28, { s: [0.055, 0.04, 0.055], ink: 1.08 });
    api.act(finger, (b, env) => {
      b.node.rotation.x = env * 1.85;
      b.node.position.z = b.z + env * 0.2;
      b.node.scale.z = b.sz * (1 + env * 0.25);
    });
  }
  const thumb = grp(group, 0.4, Y0 + 0.04, 0.06);
  mesh(thumb, G.box, leather, 0.08, 0.03, 0, { rot: [0, 0.7, 0], s: [0.2, 0.07, 0.09], ink: 1.08 });
  mesh(thumb, G.sph, leather, 0.16, 0.035, 0.02, { s: [0.05, 0.04, 0.05], ink: 1.08 });
  api.act(thumb, (b, env) => {
    b.node.rotation.z = -env * 0.55;
  });
  api.shadow(group, 0, api.zb(-0.2), 0.62, 0.42);
}

function cupGoal(group, api) {
  const line = lineFlash;
  mesh(group, G.box, line, 0, Y0 + 0.024, 0, { s: [1.05, 0.016, 0.028] });
  mesh(group, G.box, line, 0, Y0 + 0.024, 0.02, { s: [0.028, 0.016, 0.9] });
  mesh(group, G.thinTorus, line, 0, Y0 + 0.026, 0, { rot: [Math.PI / 2, 0, 0], s: 0.52 });
  const z = api.zb(-0.44);
  const postH = api.hh(0.28);
  const postMat = shade(0x5c646e, 0.45, 0.3);
  mesh(group, G.box, postMat, -0.38, Y0 + postH * 0.5, z, { s: [0.05, postH, 0.1], ink: 1.1, shadow: true });
  mesh(group, G.box, postMat, 0.38, Y0 + postH * 0.5, z, { s: [0.05, postH, 0.1], ink: 1.1, shadow: true });
  const net = grp(group, 0, Y0 + postH * 0.55, z);
  net.rotation.x = 0.78;
  const cloth = shade(0x2a2a2e, 0.8);
  for (let i = 0; i < 7; i++) {
    mesh(net, G.box, cloth, -0.3 + i * 0.1, 0, 0, { s: [0.016, postH * 0.7, 0.02] });
  }
  mesh(net, G.box, cloth, 0, postH * 0.28, 0, { s: [0.7, 0.02, 0.02] });
  api.shadow(group, 0, z, 0.62, 0.16);
  api.act(net, (b, env, wob) => {
    b.node.rotation.x = b.rx + env * 0.85 + wob * 0.55;
    b.node.scale.y = 1 + env * 0.35;
    lineFlash.emissiveIntensity = env * 2.2;
  });
}

function flagGoal(group, api, kit) {
  mesh(group, G.thinTorus, kit.pinWhite, 0, Y0 + 0.025, 0, { rot: [Math.PI / 2, 0, 0], s: 0.34, ink: 1.06 });
  const pole = grp(group, 0.08, Y0, api.zb(-0.28));
  const h = api.hh(0.5);
  mesh(pole, G.cyl, kit.pinWhite, 0, h * 0.5, 0, { s: [0.028, h, 0.028], ink: 1.14, shadow: true });
  const cloth = grp(pole, 0.02, h * 0.82, 0);
  mesh(cloth, G.box, shade(0xd42828, 0.5), 0.12, 0, 0, { s: [0.22, 0.14, 0.02], ink: 1.08 });
  api.shadow(group, 0.08, api.zb(-0.28), 0.16, 0.12);
  api.act(pole, (b, env) => {
    b.node.position.y = b.y + env * 0.08;
  });
  api.act(cloth, (b, env, wob) => {
    b.node.rotation.y = wob * 0.9;
  });
}

function spoolGoal(group, api) {
  const z = api.zb(-0.28);
  const bowl = grp(group, 0, Y0, z);
  const yarn = shade(0xe7d3b0, 0.72);
  const deep = shade(0x8a6240, 0.7);
  const h = api.hh(0.26);
  mesh(bowl, G.cyl, yarn, 0, h * 0.45, 0, { s: [0.3, h, 0.3], ink: 1.06, shadow: true });
  mesh(bowl, G.cyl, deep, 0, h * 0.95, 0, { s: [0.2, 0.035, 0.2], ink: 1.04 });
  for (let i = 0; i < 3; i++) {
    mesh(bowl, G.thinTorus, i % 2 ? deep : yarn, 0, 0.04 + i * 0.045, 0, {
      rot: [Math.PI / 2, i * 0.4, 0],
      s: 0.26 - i * 0.02,
      ink: 1.04,
    });
  }
  const strand = mesh(group, G.box, yarn, -0.28, Y0 + 0.05, z, { s: [0.22, 0.02, 0.02], ink: 1.1 });
  api.shadow(group, 0, z, 0.4, 0.28);
  api.act(strand, (b, env, wob, k) => {
    const pull = Math.sin(Math.min(1, k) * Math.PI);
    b.node.position.x = b.x - pull * 0.16;
    b.node.scale.x = 1 + pull * 0.8;
  });
  api.act(bowl, (b, env) => {
    b.node.position.y = b.y + env * 0.04;
  });
}

function mugGoal(group, api) {
  const z = api.zb(-0.28);
  const cup = grp(group, 0, Y0, z);
  const h = api.hh(0.22);
  mesh(cup, G.cyl, shade(0xf4f7fb, 0.35), 0, h * 0.5, 0, { s: [0.18, h, 0.18], ink: 1.08, shadow: true });
  mesh(cup, G.torus, shade(0xf4f7fb, 0.35), 0.18, h * 0.5, 0, { rot: [0, Math.PI / 2, 0], s: [0.08, 0.08, 0.045], ink: 1.1 });
  const coffee = mesh(cup, G.cyl, shade(0x4a2410, 0.35), 0, h * 0.96, 0, { s: [0.14, 0.02, 0.14] });
  const steams = [0, 1, 2].map((i) => {
    return mesh(cup, G.sph, steamMat, (i - 1) * 0.05, h + 0.06 + i * 0.07, 0.02, { s: [0.055, 0.07, 0.055] });
  });
  api.shadow(group, 0, z, 0.28, 0.18);
  api.act(coffee, (b, env, wob) => {
    b.node.rotation.z = wob * 0.25;
  });
  steams.forEach((puff, i) => {
    api.act(puff, (b, env) => {
      b.node.position.y = b.y + env * (0.1 + i * 0.04);
      b.node.material.opacity = 0.45 + env * 0.4;
      b.node.scale.setScalar((0.7 + i * 0.15) * (1 + env * 0.4));
    });
  });
}

function rindGoal(group, api) {
  const knife = grp(group, api.tuck ? 0.22 : 0.38, Y0 + 0.02, api.zb(-0.08));
  mesh(knife, G.box, shade(0xd7e2ea, 0.28, 0.55), 0, 0.01, 0, { rot: [0, 0.4, 0], s: [0.22, 0.012, 0.05], ink: 1.16 });
  mesh(knife, G.box, shade(0x141414, 0.6), -0.1, 0.015, -0.04, { s: [0.06, 0.02, 0.03], ink: 1.1 });
  const slice = grp(group, -0.08, Y0 + 0.04, 0.12);
  mesh(slice, G.cyl, shade(0xe8384a, 0.48), 0, 0.02, 0, { s: [0.2, 0.04, 0.2], ink: 1.08 });
  mesh(slice, G.torus, shade(0x127338, 0.55), 0, 0.03, 0, { rot: [Math.PI / 2, 0, 0], s: [0.18, 0.18, 0.28], ink: 1.06 });
  mesh(slice, G.sph, shade(0x141414, 0.8), -0.05, 0.05, 0.02, { s: 0.018 });
  mesh(slice, G.sph, shade(0x141414, 0.8), 0.04, 0.05, -0.03, { s: 0.016 });
  mesh(slice, G.sph, shade(0x141414, 0.8), 0.01, 0.05, 0.05, { s: 0.014 });
  api.shadow(group, 0.2, api.zb(-0.08), 0.24, 0.12);
  api.act(knife, (b, env) => {
    b.node.rotation.z = -env * 0.7;
    b.node.position.y = b.y + env * 0.04;
  });
  api.act(slice, (b, env) => {
    b.node.position.y = b.y + env * 0.04;
    b.node.rotation.z = env * 0.2;
  });
}

const TILES = [0xff5a9a, 0x3ec4ff, 0x7adf5a, 0xffe14a, 0xc07aff];
let tileMats = null;
function danceTiles() {
  if (!tileMats) tileMats = TILES.map((hex) => shade(hex, 0.42));
  return tileMats;
}

function lampGoal(group, api, kit) {
  const tiles = [];
  const colors = danceTiles();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const tile = mesh(group, G.box, colors[i % colors.length], Math.cos(a) * 0.42, Y0 + 0.02, Math.sin(a) * 0.42, {
      s: [0.14, 0.025, 0.14],
      ink: 1.1,
    });
    tiles.push(tile);
  }
  const ball = mesh(group, G.sph, kit.ballMaterials.disco || shade(0xd8dee8, 0.25, 0.6), 0, Y0 + api.hh(0.38), api.zb(-0.46), {
    s: api.hh(0.14),
    ink: 1.08,
    shadow: true,
  });
  api.shadow(group, 0, api.zb(-0.36), 0.16, 0.12);
  const flecks = [0, 1, 2].map((i) => {
    const a = i * 2.1;
    return mesh(group, G.sph, shade(TILES[i], 0.3), Math.cos(a) * 0.2, Y0 + api.hh(0.2), api.zb(-0.2), { s: 0.02 });
  });
  api.act(ball, (b, env, wob, k) => {
    b.node.rotation.y = k * Math.PI * 4;
    const shift = Math.floor(k * 8);
    tiles.forEach((tile, i) => {
      tile.material = colors[(i + shift) % colors.length];
    });
  });
  flecks.forEach((fleck, i) => {
    api.act(fleck, (b, env) => {
      b.node.position.y = b.y + env * 0.08;
      b.node.scale.setScalar(0.02 * (1 + env));
    });
  });
  return {
    idle(time) {
      const shift = Math.floor(time * 0.28) % colors.length;
      tiles.forEach((tile, i) => {
        tile.material = colors[(i + shift) % colors.length];
      });
      ball.rotation.y = time * 0.35;
    },
  };
}

function hoardGoal(group, api) {
  const gold = shade(0xf2c14a, 0.35, 0.45);
  const edge = shade(0xc47a20, 0.4, 0.4);
  const coins = [];
  for (let i = 0; i < 7; i++) {
    const coin = mesh(group, G.cyl, i % 2 ? gold : edge, Math.cos(i) * 0.16 + (i - 3) * 0.04, Y0 + 0.025 + (i % 3) * 0.012, api.zb(-0.22) + Math.sin(i) * 0.06, {
      rot: [Math.PI / 2, i, 0],
      s: [0.055, 0.012, 0.055],
      ink: 1.14,
      shadow: i === 0,
    });
    coins.push(coin);
  }
  const pouch = grp(group, api.tuck ? -0.28 : -0.38, Y0, api.zb(-0.1));
  mesh(pouch, G.sph, shade(0xe23b3b, 0.6), 0, 0.07, 0, { s: [0.1, 0.08, 0.09], ink: 1.1, shadow: true });
  mesh(pouch, G.torus, gold, 0, 0.12, 0, { rot: [Math.PI / 2, 0, 0], s: [0.06, 0.06, 0.04] });
  api.shadow(group, 0, api.zb(-0.18), 0.4, 0.24);
  coins.forEach((coin, i) => {
    api.act(coin, (b, env, wob, k) => {
      const pop = Math.sin(Math.min(1, Math.max(0, k * 1.25 - i * 0.06)) * Math.PI);
      b.node.position.y = b.y + pop * 0.12;
    });
  });
}

function pawGoal(group, api, kit) {
  const z = api.zb(-0.48);
  const box = grp(group, 0, Y0, z);
  const h = api.hh(0.28);
  mesh(box, G.box, shade(0xc9843c, 0.78), 0, h * 0.38, 0, { s: [0.5, h * 0.72, 0.34], ink: 1.06, shadow: true });
  mesh(box, G.box, shade(0xd7a15a, 0.75), -0.24, h * 0.72, 0, { s: [0.03, h * 0.5, 0.34] });
  mesh(box, G.box, shade(0xd7a15a, 0.75), 0.24, h * 0.72, 0, { s: [0.03, h * 0.5, 0.34] });
  mesh(box, G.box, shade(0xd7a15a, 0.75), 0, h * 0.72, -0.16, { s: [0.48, h * 0.5, 0.03] });
  const head = grp(box, 0, h * 0.55, -0.02);
  mesh(head, G.sph, shade(0xf2e2cc, 0.6), 0, 0, 0, { s: [0.16, 0.1, 0.13], ink: 1.08 });
  mesh(head, G.cone, shade(0xe8c9a0, 0.6), -0.07, 0.08, -0.02, { s: [0.05, 0.1, 0.04], ink: 1.08 });
  mesh(head, G.cone, shade(0xe8c9a0, 0.6), 0.07, 0.08, -0.02, { s: [0.05, 0.1, 0.04], ink: 1.08 });
  mesh(head, G.sph, shade(0x141414, 0.35), -0.045, 0.1, 0.02, { s: 0.032 });
  mesh(head, G.sph, shade(0x141414, 0.35), 0.045, 0.1, 0.02, { s: 0.032 });
  mesh(head, G.sph, shade(0xffffff, 0.2), -0.034, 0.118, 0.028, { s: 0.012 });
  mesh(head, G.sph, shade(0xffffff, 0.2), 0.056, 0.118, 0.028, { s: 0.012 });
  mesh(head, G.sph, shade(0xe23b4a, 0.4), 0, 0.095, 0.05, { s: [0.028, 0.014, 0.016] });
  const paw = grp(group, 0, Y0 + h * 0.62, z + 0.12);
  paw.rotation.x = -0.55;
  const padMat = shade(0xf2c9a0, 0.62);
  mesh(paw, G.sph, padMat, 0, 0, 0.03, { s: [0.14, 0.055, 0.11], ink: 1.1 });
  for (let i = 0; i < 4; i++) {
    mesh(paw, G.sph, shade(0xe89aa0, 0.55), -0.1 + i * 0.066, 0.03, -0.05, { s: [0.03, 0.022, 0.03], ink: 1.12 });
  }
  api.shadow(group, 0, z, 0.46, 0.28);
  return { paw };
}

function pixelsGoal(group, api, kit) {
  const cols = kit.pixelBlockMats;
  const z = api.zb(-0.18);
  const s = api.tuck ? 0.1 : 0.12;
  const layout = [
    [-0.18, 0, 0], [0.18, 0, 0],
    [-0.18, 1, 0], [0.18, 1, 0],
    [-0.18, 2, 0], [-0.06, 2, 0], [0.06, 2, 0], [0.18, 2, 0],
  ];
  const blocks = layout.map(([x, row, jitter], i) => {
    const block = mesh(group, G.box, cols[i % 3], x, Y0 + s * 0.5 + row * s, z + jitter, {
      s,
      ink: 1.08,
      shadow: row === 0,
    });
    return block;
  });
  const star = mesh(group, G.sph, shade(0xffe14a, 0.4), 0, Y0 + s * 3.2, z + 0.04, { s: 0.04, ink: 1.2 });
  api.shadow(group, 0, z, 0.36, 0.16);
  blocks.forEach((block, i) => {
    api.act(block, (b, env, wob, k) => {
      const pop = Math.sin(Math.min(1, Math.max(0, k * 1.6 - i * 0.08)) * Math.PI);
      b.node.position.y = b.y + pop * 0.07;
    });
  });
  api.act(star, (b, env) => {
    b.node.position.y = b.y + env * 0.1;
    b.node.scale.setScalar(0.04 * (1 + env));
  });
}

function rocketGoal(group, api) {
  const map = grp(group, 0, Y0 + 0.02, api.zb(-0.08));
  mesh(map, G.cyl, shade(0x2f78d0, 0.45), 0, 0.01, 0, { s: [0.36, 0.02, 0.28], ink: 1.06, shadow: true });
  mesh(map, G.sph, shade(0x3d9a4a, 0.6), -0.08, 0.025, 0.02, { s: [0.12, 0.015, 0.08] });
  mesh(map, G.sph, shade(0x7fb86a, 0.6), 0.1, 0.025, -0.02, { s: [0.1, 0.015, 0.07] });
  mesh(map, G.sph, shade(0xe6d09a, 0.6), 0.02, 0.028, 0.06, { s: [0.05, 0.012, 0.04] });
  const pin = grp(group, 0.04, Y0, api.zb(-0.16));
  mesh(pin, G.cone, shade(0xe23b3b, 0.5), 0, 0.14, 0, { s: [0.06, 0.18, 0.06], ink: 1.1, shadow: true });
  mesh(pin, G.sph, shade(0xe23b3b, 0.5), 0, 0.24, 0, { s: 0.05, ink: 1.1 });
  const dots = [];
  for (let i = 0; i < 5; i++) {
    const dot = mesh(group, G.sph, routeMat, -0.28 + i * 0.08, Y0 + 0.025, 0.08 - i * 0.05, { s: 0.018 });
    dots.push(dot);
  }
  api.shadow(group, 0.05, api.zb(-0.22), 0.12, 0.1);
  api.act(pin, (b, env, wob, k) => {
    const stamp = Math.sin(Math.min(1, k) * Math.PI);
    b.node.position.y = b.y - stamp * 0.06;
  });
  api.act(dots[0], (b, env, wob, k) => {
    routeMat.opacity = 0.12 + Math.min(1, k) * 0.85;
  });
}

function cauldronGoal(group, api) {
  const z = api.zb(-0.3);
  const pot = grp(group, 0, Y0, z);
  mesh(pot, G.sph, shade(0x3a2458, 0.48, 0.25), 0, api.hh(0.12), 0, { s: [0.24, api.hh(0.16), 0.24], ink: 1.06, shadow: true });
  mesh(pot, G.torus, shade(0x2a1838, 0.5, 0.3), 0, api.hh(0.2), 0, { rot: [Math.PI / 2, 0, 0], s: [0.2, 0.2, 0.08], ink: 1.06 });
  const plumes = [
    [0.12, -0.05, 0.09],
    [0.22, 0.05, 0.08],
    [0.32, -0.02, 0.075],
    [0.4, 0.02, 0.065],
  ].map(([rise, x, s]) => mesh(pot, G.sph, plumeMat, x, api.hh(0.12) + rise, 0, { s, ink: 1.08 }));
  const bubbles = [0, 1, 2].map((i) => {
    return mesh(pot, G.sph, shade(0xc89aff, 0.25), (i - 1) * 0.06, api.hh(0.22), 0.02, { s: 0.028 });
  });
  const skull = grp(pot, 0, api.hh(0.12) + 0.2, 0.14);
  mesh(skull, G.sph, shade(0xefe8dc, 0.55), 0, 0, 0, { s: 0.08, ink: 1.14 });
  mesh(skull, G.sph, shade(0x2a1838, 0.4), -0.024, 0.03, 0.05, { s: 0.02 });
  mesh(skull, G.sph, shade(0x2a1838, 0.4), 0.024, 0.03, 0.05, { s: 0.02 });
  api.shadow(group, 0, z, 0.36, 0.24);
  bubbles.forEach((bubble, i) => {
    api.act(bubble, (b, env, wob, k) => {
      const pop = Math.sin(Math.min(1, Math.max(0, k * 1.4 - i * 0.12)) * Math.PI);
      b.node.position.y = b.y + pop * 0.1;
      b.node.scale.setScalar(0.04 * (1 + pop));
    });
  });
  plumes.forEach((puff, i) => {
    api.act(puff, (b, env) => {
      b.node.position.y = b.y + env * (0.1 + i * 0.06);
    });
  });
  api.act(skull, (b, env) => {
    b.node.position.y = b.y + env * 0.16;
    b.node.scale.setScalar(1 + env * 0.85);
  });
}

const BUILD = {
  knot: knotGoal,
  oasis: oasisGoal,
  crystal: crystalGoal,
  net: netGoal,
  rim: rimGoal,
  puddle: puddleGoal,
  snowman: snowmanGoal,
  hoop: hoopGoal,
  bucket: bucketGoal,
  pins: pinsGoal,
  crater: craterGoal,
  pedestal: pedestalGoal,
  stump: stumpGoal,
  dish: dishGoal,
  nest: nestGoal,
  glow: glowGoal,
  cog: cogGoal,
  plate: plateGoal,
  cup: cupGoal,
  flag: flagGoal,
  spool: spoolGoal,
  mug: mugGoal,
  rind: rindGoal,
  lamp: lampGoal,
  hoard: hoardGoal,
  paw: pawGoal,
  pixels: pixelsGoal,
  rocket: rocketGoal,
  cauldron: cauldronGoal,
};

export function mountGoalV3(group, kind, kit, opts = {}) {
  const actors = [];
  const pins = [];
  const tuck = !!opts.tuck;
  const edge = opts.edge || "";
  const root = new THREE.Group();
  root.name = "goal-props";
  const zoom = opts.zoom == null ? 1 : opts.zoom;
  root.scale.setScalar(zoom);
  if (tuck) root.position.z = 0.06;
  if (edge === "left") root.position.x = 0.18;
  if (edge === "right") root.position.x = -0.18;
  group.add(root);
  const api = makeApi(tuck, actors);
  const build = BUILD[kind] || BUILD.knot;
  const extra = build(root, api, kit, pins) || {};
  group.userData.play = (env, wob, k) => {
    for (const fn of actors) fn(env, wob, k);
  };
  group.userData.idle = extra.idle || null;
  return { pins: extra.pins || pins, paw: extra.paw || null };
}
