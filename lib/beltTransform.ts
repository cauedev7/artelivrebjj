import * as THREE from 'three';
import { BELTS, JOURNEY_START, journeyAt } from './beltJourney';

/**
 * v6.2: a faixa das Turmas se transforma conforme a rolagem, como o kimono preto do hero. São fotos de faixas
 * (catálogo "Coleção visual", em public/v62/faixas; a ordem fica em beltJourney.ts) sobre um tecido 3D levemente
 * ondulado; na troca, uma onda
 * com borda de brasa percorre a faixa da ponta de cima até a de baixo, consumindo a atual e revelando a próxima,
 * e solta faíscas. Rolando para cima, a onda volta.
 */

const IMG_W = 800;
const IMG_H = 1280;
const H = 4;
const W = (H * IMG_W) / IMG_H;
// Eixo da faixa na foto (da ponta de cima, à esquerda, até a de baixo, à direita), em UV.
const A0 = new THREE.Vector2(0.17, 0.96);
const A1 = new THREE.Vector2(0.83, 0.04);

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uSway;
  varying vec2 vUv;
  varying vec3 vN;
  void main() {
    vUv = uv;
    vec3 p = position;
    // Tecido: uma curva suave ao longo do comprimento, que ondula devagar.
    float w = sin(uv.y * 3.4 + uTime * 0.7) * 0.07 + sin(uv.x * 2.2 - uTime * 0.5) * 0.03;
    p.z += w + (uv.y - 0.5) * (uv.y - 0.5) * uSway;
    float dzdy = cos(uv.y * 3.4 + uTime * 0.7) * 0.07 * 3.4 / ${H.toFixed(2)} + (uv.y - 0.5) * 2.0 * uSway / ${H.toFixed(2)};
    float dzdx = cos(uv.x * 2.2 - uTime * 0.5) * 0.03 * 2.2 / ${W.toFixed(2)};
    vN = normalize(normalMatrix * normalize(vec3(-dzdx, -dzdy, 1.0)));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uA;
  uniform sampler2D uB;
  uniform float uT;
  uniform float uTime;
  uniform vec2 uA0;
  uniform vec2 uA1;
  varying vec2 vUv;
  varying vec3 vN;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { return noise(p) * 0.6 + noise(p * 2.3) * 0.3 + noise(p * 5.1) * 0.1; }

  void main() {
    vec4 a = texture2D(uA, vUv);
    vec4 b = texture2D(uB, vUv);
    // Posição ao longo da faixa (0 na ponta de cima, 1 na de baixo) e a frente da onda com textura de fogo.
    vec2 axis = uA1 - uA0;
    float s = dot(vUv - uA0, axis) / dot(axis, axis);
    float front = uT * 1.3 - 0.15;
    float edge = s + (fbm(vUv * vec2(9.0, 14.0) + uTime * 0.25) - 0.5) * 0.16 - front;
    float reveal = 1.0 - smoothstep(-0.012, 0.012, edge);
    vec4 col = mix(a, b, reveal);
    // Um pouco à frente da brasa, a faixa antiga escurece (como pano queimando).
    // Brasa só enquanto a troca acontece.
    float live = step(0.001, uT) * step(uT, 0.999);
    float char = smoothstep(0.09, 0.0, edge) * step(0.0, edge) * live;
    col.rgb *= 1.0 - char * 0.75;
    // Luz: o tecido ondulado pega a luz de cima e da esquerda.
    float light = 0.82 + 0.3 * max(dot(normalize(vN), normalize(vec3(-0.4, 0.6, 1.0))), 0.0);
    col.rgb *= light;
    float ember = exp(-abs(edge) * 55.0) * live * max(a.a, b.a);
    vec3 emberCol = mix(vec3(1.0, 0.18, 0.05), vec3(1.0, 0.75, 0.3), exp(-abs(edge) * 140.0));
    col.rgb += emberCol * ember * 1.6;
    col.a = max(col.a, ember * 0.9);
    if (col.a < 0.02) discard;
    gl_FragColor = col;
    // Volta as cores (lidas da foto em espaço linear) para o espaço da tela; sem isso os tons médios escurecem.
    #include <colorspace_fragment>
  }
`;

const sparkVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uT;
  uniform float uTime;
  uniform vec3 uP0;
  uniform vec3 uP1;
  uniform float uSize;
  varying float vAlpha;
  void main() {
    float front = clamp(uT * 1.3 - 0.15, 0.0, 1.0);
    float life = fract(uTime * (0.6 + aSeed * 0.8) + aSeed * 7.0);
    vec3 dir = normalize(uP1 - uP0);
    vec3 side = normalize(cross(dir, vec3(0.0, 0.0, 1.0)));
    vec3 p = mix(uP0, uP1, front) + side * (fract(aSeed * 13.7) - 0.5) * 0.5;
    p += vec3(fract(aSeed * 3.1) - 0.5, 0.6 + fract(aSeed * 5.3), 0.4 + fract(aSeed * 9.1) * 0.6) * life * 0.9;
    float live = smoothstep(0.0, 0.06, uT) * smoothstep(1.0, 0.94, uT);
    vAlpha = (1.0 - life) * live;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (1.0 - life * 0.6) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const sparkFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vec3(1.0, 0.45, 0.15) * (1.0 + a), a);
    #include <colorspace_fragment>
  }
`;

export type BeltTransformScene = {
  update(p: number, dt: number, pos: number): void;
  resize(): void;
  dispose(): void;
};

export function createBeltTransform(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  host: HTMLElement,
  opts: { mobile: boolean; onReady?: () => void },
): BeltTransformScene {
  const loader = new THREE.TextureLoader();
  const names: string[] = [...BELTS];
  const tex: Record<string, THREE.Texture> = {};
  let pending = names.length;
  for (const n of names) {
    const t = loader.load(`/v62/faixas/${n}.webp`, () => {
      pending--;
      if (pending === 0) opts.onReady?.();
    });
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    tex[n] = t;
  }

  const uniforms = {
    uA: { value: tex[names[0]] },
    uB: { value: tex[names[0]] },
    uT: { value: 0 },
    uTime: { value: 0 },
    uSway: { value: 0.25 },
    uA0: { value: A0 },
    uA1: { value: A1 },
  };
  const geo = new THREE.PlaneGeometry(W, H, 48, 96);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: fragment, transparent: true, side: THREE.DoubleSide });
  const belt = new THREE.Mesh(geo, mat);
  const pivot = new THREE.Group();
  pivot.add(belt);
  scene.add(pivot);

  // Faíscas que saem da frente da onda.
  const N = opts.mobile ? 60 : 110;
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  sGeo.setAttribute('aSeed', new THREE.BufferAttribute(Float32Array.from({ length: N }, () => Math.random()), 1));
  const toLocal = (uv: THREE.Vector2) => new THREE.Vector3((uv.x - 0.5) * W, (uv.y - 0.5) * H, 0.05);
  const sUniforms = {
    uT: uniforms.uT,
    uTime: uniforms.uTime,
    uP0: { value: toLocal(A0) },
    uP1: { value: toLocal(A1) },
    uSize: { value: (opts.mobile ? 60 : 90) * Math.min(window.devicePixelRatio || 1, 2) },
  };
  const sMat = new THREE.ShaderMaterial({
    uniforms: sUniforms,
    vertexShader: sparkVertex,
    fragmentShader: sparkFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sparks = new THREE.Points(sGeo, sMat);
  sparks.frustumCulled = false;
  belt.add(sparks);

  // No celular a faixa fica deitada, numa tira acima do carrossel; no desktop, na diagonal ao lado da lista.
  if (opts.mobile) pivot.rotation.z = 0.93;

  let time = 0;
  let posNow = JOURNEY_START;
  let first = true;
  function fit() {
    const w = Math.max(host.clientWidth, 1);
    const h = Math.max(host.clientHeight, 1);
    camera.aspect = w / h;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Desktop: a faixa inteira na altura. Celular: deitada, cabe na largura.
    const dist = opts.mobile ? (H * 1.14) / (2 * tan * camera.aspect) : (H * 1.06) / (2 * tan);
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  fit();

  return {
    update(p, dt, pos) {
      time += dt;
      // A posição da lista chega com inércia, para a onda andar suave mesmo com a rolagem aos trancos.
      posNow = first ? pos : posNow + (pos - posNow) * (1 - Math.exp(-dt * 3.5));
      first = false;
      const j = journeyAt(posNow);
      uniforms.uA.value = tex[j.from];
      uniforms.uB.value = tex[j.to];
      uniforms.uT.value = j.t;
      uniforms.uTime.value = time;
      pivot.rotation.y = -0.3 + p * 0.6;
      if (!opts.mobile) pivot.rotation.z = Math.sin(time * 0.4) * 0.02;
    },
    resize: fit,
    dispose() {
      Object.values(tex).forEach((t) => t.dispose());
      geo.dispose();
      mat.dispose();
      sGeo.dispose();
      sMat.dispose();
      void renderer;
    },
  };
}
