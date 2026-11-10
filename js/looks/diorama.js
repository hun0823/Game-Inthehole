/**
 * Wood look — pocket-planet diorama.
 * A 3/4 camera and a thick island. The tilt grid is unchanged.
 * Pixel, clay, and neon do not use this camera.
 */
import * as THREE from "../vendor/three.module.js";
import { loadKit, mountStage } from "./kit.js";
import { skyCanvas } from "./sky.js";

const url = new URL("../../assets/looks/diorama.glb", import.meta.url);
let scene = null;
export const ready = loadKit(url).then((gltf) => {
  scene = gltf.scene;
});

const GEMS = { red: 0xffffff, blue: 0xffffff, green: 0xffffff, purple: 0xffffff };
const ELEV = THREE.MathUtils.degToRad(46);
const YAW = THREE.MathUtils.degToRad(22);
const REST_X = 0.045;

function paintSky(canvas) {
  const { ctx, w, h } = skyCanvas(canvas);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#F7E8C8");
  sky.addColorStop(1, "#E8F2F0");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
}

const _ndc = new THREE.Vector3();
const _box = new THREE.Box3();

function fitDiorama(ctx, stage) {
  const camera = ctx.camera;
  const fit = ctx.fit();
  camera.fov = 34;
  camera.aspect = fit.w / Math.max(1, fit.h);
  camera.near = 0.08;
  camera.far = 90;
  if (stage && stage.hero && stage.pose) placeHero(ctx, stage.hero, stage.pose);
  const lip = ctx.span / 2 + 0.55;
  const top = ctx.boardTop;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(REST_X, 0, 0));
  const points = [];
  for (const x of [-lip, lip]) {
    for (const z of [-lip, lip]) {
      points.push(new THREE.Vector3(x, top + 0.46, z).applyQuaternion(q));
      points.push(new THREE.Vector3(x, top - 1.02, z).applyQuaternion(q));
    }
  }
  if (stage && stage.hero) {
    stage.hero.updateWorldMatrix(true, true);
    _box.setFromObject(stage.hero);
    for (const x of [_box.min.x, _box.max.x]) {
      for (const y of [_box.min.y, _box.max.y]) {
        for (const z of [_box.min.z, _box.max.z]) points.push(new THREE.Vector3(x, y, z));
      }
    }
  }
  const target = new THREE.Vector3(0, 0.12, 0);
  const dir = new THREE.Vector3(
    Math.sin(YAW) * Math.cos(ELEV),
    Math.sin(ELEV),
    Math.cos(YAW) * Math.cos(ELEV),
  ).normalize();
  const limit = 0.9;
  const fits = (dist) => {
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    for (const p of points) {
      _ndc.copy(p).project(camera);
      if (_ndc.z < -1 || _ndc.z > 1) return false;
      if (_ndc.x < -limit || _ndc.x > limit || _ndc.y < -limit || _ndc.y > limit) return false;
    }
    return true;
  };
  let lo = 4;
  let hi = 72;
  for (let i = 0; i < 18; i++) {
    const dist = (lo + hi) / 2;
    if (fits(dist)) hi = dist;
    else lo = dist;
  }
  fits(hi);
}

function placeHero(ctx, squirrel, pose) {
  squirrel.position.set(0, 0, 0);
  squirrel.rotation.set(-0.42, YAW, 0);
  squirrel.scale.setScalar(1);
  squirrel.updateWorldMatrix(true, true);
  _box.setFromObject(squirrel);
  const localH = Math.max(0.2, _box.max.y - _box.min.y);
  const scale = (ctx.span * 0.98) / localH;
  squirrel.scale.setScalar(scale);
  squirrel.updateWorldMatrix(true, true);
  _box.setFromObject(squirrel);
  const yPlane = -0.22;
  const gap = ctx.span / 2 + 0.06;
  const midZ = (_box.min.z + _box.max.z) * 0.5;
  squirrel.position.set(-gap - _box.max.x, yPlane - _box.min.y, ctx.span * 0.36 - midZ);
  pose.baseY = squirrel.position.y;
}

export function createLook() {
  let stage = null;
  return {
    mount(ctx) {
      ctx.tune({
        exposure: 1.04,
        motes: { visible: false },
        blob: 0x3a4a28,
        contact: { color: 0x3e2723, opacity: 0.28 },
      });
      stage = mountStage(scene, ctx, { gems: GEMS, toneMapped: true, island: true, dust: true });
    },
    unmount(ctx) {
      if (stage) stage.dispose();
      stage = null;
      ctx.restore();
    },
    frame(ctx) {
      fitDiorama(ctx, stage);
    },
    tick(time, dt) {
      if (stage) stage.tick(time, dt);
    },
    paintSky,
    dressBall(mesh) {
      if (stage) stage.dressBall(mesh);
    },
  };
}
