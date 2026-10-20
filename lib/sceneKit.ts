import * as THREE from 'three';

/** Peças compartilhadas pelas cenas 3D da v6 (hero da transformação e cenas das seções). */

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (v: number) => v * v * (3 - 2 * v);
/** Sobe de 0 a 1 entre a e b, desce de volta entre c e d. */
export const band = (p: number, a: number, b: number, c: number, d: number) =>
  smooth(clamp01((p - a) / (b - a))) * (1 - smooth(clamp01((p - c) / (d - c))));

/**
 * Interpolação contínua (Hermite com os tempos de cada ponto): passa pelos pontos sem parar
 * e sem mudar de direção de repente. `times` crescente; `values` um número por ponto.
 */
export function hermite(times: number[], values: number[], p: number, startAtRest = true) {
  const n = times.length;
  let i = 0;
  while (i < n - 2 && p > times[i + 1]) i++;
  const t0 = times[i];
  const t1 = times[i + 1];
  const h = t1 - t0;
  const s = clamp01((p - t0) / h);
  const slope = (k: number) => {
    if (k === 0) return startAtRest ? 0 : (values[1] - values[0]) / (times[1] - times[0]);
    if (k === n - 1) return (values[k] - values[k - 1]) / (times[k] - times[k - 1]);
    return (values[k + 1] - values[k - 1]) / (times[k + 1] - times[k - 1]);
  };
  const m0 = slope(i);
  const m1 = slope(i + 1);
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * values[i] + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * values[i + 1] + (s3 - s2) * h * m1;
}

/** Vários canais (ex.: x, y, z) interpolados com os mesmos tempos. */
export function track(times: number[], channels: number[][]) {
  return (p: number) => channels.map((vals) => hermite(times, vals, p));
}

export function radialTexture(inner: string, outer: string) {
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

/** Gradiente vertical com laterais suaves (raios de luz). */
export function rayTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,214,160,0.9)');
  grad.addColorStop(0.55, 'rgba(255,190,120,0.25)');
  grad.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const side = g.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, 'rgba(0,0,0,0)');
  side.addColorStop(0.5, 'rgba(0,0,0,1)');
  side.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = side;
  g.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Aberração cromática, vinheta e grão de filme. */
export const LensShader = {
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

/* ---------------------------------------------------------------------------------------------- */
/* Faixa 3D de tecido (fita com costuras), em volta de um centro. Cor e brilho por uniform.        */
/* ---------------------------------------------------------------------------------------------- */

export const ribbonVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSpin;
  uniform float uRadius;
  uniform float uFlat;
  uniform float uWidth;
  uniform float uHeight;
  varying float vS;
  varying float vV;
  varying float vShade;
  vec3 path(float s) {
    float a = s * 6.2831 * 1.35 + uTime * 0.6 + uSpin;
    float r = uRadius * (1.0 + 0.16 * sin(s * 9.0 + uSpin * 0.7));
    float y = (s - 0.5) * uHeight * (1.0 - uFlat) + sin(a * 0.5 + uSpin) * 0.3;
    return vec3(cos(a) * r, y, sin(a) * r * mix(0.55, 0.32, uFlat));
  }
  void main() {
    float s = uv.x;
    float v = uv.y - 0.5;
    vS = s;
    vV = uv.y;
    vec3 c = path(s);
    vec3 t = normalize(path(s + 0.002) - c);
    vec3 radial = normalize(vec3(c.x, 0.0, c.z) + 1e-4);
    float tw = s * 12.0 + uSpin * 1.5;
    vec3 side = normalize(cross(t, radial));
    vec3 dir = normalize(side * cos(tw) + radial * sin(tw));
    vShade = 0.45 + 0.55 * abs(cos(tw));
    vec3 p = c + dir * v * uWidth;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const ribbonFragment = /* glsl */ `
  uniform float uReveal;
  uniform float uOpacity;
  uniform float uGlow;
  uniform vec3 uColor;
  uniform vec3 uGlowColor;
  varying float vS;
  varying float vV;
  varying float vShade;
  void main() {
    if (vS > uReveal) discard;
    float stitch = 0.84 + 0.16 * step(0.5, fract(vV * 9.0));
    vec3 col = uColor * vShade * stitch;
    col += uGlowColor * uGlow * (0.3 + vShade * 0.5);
    float tip = smoothstep(uReveal, uReveal - 0.04, vS);
    gl_FragColor = vec4(col, uOpacity * tip);
  }
`;

export function createRibbon(segments: number) {
  const uniforms = {
    uTime: { value: 0 },
    uSpin: { value: 0 },
    uRadius: { value: 2.4 },
    uFlat: { value: 0 },
    uWidth: { value: 0.3 },
    uHeight: { value: 4.2 },
    uReveal: { value: 0 },
    uOpacity: { value: 0 },
    uGlow: { value: 0 },
    uColor: { value: new THREE.Color(0.62, 0.035, 0.06) },
    uGlowColor: { value: new THREE.Color(0.9, 0.02, 0.05) },
  };
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1, segments, 1),
    new THREE.ShaderMaterial({ uniforms, vertexShader: ribbonVertex, fragmentShader: ribbonFragment, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
  );
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
