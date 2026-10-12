/**
 * Toy planet GLB kit (?glb=1). Prototypes are named proto_* in assets/models/toy_planet.glb.
 */
import * as THREE from "./vendor/three.module.js";
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

let loadJob = null;
let library = null;
let gradientMap = null;

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

function ramp() {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([32, 160, 255]);
  gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

function toToonMaterial(srcMat) {
  const name = srcMat?.name || "";
  if (name === "ink" || name.startsWith("ink.")) return inkOutlineMaterial();
  const color = srcMat?.color?.getHex?.() ?? 0xffffff;
  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: ramp(),
    toneMapped: false,
  });
  mat.name = name;
  if (srcMat?.vertexColors) mat.vertexColors = true;
  return mat;
}

function remapMaterials(root) {
  root.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const name = node.material.name || "";
    if (name === "ink" || name.startsWith("ink.")) {
      node.material = inkOutlineMaterial();
      node.raycast = () => {};
    } else {
      node.material = toToonMaterial(node.material);
    }
    node.castShadow = true;
    node.receiveShadow = true;
  });
}

function tintRoot(root, hex) {
  root.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const n = node.material.name || "";
    if (n.startsWith("ink")) return;
    if (n.startsWith("toon_wall") || n.startsWith("toon_gate") || n.includes("_dome_")) {
      node.material = node.material.clone();
      node.material.color.setHex(hex);
    }
  });
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

function buildLibrary(gltf) {
  const templates = new Map();
  for (const root of PROTO_ROOTS) {
    const tpl = collectTemplate(gltf.scene, root);
    if (tpl) templates.set(root, tpl);
  }
  return {
    gltf,
    templates,
    clone(name) {
      const tpl = templates.get(name);
      if (!tpl) return null;
      const root = tpl.clone(true);
      remapMaterials(root);
      return root;
    },
  };
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

export function cloneProto(name) {
  return library?.clone(name) || null;
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
      const tile = cloneProto(pick);
      if (!tile) continue;
      tintRoot(tile, rgbToHex(BRICKS[k]));
      const { x, z } = cellXZ(r, c);
      tile.position.set(x, 0, z);
      rig.add(tile);
    }
  }
}

export function mountToyFrame(rig, n) {
  const frame = cloneProto(`proto_frame_n${n}`);
  if (frame) {
    rig.add(frame);
    return true;
  }
  return false;
}

export function mountToyWall(group, color, axis) {
  const key = axis === "h" ? `proto_wall_${color}` : `proto_wall_${color}_v`;
  const wall = cloneProto(key);
  if (!wall) return null;
  group.add(wall);
  return wall;
}

export function mountToyGate(group, color) {
  const key = GEM_HEX[color] ? `proto_gate_${color}` : "proto_gate_red";
  let gate = cloneProto(key) || cloneProto("proto_gate_red");
  if (!gate) return null;
  if (GEM_HEX[color]) tintRoot(gate, GEM_HEX[color]);
  group.add(gate);
  return gate;
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
