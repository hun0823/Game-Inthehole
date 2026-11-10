/** Shared sky-canvas setup for Wood looks. The DOM sky stays behind the board. */

export function skyCanvas(canvas, crisp = false) {
  const app = document.querySelector(".app");
  if (app && !app.classList.contains("is-map")) app.style.background = "transparent";
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = !crisp;
  return { ctx, w, h };
}

export function groundTop(h) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--dpad-top").trim();
  const n = parseFloat(raw);
  if (Number.isFinite(n) && n > 2) return Math.max(0, n - 8);
  return h * 0.78;
}
