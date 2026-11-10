/**
 * Assemble a Wood look from a Blender kit.
 *
 * Meshes are decoration. Cell centers, wall edges, the ball's grid position,
 * and the hole all come from the existing board. Nothing here is consulted
 * by the tilt rules.
 */
import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/look/GLTFLoader.js";
import { MeshoptDecoder } from "../vendor/look/meshopt_decoder.module.js";

const OUTWARD = 0.3;

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
const geoCache = new WeakMap();
const fittedBalls = new WeakSet();

const _yAxis = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _box = new THREE.Box3();
const _hide = new THREE.Matrix4().makeScale(0, 0, 0);

export function loadKit(url) {
  const key = String(url);
  if (!cache.has(key)) {
    cache.set(key, loader.loadAsync(key));
  }
  return cache.get(key);
}

export function geometryFrom(scene, name) {
  let map = geoCache.get(scene);
  if (!map) {
    map = new Map();
    geoCache.set(scene, map);
  }
  if (map.has(name)) return map.get(name);
  scene.updateMatrixWorld(true);
  const node = scene.getObjectByName(name)
    || scene.getObjectByName(name.replace(/[^A-Za-z0-9_]/g, ""));
  if (!node) throw new Error(`look kit missing ${name}`);
  let mesh = null;
  node.traverse((child) => {
    if (!mesh && child.isMesh) mesh = child;
  });
  if (!mesh) throw new Error(`look kit ${name} has no mesh`);
  const src = mesh.geometry;
  const geo = new THREE.BufferGeometry();
  const pos = src.getAttribute("position");
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    arr[i * 3] = pos.getX(i);
    arr[i * 3 + 1] = pos.getY(i);
    arr[i * 3 + 2] = pos.getZ(i);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  const col = src.getAttribute("color");
  if (col) {
    const ca = new Float32Array(col.count * 3);
    for (let i = 0; i < col.count; i++) {
      ca[i * 3] = col.getX(i);
      ca[i * 3 + 1] = col.getY(i);
      ca[i * 3 + 2] = col.getZ(i);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(ca, 3));
  }
  if (src.index) {
    const IndexArray = src.index.array.constructor;
    geo.setIndex(new THREE.BufferAttribute(new IndexArray(src.index.array), 1));
  }
  mesh.updateWorldMatrix(true, false);
  geo.applyMatrix4(mesh.matrixWorld);
  map.set(name, geo);
  return geo;
}

function edgeCenter(axis, r, c, n, step) {
  const x = axis === "h"
    ? (c - (n - 1) / 2) * step
    : ((c + 0.5) - (n - 1) / 2) * step;
  const z = axis === "h"
    ? ((r + 0.5) - (n - 1) / 2) * step
    : (r - (n - 1) / 2) * step;
  return { x, z };
}

function pair(entry) {
  if (!entry) return null;
  if (Array.isArray(entry)) return entry;
  if (entry.row != null) return [entry.row, entry.col];
  return null;
}

export function mountStage(scene, ctx, spec) {
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: spec.toneMapped !== false,
    side: THREE.DoubleSide,
  });
  const root = new THREE.Group();
  root.name = "wood-look";
  const hidden = [];
  const hide = (node) => {
    if (!node || hidden.includes(node)) return;
    hidden.push(node);
    node.visible = false;
  };
  ctx.rig.traverse((node) => {
    if (node.userData && node.userData.stockBoard) hide(node);
  });
  hide(ctx.stockHole);

  const geo = (name) => geometryFrom(scene, name);
  const { n, span, frameT, step, boardTop, cellXZ } = ctx;
  const hole = pair(ctx.hole);
  const rim = (frameT * 0.92) / OUTWARD;

  const decorate = (mesh) => {
    mesh.material = mat;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    root.add(mesh);
    return mesh;
  };

  const ground = decorate(new THREE.Mesh(geo("ground")));
  ground.scale.set(spec.island ? span + 0.95 : span, 1, spec.island ? span + 0.95 : span);
  ground.position.y = boardTop;

  const variantOf = [];
  const counts = [0, 0, 0];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (hole && r === hole[0] && c === hole[1]) {
        variantOf.push(-1);
        continue;
      }
      const v = (r * 3 + c * 5) % 3;
      variantOf.push(v);
      counts[v] += 1;
    }
  }
  for (let v = 0; v < 3; v++) {
    if (!counts[v]) continue;
    const inst = new THREE.InstancedMesh(geo(`tile_${"abc"[v]}`), mat, counts[v]);
    let i = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (variantOf[r * n + c] !== v) continue;
        const p = cellXZ(r, c);
        _quat.identity();
        _scl.set(1, 1, 1);
        _mat.compose(_pos.set(p.x, boardTop, p.z), _quat, _scl);
        inst.setMatrixAt(i++, _mat);
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    decorate(inst);
  }

  const wallSpots = [];
  const grids = [
    ["h", ctx.walls && ctx.walls.h],
    ["v", ctx.walls && ctx.walls.v],
  ];
  for (const [axis, grid] of grids) {
    if (!grid) continue;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c]) wallSpots.push({ axis, r, c });
      }
    }
  }
  const wallMap = new Map();
  let wallInst = null;
  if (wallSpots.length && ctx.wallColor) {
    wallInst = new THREE.InstancedMesh(geo("wall"), mat, wallSpots.length);
    const tint = new THREE.Color();
    wallSpots.forEach((spot, i) => {
      const p = edgeCenter(spot.axis, spot.r, spot.c, n, step);
      _quat.setFromAxisAngle(_yAxis, spot.axis === "v" ? Math.PI / 2 : 0);
      _scl.set(1, 1, 1);
      _mat.compose(_pos.set(p.x, boardTop, p.z), _quat, _scl);
      const show = stockVisible(ctx, spot);
      wallInst.setMatrixAt(i, show ? _mat : _hide);
      const name = ctx.wallColor(spot.r, spot.c, spot.axis);
      tint.setHex((spec.gems && spec.gems[name]) || 0xb5523a);
      wallInst.setColorAt(i, tint);
      wallMap.set(`${spot.axis}:${spot.r}:${spot.c}`, {
        index: i,
        show,
        full: _mat.clone(),
      });
    });
    wallInst.instanceMatrix.needsUpdate = true;
    if (wallInst.instanceColor) wallInst.instanceColor.needsUpdate = true;
    decorate(wallInst);
  }

  const rims = [[], []];
  if (!spec.island) {
  for (let c = 0; c < n; c++) {
    const x = (c - (n - 1) / 2) * step;
    rims[c % 2].push({ x, z: span / 2, ry: 0 });
    rims[(c + 1) % 2].push({ x, z: -span / 2, ry: Math.PI });
  }
  for (let r = 0; r < n; r++) {
    const z = (r - (n - 1) / 2) * step;
    rims[r % 2].push({ x: span / 2, z, ry: -Math.PI / 2 });
    rims[(r + 1) % 2].push({ x: -span / 2, z, ry: Math.PI / 2 });
  }
  ["edge_a", "edge_b"].forEach((name, index) => {
    const spots = rims[index];
    if (!spots.length) return;
    const inst = new THREE.InstancedMesh(geo(name), mat, spots.length);
    spots.forEach((spot, i) => {
      _quat.setFromAxisAngle(_yAxis, spot.ry);
      _scl.set(1, 1, rim);
      _mat.compose(_pos.set(spot.x, boardTop, spot.z), _quat, _scl);
      inst.setMatrixAt(i, _mat);
    });
    inst.instanceMatrix.needsUpdate = true;
    decorate(inst);
  });

  const corner = new THREE.InstancedMesh(geo("corner"), mat, 4);
  const cornerScale = Math.min(1.15, Math.max(0.55, frameT / 0.24));
  [
    [span / 2, span / 2, 0],
    [-span / 2, span / 2, Math.PI / 2],
    [-span / 2, -span / 2, Math.PI],
    [span / 2, -span / 2, -Math.PI / 2],
  ].forEach(([x, z, ry], i) => {
    _quat.setFromAxisAngle(_yAxis, ry);
    _scl.set(cornerScale, cornerScale, cornerScale);
    _mat.compose(_pos.set(x, boardTop, z), _quat, _scl);
    corner.setMatrixAt(i, _mat);
  });
  corner.instanceMatrix.needsUpdate = true;
  decorate(corner);
  }

  if (hole) {
    const goal = decorate(new THREE.Mesh(geo("goal")));
    const p = cellXZ(hole[0], hole[1]);
    goal.position.set(p.x, boardTop + 0.001, p.z);
  }

  const squirrel = scene.getObjectByName("squirrel").clone(true);
  squirrel.traverse((node) => {
    if (!node.isMesh) return;
    node.material = mat;
    node.castShadow = false;
    node.receiveShadow = false;
    node.frustumCulled = false;
  });
  const hero = Math.min(1.85, Math.max(1.05, span / 3.35));
  const scenery = [];
  const trees = [];
  const pose = { baseY: 0 };
  if (spec.island && ctx.world) {
    ctx.world.add(squirrel);
    scenery.push(squirrel);
    squirrel.position.set(0, -8, 0);
    pose.baseY = squirrel.position.y;
    const hillNode = scene.getObjectByName("hill");
    if (hillNode) {
      const hill = decorate(new THREE.Mesh(geo("hill")));
      root.remove(hill);
      ctx.world.add(hill);
      scenery.push(hill);
      hill.scale.set(span * 1.18, 1.45, span * 1.08);
      hill.position.set(-span * 0.06, -0.22, span * 0.04);
    }
    [
      ["tree_a", span * 0.48, -span * 0.88, span * 0.72],
      ["tree_b", -span * 0.62, -span * 0.78, span * 0.53],
    ].forEach(([name, x, z, sc]) => {
      const tree = decorate(new THREE.Mesh(geo(name)));
      root.remove(tree);
      ctx.world.add(tree);
      scenery.push(tree);
      trees.push(tree);
      tree.scale.setScalar(sc);
      tree.position.set(x, -0.12, z);
    });
  } else {
    root.add(squirrel);
    parkSky(squirrel, 0, hero * 0.74, ctx);
    pose.baseY = squirrel.position.y;
    [
      ["tree_a", -span * 0.36, hero * 0.82],
      ["tree_b", span * 0.36, hero * 0.74],
    ].forEach(([name, x, sc]) => {
      const tree = decorate(new THREE.Mesh(geo(name)));
      parkSky(tree, x, sc, ctx);
      trees.push(tree);
    });
    const third = decorate(new THREE.Mesh(geo("tree_c")));
    parkNear(third, span * 0.12, hero * 0.5, ctx);
    if (overlapsGrid(third, ctx)) root.remove(third);
    else trees.push(third);
    const propScale = Math.min(1.05, Math.max(0.62, span / 5.4));
    [
      ["stump", span * 0.28, propScale],
      ["rock", -span * 0.3, propScale * 0.9],
      ["acorn", span * 0.02, propScale * 0.85],
    ].forEach(([name, x, sc]) => {
      const prop = decorate(new THREE.Mesh(geo(name)));
      parkNear(prop, x, sc, ctx);
      if (overlapsGrid(prop, ctx)) root.remove(prop);
    });
  }

  ctx.rig.add(root);

  const ballGeo = geo("ball");
  if (!fittedBalls.has(ballGeo)) {
    ballGeo.computeBoundingSphere();
    const radius = ballGeo.boundingSphere && ballGeo.boundingSphere.radius;
    if (radius > 0.05) ballGeo.scale(ctx.ballR / radius, ctx.ballR / radius, ctx.ballR / radius);
    fittedBalls.add(ballGeo);
  }
  let oldGeo = null;
  const inks = [];
  const puffs = [];
  let puffMat = null;
  let puffGeo = null;
  if (spec.dust && hole) {
    puffGeo = new THREE.SphereGeometry(0.055, 6, 4);
    puffMat = new THREE.MeshBasicMaterial({
      color: 0xc9842a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: spec.toneMapped !== false,
    });
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(puffGeo, puffMat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      root.add(mesh);
      puffs.push(mesh);
    }
  }
  const tail = squirrel.getObjectByName("squirrel_tail");
  const eyeL = squirrel.getObjectByName("squirrel_eye_l");
  const eyeR = squirrel.getObjectByName("squirrel_eye_r");
  let cheer = 0;
  let wasNear = false;
  const holePos = hole ? cellXZ(hole[0], hole[1]) : null;

  function dressBall(mesh) {
    if (!mesh) return;
    if (!oldGeo) oldGeo = mesh.geometry;
    mesh.geometry = ballGeo;
    mesh.material = mat;
    mesh.traverse((node) => {
      if (node.name === "screen-ink" && node.visible) {
        node.visible = false;
        inks.push(node);
      }
    });
  }

  function tick(time, dt) {
    if (wallInst && ctx.fogWalls) {
      let dirty = false;
      for (const mesh of ctx.fogWalls) {
        if (!mesh.userData || mesh.userData.kind !== "wall") continue;
        const key = `${mesh.userData.axis}:${mesh.userData.r}:${mesh.userData.c}`;
        const rec = wallMap.get(key);
        if (!rec) continue;
        const show = mesh.userData.lookShow !== false;
        if (show === rec.show) continue;
        rec.show = show;
        wallInst.setMatrixAt(rec.index, show ? rec.full : _hide);
        dirty = true;
      }
      if (dirty) wallInst.instanceMatrix.needsUpdate = true;
    }
    const reduce = !!ctx.reduceMotion;
    if (tail) {
      const amp = spec.island ? 0.22 : 0.42;
      tail.rotation.y = reduce ? 0 : Math.sin(time * 2.15) * amp;
      tail.rotation.x = reduce ? 0 : Math.sin(time * 1.25) * (spec.island ? 0.05 : 0.12);
    }
    const shut = !reduce && (time % 3.5) > 3.28;
    const sy = shut ? 0.14 : 1;
    if (eyeL) eyeL.scale.y = sy;
    if (eyeR) eyeR.scale.y = sy;
    if (!reduce) {
      trees.forEach((tree, i) => {
        tree.rotation.z = Math.sin(time * 1.1 + i * 1.4) * 0.03;
      });
    }
    if (holePos && ctx.ballRoot) {
      const bp = ctx.ballRoot.position;
      const near = Math.hypot(bp.x - holePos.x, bp.z - holePos.z) < step * 0.48
        && bp.y < boardTop + ctx.ballR * 0.65;
      if (near && !wasNear) {
        cheer = 1;
        puffs.forEach((mesh) => {
          mesh.visible = true;
          mesh.userData.life = 1;
        });
      }
      wasNear = near;
    }
    const bob = spec.island && !reduce ? Math.sin(time * 1.6) * squirrel.scale.y * 0.018 : 0;
    if (cheer > 0) {
      cheer = Math.max(0, cheer - dt * 0.55);
      const hop = spec.island ? squirrel.scale.y * 0.05 : 0.16;
      squirrel.position.y = pose.baseY + bob + Math.sin(cheer * Math.PI) * hop;
      if (tail && !reduce) tail.rotation.y = Math.sin(time * 14) * (spec.island ? 0.28 : 0.55) * cheer;
    } else {
      squirrel.position.y = pose.baseY + bob;
    }
    if (puffs.length && holePos) {
      puffs.forEach((mesh, i) => {
        if (!mesh.visible) return;
        mesh.userData.life = (mesh.userData.life || 0) - dt * 0.85;
        if (mesh.userData.life <= 0) {
          mesh.visible = false;
          return;
        }
        const a = (i / puffs.length) * Math.PI * 2;
        const k = 1 - mesh.userData.life;
        mesh.position.set(
          holePos.x + Math.cos(a) * (0.12 + k * 0.28),
          boardTop + 0.06 + k * 0.22,
          holePos.z + Math.sin(a) * (0.12 + k * 0.28),
        );
        const s = 0.6 + k * 1.4;
        mesh.scale.setScalar(s);
        puffMat.opacity = mesh.userData.life * 0.55;
      });
    }
  }

  function dispose() {
    if (ctx.ballMesh && oldGeo) ctx.ballMesh.geometry = oldGeo;
    inks.forEach((node) => {
      node.visible = true;
    });
    hidden.forEach((node) => {
      node.visible = true;
    });
    scenery.forEach((node) => node.removeFromParent());
    root.removeFromParent();
    mat.dispose();
    if (puffMat) puffMat.dispose();
    if (puffGeo) puffGeo.dispose();
  }

  return { dressBall, tick, dispose, root, hero: squirrel, pose };
}

function stockVisible(ctx, spot) {
  if (!ctx.fogWalls) return true;
  for (const mesh of ctx.fogWalls) {
    if (!mesh.userData || mesh.userData.kind !== "wall") continue;
    if (mesh.userData.axis === spot.axis && mesh.userData.r === spot.r && mesh.userData.c === spot.c) {
      return mesh.userData.lookShow !== false;
    }
  }
  return true;
}

function rest(obj, x, z, sc, top) {
  obj.scale.setScalar(sc);
  obj.rotation.set(0, 0, 0);
  obj.position.set(x, 0, z);
  obj.updateWorldMatrix(true, true);
  _box.setFromObject(obj);
  obj.position.y += top - _box.min.y;
}

function parkSky(obj, x, sc, ctx) {
  rest(obj, x, 0, sc, ctx.boardTop);
  obj.updateWorldMatrix(true, true);
  _box.setFromObject(obj);
  obj.position.z += (-ctx.span / 2 - ctx.frameT * 0.08) - _box.max.z;
  nudgeClear(obj, ctx, -1);
}

function parkNear(obj, x, sc, ctx) {
  rest(obj, x, 0, sc, ctx.boardTop);
  obj.updateWorldMatrix(true, true);
  _box.setFromObject(obj);
  obj.position.z += ctx.span / 2 - _box.min.z;
  nudgeClear(obj, ctx, 1);
}

function nudgeClear(obj, ctx, dir) {
  for (let i = 0; i < 8 && overlapsGrid(obj, ctx); i++) {
    obj.position.z += dir * ctx.step * 0.22;
    obj.updateWorldMatrix(true, true);
  }
}

function overlapsGrid(obj, ctx) {
  obj.updateWorldMatrix(true, true);
  _box.setFromObject(obj);
  const pad = ctx.step * 0.46;
  for (let r = 0; r < ctx.n; r++) {
    for (let c = 0; c < ctx.n; c++) {
      const p = ctx.cellXZ(r, c);
      if (_box.max.x > p.x - pad && _box.min.x < p.x + pad
        && _box.max.z > p.z - pad && _box.min.z < p.z + pad) {
        return true;
      }
    }
  }
  return false;
}
