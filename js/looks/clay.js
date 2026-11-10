/**
 * Wood look — clay tray.
 * Bevelled cushions and a raised rim. The tilt grid is unchanged.
 */
import { loadKit, mountStage } from "./kit.js";
import { skyCanvas, groundTop } from "./sky.js";

const url = new URL("../../assets/looks/clay.glb", import.meta.url);
let scene = null;
export const ready = loadKit(url).then((gltf) => {
  scene = gltf.scene;
});

const GEMS = { red: 0xe07a62, blue: 0x6aa0d0, green: 0x7aaa62, purple: 0xc090c0 };

function paintSky(canvas) {
  const { ctx, w, h } = skyCanvas(canvas);
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.42, 20, w * 0.5, h * 0.45, h * 0.75);
  bg.addColorStop(0, "#f6ebe3");
  bg.addColorStop(0.55, "#f0d5c8");
  bg.addColorStop(1, "#e2b8a8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const y0 = groundTop(h);
  const floor = ctx.createLinearGradient(0, y0, 0, h);
  floor.addColorStop(0, "#e7c2b0");
  floor.addColorStop(1, "#d7aa98");
  ctx.fillStyle = floor;
  ctx.fillRect(0, y0, w, h - y0);
  ctx.fillStyle = "#e07a62";
  ctx.beginPath();
  ctx.ellipse(48, y0 + 34, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c46a58";
  ctx.beginPath();
  ctx.ellipse(48, y0 + 24, 13, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function createLook() {
  let stage = null;
  return {
    mount(ctx) {
      ctx.tune({
        exposure: 1.05,
        motes: { visible: false },
        blob: 0xc49a88,
        contact: { color: 0xa07060, opacity: 0.28 },
      });
      stage = mountStage(scene, ctx, { gems: GEMS, toneMapped: true });
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
