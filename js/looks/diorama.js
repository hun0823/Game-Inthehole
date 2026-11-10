/**
 * Wood look A — low-poly forest diorama.
 * Sculpted grass island, modelled squirrel, warm sun, still leaves and shafts.
 */
import * as THREE from "../vendor/three.module.js";
import { skyCanvas, groundTop } from "./sky.js";
import {
  GEM, canvasTexture, cellCanvas, roundFill, lit, restyleRig, tintButton, dressHole,
  frameRim, layoutProps, applyLayout, makeSquirrel, makeTree, makeStump, makeAcorn, goalRing, shaftMaterial,
} from "./props.js";

const BARK = { red: 0x8a4e34, blue: 0x6d5948, green: 0x5d6838, purple: 0x6b4c55 };
const CAP = { red: 0xa56a40, blue: 0x8a7260, green: 0x7c8a4e, purple: 0x846270 };

function grassTex(n) {
  const canvas = cellCanvas(n, 48, (g, x, y, px, r, c) => {
    const shift = ((r * 3 + c * 5) % 5) / 5;
    g.fillStyle = "#5c3d24";
    g.fillRect(x, y, px, px);
    g.fillStyle = shift > 0.55 ? "#7eb654" : "#6eaa46";
    const m = 3;
    roundFill(g, x + m, y + m, px - m * 2, px - m * 2, 7);
    g.fillStyle = "rgba(255,248,220,0.16)";
    const blades = 5;
    for (let i = 0; i < blades; i++) {
      const bx = x + 6 + ((r * 11 + c * 7 + i * 13) % (px - 14));
      const by = y + 6 + ((r * 5 + c * 17 + i * 9) % (px - 16));
      g.fillRect(bx, by, 2, 7);
    }
  });
  return canvasTexture(canvas);
}

function paintSky(canvas) {
  const { ctx, w, h } = skyCanvas(canvas);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#7ebfe4");
  sky.addColorStop(0.34, "#f2d2a6");
  sky.addColorStop(0.5, "#f7e4c6");
  sky.addColorStop(0.66, "#5ea24a");
  sky.addColorStop(1, "#1e4e30");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const sx = w * 0.74;
  const sy = h * 0.2;
  const sun = ctx.createRadialGradient(sx, sy, 6, sx, sy, w * 0.34);
  sun.addColorStop(0, "rgba(255,246,214,0.95)");
  sun.addColorStop(0.22, "rgba(255,214,160,0.28)");
  sun.addColorStop(1, "rgba(255,214,160,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
  const hill = (y, color, amp) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(w * 0.28, y - amp, w * 0.55, y + amp * 0.2);
    ctx.quadraticCurveTo(w * 0.82, y + amp, w, y - amp * 0.25);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();
  };
  hill(h * 0.58, "#3c7a40", 28);
  hill(h * 0.66, "#2c6434", 18);
  const y0 = groundTop(h);
  ctx.fillStyle = "#214e30";
  ctx.fillRect(0, y0 + 8, w, h);
  ctx.fillStyle = "#3e8c48";
  ctx.beginPath();
  ctx.moveTo(0, y0 + 16);
  ctx.quadraticCurveTo(w * 0.4, y0 - 4, w, y0 + 18);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  const ax = 42;
  const ay = y0 + 36;
  ctx.fillStyle = "#c47a3a";
  ctx.beginPath();
  ctx.ellipse(ax, ay, 11, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2f6e38";
  ctx.beginPath();
  ctx.ellipse(ax, ay - 12, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function createLook() {
  const floorCache = new Map();
  const fur = lit(0xc47a45, 0.72);
  const belly = lit(0xf0d2b0, 0.78);
  const ear = lit(0xe09a8a, 0.7);
  const eye = lit(0x1a120c, 0.4);
  const nose = lit(0x3a2418, 0.45);
  const tailMat = lit(0xa86532, 0.74);
  const bark = lit(0x6b4428, 0.86);
  const leafA = lit(0x3e9a45, 0.8);
  const leafB = lit(0x2f7a38, 0.84);
  const stumpTop = lit(0xc4a06a, 0.7);
  const nut = lit(0xd4924a, 0.46);
  const capMat = lit(0x3d7a3a, 0.7);
  const mats = {
    frameMid: lit(0x6b442c, 0.9),
    frameHi: lit(0x6eae48, 0.78),
    frameLow: lit(0x4a301c, 0.92),
    frameInk: lit(0x2a1a10, 0.95),
    side: lit(0x6a4328, 0.9),
    top: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0, envMapIntensity: 0.12 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xd5f0d8, transparent: true, opacity: 0.46, roughness: 0.08, metalness: 0, depthWrite: false, envMapIntensity: 0.35,
    }),
  };
  const holes = {
    mouth: lit(0x24160e, 0.95),
    lip: lit(0x6a9a40, 0.75),
    ring: lit(0xe39a45, 0.42, 0xc47a28, 0.18),
    rim: lit(0x3a2418, 0.7),
    shadow: new THREE.MeshBasicMaterial({ color: 0x1a120c, transparent: true, opacity: 0.35, depthWrite: false }),
  };
  const wallCache = new Map();
  const wallMat = (name, part) => {
    const key = `${name}:${part}`;
    if (!wallCache.has(key)) {
      const hex = part === "cap" ? (CAP[name] || CAP.green) : part === "rim" ? 0x3a2418 : (BARK[name] || BARK.green);
      wallCache.set(key, lit(hex, part === "cap" ? 0.72 : 0.88));
    }
    return wallCache.get(key);
  };

  let root = null;
  let tail = null;
  let trees = [];
  let shafts = [];
  let leaves = null;
  let leafBase = [];
  let reduce = false;
  const dummy = new THREE.Object3D();

  function build() {
    const group = new THREE.Group();
    group.name = "wood-look";
    const squirrel = makeSquirrel({ fur, belly, ear, eye, nose, tail: tailMat });
    squirrel.name = "look-squirrel";
    tail = squirrel.userData.tail;
    const treeL = makeTree(bark, leafA, leafB);
    const treeR = makeTree(bark, leafB, leafA);
    trees = [treeL, treeR];
    const stump = makeStump(bark, stumpTop);
    const acorn = makeAcorn(nut, capMat);
    group.add(squirrel, treeL, treeR, stump, acorn);
    group.userData.squirrel = squirrel;
    group.userData.stump = stump;
    group.userData.acorn = acorn;

    const tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(0.035, 0.13, 5), leafA, 12);
    tuft.castShadow = false;
    tuft.receiveShadow = false;
    tuft.frustumCulled = false;
    group.add(tuft);
    group.userData.tuft = tuft;

    leaves = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.07, 0.042),
      new THREE.MeshBasicMaterial({ color: 0xd2e68a, side: THREE.DoubleSide, transparent: true, opacity: 0.88, depthWrite: false }),
      8,
    );
    leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    leaves.frustumCulled = false;
    group.add(leaves);

    shafts = [0, 1].map((i) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1), shaftMaterial(0.11));
      mesh.position.y = 1.15;
      mesh.rotation.y = i === 0 ? 0.5 : -0.7;
      mesh.renderOrder = 2;
      group.add(mesh);
      return mesh;
    });
    return group;
  }

  function place(ctx) {
    const layout = layoutProps(ctx);
    const { rim } = frameRim(ctx.span, ctx.frameT);
    const y = ctx.boardTop;
    applyLayout({
      squirrel: root.userData.squirrel,
      treeL: trees[0],
      treeR: trees[1],
      stump: root.userData.stump,
      acorn: root.userData.acorn,
    }, layout);
    const tuft = root.userData.tuft;
    for (let i = 0; i < 12; i++) {
      const side = i < 6 ? -1 : 1;
      const along = ((i % 6) / 5 - 0.5) * rim * 1.3;
      dummy.position.set(side < 0 ? -rim : along, y, side < 0 ? along : -rim);
      dummy.rotation.set(0, i, 0);
      dummy.scale.setScalar(0.85 + (i % 3) * 0.12);
      dummy.updateMatrix();
      tuft.setMatrixAt(i, dummy.matrix);
    }
    tuft.instanceMatrix.needsUpdate = true;
    leafBase = [];
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const rad = rim * (0.35 + (i % 3) * 0.12);
      leafBase.push({ x: Math.cos(ang) * rad, z: Math.sin(ang) * rad * 0.6, p: i });
    }
    const spot = ctx.cellXZ(ctx.hole[0], ctx.hole[1]);
    const ring = goalRing(holes.ring, spot.x, spot.z, ctx.boardTop);
    const old = root.getObjectByName("look-goal");
    if (old) root.remove(old);
    root.add(ring);
    shafts.forEach((mesh, i) => {
      mesh.scale.set(ctx.span * 0.18, ctx.span * 0.42, 1);
      mesh.position.set(i === 0 ? -ctx.span * 0.28 : ctx.span * 0.22, 1.35, -ctx.span * 0.62);
      mesh.rotation.set(-0.85, i === 0 ? 0.35 : -0.4, 0.08);
    });
  }

  return {
    id: "diorama",
    paintSky,
    mount(ctx) {
      reduce = !!ctx.reduceMotion;
      ctx.tune({
        exposure: 1.05,
        hemi: { sky: 0xffe6c2, ground: 0x4e6a34, intensity: 0.62 },
        ambient: { color: 0xfff4e4, intensity: 0.24 },
        key: { color: 0xfff1d4, intensity: 2.45, position: [5.2, 8.6, 3.4] },
        fill: { color: 0xc9d8b4, intensity: 0.32 },
        motes: { color: 0xffe6a8, visible: true },
        blob: 0x1c2c18,
        contact: { color: 0x1a140e, opacity: 0.32 },
      });
      if (!floorCache.has(ctx.n)) floorCache.set(ctx.n, grassTex(ctx.n));
      mats.top.map = floorCache.get(ctx.n);
      mats.top.needsUpdate = true;
      restyleRig(ctx.rig, {
        hideInk: true,
        gloss: ctx.gloss,
        frameMats: ctx.frameMats,
        floorEdge: ctx.floorEdge,
        mats,
        wallMat,
        dressButton: (node) => tintButton(node, 0x6b442c, GEM[node.userData.color] || GEM.red),
      });
      dressHole(ctx.stockHole, holes);
      if (!root) root = build(ctx);
      place(ctx);
      ctx.rig.add(root);
      const deco = ctx.rig.getObjectByName("board-deco");
      if (deco) deco.visible = false;
    },
    dressBall(mesh) {
      mesh.material = nut;
    },
    dressGoal(stock) {
      dressHole(stock, holes);
    },
    tick(time) {
      if (!root) return;
      if (tail && !reduce) tail.rotation.z = Math.sin(time * 2.2) * 0.22;
      if (!reduce) {
        trees.forEach((tree, i) => {
          tree.rotation.z = Math.sin(time * 1.05 + i) * 0.025;
        });
        shafts.forEach((mesh, i) => {
          mesh.material.opacity = 0.08 + Math.sin(time * 0.55 + i * 1.4) * 0.03;
        });
      }
      if (leaves) {
        leafBase.forEach((leaf, i) => {
          const bob = reduce ? 0 : Math.sin(time * 0.8 + leaf.p) * 0.08;
          const spin = reduce ? leaf.p : time * 0.2 + i;
          dummy.position.set(leaf.x + bob, 1.05 + (i % 3) * 0.12, leaf.z);
          dummy.rotation.set(0.4, spin, 0.2);
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          leaves.setMatrixAt(i, dummy.matrix);
        });
        leaves.instanceMatrix.needsUpdate = true;
      }
    },
    unmount(ctx) {
      ctx.restore();
      if (root && root.parent) root.parent.remove(root);
    },
  };
}
