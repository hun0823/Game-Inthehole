/**
 * Toy planet GLB kit (?glb=1). Prototypes are named proto_* in assets/models/toy_planet.glb.
 */
import * as THREE from "./vendor/three.module.js";
import { mergeGeometries } from "./vendor/BufferGeometryUtils.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { MeshoptDecoder } from "./vendor/meshopt_decoder.module.js";
import { inkOutlineMaterial } from "./sphereMaps.js";
import { decoMetrics } from "./boardDeco.js";

const GLB_URL = new URL("../assets/models/toy_planet.glb", import.meta.url).href;
const BOARD_TOP = 0.5;
const BUTTON_Y = BOARD_TOP + 0.055;

const BRICKS = [
  [242, 226, 196],
  [244, 206, 214],
  [196, 228, 210],
  [244, 230, 176],
  [216, 204, 232],
  [196, 220, 236],
];

const GEM_HEX = { red: 0xe23b3b, blue: 0x2f7dff, green: 0x1ea85a, purple: 0xa43adf };

const PROTO_ROOTS = [
  "proto_wall_red_v", "proto_wall_blue_v", "proto_wall_green_v", "proto_wall_purple_v",
  "proto_wall_red", "proto_wall_blue", "proto_wall_green", "proto_wall_purple",
  "proto_gate_purple", "proto_gate_green", "proto_gate_blue", "proto_gate_red",
  "proto_button_purple", "proto_button_green", "proto_button_blue", "proto_button_red",
  "proto_floor_b", "proto_floor_a",
  "proto_frame_n7",
  "proto_goal_toy_star",
  "proto_deco_balloon", "proto_deco_stack_b", "proto_deco_stack", "proto_deco_robot",
];

const NAME_COLORS = {
  toon_frame_mid: 0xe25b8a,
  toon_frame_hi: 0xffb8d0,
  toon_frame_low: 0xc43d6c,
  toon_button_plate: 0xffffff,
  toon_goal_pedestal: 0xe23b3b,
  toon_goal_lid: 0xffc21a,
  toon_goal_star: 0xffc21a,
  toon_gate_lens: 0xffffff,
  toon_deco_orange: 0xff8a33,
  toon_deco_grey: 0x8a929c,
};

let loadJob = null;
let library = null;
let gradientMap = null;
let floorQueue = [];
let wallQueue = [];
let gateQueue = [];

function brickIndex(n) {
  const used = Array.from({ length: n }, () => Array(n).fill(-1));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      let k = (r * 2 + c * 3) % BRICKS.length;
      const left = c > 0 ? used[r][c - 1] : -1;
      const up = r > 0 ? used[r - 1][c] : -1;
      while (k === left || k === up) k = (k + 1) % BRICKS.length;
      used[r][c] = k;
    }
  }
  return used;
}

function rootFor(name) {
  if (!name || !name.startsWith("proto_")) return null;
  for (const root of PROTO_ROOTS) {
    if (name === root || name.startsWith(`${root}_`)) return root;
  }
  return null;
}

function isInkMesh(obj) {
  const n = obj.name || "";
  const m = obj.material?.name || "";
  return n.endsWith("_ink") || m === "ink" || m.startsWith("ink.");
}

function ramp() {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([32, 160, 255]);
  gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

function resolveColor(srcMat) {
  const name = srcMat?.name || "";
  if (NAME_COLORS[name] != null) return NAME_COLORS[name];
  if (name.startsWith("toon_wall_") || name.startsWith("toon_button_dome") || name.startsWith("toon_button_side")) {
    const c = srcMat?.color;
    if (c && (c.r + c.g + c.b) > 0.05) return c.getHex();
  }
  if (name.startsWith("toon_floor") || name.includes("_stud") || name.includes("_tile")) {
    const c = srcMat?.color;
    if (c && (c.r + c.g + c.b) > 0.05) return c.getHex();
    return 0xf2e2c4;
  }
  const c = srcMat?.color;
  return c?.getHex?.() ?? 0xffffff;
}

function toToonMaterial(srcMat, colorOverride = null) {
  const name = srcMat?.name || "";
  const color = colorOverride ?? resolveColor(srcMat);
  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: ramp(),
    toneMapped: false,
    vertexColors: false,
  });
  mat.name = name || "toon";
  return mat;
}

function attachInk(mesh) {
  if (mesh.isInstancedMesh) return;
  const ink = new THREE.Mesh(mesh.geometry, inkOutlineMaterial());
  ink.scale.setScalar(1.06);
  ink.raycast = () => {};
  mesh.add(ink);
}

function collectTemplate(scene, rootName) {
  const node = scene.getObjectByName(rootName);
  if (node && (node.children.length || node.isMesh)) return node;
  const group = new THREE.Group();
  group.name = rootName;
  scene.updateMatrixWorld(true);
  const parts = scene.children.filter((obj) => rootFor(obj.name) === rootName);
  if (!parts.length) return null;
  const anchor = new THREE.Vector3();
  parts[0].getWorldPosition(anchor);
  for (const src of parts) {
    const clone = src.clone(true);
    const wp = new THREE.Vector3();
    const wq = new THREE.Quaternion();
    const ws = new THREE.Vector3();
    src.updateWorldMatrix(true, false);
    src.matrixWorld.decompose(wp, wq, ws);
    clone.position.copy(wp.sub(anchor));
    clone.quaternion.copy(wq);
    clone.scale.copy(ws);
    group.add(clone);
  }
  return group;
}

function processedGroupFromTemplate(tpl, colorOverride = null) {
  const root = new THREE.Group();
  root.name = tpl.name;
  const toDrop = [];
  tpl.traverse((o) => {
    if (o.isMesh && isInkMesh(o)) toDrop.push(o);
  });
  toDrop.forEach((o) => o.parent?.remove(o));

  tpl.traverse((o) => {
    if (!o.isMesh || isInkMesh(o)) return;
    const mesh = o.clone(false);
    mesh.geometry = o.geometry;
    mesh.material = toToonMaterial(o.material, colorOverride);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (o.parent && o.parent !== tpl) {
      const p = new THREE.Group();
      p.position.copy(o.position);
      p.quaternion.copy(o.quaternion);
      p.scale.copy(o.scale);
      p.add(mesh);
      root.add(p);
    } else {
      mesh.position.copy(o.position);
      mesh.quaternion.copy(o.quaternion);
      mesh.scale.copy(o.scale);
      root.add(mesh);
    }
    attachInk(mesh);
  });
  return root;
}

function stripVertexColors(geo) {
  if (geo?.getAttribute("color")) geo.deleteAttribute("color");
  return geo;
}

function mergedGeometryFromTemplate(tpl) {
  const geos = [];
  const toDrop = [];
  tpl.traverse((o) => {
    if (o.isMesh && isInkMesh(o)) toDrop.push(o);
  });
  tpl.updateMatrixWorld(true);
  tpl.traverse((o) => {
    if (!o.isMesh || isInkMesh(o)) return;
    const g = o.geometry.clone();
    o.updateWorldMatrix(true, false);
    g.applyMatrix4(o.matrixWorld);
    geos.push(g);
  });
  if (!geos.length) return null;
  return stripVertexColors(mergeGeometries(geos, false));
}

function buildLibrary(gltf) {
  const templates = new Map();
  const merged = new Map();
  for (const root of PROTO_ROOTS) {
    const tpl = collectTemplate(gltf.scene, root);
    if (!tpl) continue;
    templates.set(root, tpl);
    if (root.startsWith("proto_floor_")) {
      const geo = mergedGeometryFromTemplate(tpl);
      if (geo) merged.set(root, geo);
    }
  }
  return { gltf, templates, merged };
}

export function resetToyQueues() {
  floorQueue.length = 0;
  wallQueue.length = 0;
  gateQueue.length = 0;
}

export function glbToyWanted() {
  try {
    return new URLSearchParams(location.search).get("glb") === "1";
  } catch {
    return false;
  }
}

export function whenToyGlbReady() {
  if (!glbToyWanted()) return Promise.resolve(null);
  return loadToyGlb().catch(() => null);
}

export function loadToyGlb() {
  if (library) return Promise.resolve(library);
  if (loadJob) return loadJob;
  loadJob = (async () => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(GLB_URL);
    library = buildLibrary(gltf);
    return library;
  })().catch((err) => {
    loadJob = null;
    throw err;
  });
  return loadJob;
}

export function toyGlbReady() {
  return !!library;
}

function cloneProto(name, colorOverride = null) {
  const tpl = library?.templates.get(name);
  if (!tpl) return null;
  return processedGroupFromTemplate(tpl, colorOverride);
}

export function listProtoKeys() {
  return library ? [...library.templates.keys()] : [];
}

function rgbToHex(rgb) {
  return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
}

export function mountToyFloor(rig, n, step, cellXZ) {
  const used = brickIndex(n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const k = used[r][c];
      const pick = k % 2 === 0 ? "proto_floor_a" : "proto_floor_b";
      const { x, z } = cellXZ(r, c);
      floorQueue.push({ pick, x, z, color: rgbToHex(BRICKS[k]) });
    }
  }
}

export function mountToyFrame(rig, n) {
  return false;
}

export function mountToyWall(group, color, axis) {
  wallQueue.push({ color, axis, group });
  return group;
}

export function mountToyGate(group, color) {
  gateQueue.push({ color, group });
  return group;
}

export function mountToyButton(x, z, color, row, col) {
  const key = GEM_HEX[color] ? `proto_button_${color}` : "proto_button_red";
  const btn = cloneProto(key);
  if (!btn) return null;
  btn.position.set(x, BUTTON_Y, z);
  btn.userData = {
    kind: "button",
    row,
    col,
    color,
    glb: true,
    spent: false,
    baseY: BUTTON_Y,
  };
  return btn;
}

export function mountToyDeco(rig, span, frameT) {
  const m = decoMetrics(span, frameT);
  const robot = cloneProto("proto_deco_robot");
  const stack = cloneProto("proto_deco_stack");
  const stackB = cloneProto("proto_deco_stack_b");
  const balloon = cloneProto("proto_deco_balloon");
  if (robot) {
    robot.position.set(0, m.y, m.top);
    robot.scale.setScalar(1.15 * m.unit);
    rig.add(robot);
  }
  if (stack) {
    stack.position.set(-m.outer * 0.9, m.y, m.top);
    stack.scale.setScalar(0.95 * m.unit);
    rig.add(stack);
  }
  if (stackB) {
    stackB.position.set(m.outer * 0.9, m.y, m.top);
    stackB.scale.setScalar(0.92 * m.unit);
    rig.add(stackB);
  }
  if (balloon) {
    balloon.position.set(m.outer * 0.55, m.y + 0.35, m.top - 0.15);
    balloon.scale.setScalar(1.1 * m.unit);
    rig.add(balloon);
  }
}

export function mountToyStarGoal(goalGroup, api) {
  const star = cloneProto("proto_goal_toy_star");
  if (!star) return false;
  goalGroup.add(star);
  const lid = star.getObjectByName("goal_lid");
  const doll = star.getObjectByName("goal_star");
  if (lid) api.act(lid, (b, env) => { b.node.rotation.x = -env * 1.35; });
  if (doll) api.act(doll, (b, env) => { b.node.position.y = b.y + env * api.hh(0.16); });
  api.shadow(goalGroup, 0, api.zb(-0.48), 0.4, 0.24);
  return true;
}

export function flushToyMeshes(rig) {
  if (!library) return;

  const geoA = library.merged.get("proto_floor_a");
  const geoB = library.merged.get("proto_floor_b");
  if (geoA && geoB && floorQueue.length) {
    const buckets = new Map();
    for (const q of floorQueue) {
      const key = `${q.pick}:${q.color}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(q);
    }
    const m4 = new THREE.Matrix4();
    for (const [key, items] of buckets) {
      const [pick, hexStr] = key.split(":");
      const geo = pick === "proto_floor_a" ? geoA : geoB;
      const hex = Number(hexStr);
      const mat = toToonMaterial({ name: "toon_floor", color: new THREE.Color(hex) }, hex);
      const inst = new THREE.InstancedMesh(geo, mat, items.length);
      inst.castShadow = true;
      inst.receiveShadow = true;
      items.forEach((q, i) => {
        m4.makeTranslation(q.x, 0, q.z);
        inst.setMatrixAt(i, m4);
      });
      inst.instanceMatrix.needsUpdate = true;
      rig.add(inst);
    }
  }

  const wallBuckets = new Map();
  for (const q of wallQueue) {
    const protoKey = q.axis === "h" ? `proto_wall_${q.color}` : `proto_wall_${q.color}_v`;
    if (!wallBuckets.has(protoKey)) wallBuckets.set(protoKey, []);
    wallBuckets.get(protoKey).push(q.group);
  }
  rig.updateMatrixWorld(true);
  const rigInv = new THREE.Matrix4().copy(rig.matrixWorld).invert();
  const m4 = new THREE.Matrix4();
  for (const [protoKey, groups] of wallBuckets) {
    const tpl = library.templates.get(protoKey);
    const geo = tpl ? mergedGeometryFromTemplate(tpl) : null;
    if (!geo) {
      for (const g of groups) {
        const wall = cloneProto(protoKey);
        if (wall) g.add(wall);
      }
      continue;
    }
    const colorKey = protoKey.replace(/^proto_wall_/, "").replace(/_v$/, "");
    const wallHex = GEM_HEX[colorKey] ?? 0xffffff;
    const mat = toToonMaterial(
      { name: `toon_wall_${colorKey}`, color: new THREE.Color(wallHex) },
      wallHex,
    );
    const inst = new THREE.InstancedMesh(geo, mat, groups.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    groups.forEach((g, i) => {
      g.updateMatrixWorld(true);
      m4.multiplyMatrices(rigInv, g.matrixWorld);
      inst.setMatrixAt(i, m4);
    });
    inst.instanceMatrix.needsUpdate = true;
    rig.add(inst);
    groups.forEach((g) => {
      while (g.children.length) g.remove(g.children[0]);
    });
  }

  for (const q of gateQueue) {
    const color = q.color || "red";
    const protoKey = GEM_HEX[color] ? `proto_gate_${color}` : "proto_gate_red";
    const gate = cloneProto(protoKey, GEM_HEX[color]) || cloneProto("proto_gate_red", GEM_HEX.red);
    if (gate) q.group.add(gate);
  }

  floorQueue.length = 0;
  wallQueue.length = 0;
  gateQueue.length = 0;
}
