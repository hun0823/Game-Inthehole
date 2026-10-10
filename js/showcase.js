/**
 * One offscreen (or shared) renderer that snapshots balls, goals, and planets.
 * The game page borrows the constellation renderer so a phone keeps two contexts.
 */
import * as THREE from "./vendor/three.module.js";
import { ballById } from "./balls.js";
import { makeBallMaterials } from "./board3d.js";
import { addSportMarks } from "./ballDress.js";
import { addFloorSocket, clearGoal, createGoalKit, floorMaterial, mountGoal } from "./goalMesh.js";
import { bindPlanetMaps, createPlanet, disposeObject } from "./planetFactory.js";
import { applyBallMaps, inkOutlineMaterial, loadSphereMaps } from "./sphereMaps.js";
import { applyStudio } from "./studioLight.js";
import { themeById } from "./themes.js";

let legacyMats = null;
let currentMaps = null;
let prevMaps = null;
let ballInk = null;
let renderer = null;
let restoreCb = null;
let ownsRenderer = false;
let ballSpin = null;
let ballMesh = null;
let sport = null;
let goalGroup = null;
let mats = null;
let kit = null;
const cache = new Map();

export function bindHost(next, restore) {
  renderer = next;
  restoreCb = restore;
  ownsRenderer = false;
}

function ensure() {
  if (!renderer) {
    const canvas = document.createElement("canvas");
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    ownsRenderer = true;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.12;
  if (ballSpin) return;
  mats = makeBallMaterials();
  kit = createGoalKit(mats);
  ballSpin = new THREE.Group();
  ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.36, 48, 32), mats.oak);
  ballInk = new THREE.Mesh(ballMesh.geometry, inkOutlineMaterial());
  ballInk.scale.setScalar(1.045);
  ballInk.raycast = () => {};
  ballMesh.add(ballInk);
  ballSpin.add(ballMesh);
  sport = addSportMarks(ballSpin);
  goalGroup = new THREE.Group();
}

function stage() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 40);
  applyStudio(renderer, scene, 0.4);
  scene.add(new THREE.AmbientLight(0xffffff, 0.78));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(3, 4.2, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc5d6ff, 0.45);
  fill.position.set(-3.5, 1.2, -2);
  scene.add(fill);
  return { scene, camera };
}

function snap(scene, camera, size) {
  const r = renderer;
  r.setRenderTarget(null);
  r.setPixelRatio(1);
  r.setClearColor(0x000000, 0);
  r.setSize(size, size, false);
  camera.aspect = 1;
  camera.updateProjectionMatrix();
  r.render(scene, camera);
  const url = r.domElement.toDataURL("image/png");
  if (restoreCb) restoreCb();
  return url;
}

function remember(key, url) {
  cache.set(key, url);
  return url;
}

async function prepareMaps() {
  currentMaps = await loadSphereMaps();
  try {
    prevMaps = await loadSphereMaps("assets/textures_v1");
  } catch {
    prevMaps = null;
  }
  ensure();
  applyBallMaps(mats, currentMaps);
  bindPlanetMaps(currentMaps);
  if (ballInk) ballInk.visible = true;
  return currentMaps;
}

export async function shotBall(id, size = 160) {
  const key = `b|${id}|${size}`;
  if (cache.has(key)) return cache.get(key);
  await prepareMaps();
  const { scene, camera } = stage();
  ballMesh.material = mats[id] || mats.oak;
  const textured = id === "baseball" || id === "tennis";
  sport.show(textured ? "" : id);
  ballSpin.rotation.set(0.16, 0.42, 0.02);
  scene.add(ballSpin);
  camera.position.set(0.02, 0.2, 1.55);
  camera.lookAt(0, 0, 0);
  return remember(key, snap(scene, camera, size));
}

export async function shotGoal(ballId, size = 160) {
  const kind = ballById(ballId).goal || "knot";
  const key = `g|${kind}|${size}`;
  if (cache.has(key)) return cache.get(key);
  await prepareMaps();
  return remember(key, frameGoal(kind, false, "wood", size));
}

function framePlanet(id, era, size) {
  const opts = era === "main"
    ? { legacy: true }
    : { ephemeral: true, era, maps: era === "trial" ? prevMaps : null };
  const planet = createPlanet(id, opts);
  planet.rotation.y = 0.55;
  const { scene, camera } = stage();
  scene.add(planet);
  camera.position.set(1.15, 0.62, 2.45);
  camera.lookAt(0, 0.02, 0);
  const url = snap(scene, camera, size);
  disposeObject(planet);
  return url;
}

function frameBall(id, era, size) {
  const { scene, camera } = stage();
  if (era === "main") {
    if (!legacyMats) legacyMats = makeBallMaterials();
    ballMesh.material = legacyMats[id] || legacyMats.oak;
    sport.show(id);
    ballInk.visible = false;
  } else {
    const pack = era === "trial" ? prevMaps : currentMaps;
    if (!pack) return "";
    applyBallMaps(mats, pack);
    ballMesh.material = mats[id] || mats.oak;
    sport.show("");
    ballInk.visible = era === "arcade";
  }
  ballSpin.rotation.set(0.16, 0.42, 0.02);
  scene.add(ballSpin);
  camera.position.set(0.02, 0.2, 1.55);
  camera.lookAt(0, 0, 0);
  return snap(scene, camera, size);
}

function floorTile(theme) {
  const geo = new THREE.PlaneGeometry(1.8, 1.8);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) * 0.42 + 0.5, pos.getZ(i) * 0.42 + 0.5);
  }
  const mesh = new THREE.Mesh(geo, floorMaterial(theme));
  mesh.position.y = 0.5;
  mesh.userData.ownGeo = true;
  return mesh;
}

function frameGoal(kind, legacy, themeId, size) {
  const theme = themeById(themeId);
  clearGoal(goalGroup);
  const { scene, camera } = stage();
  const floor = floorTile(theme);
  scene.add(floor);
  if (kind) mountGoal(goalGroup, kind, kit, { legacy, theme });
  else if (legacy) {
    const glow = new THREE.MeshPhysicalMaterial({
      color: 0x7dfff0,
      emissive: 0x14f0c8,
      emissiveIntensity: 1.5,
      roughness: 0.18,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.055, 12, 36), glow);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.53;
    ring.userData.ownGeo = true;
    ring.userData.ownMat = true;
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 8, 28), glow);
    inner.rotation.x = Math.PI / 2;
    inner.position.y = 0.54;
    inner.userData.ownGeo = true;
    goalGroup.add(ring, inner);
  } else {
    addFloorSocket(goalGroup, theme);
    const accentMat = new THREE.MeshStandardMaterial({
      color: theme.edge,
      roughness: 0.55,
      emissive: theme.edge,
      emissiveIntensity: 0.06,
    });
    const accent = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.018, 8, 28), accentMat);
    accent.rotation.x = Math.PI / 2;
    accent.position.y = 0.52;
    accent.userData.ownGeo = true;
    accent.userData.ownMat = true;
    goalGroup.add(accent);
  }
  scene.add(goalGroup);
  camera.position.set(0.42, 1.55, 1.25);
  camera.lookAt(0, 0.5, -0.08);
  const url = snap(scene, camera, size);
  disposeObject(floor);
  return url;
}

export async function shotCompare(kind, id, size = 320) {
  await prepareMaps();
  if (kind === "planet") {
    return {
      main: framePlanet(id, "main", size),
      trial: prevMaps ? framePlanet(id, "trial", size) : "",
      arcade: framePlanet(id, "arcade", size),
    };
  }
  if (kind === "goal") {
    const goalKind = id === "ice" ? "" : (ballById(id).goal || "knot");
    const themeId = id === "ice" ? "ice" : "wood";
    return {
      before: frameGoal(goalKind, true, themeId, size),
      after: frameGoal(goalKind, false, themeId, size),
    };
  }
  const shot = {
    main: frameBall(id, "main", size),
    trial: prevMaps ? frameBall(id, "trial", size) : "",
    arcade: frameBall(id, "arcade", size),
  };
  applyBallMaps(mats, currentMaps);
  ballInk.visible = true;
  return shot;
}

export async function shotPlanet(id, size = 180) {
  const key = `p|${id}|${size}`;
  if (cache.has(key)) return cache.get(key);
  await prepareMaps();
  const planet = createPlanet(id, { ephemeral: true });
  planet.rotation.y = 0.55;
  const { scene, camera } = stage();
  scene.add(planet);
  camera.position.set(1.15, 0.62, 2.45);
  camera.lookAt(0, 0.02, 0);
  const url = snap(scene, camera, size);
  disposeObject(planet);
  return Promise.resolve(remember(key, url));
}
