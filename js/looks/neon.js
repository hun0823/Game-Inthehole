/**
 * Wood look — night-forest neon.
 * Dark plates and emissive rails. No bloom pass; the glow is in the vertex colors.
 * The tilt grid is unchanged.
 */
import { loadKit, mountStage } from "./kit.js";
import { skyCanvas, groundTop } from "./sky.js";

const url = new URL("../../assets/looks/neon.glb", import.meta.url);
let scene = null;
export const ready = loadKit(url).then((gltf) => {
  scene = gltf.scene;
});

const GEMS = { red: 0xff4a6a, blue: 0x3ecbff, green: 0x39ffb0, purple: 0xff3df2 };

function paintSky(canvas) {
  const { ctx, w, h } = skyCanvas(canvas);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#05060f");
  sky.addColorStop(0.45, "#120818");
  sky.addColorStop(0.7, "#1a1030");
  sky.addColorStop(1, "#05060c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255, 61, 242, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.58);
  ctx.bezierCurveTo(w * 0.3, h * 0.54, w * 0.7, h * 0.62, w, h * 0.56);
  ctx.stroke();
  ctx.fillStyle = "rgba(180, 255, 230, 0.85)";
  for (let i = 0; i < 18; i++) {
    const x = ((i * 97) % 100) / 100 * w;
    const y = ((i * 53) % 70) / 100 * h * 0.5;
    ctx.fillRect(x, y, i % 4 === 0 ? 2 : 1.2, i % 4 === 0 ? 2 : 1.2);
  }
  const y0 = groundTop(h);
  ctx.fillStyle = "#05060c";
  ctx.fillRect(0, y0, w, h - y0);
  ctx.strokeStyle = "rgba(57, 255, 210, 0.45)";
  ctx.beginPath();
  ctx.moveTo(0, y0 + 2);
  ctx.lineTo(w, y0 + 2);
  ctx.stroke();
}

export function createLook() {
  let stage = null;
  return {
    mount(ctx) {
      ctx.tune({
        exposure: 1.12,
        motes: { visible: true, color: 0x39ffd2 },
        blob: 0x05060c,
        contact: { color: 0x39ffd2, opacity: 0.22 },
      });
      stage = mountStage(scene, ctx, { gems: GEMS, toneMapped: false });
    },
    unmount(ctx) {
      if (stage) stage.dispose();
      stage = null;
      ctx.restore();
    },
    tick(time, dt) {
      if (stage) stage.tick(time, dt);
    },
    paintSky,
    dressBall(mesh) {
      if (stage) stage.dressBall(mesh);
    },
  };
}
