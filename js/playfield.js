/** Starfield behind the 3D board. */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
  ctx.translate(w * 0.5, h * 0.5);
  ctx.rotate(-30 * Math.PI / 180);
  ctx.fillStyle = lift(sky1, 0.42, 0.5);
  const span = Math.hypot(w, h);
  const step = Math.max(18, w * 0.055);
  for (let x = -span; x < span; x += step) {
    ctx.fillRect(x, -span, step * 0.42, span * 2);
  }
  ctx.restore();
  const rng = mulberry32(theme ? theme.id.length * 97 + 520 : 520);
  const count = 6;
  for (let i = 0; i < count; i++) {
    spark(ctx, rng() * w, rng() * h * 0.55, 4 + rng() * 3, 0.28 + rng() * 0.22);
  }
  if (theme?.id) paintGround(ctx, w, h, theme.id);
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
  ctx.fillStyle = `rgba(255, 244, 190, ${a})`;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(0, 0, s, 0);
  ctx.quadraticCurveTo(0, 0, 0, s);
  ctx.quadraticCurveTo(0, 0, -s, 0);
  ctx.quadraticCurveTo(0, 0, 0, -s);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const GROUND = {
  wood: "#3d9a4a",
  desert: "#e6c27a",
  ice: "#f4fbff",
  ocean: "#1f8fb8",
  crystal: "#8ea0c8",
  toy: "#f2c15a",
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
  if (Number.isFinite(n) && n > 2) return Math.max(0, n - 10);
  return h * 0.78;
}

function paintGround(ctx, w, h, id) {
  const y0 = bandTop(h);
  const fill = GROUND[id] || GROUND.wood;
  const wave = (y, amp) => {
    ctx.beginPath();
    ctx.moveTo(0, y + amp * 0.4);
    ctx.quadraticCurveTo(w * 0.28, y - amp, w * 0.55, y + amp * 0.15);
    ctx.quadraticCurveTo(w * 0.8, y + amp, w, y + amp * 0.2);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
  };
  ctx.fillStyle = "#141414";
  wave(y0, 18);
  ctx.fill();
  ctx.fillStyle = fill;
  wave(y0 + 7, 16);
  ctx.fill();
}
