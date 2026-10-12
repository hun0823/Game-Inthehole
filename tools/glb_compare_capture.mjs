#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCanvas, loadImage } from "canvas";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "artifacts");
const W = 430;
const H = 932;
const LEVEL = 68;

async function shot(page, query) {
  await page.setViewportSize({ width: W, height: H });
  await page.goto(`http://127.0.0.1:8765/tools/capture.html?${query}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 90000 });
  await page.waitForTimeout(500);
  return page.screenshot({ type: "png" });
}

function crop(buf, x, y, w, h) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  return loadImage(buf).then((img) => {
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
    return canvas.toBuffer("image/png");
  });
}

async function stitchThree(aPath, bPath, cPath, labels, outPath) {
  const imgs = await Promise.all([aPath, bPath, cPath].map((p) => loadImage(p)));
  const canvas = createCanvas(W * 3, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#120820";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  imgs.forEach((img, i) => {
    ctx.drawImage(img, i * W, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(labels[i], 14 + i * W, 30);
  });
  await writeFile(outPath, canvas.toBuffer("image/png"));
}

async function perf(page, glb) {
  const url = `http://127.0.0.1:8765/tools/capture.html?id=${LEVEL}&ball=toy&deco=on${glb ? "&glb=1" : ""}`;
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 90000 });
  await page.waitForTimeout(800);
  const loadMs = Date.now() - t0;
  const perf = await page.evaluate(() => window.__view?.perfInfo?.() || { calls: 0, triangles: 0 });
  return { ...perf, loadMs };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const target = join(ROOT, "feedback/toy8_target.png");
  try {
    await readFile(target);
  } catch {
    await writeFile(target, await readFile(join(ROOT, "reference2.png")));
  }
  const mainP = join(OUT, "shot_main.png");
  const glbP = join(OUT, "shot_glb.png");

  await writeFile(mainP, await shot(page, `id=${LEVEL}&ball=toy&deco=on`));
  await writeFile(glbP, await shot(page, `id=${LEVEL}&ball=toy&deco=on&glb=1`));
  await stitchThree(target, mainP, glbP, ["시안", "main", "GLB"], join(OUT, "compare_toy8_triptych.png"));

  const mainFull = await readFile(mainP);
  const glbFull = await readFile(glbP);
  const closeMain = await crop(mainFull, 40, 280, 350, 320);
  const closeGlb = await crop(glbFull, 40, 280, 350, 320);
  const closeCanvas = createCanvas(700, 320);
  const ctx = closeCanvas.getContext("2d");
  ctx.fillStyle = "#120820";
  ctx.fillRect(0, 0, 700, 320);
  const a = await loadImage(closeMain);
  const b = await loadImage(closeGlb);
  ctx.drawImage(a, 0, 0);
  ctx.drawImage(b, 350, 0);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("main", 12, 24);
  ctx.fillText("GLB", 362, 24);
  await writeFile(join(OUT, "compare_closeup.png"), closeCanvas.toBuffer("image/png"));

  await writeFile(join(OUT, "shot_goal_in.png"), await shot(page, `id=${LEVEL}&ball=toy&deco=on&glb=1&mode=tilt&dir=down&state=open`));

  const pMain = await perf(page, false);
  const pGlb = await perf(page, true);
  const rawSize = (await readFile(join(ROOT, "assets/models/raw/toy_planet.glb"))).length;
  const optSize = (await readFile(join(ROOT, "assets/models/toy_planet.glb"))).length;
  const report = {
    glbBytesRaw: rawSize,
    glbBytesMeshopt: optSize,
    drawCallsMain: pMain.calls,
    drawCallsGlb: pGlb.calls,
    trianglesMain: pMain.triangles,
    trianglesGlb: pGlb.triangles,
    loadMsMain: pMain.loadMs,
    loadMsGlb: pGlb.loadMs,
    environment: "Cursor Cloud Agent VM, Chrome headless (iPhone Safari 아님)",
    fps: "미측정",
  };
  await writeFile(join(OUT, "metrics.json"), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
