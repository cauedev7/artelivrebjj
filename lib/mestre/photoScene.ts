import * as THREE from 'three';
import { radialTexture } from '../sceneKit';

/**
 * Opção 1 da v7, "foto viva": a foto real do Mestre, recortada, ganha volume a partir de um mapa de
 * profundidade (gerado por scripts/mestre-foto-viva.swift) e vira uma figura que gira uns 25° para cada lado,
 * respira e reage à luz. É a foto de verdade com relevo, não um modelo 3D: não dá para ver as costas nem mudar a pose.
 */
export type PhotoScene = { reset(): void; dispose(): void };
type Opts = { mobile: boolean; reducedMotion: boolean };

const PHOTO = '/img/mestre-neury.webp';
const MASK = '/v7/mestre-mascara.png';
const DEPTH = '/v7/mestre-profundidade.png';
const MAX_YAW = 0.44;
const H = 2.0;
const W = (H * 1024) / 1536;

const vertex = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uDepthScale;
  uniform float uBreath;
  uniform vec2 uTexel;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying float vDepth;

  float depthAt(vec2 uv) {
    float d = texture2D(uDepth, uv).r;
    // Volume extra: o tronco é mais redondo do que a máscara sugere, e a cabeça fica um pouco à frente.
    vec2 c = (uv - vec2(0.5, 0.42)) / vec2(0.42, 0.62);
    float torso = max(0.0, 1.0 - dot(c, c));
    vec2 h = (uv - vec2(0.5, 0.86)) / vec2(0.13, 0.11);
    float head = max(0.0, 1.0 - dot(h, h));
    return d * (0.55 + 0.45 * torso) + head * 0.35 * d;
  }

  void main() {
    vUv = uv;
    vec3 p = position;
    float d = depthAt(uv);
    vDepth = d;
    // Respiração: o peito sobe e alarga de leve.
    float chest = smoothstep(0.35, 0.6, uv.y) * (1.0 - smoothstep(0.72, 0.84, uv.y));
    p.x *= 1.0 + uBreath * 0.012 * chest;
    p.y += uBreath * 0.006 * smoothstep(0.3, 0.75, uv.y);
    p.z += d * uDepthScale;
    // Normal a partir da inclinação da profundidade.
    float dx = depthAt(uv + vec2(uTexel.x, 0.0)) - depthAt(uv - vec2(uTexel.x, 0.0));
    float dy = depthAt(uv + vec2(0.0, uTexel.y)) - depthAt(uv - vec2(0.0, uTexel.y));
    vec3 n = normalize(vec3(-dx * uDepthScale / (2.0 * uTexel.x * ${W.toFixed(4)}), -dy * uDepthScale / (2.0 * uTexel.y * ${H.toFixed(4)}), 1.0));
    vNormalV = normalize(normalMatrix * n);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uPhoto;
  uniform sampler2D uMask;
  uniform vec3 uKeyDir;
  uniform vec3 uRimDir;
  uniform float uFade;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying float vDepth;

  void main() {
    float a = texture2D(uMask, vUv).r;
    // A foto termina nas coxas: a parte de baixo some no escuro, como um retrato de estúdio.
    a *= smoothstep(0.0, 0.16, vUv.y);
    if (a < 0.04) discard;
    vec3 col = texture2D(uPhoto, vUv).rgb;
    vec3 n = normalize(vNormalV);
    vec3 v = normalize(-vViewPos);
    // A foto já vem iluminada: a luz só reforça o volume conforme a figura gira.
    float key = max(dot(n, normalize(uKeyDir)), 0.0);
    col *= 0.82 + 0.3 * key;
    // Contraluz vermelha nas bordas, que aparece mais do lado que vira para trás.
    float rim = pow(1.0 - max(dot(n, v), 0.0), 2.5) * max(dot(n, normalize(uRimDir)) * 0.5 + 0.5, 0.0);
    col += vec3(0.95, 0.08, 0.12) * rim * 0.55;
    // Bordas um pouco mais escuras (onde a profundidade cai), para descolar do fundo.
    col *= mix(0.78, 1.0, smoothstep(0.2, 0.7, vDepth));
    gl_FragColor = vec4(col, a * uFade);
    #include <colorspace_fragment>
  }
`;

function load(loader: THREE.TextureLoader, url: string, color: boolean) {
  return new Promise<THREE.Texture>((res, rej) =>
    loader.load(
      url,
      (t) => {
        t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = 4;
        res(t);
      },
      undefined,
      rej,
    ),
  );
}

export async function createPhotoScene(host: HTMLElement, opts: Opts): Promise<PhotoScene> {
  const loader = new THREE.TextureLoader();
  const [photo, mask, depth] = await Promise.all([load(loader, PHOTO, true), load(loader, MASK, false), load(loader, DEPTH, false)]);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.mobile ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'mestre3d__canvas';
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);

  const uniforms = {
    uPhoto: { value: photo },
    uMask: { value: mask },
    uDepth: { value: depth },
    uDepthScale: { value: 0.36 },
    uBreath: { value: 0 },
    uTexel: { value: new THREE.Vector2(3 / 1024, 3 / 1536) },
    uKeyDir: { value: new THREE.Vector3(0.4, 0.5, 1) },
    uRimDir: { value: new THREE.Vector3(-1, 0.3, -0.2) },
    uFade: { value: 1 },
  };
  const geo = new THREE.PlaneGeometry(W, H, opts.mobile ? 160 : 240, opts.mobile ? 240 : 360);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: fragment, transparent: true });
  const figure = new THREE.Mesh(geo, mat);
  figure.position.y = H / 2;
  const turntable = new THREE.Group();
  turntable.add(figure);
  scene.add(turntable);

  // Brilho vermelho atrás e uma sombra suave embaixo.
  const glowTex = radialTexture('rgba(200,16,46,0.5)', 'rgba(200,16,46,0)');
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), glowMat);
  glow.position.set(0, H * 0.6, -0.5);
  scene.add(glow);

  const fit = () => {
    const w = Math.max(host.clientWidth, 1);
    const h = Math.max(host.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max((H * 1.08) / (2 * tan), (W * 1.35) / (2 * tan * camera.aspect));
    camera.position.set(0, H * 0.52, dist);
    camera.lookAt(0, H * 0.5, 0);
    camera.updateProjectionMatrix();
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(host);

  // ---------- Girar arrastando (limitado, com mola), e um leve "olhar" para o mouse no desktop ----------
  let yaw = 0;
  let yawTarget = 0;
  let pitch = 0;
  let pitchTarget = 0;
  let dragging: number | null = null;
  let lastX = 0;
  let released = 0;
  const onDown = (e: PointerEvent) => {
    dragging = e.pointerId;
    lastX = e.clientX;
    host.classList.add('is-dragging');
  };
  const onMove = (e: PointerEvent) => {
    if (dragging === e.pointerId) {
      yawTarget += ((e.clientX - lastX) / Math.max(host.clientWidth, 1)) * 1.6;
      // Passou do limite, resiste (como um elástico).
      if (Math.abs(yawTarget) > MAX_YAW) yawTarget = Math.sign(yawTarget) * (MAX_YAW + (Math.abs(yawTarget) - MAX_YAW) * 0.35);
      lastX = e.clientX;
    } else if (e.pointerType === 'mouse' && !opts.reducedMotion) {
      const r = host.getBoundingClientRect();
      if (e.clientY > r.top && e.clientY < r.bottom) {
        pitchTarget = THREE.MathUtils.clamp(((e.clientY - r.top) / r.height - 0.5) * 0.12, -0.06, 0.06);
      }
    }
  };
  const onUp = (e: PointerEvent) => {
    if (dragging !== e.pointerId) return;
    dragging = null;
    released = 0;
    host.classList.remove('is-dragging');
    yawTarget = THREE.MathUtils.clamp(yawTarget, -MAX_YAW, MAX_YAW);
  };
  host.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  let visible = true;
  const io = new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible) start();
  });
  io.observe(host);
  let raf = 0;
  let last = performance.now();
  let time = 0;
  function frame(now: number) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
    last = now;
    time += dt;
    // Depois de soltar, volta devagar para a frente (quem pede menos movimento fica onde deixou).
    if (dragging === null && !opts.reducedMotion) {
      released += dt;
      if (released > 1.6) yawTarget *= Math.exp(-dt * 1.2);
    }
    const idle = opts.reducedMotion ? 0 : Math.sin(time * 0.45) * 0.035;
    const k = opts.reducedMotion ? 1 : 1 - Math.exp(-dt * 8);
    yaw += (yawTarget + (dragging === null ? idle : 0) - yaw) * k;
    pitch += (pitchTarget - pitch) * k;
    turntable.rotation.y = yaw;
    turntable.rotation.x = pitch;
    uniforms.uBreath.value = opts.reducedMotion ? 0 : Math.sin(time * 1.6);
    // A luz principal fica no estúdio; a contraluz vem do lado que se afasta da câmera.
    uniforms.uKeyDir.value.set(0.4 - yaw * 0.8, 0.5, 1);
    uniforms.uRimDir.value.set(yaw >= 0 ? -1 : 1, 0.3, -0.2);
    renderer.render(scene, camera);
    start();
  }
  function start() {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }
  const onVis = () => !document.hidden && start();
  document.addEventListener('visibilitychange', onVis);
  start();

  return {
    reset() {
      yawTarget = 0;
      pitchTarget = 0;
      if (opts.reducedMotion) yaw = 0;
      start();
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      host.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      [photo, mask, depth, geo, mat, glowTex, glowMat, glow.geometry].forEach((d) => d.dispose());
      renderer.dispose();
      canvas.remove();
    },
  };
}
