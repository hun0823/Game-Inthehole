/**
 * Lava-planet magma visuals. Rules stay in the other PR.
 *
 * view.onMagmaEvent(ev) and window.RB_MAGMA:
 *   { type: "magmaCrack", r, c }     floor cracks (warn)
 *   { type: "magmaCollapse", r, c }  floor falls in, lava stays
 *   { type: "lavaDeath", r, c }      the ball heats, sinks, smoke and flame
 * r and c may arrive on ev.cell instead. A cell that was not mounted is ignored.
 *
 * Resting cells, when the rules publish them:
 *   game.snapshot().magma → { r, c, state: "floor" | "warn" | "lava" }
 */
import * as THREE from "./vendor/three.module.js";
import { createToon } from "./toonPalette.js";
import { addScreenOutline } from "./outline.js";

const PIECES = 5;
const tileTex = new Map();
let flowMap = null;
let shared = null;

function hexRgb(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(hex, toward, t) {
  const m = mixRgb(hexRgb(hex), hexRgb(toward), t);
  return (m[0] << 16) | (m[1] << 8) | m[2];
}

function mixRgb(a, b, t) {
  return a.map((c, i) => Math.round(c + (b[i] - c) * t));
}

function roundFill(g, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
  g.fill();
}

function tileTexture(floorHex, pale) {
  const key = `${floorHex}:${pale ? 1 : 0}`;
  let tex = tileTex.get(key);
  if (tex) return tex;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  const base = hexRgb(floorHex);
  const tone = pale ? mixRgb(base, [255, 255, 255], 0.46) : mixRgb(base, [0, 0, 0], 0.12);
  g.clearRect(0, 0, size, size);
  g.fillStyle = `rgb(${tone.join(",")})`;
  roundFill(g, 1, 1, size - 2, size - 2, size * 0.1);
  g.strokeStyle = "rgba(255, 140, 60, 0.35)";
  g.lineWidth = 3;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(size * 0.25, size * 0.35);
  g.lineTo(size * 0.5, size * 0.58);
  g.lineTo(size * 0.74, size * 0.4);
  g.stroke();
  g.strokeStyle = "rgba(255, 148, 60, 0.5)";
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(size * 0.22, size * 0.64);
  g.lineTo(size * 0.4, size * 0.48);
  g.lineTo(size * 0.56, size * 0.72);
  g.moveTo(size * 0.6, size * 0.26);
  g.lineTo(size * 0.8, size * 0.46);
  g.stroke();
  tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tileTex.set(key, tex);
  return tex;
}

function lavaFlow() {
  if (flowMap) return flowMap;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, "#ffd24a");
  grd.addColorStop(0.35, "#ff6a12");
  grd.addColorStop(0.7, "#e51a0c");
  grd.addColorStop(1, "#ffb020");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  g.globalAlpha = 0.55;
  for (let i = 0; i < 5; i++) {
    g.strokeStyle = i % 2 ? "#ffe08a" : "#b01008";
    g.lineWidth = 7;
    g.beginPath();
    const y = 16 + i * 24;
    g.moveTo(0, y);
    g.bezierCurveTo(36, y + 14, 88, y - 16, 128, y);
    g.stroke();
  }
  g.globalAlpha = 0.9;
  g.fillStyle = "#ffd060";
  for (let i = 0; i < 7; i++) {
    g.beginPath();
    g.arc(18 + (i * 37) % 100, 20 + (i * 29) % 90, 3 + (i % 3), 0, Math.PI * 2);
    g.fill();
  }
  flowMap = new THREE.CanvasTexture(canvas);
  flowMap.colorSpace = THREE.SRGBColorSpace;
  flowMap.wrapS = THREE.RepeatWrapping;
  flowMap.wrapT = THREE.RepeatWrapping;
  return flowMap;
}

function geos() {
  if (shared) return shared;
  const box = new THREE.BoxGeometry(1, 1, 1);
  const pool = new THREE.CylinderGeometry(0.5, 0.48, 0.05, 22);
  const rim = new THREE.TorusGeometry(0.46, 0.06, 6, 22);
  const bubble = new THREE.SphereGeometry(0.055, 8, 6);
  const flameShape = new THREE.Shape();
  flameShape.moveTo(0, 0.11);
  flameShape.bezierCurveTo(0.055, 0.05, 0.04, -0.01, 0, -0.07);
  flameShape.bezierCurveTo(-0.04, -0.01, -0.055, 0.05, 0, 0.11);
  const flame = new THREE.ShapeGeometry(flameShape);
  const pieces = [];
  for (let i = 0; i < PIECES; i++) {
    const a0 = (i / PIECES) * Math.PI * 2;
    const a1 = ((i + 1) / PIECES) * Math.PI * 2;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(Math.cos(a0) * 0.5, Math.sin(a0) * 0.5);
    shape.lineTo(Math.cos(a1) * 0.5, Math.sin(a1) * 0.5);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    pieces.push(geo);
  }
  shared = { box, pool, rim, bubble, flame, pieces };
  return shared;
}

function flat(mesh) {
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  return mesh;
}

function cellKey(r, c) {
  return `${r},${c}`;
}

function stateOf(value) {
  if (value === "floor" || value === "warn" || value === "lava") return value;
  if (value && typeof value === "object") return stateOf(value.state);
  return null;
}

function readSnapshot(game) {
  if (!game || typeof game.snapshot !== "function") return null;
  let snap;
  try {
    snap = game.snapshot();
  } catch {
    return null;
  }
  const magma = snap && snap.magma;
  if (!magma) return null;
  const out = [];
  const push = (r, c, value) => {
    const state = stateOf(value);
    const row = Number(r);
    const col = Number(c);
    if (!state || !Number.isInteger(row) || !Number.isInteger(col)) return;
    out.push({ r: row, c: col, state });
  };
  if (Array.isArray(magma)) {
    for (const item of magma) {
      if (!item || typeof item !== "object") continue;
      const src = item.cell && typeof item.cell === "object" ? item.cell : item;
      push(src.r ?? src.row, src.c ?? src.col, item);
    }
  } else if (typeof magma.forEach === "function") {
    magma.forEach((value, key) => {
      if (typeof key === "string" && key.includes(",")) {
        const [r, c] = key.split(",");
        push(r, c, value);
      } else if (value && typeof value === "object") {
        push(value.r ?? value.row, value.c ?? value.col, value);
      }
    });
  } else if (typeof magma === "object") {
    for (const [key, value] of Object.entries(magma)) {
      if (key.includes(",")) {
        const [r, c] = key.split(",");
        push(r, c, value);
      } else if (value && typeof value === "object") {
        push(value.r ?? value.row, value.c ?? value.col, value);
      }
    }
  }
  return out.length ? out : null;
}

function eventCell(ev) {
  if (!ev) return null;
  const src = ev.cell && typeof ev.cell === "object" ? ev.cell : ev;
  const r = Number(src.r ?? src.row);
  const c = Number(src.c ?? src.col);
  if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
  return { r, c };
}

export function createMagmaLook(ctx) {
  const cells = new Map();
  const top = ctx.boardTop;
  const step = ctx.step;
  const geo = geos();
  const flow = lavaFlow();
  const inkMat = new THREE.MeshBasicMaterial({ color: 0x141414, toneMapped: false });
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff7a18,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    toneMapped: false,
  });
  const poolMat = new THREE.MeshBasicMaterial({ map: flow, color: 0xffffff, toneMapped: false });
  const lipMat = new THREE.MeshBasicMaterial({ color: 0x3a100c, toneMapped: false });
  const rimMat = createToon(0x4a2418);
  const chipMat = createToon(0x5a3028);
  const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xfff1b0, toneMapped: false });
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xffc83a,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const heatMat = new THREE.MeshBasicMaterial({
    color: 0xff2a08,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });
  const heat = new THREE.Mesh(new THREE.SphereGeometry((ctx.ballR || 0.36) * 1.04, 20, 14), heatMat);
  heat.visible = false;
  heat.raycast = () => {};
  if (ctx.ballMesh) ctx.ballMesh.add(heat);

  let floorHex = "#5a3028";
  let death = null;

  function own(mesh, mat) {
    flat(mesh);
    if (mat) mesh.userData.ownMat = true;
    return mesh;
  }

  function bar(parent, mat, len, thick, rot, y) {
    const line = own(new THREE.Mesh(geo.box, mat));
    line.scale.set(len, 0.045, thick);
    line.rotation.y = rot;
    line.position.y = y;
    parent.add(line);
    return line;
  }

  function spawn(r, c) {
    const key = cellKey(r, c);
    if (cells.has(key)) return cells.get(key);
    const spot = ctx.cellXZ(r, c);
    const group = new THREE.Group();
    group.name = "magma-cell";
    group.position.set(spot.x, 0, spot.z);
    group.frustumCulled = false;
    const pale = (r + c) % 2 === 0;
    const tileMat = createToon(0xffffff, {
      map: tileTexture(floorHex, pale),
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    tileMat.alphaTest = 0.4;
    const tileSize = step * (92 / 96);
    const tile = own(new THREE.Mesh(new THREE.BoxGeometry(tileSize, 0.045, tileSize), tileMat), true);
    tile.position.y = top + 0.028;
    group.add(tile);

    const cracks = new THREE.Group();
    cracks.visible = false;
    const ang = Math.PI / 4;
    const span = step * (92 / 96);
    const diag = span * 1.18;
    bar(cracks, inkMat, diag, 0.2, ang, top + 0.07);
    bar(cracks, inkMat, diag, 0.2, -ang, top + 0.07);
    bar(cracks, glowMat, diag * 0.92, 0.09, ang, top + 0.095);
    bar(cracks, glowMat, diag * 0.92, 0.09, -ang, top + 0.095);
    bar(cracks, inkMat, span * 0.48, 0.13, 0.12, top + 0.075);
    bar(cracks, glowMat, span * 0.4, 0.06, 0.12, top + 0.1);
    bar(cracks, inkMat, span * 0.42, 0.12, -1.02, top + 0.075);
    bar(cracks, glowMat, span * 0.34, 0.055, -1.02, top + 0.1);
    cracks.scale.setScalar(0.12);
    group.add(cracks);

    const pieces = [];
    const crust = pale ? mixHex(floorHex, 0xffffff, 0.46) : mixHex(floorHex, 0x000000, 0.12);
    for (let i = 0; i < PIECES; i++) {
      const mat = createToon(crust);
      mat.transparent = true;
      const mesh = own(new THREE.Mesh(geo.pieces[i], mat), true);
      mesh.position.y = top + 0.04;
      mesh.visible = false;
      mesh.scale.setScalar(tileSize / 1);
      const a0 = (i / PIECES) * Math.PI * 2;
      const a1 = ((i + 1) / PIECES) * Math.PI * 2;
      mesh.userData.ang = (a0 + a1) / 2;
      mesh.userData.spin = (i % 2 ? 1 : -1) * (0.4 + i * 0.08);
      const edge = flat(new THREE.Mesh(geo.pieces[i], inkMat));
      edge.scale.setScalar(1.28);
      edge.position.y = -0.012;
      mesh.add(edge);
      group.add(mesh);
      pieces.push(mesh);
    }

    const lava = new THREE.Group();
    lava.visible = false;
    const pool = flat(new THREE.Mesh(geo.pool, poolMat));
    pool.position.y = top + 0.02;
    pool.scale.set(0.86, 1, 0.86);
    const lip = flat(new THREE.Mesh(geo.rim, lipMat));
    lip.rotation.x = Math.PI / 2;
    lip.position.y = top + 0.045;
    lip.scale.setScalar(0.9);
    const rim = flat(new THREE.Mesh(geo.rim, rimMat));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = top + 0.062;
    addScreenOutline(rim);
    lava.add(pool, lip, rim);
    const chips = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.35;
      const chip = flat(new THREE.Mesh(geo.box, chipMat));
      chip.position.set(Math.cos(a) * 0.47, top + 0.055, Math.sin(a) * 0.47);
      chip.rotation.y = a + 0.4;
      chip.scale.set(0.18, 0.045, 0.1);
      addScreenOutline(chip);
      lava.add(chip);
      chips.push(chip);
    }
    const bubbles = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.5;
      const bubble = flat(new THREE.Mesh(geo.bubble, bubbleMat));
      bubble.position.set(Math.cos(a) * (0.12 + (i % 2) * 0.1), top + 0.07, Math.sin(a) * (0.14 + (i % 3) * 0.05));
      bubble.userData.phase = i * 0.55;
      lava.add(bubble);
      bubbles.push(bubble);
    }
    const flames = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.8;
      const flame = flat(new THREE.Mesh(geo.flame, flameMat));
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(Math.cos(a) * 0.16, top + 0.08, Math.sin(a) * 0.16);
      flame.userData.phase = i * 0.4;
      flame.visible = false;
      lava.add(flame);
      flames.push(flame);
    }
    group.add(lava);

    group.userData = {
      r, c, key,
      baseX: spot.x,
      baseZ: spot.z,
      state: "floor",
      mode: "floor",
      spread: 0,
      fall: 0,
      tile, cracks, pieces, lava, bubbles, flames, tileMat,
    };
    ctx.parent.add(group);
    cells.set(key, group);
    return group;
  }

  function rest(group, state) {
    const data = group.userData;
    data.state = state;
    data.mode = state;
    data.spread = state === "floor" ? 0 : 1;
    data.fall = state === "lava" ? 1 : 0;
    data.tile.visible = state !== "lava";
    data.cracks.visible = state === "warn";
    data.cracks.scale.setScalar(state === "warn" ? 1 : 0.12);
    for (const piece of data.pieces) {
      piece.visible = false;
      piece.position.set(0, top + 0.04, 0);
      piece.scale.setScalar(step * (92 / 96));
      piece.rotation.z = 0;
    }
    data.lava.visible = state === "lava";
    data.lava.scale.setScalar(1);
    group.position.x = data.baseX;
    group.position.z = data.baseZ;
  }

  function dropCells() {
    for (const group of cells.values()) {
      group.traverse((node) => {
        const mat = node.userData.ownMat && node.material;
        if (!mat) return;
        [].concat(mat).forEach((m) => m && m.dispose());
      });
      ctx.parent.remove(group);
    }
    cells.clear();
  }

  function ventList(vents) {
    const out = [];
    for (const vent of vents || []) {
      if (Array.isArray(vent)) out.push([vent[0], vent[1]]);
      else if (vent && typeof vent === "object") out.push([vent.r ?? vent.row, vent.c ?? vent.col]);
    }
    return out;
  }

  function mount(vents, theme, game) {
    dropCells();
    death = null;
    heat.visible = false;
    heatMat.opacity = 0;
    if (theme && theme.floor) floorHex = theme.floor;
    for (const [r, c] of ventList(vents)) {
      if (!Number.isInteger(Number(r)) || !Number.isInteger(Number(c))) continue;
      spawn(Number(r), Number(c));
    }
    sync(game);
  }

  function sync(game) {
    const listed = readSnapshot(game);
    if (!listed) return;
    for (const item of listed) {
      const group = cells.get(cellKey(item.r, item.c)) || spawn(item.r, item.c);
      const data = group.userData;
      if (data.mode === "spreading" || data.mode === "collapsing") continue;
      if (data.state !== item.state) rest(group, item.state);
    }
  }

  function startWarn(group) {
    const data = group.userData;
    if (data.state === "lava" || data.mode === "collapsing") return;
    data.mode = "spreading";
    data.state = "warn";
    data.spread = 0.02;
    data.tile.visible = true;
    data.cracks.visible = true;
    data.lava.visible = false;
  }

  function startCollapse(group) {
    const data = group.userData;
    if (data.mode === "collapsing") return;
    if (data.state === "lava" && data.mode === "lava") return;
    data.mode = "collapsing";
    data.fall = 0;
    data.tile.visible = false;
    data.cracks.visible = false;
    data.lava.visible = false;
    data.lava.scale.setScalar(0.25);
    const fit = step * (92 / 96);
    for (const piece of data.pieces) {
      piece.visible = true;
      piece.position.set(0, top + 0.05, 0);
      piece.scale.setScalar(fit);
      piece.rotation.z = 0;
      piece.material.opacity = 1;
    }
    const spot = ctx.cellXZ(data.r, data.c);
    if (ctx.burst) {
      ctx.burst(spot.x, top + 0.2, spot.z, 12, 1.7, [[1, 0.55, 0.12], [1, 0.82, 0.28], [0.95, 0.25, 0.08]]);
    }
  }

  function startDeath(r, c) {
    death = { t: 0, r, c, burst: false, done: false };
  }

  function event(ev) {
    if (!ev || !ev.type) return;
    const rc = eventCell(ev);
    if (!rc) return;
    const group = cells.get(cellKey(rc.r, rc.c));
    if (!group) return;
    if (ev.type === "magmaCrack") startWarn(group);
    else if (ev.type === "magmaCollapse") startCollapse(group);
    else if (ev.type === "lavaDeath") startDeath(rc.r, rc.c);
  }

  function tick(time, dt) {
    const stepDt = dt > 0 ? dt : 0;
    glowMat.opacity = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * 7.5));
    flow.offset.y = (time * 0.07) % 1;
    for (const group of cells.values()) {
      const data = group.userData;
      if (data.mode === "spreading") {
        data.spread = Math.min(1, data.spread + stepDt * 3.4);
        const e = 1 - (1 - data.spread) ** 3;
        data.cracks.scale.setScalar(0.12 + 0.88 * e);
        if (data.spread >= 1) {
          data.mode = "warn";
          data.cracks.scale.setScalar(1);
        }
      }
      if (data.mode === "warn" || data.mode === "spreading") {
        group.position.x = data.baseX + Math.sin(time * 26 + data.c) * 0.018;
        group.position.z = data.baseZ + Math.cos(time * 21 + data.r) * 0.018;
      } else {
        group.position.x = data.baseX;
        group.position.z = data.baseZ;
      }
      if (data.mode === "collapsing") {
        data.fall = Math.min(1, data.fall + stepDt / 0.48);
        const spread = Math.min(1, data.fall / 0.42);
        const sink = Math.max(0, (data.fall - 0.58) / 0.42);
        const fit = step * (92 / 96);
        for (const piece of data.pieces) {
          const ang = piece.userData.ang;
          piece.position.x = Math.cos(ang) * spread * 0.11;
          piece.position.z = Math.sin(ang) * spread * 0.11;
          piece.position.y = top + 0.08 - sink * 0.5;
          piece.rotation.z = (spread * 0.45 + sink) * piece.userData.spin;
          const s = fit * (1 - spread * 0.16 - sink * 0.7);
          piece.scale.setScalar(Math.max(0.02, s));
          piece.visible = sink < 0.92;
        }
        const lavaU = Math.max(0, (data.fall - 0.34) / 0.66);
        data.lava.visible = lavaU > 0.02;
        data.lava.scale.setScalar(0.3 + 0.7 * lavaU);
        if (data.fall >= 1) rest(group, "lava");
      }
      const showIdle = data.lava.visible;
      data.bubbles.forEach((bubble, i) => {
        if (!showIdle) {
          bubble.visible = false;
          return;
        }
        const p = (time * 0.55 + bubble.userData.phase) % 1.5;
        const u = p / 1.5;
        const pop = u < 0.72 ? u / 0.72 : Math.max(0, 1 - (u - 0.72) / 0.28);
        bubble.visible = pop > 0.08;
        bubble.scale.setScalar(0.9 + pop * 1.8);
        bubble.position.y = top + 0.06 + pop * 0.05;
      });
      const flare = death && death.r === data.r && death.c === data.c && death.t < 0.6;
      data.flames.forEach((flame) => {
        if (!showIdle) {
          flame.visible = false;
          return;
        }
        const speed = flare ? 2.4 : 1.15;
        const p = (time * speed + flame.userData.phase) % 0.85;
        const pop = Math.sin((p / 0.85) * Math.PI);
        flame.visible = pop > 0.2;
        flame.scale.setScalar((flare ? 2.1 : 1.35) * (0.55 + pop * 0.9));
      });
    }
    if (ctx.parent) {
      if (death && death.t < 0.6) {
        const mag = 0.11 * (1 - death.t / 0.6);
        ctx.parent.position.x = Math.sin(time * 52) * mag;
        ctx.parent.position.z = Math.cos(time * 44) * mag;
      } else {
        ctx.parent.position.x = 0;
        ctx.parent.position.z = 0;
      }
    }
    if (!death) return;
    death.t += stepDt;
    const u = Math.min(1, death.t / 0.6);
    const heatU = Math.min(1, death.t / 0.22);
    heat.visible = true;
    heatMat.opacity = 0.2 + 0.72 * heatU;
    const sink = Math.max(0, (u - 0.06) / 0.94);
    const e = sink * sink * (3 - 2 * sink);
    const spot = ctx.cellXZ(death.r, death.c);
    const ballY = top + (ctx.ballR || 0.36);
    if (ctx.ballRoot) {
      ctx.ballRoot.position.set(spot.x, ballY * (1 - e) + (top - 0.04) * e, spot.z);
      const s = Math.max(0.06, 1 - 0.9 * e);
      ctx.ballRoot.scale.set(s, s, s);
    }
    if (ctx.contact) {
      ctx.contact.position.set(spot.x, top + 0.02, spot.z);
      ctx.contact.material.opacity = 0.28 * (1 - e);
    }
    if (u < 1 && ctx.kick) ctx.kick(0.32 + 0.3 * (1 - u));
    if (!death.burst && death.t > 0.05 && ctx.burst) {
      death.burst = true;
      ctx.burst(spot.x, top + 0.28, spot.z, 16, 1.9, [
        [1, 0.42, 0.1],
        [1, 0.78, 0.22],
        [0.32, 0.24, 0.22],
        [0.55, 0.46, 0.4],
      ]);
    }
  }

  function clear() {
    dropCells();
    death = null;
    heat.visible = false;
    heatMat.opacity = 0;
    if (ctx.parent) {
      ctx.parent.position.x = 0;
      ctx.parent.position.z = 0;
    }
    if (ctx.contact && ctx.contact.material) ctx.contact.material.opacity = 0.28;
  }

  return { mount, sync, event, tick, clear };
}
