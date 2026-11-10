/**
 * Wood look — pixel arcade blocks.
 * Hard cubes and rails replace the stock frame. The tilt grid is unchanged.
 */
import { loadKit, mountStage } from "./kit.js";
import { skyCanvas, groundTop } from "./sky.js";

const url = new URL("../../assets/looks/pixel.glb", import.meta.url);
let scene = null;
export const ready = loadKit(url).then((gltf) => {
  scene = gltf.scene;
});

const GEMS = { red: 0xe23b3b, blue: 0x2f7dff, green: 0x1ea85a, purple: 0xa43adf };

function paintSky(canvas) {
  const { ctx, w, h } = skyCanvas(canvas, true);
  ctx.imageSmoothingEnabled = false;
  const bands = ["#1c2454", "#243878", "#3a8ec4", "#7ec8ea"];
  const bandH = Math.round(h * 0.16);
  bands.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, i * bandH, w, bandH + 1);
  });
  const sun = 5;
  const sx = Math.round(w * 0.78);
  const sy = Math.round(h * 0.055);
  ctx.fillStyle = "#f0d060";
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const edge = row === 0 || row === 4 || col === 0 || col === 4;
      const corner = (row === 0 || row === 4) && (col === 0 || col === 4);
      if (corner) continue;
      if (edge && !((row === 2 && (col === 0 || col === 4)) || (col === 2 && (row === 0 || row === 4)))) continue;
      ctx.fillRect(sx + col * sun, sy + row * sun, sun, sun);
    }
  }
  ctx.fillStyle = "#fff6d0";
  for (let i = 0; i < 16; i++) {
    const x = Math.round(((i * 97) % 100) / 100 * w);
    const y = Math.round(((i * 53) % 100) / 100 * bandH);
    ctx.fillRect(x, y, 2, 2);
  }
  const y0 = Math.round(groundTop(h));
  ctx.fillStyle = "#214e28";
  ctx.fillRect(0, y0, w, h - y0);
  ctx.fillStyle = "#3a8c32";
  ctx.fillRect(0, y0, w, 10);
  ctx.fillStyle = "#8a4e32";
  ctx.fillRect(28, y0 + 18, 10, 12);
  ctx.fillStyle = "#3a8c32";
  ctx.fillRect(26, y0 + 12, 14, 8);
}

export function createLook() {
  let stage = null;
  return {
    mount(ctx) {
      ctx.tune({
        motes: { visible: false },
        blob: 0x0c1a14,
        contact: { color: 0x102010, opacity: 0.4 },
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
