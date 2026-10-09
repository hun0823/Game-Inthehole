/** 고해상도 플레이 영역 — 오목한 3D 타일 */
export function drawPlayfield(canvas, { n, cell, gap, hole }) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const step = cell + gap;
  const w = n * cell + (n - 1) * gap;
  const h = w;

  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = "#252030";
  ctx.fillRect(0, 0, w, h);

  const [holeR, holeC] = hole;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = c * step;
      const y = r * step;
      if (r === holeR && c === holeC) {
        drawHole(ctx, x, y, cell);
      } else {
        drawCell3D(ctx, x, y, cell, (r + c) % 2 === 0);
      }
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCell3D(ctx, x, y, size, alt) {
  const depth = Math.max(3, size * 0.06);

  roundRect(ctx, x, y, size, size, 8);
  const base = ctx.createLinearGradient(x, y, x + size * 0.4, y + size);
  if (alt) {
    base.addColorStop(0, "#787090");
    base.addColorStop(0.5, "#5a5070");
    base.addColorStop(1, "#3a3248");
  } else {
    base.addColorStop(0, "#6e6488");
    base.addColorStop(0.5, "#504660");
    base.addColorStop(1, "#343040");
  }
  ctx.fillStyle = base;
  ctx.fill();

  ctx.save();
  roundRect(ctx, x + 2, y + 2, size - 4, size - 4, 7);
  ctx.clip();
  const shine = ctx.createLinearGradient(x, y, x, y + size * 0.55);
  shine.addColorStop(0, "rgba(255,255,255,0.14)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(x, y, size, size * 0.55);
  ctx.restore();

  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = depth;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + size - 1);
  ctx.lineTo(x + size - 4, y + size - 1);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, size - 1, size - 1, 7);
  ctx.stroke();
}

function drawHole(ctx, x, y, size) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const rad = size * 0.38;

  roundRect(ctx, x, y, size, size, 8);
  ctx.fillStyle = "#141018";
  ctx.fill();

  ctx.strokeStyle = "rgba(61,214,140,0.5)";
  ctx.lineWidth = 2;
  roundRect(ctx, x + 1, y + 1, size - 2, size - 2, 7);
  ctx.stroke();

  const ring = ctx.createRadialGradient(cx, cy, rad * 0.4, cx, cy, rad * 1.2);
  ring.addColorStop(0, "#000");
  ring.addColorStop(0.7, "#010102");
  ring.addColorStop(0.88, "#2a9d62");
  ring.addColorStop(1, "rgba(42,157,98,0)");

  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();

  const inner = ctx.createRadialGradient(cx - rad * 0.15, cy - rad * 0.25, 0, cx, cy, rad * 0.9);
  inner.addColorStop(0, "#1a1020");
  inner.addColorStop(0.6, "#000");
  inner.addColorStop(1, "#000");
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.82, 0, Math.PI * 2);
  ctx.fillStyle = inner;
  ctx.fill();

  ctx.fillStyle = "rgba(61,214,140,0.15)";
  ctx.beginPath();
  ctx.ellipse(cx, cy - rad * 0.35, rad * 0.5, rad * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
}
