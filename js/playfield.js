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
  const count = 16;
  for (let i = 0; i < count; i++) {
    spark(ctx, rng() * w, rng() * h * 0.66, 6 + rng() * 7, 0.62 + rng() * 0.35);
  }
  paintMotif(ctx, w, h, theme?.motif, rng);
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

function inkBlob(ctx, x, y, rx, ry, fill) {
  ctx.fillStyle = "#141414";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(1, rx - 4), Math.max(1, ry - 4), 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintGround(ctx, w, h, id) {
  const y0 = h * 0.74;
  const painters = {
    wood: groundWood,
    desert: groundDesert,
    ice: groundIce,
    ocean: groundOcean,
    crystal: groundCrystal,
    toy: groundToy,
    mushroom: groundMushroom,
    candy: groundCandy,
    lava: groundLava,
    jungle: groundJungle,
    alien: groundAlien,
    machine: groundMachine,
  };
  (painters[id] || groundWood)(ctx, w, h, y0);
}

function mound(ctx, x, y, rx, ry, fill) {
  ctx.fillStyle = "#141414";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, Math.max(2, rx - 5), Math.max(2, ry - 5), 0, 0, Math.PI * 2);
  ctx.fill();
}

function snowField(ctx, w, h, y0) {
  ctx.fillStyle = "#141414";
  ctx.beginPath();
  ctx.moveTo(0, y0 + 16);
  ctx.quadraticCurveTo(w * 0.22, y0 - 28, w * 0.48, y0 + 6);
  ctx.quadraticCurveTo(w * 0.72, y0 + 36, w, y0 - 8);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  ctx.fillStyle = "#f4fbff";
  ctx.beginPath();
  ctx.moveTo(0, y0 + 22);
  ctx.quadraticCurveTo(w * 0.22, y0 - 18, w * 0.48, y0 + 12);
  ctx.quadraticCurveTo(w * 0.74, y0 + 40, w, y0 - 2);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  ctx.fillStyle = "#d7eef8";
  ctx.beginPath();
  ctx.ellipse(w * 0.18, h * 0.9, w * 0.16, 28, 0, 0, Math.PI * 2);
  ctx.fill();
}

function groundIce(ctx, w, h, y0) {
  snowField(ctx, w, h, y0);
  mound(ctx, w * 0.08, h * 0.93, 28, 18, "#e7f6ff");
  const px = w * 0.08;
  const py = h * 0.86;
  inkBlob(ctx, px, py, 11, 15, "#1c2430");
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(px, py - 2, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2a020";
  ctx.beginPath();
  ctx.moveTo(px - 7, py + 12);
  ctx.lineTo(px - 2, py + 4);
  ctx.lineTo(px + 3, py + 12);
  ctx.fill();
  inkBlob(ctx, w * 0.9, h * 0.87, 18, 8, "#8aa0b4");
  ctx.fillStyle = "#d5e4ee";
  ctx.beginPath();
  ctx.ellipse(w * 0.94, h * 0.86, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function groundWood(ctx, w, h, y0) {
  ctx.fillStyle = "#141414";
  ctx.fillRect(0, y0 + 6, w, h);
  ctx.fillStyle = "#3d9a4a";
  ctx.fillRect(0, y0 + 12, w, h);
  ctx.fillStyle = "#7adf5a";
  for (let i = 0; i < 10; i++) {
    const x = (i + 0.35) * (w / 10);
    ctx.beginPath();
    ctx.moveTo(x, y0 + 18);
    ctx.lineTo(x + 5, y0 + 2);
    ctx.lineTo(x + 10, y0 + 18);
    ctx.fill();
  }
  inkBlob(ctx, w * 0.1, h * 0.9, 22, 14, "#e23b3b");
  inkBlob(ctx, w * 0.1, h * 0.93, 8, 14, "#f4f1ea");
  inkBlob(ctx, w * 0.9, h * 0.88, 16, 11, "#e23b3b");
  ctx.fillStyle = "#f2c14a";
  ctx.beginPath();
  ctx.moveTo(w * 0.94, h * 0.86);
  ctx.lineTo(w * 0.99, h * 0.88);
  ctx.lineTo(w * 0.94, h * 0.9);
  ctx.fill();
}

function groundDesert(ctx, w, h, y0) {
  ctx.fillStyle = "#141414";
  ctx.beginPath();
  ctx.moveTo(0, y0 + 30);
  ctx.quadraticCurveTo(w * 0.3, y0 - 20, w * 0.6, y0 + 20);
  ctx.quadraticCurveTo(w * 0.85, y0 + 50, w, y0 + 10);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  ctx.fillStyle = "#e6c27a";
  ctx.beginPath();
  ctx.moveTo(0, y0 + 36);
  ctx.quadraticCurveTo(w * 0.3, y0 - 10, w * 0.6, y0 + 26);
  ctx.quadraticCurveTo(w * 0.85, y0 + 54, w, y0 + 16);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  inkBlob(ctx, w * 0.08, h * 0.86, 12, 32, "#2f8a3a");
  inkBlob(ctx, w * 0.04, h * 0.8, 8, 14, "#3d9a4a");
  inkBlob(ctx, w * 0.9, h * 0.84, 8, 28, "#8a5a32");
  ctx.fillStyle = "#141414";
  ctx.beginPath();
  ctx.ellipse(w * 0.9, h * 0.78, 26, 10, -0.4, 0, Math.PI * 2);
  ctx.ellipse(w * 0.9, h * 0.78, 22, 8, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3d9a4a";
  ctx.beginPath();
  ctx.ellipse(w * 0.9, h * 0.77, 20, 7, -0.4, 0, Math.PI * 2);
  ctx.ellipse(w * 0.9, h * 0.77, 16, 6, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7ec8e0";
  ctx.beginPath();
  ctx.ellipse(w * 0.9, h * 0.92, 22, 8, 0, 0, Math.PI * 2);
  ctx.fill();
}

function groundOcean(ctx, w, h, y0) {
  ctx.fillStyle = "#0c4a78";
  ctx.fillRect(0, y0, w, h);
  ctx.strokeStyle = "#7fe3ff";
  ctx.lineWidth = 4;
  for (let i = 0; i < 4; i++) {
    const y = y0 + 24 + i * 28;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 28) ctx.quadraticCurveTo(x + 14, y + (i % 2 ? 10 : -10), x + 28, y);
    ctx.stroke();
  }
  inkBlob(ctx, w * 0.16, h * 0.9, 16, 18, "#ff5a7a");
  inkBlob(ctx, w * 0.84, h * 0.88, 14, 16, "#c07aff");
  inkBlob(ctx, w * 0.7, h * 0.78, 12, 8, "#f2a020");
}

function groundCrystal(ctx, w, h, y0) {
  ctx.fillStyle = "#241848";
  ctx.fillRect(0, y0 + 10, w, h);
  [[0.08, "#9a78f0"], [0.16, "#7eb6e8"], [0.84, "#e4ecff"], [0.93, "#b7c6e6"]].forEach(([x, color]) => {
    const cx = w * x;
    ctx.fillStyle = "#141414";
    ctx.beginPath();
    ctx.moveTo(cx, y0 + 4);
    ctx.lineTo(cx + 14, h * 0.96);
    ctx.lineTo(cx - 14, h * 0.96);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, y0 + 12);
    ctx.lineTo(cx + 9, h * 0.94);
    ctx.lineTo(cx - 9, h * 0.94);
    ctx.fill();
  });
}

function groundToy(ctx, w, h, y0) {
  ctx.fillStyle = "#141414";
  ctx.fillRect(0, y0 + 6, w, h);
  ctx.fillStyle = "#f2c15a";
  ctx.fillRect(0, y0 + 12, w, h);
  [[0.08, "#e23b3b", 0], [0.16, "#2f7dff", 18], [0.84, "#f2c14a", 0], [0.93, "#3d9a4a", 16]].forEach(([x, color, lift]) => {
    inkBlob(ctx, w * x, h * 0.9 - lift, 18, 18, color);
  });
}

function groundMushroom(ctx, w, h, y0) {
  ctx.fillStyle = "#2a1840";
  ctx.fillRect(0, y0 + 8, w, h);
  [[0.16, "#e23b3b"], [0.32, "#f08ab0"], [0.78, "#e23b3b"], [0.9, "#c46eb0"]].forEach(([x, color]) => {
    inkBlob(ctx, w * x, h * 0.86, 22, 14, color);
    inkBlob(ctx, w * x, h * 0.9, 8, 12, "#f4f1ea");
  });
}

function groundCandy(ctx, w, h, y0) {
  ctx.fillStyle = "#141414";
  ctx.fillRect(0, y0 + 4, w, h);
  ctx.fillStyle = "#f7b4c8";
  ctx.fillRect(0, y0 + 10, w, h);
  inkBlob(ctx, w * 0.1, h * 0.9, 18, 18, "#c47a3a");
  inkBlob(ctx, w * 0.2, h * 0.93, 12, 12, "#e8c9a0");
  inkBlob(ctx, w * 0.9, h * 0.84, 16, 16, "#ff5a9a");
  ctx.fillStyle = "#fff";
  ctx.fillRect(w * 0.89, h * 0.86, 5, 36);
}

function groundLava(ctx, w, h, y0) {
  ctx.fillStyle = "#2a100c";
  ctx.fillRect(0, y0, w, h);
  ctx.fillStyle = "#4a2018";
  ctx.beginPath();
  ctx.moveTo(0, y0 + 28);
  ctx.quadraticCurveTo(w * 0.4, y0 + 4, w, y0 + 36);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  inkBlob(ctx, w * 0.2, h * 0.9, 22, 12, "#3a1814");
  inkBlob(ctx, w * 0.55, h * 0.92, 16, 10, "#5a2820");
  inkBlob(ctx, w * 0.82, h * 0.88, 26, 14, "#2a100c");
}

function groundJungle(ctx, w, h, y0) {
  ctx.fillStyle = "#143828";
  ctx.fillRect(0, y0 + 6, w, h);
  [[0.1, -0.4], [0.22, 0.5], [0.78, 0.2], [0.9, -0.3]].forEach(([x, rot]) => {
    ctx.save();
    ctx.translate(w * x, h * 0.86);
    ctx.rotate(rot);
    ctx.fillStyle = "#141414";
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3d9a4a";
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function groundAlien(ctx, w, h, y0) {
  ctx.fillStyle = "#1a1038";
  ctx.fillRect(0, y0 + 8, w, h);
  inkBlob(ctx, w * 0.16, h * 0.9, 14, 18, "#6adf5a");
  ctx.fillStyle = "#141414";
  ctx.beginPath();
  ctx.ellipse(w * 0.16, h * 0.86, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(w * 0.16, h * 0.86, 3, 0, Math.PI * 2);
  ctx.fill();
  inkBlob(ctx, w * 0.4, h * 0.92, 10, 16, "#3d9a4a");
  inkBlob(ctx, w * 0.82, h * 0.9, 12, 18, "#7adf5a");
}

function groundMachine(ctx, w, h, y0) {
  ctx.fillStyle = "#1c2430";
  ctx.fillRect(0, y0 + 6, w, h);
  ctx.strokeStyle = "#5c646e";
  ctx.lineWidth = 4;
  ctx.strokeRect(8, y0 + 16, w - 16, h * 0.2);
  [0.15, 0.38, 0.62, 0.85].forEach((x, i) => {
    ctx.fillStyle = "#141414";
    ctx.beginPath();
    ctx.arc(w * x, h * 0.88, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = i % 2 ? "#d0d8e4" : "#8a929c";
    ctx.beginPath();
    ctx.arc(w * x, h * 0.88, 11, 0, Math.PI * 2);
    ctx.fill();
  });
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
