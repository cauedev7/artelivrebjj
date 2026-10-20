import * as THREE from 'three';
import type { JointName, Rig } from './rig';

/**
 * Boneco PROVISÓRIO do Mestre Neury, feito só com formas 3D (não é um modelo fiel nem escaneado).
 * Estilo boneco colecionável: cabeça maior, corpo forte, careca, barba grisalha, kimono branco com
 * detalhes vermelhos e faixa vermelha e branca, como nas fotos de referência. Fica sobre uma base redonda.
 * Para trocar por um modelo profissional, veja config.ts.
 */

const SKIN = 0x8a5840;
const BEARD = 0xbdb8b0;
const STUBBLE = 0x8a7568;
const WHITE = 0xf1f0eb;
const RED = 0xc8102e;
const INK = 0x141414;
const BASE_H = 0.08;

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Trama do tecido do kimono (relevo). */
function weave() {
  const t = canvas(256, 256, (g) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 4) {
      for (let x = 0; x < 256; x += 4) {
        const v = 110 + ((x + y) % 8 === 0 ? 70 : 0) + Math.random() * 40;
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(x, y, 3, 3);
      }
    }
  });
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 5);
  return t;
}

/** Faixa vermelha e branca (em blocos), com a costura. */
function beltTexture(blocks: number, blackTip = false) {
  return canvas(512, 32, (g) => {
    const w = 512 / blocks;
    for (let i = 0; i < blocks; i++) {
      g.fillStyle = i % 2 ? '#f1f0eb' : '#c8102e';
      g.fillRect(i * w, 0, w + 1, 32);
    }
    if (blackTip) {
      g.fillStyle = '#141414';
      g.fillRect(512 - 150, 0, 110, 32);
      g.fillStyle = '#f1f0eb';
      for (let k = 0; k < 3; k++) g.fillRect(512 - 135 + k * 24, 0, 9, 32);
    }
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 1;
    for (let y = 6; y < 32; y += 6) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(512, y);
      g.stroke();
    }
  });
}

/** Tira vermelha com "ARTE LIVRE" escrito na vertical, como no kimono. */
function stripeTexture() {
  return canvas(64, 320, (g) => {
    g.fillStyle = '#c8102e';
    g.fillRect(0, 0, 64, 320);
    g.fillStyle = '#ffffff';
    g.font = 'bold 34px Arial, Helvetica, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const letters = 'ARTE LIVRE'.split('');
    letters.forEach((ch, i) => g.fillText(ch, 32, 22 + i * 30));
  });
}

/** Nome do Mestre na lateral da base (centralizado na frente). */
function plateTexture() {
  return canvas(2048, 64, (g) => {
    g.fillStyle = '#111113';
    g.fillRect(0, 0, 2048, 64);
    g.fillStyle = '#c8102e';
    g.fillRect(0, 0, 2048, 5);
    g.fillRect(0, 59, 2048, 5);
    g.fillStyle = '#f3f3f4';
    g.font = 'bold 34px Arial, Helvetica, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('MESTRE NEURY GOMES  ·  ARTE LIVRE BJJ', 1024, 34);
  });
}

function lathe(points: [number, number][], mat: THREE.Material, flatten = 0.72) {
  const geo = new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    48,
  );
  const m = new THREE.Mesh(geo, mat);
  m.scale.z = flatten;
  return m;
}

export function createProceduralMestre(): Rig & { figure: THREE.Object3D; baseHeight: number; dispose(): void } {
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  const fabric = keep(weave());
  const kimono = keep(new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.82, bumpMap: fabric, bumpScale: 0.6 }));
  const kimonoInside = keep(new THREE.MeshStandardMaterial({ color: 0xe4e2dc, roughness: 0.9, side: THREE.DoubleSide }));
  const skin = keep(new THREE.MeshPhysicalMaterial({ color: SKIN, roughness: 0.55, clearcoat: 0.12, clearcoatRoughness: 0.6 }));
  const beard = keep(new THREE.MeshStandardMaterial({ color: BEARD, roughness: 1 }));
  const stubble = keep(new THREE.MeshStandardMaterial({ color: STUBBLE, roughness: 1 }));
  const ink = keep(new THREE.MeshStandardMaterial({ color: INK, roughness: 0.6 }));
  const eye = keep(new THREE.MeshPhysicalMaterial({ color: 0x1a1210, roughness: 0.15, clearcoat: 1 }));
  const red = keep(new THREE.MeshStandardMaterial({ color: RED, roughness: 0.7 }));
  const stripe = keep(new THREE.MeshStandardMaterial({ map: keep(stripeTexture()), roughness: 0.7 }));
  const belt = keep(new THREE.MeshStandardMaterial({ map: keep(beltTexture(10)), roughness: 0.75, side: THREE.DoubleSide }));
  const tailA = keep(new THREE.MeshStandardMaterial({ map: keep(beltTexture(4)), roughness: 0.75 }));
  const tailB = keep(new THREE.MeshStandardMaterial({ map: keep(beltTexture(4, true)), roughness: 0.75 }));
  const logoTex = keep(new THREE.TextureLoader().load('/img/logo.webp'));
  logoTex.colorSpace = THREE.SRGBColorSpace;
  const emblem = keep(new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.6 }));

  const geos: THREE.BufferGeometry[] = [];
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    geos.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const joint = (name: JointName, parent: THREE.Object3D, x: number, y: number, z = 0) => {
    const j = new THREE.Group();
    j.name = name;
    j.position.set(x, y, z);
    parent.add(j);
    joints[name] = j;
    return j;
  };
  const joints: Partial<Record<JointName, THREE.Object3D>> = {};
  const root = new THREE.Group();
  root.name = 'mestre';

  // ---------- Base de colecionável ----------
  const baseSide = keep(new THREE.MeshStandardMaterial({ map: keep(plateTexture()), roughness: 0.4 }));
  const baseTop = keep(new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.32, metalness: 0.2 }));
  const base = add(root, new THREE.CylinderGeometry(0.62, 0.66, BASE_H, 96, 1, false, Math.PI), [baseSide, baseTop, baseTop] as unknown as THREE.Material, 0, BASE_H / 2, 0);
  base.castShadow = false;
  const ring = add(root, new THREE.TorusGeometry(0.62, 0.008, 8, 128), keep(new THREE.MeshStandardMaterial({ color: RED, emissive: 0x5a0008, roughness: 0.4 })), 0, BASE_H, 0);
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = false;

  const figure = new THREE.Group();
  figure.position.y = BASE_H;
  root.add(figure);

  // ---------- Quadril, faixa e saia do kimono ----------
  const hips = joint('hips', figure, 0, 0.8);
  const skirt = lathe(
    [
      [0.262, 0.03],
      [0.272, -0.07],
      [0.286, -0.17],
    ],
    kimono,
  );
  geos.push(skirt.geometry);
  skirt.castShadow = skirt.receiveShadow = true;
  hips.add(skirt);
  const skirtIn = new THREE.Mesh(skirt.geometry, kimonoInside);
  skirtIn.scale.copy(skirt.scale).multiplyScalar(0.985);
  hips.add(skirtIn);

  const beltBand = add(hips, new THREE.CylinderGeometry(0.276, 0.276, 0.066, 64, 1, true), belt, 0, 0.0, 0);
  beltBand.scale.z = 0.74;
  add(hips, new THREE.BoxGeometry(0.095, 0.075, 0.05), belt, 0, 0.0, 0.205).rotation.z = 0.05;
  const tL = add(hips, new THREE.BoxGeometry(0.058, 0.24, 0.018), tailA, 0.038, -0.13, 0.222);
  tL.rotation.z = 0.12;
  const tR = add(hips, new THREE.BoxGeometry(0.058, 0.26, 0.018), tailB, -0.04, -0.14, 0.218);
  tR.rotation.z = -0.16;
  // A textura da ponta corre ao longo da altura da caixa.
  for (const t of [tL, tR]) {
    const uv = t.geometry.attributes.uv as THREE.BufferAttribute;
    const pos = t.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 - pos.getY(i) / 0.26, 0.5);
  }

  // ---------- Pernas (calça branca e pés descalços) ----------
  for (const side of [1, -1] as const) {
    const hip = joint(side > 0 ? 'hipL' : 'hipR', hips, side * 0.125, -0.06);
    add(hip, new THREE.CapsuleGeometry(0.112, 0.24, 6, 20), kimono, 0, -0.17);
    const knee = joint(side > 0 ? 'kneeL' : 'kneeR', hip, 0, -0.36);
    add(knee, new THREE.CapsuleGeometry(0.098, 0.22, 6, 20), kimono, 0, -0.15);
    add(knee, new THREE.CylinderGeometry(0.05, 0.055, 0.08, 16), skin, 0, -0.33);
    const foot = add(knee, new THREE.CapsuleGeometry(0.052, 0.13, 6, 14), skin, side * 0.008, -0.375, 0.045);
    foot.rotation.x = Math.PI / 2;
    foot.scale.set(1.15, 1, 0.7);
  }

  // ---------- Tronco: jaqueta, golas, camiseta preta e patches ----------
  const spine = joint('spine', hips, 0, 0.05);
  const belly = lathe(
    [
      [0.262, -0.07],
      [0.268, 0.08],
      [0.285, 0.24],
      [0.292, 0.36],
    ],
    kimono,
  );
  geos.push(belly.geometry);
  belly.castShadow = belly.receiveShadow = true;
  spine.add(belly);

  const chest = joint('chest', spine, 0, 0.34);
  const torso = lathe(
    [
      [0.288, -0.16],
      [0.305, 0.0],
      [0.298, 0.09],
      [0.255, 0.16],
      [0.16, 0.205],
      [0.06, 0.226],
      [0.0, 0.23],
    ],
    kimono,
  );
  geos.push(torso.geometry);
  torso.castShadow = torso.receiveShadow = true;
  chest.add(torso);

  // Camiseta preta aparecendo no "V" da gola.
  const vShape = new THREE.Shape();
  vShape.moveTo(-0.09, 0.2);
  vShape.lineTo(0.09, 0.2);
  vShape.lineTo(0, 0.05);
  vShape.closePath();
  add(chest, new THREE.ShapeGeometry(vShape), ink, 0, 0, 0.208);

  // Golas grossas cruzando até a faixa; a esquerda (lado direito de quem olha) tem a tira "ARTE LIVRE".
  // Inclinadas para trás embaixo, acompanhando a barriga, para não descolarem do corpo de perfil.
  const lapelGeo = new THREE.BoxGeometry(0.078, 0.52, 0.03);
  const lapelL = add(chest, lapelGeo, kimono, 0.035, -0.06, 0.2);
  lapelL.rotation.set(0.06, 0, -0.27);
  const lapelR = add(chest, lapelGeo, kimono, -0.038, -0.06, 0.194);
  lapelR.rotation.set(0.06, 0, 0.27);
  add(lapelL, new THREE.PlaneGeometry(0.058, 0.26), stripe, 0, -0.1, 0.0165);

  // Emblema da escola no peito (lado esquerdo de quem olha).
  const patch = add(chest, new THREE.CircleGeometry(0.056, 40), emblem, -0.165, 0.05, 0.196);
  patch.rotation.y = -0.55;

  // ---------- Braços ----------
  for (const side of [1, -1] as const) {
    const sh = joint(side > 0 ? 'shoulderL' : 'shoulderR', chest, side * 0.305, 0.085);
    add(sh, new THREE.SphereGeometry(0.105, 24, 16), kimono);
    add(sh, new THREE.CapsuleGeometry(0.094, 0.18, 6, 20), kimono, 0, -0.15);
    const sp = add(sh, new THREE.PlaneGeometry(0.06, 0.15), stripe, side * 0.098, -0.12, 0);
    sp.rotation.y = side * (Math.PI / 2);
    const el = joint(side > 0 ? 'elbowL' : 'elbowR', sh, 0, -0.29);
    add(el, new THREE.CapsuleGeometry(0.082, 0.13, 6, 20), kimono, 0, -0.1);
    add(el, new THREE.CylinderGeometry(0.046, 0.05, 0.06, 14), skin, 0, -0.22);
    const hand = add(el, new THREE.SphereGeometry(0.066, 20, 14), skin, 0, -0.285);
    hand.scale.set(0.95, 1.08, 0.85);
  }

  // ---------- Pescoço e cabeça ----------
  const neck = joint('neck', chest, 0, 0.2);
  add(neck, new THREE.CylinderGeometry(0.085, 0.095, 0.13, 20), skin, 0, 0.04);
  add(neck, new THREE.CylinderGeometry(0.105, 0.11, 0.05, 20), ink, 0, -0.005);
  const head = joint('head', neck, 0, 0.1);
  const skull = new THREE.Group();
  skull.position.set(0, 0.15, 0.012);
  skull.scale.set(0.96, 1.06, 1);
  head.add(skull);
  add(skull, new THREE.SphereGeometry(0.25, 48, 32), skin);
  // Barba grisalha cobrindo o queixo e a mandíbula, bigode e restinho de cabelo grisalho atrás.
  add(skull, new THREE.SphereGeometry(0.257, 48, 20, Math.PI * 0.1, Math.PI * 0.8, Math.PI * 0.6, Math.PI * 0.27), beard);
  add(skull, new THREE.SphereGeometry(0.254, 48, 12, Math.PI, Math.PI, Math.PI * 0.42, Math.PI * 0.2), stubble);
  const mous = add(skull, new THREE.CapsuleGeometry(0.016, 0.075, 4, 10), beard, 0, -0.072, 0.239);
  mous.rotation.z = Math.PI / 2;
  mous.scale.set(1, 1, 0.7);
  add(skull, new THREE.BoxGeometry(0.044, 0.007, 0.01), ink, 0, -0.096, 0.236);
  for (const side of [1, -1] as const) {
    const e = add(skull, new THREE.SphereGeometry(0.023, 16, 12), eye, side * 0.085, 0.012, 0.228);
    e.scale.z = 0.55;
    const brow = add(skull, new THREE.BoxGeometry(0.07, 0.012, 0.02), beard, side * 0.087, 0.06, 0.226);
    brow.rotation.z = side * -0.06;
    const ear = add(skull, new THREE.SphereGeometry(0.06, 16, 12), skin, side * 0.245, -0.005, 0);
    ear.scale.set(0.45, 1, 0.75);
  }
  const nose = add(skull, new THREE.SphereGeometry(0.036, 18, 14), skin, 0, -0.028, 0.248);
  nose.scale.set(1, 1.1, 0.9);

  return {
    root,
    joints,
    figure,
    baseHeight: BASE_H,
    dispose() {
      geos.forEach((g) => g.dispose());
      disposables.forEach((d) => d.dispose());
    },
  };
}
