/**
 * Wood look — floating forest island.
 * Board, mascot, and props are a Blender kit. The grid is unchanged.
 */
import { loadKit, mountStage } from "./kit.js";
import { skyCanvas, groundTop } from "./sky.js";

const url = new URL("../../assets/looks/diorama.glb", import.meta.url);
let scene = null;
export const ready = loadKit(url).then((gltf) => {
  scene = gltf.scene;
});

const GEMS = { red: 0xb5523a, blue: 0x3d6ea8, green: 0x4f8a3a, purple: 0x8a4a86 };

function paintSky(canvas) {
  const { ctx, w, h } = skyCanvas(canvas);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#7ebfe4");
  sky.addColorStop(0.34, "#f2d2a6");
  sky.addColorStop(0.5, "#f7e4c6");
  sky.addColorStop(0.66, "#5ea24a");
  sky.addColorStop(1, "#1e4e30");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const sx = w * 0.74;
  const sy = h * 0.2;
  const sun = ctx.createRadialGradient(sx, sy, 6, sx, sy, w * 0.34);
  sun.addColorStop(0, "rgba(255,246,214,0.95)");
  sun.addColorStop(0.22, "rgba(255,214,160,0.28)");
  sun.addColorStop(1, "rgba(255,214,160,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
  const hill = (y, color, amp) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(w * 0.28, y - amp, w * 0.55, y + amp * 0.2);
    ctx.quadraticCurveTo(w * 0.82, y + amp, w, y - amp * 0.25);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();
  };
  hill(h * 0.58, "#3c7a40", 28);
  hill(h * 0.66, "#2c6434", 18);
  const y0 = groundTop(h);
  ctx.fillStyle = "#214e30";
  ctx.fillRect(0, y0 + 8, w, h);
  ctx.fillStyle = "#3e8c48";
  ctx.beginPath();
  ctx.moveTo(0, y0 + 16);
  ctx.quadraticCurveTo(w * 0.4, y0 - 4, w, y0 + 18);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
}

export function createLook() {
  let stage = null;
  return {
    mount(ctx) {
      ctx.tune({
        exposure: 1.06,
        motes: { visible: true, color: 0xffe2a8 },
        blob: 0x1a140c,
        contact: { color: 0x2a1a10, opacity: 0.32 },
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
