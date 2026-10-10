/**
 * Scrolling constellation. Planets sit on a zig-zag in world space; the camera
 * y tracks the HTML scroller so each mesh stays under its own label.
 * Planet meshes come from planetFactory unchanged.
 */
import * as THREE from "./vendor/three.module.js";
import { PLANET_ORDER } from "./themes.js";
import { createPlanet, setPlanetLocked } from "./planetFactory.js";
import { bindHost } from "./showcase.js";

/** Pixels per world unit. Sphere diameter on screen is MAP_PPU * scale. */
export const MAP_PPU = 70;

const SCALES = [1, 0.94, 1.06, 0.92, 1.04, 0.96, 1.08, 0.93, 1.02, 0.97, 1.05, 0.95];
/** Moon / ring swing, in world units, before scale. */
const H_FACTOR = 1.08;
/** Atmosphere plus a little bob, in world units, before scale. */
const V_FACTOR = 0.8;

function smoother(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function starTex() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.8)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

/**
 * Pixel layout for the scroll track. Index 0 (Wood) is at the bottom.
 * Even indexes sit on the left, odd indexes on the right.
 */
export function mapLayout(width) {
  const count = PLANET_ORDER.length;
  const maxScale = Math.max(...SCALES);
  const margin = 8;
  const hMax = H_FACTOR * MAP_PPU * maxScale;
  const vMax = V_FACTOR * MAP_PPU * maxScale;
  const pinH = 34;
  const pinGap = 8;
  const dotBand = 44;
  const corridor = pinGap + pinH + 12 + dotBand + 12;
  const pitch = vMax * 2 + corridor;
  const topPad = pinGap + pinH + 16;
  const bottomPad = 28;
  const height = topPad + vMax + Math.max(0, count - 1) * pitch + vMax + bottomPad;
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const scale = SCALES[i % SCALES.length];
    const left = i % 2 === 0;
    const hReach = H_FACTOR * MAP_PPU * scale;
    const vReach = V_FACTOR * MAP_PPU * scale;
    const x = left ? margin + hMax : width - margin - hMax;
    const y = height - bottomPad - vMax - i * pitch;
    const cardGap = 10;
    const cardW = left
      ? Math.max(108, width - margin - (x + hReach + cardGap))
      : Math.max(108, x - hReach - cardGap - margin);
    nodes.push({
      i,
      scale,
      left,
      x,
      y,
      hReach,
      vReach,
      cardGap,
      cardW,
      sphere: MAP_PPU * scale,
    });
  }
  return { width, height, nodes, pitch, margin, hMax, vMax, pinH, pinGap, dotBand, corridor };
}

export function createConstellation(canvas) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 80);
  const look = new THREE.Vector3(0, 0, 0);
  camera.position.set(0, 0, 14);
  scene.add(camera);

  scene.add(new THREE.AmbientLight(0xffffff, 0.62));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(4, 6, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ec2ff, 0.4);
  rim.position.set(-5, 1, -3);
  scene.add(rim);

  function makeStars(count, size, spread) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.85;
      pos[i * 3 + 2] = -8 - Math.random() * 14;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size,
        map: starTex(),
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
        color: 0xffffff,
      })
    );
    camera.add(points);
    return points;
  }
  const starsNear = makeStars(70, 0.11, 14);
  const starsFar = makeStars(110, 0.06, 22);

  const planets = PLANET_ORDER.map((id, i) => {
    const planet = createPlanet(id);
    planet.userData.spin.rotation.y = 0.4 + i * 0.35;
    scene.add(planet);
    return planet;
  });

  let raf = 0;
  let running = false;
  let suspendSync = false;
  let viewW = 0;
  let viewH = 0;
  let viewScroll = 0;
  let chain = Promise.resolve();

  function enqueue(work) {
    const run = chain.then(work);
    chain = run.then(() => {}, () => {});
    return run;
  }

  function viewCamera() {
    const h = Math.max(1, viewH);
    const fov = (33 * Math.PI) / 180;
    const camZ = (h / MAP_PPU) / (2 * Math.tan(fov / 2));
    const camY = -(viewScroll + h / 2) / MAP_PPU;
    return { camZ, camY };
  }

  function layoutPlanets() {
    if (viewW < 2) return;
    const layout = mapLayout(viewW);
    planets.forEach((planet, i) => {
      const node = layout.nodes[i];
      if (!node) return;
      planet.scale.setScalar(node.scale);
      planet.position.set((node.x - viewW / 2) / MAP_PPU, -node.y / MAP_PPU, 0);
    });
  }

  function placeCamera() {
    if (viewW < 2 || viewH < 2) return;
    const { camZ, camY } = viewCamera();
    camera.position.set(0, camY, camZ);
    look.set(0, camY, 0);
    camera.aspect = viewW / viewH;
    camera.updateProjectionMatrix();
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    if (!suspendSync) placeCamera();
    else {
      camera.aspect = (viewW > 2 ? viewW : w) / Math.max(1, viewH > 2 ? viewH : h);
      camera.updateProjectionMatrix();
    }
  }

  function render() {
    renderer.setClearColor(0x000000, 0);
    camera.lookAt(look);
    renderer.render(scene, camera);
  }

  bindHost(renderer, () => {
    resize();
    render();
  });

  function frame(now) {
    if (!running) return;
    const time = now * 0.001;
    if (!reduce) {
      planets.forEach((planet, i) => {
        planet.userData.spin.rotation.y += 0.0032;
        planet.userData.spin.position.y = Math.sin(time * 1.15 + i * 0.7) * 0.032;
        planet.userData.moons.rotation.y = time * 0.55 + i;
      });
      starsNear.material.opacity = 0.55 + Math.sin(time * 2.1) * 0.3;
      starsFar.material.opacity = 0.35 + Math.sin(time * 2.8 + 1.2) * 0.25;
    }
    render();
    raf = requestAnimationFrame(frame);
  }

  function animate(toPos, toLook, dur) {
    const fromPos = camera.position.clone();
    const fromLook = look.clone();
    if (dur <= 0) {
      camera.position.copy(toPos);
      look.copy(toLook);
      render();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now) => {
        const k = smoother(Math.min(1, (now - t0) / dur));
        camera.position.lerpVectors(fromPos, toPos, k);
        look.lerpVectors(fromLook, toLook, k);
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  return {
    start() {
      if (running) return;
      running = true;
      resize();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    resize,
    sync(scrollTop, w, h) {
      viewScroll = scrollTop || 0;
      viewW = w || 0;
      viewH = h || 0;
      layoutPlanets();
      if (!suspendSync) placeCamera();
    },
    setLocked(pred) {
      planets.forEach((planet, i) => setPlanetLocked(planet, !!pred(i)));
    },
    project(i, w, h) {
      const v = planets[i].position.clone().project(camera);
      return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
    },
    zoomTo(i) {
      suspendSync = true;
      const target = planets[i].position.clone();
      const to = target.clone().add(new THREE.Vector3(0.08, 0.16, 2.55));
      return enqueue(() => animate(to, target, reduce ? 0 : 880));
    },
    resetCamera(instant) {
      return enqueue(() => {
        const { camZ, camY } = viewCamera();
        const homePos = new THREE.Vector3(0, camY, camZ);
        const homeLook = new THREE.Vector3(0, camY, 0);
        return animate(homePos, homeLook, instant || reduce ? 0 : 680).then(() => {
          suspendSync = false;
          placeCamera();
        });
      });
    },
  };
}
