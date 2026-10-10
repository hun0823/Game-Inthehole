/**
 * One offscreen (or shared) renderer that snapshots balls, goals, and planets.
 * The game page borrows the constellation renderer so a phone keeps two contexts.
 */
import * as THREE from "./vendor/three.module.js";
import { ballById } from "./balls.js";
import { makeBallMaterials } from "./board3d.js";
import { addSportMarks } from "./ballDress.js";
import { clearGoal, createGoalKit, mountGoal } from "./goalMesh.js";
import { bindPlanetMaps, createPlanet, disposeObject } from "./planetFactory.js";
import { applyBallMaps, loadSphereMaps } from "./sphereMaps.js";
import { applyStudio } from "./studioLight.js";

let legacyMats = null;
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  if (ballSpin) return;
  mats = makeBallMaterials();
  kit = createGoalKit(mats);
  ballSpin = new THREE.Group();
  ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.36, 48, 32), mats.oak);
  ballSpin.add(ballMesh);
  sport = addSportMarks(ballSpin);
  goalGroup = new THREE.Group();
}

function stage() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 40);
  applyStudio(renderer, scene, 0.78);
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
  const maps = await loadSphereMaps();
  ensure();
  applyBallMaps(mats, maps);
  bindPlanetMaps(maps);
  return maps;
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
  clearGoal(goalGroup);
  mountGoal(goalGroup, kind, kit);
  const { scene, camera } = stage();
  scene.add(goalGroup);
  const box = new THREE.Box3().setFromObject(goalGroup);
  const center = box.getCenter(new THREE.Vector3());
  const span = box.getSize(new THREE.Vector3());
  const dist = Math.max(span.x, span.y, span.z, 0.4) * 1.55;
  camera.position.copy(center).add(new THREE.Vector3(dist * 0.45, dist * 0.42, dist));
  camera.lookAt(center);
  return remember(key, snap(scene, camera, size));
}

function framePlanet(id, legacy, size) {
  const planet = createPlanet(id, legacy ? { legacy: true } : { ephemeral: true });
  planet.rotation.y = 0.55;
  const { scene, camera } = stage();
  scene.add(planet);
  camera.position.set(1.15, 0.62, 2.45);
  camera.lookAt(0, 0.02, 0);
  const url = snap(scene, camera, size);
  disposeObject(planet);
  return url;
}

function frameBall(id, upgraded, size) {
  const { scene, camera } = stage();
  if (upgraded) {
    ballMesh.material = mats[id] || mats.oak;
    sport.show("");
  } else {
    if (!legacyMats) legacyMats = makeBallMaterials();
    ballMesh.material = legacyMats[id] || legacyMats.oak;
    sport.show(id);
  }
  ballSpin.rotation.set(0.16, 0.42, 0.02);
  scene.add(ballSpin);
  camera.position.set(0.02, 0.2, 1.55);
  camera.lookAt(0, 0, 0);
  return snap(scene, camera, size);
}

export async function shotCompare(kind, id, size = 320) {
  await prepareMaps();
  if (kind === "planet") {
    return { before: framePlanet(id, true, size), after: framePlanet(id, false, size) };
  }
  return { before: frameBall(id, false, size), after: frameBall(id, true, size) };
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
