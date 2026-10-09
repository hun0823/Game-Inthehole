import * as THREE from "./vendor/three.module.js";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";

const STEP = 1.16;
const CELL = 1;
const GEM_CYCLE = ["red", "blue", "green", "purple", "blue", "red", "purple", "green"];
const GEM_HEX = { red: 0xff3b4e, blue: 0x2f7dff, green: 0x1ed760, purple: 0xc44dff };
const BALL_R = 0.36;
const BALL_Y = 0.5 + BALL_R;
const REST_X = 0.045;
const WALL_T = 0.3;
const WALL_H = 0.52;
const WALL_Y = 0.66;

const geos = new Map();
function roundGeo(w, h, d, seg = 2, rad = 0.12) {
  const radius = Math.min(rad, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${seg}|${radius.toFixed(3)}`;
  let geo = geos.get(key);
  if (!geo) {
    geo = new RoundedBoxGeometry(w, h, d, seg, Math.max(0.02, radius));
    geos.set(key, geo);
  }
  return geo;
}

function makeWoodMap() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#f2be6e";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 18; i++) {
    const y = 4 + i * 7;
    g.strokeStyle = `rgba(120, 62, 16, ${0.08 + (i % 3) * 0.04})`;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(36, y + 3, 80, y - 4, 128, y + 1);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeBallMap() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#6d341c";
  g.lineWidth = 6;
  g.lineJoin = "round";
  const shapes = [
    [[128, 36], [176, 72], [164, 128], [96, 126], [84, 70]],
    [[36, 96], [78, 78], [92, 132], [48, 164], [18, 128]],
    [[196, 108], [238, 146], [214, 198], [162, 184], [170, 128]],
    [[86, 168], [140, 156], [164, 210], [108, 232], [64, 200]],
  ];
  for (const shape of shapes) {
    g.beginPath();
    shape.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath();
    g.globalAlpha = 0.18;
    g.fillStyle = "#ffe0cc";
    g.fill();
    g.globalAlpha = 1;
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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

function edgeRuns(grid) {
  const runs = [];
  if (!grid || !grid.length || !grid[0]) return runs;
  const rows = grid.length;
  const cols = grid[0].length;
  const horizontal = cols === rows + 1;
  if (horizontal) {
    for (let r = 0; r < rows; r++) {
      let c = 0;
      while (c < cols) {
        const value = grid[r][c];
        if (!value) {
          c += 1;
          continue;
        }
        const color = typeof value === "string" ? value : null;
        const start = c;
        c += 1;
        while (c < cols && grid[r][c] && (color == null || grid[r][c] === color)) c += 1;
        runs.push({ axis: "h", r, c: start, length: c - start, color });
      }
    }
    return runs;
  }
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const value = grid[r][c];
      if (!value) {
        r += 1;
        continue;
      }
      const color = typeof value === "string" ? value : null;
      const start = r;
      r += 1;
      while (r < rows && grid[r][c] && (color == null || grid[r][c] === color)) r += 1;
      runs.push({ axis: "v", r: start, c, length: r - start, color });
    }
  }
  return runs;
}

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  const world = new THREE.Group();
  const rig = new THREE.Group();
  scene.add(world);
  world.add(rig);

  const hemi = new THREE.HemisphereLight(0xfff1c9, 0x6a4a32, 0.7);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xffffff, 0.28);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xfff6e4, 2.8);
  key.position.set(4.2, 11, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.035;
  scene.add(key);
  scene.add(key.target);
  const fill = new THREE.DirectionalLight(0xb7d6ff, 0.75);
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

  const woodMap = makeWoodMap();
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodMap,
    color: 0xffc98a,
    roughness: 0.62,
    metalness: 0.02,
  });
  const plinthMat = new THREE.MeshPhysicalMaterial({
    color: 0x3ddec0,
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.35,
    clearcoatRoughness: 0.35,
    envMapIntensity: 0.45,
  });
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: 0x0eae78,
    roughness: 0.4,
    metalness: 0.04,
    clearcoat: 0.28,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.4,
  });
  const frameTopMat = new THREE.MeshPhysicalMaterial({
    color: 0x1cc99a,
    roughness: 0.32,
    metalness: 0.03,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.45,
  });
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1028, side: THREE.BackSide });
  const ballMat = new THREE.MeshPhysicalMaterial({
    map: makeBallMap(),
    color: 0xe08a52,
    roughness: 0.28,
    metalness: 0.62,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.15,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x7af4ff,
    roughness: 0.08,
    metalness: 0.0,
    transmission: 0,
    transparent: true,
    opacity: 0.72,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    depthWrite: false,
  });
  const glassCrackMat = new THREE.MeshBasicMaterial({ color: 0xf4ffff, transparent: true, opacity: 0.85 });
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
  const gemMats = {};
  const diaMats = {};
  function gemMaterial(name) {
    const key = GEM_HEX[name] ? name : "red";
    if (!gemMats[key]) {
      gemMats[key] = new THREE.MeshPhysicalMaterial({
        color: GEM_HEX[key],
        roughness: 0.16,
        metalness: 0.06,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        emissive: GEM_HEX[key],
        emissiveIntensity: 0.08,
        envMapIntensity: 1.2,
      });
      diaMats[key] = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.05,
        metalness: 0.15,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        emissive: GEM_HEX[key],
        emissiveIntensity: 0.25,
      });
    }
    return gemMats[key];
  }

  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    new THREE.MeshBasicMaterial({ map: makeBlobMap(), transparent: true, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = -0.42;
  world.add(blob);

  const ballRoot = new THREE.Group();
  const ballSpin = new THREE.Group();
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 36, 28), ballMat);
  ballMesh.castShadow = true;
  const ballShell = new THREE.Mesh(new THREE.SphereGeometry(BALL_R * 1.045, 24, 16), outlineMat);
  ballSpin.add(ballShell, ballMesh);
  ballRoot.add(ballSpin);
  const contact = new THREE.Mesh(
    new THREE.CircleGeometry(BALL_R * 0.85, 20),
    new THREE.MeshBasicMaterial({ color: 0x1a1020, transparent: true, opacity: 0.35, depthWrite: false })
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
const cracks = [];
const colored = [];
  const spring = { x: 0, z: 0, vx: 0, vz: 0, tx: 0, tz: 0 };
  let shake = 0;
  let squash = 1;
  let squashV = 0;
  let token = 0;
  let rollJob = null;
  let sinkJob = null;
  let n = 3;
  let time = 0;
  const cellXZ = (r, c) => ({
    x: (c - (n - 1) / 2) * STEP,
    z: (r - (n - 1) / 2) * STEP,
  });

  function addBlock(w, h, d, x, y, z, material, { shadow = true, outline = false, seg = 2, rad = 0.12 } = {}) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    if (outline) {
      const shell = new THREE.Mesh(roundGeo(w, h, d, seg, rad), outlineMat);
      shell.scale.setScalar(1.055);
      group.add(shell);
    }
    const mesh = new THREE.Mesh(roundGeo(w, h, d, seg, rad), material);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    rig.add(group);
    return mesh;
  }

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
    // Outer mint frame. Fitted the same way for every grid size.
    const half = (n - 1) * STEP / 2 + CELL / 2 + 0.55;
    // 72° off the table: cells stay nearly square, frame and gem sides still read.
    const elev = THREE.MathUtils.degToRad(72);
    const sinE = Math.sin(elev);
    const cosE = Math.cos(elev);
    const fill = 0.96;
    const distW = half / (fill * Math.tan(hFov / 2)) + half * cosE;
    const distH = (half * sinE) / (fill * Math.tan(vFov / 2)) + half * cosE;
    const dist = Math.max(distW, distH);
    const lookY = 0.18;
    camera.position.set(0, lookY + dist * sinE, dist * cosE);
    camera.lookAt(0, lookY, 0);
    camera.updateProjectionMatrix();
    const span = n * STEP + 1.55;
    const s = span * 0.85;
    key.shadow.camera.left = -s;
    key.shadow.camera.right = s;
    key.shadow.camera.top = s;
    key.shadow.camera.bottom = -s;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = dist * 3;
    key.shadow.camera.updateProjectionMatrix();
    blob.scale.set(span * 0.78, span * 0.55, 1);
    blob.position.z = span * 0.04;
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
  rig.add(hintGroup);
  let hintBaseY = 1.32;

  function clearRig() {
    for (let i = rig.children.length - 1; i >= 0; i--) {
      const child = rig.children[i];
      if (child === ballRoot || child === sparks || child === hintGroup) continue;
      rig.remove(child);
    }
    buttons.length = 0;
    glasses.length = 0;
    cracks.length = 0;
    colored.length = 0;
  }

  function placeBall(r, c, y = BALL_Y) {
    const p = cellXZ(r, c);
    ballRoot.position.set(p.x, y, p.z);
    contact.position.set(p.x, 0.47, p.z);
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
    const half = (n - 1) * STEP / 2 + CELL / 2;
    const t = 0.55;
    const fh = 0.72;
    const fy = 0.36;
    const outer = half + t;
    const bars = [
      [outer * 2, fh, t, 0, fy, -outer + t / 2],
      [outer * 2, fh, t, 0, fy, outer - t / 2],
      [t, fh, outer * 2 - t * 2, -outer + t / 2, fy, 0],
      [t, fh, outer * 2 - t * 2, outer - t / 2, fy, 0],
    ];
    for (const [w, h, d, x, y, z] of bars) {
      addBlock(w, h, d, x, y, z, frameMat, { seg: 3, rad: 0.16, shadow: true });
      const cap = new THREE.Mesh(roundGeo(w * 0.82, 0.1, d * 0.72, 2, 0.05), frameTopMat);
      cap.position.set(x, y + h / 2 - 0.02, z);
      cap.castShadow = true;
      rig.add(cap);
    }
    const trayW = half * 2 + 0.08;
    const tray = new THREE.Mesh(roundGeo(trayW, 0.16, trayW, 2, 0.08), woodMat);
    tray.position.y = 0.08;
    tray.receiveShadow = true;
    rig.add(tray);

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const { x, z } = cellXZ(r, c);
        const isHole = r === level.hole[0] && c === level.hole[1];
        addBlock(1.02, 0.14, 1.02, x, 0.18, z, plinthMat, { seg: 2, rad: 0.14, shadow: false });
        if (!isHole) {
          addBlock(0.82, 0.2, 0.82, x, 0.36, z, woodMat, { seg: 2, rad: 0.12, shadow: false });
        }
        if (isHole) {
          const well = new THREE.Mesh(
            new THREE.CylinderGeometry(0.34, 0.22, 0.22, 28),
            new THREE.MeshStandardMaterial({ color: 0x04302c, roughness: 0.85, emissive: 0x063e38, emissiveIntensity: 0.4 })
          );
          well.position.set(x, 0.2, z);
          well.receiveShadow = true;
          rig.add(well);
          const swirl = new THREE.Mesh(new THREE.CircleGeometry(0.4, 48), holeMat);
          swirl.rotation.x = -Math.PI / 2;
          swirl.position.set(x, 0.33, z);
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
          ring.position.set(x, 0.36, z);
          ring.name = "hole-ring";
          rig.add(ring);
          const inner = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 8, 28), ringMat);
          inner.rotation.x = Math.PI / 2;
          inner.position.set(x, 0.37, z);
          inner.name = "hole-ring";
          rig.add(inner);
        }
      }
    }

    const placeRun = (run) => {
      const span = run.length * STEP;
      const along = run.axis === "h" ? run.c + (run.length - 1) / 2 : run.r + (run.length - 1) / 2;
      const x = run.axis === "h"
        ? (along - (n - 1) / 2) * STEP
        : ((run.c + 0.5) - (n - 1) / 2) * STEP;
      const z = run.axis === "h"
        ? ((run.r + 0.5) - (n - 1) / 2) * STEP
        : (along - (n - 1) / 2) * STEP;
      const w = run.axis === "h" ? span : WALL_T;
      const d = run.axis === "h" ? WALL_T : span;
      return { x, z, w, d };
    };

    const addEdge = (axis, r, c, kind, color, length = 1) => {
      const { x, z, w, d } = placeRun({ axis, r, c, length });
      const mat = kind === "glass" ? glassMat : gemMaterial(color || "red");
      const mesh = addBlock(w, WALL_H, d, x, WALL_Y, z, mat, {
        outline: kind !== "glass",
        seg: 3,
        rad: 0.1,
        shadow: true,
      });
      mesh.userData = { kind, axis, r, c, color: color || null };
      if (kind === "glass") {
        const crack = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.02, d * 0.72), glassCrackMat);
        crack.position.set(x, WALL_Y + WALL_H * 0.35, z);
        crack.rotation.y = axis === "h" ? 0.4 : 0.2;
        crack.visible = false;
        crack.userData = { kind: "crack", axis, r, c };
        rig.add(crack);
        glasses.push(mesh);
        cracks.push(crack);
      } else {
        if (kind === "color") colored.push(mesh);
        const stud = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), diaMats[color] || diaMats.red);
        stud.position.set(0, WALL_H * 0.55, 0);
        stud.scale.y = 0.7;
        stud.castShadow = true;
        mesh.parent.add(stud);
      }
      return mesh;
    };

    // One gem per edge so lines, L, and T shapes are segments, not a boxed cell.
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

    if (game.hGlass) {
      for (let r = 0; r < game.hGlass.length; r++) {
        for (let c = 0; c < game.hGlass[r].length; c++) {
          if (game.hGlass[r][c]) addEdge("h", r, c, "glass");
        }
      }
    }
    if (game.vGlass) {
      for (let r = 0; r < game.vGlass.length; r++) {
        for (let c = 0; c < game.vGlass[r].length; c++) {
          if (game.vGlass[r][c]) addEdge("v", r, c, "glass");
        }
      }
    }
    for (const run of edgeRuns(game.hColored)) {
      addEdge("h", run.r, run.c, "color", run.color, run.length);
    }
    for (const run of edgeRuns(game.vColored)) {
      addEdge("v", run.r, run.c, "color", run.color, run.length);
    }

    for (const btn of level.buttons || []) {
      const { x, z } = cellXZ(btn.row, btn.col);
      const color = GEM_HEX[btn.color] ? btn.color : "red";
      const mat = new THREE.MeshPhysicalMaterial({
        color: GEM_HEX[color],
        roughness: 0.22,
        metalness: 0.2,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        emissive: GEM_HEX[color],
        emissiveIntensity: 0.12,
      });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.2, 22), mat);
      mesh.position.set(x, 0.56, z);
      mesh.castShadow = true;
      mesh.userData = { kind: "button", row: btn.row, col: btn.col, color: btn.color, baseY: 0.56 };
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.06, 16),
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, clearcoat: 1, emissive: 0xffffff, emissiveIntensity: 0.15 })
      );
      cap.position.y = 0.1;
      mesh.add(cap);
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

  function sync(game, { ready = true } = {}) {
    for (const mesh of colored) {
      const grid = mesh.userData.axis === "h" ? game.hColored : game.vColored;
      mesh.parent.visible = edgeAlive(grid, mesh.userData.r, mesh.userData.c);
    }
    for (const mesh of glasses) {
      const data = mesh.userData;
      const grid = data.axis === "h" ? game.hGlass : game.vGlass;
      mesh.parent.visible = edgeAlive(grid, data.r, data.c);
    }
    for (const mesh of cracks) {
      const data = mesh.userData;
      const grid = data.axis === "h" ? game.hGlass : game.vGlass;
      const stress = data.axis === "h" ? game.hGlassStressed : game.vGlassStressed;
      mesh.visible = edgeAlive(grid, data.r, data.c) && edgeAlive(stress, data.r, data.c);
    }
    for (const mesh of buttons) {
      const spent = game.activatedColors.has(mesh.userData.color);
      mesh.userData.spent = spent;
      mesh.userData.ready =
        ready && !spent && game.ball[0] === mesh.userData.row && game.ball[1] === mesh.userData.col;
      mesh.position.y = spent ? 0.4 : mesh.userData.baseY;
      mesh.material.opacity = spent ? 0.35 : 1;
      mesh.material.transparent = spent;
    }
  }

  function nudge(dir) {
    const map = { up: [-0.5, 0], down: [0.5, 0], left: [0, 0.5], right: [0, -0.5] };
    const t = dir && map[dir] ? map[dir] : [0, 0];
    spring.tx = t[0];
    spring.tz = t[1];
    spring.vx += (spring.tx - spring.x) * 8;
    spring.vz += (spring.tz - spring.z) * 8;
  }

  function bump(amount = 1) {
    shake = Math.min(1.2, shake + 0.55 * amount);
    squash = 0.72;
    squashV = 3.5;
  }

  function clearHint() {
    hintGroup.visible = false;
    for (const mesh of buttons) mesh.userData.hint = false;
  }

  function showHint(action, row, col) {
    clearHint();
    if (action === "press") {
      for (const mesh of buttons) {
        if (mesh.userData.row === row && mesh.userData.col === col && !mesh.userData.spent) {
          mesh.userData.hint = true;
        }
      }
      return;
    }
    const p = cellXZ(row, col);
    const rot = { up: Math.PI, down: 0, left: Math.PI / 2, right: -Math.PI / 2 };
    hintGroup.rotation.y = rot[action] || 0;
    hintBaseY = 1.32;
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

  function roll(path, dir, intoHole) {
    const my = ++token;
    if (rollJob) rollJob.resolve();
    return new Promise((resolve) => {
      rollJob = { path, dir, intoHole, i: 1, t: 0, prev: 0, resolve, token: my };
      if (path.length < 2) {
        rollJob = null;
        if (intoHole) sink(path[path.length - 1], my).then(resolve);
        else resolve();
      }
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
    shake = Math.max(shake, 0.45);
  }

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 1;
    const h = canvas.clientHeight || canvas.parentElement?.clientHeight || 1;
    if (w < 2 || h < 2) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    frameCamera();
  }

  const moveAxis = {
    right: new THREE.Vector3(0, 0, -1),
    left: new THREE.Vector3(0, 0, 1),
    down: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(-1, 0, 0),
  };

  let last = performance.now();
  function frame(now) {
    try {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    time += dt;
    holeMat.uniforms.uTime.value = time;

    const k = 78;
    const damp = 10.5;
    spring.vx += ((spring.tx - spring.x) * k - spring.vx * damp) * dt;
    spring.vz += ((spring.tz - spring.z) * k - spring.vz * damp) * dt;
    spring.x += spring.vx * dt;
    spring.z += spring.vz * dt;
    rig.rotation.x = REST_X + spring.x;
    rig.rotation.z = spring.z;

    squashV += ((1 - squash) * 60 - squashV * 9) * dt;
    squash += squashV * dt;
    const sy = THREE.MathUtils.clamp(squash, 0.55, 1.25);
    const sx = 1 / Math.sqrt(sy);
    ballRoot.scale.set(sx, sy, sx);

    shake *= Math.pow(0.04, dt);
    world.position.x = (Math.random() - 0.5) * shake * 0.18;
    world.position.z = (Math.random() - 0.5) * shake * 0.18;

    const ring = rig.getObjectByName("hole-ring");
    if (ring) ring.material.emissiveIntensity = 0.55 + Math.sin(time * 3.2) * 0.35;

    if (rollJob) {
      const job = rollJob;
      const from = cellXZ(job.path[job.i - 1][0], job.path[job.i - 1][1]);
      const to = cellXZ(job.path[job.i][0], job.path[job.i][1]);
      const dur = 0.13;
      job.t += dt / dur;
      const t = Math.min(1, job.t);
      const e = t * t * (3 - 2 * t);
      const x = from.x + (to.x - from.x) * e;
      const z = from.z + (to.z - from.z) * e;
      const hop = Math.sin(Math.min(1, t) * Math.PI) * 0.07;
      ballRoot.position.set(x, BALL_Y + hop, z);
      contact.position.set(x, 0.48, z);
      const dist = Math.hypot(to.x - from.x, to.z - from.z);
      const delta = e - job.prev;
      job.prev = e;
      const axis = moveAxis[job.dir] || moveAxis.right;
      ballSpin.rotateOnWorldAxis(axis, (dist / BALL_R) * delta);
      if (t >= 1) {
        job.i += 1;
        job.t = 0;
        job.prev = 0;
        if (job.i >= job.path.length) {
          const done = job;
          rollJob = null;
          squash = 0.78;
          squashV = 2.4;
          if (done.intoHole) {
            sink(done.path[done.path.length - 1], done.token).then(done.resolve);
          } else {
            spring.vx += done.dir === "down" ? 1.45 : done.dir === "up" ? -1.45 : 0;
            spring.vz += done.dir === "left" ? 1.45 : done.dir === "right" ? -1.45 : 0;
            done.resolve();
          }
        }
      }
    }

    if (sinkJob) {
      sinkJob.t += dt / 0.32;
      const t = Math.min(1, sinkJob.t);
      const e = t * t;
      ballRoot.position.set(sinkJob.x, BALL_Y * (1 - e) + 0.18 * e, sinkJob.z);
      ballRoot.scale.set(1 - 0.6 * e, 1 - 0.6 * e, 1 - 0.6 * e);
      ballSpin.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), dt * 8);
      contact.material.opacity = 0.35 * (1 - t);
      if (t >= 1) {
        const done = sinkJob;
        sinkJob = null;
        done.resolve();
      }
    } else if (!rollJob) {
      contact.position.x = ballRoot.position.x;
      contact.position.z = ballRoot.position.z;
      contact.material.opacity = 0.32;
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
      hintGroup.position.y = hintBaseY + bob * 0.06;
      const s = 1 + bob * 0.05;
      hintGroup.scale.set(s, s, s);
      hintMat.opacity = 0.78 + bob * 0.2;
    }

    for (const mesh of buttons) {
      const dip = mesh.userData.dip || 0;
      if (dip > 0) mesh.userData.dip = Math.max(0, dip - dt * 3);
      const readyPulse = mesh.userData.ready ? 1 + Math.sin(time * 6) * 0.08 : 1;
      const hintPulse = mesh.userData.hint ? 1.12 + Math.sin(time * 8) * 0.14 : 1;
      const press = 1 - (mesh.userData.dip || 0) * 0.25;
      mesh.scale.set(readyPulse * hintPulse, press, readyPulse * hintPulse);
      if (!mesh.userData.spent) mesh.position.y = mesh.userData.baseY - (mesh.userData.dip || 0) * 0.12;
      if (mesh.userData.hint) mesh.material.emissiveIntensity = 0.55 + Math.sin(time * 8) * 0.4;
      else if (!mesh.userData.spent) mesh.material.emissiveIntensity = 0.12;
    }

    renderer.render(scene, camera);
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return { resize, setStage, sync, roll, nudge, bump, dipButton, pick, celebrate, placeBall, showHint, clearHint };
}
