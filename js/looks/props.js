/** Shared mesh helpers for the Wood looks. Geometry is original. */
import * as THREE from "../vendor/three.module.js";

export const GEM = {
  red: 0xe23b3b,
  blue: 0x2f7dff,
  green: 0x1ea85a,
  purple: 0xa43adf,
};

export function canvasTexture(canvas, nearest = false) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = nearest ? 1 : 4;
  if (nearest) {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
  }
  tex.needsUpdate = true;
  return tex;
}

export function cellCanvas(n, px, paint, crisp = false) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.max(1, n * px);
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = !crisp;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) paint(g, c * px, r * px, px, r, c);
  }
  return canvas;
}

export function roundFill(g, x, y, w, h, rad) {
  const r = Math.max(0, Math.min(rad, w * 0.5, h * 0.5));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fill();
}

export function lit(hex, roughness, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness,
    metalness: 0,
    emissive,
    emissiveIntensity,
    envMapIntensity: roughness > 0.8 ? 0.08 : 0.2,
  });
}

export function flat(hex) {
  return new THREE.MeshBasicMaterial({ color: hex });
}

export function swapMat(mesh, mat) {
  if (!mesh || !mat || mesh.material === mat) return;
  const prev = mesh.material;
  if (mesh.userData && mesh.userData.ownMat && prev && prev !== mat) prev.dispose();
  mesh.material = mat;
  if (mesh.userData) mesh.userData.ownMat = false;
}

export function restyleRig(rig, o) {
  rig.traverse((node) => {
    if (!node.isMesh) return;
    if (node.name === "screen-ink") {
      node.visible = !o.hideInk;
      return;
    }
    if (o.gloss && node.material === o.gloss) node.visible = false;
  });
  rig.traverse((node) => {
    if (!node.isMesh || node.name === "screen-ink") return;
    if (node.material === o.frameMats.mid) swapMat(node, o.mats.frameMid);
    else if (node.material === o.frameMats.hi) swapMat(node, o.mats.frameHi);
    else if (node.material === o.frameMats.low) swapMat(node, o.mats.frameLow);
    else if (node.material === o.frameMats.ink) swapMat(node, o.mats.frameInk);
    else if (node.material === o.floorEdge) swapMat(node, o.mats.side);
    else if (node.userData.noInk && node.geometry && node.geometry.type === "PlaneGeometry") {
      swapMat(node, o.mats.top);
    }
  });
  rig.traverse((node) => {
    const kind = node.userData && node.userData.kind;
    if (kind === "glass" && o.mats.glass) {
      swapMat(node, o.mats.glass);
      return;
    }
    if (kind === "button" && o.dressButton) {
      o.dressButton(node);
      return;
    }
    if (kind !== "wall" && kind !== "color" && kind !== "shift") return;
    const group = node.parent;
    if (!group || group.userData.lookWall) return;
    group.userData.lookWall = true;
    const name = node.userData.color || "green";
    group.traverse((child) => {
      if (!child.isMesh || child.name === "screen-ink") return;
      if (o.gloss && child.material === o.gloss) {
        child.visible = false;
        return;
      }
      const part = child === node ? "body"
        : child.material === o.mats.frameInk ? "rim"
          : child.position.y > 0.08 ? "cap" : "base";
      const mat = o.wallMat(name, part, kind);
      if (mat) swapMat(child, mat);
    });
  });
}

export function tintButton(node, plateHex, domeHex) {
  const dome = node.userData && node.userData.dome;
  if (dome && dome.material && dome.material.clone) {
    const mat = dome.material.clone();
    mat.color.setHex(domeHex);
    if (mat.emissive) mat.emissive.setHex(domeHex);
    dome.material = mat;
    dome.userData.ownMat = true;
  }
  if (node.material && node.material.clone) {
    const mat = node.material.clone();
    mat.color.setHex(plateHex);
    node.material = mat;
    node.userData.ownMat = true;
  }
}

export function dressHole(stock, mats) {
  if (!stock) return;
  stock.traverse((node) => {
    if (!node.isMesh) return;
    let mat = mats.lip;
    if (node.name === "hole-mouth") mat = mats.mouth;
    else if (node.name === "hole-ring") mat = mats.ring;
    else if (node.geometry && node.geometry.type === "TorusGeometry") mat = mats.rim;
    else if (node.geometry && node.geometry.type === "RingGeometry") mat = mats.lip;
    else mat = mats.shadow;
    swapMat(node, mat);
  });
}

export function frameRim(span, frameT) {
  const inner = span / 2 - 0.01;
  return { inner, outer: inner + frameT, rim: inner + frameT * 0.55 };
}

export function propScale(frameT) {
  return Math.min(1.15, Math.max(0.48, frameT / 0.34));
}

/** Screen-stable prop size. A bigger board is farther from the camera. */
export function layoutProps(ctx) {
  const { outer } = frameRim(ctx.span, ctx.frameT);
  const sc = Math.min(2.05, Math.max(1.22, ctx.span / 2.85));
  const y = ctx.boardTop;
  const nose = 0.36 * sc;
  return {
    sc,
    y,
    squirrel: { x: 0, y, z: -(outer + nose * 0.42), s: sc, rx: -0.95, ry: 0, rz: 0 },
    treeL: { x: -outer + 0.02, y, z: -outer + 0.06, s: sc * 1.22 },
    treeR: { x: outer - 0.02, y, z: -outer * 0.48, s: sc * 1.08 },
    stump: { x: outer * 0.18, y, z: outer - 0.01, s: sc * 1.55 },
    acorn: { x: -outer * 0.22, y: y + 0.02, z: outer - 0.02, s: sc * 1.2 },
  };
}

export function applyLayout(parts, layout) {
  const put = (node, spec) => {
    if (!node || !spec) return;
    node.position.set(spec.x, spec.y, spec.z);
    node.scale.setScalar(spec.s);
    if (spec.rx != null) node.rotation.set(spec.rx, spec.ry || 0, spec.rz || 0);
  };
  put(parts.squirrel, layout.squirrel);
  put(parts.treeL, layout.treeL);
  put(parts.treeR, layout.treeR);
  put(parts.stump, layout.stump);
  put(parts.acorn, layout.acorn);
}

export function softDot() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const g = canvas.getContext("2d");
  const grd = g.createRadialGradient(16, 16, 1, 16, 16, 16);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  const tex = canvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addMesh(parent, geometry, material, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

export function makeSquirrel(mats) {
  const group = new THREE.Group();
  const ball = new THREE.SphereGeometry(1, 12, 9);
  const ear = new THREE.ConeGeometry(1, 1.55, 6);
  const eye = new THREE.SphereGeometry(1, 8, 6);
  addMesh(group, ball, mats.fur, 0, 0.12, 0.02, 0.16, 0.1, 0.2);
  addMesh(group, ball, mats.belly, 0, 0.16, 0.04, 0.09, 0.045, 0.11);
  addMesh(group, ball, mats.fur, 0, 0.16, 0.2, 0.11, 0.09, 0.11);
  addMesh(group, ball, mats.belly, 0, 0.15, 0.28, 0.05, 0.035, 0.05);
  addMesh(group, ear, mats.fur, -0.07, 0.3, 0.16, 0.055, 0.1, 0.05);
  addMesh(group, ear, mats.fur, 0.07, 0.3, 0.16, 0.055, 0.1, 0.05);
  addMesh(group, ear, mats.ear, -0.07, 0.29, 0.185, 0.026, 0.05, 0.024);
  addMesh(group, ear, mats.ear, 0.07, 0.29, 0.185, 0.026, 0.05, 0.024);
  const leftEye = addMesh(group, eye, mats.eye, -0.045, 0.19, 0.29, 0.02, 0.022, 0.014);
  const rightEye = addMesh(group, eye, mats.eye, 0.045, 0.19, 0.29, 0.02, 0.022, 0.014);
  leftEye.castShadow = false;
  rightEye.castShadow = false;
  const shine = new THREE.MeshBasicMaterial({ color: 0xfff8ee });
  const leftDot = addMesh(group, eye, shine, -0.04, 0.198, 0.302, 0.007, 0.007, 0.004);
  const rightDot = addMesh(group, eye, shine, 0.05, 0.198, 0.302, 0.007, 0.007, 0.004);
  leftDot.castShadow = false;
  rightDot.castShadow = false;
  addMesh(group, ball, mats.nose, 0, 0.15, 0.32, 0.016, 0.012, 0.014);
  addMesh(group, ball, mats.fur, -0.07, 0.045, 0.14, 0.038, 0.02, 0.045);
  addMesh(group, ball, mats.fur, 0.07, 0.045, 0.14, 0.038, 0.02, 0.045);
  const tail = new THREE.Group();
  tail.position.set(0, 0.1, -0.12);
  group.add(tail);
  const curls = [
    [0.0, 0.06, -0.05, 0.09],
    [-0.07, 0.12, -0.12, 0.1],
    [-0.02, 0.2, -0.18, 0.12],
    [0.08, 0.22, -0.15, 0.1],
    [0.12, 0.14, -0.06, 0.08],
  ];
  for (const [x, y, z, s] of curls) {
    addMesh(tail, ball, mats.tail, x, y, z, s, s * 0.82, s);
  }
  group.userData.tail = tail;
  return group;
}

export function makeTree(bark, leafA, leafB) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.072, 0.32, 6), bark);
  trunk.position.y = 0.16;
  trunk.castShadow = false;
  trunk.receiveShadow = false;
  group.add(trunk);
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const puffs = [
    [0, 0.4, 0, 0.2, leafA],
    [0.11, 0.34, 0.03, 0.13, leafB],
    [-0.1, 0.33, -0.02, 0.12, leafA],
    [0.02, 0.5, -0.03, 0.1, leafB],
  ];
  for (const [x, y, z, s, mat] of puffs) {
    const mesh = new THREE.Mesh(ico, mat);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(s);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  }
  return group;
}

export function makeStump(bark, top) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.12, 7), bark);
  body.position.y = 0.06;
  body.castShadow = false;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.025, 7), top);
  cap.position.y = 0.125;
  cap.receiveShadow = true;
  group.add(body, cap);
  return group;
}

export function makeAcorn(nut, cap) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), nut);
  body.scale.y = 1.15;
  body.position.y = 0.055;
  body.castShadow = false;
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6), cap);
  lid.scale.y = 0.5;
  lid.position.y = 0.095;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.035, 5), cap);
  stem.position.y = 0.125;
  group.add(body, lid, stem);
  return group;
}

export function goalRing(material, x, z, boardTop) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 8, 28), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, boardTop + 0.028, z);
  mesh.name = "look-goal";
  return mesh;
}

let shaftMap = null;
export function shaftMaterial(opacity) {
  if (!shaftMap) {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 256;
    const g = canvas.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 64, 0);
    grd.addColorStop(0, "rgba(255,255,255,0)");
    grd.addColorStop(0.5, "rgba(255,246,220,0.95)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 256);
    const fade = g.createLinearGradient(0, 0, 0, 256);
    fade.addColorStop(0, "rgba(255,255,255,0)");
    fade.addColorStop(0.2, "rgba(255,255,255,1)");
    fade.addColorStop(1, "rgba(255,255,255,0)");
    g.globalCompositeOperation = "destination-in";
    g.fillStyle = fade;
    g.fillRect(0, 0, 64, 256);
    shaftMap = canvasTexture(canvas);
  }
  return new THREE.MeshBasicMaterial({
    map: shaftMap,
    transparent: true,
    depthWrite: false,
    opacity,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}
