import * as THREE from 'three';

/**
 * Esqueleto comum do boneco do Mestre. O boneco provisório (procedural.ts) é montado com estas juntas;
 * um modelo GLB profissional pode usar os mesmos nomes nos ossos (ou mapear em config.ts) e reaproveitar as poses.
 */
export const JOINTS = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'shoulderL',
  'elbowL',
  'shoulderR',
  'elbowR',
  'hipL',
  'kneeL',
  'hipR',
  'kneeR',
] as const;
export type JointName = (typeof JOINTS)[number];

export type PoseName = 'bracos' | 'guarda' | 'saudar' | 'campeao';
type Rot = [number, number, number];
/** Rotações (radianos, X/Y/Z) de cada junta a partir da posição de repouso, e quanto o quadril desce. */
export type Pose = { drop?: number; joints: Partial<Record<JointName, Rot>> };

/** Como cada pose aparece para quem usa o site. */
export const POSE_LABEL: Record<PoseName, string> = {
  bracos: 'braços cruzados',
  guarda: 'em guarda',
  saudar: 'saudando',
  campeao: 'pose de campeão',
};

// Convenções (o boneco olha para +Z; L é o lado esquerdo dele, em +X):
// braço levanta para a frente com X negativo; abre para o lado com Z (+ no esquerdo, − no direito);
// cotovelo dobra para a frente com X negativo e vira para dentro com Y (− no esquerdo, + no direito);
// perna sobe para a frente com X negativo; joelho dobra com X positivo.
export const POSES: Record<PoseName, Pose> = {
  // Como na foto: em pé, braços cruzados na frente do corpo.
  bracos: {
    joints: {
      shoulderL: [-0.5, 0, 0.12],
      elbowL: [-1.62, -1.5, 0],
      shoulderR: [-0.58, 0, -0.12],
      elbowR: [-1.5, 1.5, 0],
      hipL: [0, 0, 0.06],
      hipR: [0, 0, -0.06],
      head: [-0.04, 0, 0],
    },
  },
  // Base de luta: joelhos dobrados, corpo de lado, mãos na altura do rosto.
  guarda: {
    drop: 0.09,
    joints: {
      hips: [0, 0.5, 0],
      spine: [0.12, -0.18, 0],
      chest: [0.1, -0.12, 0],
      head: [0.05, -0.2, 0],
      shoulderL: [-1.0, 0, 0.32],
      elbowL: [-1.55, -0.45, 0],
      shoulderR: [-0.8, 0, -0.3],
      elbowR: [-1.75, 0.5, 0],
      hipL: [-0.55, 0, 0.12],
      kneeL: [0.75, 0, 0],
      hipR: [0.25, 0, -0.14],
      kneeR: [0.55, 0, 0],
    },
  },
  // Cumprimento do tatame: inclina o corpo para a frente, braços ao lado do corpo.
  saudar: {
    joints: {
      spine: [0.4, 0, 0],
      chest: [0.14, 0, 0],
      neck: [0.08, 0, 0],
      head: [0.1, 0, 0],
      shoulderL: [-0.5, 0, 0.06],
      elbowL: [-0.08, 0, 0],
      shoulderR: [-0.5, 0, -0.06],
      elbowR: [-0.08, 0, 0],
      hipL: [-0.08, 0, 0.03],
      hipR: [-0.08, 0, -0.03],
    },
  },
  // Braços para o alto, peito aberto, olhar para cima.
  campeao: {
    joints: {
      chest: [-0.1, 0, 0],
      head: [-0.25, 0, 0],
      shoulderL: [-0.25, 0, 2.55],
      elbowL: [-0.4, -0.2, 0],
      shoulderR: [-0.25, 0, -2.55],
      elbowR: [-0.4, 0.2, 0],
      hipL: [0, 0, 0.16],
      hipR: [0, 0, -0.16],
    },
  },
};

/** Ordem das rotações: no cotovelo, primeiro dobra (X) e depois vira para dentro (Y). */
const ORDER: Partial<Record<JointName, THREE.EulerOrder>> = { elbowL: 'YXZ', elbowR: 'YXZ' };

export type Rig = {
  root: THREE.Object3D;
  joints: Partial<Record<JointName, THREE.Object3D>>;
};

/**
 * Leva o esqueleto de uma pose para outra com suavidade (ou na hora, para quem pede menos movimento)
 * e soma por cima a respiração e o balanço da guarda.
 */
export function createPoseDriver(rig: Rig) {
  const bind = new Map<JointName, THREE.Quaternion>();
  const current = new Map<JointName, THREE.Quaternion>();
  const target = new Map<JointName, THREE.Quaternion>();
  for (const name of JOINTS) {
    const j = rig.joints[name];
    if (!j) continue;
    bind.set(name, j.quaternion.clone());
    current.set(name, j.quaternion.clone());
    target.set(name, j.quaternion.clone());
  }
  const hips = rig.joints.hips;
  const hipsY = hips ? hips.position.y : 0;
  let drop = 0;
  let dropTarget = 0;
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const add = new THREE.Quaternion();

  function setPose(pose: Pose) {
    for (const [name, b] of bind) {
      const r = pose.joints[name] ?? [0, 0, 0];
      e.set(r[0], r[1], r[2], ORDER[name] ?? 'XYZ');
      target.get(name)!.copy(b).multiply(q.setFromEuler(e));
    }
    dropTarget = pose.drop ?? 0;
  }

  /** extra: rotações somadas nesta tela (respiração etc.), em radianos. */
  function update(dt: number, instant: boolean, extra: Partial<Record<JointName, Rot>>, bob: number) {
    const k = instant ? 1 : 1 - Math.exp(-dt * 7);
    for (const [name, cur] of current) {
      cur.slerp(target.get(name)!, k);
      const j = rig.joints[name]!;
      j.quaternion.copy(cur);
      const x = extra[name];
      if (x) j.quaternion.multiply(add.setFromEuler(e.set(x[0], x[1], x[2])));
    }
    drop += (dropTarget - drop) * k;
    if (hips) hips.position.y = hipsY - drop + bob;
  }

  return { setPose, update };
}
