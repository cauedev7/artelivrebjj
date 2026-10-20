import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * A logo da equipe em 3D (seção dos Planos da v6): anel de metal escuro com bordas cromadas atrás e o triângulo
 * vermelho envernizado na frente, com a arte original (textos e leão) em relevo. As medidas saem da própria logo
 * (referencias/logo-original.png, 436x442; no site, public/img/logo-arte.png em dobro): anel com centro em (220, 221), raio de 175 px por fora e 146 por dentro;
 * triângulo vermelho com ponta em (217, 31) e base de (54, 321) a (386, 321). Na cena, 175 px = 1 unidade.
 */
const IMG_W = 436;
const IMG_H = 442;
const CX = 220;
const CY = 221;
const UNIT = 175;
const px = (x: number, y: number) => new THREE.Vector2((x - CX) / UNIT, (CY - y) / UNIT);

export type Logo3D = {
  group: THREE.Group;
  /** Brilho que passa pela logo (0 a 1 atravessa da esquerda para a direita). */
  setSweep(t: number): void;
  dispose(): void;
};

export function createLogo3D(renderer: THREE.WebGLRenderer, scene: THREE.Scene, onReady: () => void): Logo3D {
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  // Reflexos de estúdio para o metal e o verniz.
  const pmrem = keep(new THREE.PMREMGenerator(renderer));
  const env = keep(pmrem.fromScene(new RoomEnvironment(), 0.03).texture);
  scene.environment = env;
  scene.environmentIntensity = 1.15;

  const group = new THREE.Group();

  const art = keep(
    new THREE.TextureLoader().load('/img/logo-arte.png', () => onReady()),
  );
  art.colorSpace = THREE.SRGBColorSpace;
  art.anisotropy = 8;
  // As tampas da extrusão usam as coordenadas da forma como UV: leva essas coordenadas para os pixels da logo.
  art.repeat.set(UNIT / IMG_W, UNIT / IMG_H);
  art.offset.set(CX / IMG_W, (IMG_H - CY) / IMG_H);

  // ---------- Anel de metal escuro ----------
  const ringShape = new THREE.Shape().absarc(0, 0, 1, 0, Math.PI * 2, false);
  ringShape.holes.push(new THREE.Path().absarc(0, 0, 146 / UNIT, 0, Math.PI * 2, true));
  const ringGeo = keep(
    new THREE.ExtrudeGeometry(ringShape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.025, bevelSegments: 6, curveSegments: 160 }),
  );
  ringGeo.translate(0, 0, -0.26);
  // Preto como na logo, mas em metal polido, para refletir o estúdio e aparecer sobre o fundo escuro.
  const gunmetal = keep(new THREE.MeshPhysicalMaterial({ color: 0x5c5c64, metalness: 1, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 }));
  const ring = new THREE.Mesh(ringGeo, gunmetal);
  group.add(ring);
  // Fios de cromo nas bordas do anel.
  const chrome = keep(new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.12 }));
  for (const r of [1.03, 146 / UNIT - 0.025]) {
    const g = keep(new THREE.TorusGeometry(r, 0.012, 12, 220));
    const t = new THREE.Mesh(g, chrome);
    t.position.z = -0.08;
    group.add(t);
  }

  // ---------- Triângulo vermelho com a arte ----------
  const a = px(217, 34);
  const b = px(57, 319);
  const c = px(383, 319);
  const tri = new THREE.Shape([b, c, a]);
  const triGeo = keep(
    new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.035, bevelSegments: 8, curveSegments: 1 }),
  );
  // Frente da peça: a arte original com verniz; o relevo vem do claro/escuro da própria arte.
  const face = keep(
    new THREE.MeshPhysicalMaterial({
      map: art,
      bumpMap: art,
      bumpScale: 1.2,
      roughness: 0.42,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    }),
  );
  // Laterais e chanfro: vermelho metálico, como tinta automotiva.
  const candy = keep(new THREE.MeshPhysicalMaterial({ color: 0xa3101c, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 }));
  const triangle = new THREE.Mesh(triGeo, [face, candy]);
  group.add(triangle);
  // Traseira do triângulo sem a arte (só vermelho).
  const backGeo = keep(new THREE.ShapeGeometry(tri));
  const backMat = keep(new THREE.MeshPhysicalMaterial({ color: 0xa3101c, metalness: 0.55, roughness: 0.3, clearcoat: 1, side: THREE.DoubleSide }));
  const back = new THREE.Mesh(backGeo, backMat);
  back.position.z = -0.047;
  group.add(back);

  // Centraliza na altura (o triângulo sobe um pouco acima do anel).
  group.position.y = -0.04;

  // ---------- Luz de estúdio e um brilho que atravessa a peça ----------
  const key = new THREE.DirectionalLight(0xfff1e6, 2.4);
  key.position.set(2.5, 3, 4);
  scene.add(key);
  const rimL = new THREE.DirectionalLight(0xff2234, 3);
  rimL.position.set(-4, 1.5, -2.5);
  scene.add(rimL);
  const rimR = new THREE.DirectionalLight(0xff4050, 1.6);
  rimR.position.set(4, -1, -2);
  scene.add(rimR);
  const sweep = new THREE.PointLight(0xffffff, 0, 6, 1.6);
  sweep.position.set(-2.5, 1.2, 1.6);
  scene.add(sweep);

  return {
    group,
    setSweep(t) {
      sweep.position.x = -2.6 + t * 5.2;
      sweep.intensity = Math.sin(Math.min(Math.max(t, 0), 1) * Math.PI) * 14;
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      scene.environment = null;
    },
  };
}
