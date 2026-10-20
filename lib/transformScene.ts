import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { LensShader, band, clamp01, createRibbon, radialTexture, rayTexture, smooth, track } from './sceneKit';

/**
 * Hero da versão 6: um kimono preto, liso, sem academia, se transforma no kimono da Arte Livre BJJ.
 *
 * ENCARE  – o kimono preto (calça e faixa branca) flutua no dojô, em base, como se vestisse um atleta invisível.
 * PEGUE   – close na gola; as mangas avançam como braços indo para a pegada.
 * DERRUBE – o kimono torce e cai; uma onda de brasa sobe das pernas para cima: o preto queima em faíscas
 *           e revela o kimono branco da Arte Livre; a calça vira poeira; a faixa branca se solta e voa,
 *           ficando vermelha no caminho.
 * EVOLUA  – o kimono da Arte Livre inteiro, em postura de vitória; a câmera passa pelo emblema e pela tira
 *           "ARTE LIVRE"; a faixa vermelha volta e se amarra; halo de neon; mergulho no nó da faixa.
 */

export type TransformScene = {
  update: (p: number, dt: number) => void;
  setPointer: (x: number, y: number) => void;
  resize: () => void;
  dispose: () => void;
};

const BG = 0x0b0a0c;

/* ---------- Shader das roupas (os dois kimonos usam o mesmo) ---------- */
const garmentVertex = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uDepthScale;
  uniform vec2 uSize;
  uniform mat4 uLocal;   // plano -> espaço do pivô
  uniform mat4 uParent;  // pivô -> mundo (no reflexo, já espelhado no chão)
  uniform vec4 uPose;    // manga esq., manga dir., inclinação do tronco, pernas
  uniform float uChest;
  uniform vec4 uRig;     // x do ombro, y do ombro, y do quadril, x onde a manga começa
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  varying float vDepth;
  varying vec2 vPivot;

  vec2 rot(vec2 p, vec2 c, float a) {
    float s = sin(a);
    float co = cos(a);
    p -= c;
    return vec2(p.x * co - p.y * s, p.x * s + p.y * co) + c;
  }

  // O "atleta invisível": pernas giram no quadril, o tronco inclina, as mangas giram nos ombros.
  vec2 deform(vec2 q) {
    float legW = smoothstep(uRig.z, uRig.z - 1.2, q.y);
    float side = q.x >= 0.0 ? 1.0 : -1.0;
    q = mix(q, rot(q, vec2(0.0, uRig.z), uPose.w * side), legW);
    float upW = smoothstep(uRig.z - 0.3, uRig.z + 0.9, q.y);
    q = mix(q, rot(q, vec2(0.0, uRig.z), uPose.z), upW);
    float band = smoothstep(uRig.y - 1.7, uRig.y - 0.6, q.y);
    float wl = smoothstep(-uRig.w, -uRig.w - 0.55, q.x) * band;
    q = mix(q, rot(q, vec2(-uRig.x, uRig.y), uPose.x), wl);
    float wr = smoothstep(uRig.w, uRig.w + 0.55, q.x) * band;
    q = mix(q, rot(q, vec2(uRig.x, uRig.y), uPose.y), wr);
    float chestW = smoothstep(uRig.z, uRig.y, q.y) * (1.0 - smoothstep(0.6, 1.4, abs(q.x)));
    q.x *= 1.0 + uChest * chestW;
    return q;
  }

  void main() {
    vUv = uv;
    float d = texture2D(uDepth, uv).r;
    vDepth = d;
    vec3 p = position + vec3(0.0, 0.0, d * uDepthScale);
    vec4 lp = uLocal * vec4(p, 1.0);
    lp.xy = deform(lp.xy);
    vPivot = lp.xy;
    float e = 1.0 / 220.0;
    float dx = texture2D(uDepth, uv + vec2(e, 0.0)).r - texture2D(uDepth, uv - vec2(e, 0.0)).r;
    float dy = texture2D(uDepth, uv + vec2(0.0, e)).r - texture2D(uDepth, uv - vec2(0.0, e)).r;
    vec3 n = normalize(vec3(-dx * uDepthScale / (2.0 * e * uSize.x), -dy * uDepthScale / (2.0 * e * uSize.y), 1.0));
    vNormalW = normalize(mat3(uParent) * mat3(uLocal) * n);
    vec4 wp = uParent * lp;
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const garmentFragment = /* glsl */ `
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
  uniform float uLift;
  uniform float uReflect;
  uniform float uMode;    // 0 = kimono preto (some com a onda), 1 = Arte Livre (aparece com a onda)
  uniform float uWave;    // frente da onda: 0 = pés, 1 = acima da gola
  uniform vec2 uWaveRange;
  uniform float uEmber;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  varying float vDepth;
  varying vec2 vPivot;

  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.04) discard;

    // Onda da transformação, no espaço do pivô (igual para os dois kimonos, então a costura bate).
    float t = (vPivot.y - uWaveRange.x) / (uWaveRange.y - uWaveRange.x);
    t += (noise(vPivot * 2.2) * 0.6 + noise(vPivot * 7.0) * 0.4 - 0.5) * 0.22;
    float diff = t - uWave;
    if (uMode < 0.5 && diff < 0.0) discard;
    if (uMode > 0.5 && diff > 0.0) discard;

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

    // Clareia só as partes escuras (a trama do kimono preto); o branco da faixa não estoura.
    vec3 base = tex.rgb * mix(uLift, 1.0, smoothstep(0.2, 0.65, lum(tex.rgb)));
    vec3 col = base * (0.3 + ndl * uKeyColor * 0.62 + ndls * uSweepColor * 0.95) + (spec * uKeyColor + specs * uSweepColor) * 0.7;
    float edgeD = 1.0 - smoothstep(0.08, 0.45, vDepth);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col += uRimColor * (fres * 0.5 + edgeD * 0.9) * uRim;
    float redness = clamp((tex.r - max(tex.g, tex.b)) * 2.4, 0.0, 1.0);
    col += vec3(0.85, 0.02, 0.05) * redness * uRedGlow * (0.4 + tex.r * 0.6);

    // Brasa na frente da onda (acima de 1, então ganha bloom) e o preto chamuscado logo antes dela.
    float edge = 1.0 - smoothstep(0.0, 0.05, abs(diff));
    vec3 ember = mix(vec3(1.0, 0.16, 0.04), vec3(1.0, 0.6, 0.2), edge) * 3.2;
    col = mix(col, ember, edge * edge * uEmber);
    if (uMode < 0.5) col *= 1.0 - (1.0 - smoothstep(0.0, 0.12, diff)) * 0.65 * uEmber;

    float alpha = tex.a;
    if (uReflect > 0.5) {
      alpha *= 0.2 * (1.0 - smoothstep(0.0, 0.55, vUv.y));
      col *= 0.7;
    }
    gl_FragColor = vec4(col * uExposure, alpha);
  }
`;

/* ---------- Faíscas que sobem da frente da onda ---------- */
const emberVertex = /* glsl */ `
  attribute vec3 aSeed;
  uniform float uWave;
  uniform vec2 uWaveRange;
  uniform mat4 uParent;
  uniform float uSize;
  varying float vAlpha;
  varying float vHeat;
  void main() {
    float age = clamp((uWave - aSeed.y) / 0.22, 0.0, 1.0);
    float alive = step(0.001, age) * (1.0 - step(0.999, age));
    float y = mix(uWaveRange.x, uWaveRange.y, aSeed.y) + age * (1.2 + aSeed.z * 1.4);
    float halfW = mix(1.15, 1.6, smoothstep(0.35, 0.65, aSeed.y));
    float x = aSeed.x * halfW + aSeed.x * age * 0.7 + sin(age * 6.0 + aSeed.z * 10.0) * 0.12 * age;
    float z = 0.45 + (aSeed.z - 0.5) * 0.9 + age * 0.6;
    vec4 wp = uParent * vec4(x, y, z, 1.0);
    vec4 mv = viewMatrix * wp;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.5 + aSeed.z) * (1.0 - age * 0.6) / -mv.z;
    vAlpha = alive * sin(age * 3.1416);
    vHeat = 1.0 - age;
  }
`;
const emberFragment = /* glsl */ `
  varying float vAlpha;
  varying float vHeat;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, d);
    vec3 col = mix(vec3(1.0, 0.12, 0.04), vec3(1.0, 0.7, 0.3), vHeat) * 3.0;
    gl_FragColor = vec4(col, soft * vAlpha);
  }
`;

type V3 = [number, number, number];

export function createTransformScene(host: HTMLElement, opts: { mobile: boolean; onReady?: () => void }): TransformScene | null {
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
  scene.fog = new THREE.Fog(BG, 14, 36);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 120);

  /* ---------- Texturas ---------- */
  const useUHD = !mobile && window.innerWidth * (window.devicePixelRatio || 1) > 2000 && renderer.capabilities.maxTextureSize >= 4096;
  const loader = new THREE.TextureLoader();
  let loaded = 0;
  const done = () => {
    loaded++;
    if (loaded === 5) opts.onReady?.();
  };
  const colorTex = (url: string) => {
    const t = loader.load(url, done);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  };
  const blackTex = colorTex(useUHD ? '/v6/kimono-preto-4k.webp' : '/v6/kimono-preto-2k.webp');
  const whiteTex = colorTex(useUHD ? '/v5/kimono-4k.webp' : '/v5/kimono-2k.webp');
  const blackDepth = loader.load('/v6/depth-preto.png', done);
  const whiteDepth = loader.load('/v5/depth.png', done);
  const backTex = loader.load('/v5/backdrop.webp', done);
  backTex.colorSpace = THREE.SRGBColorSpace;
  backTex.wrapS = THREE.MirroredRepeatWrapping;

  /* ---------- Fundo ---------- */
  const back = new THREE.Mesh(new THREE.PlaneGeometry(52, 30), new THREE.MeshBasicMaterial({ map: backTex, color: new THREE.Color(0.36, 0.31, 0.28), fog: false }));
  backTex.repeat.set(52 / (30 * (1280 / 2264)), 1);
  back.position.set(0, 1.5, -18);
  scene.add(back);

  /* ---------- Os dois kimonos, alinhados pela gola e pela faixa ---------- */
  // Kimono da Arte Livre: centro do pivô, 5,2 de altura. O preto (com calça) é maior e fica um pouco abaixo.
  const HW = 5.2;
  const WW = HW * (2316 / 4096);
  const HB = HW / 0.822;
  const WB = HB * (943 / 1667);
  const blackOffset = new THREE.Vector3(0.007, -0.49, -0.02);
  const KX = mobile ? 0 : 1.9;
  const KY = 0.45;
  const waveRange = new THREE.Vector2(blackOffset.y - HB / 2, blackOffset.y + HB / 2 + 0.1);

  const pivot = new THREE.Group();
  pivot.position.set(KX, KY, 0);
  scene.add(pivot);

  const shared = {
    uCamPos: { value: new THREE.Vector3() },
    uKeyDir: { value: new THREE.Vector3(-0.6, 0.55, 0.6) },
    uKeyColor: { value: new THREE.Color(1.0, 0.82, 0.62) },
    uSweepPos: { value: new THREE.Vector3() },
    uSweepColor: { value: new THREE.Color(1.0, 0.95, 0.9) },
    uRimColor: { value: new THREE.Color(1.0, 0.1, 0.14) },
    uRim: { value: 0.6 },
    uExposure: { value: 1 },
    uPose: { value: new THREE.Vector4() },
    uChest: { value: 0 },
    uRig: { value: new THREE.Vector4(0.75, 1.35, -0.15, 0.85) },
    uWave: { value: -0.25 },
    uWaveRange: { value: waveRange },
    uEmber: { value: 0 },
  };

  function makeGarment(map: THREE.Texture, depth: THREE.Texture, w: number, h: number, texW: number, texH: number, mode: number, lift: number, offset: THREE.Vector3) {
    const local = new THREE.Matrix4().makeTranslation(offset.x, offset.y, offset.z);
    const own = {
      uMap: { value: map },
      uDepth: { value: depth },
      uDepthScale: { value: 0.75 },
      uSize: { value: new THREE.Vector2(w, h) },
      uTexel: { value: new THREE.Vector2(1.5 / texW, 1.5 / texH) },
      uLocal: { value: local },
      uRedGlow: { value: 0 },
      uLift: { value: lift },
      uMode: { value: mode },
    };
    const geo = new THREE.PlaneGeometry(w, h, mobile ? 90 : 150, mobile ? 170 : 300);
    const mk = (reflect: number) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...shared, ...own, uParent: { value: new THREE.Matrix4() }, uReflect: { value: reflect } },
        vertexShader: garmentVertex,
        fragmentShader: garmentFragment,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: reflect === 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      scene.add(mesh);
      return { mesh, mat };
    };
    return { main: mk(0), mirror: mk(1), own };
  }
  const texW = useUHD ? 2316 : 1158;
  const texH = useUHD ? 4096 : 2048;
  const black = makeGarment(blackTex, blackDepth, WB, HB, texW, texH, 0, 2.1, blackOffset);
  const white = makeGarment(whiteTex, whiteDepth, WW, HW, texW, texH, 1, 1.0, new THREE.Vector3(0, 0, 0.02));
  const floorY = KY + waveRange.x - 0.3;
  const mirrorM = new THREE.Matrix4().makeTranslation(0, floorY, 0).multiply(new THREE.Matrix4().makeScale(1, -1, 1)).multiply(new THREE.Matrix4().makeTranslation(0, -floorY, 0));

  const shadowTex = radialTexture('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)');
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.5), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(KX, floorY + 0.01, 0.2);
  scene.add(shadow);

  /* ---------- Faíscas ---------- */
  const EMBERS = mobile ? 420 : 950;
  const seeds = new Float32Array(EMBERS * 3);
  for (let i = 0; i < EMBERS; i++) seeds.set([Math.random() * 2 - 1, Math.random() * 0.98, Math.random()], i * 3);
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EMBERS * 3), 3));
  emberGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  const emberUniforms = { uWave: shared.uWave, uWaveRange: shared.uWaveRange, uParent: { value: new THREE.Matrix4() }, uSize: { value: mobile ? 70 : 95 } };
  const embers = new THREE.Points(
    emberGeo,
    new THREE.ShaderMaterial({ uniforms: emberUniforms, vertexShader: emberVertex, fragmentShader: emberFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  embers.frustumCulled = false;
  scene.add(embers);

  /* ---------- Raios de luz e poeira ---------- */
  const rayTex = rayTexture();
  const rays: THREE.Mesh[] = [];
  [
    [-2.5, 3.5, -5, 2.2, 0.5],
    [-0.6, 3.8, -6, 1.4, 0.34],
    [1.6, 4.0, -7, 2.8, 0.26],
  ].forEach(([x, y, z, w, o]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 16), new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.position.set(x, y - 4, z);
    m.rotation.z = -0.42;
    m.userData.base = o;
    scene.add(m);
    rays.push(m);
  });
  const DUST = mobile ? 550 : 1300;
  const dustPos = new Float32Array(DUST * 3);
  const dustBase = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    const v: V3 = [(Math.random() - 0.5) * 18, (Math.random() - 0.5) * 11, -9 + Math.random() * 13];
    dustBase.set(v, i * 3);
    dustPos.set(v, i * 3);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustTex = radialTexture('rgba(255,225,180,1)', 'rgba(255,200,140,0)');
  const dustMat = new THREE.PointsMaterial({ size: mobile ? 0.07 : 0.05, map: dustTex, color: new THREE.Color(1.5, 1.2, 0.85), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(dustGeo, dustMat));

  /* ---------- Faixa 3D (sai branca do kimono preto, fica vermelha e volta a se amarrar) ---------- */
  const ribbon = createRibbon(mobile ? 260 : 480);
  ribbon.mesh.position.set(0, -0.05, 0);
  pivot.add(ribbon.mesh);
  const beltWhite = new THREE.Color(0.86, 0.85, 0.82);
  const beltRed = new THREE.Color(0.62, 0.035, 0.06);

  /* ---------- Halo de neon ---------- */
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
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 1.15);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const lens = new ShaderPass(LensShader);
  composer.addPass(lens);

  /* ---------- Caminho da câmera (contínuo, sempre girando no mesmo sentido) ---------- */
  const pv = (x: number, y: number, z = 0.45): V3 => [KX + x, KY + y, z];
  const uvWhite = (u: number, v: number, z = 0.45): V3 => pv((u - 0.5) * WW, (0.5 - v) * HW, z);
  // Lapela do kimono preto, na altura do peito: onde se faz a pegada.
  const collar = pv(-0.18, 1.15);
  const emblem = uvWhite(0.3, 0.27);
  const stripe = uvWhite(0.66, 0.36);
  const knot = uvWhite(0.6, 0.5, 0.55);
  const far = mobile ? 1.3 : 1;
  const lookX = mobile ? 0 : 0.2;
  const orbit = (t: V3, az: number, el: number, d: number): V3 => {
    const a = THREE.MathUtils.degToRad(az);
    const e = THREE.MathUtils.degToRad(el);
    return [t[0] + Math.sin(a) * Math.cos(e) * d, t[1] + Math.sin(e) * d, t[2] + Math.cos(a) * Math.cos(e) * d];
  };
  const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const wide0: V3 = [lookX, KY - 0.45, 0];
  const wide1: V3 = [lookX + 0.2, KY - 0.3, 0];
  const low: V3 = add([KX, KY, 0], [mobile ? 0 : -1.4, -0.15, 0]);
  const hero: V3 = [lookX + 0.25, KY, 0];
  const keys: { p: number; pos: V3; look: V3 }[] = [
    { p: 0, pos: orbit(wide0, -9, 3, 10.8 * far), look: wide0 },
    { p: 0.15, pos: orbit(wide1, -4, 2, 9.4 * far), look: wide1 },
    { p: 0.3, pos: orbit(collar, 6, 4, 2.6), look: collar },
    { p: 0.4, pos: orbit(collar, 12, 1, 2.1), look: add(collar, [0, -0.08, 0]) },
    { p: 0.52, pos: orbit(low, 24, -10, 9.4 * far), look: low },
    { p: 0.63, pos: orbit(low, 30, -12, 8.6 * far), look: low },
    { p: 0.73, pos: orbit(emblem, 14, 3, 2.7), look: emblem },
    { p: 0.8, pos: orbit(stripe, 6, 1, 2.5), look: stripe },
    { p: 0.89, pos: orbit(hero, 4, 1, 8.2 * far), look: hero },
    { p: 1, pos: add(knot, [0, 0, 0.3]), look: add(knot, [0, 0, -1]) },
  ];
  const times = keys.map((k) => k.p);
  const camTrack = track(times, [0, 1, 2].map((a) => keys.map((k) => k.pos[a])));
  const lookTrack = track(times, [0, 1, 2].map((a) => keys.map((k) => k.look[a])));

  // Poses do atleta invisível (mesmos tempos da câmera): manga esq., manga dir., tronco, pernas, peito.
  const poseTimes = [0, 0.18, 0.3, 0.4, 0.52, 0.62, 0.74, 0.86, 1];
  const poseTrack = track(poseTimes, [
    [0.04, 0.0, -0.22, -0.26, 0.1, 0.14, -0.26, -0.3, -0.24],
    [-0.04, 0.0, 0.22, 0.26, 0.28, 0.2, 0.26, 0.3, 0.24],
    [0, 0.02, -0.04, -0.05, 0.14, 0.18, -0.02, 0, 0],
    [0.05, 0.07, 0.09, 0.1, 0.22, 0.26, 0.12, 0.08, 0.06],
    [0, 0, 0, 0, 0, 0, 0.05, 0.06, 0.04],
  ]);

  /* ---------- Estado ---------- */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let time = 0;
  let lastP = 0;
  let speed = 0;
  let baseFov = 35;
  const parentM = new THREE.Matrix4();
  const tmpM = new THREE.Matrix4();

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
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 2);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 2);

    // Câmera.
    const [cx, cy, cz] = camTrack(p);
    const [lx, ly, lz] = lookTrack(p);
    camera.position.set(cx + pointer.sx * 0.12, cy + pointer.sy * 0.08, cz);
    camera.lookAt(lx, ly, lz);
    const rate = Math.min((Math.abs(p - lastP) / Math.max(dt, 1 / 240)) * 4, 1);
    lastP = p;
    speed += (rate - speed) * Math.min(1, dt * 2.2);
    const fall = band(p, 0.42, 0.53, 0.62, 0.74);
    camera.rotation.z += -fall * 0.08;
    camera.fov = baseFov + speed * 4;
    camera.updateProjectionMatrix();
    shared.uCamPos.value.copy(camera.position);

    // Kimono: gira devagar no sentido da rolagem; tomba no DERRUBE.
    pivot.position.y = KY + Math.sin(time * 0.7) * 0.03 - fall * 0.35;
    pivot.rotation.set(fall * 0.2, -0.2 + p * 0.4 + fall * 0.25, -fall * 0.25);
    pivot.updateMatrixWorld();
    parentM.copy(pivot.matrixWorld);
    tmpM.copy(mirrorM).multiply(parentM);
    black.main.mat.uniforms.uParent.value.copy(parentM);
    white.main.mat.uniforms.uParent.value.copy(parentM);
    black.mirror.mat.uniforms.uParent.value.copy(tmpM);
    white.mirror.mat.uniforms.uParent.value.copy(tmpM);
    emberUniforms.uParent.value.copy(parentM);

    // Pose do atleta invisível.
    const [sl, sr, torso, legs, chest] = poseTrack(p);
    shared.uPose.value.set(sl, sr, torso, legs);
    shared.uChest.value = chest;

    // Transformação: a onda sobe dos pés à gola entre o DERRUBE e o começo do EVOLUA.
    const wave = smooth(clamp01((p - 0.46) / 0.23));
    shared.uWave.value = -0.25 + wave * 1.5;
    shared.uEmber.value = band(p, 0.45, 0.48, 0.67, 0.71);
    const evolve = band(p, 0.68, 0.76, 0.93, 1.01);
    white.own.uRedGlow.value = evolve * 0.75;

    // Luzes.
    const grip = band(p, 0.22, 0.3, 0.42, 0.48);
    const sweepX = Math.sin(time * 0.5) * 2.4;
    shared.uSweepPos.value.set(KX + sweepX * (1 - grip) + (collar[0] - KX + Math.sin(time * 1.1) * 0.9) * grip, KY + 1.4 * (1 - grip) + (collar[1] - KY + 0.25) * grip, 2.6 * (1 - grip) + 0.7 * grip);
    shared.uRim.value = 0.6 + fall * 1.1 + evolve * 0.4;
    shared.uExposure.value = 1 - grip * 0.15;

    // Faixa: sai branca quando a onda passa pela cintura, fica vermelha e volta a se amarrar no EVOLUA.
    const beltOut = smooth(clamp01((p - 0.55) / 0.1));
    const retie = smooth(clamp01((p - 0.8) / 0.08));
    ribbon.uniforms.uTime.value = time;
    ribbon.uniforms.uSpin.value = p * 9;
    ribbon.uniforms.uReveal.value = beltOut;
    ribbon.uniforms.uOpacity.value = beltOut * (1 - retie);
    ribbon.uniforms.uColor.value.copy(beltWhite).lerp(beltRed, smooth(clamp01((p - 0.6) / 0.08)));
    ribbon.uniforms.uFlat.value = smooth(clamp01((p - 0.68) / 0.1));
    ribbon.uniforms.uRadius.value = 2.4 + ribbon.uniforms.uFlat.value * 0.6 - retie * 1.6;
    ribbon.uniforms.uWidth.value = 0.3 - ribbon.uniforms.uFlat.value * 0.08;
    ribbon.uniforms.uGlow.value = evolve * 0.45;

    haloMat.opacity = evolve;
    haloOuterMat.opacity = evolve * 0.7;
    halo.scale.setScalar(0.8 + evolve * 0.2);
    halo.rotation.z = time * 0.2;

    rays.forEach((r, i) => {
      (r.material as THREE.MeshBasicMaterial).opacity = (r.userData.base as number) * (0.75 + Math.sin(time * 0.7 + i) * 0.12 + evolve * 0.5) * (1 - grip * 0.5);
    });
    for (let i = 0; i < DUST; i++) {
      let y = dustBase[i * 3 + 1] + ((time * (0.05 + (i % 7) * 0.025)) % 11);
      if (y > 5.5) y -= 11;
      dustPos[i * 3] = dustBase[i * 3] + Math.sin(time * 0.3 + i) * 0.12;
      dustPos[i * 3 + 1] = y;
    }
    dustGeo.attributes.position.needsUpdate = true;

    lens.uniforms.uTime.value = time;
    lens.uniforms.uAmount.value = 0.0012 + speed * 0.005 + fall * 0.002;
    bloom.strength = 0.5 + shared.uEmber.value * 0.35 + evolve * 0.3;

    composer.render(dt);
  }

  function setPointer(x: number, y: number) {
    pointer.x = x;
    pointer.y = y;
  }

  function dispose() {
    const geos = new Set<THREE.BufferGeometry>();
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) geos.add(mesh.geometry);
      const m = mesh.material as THREE.Material | undefined;
      if (m) m.dispose();
    });
    geos.forEach((g) => g.dispose());
    [blackTex, whiteTex, blackDepth, whiteDepth, backTex, shadowTex, rayTex, dustTex].forEach((t) => t.dispose());
    composer.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return { update, setPointer, resize, dispose };
}
