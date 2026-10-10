/**
 * Baked equirectangular maps from tools/bake_sphere_maps.py.
 * Albedo is sRGB. Normal and roughness stay linear (roughness in the green channel).
 */
import * as THREE from "./vendor/three.module.js";

export const MAP_BALLS = [
  "baseball", "tennis", "melon", "oak",
  "dune", "marble", "soccer", "tire", "slime", "snow",
  "basketball", "beach", "bowling", "meteor", "toy", "mushroom",
  "coco", "alien", "gear", "golf", "yarn", "donut", "disco",
  "lucky", "cat", "pixel", "globe", "skull",
];
// Gummy stays a flat translucent jelly. A speckle map would not read at board size.
export const UNMAPPED_BALLS = ["gummy"];
export const MAP_PLANETS = [
  "wood", "desert", "ocean", "lava",
  "ice", "crystal", "toy", "mushroom", "candy", "jungle", "alien", "machine",
];

const BALL_EXTRA = {
  meteor: ["emissive"],
  alien: ["emissive"],
  skull: ["emissive"],
};

const PLANET_EXTRA = {
  lava: ["emissive"],
  alien: ["emissive"],
  machine: ["emissive"],
};

const BALL_LOOK = {
  baseball: { metalness: 0.02, envMapIntensity: 0.18, normalScale: 0.75 },
  tennis: { metalness: 0.0, envMapIntensity: 0.1, normalScale: 0.35 },
  melon: { metalness: 0.0, envMapIntensity: 0.12, normalScale: 0.28 },
  oak: { metalness: 0.0, envMapIntensity: 0.0, normalScale: 0.12 },
  dune: { metalness: 0.02, envMapIntensity: 0.1, normalScale: 0.55 },
  marble: { metalness: 0.04, envMapIntensity: 0.2, normalScale: 0.3, clearcoat: 0.45 },
  soccer: { metalness: 0.02, envMapIntensity: 0.14, normalScale: 0.4 },
  tire: { metalness: 0.02, envMapIntensity: 0.06, normalScale: 0.65 },
  slime: { metalness: 0.0, envMapIntensity: 0.16, normalScale: 0.3 },
  snow: { metalness: 0.0, envMapIntensity: 0.1, normalScale: 0.85 },
  basketball: { metalness: 0.02, envMapIntensity: 0.12, normalScale: 0.5 },
  beach: { metalness: 0.02, envMapIntensity: 0.14, normalScale: 0.2 },
  bowling: { metalness: 0.22, envMapIntensity: 0.16, normalScale: 0.4 },
  meteor: { metalness: 0.06, envMapIntensity: 0.12, normalScale: 0.65, emissiveIntensity: 0.85 },
  toy: { metalness: 0.02, envMapIntensity: 0.14, normalScale: 0.3 },
  mushroom: { metalness: 0.0, envMapIntensity: 0.1, normalScale: 0.35 },
  coco: { metalness: 0.02, envMapIntensity: 0.08, normalScale: 0.5 },
  alien: { metalness: 0.0, envMapIntensity: 0.16, normalScale: 0.28, emissiveIntensity: 0.4 },
  gear: { metalness: 0.62, envMapIntensity: 0.2, normalScale: 0.5 },
  golf: { metalness: 0.02, envMapIntensity: 0.12, normalScale: 0.65 },
  yarn: { metalness: 0.0, envMapIntensity: 0.06, normalScale: 0.4 },
  donut: { metalness: 0.0, envMapIntensity: 0.14, normalScale: 0.3 },
  disco: { metalness: 0.72, envMapIntensity: 0.22, normalScale: 0.55, clearcoat: 0.15 },
  lucky: { metalness: 0.08, envMapIntensity: 0.14, normalScale: 0.3 },
  cat: { metalness: 0.0, envMapIntensity: 0.06, normalScale: 0.32 },
  pixel: { metalness: 0.0, envMapIntensity: 0.08, normalScale: 0.4 },
  globe: { metalness: 0.04, envMapIntensity: 0.16, normalScale: 0.35 },
  skull: { metalness: 0.02, envMapIntensity: 0.1, normalScale: 0.3, emissiveIntensity: 0.7 },
};

const PLANET_LOOK = {
  wood: { envMapIntensity: 0.12, normalScale: 0.45 },
  desert: { envMapIntensity: 0.1, normalScale: 0.7 },
  ocean: { envMapIntensity: 0.42, normalScale: 0.4 },
  lava: { envMapIntensity: 0.16, normalScale: 0.65, emissiveIntensity: 1.2 },
  ice: { envMapIntensity: 0.22, normalScale: 0.5 },
  crystal: { envMapIntensity: 0.2, normalScale: 0.7 },
  toy: { envMapIntensity: 0.12, normalScale: 0.25 },
  mushroom: { envMapIntensity: 0.1, normalScale: 0.4 },
  candy: { envMapIntensity: 0.16, normalScale: 0.3 },
  jungle: { envMapIntensity: 0.1, normalScale: 0.5 },
  alien: { envMapIntensity: 0.16, normalScale: 0.8, emissiveIntensity: 0.7 },
  machine: { envMapIntensity: 0.24, normalScale: 0.45, emissiveIntensity: 0.55 },
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
        const channels = ["albedo", "normal", "rough", ...(BALL_EXTRA[id] || [])];
        balls[id] = await fileSet(dir, "ball", id, channels);
      }),
      ...MAP_PLANETS.map(async (id) => {
        const channels = ["albedo", "normal", "rough", ...(PLANET_EXTRA[id] || [])];
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
    if (look.clearcoat != null && "clearcoat" in mat) mat.clearcoat = look.clearcoat;
    if (tex.emissive) {
      mat.emissive.setHex(0xffffff);
      mat.emissiveMap = tex.emissive;
      mat.emissiveIntensity = look.emissiveIntensity ?? 0.6;
    }
    mat.needsUpdate = true;
    if (prev && prev.isCanvasTexture) prev.dispose();
  }
}

export function planetLook(id) {
  return PLANET_LOOK[id] || null;
}
