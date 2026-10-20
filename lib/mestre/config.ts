import type { JointName } from './rig';

/**
 * ONDE TROCAR O BONECO.
 *
 * Hoje o site usa o boneco provisório feito com formas 3D (procedural.ts). Para usar um modelo profissional:
 * 1. Coloque o arquivo em `public/models/` (por exemplo `public/models/mestre.glb`). Prefira GLB com texturas
 *    comprimidas (KTX2/WebP) e malha otimizada; algo entre 2 e 8 MB carrega bem no celular.
 * 2. Escreva o caminho em MODEL_URL abaixo.
 * 3. Para as poses funcionarem, o modelo precisa de um esqueleto. Duas formas:
 *    - animações dentro do GLB com os nomes `bracos`, `guarda`, `saudar` e `campeao` (usadas primeiro); ou
 *    - ossos com os nomes das juntas (`hips`, `spine`, `chest`, `neck`, `head`, `shoulderL`, `elbowL`, ...),
 *      ou com os nomes que você ligar em BONE_NAMES (por exemplo `shoulderL: 'mixamorigLeftArm'`).
 *    Sem nada disso, o modelo aparece, gira e respira, mas não muda de pose.
 * O modelo é centralizado e ajustado para a mesma altura do boneco provisório, de pé sobre a base.
 * Se o arquivo não carregar, o site volta sozinho para o boneco provisório.
 */
export const MODEL_URL: string | null = null;

/** Nome do osso no modelo para cada junta, quando for diferente do nome da junta. */
export const BONE_NAMES: Partial<Record<JointName, string>> = {};

/** Altura do personagem na cena (o provisório tem cerca de 1,95), sem contar a base. */
export const MODEL_HEIGHT = 1.95;

/**
 * Para modelos gerados por IA que vêm só com a forma (sem textura): a foto do Mestre é projetada de frente sobre a
 * malha, e as costas recebem cores lisas (pele, kimono, faixa). `box` é onde o Mestre está na foto, em pixels
 * (medido na máscara de public/v7), e corresponde às bordas da malha vista de frente.
 */
export const PHOTO_PROJECTION = {
  src: '/img/mestre-neury.webp',
  mask: '/v7/mestre-mascara.png',
  size: [1024, 1536] as const,
  box: { minX: 144, maxX: 950, minY: 66, maxY: 1534 },
  /** 1 se a frente do modelo olha para +Z; -1 se olha para -Z. */
  front: 1 as 1 | -1,
  /** Faixas da foto (em pixels, de cima para baixo) que viram cabeça e faixa nas costas. */
  headUntil: 395,
  belt: [1050, 1120] as const,
};
