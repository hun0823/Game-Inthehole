/**
 * Wood look D — night-forest neon arcade.
 * Emissive rims, a modelled squirrel in glow, fireflies, and a restrained
 * bloom plus the three.js VignetteShader.
 */
import * as THREE from "../vendor/three.module.js";
import { VignetteShader } from "../vendor/look/VignetteShader.js";
import { skyCanvas, groundTop } from "./sky.js";
import { createChain, glowShader, quadVert } from "./pass.js";
import {
  GEM, canvasTexture, cellCanvas, restyleRig, tintButton, dressHole,
  layoutProps, applyLayout, makeSquirrel, makeTree, makeStump, makeAcorn, goalRing, softDot,
} from "./props.js";

function neonLit(hex, emissive, intensity, roughness = 0.42) {
  return new THREE.MeshStandardMaterial({
    color: 0x101218,
    emissive,
    emissiveIntensity: intensity,
    roughness,
    metalness: 0.18,
    envMapIntensity: 0.25,
  });
}

function floorTex(n) {
  const canvas = cellCanvas(n, 64, (g, x, y, px) => {
    g.fillStyle = "#07090e";
    g.fillRect(x, y, px, px);
    g.fillStyle = "#16343c";
    g.fillRect(x, y, px, 3);
    g.fillRect(x, y, 3, px);
  });
  return canvasTexture(canvas);
}

function lineTex(n) {
  const canvas = cellCanvas(n, 64, (g, x, y, px) => {
    g.fillStyle = "#000000";
    g.fillRect(x, y, px, px);
    g.fillStyle = "#1ee6c0";
    g.fillRect(x, y, px, 1);
    g.fillRect(x, y, 1, px);
  });
  return canvasTexture(canvas);
}

function paintSky(canvas) {
  const { ctx, w, h } = skyCanvas(canvas);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#05060f");
  sky.addColorStop(0.45, "#120818");
  sky.addColorStop(0.7, "#1a1030");
  sky.addColorStop(1, "#05060c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255, 61, 242, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.58);
  ctx.bezierCurveTo(w * 0.3, h * 0.54, w * 0.7, h * 0.62, w, h * 0.56);
  ctx.stroke();
  ctx.fillStyle = "rgba(180, 255, 230, 0.85)";
  for (let i = 0; i < 18; i++) {
    const x = ((i * 97) % 100) / 100 * w;
    const y = ((i * 53) % 70) / 100 * h * 0.5;
    ctx.fillRect(x, y, i % 4 === 0 ? 2 : 1.2, i % 4 === 0 ? 2 : 1.2);
  }
  const y0 = groundTop(h);
  ctx.fillStyle = "#05060c";
  ctx.fillRect(0, y0, w, h - y0);
  ctx.strokeStyle = "rgba(57, 255, 210, 0.45)";
  ctx.beginPath();
  ctx.moveTo(0, y0 + 2);
  ctx.lineTo(w, y0 + 2);
  ctx.stroke();
}

export function createLook() {
  const floors = new Map();
  const lines = new Map();
  const fur = neonLit(0x14161c, 0x143038, 0.45, 0.55);
  const belly = neonLit(0x101218, 0xff3df2, 0.35, 0.4);
  const ear = fur;
  const eye = neonLit(0x08080c, 0xff3df2, 1.3, 0.3);
  const nose = neonLit(0x08080c, 0xffb03a, 0.8, 0.35);
  const tail = neonLit(0x101218, 0x39ffd2, 0.55, 0.38);
  const bark = neonLit(0x101218, 0x143028, 0.4, 0.6);
  const leafA = neonLit(0x0c1014, 0x39ff88, 0.9, 0.4);
  const leafB = neonLit(0x0c1014, 0x1ee6c0, 0.7, 0.4);
  const mats = {
    frameMid: neonLit(0x10131a, 0x123040, 0.45, 0.5),
    frameHi: neonLit(0x0c1014, 0x1ee6c0, 0.85, 0.35),
    frameLow: neonLit(0x080a10, 0x301040, 0.4, 0.55),
    frameInk: neonLit(0x08080c, 0x39ffd2, 0.25, 0.5),
    side: neonLit(0x101218, 0x102028, 0.3, 0.6),
    top: new THREE.MeshStandardMaterial({
      color: 0x10141a, roughness: 0.55, metalness: 0.12, emissive: 0xffffff, emissiveIntensity: 1.05, envMapIntensity: 0.2,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x123040, emissive: 0x7af4ff, emissiveIntensity: 0.45, transparent: true, opacity: 0.42,
      roughness: 0.08, metalness: 0, depthWrite: false,
    }),
  };
  const ball = neonLit(0x07080c, 0x39ffd2, 0.95, 0.32);
  const holes = {
    mouth: neonLit(0x05060a, 0x1a0820, 0.4, 0.5),
    lip: neonLit(0x10141c, 0x39ffd2, 0.55, 0.35),
    ring: neonLit(0x140814, 0xff3df2, 1.35, 0.28),
    rim: neonLit(0x101218, 0x39ffd2, 0.7, 0.32),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }),
  };
  const wallCache = new Map();
  const wallMat = (name, part) => {
    const key = `${name}:${part}`;
    if (!wallCache.has(key)) {
      const hex = GEM[name] || GEM.green;
      const mat = neonLit(0x101218, hex, part === "cap" ? 1.15 : 0.72, 0.38);
      wallCache.set(key, mat);
    }
    return wallCache.get(key);
  };

  let root = null;
  let tailGroup = null;
  let flies = null;
  let flyPos = null;
  let flySeed = [];
  let pass = null;
  let glow = null;
  let reduce = false;
  const dot = softDot();

  return {
    id: "neon",
    paintSky,
    mount(ctx) {
      reduce = !!ctx.reduceMotion;
      ctx.tune({
        exposure: 1.16,
        hemi: { sky: 0x1a2040, ground: 0x08060c, intensity: 0.32 },
        ambient: { color: 0x202038, intensity: 0.08 },
        key: { color: 0x8aa0c8, intensity: 0.42, position: [4, 9, 5] },
        fill: { color: 0x402050, intensity: 0.12 },
        motes: { visible: false },
        blob: 0x000000,
        contact: { color: 0x06221c, opacity: 0.4 },
      });
      if (!floors.has(ctx.n)) {
        floors.set(ctx.n, floorTex(ctx.n));
        lines.set(ctx.n, lineTex(ctx.n));
      }
      mats.top.map = floors.get(ctx.n);
      mats.top.emissiveMap = lines.get(ctx.n);
      mats.top.needsUpdate = true;
      restyleRig(ctx.rig, {
        hideInk: true,
        gloss: ctx.gloss,
        frameMats: ctx.frameMats,
        floorEdge: ctx.floorEdge,
        mats,
        wallMat,
        dressButton: (node) => tintButton(node, 0x14182a, GEM[node.userData.color] || GEM.green),
      });
      dressHole(ctx.stockHole, holes);
      if (!root) {
        root = new THREE.Group();
        root.name = "wood-look";
        const squirrel = makeSquirrel({ fur, belly, ear, eye, nose, tail });
        tailGroup = squirrel.userData.tail;
        const treeL = makeTree(bark, leafA, leafB);
        const treeR = makeTree(bark, leafB, leafA);
        const stump = makeStump(bark, leafB);
        const acorn = makeAcorn(neonLit(0x101218, 0xffb03a, 0.7, 0.4), leafA);
        root.add(squirrel, treeL, treeR, stump, acorn);
        root.userData.parts = { squirrel, treeL, treeR, stump, acorn };
        const count = 18;
        flyPos = new Float32Array(count * 3);
        flySeed = [];
        for (let i = 0; i < count; i++) {
          flySeed.push({ a: (i / count) * Math.PI * 2, r: 0.4 + (i % 5) * 0.22, y: 0.7 + (i % 4) * 0.18 });
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(flyPos, 3));
        flies = new THREE.Points(geo, new THREE.PointsMaterial({
          color: 0xd8ff8a, size: 0.12, map: dot, transparent: true, depthWrite: false,
          blending: THREE.AdditiveBlending, opacity: 0.9, sizeAttenuation: true,
        }));
        flies.frustumCulled = false;
        root.add(flies);
        glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: dot, color: 0x39ffd2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55,
        }));
        glow.scale.set(1.15, 1.15, 1);
        glow.name = "look-ball-glow";
      }
      applyLayout(root.userData.parts, layoutProps(ctx));
      const spot = ctx.cellXZ(ctx.hole[0], ctx.hole[1]);
      const old = root.getObjectByName("look-goal");
      if (old) root.remove(old);
      root.add(goalRing(holes.ring, spot.x, spot.z, ctx.boardTop));
      ctx.rig.add(root);
      if (glow && glow.parent !== ctx.ballRoot) ctx.ballRoot.add(glow);
      const deco = ctx.rig.getObjectByName("board-deco");
      if (deco) deco.visible = false;
      if (!pass) {
        const vignette = new THREE.ShaderMaterial({
          uniforms: THREE.UniformsUtils.clone(VignetteShader.uniforms),
          vertexShader: quadVert,
          fragmentShader: VignetteShader.fragmentShader,
        });
        vignette.uniforms.offset.value = 0.85;
        vignette.uniforms.darkness.value = 1;
        pass = createChain(ctx.renderer, [glowShader(0.48, 0.55), vignette]);
      }
    },
    dressBall(mesh) {
      mesh.material = ball;
    },
    dressGoal(stock) {
      dressHole(stock, holes);
    },
    tick(time) {
      if (tailGroup && !reduce) tailGroup.rotation.y = Math.sin(time * 2.4) * 0.25;
      if (!flies || !flyPos) return;
      const span = 2.4;
      flySeed.forEach((seed, i) => {
        const spin = reduce ? seed.a : seed.a + time * 0.35;
        flyPos[i * 3] = Math.cos(spin) * seed.r * span * 0.45;
        flyPos[i * 3 + 1] = seed.y + (reduce ? 0 : Math.sin(time * 1.6 + seed.a) * 0.06);
        flyPos[i * 3 + 2] = Math.sin(spin * 0.8) * seed.r * span * 0.35;
      });
      flies.geometry.attributes.position.needsUpdate = true;
    },
    draw(_renderer, scene, camera) {
      if (!pass) return false;
      pass.render(scene, camera);
      return true;
    },
    unmount(ctx) {
      ctx.restore();
      if (glow && glow.parent) glow.parent.remove(glow);
      if (root && root.parent) root.parent.remove(root);
    },
  };
}
