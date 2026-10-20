import * as THREE from 'three';
import { clamp01, createRibbon, smooth } from './sceneKit';
import { createLogo3D } from './logo3d';
import { createBeltTransform } from './beltTransform';

/**
 * Peças 3D das seções da v6 (fundo transparente, sem pós-processamento, para pesarem pouco):
 *  - "belt":   a faixa nas Turmas. Muda de cor e ganha graus conforme a lista (só fatos da escola).
 *  - "beltPhoto": v6.2, fotos de faixas que se transformam umas nas outras com a rolagem (lib/beltTransform.ts).
 *  - "logo": a logo da equipe em 3D (metal, verniz e a arte em relevo) nos Planos, girando com a rolagem.
 *  - "finale": o kimono com a faixa vermelha dando a volta e o halo aceso, no convite final.
 */

export type SectionKind = 'belt' | 'beltPhoto' | 'logo' | 'finale';
/** Faixa das Turmas: cor e graus (v6) e a posição contínua na lista, 0 a 9 (v6.2). */
export type BeltState = { blue: number; stripes: number; pos?: number };
export type SectionScene = {
  update: (p: number, dt: number, state?: BeltState) => void;
  resize: () => void;
  dispose: () => void;
};

/* ---------- Faixa de jiu-jitsu (tecido com costuras, ponta preta e graus) ---------- */
const beltVertex = /* glsl */ `
  uniform float uPhase;
  uniform float uLen;
  uniform float uWidth;
  varying float vS;
  varying float vV;
  varying float vShade;
  vec3 path(float s) {
    float x = (s - 0.5) * uLen;
    float y = sin(s * 3.1416 * 1.25 + uPhase) * 0.34;
    float z = cos(s * 3.1416 * 1.05 + uPhase * 0.8) * 0.45;
    return vec3(x, y, z);
  }
  void main() {
    float s = uv.x;
    float v = uv.y - 0.5;
    vS = s;
    vV = uv.y;
    vec3 c = path(s);
    vec3 t = normalize(path(s + 0.002) - c);
    vec3 n = normalize(cross(t, vec3(0.0, 0.0, 1.0)));
    float tw = sin(s * 3.0 + uPhase) * 0.7;
    vec3 dir = n * cos(tw) + cross(t, n) * sin(tw);
    vShade = 0.62 + 0.38 * abs(cos(tw + 0.4));
    vec3 p = c + dir * v * uWidth;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const beltFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStripes;
  varying float vS;
  varying float vV;
  varying float vShade;
  void main() {
    // Ponta preta da faixa, onde vão os graus.
    float bar = step(0.74, vS) * step(vS, 0.9);
    vec3 col = mix(uColor, vec3(0.035), bar);
    for (int k = 0; k < 4; k++) {
      float c = 0.775 + float(k) * 0.035;
      float on = clamp(uStripes - float(k), 0.0, 1.0);
      float tape = 1.0 - smoothstep(0.006, 0.009, abs(vS - c));
      col = mix(col, vec3(0.95), on * tape * bar);
    }
    float stitch = 0.86 + 0.14 * step(0.5, fract(vV * 10.0));
    float edge = smoothstep(0.0, 0.06, vV) * smoothstep(1.0, 0.94, vV);
    col *= vShade * stitch * (0.75 + 0.25 * edge);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ---------- Kimono (a imagem recortada, com volume e luz) ---------- */
const kimonoVertex = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uDepthScale;
  varying vec2 vUv;
  varying vec3 vN;
  varying float vDepth;
  void main() {
    vUv = uv;
    float d = texture2D(uDepth, uv).r;
    vDepth = d;
    float e = 1.0 / 200.0;
    float dx = texture2D(uDepth, uv + vec2(e, 0.0)).r - texture2D(uDepth, uv - vec2(e, 0.0)).r;
    float dy = texture2D(uDepth, uv + vec2(0.0, e)).r - texture2D(uDepth, uv - vec2(0.0, e)).r;
    vN = normalize(normalMatrix * normalize(vec3(-dx * 3.0, -dy * 3.0, 1.0)));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position + vec3(0.0, 0.0, d * uDepthScale), 1.0);
  }
`;
const kimonoFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uKey;
  uniform float uRim;
  uniform float uRedGlow;
  varying vec2 vUv;
  varying vec3 vN;
  varying float vDepth;
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.04) discard;
    float ndl = max(dot(normalize(vN), normalize(uKey)), 0.0);
    vec3 col = tex.rgb * (0.55 + ndl * 0.55);
    float edge = 1.0 - smoothstep(0.08, 0.45, vDepth);
    col += vec3(1.0, 0.1, 0.14) * edge * uRim;
    float redness = clamp((tex.r - max(tex.g, tex.b)) * 2.4, 0.0, 1.0);
    col += vec3(0.85, 0.02, 0.05) * redness * uRedGlow;
    gl_FragColor = vec4(col, tex.a);
  }
`;

export function createSectionScene(kind: SectionKind, host: HTMLElement, opts: { mobile: boolean; onReady?: () => void }): SectionScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.mobile ? 1.25 : 1.5));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  const disposables: { dispose: () => void }[] = [];
  let time = 0;
  let updateFn: (p: number, dt: number, state?: BeltState) => void = () => {};
  let resizeExtra: () => void = () => {};

  if (kind === 'belt') {
    // A faixa na diagonal; muda de branca para azul e ganha graus conforme a lista das turmas.
    const uniforms = {
      uPhase: { value: 0 },
      uLen: { value: 6.2 },
      uWidth: { value: 0.64 },
      uColor: { value: new THREE.Color(0.93, 0.93, 0.91) },
      uStripes: { value: 0 },
    };
    const geo = new THREE.PlaneGeometry(1, 1, 320, 2);
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: beltVertex, fragmentShader: beltFragment, side: THREE.DoubleSide });
    const belt = new THREE.Mesh(geo, mat);
    belt.frustumCulled = false;
    belt.rotation.z = opts.mobile ? -0.08 : -0.9;
    scene.add(belt);
    disposables.push(geo, mat);
    camera.position.set(0, 0, opts.mobile ? 8.2 : 10.6);
    const white = new THREE.Color(0.93, 0.93, 0.91);
    const blue = new THREE.Color(0.08, 0.22, 0.62);
    let blueNow = 0;
    let stripesNow = 0;
    updateFn = (p, dt, state) => {
      const target = state ?? { blue: 0, stripes: 0 };
      blueNow += (target.blue - blueNow) * Math.min(1, dt * 3);
      stripesNow += (target.stripes - stripesNow) * Math.min(1, dt * 3);
      uniforms.uColor.value.copy(white).lerp(blue, smooth(clamp01(blueNow)));
      uniforms.uStripes.value = stripesNow;
      uniforms.uPhase.value = p * 4.5 + time * 0.15;
      belt.rotation.y = -0.35 + p * 0.7;
    };
    opts.onReady?.();
  } else if (kind === 'beltPhoto') {
    // v6.2: fotos de faixas que se transformam umas nas outras com a rolagem.
    const bt = createBeltTransform(renderer, scene, camera, host, { mobile: opts.mobile, onReady: opts.onReady });
    disposables.push(bt);
    resizeExtra = bt.resize;
    updateFn = (p, dt, state) => bt.update(p, dt, state?.pos ?? 0);
  } else if (kind === 'logo') {
    // A logo da equipe em 3D, com luz de estúdio e um brilho que atravessa a peça de tempos em tempos.
    // Neutro: mantém o vermelho da logo saturado (o ACES puxa para o rosado).
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    const logo = createLogo3D(renderer, scene, () => opts.onReady?.());
    disposables.push(logo);
    const pivot = new THREE.Group();
    pivot.add(logo.group);
    scene.add(pivot);
    const haloGeo = new THREE.TorusGeometry(1.42, 0.012, 10, 220);
    const haloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.12, 0.18), transparent: true, opacity: 0.6 });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.z = -0.6;
    scene.add(halo);
    disposables.push(haloGeo, haloMat);
    camera.position.set(0, 0, opts.mobile ? 6.4 : 5.4);
    updateFn = (p) => {
      // Gira com a rolagem dos planos e flutua de leve; o brilho passa a cada 6 s.
      pivot.rotation.set(0.06 + Math.sin(time * 0.5) * 0.04, -0.6 + p * 1.2, 0);
      pivot.position.y = Math.sin(time * 0.7) * 0.04;
      halo.rotation.z = time * 0.15;
      logo.setSweep(((time % 6) / 6) * 1.6 - 0.3);
    };
  } else {
    // Convite final: o kimono da Arte Livre (o mesmo do hero, em 2K), com volume, luz e borda vermelha.
    const loader = new THREE.TextureLoader();
    let pending = 2;
    const done = () => {
      pending--;
      if (pending === 0) opts.onReady?.();
    };
    const map = loader.load('/v5/kimono-2k.webp', done);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    const depth = loader.load('/v5/depth.png', done);
    disposables.push(map, depth);
    const H = 5.2;
    const W = H * (2316 / 4096);
    const kUniforms = {
      uMap: { value: map },
      uDepth: { value: depth },
      uDepthScale: { value: 0.7 },
      uKey: { value: new THREE.Vector3(-0.6, 0.6, 0.7) },
      uRim: { value: 0.5 },
      uRedGlow: { value: 0 },
    };
    const kGeo = new THREE.PlaneGeometry(W, H, 80, 140);
    const kMat = new THREE.ShaderMaterial({ uniforms: kUniforms, vertexShader: kimonoVertex, fragmentShader: kimonoFragment, transparent: true, side: THREE.DoubleSide });
    const kimono = new THREE.Mesh(kGeo, kMat);
    const pivot = new THREE.Group();
    pivot.add(kimono);
    scene.add(pivot);
    disposables.push(kGeo, kMat);

    // Halo de neon atrás.
    const haloGeo = new THREE.TorusGeometry(3.1, 0.03, 10, 200);
    const haloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.12, 0.18), transparent: true, opacity: 0 });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.z = -1.2;
    pivot.add(halo);
    disposables.push(haloGeo, haloMat);

    const ribbon = createRibbon(opts.mobile ? 220 : 380);
    ribbon.uniforms.uRadius.value = 2.2;
    ribbon.uniforms.uHeight.value = 3.6;
    ribbon.mesh.position.y = -0.1;
    pivot.add(ribbon.mesh);
    disposables.push(ribbon.mesh.geometry, ribbon.mesh.material as THREE.Material);
    camera.position.set(0, 0.1, opts.mobile ? 11.5 : 8.8);

    updateFn = (p) => {
      // Fechamento: o kimono vira de frente, a faixa vermelha dá a volta e se aproxima, o halo acende.
      const k = smooth(clamp01((p - 0.1) / 0.45));
      pivot.rotation.set(0, -0.7 + k * 0.7, 0);
      pivot.position.y = Math.sin(time * 0.7) * 0.05;
      ribbon.uniforms.uTime.value = time;
      ribbon.uniforms.uSpin.value = p * 7;
      ribbon.uniforms.uReveal.value = smooth(clamp01((p - 0.15) / 0.3));
      ribbon.uniforms.uOpacity.value = 1;
      ribbon.uniforms.uFlat.value = k;
      ribbon.uniforms.uRadius.value = 2.6 - k * 0.6;
      ribbon.uniforms.uWidth.value = 0.28;
      ribbon.uniforms.uGlow.value = k * 0.4;
      haloMat.opacity = k * 0.8;
      halo.scale.setScalar(0.8 + k * 0.2);
      halo.rotation.z = time * 0.2;
      kUniforms.uRedGlow.value = k * 0.5;
      kUniforms.uRim.value = 0.35 + k * 0.4;
    };
  }

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    resizeExtra();
  }
  resize();

  function update(p: number, dt: number, state?: BeltState) {
    time += dt;
    updateFn(p, dt, state);
    renderer.render(scene, camera);
  }

  function dispose() {
    disposables.forEach((d) => d.dispose());
    renderer.dispose();
    canvas.remove();
  }

  return { update, resize, dispose };
}
