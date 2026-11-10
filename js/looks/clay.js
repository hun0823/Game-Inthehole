/**
 * Wood look C — claymation toy.
 * Soft Standard materials, a baked fingerprint normal, and a short
 * bloom-plus-vignette pass (three.js VignetteShader, original 6-tap glow).
 */
import * as THREE from "../vendor/three.module.js";
import { VignetteShader } from "../vendor/look/VignetteShader.js";
import { skyCanvas, groundTop } from "./sky.js";
import { createChain, glowShader, quadVert } from "./pass.js";
import {
  GEM, canvasTexture, cellCanvas, roundFill, lit, restyleRig, tintButton, dressHole,
  layoutProps, applyLayout, makeSquirrel, makeTree, makeStump, makeAcorn, goalRing,
} from "./props.js";

const CLAY = { red: 0xe08a72, blue: 0x8eb4d4, green: 0x9cbf78, purple: 0xd0a4c8 };

function fingerprint() {
  const s = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = s;
  const g = canvas.getContext("2d");
  const img = g.createImageData(s, s);
  const h = new Float32Array(s * s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = (x / s - 0.5) * 2;
      const v = (y / s - 0.5) * 2;
      h[y * s + x] = Math.sin(u * 16 + Math.sin(v * 6.5 + u * 2.2) * 2.2 + Math.sin(v * 19) * 0.7);
    }
  }
  const sample = (x, y) => h[Math.max(0, Math.min(s - 1, y)) * s + Math.max(0, Math.min(s - 1, x))];
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = sample(x + 1, y) - sample(x - 1, y);
      const dy = sample(x, y + 1) - sample(x, y - 1);
      const i = (y * s + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, 128 + dx * 22));
      img.data[i + 1] = Math.max(0, Math.min(255, 128 + dy * 22));
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const normal = fingerprint();

function clayTex(n) {
  const canvas = cellCanvas(n, 64, (g, x, y, px, r, c) => {
    g.fillStyle = "#c48972";
    g.fillRect(x, y, px, px);
    g.fillStyle = (r + c) % 2 === 0 ? "#f0c6b0" : "#e7b49c";
    const m = 5;
    roundFill(g, x + m, y + m, px - m * 2, px - m * 2, 12);
    g.fillStyle = "rgba(120, 64, 48, 0.16)";
    g.fillRect(x + m, y + px - m - 8, px - m * 2, 8);
    g.fillRect(x + px - m - 8, y + m, 8, px - m * 2);
    g.fillStyle = "rgba(255,255,255,0.18)";
    roundFill(g, x + m + 6, y + m + 5, px * 0.28, px * 0.16, 6);
  });
  return canvasTexture(canvas);
}

function paintSky(canvas) {
  const { ctx, w, h } = skyCanvas(canvas);
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.42, 20, w * 0.5, h * 0.45, h * 0.75);
  bg.addColorStop(0, "#f6ebe3");
  bg.addColorStop(0.55, "#f0d5c8");
  bg.addColorStop(1, "#e2b8a8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const y0 = groundTop(h);
  const floor = ctx.createLinearGradient(0, y0, 0, h);
  floor.addColorStop(0, "#e7c2b0");
  floor.addColorStop(1, "#d7aa98");
  ctx.fillStyle = floor;
  ctx.fillRect(0, y0, w, h - y0);
  ctx.fillStyle = "#e07a62";
  ctx.beginPath();
  ctx.ellipse(48, y0 + 34, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c46a58";
  ctx.beginPath();
  ctx.ellipse(48, y0 + 24, 13, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function createLook() {
  const floorCache = new Map();
  const fur = lit(0xd39274, 0.94);
  const belly = lit(0xf3d2c4, 0.96);
  const ear = lit(0xe7a898, 0.94);
  const eye = lit(0x3a2a28, 0.6);
  const nose = lit(0xc46a58, 0.7);
  const tail = lit(0xc4846c, 0.95);
  const bark = lit(0xc48a6c, 0.96);
  const leafA = lit(0xa9c888, 0.96);
  const leafB = lit(0x8fb56e, 0.97);
  const mats = {
    frameMid: lit(0xe0a888, 0.95),
    frameHi: lit(0xf3d2c2, 0.94),
    frameLow: lit(0xc4846c, 0.96),
    frameInk: lit(0xa86858, 0.98),
    side: lit(0xd7a088, 0.96),
    top: new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.94, metalness: 0, envMapIntensity: 0.06, normalMap: normal,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xf4e6de, transparent: true, opacity: 0.5, roughness: 0.2, metalness: 0, depthWrite: false, envMapIntensity: 0.15,
    }),
  };
  mats.top.normalScale = new THREE.Vector2(0.28, 0.28);
  const ball = new THREE.MeshStandardMaterial({
    color: 0xf0c2a4, roughness: 0.9, metalness: 0, envMapIntensity: 0.1, normalMap: normal,
  });
  ball.normalScale = new THREE.Vector2(0.16, 0.16);
  const holes = {
    mouth: lit(0x5a3a34, 0.96),
    lip: lit(0xf0c6b4, 0.94),
    ring: lit(0xd46a58, 0.62, 0xc45a48, 0.12),
    rim: lit(0xc48a78, 0.9),
    shadow: new THREE.MeshBasicMaterial({ color: 0x3a2a28, transparent: true, opacity: 0.22, depthWrite: false }),
  };
  const wallCache = new Map();
  const wallMat = (name, part) => {
    const key = `${name}:${part}`;
    if (!wallCache.has(key)) {
      const hex = part === "rim" ? 0xb88878 : (CLAY[name] || CLAY.green);
      const mat = lit(hex, 0.96);
      mat.normalMap = normal;
      mat.normalScale = new THREE.Vector2(0.2, 0.2);
      wallCache.set(key, mat);
    }
    return wallCache.get(key);
  };
  let root = null;
  let pass = null;
  let tailGroup = null;
  let reduce = false;

  return {
    id: "clay",
    paintSky,
    mount(ctx) {
      reduce = !!ctx.reduceMotion;
      ctx.tune({
        exposure: 1.06,
        hemi: { sky: 0xfff3ec, ground: 0xd8b0a0, intensity: 0.72 },
        ambient: { color: 0xfff6f2, intensity: 0.38 },
        key: { color: 0xfff7f2, intensity: 2.05, position: [3.2, 10.5, 4.2] },
        fill: { color: 0xf0d4cc, intensity: 0.48 },
        motes: { color: 0xfff0e6, visible: true },
        blob: 0x3a2a28,
        contact: { color: 0x4a342e, opacity: 0.22 },
      });
      if (!floorCache.has(ctx.n)) floorCache.set(ctx.n, clayTex(ctx.n));
      mats.top.map = floorCache.get(ctx.n);
      const top = ctx.rig.children.find((node) => node.isMesh && node.userData.noInk && node.geometry && node.geometry.type === "PlaneGeometry");
      if (top && top.geometry && !top.geometry.getAttribute("tangent")) {
        try { top.geometry.computeTangents(); } catch { /* normal map falls back */ }
      }
      restyleRig(ctx.rig, {
        hideInk: true,
        gloss: ctx.gloss,
        frameMats: ctx.frameMats,
        floorEdge: ctx.floorEdge,
        mats,
        wallMat,
        dressButton: (node) => tintButton(node, 0xe7b8a4, GEM[node.userData.color] || GEM.red),
      });
      dressHole(ctx.stockHole, holes);
      if (!root) {
        root = new THREE.Group();
        root.name = "wood-look";
        const squirrel = makeSquirrel({ fur, belly, ear, eye, nose, tail });
        tailGroup = squirrel.userData.tail;
        const treeL = makeTree(bark, leafA, leafB);
        const treeR = makeTree(bark, leafB, leafA);
        const stump = makeStump(bark, lit(0xf0c8b0, 0.94));
        const acorn = makeAcorn(lit(0xe7a07a, 0.9), lit(0xc46a58, 0.9));
        root.add(squirrel, treeL, treeR, stump, acorn);
        root.userData.parts = { squirrel, treeL, treeR, stump, acorn };
      }
      applyLayout(root.userData.parts, layoutProps(ctx));
      const spot = ctx.cellXZ(ctx.hole[0], ctx.hole[1]);
      const old = root.getObjectByName("look-goal");
      if (old) root.remove(old);
      root.add(goalRing(holes.ring, spot.x, spot.z, ctx.boardTop));
      ctx.rig.add(root);
      const deco = ctx.rig.getObjectByName("board-deco");
      if (deco) deco.visible = false;
      if (!pass) {
        const vignette = new THREE.ShaderMaterial({
          uniforms: THREE.UniformsUtils.clone(VignetteShader.uniforms),
          vertexShader: quadVert,
          fragmentShader: VignetteShader.fragmentShader,
        });
        vignette.uniforms.offset.value = 0.72;
        vignette.uniforms.darkness.value = 1;
        pass = createChain(ctx.renderer, [glowShader(0.22, 0.8), vignette]);
      }
    },
    dressBall(mesh) {
      if (mesh.geometry && !mesh.geometry.getAttribute("tangent")) {
        try { mesh.geometry.computeTangents(); } catch { /* keep the albedo */ }
      }
      mesh.material = ball;
    },
    dressGoal(stock) {
      dressHole(stock, holes);
    },
    tick(time) {
      if (tailGroup && !reduce) tailGroup.rotation.z = Math.sin(time * 1.4) * 0.08;
    },
    draw(_renderer, scene, camera) {
      if (!pass) return false;
      pass.render(scene, camera);
      return true;
    },
    unmount(ctx) {
      ctx.restore();
      if (root && root.parent) root.parent.remove(root);
    },
  };
}
