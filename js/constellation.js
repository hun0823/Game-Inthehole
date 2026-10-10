/**
 * Twelve planets on a snake of glowing links. Labels stay in HTML so Hangul is sharp.
 */
import * as THREE from "./vendor/three.module.js";
import { PLANET_ORDER } from "./themes.js";
import { createPlanet, setPlanetLocked } from "./planetFactory.js";
import { bindHost } from "./showcase.js";

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
  grd.addColorStop(0.4, "rgba(255,255,255,0.85)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function linkMesh(a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, Math.max(0.05, len), 6),
    new THREE.MeshBasicMaterial({ color: 0xb7e4ff, transparent: true, opacity: 0.9 })
  );
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

export function createConstellation(canvas) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setClearColor(0x070b18, 1);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 60);
  const homePos = new THREE.Vector3(0, 0.05, 17.8);
  const homeLook = new THREE.Vector3(0, -0.05, 0);
  const look = homeLook.clone();
  camera.position.copy(homePos);
  camera.lookAt(look);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.25);
  key.position.set(4, 6, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ec2ff, 0.45);
  rim.position.set(-5, 1, -3);
  scene.add(rim);

  const starCount = 180;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 16;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 12;
    starPos[i * 3 + 2] = -2 - Math.random() * 6;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      size: 0.07,
      map: starTex(),
      transparent: true,
      depthWrite: false,
      color: 0xffffff,
    })
  );
  scene.add(stars);

  const planets = PLANET_ORDER.map((id, i) => {
    const planet = createPlanet(id);
    const row = Math.floor(i / 3);
    const col = row % 2 ? 2 - (i % 3) : i % 3;
    planet.position.set((col - 1) * 1.38, 2.45 - row * 1.64, 0);
    planet.userData.spin.rotation.y = 0.45 + i * 0.15;
    scene.add(planet);
    return planet;
  });
  for (let i = 0; i < planets.length - 1; i++) {
    scene.add(linkMesh(planets[i].position, planets[i + 1].position));
  }

  let raf = 0;
  let running = false;
  let mode = "idle";
  let onProject = null;
  let chain = Promise.resolve();

  function enqueue(work) {
    const run = chain.then(work);
    chain = run.then(() => {}, () => {});
    return run;
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function render() {
    renderer.setClearColor(0x070b18, 1);
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
        planet.userData.spin.rotation.y += 0.004;
        planet.userData.spin.position.y = Math.sin(time * 1.25 + i) * 0.045;
        planet.userData.moons.rotation.y = time * 0.65 + i;
      });
    }
    render();
    if (onProject) onProject();
    raf = requestAnimationFrame(frame);
  }

  function animate(toPos, toLook, dur) {
    mode = "anim";
    const fromPos = camera.position.clone();
    const fromLook = look.clone();
    if (dur <= 0) {
      camera.position.copy(toPos);
      look.copy(toLook);
      mode = "idle";
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
        else {
          mode = "idle";
          resolve();
        }
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
    setLocked(pred) {
      planets.forEach((planet, i) => setPlanetLocked(planet, !!pred(i)));
    },
    project(i, w, h) {
      const v = planets[i].position.clone().project(camera);
      return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
    },
    onProject(fn) {
      onProject = fn;
    },
    zoomTo(i) {
      const target = planets[i].position.clone();
      const to = target.clone().add(new THREE.Vector3(0.15, 0.4, 2.35));
      return enqueue(() => animate(to, target, reduce ? 0 : 900));
    },
    resetCamera(instant) {
      return enqueue(() => animate(homePos.clone(), homeLook.clone(), instant || reduce ? 0 : 700));
    },
  };
}
