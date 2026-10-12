#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCanvas, loadImage } from "canvas";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "artifacts");
const W = 430;
const H = 932;
const STAGE_ID = 68;

async function prepPage(page, glb) {
  await page.addInitScript(() => {
    localStorage.setItem("inthehole_deco", "on");
    localStorage.setItem("inthehole_ball_equipped", "toy");
  });
  const url = glb
    ? `http://127.0.0.1:8765/index.html?glb=1&stage=${STAGE_ID}`
    : `http://127.0.0.1:8765/index.html?stage=${STAGE_ID}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas.playfield", { timeout: 90000 });
  await page.waitForFunction(() => window.__stageAudit?.ok === true || window.__stageAudit?.walls > 0, null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function shotPage(page, glb) {
  await page.setViewportSize({ width: W, height: H });
  await prepPage(page, glb);
  return page.screenshot({ type: "png", fullPage: false });
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
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(labels[i], 12 + i * W, 28);
  });
  await writeFile(outPath, canvas.toBuffer("image/png"));
}

async function perf(page, glb) {
  await prepPage(page, glb);
  const t0 = Date.now();
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__stageAudit, null, { timeout: 90000 });
  await page.waitForTimeout(1000);
  const loadMs = Date.now() - t0;
  return page.evaluate((started) => {
    const perf = window.__view?.perfInfo?.() || { calls: 0, triangles: 0 };
    return { ...perf, loadMs: Date.now() - started, audit: window.__stageAudit };
  }, t0);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const target = join(ROOT, "feedback/toy8_target.png");
  const mainP = join(OUT, "shot_main.png");
  const glbP = join(OUT, "shot_glb.png");

  await writeFile(mainP, await shotPage(page, false));
  await writeFile(glbP, await shotPage(page, true));
  await stitchThree(target, mainP, glbP, ["시안", "main", "GLB"], join(OUT, "compare_toy8_triptych.png"));

  const mainFull = await readFile(mainP);
  const glbFull = await readFile(glbP);
  const crop = async (buf, x, y, w, h) => {
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const img = await loadImage(buf);
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
    return canvas.toBuffer("image/png");
  };
  const closeMain = await crop(mainFull, 30, 300, 370, 340);
  const closeGlb = await crop(glbFull, 30, 300, 370, 340);
  const closeCanvas = createCanvas(740, 340);
  const ctx = closeCanvas.getContext("2d");
  ctx.fillStyle = "#120820";
  ctx.fillRect(0, 0, 740, 340);
  ctx.drawImage(await loadImage(closeMain), 0, 0);
  ctx.drawImage(await loadImage(closeGlb), 370, 0);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("main", 12, 22);
  ctx.fillText("GLB", 382, 22);
  await writeFile(join(OUT, "compare_closeup.png"), closeCanvas.toBuffer("image/png"));

  await writeFile(join(OUT, "shot_goal_in.png"), await shotPage(page, true));

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
    auditMain: pMain.audit,
    auditGlb: pGlb.audit,
    auditMatch: pMain.audit?.expected && pGlb.audit?.expected
      ? JSON.stringify(pMain.audit.expected) === JSON.stringify(pGlb.audit.expected)
        && pMain.audit.walls === pGlb.audit.walls
        && pMain.audit.colored === pGlb.audit.colored
        && pMain.audit.buttons === pGlb.audit.buttons
      : false,
    protoKeys: pGlb.audit?.toyGlb ? "see console" : null,
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
