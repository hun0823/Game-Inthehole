/**
 * A small studio, baked once per renderer into a PMREM environment.
 * Reflections on the balls come from this, not from a shipped HDR file.
 */
import * as THREE from "./vendor/three.module.js";

const cache = new WeakMap();

function createStudioScene() {
  const scene = new THREE.Scene();
  const geo = new THREE.BoxGeometry();
  geo.deleteAttribute("uv");
  const room = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: 0xb9c3d0,
      roughness: 1,
      metalness: 0,
      side: THREE.BackSide,
    })
  );
  room.scale.set(14, 10, 14);
  scene.add(room);

  const panel = (hex, x, y, z, sx, sy, sz) => {
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: hex }));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    scene.add(mesh);
  };
  panel(0xffffff, 0.2, 3.5, -5.5, 3.4, 1.6, 0.06);
  panel(0xffe2b0, -5.2, 0.6, 0.4, 0.06, 2.4, 2.6);
  panel(0xc9e0ff, 5.0, 1.3, 1.2, 0.06, 1.8, 2.4);
  panel(0xfff4dc, 0.2, -4.2, 0.4, 5.2, 0.06, 3.4);
  return scene;
}

export function applyStudio(renderer, scene, intensity = 0.7) {
  let env = cache.get(renderer);
  if (!env) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = createStudioScene();
    env = pmrem.fromScene(room, 0.04).texture;
    pmrem.dispose();
    const geos = new Set();
    const mats = new Set();
    room.traverse((node) => {
      if (node.geometry) geos.add(node.geometry);
      if (node.material) mats.add(node.material);
    });
    geos.forEach((geo) => geo.dispose());
    mats.forEach((mat) => mat.dispose());
    cache.set(renderer, env);
  }
  scene.environment = env;
  if ("environmentIntensity" in scene) scene.environmentIntensity = intensity;
  return env;
}
