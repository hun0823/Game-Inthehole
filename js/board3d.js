import * as THREE from "./vendor/three.module.js";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";

const STEP = 1.16;
const GEM_CYCLE = ["red", "blue", "green", "purple", "blue", "red", "purple", "green"];
const GEM_HEX = { red: 0xe23b3b, blue: 0x2f7dff, green: 0x1ea85a, purple: 0xa43adf };
const BALL_R = 0.36;
const BOARD_TOP = 0.5;
const BALL_Y = BOARD_TOP + BALL_R;
const REST_X = 0.045;
const WALL_T = 0.28;
const WALL_H = 0.46;
const WALL_Y = BOARD_TOP + WALL_H * 0.42;
const FRAME_T = 0.26;

const geos = new Map();
function roundGeo(w, h, d, seg = 2, rad = 0.08) {
  const radius = Math.min(rad, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${seg}|${radius.toFixed(3)}`;
  let geo = geos.get(key);
  if (!geo) {
    geo = new RoundedBoxGeometry(w, h, d, seg, Math.max(0.02, radius));
    geos.set(key, geo);
  }
  return geo;
}

function woodCanvas(base, grain, light, rows) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < rows; i++) {
    const y = ((i + 0.5) / rows) * 256;
    g.strokeStyle = grain;
    g.globalAlpha = 0.12 + (i % 5) * 0.06;
    g.lineWidth = 1 + (i % 3);
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(70, y + 7, 170, y - 8, 256, y + 2);
    g.stroke();
  }
  g.globalAlpha = 0.22;
  g.strokeStyle = light;
  g.lineWidth = 5;
  for (let i = 0; i < 5; i++) {
    const y = 24 + i * 48;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(90, y + 12, 160, y - 10, 256, y + 4);
    g.stroke();
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeBoardTexture(n) {
  const cell = 128;
  const size = n * cell;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = "#e4a45e";
  g.fillRect(0, 0, size, size);
  const bands = n * 14;
  for (let i = 0; i < bands; i++) {
    const y = ((i + 0.5) / bands) * size;
    g.strokeStyle = `rgba(112, 62, 24, ${0.05 + (i % 4) * 0.035})`;
    g.lineWidth = 2 + (i % 3);
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(size * 0.28, y + 5, size * 0.66, y - 6, size, y + 2);
    g.stroke();
  }
  g.strokeStyle = "rgba(255, 220, 168, 0.2)";
  g.lineWidth = 7;
  for (let i = 0; i < n * 3; i++) {
    const y = ((i * 53) % size);
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(size * 0.4, y + 10, size * 0.62, y - 8, size, y + 1);
    g.stroke();
  }
  for (let i = 1; i < n; i++) {
    const p = i * cell;
    g.strokeStyle = "rgba(86, 44, 16, 0.5)";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(p, 10);
    g.lineTo(p, size - 10);
    g.moveTo(10, p);
    g.lineTo(size - 10, p);
    g.stroke();
    g.strokeStyle = "rgba(255, 228, 186, 0.4)";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(p + 2.2, 10);
    g.lineTo(p + 2.2, size - 10);
    g.moveTo(10, p + 2.2);
    g.lineTo(size - 10, p + 2.2);
    g.stroke();
  }
  g.strokeStyle = "rgba(92, 48, 18, 0.28)";
  g.lineWidth = 10;
  g.strokeRect(7, 7, size - 14, size - 14);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeOakBallMap() {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  g.fillStyle = "#d09248";
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 52; i++) {
    const y = i * 4.8 + Math.sin(i * 0.7) * 2;
    const dark = i % 5 === 0;
    g.strokeStyle = dark ? "rgba(74, 36, 14, 0.72)" : "rgba(120, 64, 26, 0.38)";
    g.lineWidth = dark ? 3.2 : 1.5;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(50, y + 9, 150, y - 11, 256, y + 3);
    g.stroke();
  }
  g.strokeStyle = "rgba(244, 206, 140, 0.55)";
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(0, 78);
  g.bezierCurveTo(80, 90, 170, 64, 256, 82);
  g.stroke();
  g.fillStyle = "#8d4f22";
  g.beginPath();
  g.ellipse(170, 148, 18, 12, 0.5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#5a3012";
  g.lineWidth = 2;
  g.stroke();
  g.strokeStyle = "rgba(90, 44, 16, 0.45)";
  g.beginPath();
  g.ellipse(170, 148, 28, 18, 0.5, 0, Math.PI * 2);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeStarShape() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? 0.12 : 0.05;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i) shape.lineTo(x, y);
    else shape.moveTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function makeStarMap() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.translate(32, 32);
  g.fillStyle = "#fff";
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? 28 : 11;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBlobMap() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grd.addColorStop(0, "rgba(20,10,30,0.55)");
  grd.addColorStop(1, "rgba(20,10,30,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function wallColor(r, c, axis) {
  const nudge = axis === "v" ? 1 : 0;
  return GEM_CYCLE[(r * 2 + c * 3 + nudge) % GEM_CYCLE.length];
}

function smoother(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  const world = new THREE.Group();
  const rig = new THREE.Group();
  scene.add(world);
  world.add(rig);

  scene.add(new THREE.HemisphereLight(0xfff1c9, 0x6a4a32, 0.72));
  scene.add(new THREE.AmbientLight(0xffffff, 0.32));
  const key = new THREE.DirectionalLight(0xfff6e4, 2.6);
  key.position.set(4.2, 11, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.035;
  scene.add(key);
  scene.add(key.target);
  const fill = new THREE.DirectionalLight(0xb7d6ff, 0.55);
  fill.position.set(-5, 4, 3);
  scene.add(fill);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x8ec8ff);
  const glowMat = (color) => new THREE.MeshBasicMaterial({ color });
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), glowMat(0xffffff));
  p1.position.set(2, 6, 4);
  p1.lookAt(0, 0, 0);
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), glowMat(0xffe2a8));
  p2.position.set(-5, 3, 3);
  p2.lookAt(0, 0, 0);
  env.add(p1, p2);
  scene.environment = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();

  const frameMap = woodCanvas("#a56b38", "#4e2c12", "#e0b072", 22);
  frameMap.repeat.set(2, 1);
  const frameMat = new THREE.MeshStandardMaterial({ map: frameMap, roughness: 0.72, metalness: 0.02 });
  const capMap = woodCanvas("#c48448", "#6a3c18", "#f0c890", 16);
  const frameCapMat = new THREE.MeshStandardMaterial({ map: capMap, roughness: 0.58, metalness: 0.03 });
  const edgeMap = woodCanvas("#c88840", "#6a3a16", "#f2c48a", 18);
  const floorEdgeMat = new THREE.MeshStandardMaterial({ map: edgeMap, roughness: 0.78, metalness: 0.02 });
  const boardMats = new Map();
  function floorTopMaterial(n) {
    let mat = boardMats.get(n);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ map: makeBoardTexture(n), roughness: 0.74, metalness: 0.02 });
      boardMats.set(n, mat);
    }
    return mat;
  }

  const ballMat = new THREE.MeshStandardMaterial({
    map: makeOakBallMap(),
    color: 0xffffff,
    roughness: 0.52,
    metalness: 0.04,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x7af4ff,
    roughness: 0.08,
    metalness: 0.0,
    transparent: true,
    opacity: 0.72,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    depthWrite: false,
  });
  const crackMat = new THREE.MeshBasicMaterial({ color: 0xf7ffff, toneMapped: false });
  const crackGeo = new THREE.BoxGeometry(1, 1, 1);
  const flashGeo = new THREE.BoxGeometry(1, 1, 1);
  const inlayMat = new THREE.MeshStandardMaterial({
    color: 0xfff4c8,
    roughness: 0.42,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const inlayGeo = new THREE.BoxGeometry(1, 1, 1);
  const dotGeo = new THREE.SphereGeometry(1, 14, 10);
  const starGeo = makeStarShape();
  const wallMats = {};
  function wallMaterial(name) {
    const key = GEM_HEX[name] ? name : "red";
    if (!wallMats[key]) {
      wallMats[key] = new THREE.MeshStandardMaterial({
        color: GEM_HEX[key],
        roughness: 0.82,
        metalness: 0.0,
      });
    }
    return wallMats[key];
  }
  function gateMaterial(name) {
    return wallMaterial(name);
  }

  const holeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float arm = 0.5 + 0.5 * sin(a * 6.0 - r * 22.0 + uTime * 5.5);
        float arm2 = 0.5 + 0.5 * sin(-a * 3.0 - r * 12.0 + uTime * 3.2);
        vec3 deep = vec3(0.0, 0.22, 0.28);
        vec3 glow = vec3(0.05, 1.0, 0.82);
        vec3 col = mix(deep, glow, arm * smoothstep(1.05, 0.12, r));
        col += vec3(0.45, 1.0, 0.95) * arm2 * smoothstep(0.9, 0.05, r) * 0.7;
        col += vec3(0.75, 1.0, 0.98) * smoothstep(0.28, 0.0, r);
        float alpha = smoothstep(1.05, 0.55, r);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    new THREE.MeshBasicMaterial({ map: makeBlobMap(), transparent: true, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = -0.42;
  world.add(blob);

  const ballRoot = new THREE.Group();
  const ballSpin = new THREE.Group();
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 24), ballMat);
  ballMesh.castShadow = true;
  ballSpin.add(ballMesh);
  ballRoot.add(ballSpin);
  const contact = new THREE.Mesh(
    new THREE.CircleGeometry(BALL_R * 0.72, 20),
    new THREE.MeshBasicMaterial({ color: 0x3a2416, transparent: true, opacity: 0.28, depthWrite: false })
  );
  contact.rotation.x = -Math.PI / 2;

  const PARTS = 56;
  const partPos = new Float32Array(PARTS * 3);
  const partCol = new Float32Array(PARTS * 3);
  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute("position", new THREE.BufferAttribute(partPos, 3));
  partGeo.setAttribute("color", new THREE.BufferAttribute(partCol, 3));
  const partMat = new THREE.PointsMaterial({
    size: 0.46,
    map: makeStarMap(),
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    alphaTest: 0.15,
    sizeAttenuation: true,
  });
  const sparks = new THREE.Points(partGeo, partMat);
  const pool = Array.from({ length: PARTS }, () => ({
    x: 0, y: -40, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, r: 1, g: 1, b: 1,
  }));
  rig.add(sparks);

  const buttons = [];
  const glasses = [];
  const colored = [];
  const flashes = [];
  const liveShards = [];
  const shardGeo = new THREE.BoxGeometry(0.14, 0.09, 0.045);
  const spring = { x: 0, z: 0, vx: 0, vz: 0, tx: 0, tz: 0 };
  let shake = 0;
  let squash = 1;
  let squashV = 0;
  let token = 0;
  let rollJob = null;
  let sinkJob = null;
  let n = 3;
  let time = 0;
  let viewHalf = 3;
  const upAxis = new THREE.Vector3(0, 1, 0);
  const cellXZ = (r, c) => ({
    x: (c - (n - 1) / 2) * STEP,
    z: (r - (n - 1) / 2) * STEP,
  });

  function burst(x, y, z, count, power, palette) {
    let left = count;
    for (const p of pool) {
      if (p.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      const speed = power * (0.45 + Math.random());
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = Math.cos(a) * speed;
      p.vz = Math.sin(a) * speed;
      p.vy = power * (0.7 + Math.random() * 1.1);
      p.life = 1.15 + Math.random() * 0.7;
      p.max = p.life;
      const col = palette[Math.floor(Math.random() * palette.length)];
      p.r = col[0];
      p.g = col[1];
      p.b = col[2];
      if (--left <= 0) break;
    }
  }

  function frameCamera() {
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 300;
    const aspect = w / Math.max(1, h);
    const fov = 28;
    camera.fov = fov;
    camera.aspect = aspect;
    const vFov = THREE.MathUtils.degToRad(fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const half = viewHalf;
    const elev = THREE.MathUtils.degToRad(72);
    const sinE = Math.sin(elev);
    const cosE = Math.cos(elev);
    const fillRatio = 0.96;
    const distW = half / (fillRatio * Math.tan(hFov / 2)) + half * cosE;
    const distH = (half * sinE) / (fillRatio * Math.tan(vFov / 2)) + half * cosE;
    const dist = Math.max(distW, distH);
    const lookY = 0.18;
    camera.position.set(0, lookY + dist * sinE, dist * cosE);
    camera.lookAt(0, lookY, 0);
    camera.updateProjectionMatrix();
    const s = half * 1.8;
    key.shadow.camera.left = -s;
    key.shadow.camera.right = s;
    key.shadow.camera.top = s;
    key.shadow.camera.bottom = -s;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = dist * 3;
    key.shadow.camera.updateProjectionMatrix();
    blob.scale.set(half * 2.3, half * 1.6, 1);
    blob.position.z = half * 0.08;
  }

  const hintMat = new THREE.MeshBasicMaterial({
    color: 0xfff6bf,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    toneMapped: false,
  });
  const hintHaloMat = new THREE.MeshBasicMaterial({
    color: 0xffe14a,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const hintDotMat = new THREE.MeshBasicMaterial({
    color: 0xfff6c0,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const hintStopMat = new THREE.MeshBasicMaterial({
    color: 0xffe14a,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const hintDotGeo = new THREE.CircleGeometry(0.055, 14);
  const hintStopGeo = new THREE.CircleGeometry(0.1, 18);
  const hintGroup = new THREE.Group();
  hintGroup.visible = false;
  hintGroup.renderOrder = 4;
  const hintShaft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.52), hintMat);
  hintShaft.position.set(0, 0, 0.55);
  const hintHead = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.42, 4), hintMat);
  hintHead.rotation.x = Math.PI / 2;
  hintHead.position.set(0, 0, 0.98);
  const hintHalo = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), hintHaloMat);
  hintHalo.rotation.x = -Math.PI / 2;
  hintHalo.position.set(0, -0.08, 0.7);
  hintGroup.add(hintShaft, hintHead, hintHalo);
  const hintRoute = new THREE.Group();
  hintRoute.visible = false;
  hintRoute.renderOrder = 3;
  rig.add(hintGroup, hintRoute);
  let hintBaseY = 1.28;

  function dropChild(child) {
    child.traverse((node) => {
      if (node.userData.ownMat && node.material) {
        const mats = [].concat(node.material);
        mats.forEach((m) => m && m.dispose());
      }
      if (node.userData.ownGeo && node.geometry) node.geometry.dispose();
    });
    rig.remove(child);
  }

  function clearRig() {
    for (const s of liveShards) s.material.dispose();
    liveShards.length = 0;
    flashes.length = 0;
    for (let i = rig.children.length - 1; i >= 0; i--) {
      const child = rig.children[i];
      if (child === ballRoot || child === sparks || child === hintGroup || child === hintRoute) continue;
      dropChild(child);
    }
    buttons.length = 0;
    glasses.length = 0;
    colored.length = 0;
  }

  function placeBall(r, c, y = BALL_Y) {
    const p = cellXZ(r, c);
    ballRoot.position.set(p.x, y, p.z);
    contact.position.set(p.x, BOARD_TOP + 0.02, p.z);
  }

  function addInlay(group, color, w, d, y) {
    const alongX = w >= d;
    const long = Math.max(w, d);
    const thin = Math.min(w, d) * 0.78;
    const place = (mesh, i, count, span) => {
      const tpos = ((i + 0.5) / count - 0.5) * span;
      mesh.position.set(alongX ? tpos : 0, y, alongX ? 0 : tpos);
      group.add(mesh);
    };
    if (color === "blue") {
      const count = Math.max(2, Math.round(long / 0.38));
      for (let i = 0; i < count; i++) {
        const dot = new THREE.Mesh(dotGeo, inlayMat);
        dot.scale.set(0.07, 0.035, 0.07);
        place(dot, i, count, long * 0.76);
      }
      return;
    }
    if (color === "green") {
      const count = Math.max(1, Math.round(long / 0.62));
      for (let i = 0; i < count; i++) {
        const star = new THREE.Mesh(starGeo, inlayMat);
        star.rotation.x = -Math.PI / 2;
        star.scale.setScalar(long < 0.7 ? 1.15 : 0.95);
        place(star, i, count, long * 0.62);
      }
      return;
    }
    if (color === "purple") {
      const count = Math.max(2, Math.round(long / 0.42));
      for (let i = 0; i < count; i++) {
        const dia = new THREE.Mesh(inlayGeo, inlayMat);
        dia.scale.set(0.13, 0.04, 0.13);
        dia.rotation.y = Math.PI / 4;
        place(dia, i, count, long * 0.74);
      }
      return;
    }
    const count = Math.max(3, Math.round(long / 0.3));
    for (let i = 0; i < count; i++) {
      const bar = new THREE.Mesh(inlayGeo, inlayMat);
      if (alongX) bar.scale.set(0.07, 0.04, thin);
      else bar.scale.set(thin, 0.04, 0.07);
      bar.rotation.y = 0.62;
      place(bar, i, count, long * 0.8);
    }
  }

  function addCracks(group, w, h, d, seed) {
    const cracks = new THREE.Group();
    cracks.visible = false;
    let s = (seed % 9000) + 13;
    const rand = () => {
      s = (s * 16807 + 11) % 2147483647;
      return (s % 1000) / 1000;
    };
    for (let i = 0; i < 6; i++) {
      const ang = rand() * Math.PI;
      const len = (0.28 + rand() * 0.55) * Math.max(w, h, d);
      const line = new THREE.Mesh(crackGeo, crackMat);
      line.scale.set(Math.max(0.08, len), 0.016, 0.016);
      line.rotation.y = ang;
      line.rotation.z = (rand() - 0.5) * 0.8;
      line.position.set((rand() - 0.5) * w * 0.45, h * 0.18 + (rand() - 0.5) * h * 0.45, d * 0.52);
      cracks.add(line);
      const top = new THREE.Mesh(crackGeo, crackMat);
      top.scale.set(Math.max(0.08, len * 0.85), 0.018, 0.016);
      top.rotation.y = ang + 0.4;
      top.position.set((rand() - 0.5) * w * 0.55, h / 2 + 0.02, (rand() - 0.5) * d * 0.35);
      cracks.add(top);
    }
    group.add(cracks);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xf4ffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.scale.set(w * 0.96, h * 0.96, d * 1.2);
    flash.visible = false;
    flash.userData.ownMat = true;
    group.add(flash);
    return { cracks, flash };
  }

  function setStage(level, game) {
    token++;
    if (rollJob) {
      rollJob.resolve();
      rollJob = null;
    }
    if (sinkJob) {
      sinkJob.resolve();
      sinkJob = null;
    }
    n = level.size;
    clearHint();
    clearRig();
    const span = n * STEP;
    const inner = span / 2 - 0.02;
    const outer = inner + FRAME_T;
    viewHalf = outer + 0.12;
    const fh = 0.56;
    const fy = 0.4;
    const capH = 0.1;
    const bars = [
      [outer * 2, fh, FRAME_T, 0, fy, -(inner + FRAME_T / 2)],
      [outer * 2, fh, FRAME_T, 0, fy, inner + FRAME_T / 2],
      [FRAME_T, fh, inner * 2, -(inner + FRAME_T / 2), fy, 0],
      [FRAME_T, fh, inner * 2, inner + FRAME_T / 2, fy, 0],
    ];
    for (const [w, h, d, x, y, z] of bars) {
      const rail = new THREE.Mesh(roundGeo(w, h, d, 3, 0.07), frameMat);
      rail.position.set(x, y, z);
      rail.castShadow = true;
      rail.receiveShadow = true;
      rig.add(rail);
      const capW = w > d ? w - 0.06 : FRAME_T * 0.58;
      const capD = w > d ? FRAME_T * 0.58 : d - 0.06;
      const cap = new THREE.Mesh(roundGeo(capW, capH, capD, 2, 0.04), frameCapMat);
      cap.position.set(x, y + h / 2 + capH / 2 - 0.025, z);
      cap.castShadow = true;
      rig.add(cap);
    }

    const boardH = 0.26;
    const board = new THREE.Mesh(roundGeo(span, boardH, span, 2, 0.05), floorEdgeMat);
    board.position.y = BOARD_TOP - boardH / 2;
    board.receiveShadow = true;
    rig.add(board);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(span - 0.02, span - 0.02), floorTopMaterial(n));
    top.rotation.x = -Math.PI / 2;
    top.position.y = BOARD_TOP + 0.004;
    top.receiveShadow = true;
    top.userData.ownGeo = true;
    rig.add(top);

    const placeEdge = (axis, r, c) => {
      const x = axis === "h"
        ? (c - (n - 1) / 2) * STEP
        : ((c + 0.5) - (n - 1) / 2) * STEP;
      const z = axis === "h"
        ? ((r + 0.5) - (n - 1) / 2) * STEP
        : (r - (n - 1) / 2) * STEP;
      return {
        x,
        z,
        w: axis === "h" ? STEP * 0.92 : WALL_T,
        d: axis === "h" ? WALL_T : STEP * 0.92,
      };
    };

    const addEdge = (axis, r, c, kind, color) => {
      const { x, z, w, d } = placeEdge(axis, r, c);
      const mat = kind === "glass" ? glassMat : kind === "color" ? gateMaterial(color) : wallMaterial(color);
      const group = new THREE.Group();
      group.position.set(x, WALL_Y, z);
      const mesh = new THREE.Mesh(roundGeo(w, WALL_H, d, 2, kind === "wall" ? 0.05 : 0.07), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { kind, axis, r, c, color: color || null };
      group.add(mesh);
      rig.add(group);
      if (kind === "color") {
        addInlay(group, color || "red", w, d, WALL_H / 2 + 0.03);
        colored.push(mesh);
      } else if (kind === "glass") {
        const fx = addCracks(group, w, WALL_H, d, r * 17 + c * 31 + (axis === "v" ? 7 : 0));
        mesh.userData.cracks = fx.cracks;
        mesh.userData.flash = fx.flash;
        glasses.push(mesh);
      }
      return mesh;
    };

    if (level.hWalls) {
      for (let r = 0; r < level.hWalls.length; r++) {
        for (let c = 0; c < level.hWalls[r].length; c++) {
          if (level.hWalls[r][c]) addEdge("h", r, c, "wall", wallColor(r, c, "h"));
        }
      }
    }
    if (level.vWalls) {
      for (let r = 0; r < level.vWalls.length; r++) {
        for (let c = 0; c < level.vWalls[r].length; c++) {
          if (level.vWalls[r][c]) addEdge("v", r, c, "wall", wallColor(r, c, "v"));
        }
      }
    }
    const paintColored = (grid, axis) => {
      if (!grid) return;
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (grid[r][c]) addEdge(axis, r, c, "color", grid[r][c]);
        }
      }
    };
    paintColored(game.hColored, "h");
    paintColored(game.vColored, "v");
    const paintGlass = (grid, axis) => {
      if (!grid) return;
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (grid[r][c]) addEdge(axis, r, c, "glass");
        }
      }
    };
    paintGlass(game.hGlass, "h");
    paintGlass(game.vGlass, "v");

    const { x: hx, z: hz } = cellXZ(level.hole[0], level.hole[1]);
    const well = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.22, 0.22, 28),
      new THREE.MeshStandardMaterial({ color: 0x04302c, roughness: 0.85, emissive: 0x063e38, emissiveIntensity: 0.4 })
    );
    well.position.set(hx, BOARD_TOP - 0.08, hz);
    well.receiveShadow = true;
    rig.add(well);
    const swirl = new THREE.Mesh(new THREE.CircleGeometry(0.4, 48), holeMat);
    swirl.rotation.x = -Math.PI / 2;
    swirl.position.set(hx, BOARD_TOP + 0.012, hz);
    rig.add(swirl);
    const ringMat = new THREE.MeshPhysicalMaterial({
      color: 0x7dfff0,
      emissive: 0x14f0c8,
      emissiveIntensity: 1.6,
      roughness: 0.18,
      clearcoat: 0.8,
      envMapIntensity: 0.6,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.055, 12, 36), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(hx, BOARD_TOP + 0.03, hz);
    ring.name = "hole-ring";
    rig.add(ring);
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 8, 28), ringMat);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.set(hx, BOARD_TOP + 0.04, hz);
    innerRing.name = "hole-ring";
    rig.add(innerRing);

    for (const btn of level.buttons || []) {
      const { x, z } = cellXZ(btn.row, btn.col);
      const color = GEM_HEX[btn.color] ? btn.color : "red";
      const mat = new THREE.MeshStandardMaterial({
        color: GEM_HEX[color],
        emissive: GEM_HEX[color],
        emissiveIntensity: 0,
        roughness: 0.62,
        metalness: 0.02,
      });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.18, 24), mat);
      mesh.position.set(x, BOARD_TOP + 0.12, z);
      mesh.castShadow = true;
      mesh.userData = {
        kind: "button",
        row: btn.row,
        col: btn.col,
        color: btn.color,
        baseY: BOARD_TOP + 0.12,
        ownMat: true,
      };
      addInlay(mesh, color, 0.5, 0.5, 0.12);
      rig.add(mesh);
      buttons.push(mesh);
    }

    if (!ballRoot.parent) rig.add(ballRoot);
    if (!contact.parent) rig.add(contact);
    if (!sparks.parent) rig.add(sparks);
    squash = 1;
    ballRoot.scale.set(1, 1, 1);
    placeBall(game.ball[0], game.ball[1]);
    sync(game, { ready: true });
    frameCamera();
  }

  function edgeAlive(grid, r, c) {
    return !!(grid && grid[r] && grid[r][c]);
  }

  function startOpen(mesh) {
    if (!mesh.parent || mesh.userData.opening || !mesh.parent.visible) return;
    mesh.userData.opening = { t: 0, baseY: mesh.parent.position.y };
  }

  function openColor(color, dipRow, dipCol) {
    for (const b of buttons) {
      if (b.userData.color !== color) continue;
      b.userData.pendingSpent = false;
      b.userData.spent = true;
      b.material.transparent = true;
      b.material.opacity = 0.4;
      b.position.y = BOARD_TOP + 0.05;
      if (b.userData.row === dipRow && b.userData.col === dipCol) b.userData.dip = 1;
    }
    for (const mesh of colored) {
      if (mesh.userData.color === color) startOpen(mesh);
    }
  }

  function armGateOpen(game) {
    for (const mesh of buttons) {
      const spent = game.activatedColors.has(mesh.userData.color);
      if (spent && !mesh.userData.spent) mesh.userData.pendingSpent = true;
    }
  }

  function triggerCell(path, index) {
    const cell = path[index];
    if (!cell) return;
    for (const b of buttons) {
      if (!b.userData.pendingSpent) continue;
      if (b.userData.row === cell[0] && b.userData.col === cell[1]) openColor(b.userData.color, cell[0], cell[1]);
    }
  }

  function glassMesh(edge) {
    const axis = edge.axis || edge.kind;
    return glasses.find((m) => m.userData.axis === axis && m.userData.r === edge.r && m.userData.c === edge.c);
  }

  function pulseFlash(mesh) {
    const flash = mesh && mesh.userData.flash;
    if (!flash) return;
    flash.visible = true;
    flash.material.opacity = 0.9;
    if (!flashes.includes(flash)) flashes.push(flash);
  }

  function showCrack(mesh, flash) {
    if (!mesh) return;
    if (mesh.userData.cracks) mesh.userData.cracks.visible = true;
    mesh.userData.cracked = true;
    if (flash) pulseFlash(mesh);
  }

  function shatterPane(mesh) {
    const parent = mesh && mesh.parent;
    if (!parent || parent.userData.shattered) return;
    parent.userData.shattered = true;
    const base = parent.position;
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xdffbff,
        roughness: 0.18,
        transparent: true,
        opacity: 1,
      });
      const shard = new THREE.Mesh(shardGeo, mat);
      const ang = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 0.9 + Math.random() * 1.5;
      shard.position.set(base.x, base.y, base.z);
      shard.scale.set(0.65 + Math.random() * 0.9, 0.45 + Math.random() * 0.8, 0.4 + Math.random() * 0.6);
      shard.userData.v = {
        x: Math.cos(ang) * speed,
        y: 1.4 + Math.random() * 1.8,
        z: Math.sin(ang) * speed,
      };
      shard.userData.spin = { x: Math.random() * 7, y: Math.random() * 7 };
      shard.userData.life = 0.55 + Math.random() * 0.28;
      shard.userData.max = shard.userData.life;
      rig.add(shard);
      liveShards.push(shard);
    }
    parent.visible = false;
  }

  function playCracks(list) {
    for (const edge of list || []) {
      const mesh = glassMesh(edge);
      if (mesh) showCrack(mesh, true);
    }
  }

  function crosses(a, b, edge) {
    const axis = edge.axis || edge.kind;
    if (!a || !b) return false;
    if (a[1] === b[1] && Math.abs(a[0] - b[0]) === 1) {
      return axis === "h" && edge.r === Math.min(a[0], b[0]) && edge.c === a[1];
    }
    if (a[0] === b[0] && Math.abs(a[1] - b[1]) === 1) {
      return axis === "v" && edge.c === Math.min(a[1], b[1]) && edge.r === a[0];
    }
    return false;
  }

  function sync(game, { ready = true, animateGates = false, skipGlass = false, skipGates = false } = {}) {
    if (!skipGates) {
      const fresh = [];
      for (const mesh of buttons) {
        const spent = game.activatedColors.has(mesh.userData.color);
        if (animateGates && spent && !mesh.userData.spent && !mesh.userData.pendingSpent) fresh.push(mesh);
      }
      for (const mesh of fresh) openColor(mesh.userData.color, mesh.userData.row, mesh.userData.col);
      for (const mesh of colored) {
        if (mesh.userData.opening) continue;
        const grid = mesh.userData.axis === "h" ? game.hColored : game.vColored;
        const show = edgeAlive(grid, mesh.userData.r, mesh.userData.c);
        if (!show && mesh.parent.visible && animateGates) {
          startOpen(mesh);
          continue;
        }
        mesh.parent.visible = show;
        if (show) mesh.parent.scale.y = 1;
      }
      for (const mesh of buttons) {
        if (mesh.userData.pendingSpent) continue;
        const spent = game.activatedColors.has(mesh.userData.color);
        mesh.userData.spent = spent;
        mesh.userData.ready =
          ready && !spent && game.ball[0] === mesh.userData.row && game.ball[1] === mesh.userData.col;
        if (!spent) {
          mesh.material.opacity = 1;
          mesh.material.transparent = false;
          mesh.position.y = mesh.userData.baseY;
        }
      }
    }
    if (!skipGlass) {
      for (const mesh of glasses) {
        const data = mesh.userData;
        const grid = data.axis === "h" ? game.hGlass : game.vGlass;
        const stress = data.axis === "h" ? game.hGlassStressed : game.vGlassStressed;
        const alive = edgeAlive(grid, data.r, data.c);
        if (mesh.parent.userData.shattered) {
          mesh.parent.visible = false;
          continue;
        }
        mesh.parent.visible = alive;
        if (alive && edgeAlive(stress, data.r, data.c)) showCrack(mesh, false);
      }
    }
  }

  function nudge(dir) {
    const map = { up: [-0.26, 0], down: [0.26, 0], left: [0, 0.26], right: [0, -0.26] };
    const t = dir && map[dir] ? map[dir] : [0, 0];
    spring.tx = t[0];
    spring.tz = t[1];
  }

  function bump(amount = 1) {
    shake = Math.min(0.55, shake + 0.28 * amount);
    squash = Math.min(squash, 0.9);
    squashV = -0.4;
  }

  function clearHint() {
    hintGroup.visible = false;
    hintRoute.visible = false;
    while (hintRoute.children.length) hintRoute.remove(hintRoute.children[0]);
    for (const mesh of buttons) mesh.userData.hint = false;
  }

  function addDot(x, z, stop) {
    const dot = new THREE.Mesh(stop ? hintStopGeo : hintDotGeo, stop ? hintStopMat : hintDotMat);
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(x, BOARD_TOP + (stop ? 0.045 : 0.03), z);
    hintRoute.add(dot);
  }

  function drawRoute(cells, stops) {
    if (!cells || cells.length < 2) return;
    const pts = cells.map(([r, c]) => cellXZ(r, c));
    const spacing = 0.23;
    let cursor = spacing * 0.65;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 1e-4) continue;
      let d = cursor;
      while (d <= len) {
        const t = d / len;
        addDot(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, false);
        d += spacing;
      }
      cursor = d - len;
    }
    for (let i = 1; i < (stops || []).length; i++) {
      const p = cellXZ(stops[i][0], stops[i][1]);
      addDot(p.x, p.z, true);
    }
    hintRoute.visible = true;
  }

  function showHint(action, row, col, route) {
    clearHint();
    if (route) drawRoute(route.cells, route.stops);
    if (action === "press") {
      for (const mesh of buttons) {
        if (mesh.userData.row === row && mesh.userData.col === col && !mesh.userData.spent) {
          mesh.userData.hint = true;
        }
      }
      return;
    }
    const p = cellXZ(row, col);
    const rot = { up: Math.PI, down: 0, left: -Math.PI / 2, right: Math.PI / 2 };
    hintGroup.rotation.y = rot[action] || 0;
    hintBaseY = 1.28;
    hintGroup.position.set(p.x, hintBaseY, p.z);
    hintGroup.visible = true;
  }

  function dipButton(row, col) {
    const mesh = buttons.find((b) => b.userData.row === row && b.userData.col === col);
    if (mesh) mesh.userData.dip = 1;
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(buttons, false);
    if (!hits.length) return null;
    const data = hits[0].object.userData;
    if (!data || data.kind !== "button" || data.spent) return null;
    return { row: data.row, col: data.col };
  }

  function roll(path, dir, intoHole, fx = {}) {
    const my = ++token;
    if (rollJob) rollJob.resolve();
    const pts = path.map((cell) => cellXZ(cell[0], cell[1]));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    }
    const total = cum[cum.length - 1] || 0;
    return new Promise((resolve) => {
      const finishStill = () => {
        triggerCell(path, 0);
        playCracks(fx.cracked || []);
        if (intoHole) sink(path[path.length - 1], my).then(resolve);
        else resolve();
      };
      if (path.length < 2 || total < 1e-5) {
        finishStill();
        return;
      }
      const dur = Math.max(0.28, Math.min(0.8, 0.16 + total * 0.092));
      rollJob = {
        path, pts, cum, total, dur, t: 0, prevDist: 0, dir, intoHole,
        resolve, token: my, fx, triggered: [true], segHit: [],
      };
      triggerCell(path, 0);
    });
  }

  function sink(cell, my) {
    return new Promise((resolve) => {
      const p = cellXZ(cell[0], cell[1]);
      sinkJob = { token: my, t: 0, x: p.x, z: p.z, resolve };
      const palette = [[1, 0.92, 0.4], [0.4, 1, 0.9], [1, 1, 1], [1, 0.5, 0.75]];
      burst(p.x, 0.7, p.z, 18, 2.4, palette);
    });
  }

  function celebrate(cell) {
    const p = cell ? cellXZ(cell[0], cell[1]) : { x: 0, z: 0 };
    const palette = [[1, 0.86, 0.25], [1, 1, 1], [1, 0.45, 0.65], [0.45, 1, 0.85], [0.55, 0.75, 1]];
    burst(p.x, 1.1, p.z, 26, 3.4, palette);
    burst(0, 1.3, 0, 16, 2.6, palette);
    shake = Math.max(shake, 0.28);
  }

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 1;
    const h = canvas.clientHeight || canvas.parentElement?.clientHeight || 1;
    if (w < 2 || h < 2) return;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    frameCamera();
  }

  const moveAxis = {
    right: new THREE.Vector3(0, 0, -1),
    left: new THREE.Vector3(0, 0, 1),
    down: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(-1, 0, 0),
  };

  function stepRoll(job, dt) {
    job.t += dt / job.dur;
    const t = Math.min(1, job.t);
    const dist = smoother(t) * job.total;
    for (let k = 0; k < job.cum.length; k++) {
      if (!job.triggered[k] && dist + 1e-4 >= job.cum[k]) {
        job.triggered[k] = true;
        triggerCell(job.path, k);
      }
    }
    const broken = job.fx.broken || [];
    for (let s = 1; s < job.cum.length; s++) {
      if (job.segHit[s]) continue;
      const mid = (job.cum[s - 1] + job.cum[s]) * 0.5;
      if (dist < mid) continue;
      job.segHit[s] = true;
      const edge = broken.find((g) => crosses(job.path[s - 1], job.path[s], g));
      if (edge) {
        const mesh = glassMesh(edge);
        if (mesh) shatterPane(mesh);
      }
    }
    let seg = 1;
    while (seg < job.cum.length - 1 && job.cum[seg] < dist) seg++;
    const span = job.cum[seg] - job.cum[seg - 1] || 1;
    const local = Math.min(1, Math.max(0, (dist - job.cum[seg - 1]) / span));
    const a = job.pts[seg - 1];
    const b = job.pts[seg];
    const x = a.x + (b.x - a.x) * local;
    const z = a.z + (b.z - a.z) * local;
    ballRoot.position.set(x, BALL_Y, z);
    contact.position.set(x, BOARD_TOP + 0.02, z);
    const traveled = Math.max(0, dist - job.prevDist);
    job.prevDist = dist;
    if (traveled > 0) ballSpin.rotateOnWorldAxis(moveAxis[job.dir] || moveAxis.right, traveled / BALL_R);
    if (t >= 1) {
      playCracks(job.fx.cracked || []);
      const done = job;
      rollJob = null;
      squash = 0.9;
      squashV = -0.6;
      if (done.intoHole) sink(done.path[done.path.length - 1], done.token).then(done.resolve);
      else done.resolve();
    }
  }

  let last = performance.now();
  function frame(now) {
    try {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      time += dt;
      holeMat.uniforms.uTime.value = time;

      const omega = 12;
      spring.vx += (omega * omega * (spring.tx - spring.x) - 2 * omega * spring.vx) * dt;
      spring.vz += (omega * omega * (spring.tz - spring.z) - 2 * omega * spring.vz) * dt;
      spring.x += spring.vx * dt;
      spring.z += spring.vz * dt;
      rig.rotation.x = REST_X + spring.x;
      rig.rotation.z = spring.z;

      const so = 14;
      squashV += (so * so * (1 - squash) - 2 * so * squashV) * dt;
      squash += squashV * dt;
      const sy = THREE.MathUtils.clamp(squash, 0.72, 1.12);
      const sx = 1 / Math.sqrt(sy);
      if (!sinkJob) ballRoot.scale.set(sx, sy, sx);

      shake *= Math.exp(-7 * dt);
      const mag = shake * 0.04;
      world.position.x = Math.sin(time * 46) * mag;
      world.position.z = Math.cos(time * 37) * mag;

      const ring = rig.getObjectByName("hole-ring");
      if (ring) ring.material.emissiveIntensity = 0.55 + Math.sin(time * 3.2) * 0.35;

      if (rollJob) stepRoll(rollJob, dt);

      if (sinkJob) {
        sinkJob.t += dt / 0.34;
        const t = Math.min(1, sinkJob.t);
        const e = t * t;
        ballRoot.position.set(sinkJob.x, BALL_Y * (1 - e) + (BOARD_TOP - 0.12) * e, sinkJob.z);
        ballRoot.scale.set(1 - 0.55 * e, 1 - 0.55 * e, 1 - 0.55 * e);
        ballSpin.rotateOnWorldAxis(upAxis, dt * 6);
        contact.material.opacity = 0.28 * (1 - t);
        if (t >= 1) {
          const done = sinkJob;
          sinkJob = null;
          done.resolve();
        }
      } else if (!rollJob) {
        contact.position.x = ballRoot.position.x;
        contact.position.z = ballRoot.position.z;
        contact.material.opacity = 0.28;
      }

      for (const mesh of colored) {
        const opening = mesh.userData.opening;
        if (!opening) continue;
        opening.t += dt / 0.42;
        const e = Math.min(1, opening.t);
        const k = 1 - (1 - e) * (1 - e) * (1 - e);
        mesh.parent.scale.y = Math.max(0.02, 1 - k);
        mesh.parent.position.y = opening.baseY - k * 0.4;
        if (e >= 1) {
          mesh.parent.visible = false;
          mesh.parent.scale.y = 1;
          mesh.userData.opening = null;
        }
      }

      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.material.opacity -= dt * 3.4;
        if (f.material.opacity <= 0) {
          f.material.opacity = 0;
          f.visible = false;
          flashes.splice(i, 1);
        }
      }

      for (let i = liveShards.length - 1; i >= 0; i--) {
        const s = liveShards[i];
        const v = s.userData.v;
        v.y -= 9 * dt;
        s.position.x += v.x * dt;
        s.position.y += v.y * dt;
        s.position.z += v.z * dt;
        s.rotation.x += s.userData.spin.x * dt;
        s.rotation.y += s.userData.spin.y * dt;
        s.userData.life -= dt;
        s.material.opacity = Math.max(0, s.userData.life / s.userData.max);
        if (s.userData.life <= 0) {
          rig.remove(s);
          s.material.dispose();
          liveShards.splice(i, 1);
        }
      }

      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (p.life <= 0) {
          partPos[i * 3 + 1] = -50;
          continue;
        }
        p.life -= dt;
        p.vy -= 7.5 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        partPos[i * 3] = p.x;
        partPos[i * 3 + 1] = p.y;
        partPos[i * 3 + 2] = p.z;
        const fade = Math.max(0, p.life / p.max);
        partCol[i * 3] = p.r * fade;
        partCol[i * 3 + 1] = p.g * fade;
        partCol[i * 3 + 2] = p.b * fade;
      }
      partGeo.attributes.position.needsUpdate = true;
      partGeo.attributes.color.needsUpdate = true;

      if (hintGroup.visible) {
        const bob = Math.sin(time * 5.5);
        hintGroup.position.y = hintBaseY + bob * 0.05;
        const s = 1 + bob * 0.04;
        hintGroup.scale.set(s, s, s);
        hintMat.opacity = 0.78 + bob * 0.2;
      }
      if (hintRoute.visible) {
        const pulse = 0.62 + Math.sin(time * 5.2) * 0.38;
        hintDotMat.opacity = pulse;
        hintStopMat.opacity = 0.75 + pulse * 0.25;
      }

      for (const mesh of buttons) {
        const dip = mesh.userData.dip || 0;
        if (dip > 0) mesh.userData.dip = Math.max(0, dip - dt * 3.2);
        const readyPulse = mesh.userData.ready ? 1 + Math.sin(time * 6) * 0.06 : 1;
        const hintPulse = mesh.userData.hint ? 1.12 + Math.sin(time * 8) * 0.1 : 1;
        const press = 1 - (mesh.userData.dip || 0) * 0.22;
        mesh.scale.set(readyPulse * hintPulse, press, readyPulse * hintPulse);
        if (!mesh.userData.spent) mesh.position.y = mesh.userData.baseY - (mesh.userData.dip || 0) * 0.1;
        if (mesh.userData.hint) mesh.material.emissiveIntensity = 0.35 + Math.sin(time * 8) * 0.2;
        else mesh.material.emissiveIntensity = 0;
      }

      renderer.render(scene, camera);
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    resize, setStage, sync, roll, nudge, bump, dipButton, pick, celebrate, placeBall, showHint, clearHint, armGateOpen,
  };
}
