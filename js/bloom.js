/**
 * A short additive bloom. The scene still draws with the renderer's own
 * tone map. Only the bright leftover is blurred and added, so a miss in the
 * extract pass cannot darken the board.
 */
import * as THREE from "./vendor/three.module.js";

const quadVs = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

function shader(fragment, uniforms) {
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: quadVs,
    fragmentShader: fragment,
    depthTest: false,
    depthWrite: false,
  });
  mat.toneMapped = false;
  return mat;
}

function target(w, h) {
  const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  return rt;
}

export function createBloom(renderer) {
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const passScene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  passScene.add(mesh);

  let w = 0;
  let h = 0;
  const sceneRT = target(2, 2);
  const halfA = target(2, 2);
  const halfB = target(2, 2);

  const brightMat = shader(`
    precision mediump float;
    uniform sampler2D tDiffuse;
    uniform float threshold;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = max(c.r, max(c.g, c.b));
      float k = smoothstep(threshold, threshold + 0.16, l);
      gl_FragColor = vec4(c * k, 1.0);
    }
  `, {
    tDiffuse: { value: null },
    threshold: { value: 0.78 },
  });

  const blurMat = shader(`
    precision mediump float;
    uniform sampler2D tDiffuse;
    uniform vec2 direction;
    uniform vec2 texel;
    varying vec2 vUv;
    void main() {
      vec2 d = direction * texel;
      vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227027;
      c += texture2D(tDiffuse, vUv + d * 1.384615).rgb * 0.316216;
      c += texture2D(tDiffuse, vUv - d * 1.384615).rgb * 0.316216;
      c += texture2D(tDiffuse, vUv + d * 3.230769).rgb * 0.070270;
      c += texture2D(tDiffuse, vUv - d * 3.230769).rgb * 0.070270;
      gl_FragColor = vec4(c, 1.0);
    }
  `, {
    tDiffuse: { value: null },
    direction: { value: new THREE.Vector2(1, 0) },
    texel: { value: new THREE.Vector2(1 / 64, 1 / 64) },
  });

  const addMat = shader(`
    precision mediump float;
    uniform sampler2D tBloom;
    uniform float strength;
    varying vec2 vUv;
    void main() {
      vec3 bloom = texture2D(tBloom, vUv).rgb * strength;
      gl_FragColor = vec4(bloom, 0.0);
    }
  `, {
    tBloom: { value: null },
    strength: { value: 0.38 },
  });
  addMat.transparent = true;
  addMat.blending = THREE.CustomBlending;
  addMat.blendEquation = THREE.AddEquation;
  addMat.blendSrc = THREE.OneFactor;
  addMat.blendDst = THREE.OneFactor;
  addMat.blendEquationAlpha = THREE.AddEquation;
  addMat.blendSrcAlpha = THREE.ZeroFactor;
  addMat.blendDstAlpha = THREE.OneFactor;

  function resize() {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    const pr = renderer.getPixelRatio();
    const nw = Math.max(2, Math.floor(size.x * pr));
    const nh = Math.max(2, Math.floor(size.y * pr));
    if (nw === w && nh === h) return;
    w = nw;
    h = nh;
    sceneRT.setSize(w, h);
    const hw = Math.max(2, w >> 1);
    const hh = Math.max(2, h >> 1);
    halfA.setSize(hw, hh);
    halfB.setSize(hw, hh);
  }

  function blit(material, to) {
    mesh.material = material;
    renderer.setRenderTarget(to);
    renderer.render(passScene, ortho);
  }

  return {
    render(scene, camera) {
      resize();
      const prev = renderer.getRenderTarget();
      const prevClear = renderer.autoClear;
      renderer.autoClear = true;
      renderer.setRenderTarget(sceneRT);
      renderer.render(scene, camera);

      brightMat.uniforms.tDiffuse.value = sceneRT.texture;
      blit(brightMat, halfA);

      blurMat.uniforms.tDiffuse.value = halfA.texture;
      blurMat.uniforms.direction.value.set(1, 0);
      blurMat.uniforms.texel.value.set(1 / halfA.width, 1 / halfA.height);
      blit(blurMat, halfB);

      blurMat.uniforms.tDiffuse.value = halfB.texture;
      blurMat.uniforms.direction.value.set(0, 1);
      blit(blurMat, halfA);

      renderer.setRenderTarget(null);
      renderer.autoClear = true;
      renderer.render(scene, camera);
      addMat.uniforms.tBloom.value = halfA.texture;
      renderer.autoClear = false;
      blit(addMat, null);
      renderer.setRenderTarget(prev);
      renderer.autoClear = prevClear;
    },
  };
}
