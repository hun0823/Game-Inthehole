/**
 * Shared 3-step toon ramp and per-planet light/mid/shadow colors.
 * Tool meshes use these. Ball maps stay on their own materials.
 */
import * as THREE from "./vendor/three.module.js";
import { THEMES, PLANET_ORDER } from "./themes.js";

let gradient = null;

export function toonGradient() {
  if (gradient) return gradient;
  const data = new Uint8Array([
    118, 118, 118, 255,
    186, 186, 186, 255,
    255, 255, 255, 255,
  ]);
  gradient = new THREE.DataTexture(data, 3, 1);
  gradient.magFilter = THREE.NearestFilter;
  gradient.minFilter = THREE.NearestFilter;
  gradient.wrapS = THREE.ClampToEdgeWrapping;
  gradient.wrapT = THREE.ClampToEdgeWrapping;
  gradient.generateMipmaps = false;
  gradient.colorSpace = THREE.NoColorSpace;
  gradient.needsUpdate = true;
  return gradient;
}

function mixHex(hex, toward, t) {
  return new THREE.Color(hex).lerp(new THREE.Color(toward), t).getHex();
}

export const PLANET_TOON = Object.fromEntries(PLANET_ORDER.map((id) => {
  const theme = THEMES[id];
  return [id, {
    light: mixHex(theme.frame, 0xffffff, 0.55),
    mid: theme.frame,
    shadow: mixHex(theme.frame, 0x141414, 0.48),
    floor: theme.floor,
    cap: theme.cap,
    edge: theme.edge,
  }];
}));

export function createToon(hex, opts = {}) {
  const opacity = opts.opacity ?? 1;
  const mat = new THREE.MeshToonMaterial({
    color: hex,
    map: opts.map || null,
    gradientMap: toonGradient(),
    toneMapped: false,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: !!(opts.transparent || opacity < 1),
    opacity,
    depthWrite: opts.depthWrite != null ? opts.depthWrite : opacity >= 0.95,
  });
  if (opts.side != null) mat.side = opts.side;
  if (opts.polygonOffset) {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = opts.polygonOffsetFactor ?? -1;
    mat.polygonOffsetUnits = opts.polygonOffsetUnits ?? -1;
  }
  return mat;
}

const cache = new Map();

export function toonMaterial(hex, opts = {}) {
  const mapId = opts.map ? opts.map.uuid : "";
  const key = [
    hex,
    opts.opacity ?? 1,
    opts.emissive ?? 0,
    opts.emissiveIntensity ?? 0,
    opts.side ?? "",
    opts.depthWrite ?? "",
    opts.polygonOffset ? 1 : 0,
    opts.polygonOffsetFactor ?? "",
    opts.polygonOffsetUnits ?? "",
    mapId,
  ].join("|");
  let mat = cache.get(key);
  if (!mat) {
    mat = createToon(hex, opts);
    cache.set(key, mat);
  }
  return mat;
}
