/**
 * Baked equirectangular maps from tools/bake_sphere_maps.py.
 * Albedo is sRGB. Normal and roughness stay linear (roughness in the green channel).
 */
import * as THREE from "./vendor/three.module.js";

export const MAP_BALLS = ["baseball", "tennis", "melon", "oak"];
export const MAP_PLANETS = ["wood", "desert", "ocean", "lava"];

const BALL_LOOK = {
  baseball: { metalness: 0.04, envMapIntensity: 0.95, normalScale: 1.25 },
  tennis: { metalness: 0.0, envMapIntensity: 0.2, normalScale: 0.65 },
  melon: { metalness: 0.02, envMapIntensity: 0.62, normalScale: 0.55 },
  oak: { metalness: 0.03, envMapIntensity: 0.45, normalScale: 0.9 },
};

const PLANET_LOOK = {
  wood: { envMapIntensity: 0.28, normalScale: 0.7 },
  desert: { envMapIntensity: 0.22, normalScale: 1.45 },
  ocean: { envMapIntensity: 0.85, normalScale: 0.55 },
  lava: { envMapIntensity: 0.4, normalScale: 0.9 },
};

let loading = null;
let pack = null;

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

function fileSet(prefix, id, channels) {
  const out = {};
  const jobs = channels.map((channel) => {
    const color = channel === "albedo" || channel === "emissive";
    const space = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return loadTexture(`assets/textures/${prefix}_${id}_${channel}.webp`, space).then((tex) => {
      out[channel] = tex;
    });
  });
  return Promise.all(jobs).then(() => out);
}

export function loadSphereMaps() {
  if (pack) return Promise.resolve(pack);
  if (loading) return loading;
  loading = (async () => {
    const balls = {};
    const planets = {};
    await Promise.all([
      ...MAP_BALLS.map(async (id) => {
        balls[id] = await fileSet("ball", id, ["albedo", "normal", "rough"]);
      }),
      ...MAP_PLANETS.map(async (id) => {
        const channels = ["albedo", "normal", "rough"];
        if (id === "lava") channels.push("emissive");
        planets[id] = await fileSet("planet", id, channels);
      }),
    ]);
    pack = { balls, planets };
    return pack;
  })();
  return loading;
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
