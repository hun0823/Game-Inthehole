/**
 * Seams that have to read at phone size. They ride on the spinning ball.
 */
import * as THREE from "./vendor/three.module.js";

const R = 0.392;

function tube(points, radius, material, closed) {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  const geo = new THREE.TubeGeometry(curve, closed ? 96 : 48, radius, 5, closed);
  const mesh = new THREE.Mesh(geo, material);
  mesh.userData.ownGeo = true;
  return mesh;
}

function sideSeam(sign) {
  const pts = [];
  for (let i = 0; i <= 28; i++) {
    const t = (i / 28) * Math.PI;
    const y = Math.cos(t);
    const bulge = Math.sin(t);
    const x = sign * (0.16 + 0.7 * bulge);
    const z = 0.08 + 0.62 * bulge;
    const len = Math.hypot(x, y, z) || 1;
    pts.push(new THREE.Vector3((x / len) * R, (y / len) * R, (z / len) * R));
  }
  return pts;
}

function stitches(group, pts, material) {
  const geo = new THREE.BoxGeometry(0.034, 0.008, 0.012);
  for (let i = 2; i < pts.length - 1; i += 3) {
    const p = pts[i];
    const tangent = pts[i + 1].clone().sub(pts[i - 1]).normalize();
    const normal = p.clone().normalize();
    const side = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    const tick = new THREE.Mesh(geo, material);
    const basis = new THREE.Matrix4().makeBasis(side, normal, tangent);
    tick.quaternion.setFromRotationMatrix(basis);
    tick.position.copy(normal).multiplyScalar(0.404);
    group.add(tick);
  }
}

function tennisCurve() {
  const pts = [];
  for (let i = 0; i < 80; i++) {
    const t = (i / 80) * Math.PI * 2;
    const x = Math.cos(t);
    const z = Math.sin(t);
    const y = 0.62 * Math.sin(2 * t);
    const len = Math.hypot(x, y, z) || 1;
    pts.push(new THREE.Vector3((x / len) * R, (y / len) * R, (z / len) * R));
  }
  return pts;
}

export function addSportMarks(parent) {
  const baseball = new THREE.Group();
  const tennis = new THREE.Group();
  baseball.visible = false;
  tennis.visible = false;
  const red = new THREE.MeshStandardMaterial({ color: 0xc4232a, roughness: 0.42 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f6f2, roughness: 0.48 });
  for (const sign of [1, -1]) {
    const pts = sideSeam(sign);
    baseball.add(tube(pts, 0.015, red, false));
    stitches(baseball, pts, red);
  }
  tennis.add(tube(tennisCurve(), 0.02, white, true));
  parent.add(baseball, tennis);
  return {
    show(id) {
      baseball.visible = id === "baseball";
      tennis.visible = id === "tennis";
    },
  };
}
