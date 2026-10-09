/** Reference-style board, drawn at device resolution so any grid stays sharp. */

const GEMS = {
  red: ["#ffe0da", "#ff6a58", "#e23a32", "#8e1822", "#ffd4cc", "#ff4d48"],
  blue: ["#dcedff", "#4c97ff", "#2156d6", "#16367a", "#e7f3ff", "#2f74ea"],
  green: ["#dcffe8", "#3dce6c", "#16944a", "#0c5c30", "#f0fff5", "#22b85c"],
  purple: ["#f6e2ff", "#c56bff", "#7c2ec8", "#4c1482", "#fbf4ff", "#a855f0"],
};

const COLOR_ALIAS = { coral: "red", orange: "red", teal: "green", pink: "purple" };

function gemKey(name) {
  const key = COLOR_ALIAS[name] || name || "red";
  return GEMS[key] ? key : "red";
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function drawSky(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const rng = mulberry32(520);
  const count = Math.round((w * h) / 4200);
  for (let i = 0; i < count; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const big = rng() < 0.07;
    const s = big ? 1.7 + rng() * 1.1 : 0.45 + rng() * 0.85;
    const a = 0.28 + rng() * 0.7;
    const warm = rng() < 0.16;
    if (big) {
      ctx.fillStyle = `rgba(255, 236, 190, ${a * 0.28})`;
      ctx.beginPath();
      ctx.arc(x, y, s * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = warm ? `rgba(255, 220, 160, ${a})` : `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTray(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w * 0.2, h);
  g.addColorStop(0, "#f0c27a");
  g.addColorStop(0.45, "#e0a45a");
  g.addColorStop(1, "#c98440");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.35;
  for (let y = 4; y < h; y += 5) {
    ctx.fillStyle = y % 10 === 4 ? "rgba(120,60,16,0.08)" : "rgba(255,255,255,0.04)";
    ctx.fillRect(0, y, w, 1);
  }
  ctx.restore();
}

function drawWoodCell(ctx, x, y, size, seed) {
  const r = size * 0.18;
  const rng = mulberry32(seed);
  roundRect(ctx, x, y, size, size, r);
  const base = ctx.createLinearGradient(x, y, x + size * 0.35, y + size);
  base.addColorStop(0, "#f6d7a2");
  base.addColorStop(0.42, "#e8b56a");
  base.addColorStop(1, "#d49245");
  ctx.fillStyle = base;
  ctx.fill();

  ctx.save();
  roundRect(ctx, x, y, size, size, r);
  ctx.clip();
  for (let i = 0; i < 6; i++) {
    const gy = y + size * (0.12 + i * 0.14);
    const wobble = (rng() - 0.5) * size * 0.06;
    ctx.beginPath();
    ctx.moveTo(x - 2, gy);
    ctx.bezierCurveTo(
      x + size * 0.35,
      gy + wobble,
      x + size * 0.65,
      gy - wobble,
      x + size + 2,
      gy + wobble * 0.4
    );
    ctx.strokeStyle = `rgba(120, 62, 18, ${0.07 + rng() * 0.08})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  const shade = ctx.createLinearGradient(x, y, x, y + size);
  shade.addColorStop(0, "rgba(90,40,10,0.16)");
  shade.addColorStop(0.16, "rgba(90,40,10,0)");
  shade.addColorStop(0.84, "rgba(90,40,10,0)");
  shade.addColorStop(1, "rgba(70,30,8,0.22)");
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, size, size);
  ctx.restore();

  const sw = Math.max(2.4, size * 0.085);
  ctx.lineWidth = sw;
  ctx.strokeStyle = "#8ae0c4";
  ctx.lineJoin = "round";
  roundRect(ctx, x + sw / 2, y + sw / 2, size - sw, size - sw, Math.max(3, r - 1));
  ctx.stroke();

  ctx.save();
  roundRect(ctx, x, y, size, size, r);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(x + r, y + sw * 0.55);
  ctx.quadraticCurveTo(x + size / 2, y + sw * 0.15, x + size - r, y + sw * 0.55);
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = Math.max(1, sw * 0.28);
  ctx.stroke();
  ctx.restore();
}

function drawGem(ctx, x, y, w, h, name) {
  if (w < 3 || h < 3) return;
  const [top, mid, deep, edge, hi, diamond] = GEMS[gemKey(name)];
  const r = Math.min(w, h) * 0.22;
  ctx.save();
  ctx.shadowColor = "rgba(40, 16, 8, 0.38)";
  ctx.shadowBlur = Math.max(2, Math.min(w, h) * 0.14);
  ctx.shadowOffsetY = Math.max(1, Math.min(w, h) * 0.07);
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = deep;
  ctx.fill();
  ctx.restore();

  roundRect(ctx, x, y, w, h, r);
  const body = ctx.createLinearGradient(x, y, x + w * 0.15, y + h);
  body.addColorStop(0, top);
  body.addColorStop(0.38, mid);
  body.addColorStop(1, deep);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.045);
  ctx.strokeStyle = edge;
  ctx.stroke();

  ctx.save();
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.clip();
  const shine = ctx.createLinearGradient(x, y, x, y + h * 0.42);
  shine.addColorStop(0, "rgba(255,255,255,0.55)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(x, y, w, h * 0.42);
  const side = ctx.createLinearGradient(x, y, x + w * 0.16, y);
  side.addColorStop(0, "rgba(0,0,0,0.2)");
  side.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = side;
  ctx.fillRect(x, y, w * 0.18, h);

  const cx = x + w / 2;
  const cy = y + h / 2;
  const dw = w * 0.3;
  const dh = h * 0.36;
  ctx.beginPath();
  ctx.moveTo(cx, cy - dh);
  ctx.lineTo(cx + dw, cy);
  ctx.lineTo(cx, cy + dh);
  ctx.lineTo(cx - dw, cy);
  ctx.closePath();
  const facet = ctx.createLinearGradient(cx - dw, cy - dh, cx + dw, cy + dh);
  facet.addColorStop(0, hi);
  facet.addColorStop(0.45, top);
  facet.addColorStop(1, diamond);
  ctx.fillStyle = facet;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, cy - dh * 0.15);
  ctx.lineTo(cx + dw, cy);
  ctx.lineTo(cx, cy + dh);
  ctx.lineTo(cx, cy - dh * 0.15);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w * 0.34, y + h * 0.24, Math.max(1.5, w * 0.11), Math.max(1, h * 0.07), -0.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fill();
  ctx.restore();
}

function drawGemRun(ctx, x, y, w, h, color) {
  const horizontal = w >= h * 1.3;
  const vertical = h >= w * 1.3;
  if (!horizontal && !vertical) {
    drawGem(ctx, x, y, w, h, color);
    return;
  }
  const len = horizontal ? w : h;
  const thick = horizontal ? h : w;
  const count = len > thick * 1.45 ? 2 : 1;
  const gap = count > 1 ? Math.max(1, thick * 0.12) : 0;
  const seg = (len - gap * (count - 1)) / count;
  for (let i = 0; i < count; i++) {
    const o = i * (seg + gap);
    if (horizontal) drawGem(ctx, x + o, y, seg, h, color);
    else drawGem(ctx, x, y + o, w, seg, color);
  }
}

function drawGlass(ctx, x, y, w, h, stressed) {
  const r = Math.min(w, h) * 0.45;
  ctx.save();
  ctx.shadowColor = "rgba(80, 220, 255, 0.55)";
  ctx.shadowBlur = Math.max(4, Math.min(w, h) * 0.45);
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = "rgba(120, 220, 240, 0.35)";
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "rgba(230,255,255,0.95)");
  g.addColorStop(0.4, "rgba(120, 215, 235, 0.78)");
  g.addColorStop(1, "rgba(40, 140, 175, 0.88)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.1);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.stroke();
  if (!stressed) return;
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + h * 0.15);
  ctx.lineTo(x + w * 0.45, y + h * 0.48);
  ctx.lineTo(x + w * 0.32, y + h * 0.62);
  ctx.lineTo(x + w * 0.7, y + h * 0.9);
  ctx.moveTo(x + w * 0.45, y + h * 0.48);
  ctx.lineTo(x + w * 0.72, y + h * 0.38);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.06);
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

function spiralPath(turns, r0, r1, cx, cy, phase) {
  const steps = 72;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = phase + t * turns * Math.PI * 2;
    const rad = r0 + (r1 - r0) * t;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    d += `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

export function holeMarkup() {
  const a = spiralPath(2.7, 44, 5, 50, 50, 0.4);
  const b = spiralPath(2.15, 36, 3, 50, 50, Math.PI * 0.85);
  return `<svg class="hole-svg" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <radialGradient id="holeGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#f3fffc" stop-opacity="0.95"/>
        <stop offset="28%" stop-color="#7dffe8" stop-opacity="0.8"/>
        <stop offset="62%" stop-color="#12998c" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#0c6e68" stop-opacity="0"/>
      </radialGradient>
      <filter id="holeBlur" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="1.8"/>
      </filter>
    </defs>
    <circle class="hole-glow" cx="50" cy="50" r="48" fill="url(#holeGlow)"/>
    <g filter="url(#holeBlur)">
      <path d="${a}" fill="none" stroke="#5dffe6" stroke-width="8" stroke-linecap="round"/>
    </g>
    <g class="vortex">
      <path d="${a}" fill="none" stroke="#ecfffb" stroke-width="3.4" stroke-linecap="round"/>
      <path d="${b}" fill="none" stroke="#1aa896" stroke-width="5.2" stroke-linecap="round"/>
    </g>
    <g class="vortex-rev">
      <path d="${b}" fill="none" stroke="#d8fff6" stroke-width="2" stroke-linecap="round" opacity="0.85"/>
    </g>
    <circle cx="50" cy="50" r="8" fill="#e9fffb"/>
    <circle cx="50" cy="50" r="3.5" fill="#ffffff"/>
  </svg>`;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{n:number,cell:number,gap:number,hole:[number,number],pillars:{r:number,c:number,color:string}[],glassH:{r:number,c:number,stressed:boolean}[],glassV:{r:number,c:number,stressed:boolean}[],coloredH:{r:number,c:number,color:string}[],coloredV:{r:number,c:number,color:string}[]}} state
 */
export function drawPlayfield(canvas, state) {
  const { n, cell, gap, pillars, glassH, glassV, coloredH, coloredV } = state;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const step = cell + gap;
  const w = n * cell + (n - 1) * gap;
  const h = w;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  drawTray(ctx, w, h);

  const blocked = new Set(pillars.map((p) => `${p.r},${p.c}`));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (blocked.has(`${r},${c}`)) continue;
      drawWoodCell(ctx, c * step, r * step, cell, r * 97 + c * 13 + 5);
    }
  }
  for (const p of pillars) {
    const m = Math.max(1, cell * 0.035);
    drawGem(ctx, p.c * step + m, p.r * step + m, cell - m * 2, cell - m * 2, p.color);
  }

  const bar = cell * 0.3;
  for (const g of glassH) {
    const thick = cell * 0.22;
    const x = g.c * step + cell * 0.12;
    const y = (g.r + 1) * step - gap / 2 - thick / 2;
    drawGlass(ctx, x, y, cell * 0.76, thick, g.stressed);
  }
  for (const g of glassV) {
    const thick = cell * 0.22;
    const y = g.r * step + cell * 0.12;
    const x = (g.c + 1) * step - gap / 2 - thick / 2;
    drawGlass(ctx, x, y, thick, cell * 0.76, g.stressed);
  }
  for (const seg of coloredH) {
    const x = seg.c * step + cell * 0.06;
    const y = (seg.r + 1) * step - gap / 2 - bar / 2;
    drawGemRun(ctx, x, y, cell * 0.88, bar, seg.color);
  }
  for (const seg of coloredV) {
    const y = seg.r * step + cell * 0.06;
    const x = (seg.c + 1) * step - gap / 2 - bar / 2;
    drawGemRun(ctx, x, y, bar, cell * 0.88, seg.color);
  }

}
