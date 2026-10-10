/**
 * Creatures and props outside the play cells. Shared low-poly parts.
 * localStorage inthehole_deco = "on" | "off" | "auto" (default auto).
 * Auto turns the trim off for reduced motion and very small devices.
 */
import * as THREE from "./vendor/three.module.js";

const jobs = [];
const mats = new Map();
const geos = {
  sph: new THREE.SphereGeometry(1, 8, 6),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 7),
};
const INK = new THREE.MeshBasicMaterial({ color: 0x141414, side: THREE.BackSide });

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

function M(hex, rough = 0.62) {
  let mat = mats.get(hex);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color: hex, roughness: rough });
    mats.set(hex, mat);
  }
  return mat;
}

function part(parent, kind, color, x, y, z, sx, sy, sz, ink = false) {
  const mesh = new THREE.Mesh(geos[kind], M(color));
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = false;
  if (ink) {
    const line = new THREE.Mesh(geos[kind], INK);
    line.scale.setScalar(1.07);
    mesh.add(line);
  }
  parent.add(mesh);
  return mesh;
}

function loop(fn) {
  jobs.push(fn);
}

function metrics(span) {
  const inner = span / 2 - 0.02;
  const outer = inner + 0.26;
  return {
    inner,
    outer,
    farZ: -(inner + 0.5),
    nearZ: inner + 0.5,
    left: -(inner + 0.5),
    right: inner + 0.5,
    walkY: 1.02,
    out: inner + 0.72,
  };
}

function pingpong(t, period) {
  const u = (t % period) / period;
  return u < 0.5 ? u * 2 : (1 - u) * 2;
}

function bandMotes(parent, count, color, m, rise) {
  const pos = new Float32Array(count * 3);
  const seeds = Array.from({ length: count }, (_, i) => ({
    side: i % 4,
    u: Math.random(),
    s: 0.45 + (i % 5) * 0.12,
    y: Math.random(),
  }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size: 0.09,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    sizeAttenuation: true,
  });
  parent.add(new THREE.Points(geo, mat));
  loop((time) => {
    for (let i = 0; i < count; i++) {
      const seed = seeds[i];
      const along = ((seed.u + time * 0.04 * seed.s) % 1) * 2 - 1;
      const span = m.outer + 0.05;
      const out = m.inner + 0.34;
      const y = rise
        ? 0.35 + ((seed.y + time * 0.12 * seed.s) % 1) * 1.15
        : 1.15 + Math.sin(time * seed.s + seed.u * 6) * 0.25;
      let x = along * span;
      let z = out;
      if (seed.side === 0) z = -out;
      else if (seed.side === 1) z = out;
      else if (seed.side === 2) { x = -out; z = along * span; }
      else { x = out; z = along * span; }
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
    }
    geo.attributes.position.needsUpdate = true;
  });
}

function squirrel(parent, m) {
  const g = new THREE.Group();
  part(g, "sph", 0xc47a3a, 0, 0.12, 0, 0.11, 0.1, 0.12, true);
  part(g, "sph", 0xe8a05a, 0.08, 0.16, 0.04, 0.07, 0.06, 0.07);
  part(g, "sph", 0x8a4e22, -0.12, 0.16, -0.02, 0.08, 0.1, 0.06);
  part(g, "sph", 0x141414, 0.1, 0.18, 0.07, 0.015, 0.015, 0.015);
  parent.add(g);
  g.position.set(0, m.walkY, m.farZ);
  loop((time) => {
    const p = pingpong(time, 6);
    g.position.x = (p * 2 - 1) * (m.outer - 0.5);
    g.position.y = m.walkY + Math.abs(Math.sin(time * Math.PI * 2)) * 0.06;
    g.rotation.y = time % 6 < 3 ? Math.PI / 2 : -Math.PI / 2;
  });
}

function bird(parent, m, color, y, z, period, flap) {
  const g = new THREE.Group();
  part(g, "sph", color, 0, 0, 0, 0.1, 0.07, 0.08, true);
  part(g, "cone", 0xf2c14a, 0.12, 0.02, 0, 0.04, 0.08, 0.04);
  const wing = part(g, "box", color, 0, 0.02, 0, 0.16, 0.02, 0.08);
  g.children[1].rotation.z = -Math.PI / 2;
  parent.add(g);
  g.position.y = y;
  loop((time) => {
    const p = (time % period) / period;
    g.position.x = (p * 2 - 1) * (m.outer + 0.15);
    g.position.z = z;
    wing.rotation.z = Math.sin(time * flap) * 0.5;
  });
  return g;
}

function tree(parent, x, z) {
  const g = new THREE.Group();
  part(g, "cyl", 0x6a4424, 0, 0.28, 0, 0.06, 0.36, 0.06);
  part(g, "sph", 0x2f8a3a, 0, 0.55, 0, 0.2, 0.22, 0.18, true);
  part(g, "sph", 0x3daf4a, 0.08, 0.66, 0.04, 0.12, 0.12, 0.1);
  g.position.set(x, 0.7, z);
  parent.add(g);
}

function cactus(parent, x, y, z, scale) {
  const g = new THREE.Group();
  part(g, "cyl", 0x3d9a4a, 0, 0.22, 0, 0.07 * scale, 0.4 * scale, 0.07 * scale, true);
  part(g, "cyl", 0x3d9a4a, 0.1 * scale, 0.28 * scale, 0, 0.04 * scale, 0.16 * scale, 0.04 * scale);
  part(g, "sph", 0xff5a7a, 0, 0.44 * scale, 0, 0.04, 0.04, 0.04);
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function penguinBody(parent, scale, baby) {
  const g = new THREE.Group();
  part(g, "sph", 0x1c2430, 0, 0.16 * scale, 0, 0.12 * scale, 0.16 * scale, 0.1 * scale, true);
  part(g, "sph", 0xfff6ea, 0, 0.12 * scale, 0.06 * scale, 0.07 * scale, 0.1 * scale, 0.04 * scale);
  part(g, "sph", baby ? 0x2a3444 : 0x1c2430, 0, 0.3 * scale, 0.02, 0.08 * scale, 0.08 * scale, 0.08 * scale);
  part(g, "cone", 0xf2a020, 0, 0.28 * scale, 0.08 * scale, 0.03, 0.06, 0.03);
  part(g, "sph", 0xfff6ea, -0.03, 0.32 * scale, 0.06, 0.015, 0.015, 0.015);
  part(g, "sph", 0xfff6ea, 0.03, 0.32 * scale, 0.06, 0.015, 0.015, 0.015);
  const footL = part(g, "box", 0xf2a020, -0.05 * scale, 0.02, 0.06, 0.05, 0.02, 0.07);
  const footR = part(g, "box", 0xf2a020, 0.05 * scale, 0.02, 0.06, 0.05, 0.02, 0.07);
  g.children[3].rotation.x = Math.PI / 2;
  parent.add(g);
  return { g, footL, footR };
}

function iceberg(parent, x, z, s) {
  const g = new THREE.Group();
  part(g, "cone", 0xeaf6ff, 0, 0.28 * s, 0, 0.22 * s, 0.5 * s, 0.18 * s, true);
  part(g, "box", 0xb7d4ea, 0.08 * s, 0.1, 0.04, 0.16 * s, 0.16, 0.12 * s);
  g.position.set(x, 0.55, z);
  parent.add(g);
}

function crystal(parent, x, y, z, color) {
  const g = new THREE.Group();
  part(g, "cone", color, 0, 0.16, 0, 0.08, 0.32, 0.08, true);
  part(g, "cone", 0xe4ecff, 0.08, 0.1, 0.04, 0.05, 0.2, 0.05);
  g.position.set(x, y, z);
  parent.add(g);
  loop((time) => {
    g.rotation.y = time * 0.3;
  });
}

function robotToy(parent, m) {
  const g = new THREE.Group();
  part(g, "box", 0x3ec4ff, 0, 0.14, 0, 0.14, 0.14, 0.1, true);
  part(g, "box", 0xfff6ea, 0, 0.26, 0, 0.1, 0.08, 0.08);
  const key = part(g, "box", 0xc5ced8, 0, 0.16, -0.08, 0.08, 0.02, 0.02);
  part(g, "sph", 0x141414, -0.03, 0.28, 0.04, 0.015, 0.015, 0.015);
  part(g, "sph", 0x141414, 0.03, 0.28, 0.04, 0.015, 0.015, 0.015);
  g.position.set(0, m.walkY, m.farZ);
  parent.add(g);
  loop((time) => {
    const p = pingpong(time, 6);
    g.position.x = (p * 2 - 1) * (m.outer - 0.45);
    g.position.y = m.walkY + Math.abs(Math.sin(time * Math.PI * 2)) * 0.05;
    key.rotation.z = time * 3;
    g.rotation.y = time % 6 < 3 ? Math.PI / 2 : -Math.PI / 2;
  });
}

function gear(parent, x, y, z, dir) {
  const g = new THREE.Group();
  part(g, "cyl", 0xb7c0ca, 0, 0, 0, 0.12, 0.04, 0.12, true);
  for (let i = 0; i < 6; i++) {
    const tooth = part(g, "box", 0xd5dde6, Math.cos((i / 6) * Math.PI * 2) * 0.12, 0, Math.sin((i / 6) * Math.PI * 2) * 0.12, 0.04, 0.04, 0.04);
    tooth.rotation.y = (i / 6) * Math.PI * 2;
  }
  g.position.set(x, y, z);
  parent.add(g);
  loop((time) => {
    g.rotation.y = time * (Math.PI / 3) * dir;
  });
}

function buildWood(group, m) {
  squirrel(group, m);
  bird(group, m, 0x2f7dff, 1.45, m.farZ - 0.25, 6, 10);
  const red = new THREE.Group();
  part(red, "sph", 0xe23b3b, 0, 0.08, 0, 0.08, 0.06, 0.07, true);
  part(red, "cone", 0xf2c14a, 0.09, 0.08, 0, 0.03, 0.05, 0.03);
  red.children[1].rotation.z = -Math.PI / 2;
  red.position.set(m.right - 0.1, 0.02, m.nearZ + 0.18);
  group.add(red);
  loop((time) => { red.rotation.x = Math.sin(time * 2) * 0.15; });
  part(group, "sph", 0xe23b3b, m.left + 0.15, 0.08, m.nearZ + 0.16, 0.08, 0.05, 0.08);
  part(group, "cyl", 0xf4f0ea, m.left + 0.15, 0.03, m.nearZ + 0.16, 0.03, 0.06, 0.03);
  for (let i = 0; i < 4; i++) {
    const tuft = part(group, "cone", 0x3d9a4a, m.left + 0.35 + i * 0.22, 0.06, m.nearZ + 0.2, 0.05, 0.1, 0.05);
    tuft.position.x = (i - 1.5) * 0.28;
  }
  tree(group, m.left - 0.05, m.farZ - 0.2);
  tree(group, m.right + 0.02, m.farZ - 0.16);
  bandMotes(group, 10, 0xc47a3a, m, true);
}

function buildDesert(group, m) {
  const liz = new THREE.Group();
  part(liz, "sph", 0xc47a3a, 0, 0.06, 0, 0.14, 0.05, 0.06, true);
  part(liz, "cone", 0xe8a05a, -0.16, 0.06, 0, 0.04, 0.12, 0.03);
  liz.children[1].rotation.z = Math.PI / 2;
  liz.position.set(0, m.walkY, m.farZ);
  group.add(liz);
  loop((time) => {
    const p = pingpong(time, 4);
    liz.position.x = (p * 2 - 1) * (m.outer - 0.4);
    liz.rotation.y = time % 4 < 2 ? Math.PI / 2 : -Math.PI / 2;
    liz.children[1].rotation.y = Math.sin(time * 8) * 0.4;
  });
  cactus(group, m.left - 0.02, m.walkY, m.farZ + 0.02, 0.7);
  cactus(group, m.left + 0.2, 0.02, m.nearZ + 0.22, 1.3);
  const palm = new THREE.Group();
  part(palm, "cyl", 0x8a5a32, 0, 0.28, 0, 0.05, 0.4, 0.05);
  part(palm, "sph", 0x3d9a4a, 0, 0.52, 0, 0.16, 0.08, 0.16, true);
  palm.position.set(m.right - 0.15, 0, m.nearZ + 0.2);
  group.add(palm);
  loop((time) => { palm.rotation.z = Math.sin(time * 1.5) * 0.06; });
  part(group, "cyl", 0x2eb8a8, 0, 0.02, m.nearZ + 0.16, 0.16, 0.02, 0.1);
  part(group, "box", 0xf4f1ea, m.right + 0.05, 0.04, m.nearZ + 0.08, 0.12, 0.03, 0.03);
  bandMotes(group, 8, 0xe6c27a, m, false);
}

function buildIce(group, m) {
  const pen = penguinBody(group, 1, false);
  pen.g.position.set(0, m.walkY, m.farZ);
  loop((time) => {
    const p = pingpong(time, 6);
    pen.g.position.x = (p * 2 - 1) * (m.outer - 0.45);
    pen.g.rotation.z = Math.sin(time * Math.PI * 4) * 0.16;
    pen.g.rotation.y = time % 6 < 3 ? Math.PI / 2 : -Math.PI / 2;
    const step = Math.sin(time * Math.PI * 4);
    pen.footL.position.z = 0.06 + step * 0.03;
    pen.footR.position.z = 0.06 - step * 0.03;
  });
  const seal = new THREE.Group();
  part(seal, "sph", 0x8aa0b4, 0, 0.08, 0, 0.16, 0.08, 0.1, true);
  part(seal, "sph", 0xd5e4ee, 0.12, 0.1, 0.02, 0.07, 0.06, 0.06);
  part(seal, "sph", 0x141414, 0.16, 0.12, 0.04, 0.015, 0.015, 0.015);
  seal.position.set(m.right - 0.05, 0.02, m.nearZ + 0.2);
  group.add(seal);
  loop((time) => { seal.position.y = 0.02 + Math.sin(time * (Math.PI * 2 / 3)) * 0.03; });
  const baby = penguinBody(group, 0.62, true);
  baby.g.position.set(m.left + 0.2, 0.02, m.nearZ + 0.18);
  loop((time) => {
    const p = pingpong(time + 1, 6);
    baby.g.position.x = m.left + 0.05 + p * 0.45;
  });
  for (let i = 0; i < 5; i++) {
    const ice = part(group, "cone", 0xeaf8ff, (i - 2) * 0.28, 0.16, m.nearZ + 0.02, 0.04, 0.14, 0.04);
    ice.rotation.x = Math.PI;
  }
  iceberg(group, m.left - 0.08, m.farZ - 0.22, 1);
  iceberg(group, m.right + 0.06, m.farZ - 0.18, 0.75);
  bandMotes(group, 14, 0xf4fbff, m, true);
}

function buildOcean(group, m) {
  const crab = new THREE.Group();
  part(crab, "sph", 0xe23b3b, 0, 0.08, 0, 0.12, 0.06, 0.1, true);
  const clawL = part(crab, "sph", 0xff6a5a, -0.12, 0.08, 0.04, 0.05, 0.04, 0.04);
  const clawR = part(crab, "sph", 0xff6a5a, 0.12, 0.08, 0.04, 0.05, 0.04, 0.04);
  part(crab, "sph", 0x141414, -0.04, 0.16, 0.04, 0.02, 0.02, 0.02);
  part(crab, "sph", 0x141414, 0.04, 0.16, 0.04, 0.02, 0.02, 0.02);
  crab.position.set(0, m.walkY, m.farZ);
  group.add(crab);
  loop((time) => {
    const p = pingpong(time, 6);
    crab.position.x = (p * 2 - 1) * (m.outer - 0.4);
    crab.rotation.y = Math.PI / 2;
    clawL.rotation.z = Math.sin(time * 4) * 0.4;
    clawR.rotation.z = -Math.sin(time * 4) * 0.4;
  });
  bird(group, m, 0xf7f7f7, 1.5, m.farZ - 0.28, 6, 6);
  for (const side of [-1, 1]) {
    const fish = new THREE.Group();
    part(fish, "sph", side < 0 ? 0xf2a020 : 0x3ec4ff, 0, 0, 0, 0.1, 0.05, 0.04, true);
    part(fish, "cone", side < 0 ? 0xe07a20 : 0x2f7dff, -0.1, 0, 0, 0.04, 0.05, 0.02);
    fish.children[1].rotation.z = Math.PI / 2;
    fish.position.set(side * 0.35, 0.02, m.nearZ + 0.22);
    group.add(fish);
    loop((time) => {
      const hop = Math.max(0, Math.sin(time * (Math.PI * 2 / 3) + (side < 0 ? 0 : 1.4)));
      fish.position.y = 0.04 + hop * 0.18;
    });
  }
  part(group, "cone", 0xff5a7a, m.left + 0.05, 0.08, m.nearZ + 0.16, 0.08, 0.14, 0.06);
  part(group, "cone", 0xff8a3a, m.right - 0.2, 0.07, m.nearZ + 0.18, 0.07, 0.12, 0.05);
  part(group, "cone", 0xc07aff, m.right + 0.02, 0.06, m.nearZ + 0.12, 0.06, 0.1, 0.05);
  part(group, "box", 0x7fd6ff, m.left - 0.02, 0.7, m.farZ - 0.12, 0.28, 0.08, 0.08);
  part(group, "box", 0x7fd6ff, m.right + 0.02, 0.66, m.farZ - 0.1, 0.24, 0.07, 0.07);
  bandMotes(group, 10, 0xeaf8ff, m, true);
}

function buildCrystal(group, m) {
  crystal(group, m.left - 0.02, m.walkY, m.farZ, 0x9a78f0);
  crystal(group, m.right + 0.02, m.walkY, m.farZ, 0x7eb6e8);
  crystal(group, m.left + 0.08, 0.02, m.nearZ + 0.18, 0xb7c6e6);
  crystal(group, m.right - 0.08, 0.02, m.nearZ + 0.16, 0x8ea0c8);
  const fly = (x0, z0, phase) => {
    const g = new THREE.Group();
    part(g, "sph", 0xfff6ea, 0, 0, 0, 0.04, 0.03, 0.04, true);
    const wing = part(g, "box", 0xd0dcff, 0, 0.02, 0, 0.1, 0.01, 0.05);
    group.add(g);
    loop((time) => {
      const a = time * 1.1 + phase;
      g.position.set(x0 + Math.sin(a) * 0.35, 1.15 + Math.sin(a * 2) * 0.12, z0 + Math.cos(a) * 0.12);
      wing.rotation.z = Math.sin(time * 14) * 0.6;
    });
  };
  fly(0, m.farZ - 0.2, 0);
  fly(0.2, m.nearZ + 0.15, 2);
  bandMotes(group, 8, 0xe4ecff, m, false);
}

function buildToy(group, m) {
  robotToy(group, m);
  for (let i = 0; i < 3; i++) {
    const balloon = part(group, "sph", [0xff5a9a, 0x3ec4ff, 0xf2c14a][i], (i - 1) * 0.28, 0.28, m.nearZ + 0.2, 0.08, 0.1, 0.08, true);
    part(group, "cyl", 0x5c646e, balloon.position.x, 0.1, balloon.position.z, 0.008, 0.16, 0.008);
    const baseY = 0.28;
    loop((time) => { balloon.position.y = baseY + Math.sin(time * 2 + i) * 0.05; });
  }
  part(group, "box", 0xe23b3b, m.left - 0.02, 0.85, m.farZ - 0.12, 0.14, 0.14, 0.14, true);
  part(group, "box", 0x2f7dff, m.left - 0.02, 1.0, m.farZ - 0.12, 0.1, 0.1, 0.1);
  part(group, "box", 0xf2c14a, m.right + 0.02, 0.82, m.farZ - 0.1, 0.12, 0.16, 0.12, true);
}

function mushroomHouse(parent, x, z, cap) {
  const g = new THREE.Group();
  part(g, "cyl", 0xf4f0ea, 0, 0.12, 0, 0.08, 0.2, 0.08);
  part(g, "sph", cap, 0, 0.26, 0, 0.16, 0.1, 0.16, true);
  part(g, "box", 0xf2c14a, 0, 0.12, 0.08, 0.04, 0.04, 0.01);
  g.position.set(x, 0.55, z);
  parent.add(g);
  loop((time) => {
    g.children[2].material = M(Math.sin(time * 1.5) > 0 ? 0xf2c14a : 0x6a4018);
  });
}

function buildMushroom(group, m) {
  mushroomHouse(group, m.left - 0.05, m.farZ - 0.16, 0xe23b3b);
  mushroomHouse(group, m.right + 0.02, m.nearZ + 0.16, 0xc46eb0);
  part(group, "sph", 0xe23b3b, m.left + 0.05, m.walkY + 0.08, m.farZ, 0.08, 0.05, 0.08, true);
  part(group, "cyl", 0xf4f0ea, m.left + 0.05, m.walkY + 0.02, m.farZ, 0.03, 0.06, 0.03);
  part(group, "sph", 0xf08ab0, m.right - 0.05, m.walkY + 0.07, m.farZ, 0.07, 0.045, 0.07, true);
  bandMotes(group, 8, 0xf2e27a, m, false);
}

function buildCandy(group, m) {
  const cookie = new THREE.Group();
  part(cookie, "cyl", 0xe7b07a, 0, 0.06, 0, 0.12, 0.05, 0.12, true);
  part(cookie, "sph", 0x6a3a1a, 0.04, 0.09, 0.03, 0.03, 0.02, 0.03);
  part(cookie, "sph", 0x6a3a1a, -0.04, 0.09, -0.02, 0.025, 0.02, 0.025);
  cookie.position.set(m.left + 0.25, 0.02, m.nearZ + 0.2);
  group.add(cookie);
  loop((time) => {
    cookie.rotation.y = time * (Math.PI * 2 / 18);
    cookie.position.x = m.left + 0.15 + pingpong(time, 8) * 0.5;
  });
  const pop = (x, z) => {
    const g = new THREE.Group();
    part(g, "sph", 0xff5a9a, 0, 0.22, 0, 0.08, 0.08, 0.08, true);
    part(g, "cyl", 0xf4f7fb, 0, 0.08, 0, 0.02, 0.16, 0.02);
    g.position.set(x, 0, z);
    group.add(g);
    loop((time) => { g.rotation.z = Math.sin(time * 2) * 0.12; });
  };
  pop(m.right - 0.1, m.nearZ + 0.18);
  pop(m.left - 0.02, m.farZ - 0.12);
  part(group, "sph", 0xfff6ea, m.left + 0.08, m.walkY + 0.06, m.farZ, 0.1, 0.06, 0.1, true);
  part(group, "sph", 0xe23b3b, m.left + 0.08, m.walkY + 0.14, m.farZ, 0.04, 0.04, 0.04);
  part(group, "sph", 0xfff6ea, m.right - 0.06, m.walkY + 0.05, m.farZ, 0.08, 0.05, 0.08);
  bandMotes(group, 12, 0xff8ab0, m, true);
}

function buildLava(group, m) {
  const volcano = (x, z, s) => {
    const g = new THREE.Group();
    part(g, "cone", 0x4a2018, 0, 0.22 * s, 0, 0.2 * s, 0.4 * s, 0.18 * s, true);
    part(g, "cyl", 0xff4a18, 0, 0.4 * s, 0, 0.06 * s, 0.04, 0.06 * s);
    g.position.set(x, 0.55, z);
    group.add(g);
    const puffs = [0, 1, 2].map((i) => part(g, "sph", 0x6a5348, 0, 0.46 * s, 0, 0.06, 0.05, 0.06));
    const puffBase = puffs.map((puff) => puff.scale.clone());
    loop((time) => {
      puffs.forEach((puff, i) => {
        const t = (time / 3 + i / 3) % 1;
        puff.position.y = 0.42 * s + t * 0.35;
        puff.position.x = Math.sin(time + i) * 0.04;
        const k = 0.7 + t;
        puff.scale.copy(puffBase[i]).multiplyScalar(k);
      });
    });
  };
  volcano(m.left - 0.02, m.farZ - 0.18, 1);
  volcano(m.right + 0.04, m.farZ - 0.14, 0.8);
  part(group, "box", 0x3a2418, m.left + 0.15, 0.05, m.nearZ + 0.16, 0.14, 0.06, 0.1);
  part(group, "box", 0x2a1814, m.right - 0.1, 0.04, m.nearZ + 0.18, 0.1, 0.05, 0.08);
  const glow = part(group, "box", 0xff6a18, 0, 0.02, m.nearZ + 0.08, m.outer * 0.9, 0.02, 0.06);
  const glowY = glow.scale.y;
  loop((time) => { glow.scale.y = glowY * (0.85 + Math.sin(time * Math.PI) * 0.25); });
  bandMotes(group, 12, 0xffb060, m, true);
}

function buildJungle(group, m) {
  const vine = part(group, "cyl", 0x3d7a3a, m.right + 0.02, 1.05, m.farZ, 0.03, 0.45, 0.03);
  const monk = new THREE.Group();
  part(monk, "sph", 0xc47a3a, 0, -0.16, 0, 0.09, 0.1, 0.08, true);
  part(monk, "sph", 0xe8c9a0, 0, -0.26, 0.04, 0.06, 0.06, 0.05);
  part(monk, "cyl", 0xc47a3a, 0, 0, 0, 0.02, 0.16, 0.02);
  monk.position.set(m.right + 0.02, 1.15, m.farZ);
  group.add(monk);
  loop((time) => { monk.rotation.z = Math.sin(time * (Math.PI * 2 / 3)) * 0.45; });
  const birdG = new THREE.Group();
  part(birdG, "sph", 0x3d9a4a, 0, 0.08, 0, 0.08, 0.06, 0.07, true);
  part(birdG, "sph", 0xe23b3b, 0.06, 0.1, 0.02, 0.04, 0.04, 0.04);
  const wing = part(birdG, "box", 0xf2c14a, 0, 0.1, 0, 0.1, 0.015, 0.05);
  birdG.position.set(m.left + 0.08, m.walkY, m.farZ);
  group.add(birdG);
  loop((time) => {
    const beat = (time % 4) < 0.35 || ((time % 4) > 0.5 && (time % 4) < 0.8);
    wing.rotation.z = beat ? Math.sin(time * 30) * 0.7 : 0.1;
  });
  part(group, "cyl", 0x2f6a32, m.left - 0.02, 0.85, m.farZ - 0.05, 0.025, 0.4, 0.025);
  part(group, "box", 0x3d9a4a, m.left + 0.15, 0.55, m.farZ - 0.18, 0.22, 0.08, 0.12);
  part(group, "box", 0x2f8a3a, m.right - 0.2, 0.08, m.nearZ + 0.18, 0.2, 0.06, 0.12);
}

function buildAlien(group, m) {
  const alien = new THREE.Group();
  part(alien, "sph", 0x6adf5a, 0, 0.12, 0, 0.09, 0.11, 0.08, true);
  part(alien, "sph", 0x141414, -0.03, 0.16, 0.06, 0.02, 0.025, 0.02);
  part(alien, "sph", 0x141414, 0.03, 0.16, 0.06, 0.02, 0.025, 0.02);
  const ant = part(alien, "cyl", 0xc6f25a, 0, 0.24, 0, 0.012, 0.1, 0.012);
  part(alien, "sph", 0xf2e27a, 0, 0.3, 0, 0.025, 0.025, 0.025);
  alien.position.set(0, m.walkY, m.farZ);
  group.add(alien);
  loop((time) => {
    const p = pingpong(time, 6);
    alien.position.x = (p * 2 - 1) * (m.outer - 0.45);
    alien.position.y = m.walkY + Math.abs(Math.sin(time * Math.PI * 2)) * 0.06;
    ant.rotation.z = Math.sin(time * 4) * 0.2;
  });
  const ufo = new THREE.Group();
  part(ufo, "cyl", 0xc5ced8, 0, 0, 0, 0.16, 0.04, 0.16, true);
  part(ufo, "sph", 0x9af0c8, 0, 0.05, 0, 0.08, 0.06, 0.08);
  const beam = part(ufo, "cone", 0xc6f2a0, 0, -0.12, 0, 0.08, 0.16, 0.08);
  if (!buildAlien.beamMat) {
    buildAlien.beamMat = new THREE.MeshBasicMaterial({ color: 0xc6f2a0, transparent: true, opacity: 0.28, depthWrite: false });
  }
  beam.material = buildAlien.beamMat;
  group.add(ufo);
  loop((time) => {
    const p = pingpong(time, 6);
    ufo.position.set((p * 2 - 1) * (m.outer - 0.2), 1.45, m.farZ - 0.22);
    beam.material.opacity = 0.18 + (Math.sin(time * 6) > 0 ? 0.16 : 0);
  });
  const pink = new THREE.Group();
  part(pink, "sph", 0xff8ab0, 0, 0.1, 0, 0.08, 0.09, 0.07, true);
  part(pink, "sph", 0x141414, -0.025, 0.13, 0.05, 0.015, 0.018, 0.015);
  part(pink, "sph", 0x141414, 0.025, 0.13, 0.05, 0.015, 0.018, 0.015);
  pink.position.set(m.left + 0.25, 0.02, m.nearZ + 0.18);
  group.add(pink);
  loop((time) => { pink.position.x = m.left + 0.1 + pingpong(time, 6) * 0.4; });
  part(group, "sph", 0xc6f25a, m.right - 0.05, 0.12, m.nearZ + 0.16, 0.06, 0.1, 0.06, true);
  part(group, "sph", 0x9a78f0, m.left - 0.02, 0.85, m.farZ - 0.12, 0.08, 0.12, 0.08);
}

function buildMachine(group, m) {
  const bot = new THREE.Group();
  part(bot, "box", 0x3ec4ff, 0, 0.14, 0, 0.12, 0.1, 0.1, true);
  part(bot, "cyl", 0x5c646e, -0.06, 0.04, 0, 0.04, 0.04, 0.04);
  part(bot, "cyl", 0x5c646e, 0.06, 0.04, 0, 0.04, 0.04, 0.04);
  const head = part(bot, "box", 0xd5dde6, 0, 0.24, 0, 0.08, 0.06, 0.07);
  bot.position.set(0, m.walkY, m.farZ);
  group.add(bot);
  loop((time) => {
    const p = pingpong(time, 6);
    bot.position.x = (p * 2 - 1) * (m.outer - 0.45);
    head.rotation.x = Math.sin(time * 2) * 0.2;
    bot.rotation.y = time % 6 < 3 ? Math.PI / 2 : -Math.PI / 2;
  });
  gear(group, m.left - 0.02, m.walkY + 0.08, m.farZ + 0.02, 1);
  gear(group, m.right + 0.02, m.walkY + 0.06, m.farZ, -1);
  gear(group, m.left + 0.15, 0.1, m.nearZ + 0.18, 1);
  gear(group, 0, 0.1, m.nearZ + 0.2, -1);
  gear(group, m.right - 0.15, 0.1, m.nearZ + 0.16, 1);
  const pipe = part(group, "cyl", 0x8a929c, m.left + 0.05, 0.85, m.farZ - 0.16, 0.05, 0.22, 0.05, true);
  const steam = [0, 1, 2].map((i) => part(group, "sph", 0xf4f7fb, pipe.position.x, 1.05, pipe.position.z, 0.05, 0.04, 0.05));
  loop((time) => {
    steam.forEach((puff, i) => {
      const t = (time / 2 + i / 3) % 1;
      puff.position.y = 1.02 + t * 0.35;
      puff.position.x = pipe.position.x + Math.sin(time + i) * 0.03;
    });
  });
  part(group, "cyl", 0x8a929c, m.right - 0.05, 0.78, m.farZ - 0.12, 0.04, 0.28, 0.04);
  bandMotes(group, 6, 0xd0d8e4, m, false);
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

export function createBoardDeco(planet, span) {
  const group = new THREE.Group();
  group.name = "board-deco";
  const build = BUILDERS[planet] || BUILDERS.wood;
  build(group, metrics(span));
  // Grow the trim in place. Positions stay outside the cells.
  for (const child of group.children) {
    if (child.isPoints) {
      child.material.size = 0.16;
      continue;
    }
    child.scale.multiplyScalar(2.05);
  }
  return group;
}
