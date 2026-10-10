/**
 * One offscreen (or shared) renderer that snapshots balls, goals, and planets.
 * The game page borrows the constellation renderer so a phone keeps two contexts.
 */
import * as THREE from "./vendor/three.module.js";
import { ballById } from "./balls.js";
import { makeBallMaterials } from "./board3d.js";
import { addSportMarks } from "./ballDress.js";
import { clearGoal, createGoalKit, mountGoal } from "./goalMesh.js";
import { createPlanet, disposeObject } from "./planetFactory.js";

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
  if (ballSpin) return;
  mats = makeBallMaterials();
  kit = createGoalKit(mats);
  ballSpin = new THREE.Group();
  ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 24), mats.oak);
  ballSpin.add(ballMesh);
  sport = addSportMarks(ballSpin);
  goalGroup = new THREE.Group();
}

function stage() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 40);
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

export function shotBall(id, size = 160) {
  const key = `b|${id}|${size}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  ensure();
  const { scene, camera } = stage();
  ballMesh.material = mats[id] || mats.oak;
  sport.show(id);
  ballSpin.rotation.set(0.08, 0.12, 0);
  scene.add(ballSpin);
  camera.position.set(0.02, 0.18, 1.55);
  camera.lookAt(0, 0, 0);
  return Promise.resolve(remember(key, snap(scene, camera, size)));
}

export function shotGoal(ballId, size = 160) {
  const kind = ballById(ballId).goal || "knot";
  const key = `g|${kind}|${size}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  ensure();
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
  return Promise.resolve(remember(key, snap(scene, camera, size)));
}

export function shotPlanet(id, size = 180) {
  const key = `p|${id}|${size}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  ensure();
  const planet = createPlanet(id);
  planet.rotation.y = 0.55;
  const { scene, camera } = stage();
  scene.add(planet);
  camera.position.set(1.15, 0.62, 2.45);
  camera.lookAt(0, 0.02, 0);
  const url = snap(scene, camera, size);
  disposeObject(planet);
  return Promise.resolve(remember(key, url));
}
