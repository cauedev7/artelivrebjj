import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Cena 3D do hero da versão 5: o kimono da Arte Livre como personagem principal.
 *
 * ENCARE  – o kimono flutua no dojô enevoado; poeira dourada nos raios de luz; uma luz percorre o tecido.
 * PEGUE   – a câmera chega na gola, onde se faz a pegada: close em 4K da trama.
 * DERRUBE – o kimono tomba em ângulo dramático; a poeira explode; a borda acende em vermelho;
 *           uma faixa vermelha em 3D chicoteia em volta dele.
 * EVOLUA  – o kimono volta ao centro; a faixa e os detalhes vermelhos brilham como neon; halo vermelho atrás.
 *           No fim, a câmera mergulha no nó da faixa e a tela escurece.
 *
 * O kimono é a imagem recortada (com profundidade e relevo do tecido calculados no shader, para reagir
 * à luz e mostrar volume quando a câmera gira). Pós-processamento: bloom, aberração cromática, vinheta e grão.
 */

export type KimonoScene = {
  update: (p: number, dt: number) => void;
  setPointer: (x: number, y: number) => void;
  resize: () => void;
  dispose: () => void;
};

const BG = 0x0b0a0c;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
/** Sobe de 0 a 1 entre a e b, desce de volta entre c e d. */
const band = (p: number, a: number, b: number, c: number, d: number) => smooth(clamp01((p - a) / (b - a))) * (1 - smooth(clamp01((p - c) / (d - c))));

/* ---------- Shaders do kimono ---------- */
const kimonoVertex = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uDepthScale;
  uniform vec2 uSize;
  uniform float uReflect;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  varying float vDepth;
  void main() {
    vUv = uv;
    float d = texture2D(uDepth, uv).r;
    vDepth = d;
    vec3 p = position + vec3(0.0, 0.0, d * uDepthScale);
    float e = 1.0 / 220.0;
    float dx = texture2D(uDepth, uv + vec2(e, 0.0)).r - texture2D(uDepth, uv - vec2(e, 0.0)).r;
    float dy = texture2D(uDepth, uv + vec2(0.0, e)).r - texture2D(uDepth, uv - vec2(0.0, e)).r;
    vec3 n = normalize(vec3(-dx * uDepthScale / (2.0 * e * uSize.x), -dy * uDepthScale / (2.0 * e * uSize.y), 1.0));
    vNormalW = normalize(mat3(modelMatrix) * n);
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const kimonoFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uTexel;
  uniform vec3 uCamPos;
  uniform vec3 uKeyDir;
  uniform vec3 uKeyColor;
  uniform vec3 uSweepPos;
  uniform vec3 uSweepColor;
  uniform vec3 uRimColor;
  uniform float uRim;
  uniform float uRedGlow;
  uniform float uExposure;
  uniform float uReflect;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  varying float vDepth;

  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.04) discard;

    // Relevo do tecido a partir da própria imagem (trama, costuras, dobras).
    float lx = lum(texture2D(uMap, vUv + vec2(uTexel.x, 0.0)).rgb) - lum(texture2D(uMap, vUv - vec2(uTexel.x, 0.0)).rgb);
    float ly = lum(texture2D(uMap, vUv + vec2(0.0, uTexel.y)).rgb) - lum(texture2D(uMap, vUv - vec2(0.0, uTexel.y)).rgb);
    vec3 N = normalize(vNormalW + vec3(-lx, -ly, 0.0) * 2.2);
    vec3 V = normalize(uCamPos - vWorldPos);

    vec3 L = normalize(uKeyDir);
    float ndl = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, normalize(L + V)), 0.0), 48.0) * 0.28;

    vec3 Ls = uSweepPos - vWorldPos;
    float dist = length(Ls);
    Ls /= dist;
    float att = 1.0 / (1.0 + dist * dist * 0.12);
    float ndls = max(dot(N, Ls), 0.0) * att;
    float specs = pow(max(dot(N, normalize(Ls + V)), 0.0), 70.0) * att * 0.9;

    vec3 base = tex.rgb;
    vec3 col = base * (0.3 + ndl * uKeyColor * 0.62 + ndls * uSweepColor * 0.95) + (spec * uKeyColor + specs * uSweepColor) * 0.7;

    // Contorno vermelho (luz de recorte) nas bordas e onde o tecido vira de costas para a câmera.
    float edge = 1.0 - smoothstep(0.08, 0.45, vDepth);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col += uRimColor * (fres * 0.5 + edge * 0.9) * uRim;

    // Faixa, listras e bordados vermelhos acendem como neon.
    float redness = clamp((tex.r - max(tex.g, tex.b)) * 2.4, 0.0, 1.0);
    col += vec3(0.85, 0.02, 0.05) * redness * uRedGlow * (0.4 + base.r * 0.6);

    float alpha = tex.a * uOpacity;
    if (uReflect > 0.5) {
      // Reflexo no chão: some aos poucos a partir da base do kimono.
      alpha *= 0.22 * (1.0 - smoothstep(0.0, 0.6, vUv.y));
      col *= 0.7;
    }
    gl_FragColor = vec4(col * uExposure, alpha);
  }
`;

/* ---------- Faixa vermelha 3D (artefato do kimono) ---------- */
const ribbonVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSpin;
  uniform float uRadius;
  uniform float uFlat;
  uniform float uWidth;
  varying float vS;
  varying float vV;
  varying float vShade;
  vec3 path(float s) {
    float a = s * 6.2831 * 1.35 + uTime * 1.1 + uSpin;
    float r = uRadius * (1.0 + 0.18 * sin(s * 9.0 + uTime * 1.7));
    float y = (s - 0.5) * 4.2 * (1.0 - uFlat) + sin(a * 0.5 + uTime) * 0.35;
    return vec3(cos(a) * r, y, sin(a) * r * mix(0.55, 0.35, uFlat));
  }
  void main() {
    float s = uv.x;
    float v = uv.y - 0.5;
    vS = s;
    vV = uv.y;
    vec3 c = path(s);
    vec3 t = normalize(path(s + 0.002) - c);
    vec3 radial = normalize(vec3(c.x, 0.0, c.z) + 1e-4);
    float tw = s * 14.0 + uTime * 2.0;
    vec3 side = normalize(cross(t, radial));
    vec3 dir = normalize(side * cos(tw) + radial * sin(tw));
    vShade = 0.45 + 0.55 * abs(cos(tw));
    vec3 p = c + dir * v * uWidth;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const ribbonFragment = /* glsl */ `
  uniform float uReveal;
  uniform float uOpacity;
  uniform float uGlow;
  varying float vS;
  varying float vV;
  varying float vShade;
  void main() {
    if (vS > uReveal) discard;
    // Costuras da faixa: linhas ao longo do comprimento.
    float stitch = 0.82 + 0.18 * step(0.5, fract(vV * 9.0));
    vec3 red = vec3(0.62, 0.035, 0.06) * vShade * stitch;
    red += vec3(0.9, 0.02, 0.05) * uGlow * (0.3 + vShade * 0.5);
    float tip = smoothstep(uReveal, uReveal - 0.04, vS);
    gl_FragColor = vec4(red, uOpacity * tip);
  }
`;

/** Aberração cromática, vinheta e grão de filme. */
const LensShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uAmount: { value: 0.0012 },
    uVignette: { value: 0.6 },
    uTime: { value: 0 },
    uGrain: { value: 0.035 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    uniform float uVignette;
    uniform float uTime;
    uniform float uGrain;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float d = length(c);
      vec2 off = c * uAmount * d * 4.0;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= mix(1.0, smoothstep(0.85, 0.15, d), uVignette);
      col += (rand(vUv * 1000.0 + uTime) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

function gradientTexture(stops: [number, string][], w = 64, h = 256, vertical = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const grad = vertical ? g.createLinearGradient(0, 0, 0, h) : g.createLinearGradient(0, 0, w, 0);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // Bordas laterais suaves (para os raios de luz).
  g.globalCompositeOperation = 'destination-in';
  const side = g.createLinearGradient(0, 0, w, 0);
  side.addColorStop(0, 'rgba(0,0,0,0)');
  side.addColorStop(0.5, 'rgba(0,0,0,1)');
  side.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = side;
  g.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function radialTexture(inner: string, outer: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type Key = { p: number; pos: [number, number, number]; look: [number, number, number] };

export function createKimonoScene(host: HTMLElement, opts: { mobile: boolean; onReady?: () => void }): KimonoScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const { mobile } = opts;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(BG, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const canvas = renderer.domElement;
  canvas.className = 'hero__canvas hero__canvas--space';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 14, 34);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 120);

  /* ---------- Texturas ---------- */
  const useUHD = !mobile && window.innerWidth * (window.devicePixelRatio || 1) > 2000 && renderer.capabilities.maxTextureSize >= 4096;
  const loader = new THREE.TextureLoader();
  const kimonoTex = loader.load(useUHD ? '/v5/kimono-4k.webp' : '/v5/kimono-2k.webp', () => checkReady());
  kimonoTex.colorSpace = THREE.SRGBColorSpace;
  kimonoTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const depthTex = loader.load('/v5/depth.png', () => checkReady());
  const backTex = loader.load('/v5/backdrop.webp', () => checkReady());
  backTex.colorSpace = THREE.SRGBColorSpace;
  backTex.wrapS = THREE.MirroredRepeatWrapping;
  let loaded = 0;
  function checkReady() {
    loaded++;
    if (loaded === 3) opts.onReady?.();
  }

  /* ---------- Fundo: o dojô enevoado da imagem original ---------- */
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 30),
    new THREE.MeshBasicMaterial({ map: backTex, color: new THREE.Color(0.42, 0.36, 0.32), fog: false }),
  );
  backTex.repeat.set(52 / (30 * (1280 / 2264)), 1);
  back.position.set(0, 2, -18);
  scene.add(back);

  /* ---------- Kimono ---------- */
  const H = 5.2;
  const W = H * (2316 / 4096);
  const KX = mobile ? 0 : 1.9;
  const KY = 0.15;
  const uniforms = {
    uMap: { value: kimonoTex },
    uDepth: { value: depthTex },
    uDepthScale: { value: 0.75 },
    uSize: { value: new THREE.Vector2(W, H) },
    uTexel: { value: new THREE.Vector2(1.5 / (useUHD ? 2316 : 1158), 1.5 / (useUHD ? 4096 : 2048)) },
    uCamPos: { value: new THREE.Vector3() },
    uKeyDir: { value: new THREE.Vector3(-0.6, 0.55, 0.6) },
    uKeyColor: { value: new THREE.Color(1.0, 0.82, 0.62) },
    uSweepPos: { value: new THREE.Vector3() },
    uSweepColor: { value: new THREE.Color(1.0, 0.95, 0.9) },
    uRimColor: { value: new THREE.Color(1.0, 0.1, 0.14) },
    uRim: { value: 0.6 },
    uRedGlow: { value: 0 },
    uExposure: { value: 1 },
    uReflect: { value: 0 },
    uOpacity: { value: 1 },
  };
  const kimonoMat = new THREE.ShaderMaterial({ uniforms, vertexShader: kimonoVertex, fragmentShader: kimonoFragment, transparent: true, side: THREE.DoubleSide });
  const kimonoGeo = new THREE.PlaneGeometry(W, H, mobile ? 90 : 160, mobile ? 160 : 280);
  const kimono = new THREE.Mesh(kimonoGeo, kimonoMat);
  const pivot = new THREE.Group();
  pivot.position.set(KX, KY, 0);
  pivot.add(kimono);
  scene.add(pivot);

  // Reflexo no chão brilhante (o mesmo kimono, espelhado e apagando).
  const floorY = KY - H / 2 - 0.45;
  const reflectUniforms = { ...uniforms, uReflect: { value: 1 } };
  const reflectMat = new THREE.ShaderMaterial({ uniforms: reflectUniforms, vertexShader: kimonoVertex, fragmentShader: kimonoFragment, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const reflection = new THREE.Mesh(kimonoGeo, reflectMat);
  scene.add(reflection);

  // Sombra suave no chão.
  const shadowTex = radialTexture('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)');
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.4), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(KX, floorY + 0.01, 0.2);
  scene.add(shadow);

  /* ---------- Raios de luz dourada (vindos de cima, à esquerda) ---------- */
  const rayTex = gradientTexture([
    [0, 'rgba(255,214,160,0.9)'],
    [0.55, 'rgba(255,190,120,0.25)'],
    [1, 'rgba(255,170,90,0)'],
  ]);
  const rays: THREE.Mesh[] = [];
  [
    [-2.5, 3.5, -5, 2.2, 0.55],
    [-0.6, 3.8, -6, 1.4, 0.38],
    [1.6, 4.0, -7, 2.8, 0.3],
  ].forEach(([x, y, z, w, o]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, 16),
      new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    );
    m.position.set(x, y - 4, z);
    m.rotation.z = -0.42;
    m.userData.base = o;
    scene.add(m);
    rays.push(m);
  });

  /* ---------- Poeira dourada ---------- */
  const DUST = mobile ? 650 : 1500;
  const dustPos = new Float32Array(DUST * 3);
  const dustBase = new Float32Array(DUST * 3);
  const dustVel = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const x = (Math.random() - 0.5) * 18;
    const y = (Math.random() - 0.5) * 11;
    const z = -9 + Math.random() * 13;
    dustBase.set([x, y, z], i * 3);
    dustPos.set([x, y, z], i * 3);
    dustVel[i] = 0.05 + Math.random() * 0.18;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustTex = radialTexture('rgba(255,225,180,1)', 'rgba(255,200,140,0)');
  const dustMat = new THREE.PointsMaterial({ size: mobile ? 0.07 : 0.05, map: dustTex, color: new THREE.Color(1.6, 1.25, 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  /* ---------- Faixa vermelha 3D ---------- */
  const ribbonUniforms = {
    uTime: { value: 0 },
    uSpin: { value: 0 },
    uRadius: { value: 2.4 },
    uFlat: { value: 0 },
    uWidth: { value: 0.32 },
    uReveal: { value: 0 },
    uOpacity: { value: 0 },
    uGlow: { value: 0 },
  };
  const ribbon = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1, mobile ? 260 : 480, 1),
    new THREE.ShaderMaterial({ uniforms: ribbonUniforms, vertexShader: ribbonVertex, fragmentShader: ribbonFragment, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
  );
  ribbon.frustumCulled = false;
  pivot.add(ribbon);

  /* ---------- Halo de neon (o anel do logo) atrás do kimono ---------- */
  const haloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.08, 0.14).multiplyScalar(2.4), transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.035, 12, 260), haloMat);
  halo.position.set(0, 0.1, -1.6);
  pivot.add(halo);
  const haloOuterMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.85, 0.75).multiplyScalar(1.4), transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
  const haloOuter = new THREE.Mesh(new THREE.TorusGeometry(3.75, 0.012, 8, 260), haloOuterMat);
  haloOuter.position.copy(halo.position);
  pivot.add(haloOuter);

  /* ---------- Pós-processamento ---------- */
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: mobile ? 0 : 2 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(pixelRatio);
  composer.addPass(new RenderPass(scene, camera));
  // Limiar alto: o branco do kimono não "estoura"; só o vermelho aceso e os brilhos fortes ganham bloom.
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 1.15);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const lens = new ShaderPass(LensShader);
  composer.addPass(lens);

  /* ---------- Caminho da câmera ---------- */
  const uvWorld = (u: number, v: number, z = 0.45): [number, number, number] => [KX + (u - 0.5) * W, KY + (0.5 - v) * H, z];
  const collar = uvWorld(0.52, 0.3);
  const knot = uvWorld(0.6, 0.5, 0.55);
  const add = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const C: [number, number, number] = [KX, KY, 0];
  // Em telas em pé, os planos abertos ficam mais longe para o kimono caber.
  const far = mobile ? 1.3 : 1;
  const lookX = mobile ? 0 : 0.2;
  /** Posição em órbita em volta de um alvo: ângulo para o lado (azimute), altura (elevação) e distância. */
  const orbit = (t: [number, number, number], az: number, el: number, dist: number): [number, number, number] => {
    const a = THREE.MathUtils.degToRad(az);
    const e = THREE.MathUtils.degToRad(el);
    return [t[0] + Math.sin(a) * Math.cos(e) * dist, t[1] + Math.sin(e) * dist, t[2] + Math.cos(a) * Math.cos(e) * dist];
  };
  // Um único arco: a câmera gira sempre no mesmo sentido em volta do kimono (da esquerda para a direita),
  // chega na gola, desce para o ângulo baixo do DERRUBE, volta ao plano aberto e mergulha no nó.
  const wide0: [number, number, number] = [lookX, KY, 0];
  const wide1: [number, number, number] = [lookX + 0.2, KY, 0];
  // No DERRUBE a câmera olha um pouco à esquerda do kimono, para ele ficar à direita do texto (no desktop).
  const low: [number, number, number] = add(C, [mobile ? 0 : -1.4, -0.4, 0]);
  const hero: [number, number, number] = [lookX + 0.25, KY, 0];
  const KEYS: Key[] = [
    { p: 0, pos: orbit(wide0, -9, 3, 8.8 * far), look: wide0 },
    { p: 0.15, pos: orbit(wide1, -4, 2, 7.4 * far), look: wide1 },
    { p: 0.31, pos: orbit(collar, 6, 4, 2.5), look: collar },
    { p: 0.41, pos: orbit(collar, 13, 1, 2.0), look: add(collar, [0, -0.08, 0]) },
    { p: 0.54, pos: orbit(low, 28, -12, 6.6 * far), look: low },
    { p: 0.64, pos: orbit(low, 34, -15, 6.0 * far), look: low },
    { p: 0.77, pos: orbit(hero, 10, 2, 8.6 * far), look: hero },
    { p: 0.88, pos: orbit(hero, 6, 1, 7.8 * far), look: hero },
    { p: 1, pos: add(knot, [0, 0, 0.3]), look: add(knot, [0, 0, -1]) },
  ];

  /**
   * Interpolação contínua (Hermite/Catmull-Rom com os tempos de cada ponto): a câmera passa pelos pontos
   * sem parar neles e sem mudar de direção de repente, como numa grua de cinema.
   */
  function hermite(values: number[], p: number) {
    const n = KEYS.length;
    let i = 0;
    while (i < n - 2 && p > KEYS[i + 1].p) i++;
    const t0 = KEYS[i].p;
    const t1 = KEYS[i + 1].p;
    const h = t1 - t0;
    const s = clamp01((p - t0) / h);
    const slope = (k: number) => {
      if (k === 0) return 0; // começa parada
      if (k === n - 1) return (values[k] - values[k - 1]) / (KEYS[k].p - KEYS[k - 1].p);
      return (values[k + 1] - values[k - 1]) / (KEYS[k + 1].p - KEYS[k - 1].p);
    };
    const m0 = slope(i);
    const m1 = slope(i + 1);
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * values[i] + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * values[i + 1] + (s3 - s2) * h * m1;
  }
  const track = [0, 1, 2].map((axis) => ({
    pos: KEYS.map((k) => k.pos[axis]),
    look: KEYS.map((k) => k.look[axis]),
  }));
  function camAt(p: number, pos: THREE.Vector3, look: THREE.Vector3) {
    pos.set(hermite(track[0].pos, p), hermite(track[1].pos, p), hermite(track[2].pos, p));
    look.set(hermite(track[0].look, p), hermite(track[1].look, p), hermite(track[2].look, p));
  }

  /* ---------- Estado ---------- */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let time = 0;
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  let lastP = 0;
  let speed = 0;
  let baseFov = 35;

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    camera.aspect = w / h;
    baseFov = w / h < 1 ? 44 : 35;
    camera.updateProjectionMatrix();
  }
  resize();

  function update(p: number, dt: number) {
    time += dt;
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 3);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 3);

    // Câmera: só o caminho da rolagem e um leve paralaxe do mouse (sem balanços soltos).
    camAt(p, camPos, camLook);
    camPos.x += pointer.sx * 0.12;
    camPos.y += pointer.sy * 0.08;
    // Velocidade da rolagem (não da câmera), bem suavizada: dá um leve zoom e a aberração sem tremer.
    const rate = Math.min(Math.abs(p - lastP) / Math.max(dt, 1 / 240) * 4, 1);
    lastP = p;
    speed += (rate - speed) * Math.min(1, dt * 2.2);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    const fall = band(p, 0.42, 0.53, 0.62, 0.74);
    camera.rotation.z += -fall * 0.1;
    camera.fov = baseFov + speed * 4;
    camera.updateProjectionMatrix();
    uniforms.uCamPos.value.copy(camPos);

    // Kimono: flutua; no DERRUBE tomba em ângulo dramático.
    const evolve = band(p, 0.64, 0.74, 0.92, 1.01);
    // O kimono gira devagar no sentido da rolagem (sempre para o mesmo lado) e flutua de leve.
    pivot.position.y = KY + Math.sin(time * 0.7) * 0.035 - fall * 0.45;
    pivot.rotation.y = -0.2 + p * 0.4 + fall * 0.3;
    pivot.rotation.z = -fall * 0.38;
    pivot.rotation.x = fall * 0.24;
    // Reflexo acompanha (espelhado no chão).
    reflection.position.set(pivot.position.x, 2 * floorY - pivot.position.y, 0);
    reflection.rotation.set(-pivot.rotation.x, pivot.rotation.y, -pivot.rotation.z);
    reflection.scale.set(1, -1, 1);
    shadow.material.opacity = 0.9 - fall * 0.5;

    // Luzes: uma luz branca percorre o tecido; no PEGUE ela passa rente à gola.
    const grip = band(p, 0.22, 0.3, 0.42, 0.48);
    const sweepX = Math.sin(time * 0.6) * 2.4;
    uniforms.uSweepPos.value.set(KX + sweepX * (1 - grip) + (collar[0] - KX + Math.sin(time * 1.2) * 0.9) * grip, KY + 1.4 * (1 - grip) + (collar[1] - KY + 0.25) * grip, 2.6 * (1 - grip) + 0.7 * grip);
    uniforms.uRim.value = 0.55 + fall * 1.2 + evolve * 0.5;
    uniforms.uRedGlow.value = evolve * 0.75 + fall * 0.2;
    uniforms.uExposure.value = 1 - grip * 0.2;

    // Faixa 3D: entra no DERRUBE chicoteando e vira um anel em volta no EVOLUA.
    const ribbonIn = smooth(clamp01((p - 0.43) / 0.12));
    const ribbonOut = smooth(clamp01((p - 0.9) / 0.06));
    ribbonUniforms.uTime.value = time;
    ribbonUniforms.uSpin.value = p * 9;
    ribbonUniforms.uReveal.value = ribbonIn;
    ribbonUniforms.uOpacity.value = ribbonIn * (1 - ribbonOut);
    ribbonUniforms.uFlat.value = evolve;
    ribbonUniforms.uRadius.value = 2.3 + evolve * 0.9;
    ribbonUniforms.uGlow.value = evolve * 0.5;
    ribbonUniforms.uWidth.value = 0.32 - evolve * 0.12;

    haloMat.opacity = evolve;
    haloOuterMat.opacity = evolve * 0.7;
    halo.scale.setScalar(0.8 + evolve * 0.2);
    halo.rotation.z = time * 0.2;

    // Raios de luz e poeira.
    rays.forEach((r, i) => {
      (r.material as THREE.MeshBasicMaterial).opacity = (r.userData.base as number) * (0.75 + Math.sin(time * 0.7 + i) * 0.15 + evolve * 0.6) * (1 - grip * 0.5);
    });
    const burst = band(p, 0.44, 0.52, 0.6, 0.72);
    for (let i = 0; i < DUST; i++) {
      const bx = dustBase[i * 3];
      const by = dustBase[i * 3 + 1];
      const bz = dustBase[i * 3 + 2];
      let y = by + ((time * dustVel[i]) % 11);
      if (y > 5.5) y -= 11;
      const dx = bx - KX;
      const dy = y - KY;
      dustPos[i * 3] = bx + Math.sin(time * 0.3 + i) * 0.15 + dx * burst * 0.6;
      dustPos[i * 3 + 1] = y + dy * burst * 0.6;
      dustPos[i * 3 + 2] = bz + burst * 1.5;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustMat.opacity = 0.75 + burst * 0.25;

    lens.uniforms.uTime.value = time;
    lens.uniforms.uAmount.value = 0.0012 + speed * 0.006 + fall * 0.002;
    bloom.strength = 0.5 + evolve * 0.35 + fall * 0.15;

    composer.render(dt);
  }

  function setPointer(x: number, y: number) {
    pointer.x = x;
    pointer.y = y;
  }

  function dispose() {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const m = mesh.material as THREE.Material | undefined;
      if (m) m.dispose();
    });
    [kimonoTex, depthTex, backTex, rayTex, dustTex, shadowTex].forEach((t) => t.dispose());
    composer.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return { update, setPointer, resize, dispose };
}
