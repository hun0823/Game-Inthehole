/**
 * One scene render plus a short chain of fullscreen shaders.
 * The last shader keeps the source alpha so the DOM sky still shows through.
 */
import * as THREE from "../vendor/three.module.js";

export const quadVert = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

function makeRT() {
  const rt = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: true });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  rt.texture.generateMipmaps = false;
  return rt;
}

export function createChain(renderer, steps) {
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const passScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  passScene.add(quad);
  for (const mat of steps) {
    mat.toneMapped = false;
    mat.depthTest = false;
    mat.depthWrite = false;
  }
  const rts = [makeRT(), makeRT()];
  let w = 0;
  let h = 0;

  function resize() {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    const pr = renderer.getPixelRatio();
    const nw = Math.max(2, Math.floor(size.x * pr));
    const nh = Math.max(2, Math.floor(size.y * pr));
    if (nw === w && nh === h) return;
    w = nw;
    h = nh;
    rts[0].setSize(w, h);
    rts[1].setSize(w, h);
    for (const mat of steps) {
      if (mat.uniforms && mat.uniforms.resolution) mat.uniforms.resolution.value.set(w, h);
    }
  }

  return {
    render(scene, camera) {
      resize();
      const prevTarget = renderer.getRenderTarget();
      const prevClear = renderer.autoClear;
      renderer.autoClear = true;
      renderer.setRenderTarget(rts[0]);
      renderer.render(scene, camera);
      let read = 0;
      for (let i = 0; i < steps.length; i++) {
        const mat = steps[i];
        const last = i === steps.length - 1;
        mat.uniforms.tDiffuse.value = rts[read].texture;
        quad.material = mat;
        renderer.setRenderTarget(last ? null : rts[1 - read]);
        renderer.render(passScene, ortho);
        if (!last) read = 1 - read;
      }
      renderer.setRenderTarget(prevTarget);
      renderer.autoClear = prevClear;
    },
  };
}

export function glowShader(strength, threshold) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      strength: { value: strength },
      threshold: { value: threshold },
    },
    vertexShader: quadVert,
    fragmentShader: `
      precision mediump float;
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform float strength;
      uniform float threshold;
      varying vec2 vUv;
      void main() {
        vec4 base = texture2D(tDiffuse, vUv);
        vec2 px = 3.0 / max(resolution, vec2(1.0));
        vec3 acc = vec3(0.0);
        acc += max(texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb - threshold, 0.0);
        acc += max(texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb - threshold, 0.0);
        acc += max(texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb - threshold, 0.0);
        acc += max(texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb - threshold, 0.0);
        acc += max(texture2D(tDiffuse, vUv + px).rgb - threshold, 0.0) * 0.65;
        acc += max(texture2D(tDiffuse, vUv - px).rgb - threshold, 0.0) * 0.65;
        gl_FragColor = vec4(base.rgb + acc * strength, base.a);
      }
    `,
  });
}
