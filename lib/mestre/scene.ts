import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { radialTexture } from '../sceneKit';
import { BONE_NAMES, MODEL_HEIGHT, MODEL_URL, PHOTO_PROJECTION } from './config';
import { createProceduralMestre } from './procedural';
import { createPoseDriver, JOINTS, POSES, type JointName, type PoseName, type Rig } from './rig';

export type MestreScene = {
  setPose(p: PoseName): void;
  reset(): void;
  dispose(): void;
  /** true quando o boneco é o provisório (formas 3D); false com um modelo GLB carregado. */
  provisional: boolean;
  /** false quando o modelo não tem esqueleto nem animações (só gira e respira). */
  poses: boolean;
};

type Opts = {
  mobile: boolean;
  reducedMotion: boolean;
  /** Chamado quando a pose muda sozinha (o "Saudar" volta para a pose anterior). */
  onPose(p: PoseName): void;
  /** Caminho de um GLB para usar no lugar do boneco provisório (o padrão vem de config.ts). */
  modelUrl?: string | null;
  /** O GLB veio só com a forma: projeta a foto do Mestre por cima (ver PHOTO_PROJECTION em config.ts). */
  projectPhoto?: boolean;
};

const START_YAW = 0.32;
const SALUTE_HOLD = 1.5;

/** Pinta uma malha sem textura com a foto do Mestre vista de frente; nas costas, cores lisas. */
function projectPhoto(object: THREE.Object3D, photo: THREE.Texture, mask: THREE.Texture) {
  const P = PHOTO_PROJECTION;
  const [iw, ih] = P.size;
  // Tons tirados da própria foto (em sRGB; a cor é convertida para o espaço linear do shader).
  const skin = new THREE.Color().setRGB(0.64, 0.42, 0.31, THREE.SRGBColorSpace);
  const kimono = new THREE.Color().setRGB(0.9, 0.89, 0.88, THREE.SRGBColorSpace);
  const belt = new THREE.Color().setRGB(0.72, 0.1, 0.14, THREE.SRGBColorSpace);
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry;
    if (!geo.attributes.normal) geo.computeVertexNormals();
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const n = pos.count;
    const uv = new Float32Array(n * 2);
    const front = new Float32Array(n);
    const fill = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const fx = (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x);
      const fy = (bb.max.y - pos.getY(i)) / (bb.max.y - bb.min.y);
      // Visto de frente, o lado esquerdo da malha é o lado esquerdo da foto (com a frente em -Z, espelha).
      const px = P.box.minX + (P.front > 0 ? fx : 1 - fx) * (P.box.maxX - P.box.minX);
      const py = P.box.minY + fy * (P.box.maxY - P.box.minY);
      uv[i * 2] = px / iw;
      uv[i * 2 + 1] = 1 - py / ih;
      const nz = nor.getZ(i) * P.front;
      front[i] = THREE.MathUtils.smoothstep(nz, -0.25, 0.5);
      const c = py < P.headUntil ? skin : py > P.belt[0] && py < P.belt[1] ? belt : kimono;
      fill.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aFront', new THREE.BufferAttribute(front, 1));
    geo.setAttribute('aFill', new THREE.BufferAttribute(fill, 3));
    const mat = new THREE.MeshStandardMaterial({ map: photo, roughness: 0.78, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uMask = { value: mask };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aFront;\nattribute vec3 aFill;\nvarying float vFront;\nvarying vec3 vFill;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvFront = aFront;\nvFill = aFill;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uMask;\nvarying float vFront;\nvarying vec3 vFill;')
        .replace(
          '#include <map_fragment>',
          // Fora do recorte (fundo da foto), usa a cor lisa também.
          'vec4 photoColor = texture2D( map, vMapUv );\nfloat inside = smoothstep( 0.35, 0.9, texture2D( uMask, vMapUv ).r );\ndiffuseColor.rgb *= mix( vFill, photoColor.rgb, vFront * inside );',
        );
    };
    mesh.material = mat;
  });
}

/** Tenta carregar o modelo profissional (config.ts); devolve null para usar o boneco provisório. */
async function loadModel(url: string | null, photo: boolean): Promise<{ object: THREE.Object3D; rig: Rig; clips: THREE.AnimationClip[] } | null> {
  if (!url) return null;
  try {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(url);
    const object = gltf.scene;
    if (photo) {
      const loader = new THREE.TextureLoader();
      const [tex, mask] = await Promise.all([loader.loadAsync(PHOTO_PROJECTION.src), loader.loadAsync(PHOTO_PROJECTION.mask)]);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      projectPhoto(object, tex, mask);
    }
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const s = MODEL_HEIGHT / Math.max(size.y, 1e-6);
    object.scale.setScalar(s);
    object.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s);
    object.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
    });
    const joints: Rig['joints'] = {};
    for (const name of JOINTS) {
      const bone = object.getObjectByName(BONE_NAMES[name] ?? name);
      if (bone) joints[name] = bone;
    }
    return { object, rig: { root: object, joints }, clips: gltf.animations };
  } catch (err) {
    console.warn('Modelo do Mestre não carregou; usando o boneco provisório.', err);
    return null;
  }
}

export async function createMestreScene(host: HTMLElement, opts: Opts): Promise<MestreScene> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.mobile ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'mestre3d__canvas';
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.32;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const lookAt = new THREE.Vector3(0, 1.02, 0);

  // ---------- Luz de estúdio: principal quente, preenchimento e contraluz vermelha ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a0508, 0.45));
  const key = new THREE.DirectionalLight(0xfff3e6, 2.7);
  key.position.set(2.2, 4.2, 3.4);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(opts.mobile ? 1024 : 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -1.4;
  key.shadow.camera.right = key.shadow.camera.top = 1.4;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 12;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.55);
  fill.position.set(-3, 2, 2.5);
  scene.add(fill);
  const rimL = new THREE.DirectionalLight(0xff1a2a, 3.2);
  rimL.position.set(-3, 2.6, -3);
  scene.add(rimL);
  const rimR = new THREE.DirectionalLight(0xff2a36, 2.2);
  rimR.position.set(3.2, 1.6, -2.6);
  scene.add(rimR);

  // ---------- Chão: sombra suave e brilho vermelho embaixo da base ----------
  const disposables: { dispose(): void }[] = [pmrem, env];
  const floorGeo = new THREE.CircleGeometry(2.2, 64);
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.55 });
  const floor = new THREE.Mesh(floorGeo, shadowMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const glowTex = radialTexture('rgba(249,10,24,0.42)', 'rgba(249,10,24,0)');
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.002;
  scene.add(glow);
  const contactTex = radialTexture('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)');
  const contactMat = new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false });
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), contactMat);
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.004;
  scene.add(contact);
  disposables.push(floorGeo, shadowMat, glowTex, glowMat, glow.geometry, contactTex, contactMat, contact.geometry);

  // ---------- O personagem ----------
  const turntable = new THREE.Group();
  scene.add(turntable);
  const proc = createProceduralMestre();
  disposables.push(proc);
  turntable.add(proc.root);
  let rig: Rig = proc;
  let mixer: THREE.AnimationMixer | null = null;
  let actions: Partial<Record<PoseName, THREE.AnimationAction>> = {};
  const model = await loadModel(opts.modelUrl === undefined ? MODEL_URL : opts.modelUrl, !!opts.projectPhoto);
  if (model) {
    proc.figure.visible = false;
    model.object.position.y += proc.baseHeight;
    proc.root.add(model.object);
    rig = model.rig;
    if (model.clips.length) {
      mixer = new THREE.AnimationMixer(model.object);
      for (const name of Object.keys(POSES) as PoseName[]) {
        const clip = THREE.AnimationClip.findByName(model.clips, name);
        if (!clip) continue;
        const a = mixer.clipAction(clip);
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
        actions[name] = a;
      }
    }
  }
  const driver = createPoseDriver(rig);
  const modelScale = model ? model.object.scale.y : 1;

  let pose: PoseName = 'bracos';
  let resting: PoseName = 'bracos';
  let saluteLeft = 0;
  let current: THREE.AnimationAction | null = null;
  function apply(p: PoseName, instant: boolean) {
    pose = p;
    const a = actions[p];
    if (a && mixer) {
      a.reset().play();
      if (current && current !== a) {
        if (instant) current.stop();
        else current.crossFadeTo(a, 0.5, false);
      }
      current = a;
      // Na hora (pose inicial ou movimento reduzido): pula direto para o fim da animação.
      if (instant) {
        a.time = a.getClip().duration;
        mixer.update(1e-3);
      }
    } else {
      driver.setPose(POSES[p]);
      if (instant) driver.update(0, true, {}, 0);
    }
  }
  apply('bracos', true);

  // ---------- Girar arrastando (o toque vertical continua rolando a página) ----------
  let yaw = START_YAW;
  let yawTarget = START_YAW;
  let velocity = 0;
  let dragging: number | null = null;
  let lastX = 0;
  let lastT = 0;
  const onDown = (e: PointerEvent) => {
    dragging = e.pointerId;
    lastX = e.clientX;
    lastT = performance.now();
    velocity = 0;
    host.classList.add('is-dragging');
  };
  const onMove = (e: PointerEvent) => {
    if (dragging !== e.pointerId) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    const delta = (dx / Math.max(host.clientWidth, 1)) * Math.PI * 1.6;
    yawTarget += delta;
    velocity = delta / Math.max((now - lastT) / 1000, 1 / 120);
    lastX = e.clientX;
    lastT = now;
  };
  const onUp = (e: PointerEvent) => {
    if (dragging !== e.pointerId) return;
    dragging = null;
    host.classList.remove('is-dragging');
    if (opts.reducedMotion || performance.now() - lastT > 80) velocity = 0;
  };
  host.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  // ---------- Tamanho e enquadramento ----------
  function resize() {
    const w = Math.max(host.clientWidth, 1);
    const h = Math.max(host.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Recua a câmera em telas estreitas para o personagem (com os braços para cima) caber inteiro.
    const needW = 1.55;
    const needH = 2.45;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(needH / (2 * tan), needW / (2 * tan * camera.aspect));
    camera.position.set(0, 1.28, dist);
    camera.lookAt(lookAt);
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // ---------- Desenha só quando está na tela ----------
  let visible = true;
  const io = new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible) start();
  });
  io.observe(host);
  let raf = 0;
  let last = performance.now();
  let time = 0;
  const extra: Partial<Record<JointName, [number, number, number]>> = {};
  function frame(now: number) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
    last = now;
    time += dt;

    if (saluteLeft > 0) {
      saluteLeft -= dt;
      if (saluteLeft <= 0) {
        apply(resting, false);
        opts.onPose(resting);
      }
    }

    if (dragging === null && velocity !== 0) {
      yawTarget += velocity * dt;
      velocity *= Math.exp(-dt * 4);
      if (Math.abs(velocity) < 0.01) velocity = 0;
    }
    yaw += (yawTarget - yaw) * (opts.reducedMotion ? 1 : 1 - Math.exp(-dt * 12));
    turntable.rotation.y = yaw;

    // Respiração e balanço da guarda (some com o movimento reduzido).
    let bob = 0;
    for (const k of Object.keys(extra)) delete extra[k as JointName];
    if (!opts.reducedMotion) {
      const b = Math.sin(time * 1.7);
      extra.chest = [0.018 * b, 0, 0];
      extra.head = [-0.012 * b, 0, 0];
      extra.shoulderL = [0, 0, 0.015 * b];
      extra.shoulderR = [0, 0, -0.015 * b];
      bob = 0.003 * b;
      if (pose === 'guarda') {
        extra.hips = [0, 0.06 * Math.sin(time * 1.3), 0.025 * Math.sin(time * 2.6)];
        bob += 0.012 * Math.sin(time * 2.6);
      }
    }
    // Modelo sem esqueleto: só a respiração, no corpo inteiro.
    if (model && !Object.keys(rig.joints).length) model.object.scale.y = modelScale * (1 + 0.004 * Math.sin(time * 1.7) * (opts.reducedMotion ? 0 : 1));
    mixer?.update(dt);
    // Com uma animação do próprio modelo para esta pose, ela manda; senão, as poses do esqueleto.
    if (!(mixer && actions[pose])) driver.update(dt, opts.reducedMotion, extra, bob);
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
    provisional: !model,
    poses: !model || Object.keys(actions).length > 0 || Object.keys(rig.joints).length > 0,
    setPose(p) {
      if (p === 'saudar') {
        if (pose !== 'saudar') resting = pose;
        saluteLeft = SALUTE_HOLD + (opts.reducedMotion ? 0 : 0.4);
      } else {
        resting = p;
        saluteLeft = 0;
      }
      apply(p, opts.reducedMotion);
      start();
    },
    reset() {
      saluteLeft = 0;
      resting = 'bracos';
      yawTarget = START_YAW;
      velocity = 0;
      if (opts.reducedMotion) yaw = START_YAW;
      apply('bracos', opts.reducedMotion);
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
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      canvas.remove();
    },
  };
}
