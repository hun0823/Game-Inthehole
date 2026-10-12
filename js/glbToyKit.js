/**
 * Toy planet GLB kit (?glb=1). Prototypes are named proto_* in assets/models/toy_planet.glb.
 */
import * as THREE from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { MeshoptDecoder } from "./vendor/meshopt_decoder.module.js";
import { inkOutlineMaterial } from "./sphereMaps.js";

const GLB_URL = new URL("../assets/models/toy_planet.glb", import.meta.url).href;
const BRICKS = [
  [242, 226, 196],
  [244, 206, 214],
  [196, 228, 210],
  [244, 230, 176],
  [216, 204, 232],
  [196, 220, 236],
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

function ramp() {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([32, 160, 255]);
  gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

function parseColor(mat) {
  const c = mat?.color;
  if (!c) return 0xffffff;
  return c.getHex();
}

function remapMaterials(root) {
  const ink = inkOutlineMaterial();
  root.traverse((node) => {
    if (!node.isMesh) return;
    const name = node.material?.name || "";
    if (name === "ink" || name.startsWith("ink.")) {
      node.material = ink;
      node.raycast = () => {};
      return;
    }
    if (name.startsWith("toon_") || name.startsWith("Palette")) {
      const color = parseColor(node.material);
      node.material = new THREE.MeshToonMaterial({
        color,
        gradientMap: ramp(),
        toneMapped: false,
      });
      node.material.name = name;
    }
    if (node.geometry?.attributes?.color) {
      node.material.vertexColors = true;
    }
    node.castShadow = true;
    node.receiveShadow = true;
  });
}

function indexProtos(scene) {
  const map = new Map();
  scene.traverse((node) => {
    if (node.name && node.name.startsWith("proto_")) map.set(node.name, node);
  });
  return map;
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
    const protos = indexProtos(gltf.scene);
    library = { gltf, protos, clone(name) {
      const src = protos.get(name);
      if (!src) return null;
      const root = src.clone(true);
      remapMaterials(root);
      return root;
    } };
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

export function mountToyFloor(rig, n, step, boardTop, cellXZ) {
  const used = brickIndex(n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const pick = used[r][c] % 2 === 0 ? "proto_floor_a" : "proto_floor_b";
      const tile = cloneProto(pick);
      if (!tile) continue;
      const { x, z } = cellXZ(r, c);
      tile.position.set(x, 0, z);
      rig.add(tile);
    }
  }
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(n * step, 0.26, n * step),
    new THREE.MeshStandardMaterial({ color: 0xe4d5c6, roughness: 0.8 })
  );
  board.position.y = boardTop - 0.13;
  board.receiveShadow = true;
  rig.add(board);
}

export function mountToyFrame(rig, n) {
  const name = n === 7 ? "proto_frame_n7" : null;
  const frame = name ? cloneProto(name) : null;
  if (frame) {
    rig.add(frame);
    return true;
  }
  return false;
}

export function mountToyWall(group, x, z, color, axis) {
  const key = axis === "h" ? `proto_wall_${color}` : `proto_wall_${color}_v`;
  const wall = cloneProto(key);
  if (!wall) return null;
  wall.position.set(x, 0, z);
  group.add(wall);
  return wall;
}

export function mountToyGate(group, x, z) {
  const gate = cloneProto("proto_gate_red");
  if (!gate) return null;
  gate.position.set(x, 0, z);
  group.add(gate);
  return gate;
}

export function mountToyButton(x, z, color, row, col) {
  const key = `proto_button_${GEM_KEY(color)}`;
  const btn = cloneProto(key);
  if (!btn) return null;
  btn.position.set(x, 0, z);
  btn.userData = {
    kind: "button",
    row,
    col,
    color,
    glb: true,
    spent: false,
    baseY: 0,
  };
  return btn;
}

function GEM_KEY(color) {
  return ["red", "blue", "green", "purple"].includes(color) ? color : "red";
}

export function mountToyDeco(rig, span, frameT) {
  const outer = span / 2 + frameT;
  const y = 0.02 + 0.3 * (span / 6 / 6) * 0.9;
  const robot = cloneProto("proto_deco_robot");
  const stack = cloneProto("proto_deco_stack");
  const stackB = cloneProto("proto_deco_stack_b");
  const balloon = cloneProto("proto_deco_balloon");
  if (robot) {
    robot.position.set(0, y + 0.35, -outer - 0.15);
    robot.scale.setScalar(1.2);
    rig.add(robot);
  }
  if (stack) {
    stack.position.set(-outer * 0.95, y, -outer * 0.05);
    stack.scale.setScalar(1.1);
    rig.add(stack);
  }
  if (stackB) {
    stackB.position.set(outer * 0.95, y, -outer * 0.05);
    stackB.scale.setScalar(1.05);
    rig.add(stackB);
  }
  if (balloon) {
    balloon.position.set(outer * 0.55, y + 0.55, -outer * 0.55);
    balloon.scale.setScalar(1.3);
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
