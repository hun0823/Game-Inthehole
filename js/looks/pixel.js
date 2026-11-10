/**
 * Wood look B — top-down pixel arcade.
 * Nearest-filter tiles, billboard sprites, and a light CRT pass
 * (three.js FilmShader grain plus an original 2-device-pixel grid).
 */
import * as THREE from "../vendor/three.module.js";
import { FilmShader } from "../vendor/look/FilmShader.js";
import { skyCanvas, groundTop } from "./sky.js";
import { createChain, quadVert } from "./pass.js";
import {
  GEM, canvasTexture, cellCanvas, flat, restyleRig, tintButton, dressHole,
  frameRim, goalRing,
} from "./props.js";

const PIX = { red: 0xd24a3a, blue: 0x3a6adf, green: 0x3a9a44, purple: 0x8a46c4 };

function blit(g, rows, pal, scale) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (!pal[ch]) continue;
      g.fillStyle = pal[ch];
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  });
}

function sprite(rows, pal, scale = 2) {
  const h = rows.length * scale;
  const w = rows[0].length * scale;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  blit(g, rows, pal, scale);
  const mat = new THREE.SpriteMaterial({
    map: canvasTexture(canvas, true),
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const mesh = new THREE.Sprite(mat);
  mesh.center.set(0.5, 0.06);
  return mesh;
}

const SQUIRREL = [
  "......tttt......",
  "....tttttttt....",
  "...tttt..ttt....",
  "..ttt....tttt...",
  "..ff....ffff....",
  ".ffff..ffnff....",
  ".fef...fffff....",
  ".fpf..ffbbbff...",
  "..ffffbbbbbf....",
  "...fffbbbb......",
  "....fffff.......",
  "....ff.ff.......",
  "...ff...ff......",
  "..ff.....ff.....",
];

const TREE = [
  "......gggg......",
  "....gggggggg....",
  "...gggggggggg...",
  "..gggggggggggg..",
  "..gggddgggggg...",
  "...ggggggggg....",
  "....ggggggg.....",
  "......wwww......",
  "......wwww......",
  "......wwww......",
  ".....wwwwww.....",
];

const ACORN = [
  "..gggg..",
  ".gggggg.",
  ".gnnngg.",
  "..nnnn..",
  "..nnnn..",
  "...nn...",
];

function pixelTex(n) {
  const canvas = cellCanvas(n, 16, (g, x, y, px, r, c) => {
    g.fillStyle = "#24180f";
    g.fillRect(x, y, px, px);
    g.fillStyle = (r + c) % 2 === 0 ? "#3f8f3a" : "#4ea046";
    g.fillRect(x + 1, y + 1, px - 2, px - 2);
    g.fillStyle = "#8fd15a";
    g.fillRect(x + 2, y + 2, 2, 2);
    g.fillRect(x + px - 5, y + 3, 2, 2);
    g.fillStyle = "#2f6a2c";
    g.fillRect(x + 3, y + px - 4, 3, 2);
  }, true);
  return canvasTexture(canvas, true);
}

function paintSky(canvas) {
  const { ctx, w, h } = skyCanvas(canvas, true);
  ctx.imageSmoothingEnabled = false;
  const bands = ["#1c2454", "#243878", "#3a8ec4", "#7ec8ea"];
  const bandH = Math.round(h * 0.16);
  bands.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, i * bandH, w, bandH + 1);
  });
  ctx.fillStyle = "#f0d060";
  ctx.fillRect(Math.round(w * 0.72), Math.round(h * 0.08), 28, 28);
  ctx.fillStyle = "#fff6d0";
  for (let i = 0; i < 16; i++) {
    const x = Math.round(((i * 97) % 100) / 100 * w);
    const y = Math.round(((i * 53) % 100) / 100 * bandH);
    ctx.fillRect(x, y, 2, 2);
  }
  const y0 = Math.round(groundTop(h));
  ctx.fillStyle = "#214e28";
  ctx.fillRect(0, y0, w, h - y0);
  ctx.fillStyle = "#3a8c32";
  ctx.fillRect(0, y0, w, 10);
  ctx.fillStyle = "#8a4e32";
  ctx.fillRect(28, y0 + 18, 10, 12);
  ctx.fillStyle = "#3a8c32";
  ctx.fillRect(26, y0 + 12, 14, 8);
}

function pixelateShader() {
  return new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      pixel: { value: 2 },
    },
    vertexShader: quadVert,
    fragmentShader: `
      precision mediump float;
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform float pixel;
      varying vec2 vUv;
      void main() {
        vec2 size = resolution / pixel;
        vec2 uv = (floor(vUv * size) + 0.5) / size;
        vec4 c = texture2D(tDiffuse, uv);
        float row = floor(gl_FragCoord.y / pixel);
        float scan = mod(row, 2.0);
        vec3 rgb = c.rgb * mix(0.90, 1.0, scan);
        gl_FragColor = vec4(rgb, c.a);
      }
    `,
  });
}

export function createLook() {
  const floorCache = new Map();
  const mats = {
    frameMid: flat(0x2f6a32),
    frameHi: flat(0x8fd15a),
    frameLow: flat(0x24180f),
    frameInk: flat(0x141414),
    side: flat(0x6b3e22),
    top: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    glass: new THREE.MeshBasicMaterial({ color: 0x9ae7ff, transparent: true, opacity: 0.55, depthWrite: false }),
  };
  const holes = {
    mouth: flat(0x14141c),
    lip: flat(0x3a8c32),
    ring: flat(0xffb03a),
    rim: flat(0x1a1c2c),
    shadow: new THREE.MeshBasicMaterial({ color: 0x141410, transparent: true, opacity: 0.4, depthWrite: false }),
  };
  const ball = new THREE.MeshBasicMaterial({ color: 0xe39a45 });
  const wallCache = new Map();
  const wallMat = (name, part) => {
    const key = `${name}:${part}`;
    if (!wallCache.has(key)) {
      const hex = part === "rim" ? 0x141414 : part === "base" ? 0x24180f : (PIX[name] || PIX.green);
      wallCache.set(key, flat(hex));
    }
    return wallCache.get(key);
  };
  const pal = { t: "#a86830", f: "#e0a060", b: "#f2d2b0", e: "#fff6e8", p: "#141414", n: "#3a2418" };
  const treePal = { g: "#3a9a44", d: "#2f6a32", w: "#8a5a32" };
  const acornPal = { g: "#3a8c32", n: "#e0a050" };

  let root = null;
  let pass = null;
  let film = null;
  let reduce = false;

  function build() {
    const group = new THREE.Group();
    group.name = "wood-look";
    const squirrel = sprite(SQUIRREL, pal, 2);
    const treeL = sprite(TREE, treePal, 2);
    const treeR = sprite(TREE, treePal, 2);
    const acorn = sprite(ACORN, acornPal, 2);
    group.add(squirrel, treeL, treeR, acorn);
    group.userData.parts = { squirrel, treeL, treeR, acorn };
    return group;
  }

  return {
    id: "pixel",
    paintSky,
    mount(ctx) {
      reduce = !!ctx.reduceMotion;
      ctx.tune({
        exposure: 1,
        hemi: { sky: 0xffffff, ground: 0x8a8a8a, intensity: 0.4 },
        ambient: { color: 0xffffff, intensity: 0.85 },
        key: { color: 0xffffff, intensity: 0.6, position: [4, 10, 4] },
        fill: { color: 0xffffff, intensity: 0.2 },
        motes: { visible: false },
        blob: 0x10140c,
        contact: { color: 0x141410, opacity: 0.45 },
      });
      if (!floorCache.has(ctx.n)) floorCache.set(ctx.n, pixelTex(ctx.n));
      mats.top.map = floorCache.get(ctx.n);
      mats.top.needsUpdate = true;
      restyleRig(ctx.rig, {
        hideInk: false,
        gloss: ctx.gloss,
        frameMats: ctx.frameMats,
        floorEdge: ctx.floorEdge,
        mats,
        wallMat,
        dressButton: (node) => tintButton(node, 0x24180f, GEM[node.userData.color] || GEM.red),
      });
      dressHole(ctx.stockHole, holes);
      if (!root) root = build();
      const { outer } = frameRim(ctx.span, ctx.frameT);
      const s = Math.min(1.45, Math.max(0.85, ctx.span / 4.6));
      const y = ctx.boardTop + 0.02;
      const parts = root.userData.parts;
      parts.squirrel.position.set(0, y, -(outer + 0.02));
      parts.squirrel.scale.set(0.78 * s, 1.02 * s, 1);
      parts.treeL.position.set(-(outer - 0.04), y, -(outer - 0.08));
      parts.treeR.position.set(outer - 0.04, y, -outer * 0.45);
      parts.treeL.scale.set(0.85 * s, 1.15 * s, 1);
      parts.treeR.scale.set(0.78 * s, 1.05 * s, 1);
      parts.acorn.position.set(outer * 0.2, y, outer - 0.02);
      parts.acorn.scale.set(0.42 * s, 0.52 * s, 1);
      const spot = ctx.cellXZ(ctx.hole[0], ctx.hole[1]);
      const old = root.getObjectByName("look-goal");
      if (old) root.remove(old);
      root.add(goalRing(holes.ring, spot.x, spot.z, ctx.boardTop));
      ctx.rig.add(root);
      const deco = ctx.rig.getObjectByName("board-deco");
      if (deco) deco.visible = false;
      if (!pass) {
        film = new THREE.ShaderMaterial({
          uniforms: THREE.UniformsUtils.clone(FilmShader.uniforms),
          vertexShader: quadVert,
          fragmentShader: FilmShader.fragmentShader,
        });
        film.uniforms.intensity.value = 0.12;
        film.uniforms.grayscale.value = false;
        pass = createChain(ctx.renderer, [pixelateShader(), film]);
      }
    },
    dressBall(mesh) {
      mesh.material = ball;
    },
    dressGoal(stock) {
      dressHole(stock, holes);
    },
    tick() {},
    draw(renderer, scene, camera, time) {
      if (!pass) return false;
      film.uniforms.time.value = reduce ? 0 : time * 0.35;
      pass.render(scene, camera);
      return true;
    },
    unmount(ctx) {
      ctx.restore();
      if (root && root.parent) root.parent.remove(root);
    },
  };
}
