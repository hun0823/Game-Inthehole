/**
 * One screen-space ink hull. Thickness stays about the same in pixels
 * when the camera or the mesh scale changes.
 */
import * as THREE from "./vendor/three.module.js";

const DEFAULT_PX = 1.75;
const _size = new THREE.Vector2();

const outlineMat = new THREE.ShaderMaterial({
  uniforms: {
    uPx: { value: DEFAULT_PX },
    uFov: { value: 0.49 },
    uHeight: { value: 800 },
  },
  vertexShader: `
    uniform float uPx;
    uniform float uFov;
    uniform float uHeight;
    void main() {
      vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
      vec3 viewNormal = normalize(normalMatrix * normal);
      float dist = max(0.001, -viewPos.z);
      float worldPerPx = 2.0 * tan(uFov * 0.5) * dist / max(1.0, uHeight);
      viewPos.xyz += viewNormal * uPx * worldPerPx;
      gl_Position = projectionMatrix * viewPos;
    }
  `,
  fragmentShader: `
    void main() {
      gl_FragColor = vec4(0.07843, 0.07843, 0.07843, 1.0);
    }
  `,
  side: THREE.BackSide,
  toneMapped: false,
});

function syncOutline(renderer, camera) {
  outlineMat.uniforms.uFov.value = (camera.fov || 28) * Math.PI / 180;
  renderer.getSize(_size);
  outlineMat.uniforms.uHeight.value = Math.max(1, _size.y * renderer.getPixelRatio());
}

export function addScreenOutline(mesh, px = DEFAULT_PX) {
  if (!mesh || !mesh.geometry || mesh.userData.noInk) return null;
  outlineMat.uniforms.uPx.value = px;
  const ink = new THREE.Mesh(mesh.geometry, outlineMat);
  ink.name = "screen-ink";
  ink.userData.noInk = true;
  ink.raycast = () => {};
  ink.frustumCulled = false;
  ink.onBeforeRender = (renderer, _scene, camera) => {
    syncOutline(renderer, camera);
  };
  mesh.add(ink);
  return ink;
}
