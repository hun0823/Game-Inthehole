/**
 * Procedural planet meshes for the constellation and the asset sheet.
 */
import * as THREE from "./vendor/three.module.js";
import { inkOutlineMaterial, planetLook } from "./sphereMaps.js";

const RADIUS = 0.5;

function canvasTex(draw, size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function place(parent, mesh, dir, lift = 0) {
  const n = dir.clone().normalize();
  mesh.position.copy(n).multiplyScalar(RADIUS + lift);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  parent.add(mesh);
  return mesh;
}

function atmosphere(color, era) {
  const arcade = era === "arcade";
  const trial = era === "trial";
  const premul = arcade || trial;
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: arcade ? 2.2 : trial ? 4.2 : 2.15 },
      uGain: { value: arcade ? 0.95 : trial ? 0.2 : 0.9 },
      uPremul: { value: premul ? 1 : 0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = mv.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying vec3 vNormal;
      varying vec3 vView;
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uGain;
      uniform float uPremul;
      void main() {
        float rim = pow(1.0 - max(dot(normalize(-vView), normalize(vNormal)), 0.0), uPower);
        float a = rim * uGain;
        vec3 rgb = uColor * mix(1.0, a, uPremul);
        gl_FragColor = vec4(rgb, a);
      }
    `,
  });
  const pad = arcade ? 0.045 : trial ? 0.028 : 0.12;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS + pad, 40, 28), mat);
  mesh.renderOrder = 2;
  return mesh;
}

function ring(color, tilt, radius = 0.66) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.03, 8, 48),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.25, side: THREE.DoubleSide })
  );
  mesh.rotation.x = tilt;
  return mesh;
}

function tree(leaf, trunk) {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.08, 5), trunk);
  stem.position.y = 0.04;
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 6), leaf);
  crown.position.y = 0.15;
  group.add(stem, crown);
  return group;
}

function craterFill(g, s, color, n, r0) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = ((i * 97 + 13) % (s - 24)) + 12;
    const y = ((i * 57 + 29) % (s - 24)) + 12;
    const r = r0 + (i % 4) * 3;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
}

function paintPlanet(id) {
  if (id === "wood") {
    return canvasTex((g, s) => {
      g.fillStyle = "#2f7a3c";
      g.fillRect(0, 0, s, s);
      g.fillStyle = "#246432";
      for (let i = 0; i < 18; i++) {
        g.beginPath();
        g.ellipse((i * 47) % s, (i * 31) % s, 28 + (i % 3) * 8, 16, i, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "#6a4424";
      g.beginPath();
      g.ellipse(70, 150, 36, 22, 0.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#8a5a30";
      g.beginPath();
      g.ellipse(180, 90, 24, 14, -0.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#1c4e28";
      for (let i = 0; i < 40; i++) {
        g.fillRect((i * 19) % s, (i * 23) % s, 3, 3);
      }
    });
  }
  if (id === "desert") {
    return canvasTex((g, s) => {
      g.fillStyle = "#e2b15a";
      g.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y++) {
        const wave = Math.sin(y * 0.08) * 10;
        g.strokeStyle = y % 14 < 7 ? "#c9903a" : "#f0d090";
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(s * 0.3, y + wave, s * 0.7, y - wave, s, y);
        g.stroke();
      }
      craterFill(g, s, "rgba(120, 72, 28, 0.35)", 8, 4);
    });
  }
  if (id === "ice") {
    return canvasTex((g, s) => {
      g.fillStyle = "#e7f6ff";
      g.fillRect(0, 0, s, s);
      g.fillStyle = "#b9dcff";
      g.fillRect(0, 0, s, s * 0.22);
      g.fillRect(0, s * 0.78, s, s * 0.22);
      g.strokeStyle = "rgba(70, 130, 190, 0.85)";
      g.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        g.beginPath();
        g.moveTo((i * 40) % s, (i * 18) % s);
        g.lineTo((i * 40 + 50) % s, (i * 18 + 36) % s);
        g.lineTo((i * 40 + 20) % s, (i * 18 + 70) % s);
        g.stroke();
      }
    });
  }
  if (id === "ocean") {
    return canvasTex((g, s) => {
      const bands = ["#0e4e92", "#1a6eb8", "#3aa0d8", "#14629e", "#0c3e78"];
      bands.forEach((color, i) => {
        g.fillStyle = color;
        g.fillRect(0, (i * s) / bands.length, s, s / bands.length + 1);
      });
      g.strokeStyle = "rgba(255,255,255,0.35)";
      g.lineWidth = 2;
      for (let y = 16; y < s; y += 18) {
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(40, y - 6, 90, y + 6, s, y);
        g.stroke();
      }
      g.fillStyle = "#2f8a4a";
      g.beginPath();
      g.ellipse(150, 120, 18, 10, 0.2, 0, Math.PI * 2);
      g.fill();
    });
  }
  if (id === "crystal") {
    return canvasTex((g, s) => {
      g.fillStyle = "#d5e6ff";
      g.fillRect(0, 0, s, s);
      const cols = ["#ffffff", "#b7c8ff", "#8eb0ff", "#f4f7ff"];
      for (let i = 0; i < 16; i++) {
        g.fillStyle = cols[i % cols.length];
        g.beginPath();
        const x = (i * 61) % s;
        const y = (i * 37) % s;
        g.moveTo(x, y);
        g.lineTo(x + 28, y + 8);
        g.lineTo(x + 16, y + 32);
        g.lineTo(x - 10, y + 18);
        g.fill();
      }
    });
  }
  if (id === "toy") {
    return canvasTex((g, s) => {
      const cols = ["#ff4d88", "#ffe14a", "#3ec4ff", "#7adf5a"];
      cols.forEach((color, i) => {
        g.fillStyle = color;
        g.fillRect(0, (i * s) / 4, s, s / 4 + 1);
      });
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(s * 0.5, s * 0.5, 28, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ff4d88";
      g.beginPath();
      g.arc(s * 0.5, s * 0.5, 12, 0, Math.PI * 2);
      g.fill();
    });
  }
  if (id === "mushroom") {
    return canvasTex((g, s) => {
      g.fillStyle = "#c45a6a";
      g.fillRect(0, 0, s, s);
      g.fillStyle = "#f4efe6";
      for (const [x, y, r] of [[40, 50, 16], [110, 40, 12], [80, 100, 18], [170, 90, 14], [200, 160, 20], [50, 180, 11]]) {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
    });
  }
  if (id === "candy") {
    return canvasTex((g, s) => {
      g.fillStyle = "#ff8ad0";
      g.fillRect(0, 0, s, s);
      g.strokeStyle = "#fff";
      g.lineWidth = 10;
      for (let i = 0; i < 8; i++) {
        g.beginPath();
        g.moveTo(-10, i * 36);
        g.bezierCurveTo(s * 0.3, i * 36 + 18, s * 0.6, i * 36 - 16, s + 10, i * 36 + 8);
        g.stroke();
      }
      g.strokeStyle = "#ffd2f0";
      g.lineWidth = 4;
      g.stroke();
    });
  }
  if (id === "lava") {
    return canvasTex((g, s) => {
      g.fillStyle = "#24110e";
      g.fillRect(0, 0, s, s);
      g.strokeStyle = "#ff6a18";
      g.lineWidth = 4;
      g.lineCap = "round";
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        g.moveTo((i * 30) % s, 0);
        g.lineTo(40 + i * 22, s * 0.45);
        g.lineTo((i * 28) % s, s);
        g.stroke();
      }
      g.strokeStyle = "#ffb020";
      g.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        g.beginPath();
        g.moveTo(0, 30 + i * 32);
        g.lineTo(s, 10 + i * 34);
        g.stroke();
      }
    });
  }
  if (id === "jungle") {
    return canvasTex((g, s) => {
      g.fillStyle = "#1d6b32";
      g.fillRect(0, 0, s, s);
      const greens = ["#145228", "#2e8a40", "#0e3d1c", "#3d9a48"];
      for (let i = 0; i < 28; i++) {
        g.fillStyle = greens[i % greens.length];
        g.beginPath();
        g.arc((i * 41) % s, (i * 29) % s, 16 + (i % 5) * 4, 0, Math.PI * 2);
        g.fill();
      }
    });
  }
  if (id === "alien") {
    return canvasTex((g, s) => {
      g.fillStyle = "#6a3ad0";
      g.fillRect(0, 0, s, s);
      g.fillStyle = "#8a62e8";
      g.fillRect(0, s * 0.35, s, s * 0.22);
      craterFill(g, s, "#3a1878", 12, 7);
      g.strokeStyle = "rgba(210, 190, 255, 0.7)";
      g.lineWidth = 2;
      craterFill(g, s, "transparent", 0, 0);
      for (let i = 0; i < 10; i++) {
        g.beginPath();
        g.arc((i * 67) % s, (i * 43) % s, 8 + (i % 3) * 3, 0, Math.PI * 2);
        g.stroke();
      }
    });
  }
  return canvasTex((g, s) => {
    g.fillStyle = "#9aa6b4";
    g.fillRect(0, 0, s, s);
    g.strokeStyle = "#5c6878";
    g.lineWidth = 3;
    for (let i = 0; i <= 6; i++) {
      g.beginPath();
      g.moveTo(0, (i * s) / 6);
      g.lineTo(s, (i * s) / 6);
      g.stroke();
      g.beginPath();
      g.moveTo((i * s) / 6, 0);
      g.lineTo((i * s) / 6, s);
      g.stroke();
    }
    g.fillStyle = "#d5dde6";
    for (let i = 0; i < 12; i++) {
      g.beginPath();
      g.arc(20 + (i * 53) % (s - 30), 20 + (i * 37) % (s - 30), 4, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function surfaceMaterial(id, map) {
  if (id === "lava") {
    return new THREE.MeshStandardMaterial({
      map,
      color: 0xffffff,
      roughness: 0.72,
      emissive: 0xff6a18,
      emissiveMap: map,
      emissiveIntensity: 0.65,
    });
  }
  if (id === "machine") {
    return new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.38, metalness: 0.62 });
  }
  if (id === "crystal") {
    return new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.22, metalness: 0.08 });
  }
  if (id === "ice") {
    return new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.28, metalness: 0.04 });
  }
  return new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.72 });
}

let sharedMaps = null;
const livePlanets = [];

function mappedPack(entry) {
  if (entry.legacy) return null;
  const pack = entry.maps || sharedMaps;
  if (!pack) return null;
  return pack.planets[entry.id] || null;
}

function assignPlanetMaps(entry) {
  const tex = mappedPack(entry);
  if (!tex) return;
  const mat = entry.sphere.material;
  const look = planetLook(entry.id) || { envMapIntensity: 0.3, normalScale: 0.8 };
  const prev = mat.map;
  mat.map = tex.albedo;
  mat.normalMap = tex.normal;
  mat.normalScale.set(look.normalScale, look.normalScale);
  mat.roughnessMap = tex.rough;
  mat.roughness = 1;
  mat.envMapIntensity = look.envMapIntensity;
  if (entry.id === "lava" && tex.emissive) {
    mat.emissive.setHex(0xffffff);
    mat.emissiveMap = tex.emissive;
    const base = 1.2;
    mat.userData.baseEmissive = base;
    const locked = mat.userData.baseColor !== undefined && mat.color.getHex() === 0x6a6a72;
    mat.emissiveIntensity = locked ? base * 0.12 : base;
  }
  mat.needsUpdate = true;
  if (prev && prev.isCanvasTexture) prev.dispose();
}

export function bindPlanetMaps(maps) {
  sharedMaps = maps;
  livePlanets.forEach(assignPlanetMaps);
}

const ATMOS = {
  wood: "#8dffb0",
  desert: "#ffd27a",
  ice: "#d7f4ff",
  ocean: "#7ecbff",
  crystal: "#e4ecff",
  toy: "#ffd0ea",
  mushroom: "#ffc0c8",
  candy: "#ffc4ea",
  lava: "#ff8a3a",
  jungle: "#9dff8a",
  alien: "#d2b6ff",
  machine: "#d5e2f2",
};

export function createPlanet(id, opts = {}) {
  const root = new THREE.Group();
  const spin = new THREE.Group();
  const moons = new THREE.Group();
  root.add(spin, moons);
  root.userData.spin = spin;
  root.userData.moons = moons;

  const era = opts.legacy ? "main" : (opts.era || "arcade");
  const legacy = era === "main";
  const map = paintPlanet(id);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 32), surfaceMaterial(id, map));
  sphere.renderOrder = 1;
  spin.add(sphere);
  const entry = { id, sphere, legacy, maps: opts.maps || null };
  if (era === "arcade" && !opts.ephemeral) livePlanets.push(entry);
  assignPlanetMaps(entry);
  if (era === "arcade" && planetLook(id)) {
    const ink = new THREE.Mesh(sphere.geometry, inkOutlineMaterial());
    ink.scale.setScalar(1.032);
    ink.raycast = () => {};
    spin.add(ink);
  }
  spin.add(atmosphere(ATMOS[id] || "#ffffff", planetLook(id) ? era : "main"));

  const leaf = new THREE.MeshStandardMaterial({ color: 0x1f7a34, roughness: 0.7 });
  const trunk = new THREE.MeshStandardMaterial({ color: 0x6a4424, roughness: 0.8 });
  const sand = new THREE.MeshStandardMaterial({ color: 0xc9843a, roughness: 0.86 });
  const snow = new THREE.MeshStandardMaterial({ color: 0xf7fbff, roughness: 0.4 });

  const sculpt = legacy || !planetLook(id);
  if (sculpt && (id === "wood" || id === "jungle")) {
    place(spin, tree(leaf, trunk), new THREE.Vector3(0.15, 0.25, 1));
    place(spin, tree(leaf, trunk), new THREE.Vector3(-0.45, 0.05, 0.85));
    place(spin, tree(leaf, trunk), new THREE.Vector3(0.5, -0.2, 0.8));
  }
  if (sculpt && id === "desert") {
    const pyramid = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.14, 4), sand);
    pyramid.rotation.y = Math.PI / 4;
    place(spin, pyramid, new THREE.Vector3(0.1, 0.05, 1), 0.02);
    const dune = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), sand);
    dune.scale.set(1.4, 0.45, 0.9);
    place(spin, dune, new THREE.Vector3(-0.4, -0.15, 0.85));
  }
  if (sculpt && id === "ocean") {
    const isle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), leaf);
    isle.scale.y = 0.45;
    place(spin, isle, new THREE.Vector3(0.25, 0.1, 1));
  }
  if (id === "mushroom") {
    const capMat = new THREE.MeshStandardMaterial({ color: 0xe23b3b, roughness: 0.5 });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.6 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), capMat);
    cap.scale.y = 0.55;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.06, 6), stemMat);
    const group = new THREE.Group();
    stem.position.y = 0.03;
    cap.position.y = 0.07;
    group.add(stem, cap);
    place(spin, group, new THREE.Vector3(0.05, 0.2, 1));
  }
  if (sculpt && id === "lava") {
    const glow = new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xff6a10, emissiveIntensity: 0.8, roughness: 0.4 });
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.03), glow);
    place(spin, crack, new THREE.Vector3(0.1, 0.05, 1), 0.01);
  }
  if (id === "crystal" || id === "toy" || id === "candy" || id === "machine") {
    const colors = { crystal: 0xd5e6ff, toy: 0xffe14a, candy: 0xff8ad0, machine: 0xd5dde6 };
    spin.add(ring(colors[id], 1.15));
    if (id === "crystal") spin.add(ring(0xffffff, 1.35, 0.8));
  }
  if (id === "ice") {
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), snow);
    moon.position.set(0.86, 0.18, 0.1);
    moons.add(moon);
  }
  if (id === "alien") {
    const moonMat = new THREE.MeshStandardMaterial({ color: 0xc8b0ff, roughness: 0.55, emissive: 0x6a3ad0, emissiveIntensity: 0.25 });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), moonMat);
    moon.position.set(0.9, -0.12, 0.2);
    moons.add(moon);
  }
  return root;
}

export function setPlanetLocked(root, locked) {
  root.traverse((node) => {
    const list = node.material ? [].concat(node.material) : [];
    list.forEach((mat) => {
      if (!mat.color) return;
      if (!("baseColor" in mat.userData)) {
        mat.userData.baseColor = mat.color.getHex();
        mat.userData.baseEmissive = mat.emissiveIntensity || 0;
      }
      mat.color.setHex(locked ? 0x6a6a72 : mat.userData.baseColor);
      if ("emissiveIntensity" in mat) {
        mat.emissiveIntensity = locked ? mat.userData.baseEmissive * 0.12 : mat.userData.baseEmissive;
      }
    });
  });
}

export function disposeObject(root) {
  const geos = new Set();
  const mats = new Set();
  root.traverse((node) => {
    if (node.geometry) geos.add(node.geometry);
    if (node.material) [].concat(node.material).forEach((mat) => mats.add(mat));
  });
  geos.forEach((geo) => geo.dispose());
  mats.forEach((mat) => {
    if (mat.userData.shared) return;
    if (mat.map && !mat.map.userData.shared && mat.map !== mat.emissiveMap) mat.map.dispose();
    if (mat.emissiveMap && !mat.emissiveMap.userData.shared) mat.emissiveMap.dispose();
    if (mat.normalMap && !mat.normalMap.userData.shared) mat.normalMap.dispose();
    if (mat.roughnessMap && !mat.roughnessMap.userData.shared) mat.roughnessMap.dispose();
    mat.dispose();
  });
}
