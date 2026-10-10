/** Starfield behind the 3D board, plus a few props on the ground band. */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INK = "#141414";

export function drawSky(canvas, theme) {
  const app = document.querySelector(".app");
  if (app) app.style.background = app.classList.contains("is-map") ? "" : "transparent";
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky0 = theme?.sky0 || "#1b3d86";
  const sky1 = theme?.sky1 || "#102454";
  const sky2 = theme?.sky2 || "#081428";
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, sky0);
  wash.addColorStop(0.46, sky1);
  wash.addColorStop(1, sky2);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w * 0.5, h * 0.42);
  ctx.rotate(-28 * Math.PI / 180);
  ctx.fillStyle = lift(sky1, 0.22, 0.09);
  const span = Math.hypot(w, h);
  const step = Math.max(28, w * 0.09);
  for (let x = -span; x < span; x += step) {
    ctx.fillRect(x, -span, step * 0.28, span * 2);
  }
  ctx.restore();
  const rng = mulberry32(theme ? theme.id.length * 97 + 520 : 520);
  const count = 14;
  for (let i = 0; i < count; i++) {
    spark(ctx, rng() * w, rng() * h * 0.72, 2.2 + rng() * 2.4, 0.45 + rng() * 0.4);
  }
  const id = theme?.id;
  if (id) {
    paintGround(ctx, w, h, id);
    paintCornerProps(ctx, w, h, id);
  }
}

function lift(hex, amount, alpha) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  const ch = (shift) => {
    const c = (n >> shift) & 255;
    return Math.round(c + (255 - c) * amount);
  };
  return `rgba(${ch(16)}, ${ch(8)}, ${ch(0)}, ${alpha})`;
}

function spark(ctx, x, y, s, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = `rgba(255, 236, 170, ${a})`;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(0, 0, s * 0.85, 0);
  ctx.quadraticCurveTo(0, 0, 0, s);
  ctx.quadraticCurveTo(0, 0, -s * 0.85, 0);
  ctx.quadraticCurveTo(0, 0, 0, -s);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${Math.min(1, a + 0.15)})`;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const GROUND = {
  wood: "#3d9a4a",
  desert: "#e6c27a",
  ice: "#f4fbff",
  ocean: "#1f8fb8",
  crystal: "#8ea0c8",
  toy: "#f0c09a",
  mushroom: "#6d4a78",
  candy: "#f7b4c8",
  lava: "#6a3028",
  jungle: "#2f7a3a",
  alien: "#4a3a88",
  machine: "#3a4450",
};

function bandTop(h) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--dpad-top").trim();
  const n = parseFloat(raw);
  if (Number.isFinite(n) && n > 2) return Math.max(0, n - 8);
  return h * 0.78;
}

function paintGround(ctx, w, h, id) {
  const y0 = bandTop(h);
  const fill = GROUND[id] || GROUND.wood;
  const wave = (y, amp) => {
    ctx.beginPath();
    ctx.moveTo(0, y + amp * 0.35);
    ctx.quadraticCurveTo(w * 0.3, y - amp * 0.85, w * 0.62, y + amp * 0.1);
    ctx.quadraticCurveTo(w * 0.84, y + amp * 0.7, w, y);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
  };
  ctx.fillStyle = INK;
  wave(y0, 14);
  ctx.fill();
  ctx.fillStyle = fill;
  wave(y0 + 5, 12);
  ctx.fill();
}

function blob(ctx, x, y, rx, ry, fill, shade) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(1, rx - 4), Math.max(1, ry - 4), 0, 0, Math.PI * 2);
  ctx.fill();
  if (!shade) return;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(1, rx - 4), Math.max(1, ry - 4), 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = shade;
  ctx.fillRect(x - rx, y, rx * 2, ry);
  ctx.restore();
}

function brick(ctx, x, y, w, h, fill, shade) {
  const r = Math.min(6, w * 0.18, h * 0.22);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.fillStyle = fill;
  path();
  ctx.fill();
  ctx.stroke();
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = shade;
  ctx.fillRect(x, y + h * 0.62, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.fillRect(x + 3, y + 3, w - 6, Math.max(2, h * 0.22));
  ctx.restore();
}

function balloon(ctx, x, y, fill, shade, s) {
  blob(ctx, x, y, 18 * s, 22 * s, fill, shade);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(x - 5 * s, y + 18 * s);
  ctx.lineTo(x + 5 * s, y + 18 * s);
  ctx.lineTo(x, y + 26 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y + 24 * s);
  ctx.quadraticCurveTo(x + 8 * s, y + 40 * s, x - 4 * s, y + 56 * s);
  ctx.stroke();
}

function paintCornerProps(ctx, w, h, id) {
  const s = Math.max(0.72, Math.min(1, w / 430));
  const y0 = bandTop(h);
  const left = 18 * s;
  const right = w - 22 * s;
  const painters = {
    wood: () => {
      blob(ctx, left + 16 * s, y0 + 28 * s, 12 * s, 10 * s, "#c47a3a", "#8a4e22");
      brick(ctx, right - 8 * s, y0 + 8 * s, 16 * s, 28 * s, "#8a5a32", "#5c3a1e");
      blob(ctx, right, y0 + 2 * s, 16 * s, 14 * s, "#3d9a4a", "#2a6e34");
    },
    desert: () => {
      brick(ctx, left, y0 + 6 * s, 14 * s, 36 * s, "#3d9a4a", "#2a6e34");
      blob(ctx, right, y0 + 22 * s, 16 * s, 10 * s, "#e6c27a", "#c4924a");
    },
    ice: () => {
      blob(ctx, left + 8 * s, y0 + 24 * s, 14 * s, 12 * s, "#ffffff", "#d5e6f2");
      blob(ctx, right, y0 + 18 * s, 10 * s, 14 * s, "#d7eef8", "#9fd4e8");
    },
    ocean: () => {
      blob(ctx, left + 10 * s, y0 + 26 * s, 14 * s, 10 * s, "#ff8aa0", "#e23b5a");
      blob(ctx, right, y0 + 20 * s, 11 * s, 11 * s, "#7ee0ff", "#1f8fb8");
    },
    crystal: () => {
      brick(ctx, left + 2 * s, y0 + 8 * s, 16 * s, 22 * s, "#7eb6ff", "#3a6ad0");
      brick(ctx, right - 6 * s, y0 + 4 * s, 14 * s, 26 * s, "#d6e8ff", "#7eb6ff");
    },
    toy: () => {
      balloon(ctx, left + 16 * s, y0 - 28 * s, "#ff5a9a", "#d43070", s);
      balloon(ctx, left + 52 * s, y0 - 8 * s, "#3ec0ff", "#1468c8", s * 0.92);
      balloon(ctx, right - 6 * s, y0 - 34 * s, "#f2c14a", "#c49220", s);
      brick(ctx, 14 * s, h - 64 * s, 30 * s, 28 * s, "#3ec0ff", "#1468c8");
      brick(ctx, right - 16 * s, y0 + 18 * s, 28 * s, 18 * s, "#3d9a4a", "#2a6e34");
      brick(ctx, right - 12 * s, y0 + 36 * s, 26 * s, 16 * s, "#e23b6a", "#a82048");
    },
    mushroom: () => {
      blob(ctx, left + 12 * s, y0 + 16 * s, 14 * s, 10 * s, "#e23b3b", "#a82028");
      brick(ctx, left + 6 * s, y0 + 22 * s, 12 * s, 16 * s, "#f4f1ea", "#d5c8b4");
      blob(ctx, right, y0 + 14 * s, 12 * s, 9 * s, "#f2c14a", "#c49220");
      brick(ctx, right - 6 * s, y0 + 20 * s, 12 * s, 14 * s, "#f4f1ea", "#d5c8b4");
    },
    candy: () => {
      blob(ctx, left + 12 * s, y0 + 10 * s, 12 * s, 12 * s, "#ff5a9a", "#d43070");
      brick(ctx, left + 8 * s, y0 + 20 * s, 8 * s, 22 * s, "#f4f7fb", "#d5dde6");
      brick(ctx, right - 8 * s, y0 + 12 * s, 18 * s, 14 * s, "#7adf5a", "#2a6e34");
    },
    lava: () => {
      blob(ctx, left + 10 * s, y0 + 24 * s, 16 * s, 12 * s, "#6a4038", "#3a2018");
      blob(ctx, right, y0 + 20 * s, 14 * s, 11 * s, "#e23b3b", "#a82028");
    },
    jungle: () => {
      blob(ctx, left + 14 * s, y0 + 18 * s, 16 * s, 10 * s, "#3d9a4a", "#1e5a28");
      blob(ctx, right, y0 + 16 * s, 12 * s, 12 * s, "#ff5a9a", "#d43070");
    },
    alien: () => {
      blob(ctx, left + 12 * s, y0 + 16 * s, 12 * s, 14 * s, "#6adf5a", "#2a6e34");
      blob(ctx, right, y0 + 18 * s, 14 * s, 8 * s, "#c06bff", "#6a28a8");
    },
    machine: () => {
      blob(ctx, left + 14 * s, y0 + 22 * s, 14 * s, 14 * s, "#d0d8e4", "#8a929c");
      blob(ctx, right, y0 + 20 * s, 12 * s, 12 * s, "#3ec4ff", "#1a8ec4");
    },
  };
  (painters[id] || painters.wood)();
}
