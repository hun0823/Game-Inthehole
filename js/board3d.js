import * as THREE from "./vendor/three.module.js";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";
import { ballById } from "./balls.js";
import { addFloorSocket, createGoalKit, mountGoal } from "./goalMesh.js";
import { inkOutlineMaterial } from "./sphereMaps.js";
import { addSportMarks } from "./ballDress.js";
import { celebrationById, trailById } from "./cosmetics.js";
import { themeById } from "./themes.js";
import { applyStudio } from "./studioLight.js";
import { applyBallMaps, loadSphereMaps } from "./sphereMaps.js";
import { createBloom } from "./bloom.js";
import {
  beginTricks, tickTricks, trickVariant,
  makeSand, makeIce, makeJelly, makeSmog, makeMagma, makeTeleport, makeCurrent, makeButton,
  dressGlass, dressGate, makeGateGroove, dressVine,
} from "./trickLook.js";
import { beginDeco, tickDeco, decoWanted, createBoardDeco, layoutDeco } from "./boardDeco.js";

const STEP = 1.16;
const GEM_CYCLE = ["red", "blue", "green", "purple", "blue", "red", "purple", "green"];
const GEM_HEX = { red: 0xe23b3b, blue: 0x2f7dff, green: 0x1ea85a, purple: 0xa43adf };
const BALL_R = 0.36;
const BOARD_TOP = 0.5;
const BALL_Y = BOARD_TOP + BALL_R;
const REST_X = 0.045;
const WALL_T = 0.52;
const WALL_H = 0.4;
const WALL_Y = BOARD_TOP + WALL_H * 0.42;
const FRAME_T = 1.24;
const FRAME_H = 0.72;
const GEM_LIT = { red: 0xff8b86, blue: 0x8ec0ff, green: 0x74e09a, purple: 0xdc96ff };
const GEM_DIM = { red: 0x8e1c28, blue: 0x143e98, green: 0x0d6a34, purple: 0x62148e };

function mixHex(a, b, t) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}

function framePalette(theme) {
  if (theme.id === "wood") return { hi: 0xfffaf2, mid: 0xfff3e4, low: 0xd7c2a2 };
  if (theme.id === "ice") return { hi: 0xffffff, mid: 0xc5e9f8, low: 0x3d7496 };
  if (theme.id === "machine") return { hi: 0xf4f7fb, mid: 0xb7c2ce, low: 0x4e5964 };
  return {
    hi: mixHex(theme.frame, 0xffffff, 0.7),
    mid: mixHex(theme.frame, 0xffffff, 0.16),
    low: mixHex(theme.edge, 0x000000, 0.18),
  };
}

const geos = new Map();
function traceRoundRect(path, w, h, r, clockwise) {
  const x = -w / 2;
  const y = -h / 2;
  const rad = Math.max(0.04, Math.min(r, w / 2 - 0.02, h / 2 - 0.02));
  if (!clockwise) {
    path.moveTo(x + rad, y);
    path.lineTo(x + w - rad, y);
    path.absarc(x + w - rad, y + rad, rad, -Math.PI / 2, 0, false);
    path.lineTo(x + w, y + h - rad);
    path.absarc(x + w - rad, y + h - rad, rad, 0, Math.PI / 2, false);
    path.lineTo(x + rad, y + h);
    path.absarc(x + rad, y + h - rad, rad, Math.PI / 2, Math.PI, false);
    path.lineTo(x, y + rad);
    path.absarc(x + rad, y + rad, rad, Math.PI, Math.PI * 1.5, false);
    return;
  }
  path.moveTo(x + rad, y);
  path.absarc(x + rad, y + rad, rad, -Math.PI / 2, Math.PI, true);
  path.lineTo(x, y + h - rad);
  path.absarc(x + rad, y + h - rad, rad, Math.PI, Math.PI / 2, true);
  path.lineTo(x + w - rad, y + h);
  path.absarc(x + w - rad, y + h - rad, rad, Math.PI / 2, 0, true);
  path.lineTo(x + w, y + rad);
  path.absarc(x + w - rad, y + rad, rad, 0, -Math.PI / 2, true);
}

function frameRingGeo(outerW, innerW, outerR, innerR, depth) {
  const shape = new THREE.Shape();
  traceRoundRect(shape, outerW, outerW, outerR, false);
  const hole = new THREE.Path();
  traceRoundRect(hole, innerW, innerW, Math.max(0.04, innerR), true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(0.035, depth * 0.1),
    bevelSize: Math.min(0.028, depth * 0.08),
    bevelSegments: 1,
    curveSegments: 5,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

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

function rgbOf(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(a, b, t) {
  return a.map((c, i) => Math.round(c + (b[i] - c) * t));
}

function makeBoardTexture(n, palette) {
  const cell = 96;
  const size = n * cell;
  const floor = palette?.floor || "#e4a45e";
  const groove = palette?.groove || "112, 62, 24";
  const light = palette?.light || "255, 220, 168";
  const id = palette?.id || "wood";
  const base = rgbOf(floor);
  const pale = mixRgb(base, [255, 255, 255], 0.5);
  const deep = mixRgb(base, [0, 0, 0], 0.1);
  const seam = mixRgb(base, [255, 255, 255], 0.22);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = `rgb(${seam.join(",")})`;
  g.fillRect(0, 0, size, size);
  const gap = 3;
  const rad = 22;
  for (let r = 0; r < n; r++) {
    for (let col = 0; col < n; col++) {
      const x = col * cell + gap;
      const y = r * cell + gap;
      const w = cell - gap * 2;
      const tone = (r + col) % 2 === 0 ? pale : deep;
      g.fillStyle = `rgb(${tone.join(",")})`;
      roundFill(g, x, y, w, w, rad);
      g.save();
      g.beginPath();
      roundFillPath(g, x, y, w, w, rad);
      g.clip();
      paintCellMotif(g, id, x, y, w, r, col, groove, light);
      g.restore();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function roundFillPath(g, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
}

function paintCellMotif(g, id, x, y, w, r, col, groove, light) {
  g.strokeStyle = `rgba(${groove}, 0.28)`;
  g.fillStyle = `rgba(${groove}, 0.16)`;
  g.lineWidth = 2;
  g.lineCap = "round";
  if (id === "ice" && (r * 3 + col) % 2 === 0) {
    g.beginPath();
    g.moveTo(x + w * 0.2, y + w * 0.7);
    g.lineTo(x + w * 0.4, y + w * 0.45);
    g.lineTo(x + w * 0.55, y + w * 0.62);
    g.lineTo(x + w * 0.8, y + w * 0.28);
    g.stroke();
    return;
  }
  if (id === "wood") {
    g.beginPath();
    const cx = x + w / 2;
    const cy = y + w / 2;
    const rad = w * 0.28;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.closePath();
    g.stroke();
    return;
  }
  if (id === "desert") {
    g.beginPath();
    g.ellipse(x + w * 0.5, y + w * 0.62, w * 0.28, w * 0.1, 0, 0, Math.PI * 2);
    g.stroke();
    return;
  }
  if (id === "ocean") {
    g.beginPath();
    g.arc(x + w * 0.35, y + w * 0.4, w * 0.08, 0, Math.PI * 2);
    g.arc(x + w * 0.62, y + w * 0.58, w * 0.05, 0, Math.PI * 2);
    g.fill();
    return;
  }
  if (id === "crystal" || id === "toy") {
    const cx = x + w * 0.5;
    const cy = y + w * 0.5;
    g.beginPath();
    g.moveTo(cx, cy - w * 0.16);
    g.lineTo(cx + w * 0.05, cy - w * 0.05);
    g.lineTo(cx + w * 0.16, cy);
    g.lineTo(cx + w * 0.05, cy + w * 0.05);
    g.lineTo(cx, cy + w * 0.16);
    g.lineTo(cx - w * 0.05, cy + w * 0.05);
    g.lineTo(cx - w * 0.16, cy);
    g.lineTo(cx - w * 0.05, cy - w * 0.05);
    g.closePath();
    g.fill();
    return;
  }
  if (id === "candy") {
    const colors = ["#ff5a9a", "#7adf5a", "#ffe14a", "#3ec4ff"];
    for (let i = 0; i < 5; i++) {
      g.fillStyle = colors[(r + col + i) % colors.length];
      g.fillRect(x + 10 + ((i * 17 + col * 5) % (w - 16)), y + 12 + ((i * 13 + r * 7) % (w - 16)), 7, 3);
    }
    return;
  }
  if (id === "lava" && (r + col) % 3 === 0) {
    g.strokeStyle = "rgba(255, 120, 40, 0.55)";
    g.beginPath();
    g.moveTo(x + w * 0.2, y + w * 0.3);
    g.lineTo(x + w * 0.5, y + w * 0.55);
    g.lineTo(x + w * 0.75, y + w * 0.4);
    g.stroke();
    return;
  }
  if (id === "jungle") {
    g.beginPath();
    g.ellipse(x + w * 0.5, y + w * 0.5, w * 0.22, w * 0.12, 0.6, 0, Math.PI * 2);
    g.stroke();
    return;
  }
  if (id === "machine") {
    g.strokeStyle = `rgba(${light}, 0.35)`;
    g.strokeRect(x + w * 0.22, y + w * 0.22, w * 0.56, w * 0.56);
    g.beginPath();
    g.arc(x + w * 0.5, y + w * 0.5, 3, 0, Math.PI * 2);
    g.fill();
  }
}

function makeOakBallMap() {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  g.fillStyle = "#c4843c";
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 46; i++) {
    const x = i * 5.4 + Math.sin(i * 0.45) * 1.4;
    const dark = i % 7 === 0;
    g.strokeStyle = dark ? "rgba(90, 48, 22, 0.45)" : "rgba(210, 160, 96, 0.35)";
    g.lineWidth = dark ? 1.6 : 1.1;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + 6, 70, x - 5, 160, x + 2, 256);
    g.stroke();
  }
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

function paintTex(size, draw) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeBallMaterials() {
  const std = (opts) => new THREE.MeshStandardMaterial(opts);
  const marbleMap = paintTex(128, (g, s) => {
    g.fillStyle = "#f4fbff";
    g.fillRect(0, 0, s, s);
    g.lineCap = "round";
    const bands = ["#b7f3ff", "#2f9ec8", "#ffffff", "#1a6eb8"];
    bands.forEach((color, i) => {
      g.strokeStyle = color;
      g.lineWidth = 12 - i;
      g.beginPath();
      g.arc(s * 0.15, s * 0.85, 22 + i * 16, 0.1, 2.5);
      g.stroke();
      g.beginPath();
      g.arc(s * 0.95, s * 0.1, 16 + i * 14, 2.4, 5);
      g.stroke();
    });
  });
  const soccerMap = paintTex(128, (g, s) => {
    g.fillStyle = "#f7f7f7";
    g.fillRect(0, 0, s, s);
    g.fillStyle = "#1a1a1a";
    const spots = [[34, 30], [94, 36], [64, 72], [28, 98], [102, 96]];
    for (const [x, y] of spots) {
      g.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        const px = x + Math.cos(a) * 15;
        const py = y + Math.sin(a) * 15;
        if (i) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.closePath();
      g.fill();
    }
  });
  const tireMap = paintTex(128, (g, s) => {
    g.fillStyle = "#1a1a1a";
    g.fillRect(0, 0, s, s);
    g.strokeStyle = "#3c3c3c";
    g.lineWidth = 5;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.arc(s / 2, s / 2, 12 + i * 8, 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = "#080808";
    g.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(s / 2 + Math.cos(a) * 8, s / 2 + Math.sin(a) * 8);
      g.lineTo(s / 2 + Math.cos(a) * 62, s / 2 + Math.sin(a) * 62);
      g.stroke();
    }
  });
  const hoopMap = paintTex(128, (g, s) => {
    g.fillStyle = "#ef5a14";
    g.fillRect(0, 0, s, s);
    g.strokeStyle = "#1a120c";
    g.lineWidth = 7;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(0, s * 0.5);
    g.bezierCurveTo(s * 0.3, s * 0.38, s * 0.7, s * 0.62, s, s * 0.5);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.5, 0);
    g.bezierCurveTo(s * 0.36, s * 0.3, s * 0.64, s * 0.7, s * 0.5, s);
    g.stroke();
    g.beginPath();
    g.arc(s * 0.5, s * 0.5, s * 0.32, 0.5, 2.4);
    g.stroke();
  });
  const bowlMap = paintTex(128, (g, s) => {
    g.fillStyle = "#121214";
    g.fillRect(0, 0, s, s);
    g.fillStyle = "#3a3a42";
    g.beginPath();
    g.ellipse(38, 34, 26, 16, -0.5, 0, Math.PI * 2);
    g.fill();
    const holes = [[58, 46], [80, 42], [70, 66]];
    for (const [x, y] of holes) {
      g.fillStyle = "#ece8e0";
      g.beginPath();
      g.arc(x, y, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#1c1c22";
      g.beginPath();
      g.arc(x + 1, y + 1, 5.5, 0, Math.PI * 2);
      g.fill();
    }
  });
  const meteorMap = paintTex(128, (g, s) => {
    g.fillStyle = "#2a120c";
    g.fillRect(0, 0, s, s);
    g.strokeStyle = "#ff7a18";
    g.lineWidth = 4;
    g.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(8 + i * 16, 8);
      g.lineTo(28 + i * 14, s - 8);
      g.stroke();
    }
    g.fillStyle = "#ffb020";
    g.globalAlpha = 0.85;
    g.beginPath();
    g.arc(78, 46, 16, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  });
  const beachMap = paintTex(128, (g, s) => {
    const bands = ["#f7f7f7", "#3ec4ff", "#ffe14a", "#ff5b9a", "#f7f7f7", "#3ec4ff"];
    bands.forEach((color, i) => {
      g.fillStyle = color;
      g.fillRect(0, (i * s) / bands.length, s, s / bands.length + 1);
    });
  });
  const toyMap = paintTex(128, (g, s) => {
    g.fillStyle = "#ff4d88";
    g.fillRect(0, 0, s, s);
    g.fillStyle = "#ffe14a";
    g.beginPath();
    g.arc(s * 0.5, s * 0.5, s * 0.28, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff";
    g.fillRect(0, s * 0.42, s, s * 0.16);
  });
  const mushMap = paintTex(128, (g, s) => {
    g.fillStyle = "#f4f0ea";
    g.fillRect(0, 0, s, s);
    g.fillStyle = "#e23b3b";
    g.beginPath();
    g.arc(s * 0.5, s * 0.62, s * 0.48, Math.PI, 0);
    g.fill();
    g.fillStyle = "#fff8ea";
    for (const [x, y, r] of [[40, 36, 10], [78, 30, 8], [64, 52, 7], [96, 48, 6]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  });
  const baseballMap = paintTex(256, (g, s) => {
    g.fillStyle = "#f4f1e8";
    g.fillRect(0, 0, s, s);
    g.strokeStyle = "rgba(210, 196, 170, 0.55)";
    g.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      g.beginPath();
      g.moveTo(0, 18 + i * 24);
      g.bezierCurveTo(s * 0.4, 10 + i * 24, s * 0.6, 28 + i * 24, s, 16 + i * 24);
      g.stroke();
    }
  });
  const tennisMap = paintTex(256, (g, s) => {
    g.fillStyle = "#d2e000";
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 220; i++) {
      const x = (i * 47) % s;
      const y = (i * 29) % s;
      g.fillStyle = i % 2 ? "rgba(255,255,255,0.22)" : "rgba(90, 110, 0, 0.28)";
      g.beginPath();
      g.ellipse(x, y, 2.4, 1.3, (i % 7) * 0.4, 0, Math.PI * 2);
      g.fill();
    }
  });
  const golfMap = paintTex(256, (g, s) => {
    g.fillStyle = "#f7f7f4";
    g.fillRect(0, 0, s, s);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const x = 18 + col * 30 + (row % 2) * 15;
        const y = 18 + row * 30;
        g.fillStyle = "#8e8e86";
        g.beginPath();
        g.arc(x, y, 7.5, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#c8c8c0";
        g.beginPath();
        g.arc(x - 1.5, y - 1.5, 4.2, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
  const duneMap = paintTex(128, (g, s) => {
    g.fillStyle = "#e6c27a";
    g.fillRect(0, 0, s, s);
    g.strokeStyle = "#c9964a";
    g.lineWidth = 4;
    for (let y = 8; y < s; y += 10) {
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(s * 0.3, y - 4, s * 0.7, y + 4, s, y);
      g.stroke();
    }
  });
  const snowMap = paintTex(128, (g, s) => {
    g.fillStyle = "#f7fbff";
    g.fillRect(0, 0, s, s);
    g.fillStyle = "#c5dff5";
    for (let i = 0; i < 28; i++) {
      g.beginPath();
      g.arc((i * 37) % s, (i * 19) % s, 2 + (i % 3), 0, Math.PI * 2);
      g.fill();
    }
  });
  const cocoMap = paintTex(128, (g, s) => {
    g.fillStyle = "#6a3a18";
    g.fillRect(0, 0, s, s);
    g.strokeStyle = "rgba(42, 20, 8, 0.7)";
    g.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      g.beginPath();
      g.moveTo((i * 8) % s, 0);
      g.bezierCurveTo(20 + i * 6, s * 0.4, 10 + i * 7, s * 0.6, (i * 11) % s, s);
      g.stroke();
    }
  });
  const alienMap = paintTex(128, (g, s) => {
    g.fillStyle = "#9a6cff";
    g.fillRect(0, 0, s, s);
    g.fillStyle = "#b894ff";
    g.fillRect(0, s * 0.38, s, s * 0.18);
    g.fillStyle = "#5a38a8";
    for (let i = 0; i < 10; i++) {
      g.beginPath();
      g.arc((i * 31) % s, (i * 23) % s, 6 + (i % 3) * 2, 0, Math.PI * 2);
      g.fill();
    }
  });
  const gearMap = paintTex(128, (g, s) => {
    g.fillStyle = "#c5ced8";
    g.fillRect(0, 0, s, s);
    g.strokeStyle = "#8a96a4";
    g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(0, (i * s) / 4);
      g.lineTo(s, (i * s) / 4);
      g.stroke();
    }
    g.fillStyle = "#6a7482";
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc(24 + (i % 3) * 40, 28 + Math.floor(i / 3) * 56, 5, 0, Math.PI * 2);
      g.fill();
    }
  });
  const yarnMap = paintTex(128, (g, s) => {
    g.fillStyle = "#f3d7c4";
    g.fillRect(0, 0, s, s);
    g.strokeStyle = "#e7b8a4";
    g.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.arc(s * 0.5, s * 0.5, 8 + i * 8, i * 0.4, i * 0.4 + 4.2);
      g.stroke();
    }
    g.strokeStyle = "#c98474";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(s * 0.5, s * 0.5, 36, 0.2, 2.4);
    g.stroke();
  });
  const donutMap = paintTex(128, (g, s) => {
    g.fillStyle = "#e7b07a";
    g.fillRect(0, 0, s, s);
    g.fillStyle = "#f4a0c0";
    g.fillRect(0, s * 0.28, s, s * 0.38);
    const bits = ["#ff4d6a", "#ffd24a", "#4ec8ff", "#7adf5a", "#fff"];
    bits.forEach((color, i) => {
      g.fillStyle = color;
      g.fillRect(16 + (i * 22) % 100, 42 + (i % 3) * 12, 7, 7);
    });
  });
  const melonMap = paintTex(256, (g, s) => {
    const img = g.createImageData(s, s);
    const dark = [18, 90, 36];
    const light = [70, 160, 64];
    const bands = 12;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const band = Math.floor((x / s) * bands) % 2;
        const col = band ? light : dark;
        const n = ((x * 13 + y * 7) % 11) - 5;
        const i = (y * s + x) * 4;
        img.data[i] = col[0] + n;
        img.data[i + 1] = col[1] + n;
        img.data[i + 2] = col[2] + (n >> 1);
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
  const discoMap = paintTex(128, (g, s) => {
    const tiles = ["#1a1c28", "#f2f4f8", "#d4dde8", "#8aa0b8", "#f7f1c8", "#c9d4e4"];
    const cell = s / 8;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        g.fillStyle = tiles[(x * 3 + y * 5) % tiles.length];
        g.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
      }
    }
  });
  const luckyMap = paintTex(128, (g, s) => {
    g.fillStyle = "#c4363a";
    g.fillRect(0, 0, s, s);
    g.fillStyle = "#f2c14a";
    g.fillRect(0, s * 0.42, s, s * 0.16);
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.18);
    g.lineTo(s * 0.62, s * 0.42);
    g.lineTo(s * 0.38, s * 0.42);
    g.fill();
  });
  const catMap = paintTex(128, (g, s) => {
    g.fillStyle = "#c9a27a";
    g.fillRect(0, 0, s, s);
    g.strokeStyle = "#8c6848";
    g.lineWidth = 3;
    g.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      const x = 12 + ((i * 37) % 104);
      const y = 16 + ((i * 19) % 96);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 6, y - 8, x + 2, y - 14);
      g.stroke();
    }
  });
  const pixelMap = paintTex(32, (g, s) => {
    const cols = ["#3a6cff", "#ffd24a", "#ff5a5a", "#6adf55", "#1a2040"];
    const n = 8;
    const cell = s / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const edge = x < 1 || y < 1 || x > 6 || y > 6;
        g.fillStyle = edge ? "#1a2040" : cols[(x + y * 2) % 4];
        g.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  });
  pixelMap.magFilter = THREE.NearestFilter;
  pixelMap.minFilter = THREE.NearestFilter;
  pixelMap.generateMipmaps = false;
  const globeMap = paintTex(128, (g, s) => {
    g.fillStyle = "#2f78d0";
    g.fillRect(0, 0, s, s);
    g.fillStyle = "#3d9a4a";
    const blobs = [[28, 40, 18, 12], [70, 36, 22, 14], [48, 78, 26, 12], [96, 70, 14, 10]];
    for (const [x, y, rx, ry] of blobs) {
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0.2, 0, Math.PI * 2);
      g.fill();
    }
  });
  const skullMap = paintTex(128, (g, s) => {
    g.fillStyle = "#efe8dc";
    g.fillRect(0, 0, s, s);
    g.fillStyle = "#2a1838";
    g.beginPath();
    g.ellipse(s * 0.36, s * 0.42, 14, 16, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.64, s * 0.42, 14, 16, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.52);
    g.lineTo(s * 0.44, s * 0.66);
    g.lineTo(s * 0.56, s * 0.66);
    g.fill();
  });
  return {
    oak: std({ map: makeOakBallMap(), color: 0xffffff, roughness: 0.52, metalness: 0.04 }),
    marble: new THREE.MeshPhysicalMaterial({
      map: marbleMap,
      color: 0xffffff,
      roughness: 0.08,
      metalness: 0.06,
      clearcoat: 0.7,
      clearcoatRoughness: 0.12,
    }),
    soccer: std({ map: soccerMap, color: 0xffffff, roughness: 0.58, metalness: 0.02 }),
    tire: std({ map: tireMap, color: 0xffffff, roughness: 0.92, metalness: 0.02 }),
    slime: std({
      color: 0x3dcf4a,
      roughness: 0.22,
      metalness: 0.0,
      transparent: true,
      opacity: 0.82,
      emissive: 0x145c22,
      emissiveIntensity: 0.25,
    }),
    basketball: std({ map: hoopMap, color: 0xffffff, roughness: 0.62, metalness: 0.02 }),
    bowling: std({ map: bowlMap, color: 0xffffff, roughness: 0.32, metalness: 0.28 }),
    meteor: std({
      map: meteorMap,
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.08,
      emissive: 0xff6a18,
      emissiveIntensity: 0.45,
    }),
    dune: std({ map: duneMap, color: 0xffffff, roughness: 0.88, metalness: 0.02 }),
    snow: std({ map: snowMap, color: 0xffffff, roughness: 0.55, emissive: 0xd0e8ff, emissiveIntensity: 0.18 }),
    beach: std({ map: beachMap, color: 0xffffff, roughness: 0.48, metalness: 0.02 }),
    toy: std({ map: toyMap, color: 0xffffff, roughness: 0.42, metalness: 0.02 }),
    mushroom: std({ map: mushMap, color: 0xffffff, roughness: 0.52, metalness: 0.02 }),
    gummy: std({
      color: 0xff5a9a,
      roughness: 0.22,
      metalness: 0.0,
      transparent: true,
      opacity: 0.86,
      emissive: 0xff4d88,
      emissiveIntensity: 0.22,
    }),
    coco: std({ map: cocoMap, color: 0xffffff, roughness: 0.74, metalness: 0.04 }),
    alien: std({
      map: alienMap,
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0.0,
      transparent: true,
      opacity: 0.92,
      emissive: 0x6a3ad0,
      emissiveIntensity: 0.35,
    }),
    gear: std({ map: gearMap, color: 0xffffff, roughness: 0.32, metalness: 0.72 }),
    baseball: std({ map: baseballMap, color: 0xffffff, roughness: 0.58, metalness: 0.02 }),
    tennis: std({ map: tennisMap, color: 0xffffff, roughness: 0.86, metalness: 0.0 }),
    golf: std({ map: golfMap, color: 0xffffff, roughness: 0.42, metalness: 0.04 }),
    yarn: std({ map: yarnMap, color: 0xffffff, roughness: 0.78, metalness: 0.0 }),
    donut: std({ map: donutMap, color: 0xffffff, roughness: 0.48, metalness: 0.02 }),
    melon: std({ map: melonMap, color: 0xffffff, roughness: 0.62, metalness: 0.02 }),
    disco: new THREE.MeshPhysicalMaterial({
      map: discoMap,
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.82,
      clearcoat: 0.45,
      clearcoatRoughness: 0.18,
    }),
    lucky: std({ map: luckyMap, color: 0xffffff, roughness: 0.55, metalness: 0.08 }),
    cat: std({ map: catMap, color: 0xffffff, roughness: 0.9, metalness: 0.0 }),
    pixel: std({ map: pixelMap, color: 0xffffff, roughness: 0.7, metalness: 0.0 }),
    globe: std({ map: globeMap, color: 0xffffff, roughness: 0.4, metalness: 0.06 }),
    skull: std({
      map: skullMap,
      color: 0xffffff,
      roughness: 0.48,
      metalness: 0.04,
      emissive: 0x6a30a0,
      emissiveIntensity: 0.18,
    }),
  };
}

function makeSoftDot() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.85)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
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
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.12;

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

  applyStudio(renderer, scene, 0.4);

  const frameLowMat = new THREE.MeshStandardMaterial({ color: 0x1c6e28, roughness: 0.48, metalness: 0.04 });
  const frameMidMat = new THREE.MeshStandardMaterial({ color: 0x3fb83a, roughness: 0.32, metalness: 0.06 });
  const frameHiMat = new THREE.MeshStandardMaterial({ color: 0xb6f59a, roughness: 0.18, metalness: 0.05 });
  const frameGlossMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    toneMapped: false,
  });
  const frameInkMat = new THREE.MeshBasicMaterial({ color: 0x141414, toneMapped: false });
  const edgeMap = woodCanvas("#c88840", "#6a3a16", "#f2c48a", 18);
  const floorEdgeMat = new THREE.MeshStandardMaterial({ map: edgeMap, roughness: 0.78, metalness: 0.02 });
  let activeTheme = themeById("wood");
  const boardMats = new Map();
  function floorTopMaterial(n) {
    const key = `${activeTheme.id}:${n}`;
    let mat = boardMats.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        map: makeBoardTexture(n, activeTheme),
        roughness: 0.74,
        metalness: 0.02,
      });
      boardMats.set(key, mat);
    }
    return mat;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MOTE_N = 14;
  const motePos = new Float32Array(MOTE_N * 3);
  const moteSeed = [];
  for (let i = 0; i < MOTE_N; i++) {
    moteSeed.push({
      a: (i / MOTE_N) * Math.PI * 2,
      r: 2.2 + (i % 5) * 0.55,
      y: 1.1 + (i % 4) * 0.45,
      s: 0.35 + (i % 3) * 0.2,
    });
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xe7c48a,
    size: 0.09,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  scene.add(motes);
  let storm = false;
  function layoutMotes(t) {
    for (let i = 0; i < MOTE_N; i++) {
      const s = moteSeed[i];
      const spin = t * (storm ? 0.15 : 0.12) * s.s;
      if (storm) {
        const x = ((s.a * 1.4 + t * 0.55 * s.s) % 8) - 4;
        motePos[i * 3] = x;
        motePos[i * 3 + 1] = s.y + Math.sin(s.a) * 0.2;
        motePos[i * 3 + 2] = Math.sin(s.a * 2) * 2.4;
      } else {
        motePos[i * 3] = Math.cos(s.a + spin) * s.r;
        motePos[i * 3 + 1] = s.y + Math.sin(spin * 2 + i) * 0.12;
        motePos[i * 3 + 2] = Math.sin(s.a + spin) * s.r;
      }
    }
    moteGeo.attributes.position.needsUpdate = true;
  }
  layoutMotes(0);
  function applyTheme(id) {
    activeTheme = themeById(id);
    const pal = framePalette(activeTheme);
    frameLowMat.color.setHex(pal.low);
    frameMidMat.color.setHex(pal.mid);
    frameHiMat.color.setHex(pal.hi);
    floorEdgeMat.color.setHex(activeTheme.edge);
    moteMat.color.set(activeTheme.mote);
    storm = !!activeTheme.storm;
    if (reduceMotion) layoutMotes(0);
  }

  const ballMaterials = makeBallMaterials();
  let equipped = ballById("oak");
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
        roughness: 0.38,
        metalness: 0.04,
      });
    }
    return wallMats[key];
  }
  function gateMaterial(name) {
    return wallMaterial(name);
  }
  const wallLitMats = {};
  const wallDimMats = {};
  function wallTone(store, table, rough) {
    return (name) => {
      const key = GEM_HEX[name] ? name : "red";
      if (!store[key]) {
        store[key] = new THREE.MeshStandardMaterial({
          color: table[key],
          roughness: rough,
          metalness: 0.04,
        });
      }
      return store[key];
    };
  }
  const wallLit = wallTone(wallLitMats, GEM_LIT, 0.22);
  const wallDim = wallTone(wallDimMats, GEM_DIM, 0.55);

  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    new THREE.MeshBasicMaterial({ map: makeBlobMap(), transparent: true, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = -0.42;
  world.add(blob);

  const ballRoot = new THREE.Group();
  const ballSpin = new THREE.Group();
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), ballMaterials.oak);
  const ballInk = new THREE.Mesh(ballMesh.geometry, inkOutlineMaterial());
  ballInk.scale.setScalar(1.07);
  ballInk.raycast = () => {};
  ballMesh.add(ballInk);
  ballMesh.castShadow = true;
  ballSpin.add(ballMesh);
  const sportMarks = addSportMarks(ballSpin);
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

  const DECALS = 16;
  const TRAIL_N = 20;
  const HEADING = { right: 0, left: Math.PI, down: -Math.PI / 2, up: Math.PI / 2 };
  const fxGroup = new THREE.Group();
  const goalGroup = new THREE.Group();
  fxGroup.frustumCulled = false;
  goalGroup.frustumCulled = false;
  rig.add(fxGroup, goalGroup);
  const decalGeo = new THREE.CircleGeometry(0.18, 12);
  const decals = Array.from({ length: DECALS }, () => {
    const mesh = new THREE.Mesh(
      decalGeo,
      new THREE.MeshBasicMaterial({
        color: 0x16110e,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.DoubleSide,
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    const group = new THREE.Group();
    group.add(mesh);
    group.visible = false;
    group.frustumCulled = false;
    fxGroup.add(group);
    return { group, mesh, life: 0, max: 1, base: 0.7, kind: "tire" };
  });
  const trailPos = new Float32Array(TRAIL_N * 3);
  const trailCol = new Float32Array(TRAIL_N * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCol, 3));
  const trailMat = new THREE.PointsMaterial({
    size: 0.46,
    map: makeSoftDot(),
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    sizeAttenuation: true,
  });
  const treadMap = paintTex(128, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = "rgba(20, 12, 8, 0.94)";
    g.beginPath();
    g.roundRect(4, 6, s - 8, s - 12, 14);
    g.fill();
    g.strokeStyle = "rgba(120, 104, 86, 0.95)";
    g.lineWidth = 8;
    for (let x = 24; x < s - 8; x += 28) {
      g.beginPath();
      g.moveTo(x, 12);
      g.lineTo(x, s - 12);
      g.stroke();
    }
  });
  const trailPoints = new THREE.Points(trailGeo, trailMat);
  trailPoints.renderOrder = 3;
  trailPoints.frustumCulled = false;
  fxGroup.add(trailPoints);
  const trails = Array.from({ length: TRAIL_N }, () => ({
    x: 0, y: -40, z: 0, vy: 0, life: 0, max: 1, r: 1, g: 1, b: 1,
  }));
  for (let i = 0; i < TRAIL_N; i++) trailPos[i * 3 + 1] = -50;
  let stamp = 0;
  let holeCell = null;
  let pinT = 0;
  let propT = 0;
  let reactHold = null;
  const pins = [];
  const goalKit = createGoalKit(ballMaterials);

  const buttons = [];
  const glasses = [];
  const colored = [];
  const fogWalls = [];
  const smogs = [];
  const coins = [];
  const pits = [];
  const shifters = [];
  const magmas = [];
  let stockHole = null;
  let snowGrow = 1;
  let yarnScale = 1;
  let trailPick = "none";
  let celePick = "burst";
  let pawMesh = null;
  let pawT = 0;
  let danceT = 0;
  let footSide = 1;
  let hue = 0;
  let pixelI = 0;
  let noteFlip = 0;
  const trailTint = new THREE.Color();
  const PIXEL_HEX = [0xff5a5a, 0xffd24a, 0x4ec8ff, 0x6adf55];
  const SPRINKLE_HEX = [0xff4d6a, 0xffd24a, 0x4ec8ff, 0x7adf5a, 0xc07aff];
  const dancerMat = new THREE.MeshStandardMaterial({ color: 0xff8ab0, roughness: 0.45 });
  const dancerInk = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.5 });
  const dancer = new THREE.Group();
  dancer.frustumCulled = false;
  dancer.visible = false;
  const dancerHead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), dancerMat);
  dancerHead.position.y = 0.4;
  const dancerBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.1), dancerInk);
  dancerBody.position.y = 0.18;
  const dancerArmL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), dancerMat);
  dancerArmL.position.set(-0.13, 0.22, 0);
  const dancerArmR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), dancerMat);
  dancerArmR.position.set(0.13, 0.22, 0);
  dancer.add(dancerHead, dancerBody, dancerArmL, dancerArmR);
  scene.add(dancer);
  const magmaCalmMat = new THREE.MeshStandardMaterial({
    color: 0x5a2818,
    roughness: 0.86,
    emissive: 0x3a1208,
    emissiveIntensity: 0.2,
  });
  const magmaWarnMat = new THREE.MeshStandardMaterial({
    color: 0xffb020,
    emissive: 0xff6a10,
    emissiveIntensity: 0.7,
    roughness: 0.4,
  });
  const magmaHotMat = new THREE.MeshStandardMaterial({
    color: 0xff4a18,
    emissive: 0xff1a08,
    emissiveIntensity: 1.15,
    roughness: 0.45,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const magmaDiscGeo = new THREE.CircleGeometry(0.46, 22);
  const magmaRingGeo = new THREE.TorusGeometry(0.36, 0.07, 8, 24);
  const magmaCrustGeo = new THREE.CylinderGeometry(0.48, 0.42, 0.16, 18);
  let smogKeys = new Set();
  let visualReveal = new Set();
  const shiftCanvas = document.createElement("canvas");
  shiftCanvas.width = 64;
  shiftCanvas.height = 64;
  {
    const g = shiftCanvas.getContext("2d");
    g.fillStyle = "#2c2158";
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = "#f2c14a";
    for (let i = -64; i < 96; i += 18) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 8, 0);
      g.lineTo(i + 28, 64);
      g.lineTo(i + 20, 64);
      g.fill();
    }
  }
  const shiftMap = new THREE.CanvasTexture(shiftCanvas);
  shiftMap.colorSpace = THREE.SRGBColorSpace;
  const shiftMat = new THREE.MeshStandardMaterial({ map: shiftMap, color: 0xffffff, roughness: 0.45, metalness: 0.04 });
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
  let useBloom = false;
  let bloomFx = null;
  let bloomHeld = false;
  let bloomWarm = 0;
  let bloomSamples = [];
  let bloomLast = 0;
  let onBloomHeld = null;
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

  function measuredCanvas() {
    return {
      w: canvas.clientWidth || canvas.parentElement?.clientWidth || 300,
      h: canvas.clientHeight || canvas.parentElement?.clientHeight || 300,
    };
  }

  function cssPx(name) {
    if (typeof document === "undefined") return 0;
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }

  // The HUD publishes the free rectangle between the top bar and the D-pad.
  // Until that exists, fit the camera to the canvas the same way as before.
  function boardFitSize() {
    const api = typeof window !== "undefined" ? window.RB_LAYOUT : null;
    if (api && typeof api.boardRect === "function") {
      try {
        const rect = api.boardRect();
        if (rect && rect.width > 2 && rect.height > 2) return { w: rect.width, h: rect.height };
      } catch {
        /* publisher not ready */
      }
    }
    const span = cssPx("--dpad-top") - cssPx("--hud-bottom");
    if (span > 2) {
      const box = canvas.parentElement?.getBoundingClientRect();
      const w = box && box.width > 2 ? box.width : measuredCanvas().w;
      return { w, h: span };
    }
    return measuredCanvas();
  }

  function frameCamera() {
    const fit = boardFitSize();
    const w = fit.w;
    const h = fit.h;
    const aspect = w / Math.max(1, h);
    const fov = 28;
    camera.fov = fov;
    camera.aspect = aspect;
    const vFov = THREE.MathUtils.degToRad(fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const half = viewHalf;
    // 82° from the floor: near top-down, still enough pitch that screen-up
    // stays the board's -Z (the "up" tilt). A tall free rectangle fits the
    // width and leaves vertical bands for the trim. A short one (375×667,
    // where the free height is under the width) fits the height instead,
    // and the trim moves into the side gutters.
    const elev = THREE.MathUtils.degToRad(82);
    const sinE = Math.sin(elev);
    const cosE = Math.cos(elev);
    const sideGutters = h + 1 < w;
    const fillW = sideGutters ? 1 : 0.98;
    const fillH = sideGutters ? 0.93 : 0.74;
    const distW = half / (fillW * Math.tan(hFov / 2)) + half * cosE;
    const distH = (half * sinE) / (fillH * Math.tan(vFov / 2)) + half * cosE;
    const dist = sideGutters ? distH : Math.max(distW, distH);
    layoutDeco(rig.getObjectByName("board-deco"), sideGutters ? "sides" : "frame", half);
    const lookY = 0.42;
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
      if (
        child === ballRoot || child === sparks || child === hintGroup || child === hintRoute
        || child === fxGroup || child === goalGroup
      ) continue;
      dropChild(child);
    }
    buttons.length = 0;
    glasses.length = 0;
    colored.length = 0;
    fogWalls.length = 0;
    smogs.length = 0;
    coins.length = 0;
    pits.length = 0;
    shifters.length = 0;
    magmas.length = 0;
    beginTricks();
    beginDeco();
    stockHole = null;
    smogKeys = new Set();
    visualReveal = new Set();
  }

  function placeBall(r, c, y = BALL_Y) {
    const p = cellXZ(r, c);
    ballRoot.position.set(p.x, y, p.z);
    contact.position.set(p.x, BOARD_TOP + 0.02, p.z);
  }

  function trailKind() {
    if (trailPick && trailPick !== "none") return trailPick;
    return equipped.trail;
  }

  function setTrail(id) {
    const item = trailById(id);
    trailPick = item.kind || "none";
    clearFx();
  }

  function setCelebration(id) {
    celePick = celebrationById(id).id;
  }

  function clearFx() {
    stamp = 0;
    snowGrow = 1;
    yarnScale = 1;
    pawT = 0;
    danceT = 0;
    dancer.visible = false;
    if (pawMesh) pawMesh.rotation.x = -0.55;
    for (const d of decals) {
      d.life = 0;
      d.group.visible = false;
    }
    for (let i = 0; i < trails.length; i++) {
      trails[i].life = 0;
      trailPos[i * 3 + 1] = -50;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;
  }

  function spawnDecal(x, z, dir, kind) {
    let slot = decals[0];
    for (const d of decals) if (d.life < slot.life) slot = d;
    slot.kind = kind;
    const longLife = kind === "scorch" || kind === "yarn" || kind === "tire";
    slot.life = longLife ? (kind === "scorch" ? 3 : 2.4) : kind === "pixel" ? 0.85 : 1.6;
    slot.max = slot.life;
    const mat = slot.mesh.material;
    const nextMap = kind === "tire" ? treadMap : null;
    if (mat.map !== nextMap) {
      mat.map = nextMap;
      mat.needsUpdate = true;
    }
    let px = x;
    let pz = z;
    slot.group.rotation.y = HEADING[dir] || 0;
    if (kind === "tire") {
      mat.color.setHex(0xffffff);
      slot.base = 0.95;
      slot.mesh.scale.set(2.6, 1.45, 1);
    } else if (kind === "splat" || kind === "fur") {
      mat.color.setHex(kind === "fur" ? 0x8c5a38 : 0x2fbf3e);
      slot.base = kind === "fur" ? 0.9 : 0.8;
      const s = kind === "fur" ? 0.95 + Math.random() * 0.4 : 1.05 + Math.random() * 0.45;
      slot.mesh.scale.set(s, s * (0.85 + Math.random() * 0.3), 1);
      slot.group.rotation.y = Math.random() * Math.PI;
    } else if (kind === "yarn") {
      mat.color.setHex(0xe09080);
      slot.base = 0.95;
      slot.mesh.scale.set(1.85, 0.9, 1);
    } else if (kind === "fleck") {
      mat.color.setHex(SPRINKLE_HEX[Math.floor(Math.random() * SPRINKLE_HEX.length)]);
      slot.base = 0.95;
      slot.mesh.scale.set(0.62, 0.62, 1);
      slot.group.rotation.y = Math.random() * Math.PI;
    } else if (kind === "seed") {
      mat.color.setHex(0x1a1208);
      slot.base = 0.9;
      slot.mesh.scale.set(0.42, 0.28, 1);
      slot.group.rotation.y = Math.random() * Math.PI;
    } else if (kind === "sprinkle") {
      mat.color.setHex(SPRINKLE_HEX[Math.floor(Math.random() * SPRINKLE_HEX.length)]);
      slot.base = 0.95;
      slot.mesh.scale.set(0.32, 0.32, 1);
      slot.group.rotation.y = Math.random() * Math.PI;
    } else if (kind === "pixel") {
      mat.color.setHex(PIXEL_HEX[pixelI % PIXEL_HEX.length]);
      pixelI += 1;
      slot.base = 0.95;
      slot.mesh.scale.set(0.72, 0.72, 1);
      slot.group.rotation.y = 0;
    } else if (kind === "foot") {
      mat.color.setHex(0xc4a882);
      slot.base = 0.75;
      slot.mesh.scale.set(0.5, 1.05, 1);
      const lat = footSide * 0.08;
      footSide = -footSide;
      if (dir === "right" || dir === "left") pz += lat;
      else px += lat;
    } else {
      mat.color.setHex(0x1a0c08);
      slot.base = 0.8;
      slot.mesh.scale.set(2.15, 1.7, 1);
    }
    mat.opacity = slot.base;
    slot.group.position.set(px, BOARD_TOP + 0.05, pz);
    slot.group.visible = true;
  }

  function spawnPoint(x, z, kind) {
    let slot = trails[0];
    for (const p of trails) if (p.life < slot.life) slot = p;
    slot.x = x + (Math.random() - 0.5) * 0.1;
    slot.z = z + (Math.random() - 0.5) * 0.1;
    slot.y = kind === "flame" || kind === "smoke" ? BOARD_TOP + 0.32 : BOARD_TOP + 0.24;
    slot.vy = kind === "flame" ? 0.85 + Math.random() * 0.35
      : kind === "smoke" ? 0.7 + Math.random() * 0.4
      : kind === "coin" ? 0.08
      : 0.18;
    slot.life = kind === "flame" ? 0.7 : kind === "sparkle" ? 0.65 : 1.25;
    slot.max = slot.life;
    if (kind === "flame") {
      slot.r = 1;
      slot.g = 0.42 + Math.random() * 0.4;
      slot.b = 0.05;
    } else if (kind === "rainbow") {
      hue = (hue + 0.17) % 1;
      trailTint.setHSL(hue, 0.82, 0.58);
      slot.r = trailTint.r;
      slot.g = trailTint.g;
      slot.b = trailTint.b;
    } else if (kind === "hearts") {
      slot.r = 1;
      slot.g = 0.42 + Math.random() * 0.12;
      slot.b = 0.62;
    } else if (kind === "notes") {
      noteFlip = 1 - noteFlip;
      slot.r = noteFlip ? 0.35 : 1;
      slot.g = noteFlip ? 0.62 : 0.82;
      slot.b = noteFlip ? 1 : 0.28;
    } else if (kind === "fleck") {
      trailTint.setHSL(Math.random(), 0.72, 0.58);
      slot.r = trailTint.r;
      slot.g = trailTint.g;
      slot.b = trailTint.b;
    } else if (kind === "coin") {
      slot.r = 1;
      slot.g = 0.78;
      slot.b = 0.22;
    } else if (kind === "smoke") {
      slot.r = 0.55 + Math.random() * 0.15;
      slot.g = 0.28;
      slot.b = 0.85;
    } else {
      slot.r = 0.9;
      slot.g = 0.97;
      slot.b = 1;
    }
  }

  function dropTrail(x, z, dir, traveled) {
    const kind = trailKind();
    if (!kind || traveled <= 0) return;
    const gap = kind === "yarn" ? 0.12 : kind === "tire" ? 0.22 : kind === "splat" ? 0.24 : 0.18;
    const dx = dir === "right" ? traveled : dir === "left" ? -traveled : 0;
    const dz = dir === "down" ? traveled : dir === "up" ? -traveled : 0;
    const x0 = x - dx;
    const z0 = z - dz;
    let cursor = gap - stamp;
    if (cursor > traveled) {
      stamp += traveled;
      return;
    }
    while (cursor <= traveled + 1e-4) {
      const t = Math.min(1, cursor / traveled);
      layMark(kind, x0 + dx * t, z0 + dz * t, dir);
      cursor += gap;
    }
    stamp = Math.max(0, traveled - (cursor - gap));
  }

  function layMark(kind, x, z, dir) {
    if (kind === "tire") spawnDecal(x, z, dir, "tire");
    else if (kind === "splat") spawnDecal(x, z, dir, "splat");
    else if (kind === "yarn") spawnDecal(x, z, dir, "yarn");
    else if (kind === "sprinkle") spawnDecal(x, z, dir, "sprinkle");
    else if (kind === "seed") spawnDecal(x, z, dir, "seed");
    else if (kind === "fur") spawnDecal(x, z, dir, "fur");
    else if (kind === "pixel") spawnDecal(x, z, dir, "pixel");
    else if (kind === "footprints") spawnDecal(x, z, dir, "foot");
    else if (kind === "fleck") {
      spawnDecal(x, z, dir, "fleck");
      spawnPoint(x, z, "fleck");
    } else if (kind === "sparkle" || kind === "rainbow" || kind === "hearts" || kind === "notes" || kind === "coin" || kind === "smoke") {
      spawnPoint(x, z, kind);
    } else if (kind === "flame") {
      spawnPoint(x, z, "flame");
      spawnDecal(x, z, dir, "scorch");
    }
  }

  function emptyGoal() {
    if (typeof goalGroup.userData.play === "function") goalGroup.userData.play(0, 0, 0);
    const geos = new Set();
    goalGroup.traverse((node) => {
      if (node.userData.ownGeo && node.geometry) geos.add(node.geometry);
    });
    geos.forEach((geo) => geo.dispose());
    goalGroup.clear();
    goalGroup.userData.play = null;
    goalGroup.userData.idle = null;
    pins.length = 0;
    pinT = 0;
    pawMesh = null;
    pawT = 0;
    propT = 0;
    reactHold = null;
  }

  function dressGoal() {
    emptyGoal();
    const custom = !!(holeCell && equipped.goal);
    if (stockHole) stockHole.visible = !custom;
    if (!custom) return;
    const spot = cellXZ(holeCell[0], holeCell[1]);
    goalGroup.position.set(spot.x, 0, spot.z);
    const tuck = holeCell[0] === 0;
    const edge = holeCell[1] === 0 ? "left" : holeCell[1] === n - 1 ? "right" : "";
    const built = mountGoal(goalGroup, equipped.goal, goalKit, { theme: activeTheme, tuck, edge, zoom: tuck ? 1 : 1.32 });
    pins.push(...built.pins);
    pawMesh = built.paw;
  }

  let mapsReady = false;
  function dressBallSkin() {
    ballMesh.material = ballMaterials[equipped.id] || ballMaterials.oak;
    const textured = mapsReady && (equipped.id === "baseball" || equipped.id === "tennis");
    sportMarks.show(textured ? "" : equipped.id);
  }

  function setBall(id) {
    equipped = ballById(id);
    dressBallSkin();
    clearFx();
    dressGoal();
  }

  loadSphereMaps().then((maps) => {
    applyBallMaps(ballMaterials, maps);
    mapsReady = true;
    dressBallSkin();
  }).catch((err) => {
    console.error(err);
  });

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
    applyTheme(level.planet);
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
    holeCell = level.hole;
    clearHint();
    clearRig();
    clearFx();
    const span = n * STEP;
    const inner = span / 2 - 0.02;
    // 6×6 is the look the trim was drawn for. Thickness and margin track
    // the board so 3×3 through 8×8 keep the same frame weight on screen.
    const unit = n / 6;
    const frameT = FRAME_T * unit;
    const frameH = FRAME_H * unit;
    const outer = inner + frameT;
    const skirt = 0.22 * unit;
    viewHalf = outer + skirt + 0.04 * unit;
    const outerW = outer * 2;
    const holeW = inner * 2;
    const outerR = Math.min(frameT * 0.9, outer * 0.46);
    const innerR = Math.min(frameT * 0.58, inner * 0.34);
    const addRing = (ow, iw, oR, iR, height, mat, y) => {
      const mesh = new THREE.Mesh(frameRingGeo(ow, iw, oR, iR, height), mat);
      mesh.position.y = y;
      mesh.userData.ownGeo = true;
      mesh.castShadow = false;
      mesh.receiveShadow = mat !== frameInkMat;
      rig.add(mesh);
    };
    addRing(outerW + skirt * 2, outerW - skirt * 0.15, outerR + skirt * 0.7, Math.max(0.08, outerR * 0.9), frameH * 0.5, frameInkMat, 0);
    addRing(outerW, holeW, outerR, innerR, frameH, frameMidMat, 0.02);
    addRing(outerW - 0.02 * unit, outerW - frameT * 0.36, outerR * 0.92, Math.max(0.08, outerR * 0.72), frameH * 0.14, frameHiMat, 0.03 + frameH * 0.88);
    addRing(holeW + 0.18 * unit, holeW + 0.015 * unit, Math.max(0.08, innerR * 0.82), Math.max(0.05, innerR * 0.32), frameH * 0.12, frameLowMat, 0.035 + frameH * 0.92);
    addRing(outerW + skirt * 2, outerW - 0.03 * unit, outerR + skirt * 0.55, Math.max(0.08, outerR * 0.96), frameH * 0.12, frameInkMat, 0.04 + frameH * 0.92);
    if (decoWanted()) rig.add(createBoardDeco(level.planet || activeTheme.id, span, frameT));

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
        w: axis === "h" ? STEP * 0.98 : WALL_T,
        d: axis === "h" ? WALL_T : STEP * 0.98,
      };
    };

    const addEdge = (axis, r, c, kind, color) => {
      const { x, z, w, d } = placeEdge(axis, r, c);
      const mat = kind === "glass" ? glassMat : kind === "color" ? gateMaterial(color) : wallMaterial(color);
      const group = new THREE.Group();
      group.position.set(x, WALL_Y, z);
      let mesh;
      if (kind === "wall") {
        const longX = w >= d;
        const len = longX ? w : d;
        const thick = Math.max(longX ? d : w, WALL_T);
        const bw = longX ? len : thick;
        const bd = longX ? thick : len;
        const rad = Math.min(thick, WALL_H) * 0.46;
        const body = new THREE.Mesh(roundGeo(bw, WALL_H * 0.7, bd, 2, rad), mat);
        body.position.y = 0.03;
        body.castShadow = true;
        body.receiveShadow = true;
        const ink = new THREE.Mesh(body.geometry, inkOutlineMaterial());
        ink.scale.setScalar(1.16);
        ink.raycast = () => {};
        body.add(ink);
        const base = new THREE.Mesh(roundGeo(bw * 1.02, WALL_H * 0.34, bd * 1.04, 1, rad * 0.8), wallDim(color));
        base.position.y = -WALL_H * 0.22;
        const cap = new THREE.Mesh(roundGeo(bw * 0.9, WALL_H * 0.22, bd * 0.72, 1, rad * 0.55), wallLit(color));
        cap.position.set(longX ? -bw * 0.02 : 0, WALL_H * 0.32, longX ? 0 : -bd * 0.02);
        const shine = new THREE.Mesh(roundGeo(bw * 0.42, 0.035, bd * 0.28, 1, 0.012), frameGlossMat);
        shine.position.set(longX ? -bw * 0.16 : 0, WALL_H * 0.44, longX ? -bd * 0.08 : -bd * 0.16);
        const rim = new THREE.Mesh(roundGeo(bw * 1.08, 0.045, bd * 1.1, 1, rad * 0.7), frameInkMat);
        rim.position.y = WALL_H * 0.3;
        group.add(body, base, cap, shine, rim);
        mesh = body;
      } else {
        mesh = new THREE.Mesh(roundGeo(w, WALL_H, d, 2, 0.07), mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      mesh.userData = {
        kind,
        axis,
        r,
        c,
        color: color || null,
        fogCells: axis === "h" ? [[r, c], [r + 1, c]] : [[r, c], [r, c + 1]],
        ruleVisible: true,
      };
      rig.add(group);
      fogWalls.push(mesh);
      const skin = trickVariant(activeTheme.id);
      if (kind === "color") {
        dressGate(group, mesh, w, d, color || "red", skin);
        rig.add(makeGateGroove(x, z, w, d, color || "red"));
        colored.push(mesh);
      } else if (kind === "glass") {
        const fx = addCracks(group, w, WALL_H, d, r * 17 + c * 31 + (axis === "v" ? 7 : 0));
        mesh.userData.cracks = fx.cracks;
        mesh.userData.flash = fx.flash;
        dressGlass(group, mesh, w, d, skin);
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
    stockHole = new THREE.Group();
    stockHole.position.set(hx, 0, hz);
    addFloorSocket(stockHole, activeTheme);
    const accentMat = new THREE.MeshStandardMaterial({
      color: activeTheme.edge,
      roughness: 0.55,
      emissive: activeTheme.edge,
      emissiveIntensity: 0.06,
      envMapIntensity: 0.05,
    });
    const accent = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.012, 6, 32), accentMat);
    accent.rotation.x = Math.PI / 2;
    accent.position.y = BOARD_TOP + 0.02;
    accent.name = "hole-ring";
    accent.userData.ownMat = true;
    accent.userData.ownGeo = true;
    stockHole.add(accent);
    rig.add(stockHole);

    const skin = trickVariant(activeTheme.id);
    for (const btn of level.buttons || []) {
      const { x, z } = cellXZ(btn.row, btn.col);
      const color = GEM_HEX[btn.color] ? btn.color : "red";
      const mesh = makeButton(x, z, color, btn.row, btn.col, skin);
      rig.add(mesh);
      buttons.push(mesh);
    }

    const paintDisc = (r, c, color, radius, y, opacity = 1) => {
      const { x, z } = cellXZ(r, c);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.62,
        metalness: 0.04,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity >= 1,
      });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.045, 22), mat);
      mesh.position.set(x, y, z);
      mesh.userData.ownMat = true;
      mesh.userData.row = r;
      mesh.userData.col = c;
      rig.add(mesh);
      return mesh;
    };

    for (const [r, c] of level.sand || []) {
      const { x, z } = cellXZ(r, c);
      rig.add(makeSand(x, z, skin));
    }
    for (const [r, c] of level.jelly || []) {
      const { x, z } = cellXZ(r, c);
      rig.add(makeJelly(x, z, skin));
    }
    for (const [r, c] of level.ice || []) {
      const { x, z } = cellXZ(r, c);
      rig.add(makeIce(x, z, skin));
    }
    smogKeys = new Set((level.smog || []).map(([r, c]) => `${r},${c}`));
    for (const [r, c] of level.smog || []) {
      const { x, z } = cellXZ(r, c);
      const puff = makeSmog(x, z, r, c, skin);
      rig.add(puff);
      smogs.push(puff);
    }
    for (const [r, c] of level.coins || []) {
      const { x, z } = cellXZ(r, c);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xf0c22e,
        emissive: 0xc48a10,
        emissiveIntensity: 0.25,
        roughness: 0.35,
        metalness: 0.45,
      });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.09, 24), mat);
      mesh.position.set(x, BOARD_TOP + 0.12, z);
      mesh.userData = { ownMat: true, row: r, col: c };
      rig.add(mesh);
      coins.push(mesh);
    }
    (level.collapse || []).forEach(([r, c], i) => {
      const { x, z } = cellXZ(r, c);
      const mat = new THREE.MeshBasicMaterial({ color: 0x120c08 });
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, BOARD_TOP + 0.035, z);
      mesh.visible = false;
      mesh.userData = { ownMat: true, row: r, col: c, bit: 1 << i };
      rig.add(mesh);
      const crack = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.045, 8, 18),
        new THREE.MeshStandardMaterial({ color: 0x6a3a22, roughness: 0.7 })
      );
      crack.rotation.x = Math.PI / 2;
      crack.position.set(x, BOARD_TOP + 0.045, z);
      crack.userData = { ownMat: true, row: r, col: c, bit: 1 << i, crack: true };
      rig.add(crack);
      pits.push(mesh);
      pits.push(crack);
    });
    for (const vent of level.magma || []) {
      const { x, z } = cellXZ(vent[0], vent[1]);
      const group = makeMagma(x, z, vent[2], skin);
      rig.add(group);
      magmas.push(group);
    }
    for (const pair of level.teleports || []) {
      for (const [r, c] of pair) {
        const { x, z } = cellXZ(r, c);
        rig.add(makeTeleport(x, z, skin));
      }
    }
    for (const [axis, r, c, dir] of level.oneWay || []) {
      const { x, z } = placeEdge(axis, r, c);
      rig.add(makeCurrent(x, z, dir, skin));
    }
    const addShift = (spot, slot) => {
      const axis = spot[0];
      const r = spot[1];
      const c = spot[2];
      const { x, z, w, d } = placeEdge(axis, r, c);
      const group = new THREE.Group();
      group.position.set(x, WALL_Y, z);
      const mesh = new THREE.Mesh(roundGeo(w, WALL_H, d, 2, 0.05), shiftMat);
      mesh.castShadow = true;
      mesh.userData = {
        kind: "shift",
        axis,
        r,
        c,
        shiftSlot: slot,
        fogCells: axis === "h" ? [[r, c], [r + 1, c]] : [[r, c], [r, c + 1]],
        ruleVisible: slot === 0,
      };
      group.add(mesh);
      dressVine(group, mesh, w, d, skin);
      group.visible = slot === 0;
      rig.add(group);
      fogWalls.push(mesh);
      shifters.push(mesh);
    };
    for (const pair of level.shifters || []) {
      addShift(pair[0], 0);
      addShift(pair[1], 1);
    }

    visualReveal = new Set(game.revealed ? [...game.revealed] : [`${game.ball[0]},${game.ball[1]}`]);

    if (!ballRoot.parent) rig.add(ballRoot);
    if (!contact.parent) rig.add(contact);
    if (!sparks.parent) rig.add(sparks);
    squash = 1;
    ballRoot.scale.set(1, 1, 1);
    placeBall(game.ball[0], game.ball[1]);
    dressGoal();
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

  function edgeFogged(mesh) {
    const cells = mesh.userData.fogCells;
    if (!cells || !smogKeys.size) return false;
    return cells.some(([r, c]) => smogKeys.has(`${r},${c}`) && !visualReveal.has(`${r},${c}`));
  }

  function applyEdgeVisibility(mesh, ruleVisible) {
    if (ruleVisible !== undefined) mesh.userData.ruleVisible = ruleVisible;
    if (mesh.userData.opening) return;
    if (!mesh.parent) return;
    const show = mesh.userData.ruleVisible !== false && !edgeFogged(mesh);
    if (mesh.userData.kind === "shift" && mesh.userData.setPreview) {
      const preview = mesh.userData.ruleVisible === false && !edgeFogged(mesh);
      mesh.parent.visible = show || preview;
      mesh.userData.setPreview(preview && !show);
      return;
    }
    mesh.parent.visible = show;
  }

  function refreshFog() {
    for (const puff of smogs) {
      const key = `${puff.userData.row},${puff.userData.col}`;
      const covered = smogKeys.has(key) && !visualReveal.has(key);
      if (puff.userData.cover) {
        puff.visible = true;
        puff.userData.cover.visible = covered;
      } else {
        puff.visible = covered;
      }
    }
    for (const mesh of coins) {
      const key = `${mesh.userData.row},${mesh.userData.col}`;
      mesh.visible = !visualReveal.has(key);
    }
    for (const mesh of fogWalls) applyEdgeVisibility(mesh);
  }

  function showPit(r, c) {
    for (const pit of pits) {
      if (pit.userData.row === r && pit.userData.col === c) pit.visible = true;
    }
  }

  function triggerCell(path, index) {
    const cell = path[index];
    if (!cell) return;
    visualReveal.add(`${cell[0]},${cell[1]}`);
    if (index > 0) showPit(path[index - 1][0], path[index - 1][1]);
    refreshFog();
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
        color: (mesh && mesh.userData.shardColor) || 0xdffbff,
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

  function sync(game, { ready = true, animateGates = false, skipGlass = false, skipGates = false, adoptReveal = true, skipShift = false } = {}) {
    if (adoptReveal && game.revealed) visualReveal = new Set(game.revealed);
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
        const show = edgeAlive(grid, mesh.userData.r, mesh.userData.c)
          && !game.activatedColors.has(mesh.userData.color);
        if (!show && mesh.parent.visible && animateGates) {
          startOpen(mesh);
          continue;
        }
        applyEdgeVisibility(mesh, show);
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
        } else {
          mesh.material.transparent = true;
          mesh.material.opacity = 0.4;
          mesh.position.y = BOARD_TOP + 0.05;
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
        applyEdgeVisibility(mesh, alive && !mesh.parent.userData.shattered);
        if (alive && edgeAlive(stress, data.r, data.c)) showCrack(mesh, false);
      }
    }
    if (!skipShift) {
      const phase = game.phase & 1;
      for (const mesh of shifters) applyEdgeVisibility(mesh, mesh.userData.shiftSlot === phase);
      for (const pit of pits) {
        const gone = (game.collapse & pit.userData.bit) !== 0;
        pit.visible = pit.userData.crack ? true : gone;
      }
      const spent = game.tilts || 0;
      for (const group of magmas) {
        const hot = spent >= group.userData.at;
        const warn = !hot && spent === group.userData.at - 1;
        group.userData.calm.visible = !hot && !warn;
        group.userData.warn.visible = warn;
        group.userData.hot.visible = hot;
      }
    }
    for (const mesh of fogWalls) {
      if (mesh.userData.kind === "wall") applyEdgeVisibility(mesh, true);
    }
    refreshFog();
  }

  function nudge(dir) {
    const map = { up: [-0.26, 0], down: [0.26, 0], left: [0, 0.26], right: [0, -0.26] };
    const t = dir && map[dir] ? map[dir] : [0, 0];
    spring.tx = t[0];
    spring.tz = t[1];
  }

  function bump(amount = 1) {
    if (equipped.motion === "thud") {
      shake = Math.max(shake, 0.72);
      squash = 0.66;
      squashV = 5;
      return;
    }
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
      if (len > STEP * 1.5) {
        cursor = spacing * 0.65;
        continue;
      }
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
    const hop = [false];
    for (let i = 1; i < pts.length; i++) {
      const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      const far = len > STEP * 1.5;
      hop.push(far);
      cum.push(cum[i - 1] + (far ? STEP * 0.18 : len));
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
        path, pts, cum, hop, total, dur, t: 0, prevDist: 0, dir, intoHole,
        resolve, token: my, fx, triggered: [true], segHit: [],
      };
      triggerCell(path, 0);
    });
  }

  function sink(cell, my) {
    return new Promise((resolve) => {
      const p = cellXZ(cell[0], cell[1]);
      propT = 0.001;
      if (equipped.goal === "pins") pinT = 0.001;
      if (equipped.goal === "paw") pawT = 0.001;
      sinkJob = { token: my, t: 0, x: p.x, z: p.z, resolve };
      const palette = equipped.id === "melon"
        ? [[0.9, 0.15, 0.2], [0.25, 0.72, 0.28], [1, 0.86, 0.35], [0.95, 0.95, 0.9]]
        : [[1, 0.92, 0.4], [0.4, 1, 0.9], [1, 1, 1], [1, 0.5, 0.75]];
      burst(p.x, 0.7, p.z, 18, 2.4, palette);
    });
  }

  function showDancer() {
    danceT = 1.5;
    dancer.visible = true;
    dancer.position.set(viewHalf * 0.62, 1.15, -viewHalf * 0.05);
  }

  function celebrate(cell) {
    const p = cell ? cellXZ(cell[0], cell[1]) : { x: 0, z: 0 };
    const spark = [[1, 0.86, 0.25], [1, 1, 1], [1, 0.45, 0.65], [0.45, 1, 0.85], [0.55, 0.75, 1]];
    if (reduceMotion || celePick === "burst") {
      const n = reduceMotion ? 8 : 26;
      burst(p.x, reduceMotion ? 1.0 : 1.1, p.z, n, reduceMotion ? 1.6 : 3.4, spark);
      if (!reduceMotion) burst(0, 1.3, 0, 16, 2.6, spark);
      shake = Math.max(shake, reduceMotion ? 0.1 : 0.28);
      return;
    }
    if (celePick === "fireworks") {
      const cols = [[1, 0.35, 0.22], [1, 0.85, 0.25], [0.4, 0.7, 1], [1, 0.45, 0.75]];
      burst(p.x, 1.45, p.z, 12, 2.6, cols);
      burst(p.x + 0.55, 1.65, p.z - 0.2, 8, 2.1, cols);
      burst(p.x - 0.45, 1.25, p.z + 0.15, 8, 2.1, cols);
    } else if (celePick === "confetti") {
      burst(p.x, 1.55, p.z, 20, 1.5, [[1, 0.32, 0.38], [0.3, 0.7, 1], [1, 0.85, 0.25], [0.4, 0.9, 0.45], [0.8, 0.4, 1]]);
    } else if (celePick === "rainbow") {
      const hues = [[1, 0.25, 0.22], [1, 0.55, 0.15], [1, 0.9, 0.25], [0.3, 0.82, 0.35], [0.28, 0.55, 1], [0.58, 0.32, 0.95]];
      hues.forEach((col, i) => {
        const a = (i / hues.length) * Math.PI - Math.PI / 2;
        burst(p.x + Math.cos(a) * 0.5, 1.15 + Math.sin(a) * 0.15, p.z, 4, 1.6, [col]);
      });
    } else if (celePick === "dance") {
      burst(p.x, 1.0, p.z, 8, 1.6, [[1, 0.7, 0.82], [1, 0.9, 0.4]]);
      showDancer();
    } else {
      burst(p.x, 1.05, p.z, 22, 3.2, spark);
    }
    shake = Math.max(shake, 0.22);
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
    const snap = job.hop[seg];
    const x = snap ? (local < 0.45 ? a.x : b.x) : a.x + (b.x - a.x) * local;
    const z = snap ? (local < 0.45 ? a.z : b.z) : a.z + (b.z - a.z) * local;
    ballRoot.position.set(x, BALL_Y, z);
    contact.position.set(x, BOARD_TOP + 0.02, z);
    const traveled = Math.max(0, dist - job.prevDist);
    job.prevDist = dist;
    if (traveled > 0 && !snap) {
      ballSpin.rotateOnWorldAxis(moveAxis[job.dir] || moveAxis.right, traveled / BALL_R);
      dropTrail(x, z, job.dir, traveled);
      if (equipped.motion === "grow") snowGrow = Math.min(1.18, snowGrow + traveled * 0.04);
      if (equipped.motion === "yarn") yarnScale = Math.max(0.72, yarnScale - traveled * 0.045);
    }
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
      const stamp = performance.now();
      const dt = Math.min(0.033, Math.max(0, (stamp - last) / 1000));
      last = stamp;
      time += dt;
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
      const extra = equipped.motion === "grow" ? snowGrow : equipped.motion === "yarn" ? yarnScale : 1;
      if (!sinkJob) {
        if (rollJob && equipped.motion === "wobble") {
          const w = Math.sin(time * 22);
          ballRoot.scale.set((1.12 + w * 0.08) * extra, (0.82 - w * 0.06) * extra, (1.12 - w * 0.08) * extra);
        } else {
          ballRoot.scale.set(sx * extra, sy * extra, sx * extra);
        }
      }

      shake *= Math.exp(-7 * dt);
      const mag = shake * 0.04;
      world.position.x = Math.sin(time * 46) * mag;
      world.position.z = Math.cos(time * 37) * mag;

      const ring = rig.getObjectByName("hole-ring");
      if (ring) {
        ring.material.emissiveIntensity = 0.05 + Math.sin(time * 2.2) * 0.03;
      }

      if (rollJob) stepRoll(rollJob, dt);
      if (rollJob && !sinkJob && equipped.motion === "bounce") {
        const hop = Math.abs(Math.sin(rollJob.t * Math.PI * 6));
        ballRoot.position.y = BALL_Y + hop * 0.32;
      }
      if (!reduceMotion) layoutMotes(time);
      if (!reduceMotion) {
        tickTricks(time, dt);
        tickDeco(time);
      } else {
        tickTricks(time, 0);
      }
      magmaWarnMat.emissiveIntensity = 0.85 + Math.sin(time * 8) * 0.25;
      if (equipped.id === "globe" && !rollJob && !sinkJob) {
        ballSpin.rotateOnWorldAxis(upAxis, dt * 0.55);
      }
      if (reactHold != null) {
        propT = reactHold;
        if (pins.length) pinT = Math.min(0.999, reactHold / 1.05);
        if (pawMesh) pawT = Math.min(0.999, reactHold / 0.6);
      }
      if (goalGroup.userData.idle && propT <= 0) goalGroup.userData.idle(time);
      if (propT > 0) {
        if (reactHold == null) propT += dt;
        const u = propT;
        const env = u >= 0.16 && u < 0.76 ? Math.sin(((u - 0.16) / 0.6) * Math.PI) : 0;
        const wob = u > 0.16 && u < 0.95 ? Math.sin((u - 0.16) * 16) * Math.exp(-(u - 0.16) * 2.6) : 0;
        const play = goalGroup.userData.play;
        if (play) play(env, wob, Math.min(1, Math.max(0, (u - 0.12) / 0.78)));
        if (reactHold == null && u >= 1.15) {
          if (play) play(0, 0, 0);
          propT = 0;
        }
      }
      if (pawT > 0 && pawMesh) {
        if (reactHold == null) pawT += dt / 0.6;
        const k = Math.min(1, pawT);
        pawMesh.rotation.x = -0.55 + Math.sin(k * Math.PI) * 1.2;
        if (reactHold == null && pawT >= 1) {
          pawMesh.rotation.x = -0.55;
          pawT = 0;
        }
      }
      if (danceT > 0) {
        danceT -= dt;
        const bob = Math.sin(time * 10);
        dancer.position.y = 1.15 + Math.abs(bob) * 0.08;
        dancerArmL.rotation.z = 0.4 + bob * 0.9;
        dancerArmR.rotation.z = -0.4 - bob * 0.9;
        if (danceT <= 0) {
          danceT = 0;
          dancer.visible = false;
        }
      }
      if (pinT > 0 && reactHold == null) pinT += dt / 1.05;
      if (pinT > 0) {
        const k = Math.min(1, pinT);
        let fall = 1;
        if (k < 0.32) fall = k / 0.32;
        else if (k > 0.72) fall = Math.max(0, 1 - (k - 0.72) / 0.28);
        const e = fall * fall * (3 - 2 * fall);
        pins.forEach((pin, i) => {
          if (pin.userData.hx == null) {
            pin.userData.hx = pin.position.x;
            pin.userData.hz = pin.position.z;
          }
          const ang = (i / Math.max(1, pins.length)) * Math.PI * 2 + 0.5;
          pin.rotation.x = e * (1.05 + (i % 3) * 0.12);
          pin.rotation.z = (i % 2 ? -1 : 1) * e * 0.55;
          pin.position.x = pin.userData.hx + Math.cos(ang) * e * 0.16;
          pin.position.z = pin.userData.hz + Math.sin(ang) * e * 0.12;
        });
        if (reactHold == null && pinT >= 1) {
          pins.forEach((pin) => {
            pin.rotation.x = 0;
            pin.rotation.z = 0;
            if (pin.userData.hx != null) {
              pin.position.x = pin.userData.hx;
              pin.position.z = pin.userData.hz;
            }
          });
          pinT = 0;
        }
      }

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

      for (const d of decals) {
        if (d.life <= 0) continue;
        d.life -= dt;
        const k = Math.max(0, d.life / d.max);
        const fade = d.kind === "splat" ? k : Math.min(1, k / 0.3);
        d.mesh.material.opacity = d.base * fade;
        if (d.life <= 0) d.group.visible = false;
      }
      for (let i = 0; i < trails.length; i++) {
        const p = trails[i];
        if (p.life <= 0) {
          trailPos[i * 3 + 1] = -50;
          continue;
        }
        p.life -= dt;
        p.y += p.vy * dt;
        trailPos[i * 3] = p.x;
        trailPos[i * 3 + 1] = p.y;
        trailPos[i * 3 + 2] = p.z;
        const fade = Math.max(0, p.life / p.max);
        trailCol[i * 3] = p.r * fade;
        trailCol[i * 3 + 1] = p.g * fade;
        trailCol[i * 3 + 2] = p.b * fade;
      }
      trailGeo.attributes.position.needsUpdate = true;
      trailGeo.attributes.color.needsUpdate = true;

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

      if (useBloom && bloomFx) bloomFx.render(scene, camera);
      else renderer.render(scene, camera);
      if (useBloom && document.visibilityState === "visible") {
        const frameDt = now - bloomLast;
        if (bloomLast && frameDt > 0 && frameDt < 400) {
          bloomWarm += 1;
          if (bloomWarm > 24) bloomSamples.push(frameDt);
          if (bloomSamples.length >= 40) {
            const avg = bloomSamples.reduce((sum, ms) => sum + ms, 0) / bloomSamples.length;
            bloomSamples = [];
            if (avg > 18.5) {
              useBloom = false;
              bloomHeld = true;
              if (onBloomHeld) onBloomHeld();
            }
          }
        }
      }
      bloomLast = now;
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function setBloom(on) {
    useBloom = !!on;
    bloomHeld = false;
    bloomWarm = 0;
    bloomSamples = [];
    bloomLast = 0;
    if (useBloom && !bloomFx) bloomFx = createBloom(renderer);
  }

  return {
    resize, setStage, sync, roll, nudge, bump, dipButton, pick, celebrate, placeBall, showHint, clearHint, armGateOpen, setBall, setTrail, setCelebration,
    previewReact() {
      reactHold = null;
      propT = 0.001;
      if (pins.length) pinT = 0.001;
      if (pawMesh) pawT = 0.001;
    },
    holdReact(seconds) {
      reactHold = seconds;
      propT = Math.max(0.001, seconds);
      if (pins.length) pinT = Math.min(0.999, seconds / 1.05);
      if (pawMesh) pawT = Math.min(0.999, seconds / 0.6);
    },
    setBloom,
    bloomSuppressed: () => bloomHeld,
    onBloomSuppressed(fn) { onBloomHeld = fn; },
  };
}
