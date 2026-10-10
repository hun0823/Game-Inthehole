/**
 * Baked equirectangular maps from tools/bake_sphere_maps.py.
 * Albedo is sRGB. Normal and roughness stay linear (roughness in the green channel).
 */
import * as THREE from "./vendor/three.module.js";

export const MAP_BALLS = ["baseball", "tennis", "melon", "oak"];
export const MAP_PLANETS = ["wood", "desert", "ocean", "lava"];

const BALL_LOOK = {
  baseball: { metalness: 0.02, envMapIntensity: 0.18, normalScale: 0.75 },
  tennis: { metalness: 0.0, envMapIntensity: 0.1, normalScale: 0.35 },
  melon: { metalness: 0.0, envMapIntensity: 0.12, normalScale: 0.28 },
  oak: { metalness: 0.0, envMapIntensity: 0.0, normalScale: 0.22 },
};

const PLANET_LOOK = {
  wood: { envMapIntensity: 0.12, normalScale: 0.45 },
  desert: { envMapIntensity: 0.1, normalScale: 0.7 },
  ocean: { envMapIntensity: 0.42, normalScale: 0.4 },
  lava: { envMapIntensity: 0.16, normalScale: 0.65 },
};

const packs = new Map();

function loadTexture(url, colorSpace) {
  const loader = new THREE.TextureLoader();
  return new Promise((resolve, reject) => {
    loader.load(url, (tex) => {
      tex.colorSpace = colorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.anisotropy = 8;
      tex.userData.shared = true;
      resolve(tex);
    }, undefined, reject);
  });
}

function fileSet(dir, prefix, id, channels) {
  const out = {};
  const jobs = channels.map((channel) => {
    const color = channel === "albedo" || channel === "emissive";
    const space = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return loadTexture(`${dir}/${prefix}_${id}_${channel}.webp`, space).then((tex) => {
      out[channel] = tex;
    });
  });
  return Promise.all(jobs).then(() => out);
}

export function loadSphereMaps(dir = "assets/textures") {
  if (packs.has(dir)) return packs.get(dir);
  const job = (async () => {
    const balls = {};
    const planets = {};
    await Promise.all([
      ...MAP_BALLS.map(async (id) => {
        balls[id] = await fileSet(dir, "ball", id, ["albedo", "normal", "rough"]);
      }),
      ...MAP_PLANETS.map(async (id) => {
        const channels = ["albedo", "normal", "rough"];
        if (id === "lava") channels.push("emissive");
        planets[id] = await fileSet(dir, "planet", id, channels);
      }),
    ]);
    return { balls, planets };
  })();
  packs.set(dir, job);
  return job;
}

let inkMat = null;
export function inkOutlineMaterial() {
  if (!inkMat) {
    inkMat = new THREE.MeshBasicMaterial({
      color: 0x141414,
      side: THREE.BackSide,
      toneMapped: false,
    });
    inkMat.userData.shared = true;
  }
  return inkMat;
}

export function applyBallMaps(materials, maps) {
  if (!maps) return;
  for (const id of MAP_BALLS) {
    const mat = materials[id];
    const tex = maps.balls[id];
    const look = BALL_LOOK[id];
    if (!mat || !tex || !look) continue;
    const prev = mat.map;
    mat.map = tex.albedo;
    mat.normalMap = tex.normal;
    mat.normalScale.set(look.normalScale, look.normalScale);
    mat.roughnessMap = tex.rough;
    mat.roughness = 1;
    mat.metalness = look.metalness;
    mat.envMapIntensity = look.envMapIntensity;
    mat.color.setHex(0xffffff);
    mat.needsUpdate = true;
    if (prev && prev.isCanvasTexture) prev.dispose();
  }
}

export function planetLook(id) {
  return PLANET_LOOK[id] || null;
}
