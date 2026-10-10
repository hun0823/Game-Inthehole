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
  const rng = mulberry32(theme ? theme.id.length * 97 + 520 : 520);
  const count = Math.round((w * h) / 3800);
  for (let i = 0; i < count; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const big = rng() < 0.08;
    const s = big ? 1.8 + rng() : 0.5 + rng() * 0.8;
    const a = 0.35 + rng() * 0.65;
    if (big) {
      ctx.fillStyle = `rgba(255, 220, 140, ${a * 0.28})`;
      ctx.beginPath();
      ctx.arc(x, y, s * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = rng() < 0.2 ? `rgba(255, 214, 140, ${a})` : `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
  paintMotif(ctx, w, h, theme?.motif, rng);
}

function paintMotif(ctx, w, h, motif, rng) {
  if (motif === "sunset") {
    const sun = ctx.createRadialGradient(w * 0.62, h * 0.62, 8, w * 0.62, h * 0.62, Math.min(w, h) * 0.28);
    sun.addColorStop(0, "rgba(255, 236, 180, 0.95)");
    sun.addColorStop(0.45, "rgba(255, 150, 70, 0.55)");
    sun.addColorStop(1, "rgba(255, 120, 60, 0)");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(w * 0.62, h * 0.62, Math.min(w, h) * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(18, 28, 64, 0.55)";
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
    return;
  }
  if (motif === "blossom") {
    ctx.fillStyle = "rgba(255, 214, 228, 0.85)";
    for (let i = 0; i < 28; i++) {
      const x = rng() * w;
      const y = rng() * h * 0.85;
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 4, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (motif === "snow") {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 1.6 + rng() * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (motif === "station") {
    ctx.fillStyle = "rgba(180, 190, 205, 0.18)";
    ctx.fillRect(w * 0.08, h * 0.18, w * 0.84, h * 0.22);
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 ? "rgba(255, 214, 140, 0.8)" : "rgba(180, 220, 255, 0.75)";
      ctx.fillRect(w * 0.14 + i * w * 0.1, h * 0.22, w * 0.05, h * 0.08);
    }
  }
}
