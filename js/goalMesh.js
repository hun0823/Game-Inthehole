/**
 * Matched goal props. The board and the asset sheet both use this.
 * Positions stay in board space so the in-game hole does not move.
 */
import * as THREE from "./vendor/three.module.js";

const BOARD_TOP = 0.5;

function homePlateGeo() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.24);
  shape.lineTo(0.2, 0.06);
  shape.lineTo(0.2, -0.2);
  shape.lineTo(-0.2, -0.2);
  shape.lineTo(-0.2, 0.06);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
}

export function mountGoal(goalGroup, kind, kit) {
  const pins = [];
  let paw = null;
  const mat = kit.goalMaterial(kind);

  const addProp = (geo, material, x, y, z) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.userData.ownGeo = true;
    goalGroup.add(mesh);
    return mesh;
  };

  const sink = new THREE.Mesh(kit.goalDiscGeo, kit.sinkMat);
  sink.rotation.x = -Math.PI / 2;
  sink.position.y = BOARD_TOP + 0.02;
  goalGroup.add(sink);

  const ring = new THREE.Mesh(kit.goalTorusGeo, mat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = BOARD_TOP + 0.045;

  if (kind === "net") {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.028, 6, 24), kit.netMat);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = BOARD_TOP + 0.055;
    hoop.userData.ownGeo = true;
    goalGroup.add(hoop);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.018, 0.02), kit.netMat);
      spoke.userData.ownGeo = true;
      spoke.position.set(Math.cos(a) * 0.36, BOARD_TOP + 0.05, Math.sin(a) * 0.36);
      spoke.rotation.y = -a;
      goalGroup.add(spoke);
    }
    return { pins, paw };
  }
  if (kind === "hoop") {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.52, 0.05), kit.backMat);
    board.position.set(0, BOARD_TOP + 0.78, -0.48);
    board.userData.ownGeo = true;
    const square = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.02), kit.rimMat);
    square.position.set(0, BOARD_TOP + 0.78, -0.44);
    square.userData.ownGeo = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.028, 6, 18), kit.rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, BOARD_TOP + 0.58, -0.06);
    rim.userData.ownGeo = true;
    goalGroup.add(board, square, rim);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 5), kit.netMat);
      strand.userData.ownGeo = true;
      strand.position.set(Math.cos(a) * 0.2, BOARD_TOP + 0.44, -0.06 + Math.sin(a) * 0.2);
      goalGroup.add(strand);
    }
    return { pins, paw };
  }
  if (kind === "pins") {
    const spots = [[0.16, 0.5], [-0.16, 0.5], [0.34, 0.7], [-0.34, 0.7]];
    for (const [x, z] of spots) {
      const pin = new THREE.Group();
      pin.position.set(x, BOARD_TOP, z);
      pin.scale.setScalar(1.35);
      const body = new THREE.Mesh(kit.pinBodyGeo, kit.pinWhite);
      body.position.y = 0.16;
      const neck = new THREE.Mesh(kit.pinNeckGeo, kit.pinRed);
      neck.position.y = 0.34;
      const head = new THREE.Mesh(kit.pinHeadGeo, kit.pinWhite);
      head.position.y = 0.42;
      pin.add(body, neck, head);
      goalGroup.add(pin);
      pins.push(pin);
    }
    return { pins, paw };
  }
  if (kind === "plate") {
    const plate = addProp(homePlateGeo(), kit.pinWhite, 0, BOARD_TOP + 0.06, -0.42);
    plate.rotation.x = -Math.PI / 2;
    addProp(new THREE.BoxGeometry(0.32, 0.012, 0.018), kit.pinRed, 0, BOARD_TOP + 0.07, -0.2);
    return { pins, paw };
  }
  if (kind === "cup") {
    addProp(new THREE.CylinderGeometry(0.18, 0.14, 0.26, 14, 1, true), mat, 0, BOARD_TOP + 0.22, -0.46);
    addProp(new THREE.CylinderGeometry(0.14, 0.14, 0.035, 14), mat, 0, BOARD_TOP + 0.1, -0.46);
    const band = addProp(new THREE.TorusGeometry(0.175, 0.016, 6, 18), kit.pinWhite, 0, BOARD_TOP + 0.3, -0.46);
    band.rotation.x = Math.PI / 2;
    return { pins, paw };
  }
  if (kind === "flag") {
    addProp(new THREE.CylinderGeometry(0.02, 0.02, 0.58, 6), kit.pinWhite, 0.06, BOARD_TOP + 0.38, -0.52);
    addProp(new THREE.BoxGeometry(0.26, 0.14, 0.02), mat, 0.22, BOARD_TOP + 0.58, -0.52);
    return { pins, paw };
  }
  if (kind === "spool") {
    addProp(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 12), mat, 0, BOARD_TOP + 0.16, -0.48);
    addProp(new THREE.CylinderGeometry(0.24, 0.24, 0.045, 12), mat, 0, BOARD_TOP + 0.24, -0.48);
    addProp(new THREE.CylinderGeometry(0.24, 0.24, 0.045, 12), mat, 0, BOARD_TOP + 0.08, -0.48);
    return { pins, paw };
  }
  if (kind === "mug") {
    addProp(new THREE.CylinderGeometry(0.15, 0.12, 0.26, 14, 1, true), mat, 0, BOARD_TOP + 0.22, -0.48);
    addProp(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 14), mat, 0, BOARD_TOP + 0.1, -0.48);
    const handle = addProp(new THREE.TorusGeometry(0.08, 0.02, 6, 12), mat, 0.18, BOARD_TOP + 0.22, -0.48);
    handle.rotation.y = Math.PI / 2;
    return { pins, paw };
  }
  if (kind === "rind") {
    const flesh = addProp(new THREE.SphereGeometry(0.16, 12, 10), kit.melonFlesh, 0, BOARD_TOP + 0.16, -0.5);
    flesh.scale.set(1.15, 0.7, 0.42);
    const left = addProp(new THREE.BoxGeometry(0.07, 0.24, 0.18), mat, -0.16, BOARD_TOP + 0.18, -0.5);
    left.rotation.z = 0.4;
    const right = addProp(new THREE.BoxGeometry(0.07, 0.24, 0.18), mat, 0.16, BOARD_TOP + 0.18, -0.5);
    right.rotation.z = -0.4;
    return { pins, paw };
  }
  if (kind === "lamp") {
    addProp(new THREE.SphereGeometry(0.16, 14, 12), kit.ballMaterials.disco || mat, 0, BOARD_TOP + 0.34, -0.48);
    return { pins, paw };
  }
  if (kind === "hoard") {
    addProp(new THREE.CylinderGeometry(0.18, 0.18, 0.045, 14), mat, -0.06, BOARD_TOP + 0.1, -0.46);
    addProp(new THREE.CylinderGeometry(0.15, 0.15, 0.045, 14), mat, 0.08, BOARD_TOP + 0.16, -0.48);
    addProp(new THREE.CylinderGeometry(0.12, 0.12, 0.045, 14), mat, 0, BOARD_TOP + 0.22, -0.44);
    return { pins, paw };
  }
  if (kind === "paw") {
    const group = new THREE.Group();
    group.position.set(0, BOARD_TOP + 0.42, -0.58);
    group.rotation.x = -0.55;
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), mat);
    pad.scale.set(1.25, 0.42, 1.05);
    pad.userData.ownGeo = true;
    group.add(pad);
    for (let i = 0; i < 4; i++) {
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), mat);
      toe.position.set(-0.15 + i * 0.1, 0.06, -0.12);
      toe.scale.y = 0.55;
      toe.userData.ownGeo = true;
      group.add(toe);
    }
    goalGroup.add(group);
    paw = group;
    return { pins, paw };
  }
  if (kind === "pixels") {
    kit.pixelBlockMats.forEach((blockMat, i) => {
      addProp(new THREE.BoxGeometry(0.18, 0.18, 0.18), blockMat, (i - 1) * 0.04, BOARD_TOP + 0.14 + i * 0.18, -0.48);
    });
    return { pins, paw };
  }
  if (kind === "rocket") {
    addProp(new THREE.CylinderGeometry(0.08, 0.1, 0.32, 8), kit.pinWhite, 0, BOARD_TOP + 0.26, -0.48);
    addProp(new THREE.ConeGeometry(0.09, 0.14, 8), kit.goalMaterial("flag"), 0, BOARD_TOP + 0.48, -0.48);
    return { pins, paw };
  }
  if (kind === "cauldron") {
    const pot = addProp(new THREE.SphereGeometry(0.22, 14, 12), mat, 0, BOARD_TOP + 0.16, -0.48);
    pot.scale.y = 0.7;
    return { pins, paw };
  }
  if (kind === "snowman") {
    const scales = [0.22, 0.16, 0.11];
    let y = BOARD_TOP + 0.16;
    scales.forEach((s, i) => {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 10), mat);
      ball.position.set(0, y, -0.55);
      ball.userData.ownGeo = true;
      goalGroup.add(ball);
      y += s + scales[Math.min(i + 1, 2)] * 0.85;
    });
    return { pins, paw };
  }
  if (kind === "bucket") {
    addProp(new THREE.CylinderGeometry(0.22, 0.16, 0.28, 12, 1, true), mat, 0, BOARD_TOP + 0.24, -0.5);
    return { pins, paw };
  }
  if (kind === "stump") {
    addProp(new THREE.CylinderGeometry(0.28, 0.32, 0.22, 10), mat, 0, BOARD_TOP + 0.16, -0.48);
    return { pins, paw };
  }
  if (kind === "pedestal") {
    addProp(new THREE.CylinderGeometry(0.16, 0.22, 0.28, 10), mat, 0, BOARD_TOP + 0.2, -0.46);
    return { pins, paw };
  }
  if (kind === "cog") {
    goalGroup.add(ring);
    for (let i = 0; i < 8; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.1), mat);
      const a = (i / 8) * Math.PI * 2;
      tooth.position.set(Math.cos(a) * 0.48, BOARD_TOP + 0.05, Math.sin(a) * 0.48);
      tooth.userData.ownGeo = true;
      goalGroup.add(tooth);
    }
    return { pins, paw };
  }
  goalGroup.add(ring);
  return { pins, paw };
}

const GOAL_LOOKS = {
  knot: { color: 0xa86a32, emissive: 0x5a3010, roughness: 0.58 },
  oasis: { color: 0xd08a3a, emissive: 0x8a4a18, roughness: 0.78 },
  crystal: { color: 0xd8e6ff, emissive: 0x88a0e0, roughness: 0.16, metalness: 0.08, clearcoat: 0.55 },
  rim: { color: 0x1a1a1a, emissive: 0x000000, roughness: 0.9 },
  puddle: { color: 0x2fbf3e, emissive: 0x145c22, roughness: 0.32 },
  dish: { color: 0xff8ab0, emissive: 0xe05080, roughness: 0.32 },
  crater: { color: 0x4a2018, emissive: 0xff6a18, roughness: 0.62 },
  nest: { color: 0x3d7a3a, emissive: 0x1a4018, roughness: 0.74 },
  glow: { color: 0xc8b0ff, emissive: 0x7a4ad0, roughness: 0.28 },
  cog: { color: 0xb0b8c4, emissive: 0x5a6470, roughness: 0.34, metalness: 0.65 },
  stump: { color: 0x8a5a32, emissive: 0x3a2010, roughness: 0.84 },
  bucket: { color: 0xf2c15a, emissive: 0xc47a20, roughness: 0.42 },
  pedestal: { color: 0xff5b9a, emissive: 0xc43d6c, roughness: 0.4 },
  snowman: { color: 0xf4fbff, emissive: 0x9ec8e8, roughness: 0.42 },
  plate: { color: 0xf4f1ea, emissive: 0x000000, roughness: 0.46 },
  cup: { color: 0xd4ee14, emissive: 0x000000, roughness: 0.55 },
  flag: { color: 0xd42828, emissive: 0x6a1010, roughness: 0.42 },
  spool: { color: 0xe7c4a8, emissive: 0x8a5a40, roughness: 0.55 },
  mug: { color: 0xf4f7fb, emissive: 0x000000, roughness: 0.32 },
  rind: { color: 0x127338, emissive: 0x0c3a18, roughness: 0.58 },
  lamp: { color: 0xd8dee8, emissive: 0x8aa0c0, roughness: 0.22, metalness: 0.7 },
  hoard: { color: 0xf2c14a, emissive: 0xc47a20, roughness: 0.32, metalness: 0.45 },
  paw: { color: 0xf2c9a0, emissive: 0xc48a62, roughness: 0.62 },
  pixels: { color: 0x3a6cff, emissive: 0x1a3088, roughness: 0.55 },
  rocket: { color: 0xf4f4f6, emissive: 0x000000, roughness: 0.4 },
  cauldron: { color: 0x3a2458, emissive: 0x6a30a0, roughness: 0.45 },
};

export function createGoalKit(ballMaterials) {
  const goalMats = new Map();
  function goalMaterial(kind) {
    if (goalMats.has(kind)) return goalMats.get(kind);
    const look = GOAL_LOOKS[kind] || GOAL_LOOKS.knot;
    const mat = new THREE.MeshStandardMaterial({
      color: look.color,
      emissive: look.emissive,
      emissiveIntensity: look.emissive ? 0.35 : 0,
      roughness: look.roughness,
      metalness: look.metalness || 0,
    });
    goalMats.set(kind, mat);
    return mat;
  }
  return {
    goalMaterial,
    goalDiscGeo: new THREE.CircleGeometry(0.3, 28),
    goalTorusGeo: new THREE.TorusGeometry(0.4, 0.07, 8, 28),
    sinkMat: new THREE.MeshBasicMaterial({ color: 0x14080c }),
    netMat: new THREE.MeshStandardMaterial({ color: 0xf7f7f7, roughness: 0.55, side: THREE.DoubleSide }),
    rimMat: new THREE.MeshStandardMaterial({ color: 0xe85a12, roughness: 0.42 }),
    backMat: new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.5 }),
    pinWhite: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.42 }),
    pinRed: new THREE.MeshStandardMaterial({ color: 0xd42828, roughness: 0.4 }),
    melonFlesh: new THREE.MeshStandardMaterial({ color: 0xe23b4a, roughness: 0.42, emissive: 0x8a2030, emissiveIntensity: 0.18 }),
    pinBodyGeo: new THREE.CylinderGeometry(0.055, 0.085, 0.3, 8),
    pinNeckGeo: new THREE.CylinderGeometry(0.032, 0.046, 0.08, 8),
    pinHeadGeo: new THREE.SphereGeometry(0.055, 8, 6),
    ballMaterials,
    pixelBlockMats: [
      new THREE.MeshStandardMaterial({ color: 0x3a6cff, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: 0xffd24a, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: 0xff5a5a, roughness: 0.55 }),
    ],
  };
}

export function clearGoal(goalGroup) {
  const geos = new Set();
  goalGroup.traverse((node) => {
    if (node.userData.ownGeo && node.geometry) geos.add(node.geometry);
  });
  geos.forEach((geo) => geo.dispose());
  goalGroup.clear();
}
