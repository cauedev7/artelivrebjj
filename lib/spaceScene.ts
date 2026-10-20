import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Cena 3D do hero da versão 2: um voo pelo espaço guiado pela rolagem.
 *
 * ENCARE  – o emblema (anel + triângulo, como o logo) gira à frente da câmera.
 * PEGUE   – o triângulo se desfaz em três barras que voam para fora; a câmera atravessa o anel.
 * DERRUBE – a câmera voa por portais de neon, entre cristais e estrelas que viram riscos.
 * EVOLUA  – um emblema gigante se monta; no fim a câmera mergulha nele e a tela escurece.
 *
 * Acabamento "de cinema": reflexos de um estúdio com softboxes e neon vermelho, cromo escovado,
 * vermelho com verniz, cristais de vidro e obsidiana, bordas arredondadas que pegam brilho,
 * tubos de neon com bloom, aberração cromática que cresce com a velocidade e vinheta.
 */

export type SpaceScene = {
  /** p: progresso do hero (0–1). dt: segundos desde o último quadro. */
  update: (p: number, dt: number) => void;
  setPointer: (x: number, y: number) => void;
  resize: () => void;
  dispose: () => void;
};

const BG = 0x0c0c10;
const NEON = new THREE.Color(0xff1a2c);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);

/** Posição da câmera (z) em cada trecho: segura nas palavras, acelera entre elas. */
const PATH: [number, number][] = [
  [0, 0],
  [0.12, -3],
  [0.27, -44],
  [0.38, -50],
  [0.5, -112],
  [0.6, -120],
  [0.72, -178],
  [0.85, -186],
  [1, -199.2],
];

function cameraZ(p: number) {
  for (let i = 1; i < PATH.length; i++) {
    const [p1, z1] = PATH[i];
    const [p0, z0] = PATH[i - 1];
    if (p <= p1) return z0 + (z1 - z0) * smooth(clamp01((p - p0) / (p1 - p0)));
  }
  return PATH[PATH.length - 1][1];
}

/** Textura circular suave, usada nas estrelas e nas nebulosas. */
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

/** Metal escovado: riscos finos numa direção, usados como mapa de rugosidade e relevo. */
function brushedTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgb(118,118,118)';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 2600; i++) {
    const y = Math.random() * c.height;
    const v = 70 + Math.random() * 120;
    g.strokeStyle = `rgba(${v},${v},${v},${0.08 + Math.random() * 0.25})`;
    g.lineWidth = Math.random() < 0.9 ? 0.6 : 1.4;
    const x = Math.random() * c.width;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 80 + Math.random() * 600, y + (Math.random() - 0.5) * 0.6);
    g.stroke();
  }
  // Pequenos arranhões e manchas, para a superfície não parecer perfeita demais.
  for (let i = 0; i < 160; i++) {
    const v = 150 + Math.random() * 80;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.12})`;
    g.beginPath();
    g.arc(Math.random() * c.width, Math.random() * c.height, Math.random() * 6, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Ambiente de estúdio para os reflexos: sala escura com softboxes brancas em cima e à esquerda
 * e tubos de neon vermelho dos lados. É isso que dá os brilhos e o vermelho nas superfícies.
 */
function studioEnvironment(renderer: THREE.WebGLRenderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x020203);
  const panel = (w: number, h: number, color: THREE.ColorRepresentation, intensity: number, pos: [number, number, number]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
    return m;
  };
  // Intensidades abaixo do limiar do bloom: os reflexos ficam nítidos, só o neon de verdade brilha.
  panel(14, 3, 0xffffff, 0.95, [0, 16, 3]); // softbox de cima
  panel(3, 12, 0xffffff, 0.6, [-15, 3, 8]); // softbox lateral
  panel(10, 6, 0xdfe6ff, 0.18, [6, -3, 18]); // luz de preenchimento fria, na frente
  panel(0.9, 18, NEON, 0.95, [15, 0, -2]); // neon vermelho à direita
  panel(0.9, 18, NEON, 0.75, [-13, 0, -12]); // neon vermelho atrás, à esquerda
  panel(18, 0.9, NEON, 0.55, [0, -14, -6]); // neon vermelho embaixo
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  env.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  });
  return tex;
}

/** Tubo de neon reto entre dois pontos. */
function neonTube(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material) {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(radius, radius, len, 12, 1, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return mesh;
}

type Materials = {
  chrome: THREE.Material;
  paint: THREE.Material;
  neonRed: THREE.Material;
  neonWhite: THREE.Material;
};

/** O emblema: anel de cromo escovado + triângulo vermelho envernizado (três barras) + neon. */
function createEmblem(m: Materials) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.36, 64, 240), m.chrome);
  group.add(ring);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(3.78, 0.03, 12, 240), m.neonRed);
  group.add(halo);

  const circum = 4.4;
  const side = circum * Math.sqrt(3);
  const inradius = circum / 2;
  const bars: { mesh: THREE.Mesh; dir: THREE.Vector2; spin: number }[] = [];
  [270, 30, 150].forEach((deg, i) => {
    const a = THREE.MathUtils.degToRad(deg);
    const bar = new THREE.Mesh(new RoundedBoxGeometry(side * 1.04, 0.64, 0.52, 6, 0.09), m.paint);
    bar.position.set(Math.cos(a) * inradius, Math.sin(a) * inradius, 0.15);
    bar.rotation.z = a + Math.PI / 2;
    group.add(bar);
    bars.push({ mesh: bar, dir: new THREE.Vector2(Math.cos(a), Math.sin(a)), spin: (i - 1) * 1.3 + 2.2 });
  });

  // Triângulo interno em tubos de neon branco (no logo, a área branca com o leão).
  const inner = new THREE.Group();
  const r = 2.55;
  const pts = [90, 210, 330].map((d) => {
    const a = THREE.MathUtils.degToRad(d);
    return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.5);
  });
  pts.forEach((p, i) => inner.add(neonTube(p, pts[(i + 1) % 3], 0.022, m.neonWhite)));
  group.add(inner);

  return { group, ring, halo, bars, inner };
}

/** Aberração cromática (cresce com a velocidade) e vinheta, aplicadas no fim. */
const LensShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uAmount: { value: 0.0015 },
    uVignette: { value: 0.55 },
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
    varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      float d = length(c);
      vec2 off = c * uAmount * d * 4.0;
      float r = texture2D(tDiffuse, vUv + off).r;
      vec4 base = texture2D(tDiffuse, vUv);
      float b = texture2D(tDiffuse, vUv - off).b;
      vec3 col = vec3(r, base.g, b);
      col *= mix(1.0, smoothstep(0.82, 0.18, d), uVignette);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createSpaceScene(host: HTMLElement, opts: { mobile: boolean }): SpaceScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const { mobile } = opts;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(BG, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  const canvas = renderer.domElement;
  canvas.className = 'hero__canvas hero__canvas--space';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.015);
  const envTex = studioEnvironment(renderer);
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 420);
  scene.add(camera);

  /* ---------- Luzes (o ambiente faz a maior parte; estas dão recorte e cor) ---------- */
  scene.add(new THREE.AmbientLight(0xffffff, 0.08));
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(-6, 9, 6);
  scene.add(key);
  const rimRed = new THREE.DirectionalLight(0xff2a3a, 1.6);
  rimRed.position.set(9, -2, -6);
  scene.add(rimRed);
  const head = new THREE.PointLight(0xffffff, 6, 22, 1.8);
  camera.add(head);
  const redA = new THREE.PointLight(0xff2233, 30, 26, 1.7);
  redA.position.set(-2, 3, -8);
  scene.add(redA);
  const redB = new THREE.PointLight(0xff2233, 70, 50, 1.6);
  redB.position.set(6, -4, -190);
  scene.add(redB);

  /* ---------- Materiais ---------- */
  const brushed = brushedTexture();
  brushed.repeat.set(6, 1);
  const paintRough = brushed.clone();
  paintRough.repeat.set(2, 1);
  paintRough.needsUpdate = true;

  const materials: Materials = {
    // Cromo escuro escovado, com brilho alongado (anisotropia) ao longo do anel.
    chrome: new THREE.MeshPhysicalMaterial({
      color: 0x9da0aa,
      metalness: 1,
      roughness: 0.22,
      roughnessMap: brushed,
      bumpMap: brushed,
      bumpScale: 0.25,
      anisotropy: 0.75,
      clearcoat: 0.3,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1,
    }),
    // Vermelho metálico com verniz, como pintura de carro.
    paint: new THREE.MeshPhysicalMaterial({
      color: 0x9c0b16,
      metalness: 0.6,
      roughness: 0.32,
      roughnessMap: paintRough,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      sheen: 0.12,
      sheenColor: new THREE.Color(0xff3040),
      envMapIntensity: 1,
    }),
    // Neon: cores acima de 1 para o bloom fazer o brilho.
    neonRed: new THREE.MeshBasicMaterial({ color: NEON.clone().multiplyScalar(2.6), toneMapped: false }),
    neonWhite: new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.9, 0.92).multiplyScalar(1.7), toneMapped: false }),
  };

  const crystalMats = mobile
    ? [
        new THREE.MeshPhysicalMaterial({ color: 0x8e0a14, metalness: 0.5, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1, flatShading: true }),
        new THREE.MeshPhysicalMaterial({ color: 0xd8d9e0, metalness: 1, roughness: 0.08, envMapIntensity: 1, flatShading: true }),
        new THREE.MeshPhysicalMaterial({ color: 0x0b0b0e, metalness: 0.1, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1, flatShading: true }),
      ]
    : [
        // Vidro vermelho (transmissão real, com espessura e cor de absorção).
        new THREE.MeshPhysicalMaterial({
          color: 0xff6070,
          metalness: 0,
          roughness: 0.04,
          transmission: 1,
          thickness: 1.4,
          ior: 1.52,
          attenuationColor: new THREE.Color(0xc0101c),
          attenuationDistance: 0.55,
          clearcoat: 1,
          envMapIntensity: 1,
          flatShading: true,
        }),
        // Cromo polido.
        new THREE.MeshPhysicalMaterial({ color: 0xd8d9e0, metalness: 1, roughness: 0.07, envMapIntensity: 1, flatShading: true }),
        // Obsidiana: preto vítreo, só reflexos.
        new THREE.MeshPhysicalMaterial({ color: 0x08080a, metalness: 0.15, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.015, envMapIntensity: 1, flatShading: true }),
      ];

  /* ---------- Emblemas ---------- */
  // No desktop o título fica à esquerda: os emblemas ficam à direita e a câmera faz a curva até eles.
  const AX = mobile ? 0 : 4.6;
  const BX = mobile ? 0 : 3.2;
  const emblemA = createEmblem(materials);
  emblemA.group.position.set(AX, 0, -12);
  emblemA.group.scale.setScalar(mobile ? 0.8 : 0.88);
  scene.add(emblemA.group);

  const emblemB = createEmblem(materials);
  emblemB.group.position.set(BX, 0, -200);
  emblemB.group.scale.setScalar(mobile ? 1.3 : 1.7);
  scene.add(emblemB.group);

  /* ---------- Portais de neon ---------- */
  const gateMarker = new THREE.OctahedronGeometry(0.3, 0);
  const gates: THREE.Group[] = [];
  [-62, -132].forEach((z, gi) => {
    const g = new THREE.Group();
    g.position.set(0, 0, z);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.05, 16, 260), materials.neonRed));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(6.85, 0.16, 32, 260), materials.chrome));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.012, 8, 260), materials.neonWhite));
    // Cristais em volta do portal, como os graus de uma faixa.
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + gi * 0.3;
      const t = new THREE.Mesh(gateMarker, crystalMats[i % 3]);
      t.position.set(Math.cos(a) * 6.85, Math.sin(a) * 6.85, 0);
      t.scale.set(1, 1.7, 1);
      t.rotation.z = a;
      g.add(t);
    }
    scene.add(g);
    gates.push(g);
  });

  /* ---------- Cristais voando ---------- */
  const SHARDS = mobile ? 66 : 150;
  const shardGeo = new THREE.OctahedronGeometry(1, 0);
  const meshes = crystalMats.map((mat, k) => new THREE.InstancedMesh(shardGeo, mat, Math.ceil(SHARDS / 3) + (k === 0 ? 1 : 0)));
  meshes.forEach((m) => scene.add(m));
  type Shard = { pos: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3; scale: number; stretch: number; mesh: THREE.InstancedMesh; index: number };
  const shards: Shard[] = [];
  const counts = [0, 0, 0];
  for (let i = 0; i < SHARDS; i++) {
    const r = 3.5 + Math.pow(Math.random(), 0.7) * 14;
    const a = Math.random() * Math.PI * 2;
    const k = i % 3;
    shards.push({
      pos: new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.7, 6 - Math.random() * 236),
      rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      spin: new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2),
      scale: 0.14 + Math.pow(Math.random(), 2.2) * 0.8,
      stretch: 1.3 + Math.random() * 1.4,
      mesh: meshes[k],
      index: counts[k]++,
    });
  }
  meshes.forEach((m, k) => (m.count = counts[k]));
  const dummy = new THREE.Object3D();

  /* ---------- Estrelas (pontos) e riscos de velocidade (linhas) ---------- */
  const STARS = mobile ? 1100 : 2600;
  const starPos = new Float32Array(STARS * 3);
  const starCol = new Float32Array(STARS * 3);
  const lineAttr = new Float32Array(STARS * 6);
  const lineTail = new Float32Array(STARS * 2);
  const lineCol = new Float32Array(STARS * 6);
  const white = new THREE.Color(0xffffff);
  const redStar = new THREE.Color(0xff3344);
  for (let i = 0; i < STARS; i++) {
    const r = 2 + Math.pow(Math.random(), 0.6) * 70;
    const a = Math.random() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.75;
    const z = 20 - Math.random() * 300;
    starPos.set([x, y, z], i * 3);
    const c = Math.random() < 0.16 ? redStar : white;
    const k = 0.45 + Math.random() * 0.55;
    starCol.set([c.r * k, c.g * k, c.b * k], i * 3);
    lineAttr.set([x, y, z, x, y, z], i * 6);
    lineTail.set([0, 1], i * 2);
    lineCol.set([c.r * k, c.g * k, c.b * k, c.r * k, c.g * k, c.b * k], i * 6);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  const starTex = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  const starMat = new THREE.PointsMaterial({ size: mobile ? 0.2 : 0.13, map: starTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  scene.add(new THREE.Points(starGeo, starMat));

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(lineAttr, 3));
  lineGeo.setAttribute('aTail', new THREE.BufferAttribute(lineTail, 1));
  lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3));
  const streakMat = new THREE.ShaderMaterial({
    uniforms: { uStretch: { value: 0 }, uOpacity: { value: 0 } },
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aTail;
      uniform float uStretch;
      varying float vTail;
      varying vec3 vColor;
      void main() {
        vec3 p = position;
        p.z -= aTail * uStretch;
        vTail = aTail;
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vTail;
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor * 1.6, (1.0 - vTail) * uOpacity);
      }
    `,
  });
  scene.add(new THREE.LineSegments(lineGeo, streakMat));

  /* ---------- Nebulosas ---------- */
  const nebTex = radialTexture('rgba(220,12,28,0.5)', 'rgba(220,12,28,0)');
  const nebMat = new THREE.SpriteMaterial({ map: nebTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.32 });
  const nebulas: THREE.Sprite[] = [];
  [
    [-14, 6, -30, 40],
    [26, -12, -95, 70],
    [-30, 14, -150, 80],
    [8, 4, -235, 110],
  ].forEach(([x, y, z, s]) => {
    const sp = new THREE.Sprite(nebMat);
    sp.position.set(x, y, z);
    sp.scale.setScalar(s);
    scene.add(sp);
    nebulas.push(sp);
  });

  /* ---------- Pós-processamento ---------- */
  // Render target com multisample (antisserrilhado) no desktop; o canvas em si fica sem MSAA.
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(pixelRatio);
  composer.addPass(new RenderPass(scene, camera));
  // Limiar alto: só o neon (valores acima de 1) e os reflexos mais fortes brilham.
  const BLOOM = mobile ? 0.5 : 0.62;
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM, 0.42, 1.1);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const lens = new ShaderPass(LensShader);
  composer.addPass(lens);

  /* ---------- Estado ---------- */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let time = 0;
  let lastZ = 0;
  let speed = 0;
  let fov = 55;

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    camera.aspect = w / h;
    // Em telas em pé, abre um pouco o campo de visão para o emblema caber.
    camera.userData.baseFov = w / h < 1 ? 68 : 55;
    camera.updateProjectionMatrix();
  }
  resize();

  function update(p: number, dt: number) {
    time += dt;
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 3);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 3);

    // Câmera no caminho, com balanço leve, paralaxe do mouse e inclinação na velocidade.
    const z = cameraZ(p);
    const dz = Math.abs(z - lastZ) / Math.max(dt, 1 / 240);
    lastZ = z;
    speed += (Math.min(dz / 60, 1) - speed) * Math.min(1, dt * 6);
    const swayX = Math.sin(time * 0.35) * 0.35 + pointer.sx * 1.1;
    const swayY = Math.cos(time * 0.27) * 0.25 + pointer.sy * 0.7;
    // Curva até o centro do emblema A (para atravessá-lo), volta ao eixo e curva até o B no final.
    const toA = smooth(clamp01((p - 0.1) / 0.1)) * (1 - smooth(clamp01((p - 0.27) / 0.1)));
    const toB = smooth(clamp01((p - 0.8) / 0.15));
    const camX = AX * toA + BX * toB;
    camera.position.set(camX + swayX, swayY, z);
    camera.lookAt(camX + swayX * 0.3, swayY * 0.3, z - 12);
    camera.rotation.z += Math.sin(time * 0.2) * 0.02 + speed * 0.06 * Math.sin(time * 0.9);

    const baseFov = (camera.userData.baseFov as number) ?? 55;
    const targetFov = baseFov + speed * 22;
    fov += (targetFov - fov) * Math.min(1, dt * 5);
    camera.fov = fov;
    camera.updateProjectionMatrix();

    // Estrelas viram riscos com a velocidade; a lente "abre" as cores nas bordas.
    streakMat.uniforms.uStretch.value = speed * 9;
    streakMat.uniforms.uOpacity.value = Math.min(1, speed * 2.2);
    lens.uniforms.uAmount.value = 0.0012 + speed * 0.0075;
    bloom.strength = BLOOM + speed * 0.3;

    // Emblema A: gira de frente; no PEGUE o triângulo se desfaz em três barras que voam.
    const burst = smooth(clamp01((p - 0.11) / 0.15));
    emblemA.group.rotation.y = Math.sin(time * 0.6) * 0.28 + pointer.sx * 0.25;
    emblemA.group.rotation.x = Math.cos(time * 0.5) * 0.12 - pointer.sy * 0.2;
    emblemA.group.position.y = Math.sin(time * 0.9) * 0.12;
    emblemA.ring.rotation.z = time * 0.15;
    emblemA.halo.rotation.z = -time * 0.3;
    emblemA.halo.scale.setScalar(1 + burst * 1.8);
    emblemA.ring.scale.setScalar(1 + burst * 1.4);
    emblemA.inner.scale.setScalar(1 - burst * 0.9 + 0.001);
    emblemA.bars.forEach((b) => {
      const base = b.mesh.userData.base ?? (b.mesh.userData.base = b.mesh.position.clone());
      b.mesh.position.set(base.x + b.dir.x * burst * 11, base.y + b.dir.y * burst * 11, base.z + burst * 5);
      b.mesh.rotation.x = burst * b.spin * 2.5;
      b.mesh.rotation.y = burst * b.spin;
    });

    // Emblema B: gira devagar e se monta (as barras chegam voando) no EVOLUA.
    const form = smooth(clamp01((p - 0.62) / 0.16));
    emblemB.group.rotation.z = time * 0.08;
    emblemB.group.rotation.y = Math.sin(time * 0.4) * 0.18;
    emblemB.ring.rotation.z = -time * 0.12;
    emblemB.halo.rotation.z = time * 0.25;
    emblemB.inner.scale.setScalar(0.001 + form);
    emblemB.bars.forEach((b, i) => {
      const base = b.mesh.userData.base ?? (b.mesh.userData.base = b.mesh.position.clone());
      const off = (1 - form) * 14;
      b.mesh.position.set(base.x + b.dir.x * off, base.y + b.dir.y * off, base.z + (1 - form) * (i - 1) * 6);
      b.mesh.rotation.x = (1 - form) * b.spin * 3;
    });

    // Portais giram e pulsam.
    gates.forEach((g, i) => {
      g.rotation.z = time * (i ? -0.2 : 0.25);
      g.scale.setScalar(1 + Math.sin(time * 2 + i) * 0.025);
    });

    // Cristais giram sozinhos (alongados, como lascas).
    shards.forEach((s) => {
      s.rot.x += s.spin.x * dt;
      s.rot.y += s.spin.y * dt;
      s.rot.z += s.spin.z * dt;
      dummy.position.copy(s.pos);
      dummy.rotation.copy(s.rot);
      dummy.scale.set(s.scale, s.scale * s.stretch, s.scale);
      dummy.updateMatrix();
      s.mesh.setMatrixAt(s.index, dummy.matrix);
    });
    meshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));

    nebulas.forEach((n, i) => {
      n.material.rotation = time * 0.02 * (i % 2 ? 1 : -1);
    });

    redA.intensity = 30 * (1 - burst * 0.7);
    redB.intensity = 70 * (0.4 + form * 0.6);

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
    });
    [materials.chrome, materials.paint, materials.neonRed, materials.neonWhite, ...crystalMats, streakMat, nebMat, starMat].forEach((m) => m.dispose());
    [starTex, nebTex, envTex, brushed, paintRough].forEach((t) => t.dispose());
    composer.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return { update, setPointer, resize, dispose };
}
