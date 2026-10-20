// Sem importar sceneKit (que traz o three.js): este arquivo entra no carregamento inicial da página.
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);

/**
 * v6.2: a jornada da faixa nas Turmas. Seis faixas espaçadas por igual ao longo da lista: a primeira troca começa
 * assim que a seção entra na tela (posição negativa = antes da primeira turma) e a última termina na última turma.
 * Fica num arquivo leve (sem three.js) porque a legenda das Turmas também usa.
 */
export const BELTS = ['branca', 'amarela', 'azul', 'roxa', 'marrom', 'preta'] as const;
export type BeltName = (typeof BELTS)[number];

/** Posição na lista em que a jornada começa (antes da primeira turma) e termina (última turma). */
export const JOURNEY_START = -1.2;
export const JOURNEY_END = 9;

export const BELT_CAPTION: Record<BeltName, string> = {
  branca: 'Faixa branca: onde todo mundo começa.',
  amarela: 'Nas crianças, as faixas vão do cinza ao verde.',
  azul: 'Faixa azul: a primeira graduação do adulto.',
  roxa: 'Depois da azul vem a roxa.',
  marrom: 'Depois da roxa, a marrom.',
  preta: 'E o caminho segue até a faixa preta.',
};

/** Faixa de saída, de chegada e quanto da troca já aconteceu (0 a 1) numa posição da lista. */
export function journeyAt(pos: number): { from: BeltName; to: BeltName; t: number } {
  const n = BELTS.length;
  const f = clamp01((pos - JOURNEY_START) / (JOURNEY_END - JOURNEY_START)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f));
  const local = f - i;
  // A troca ocupa a maior parte de cada trecho (devagar), com uma pausa curta em cada faixa.
  return { from: BELTS[i], to: BELTS[i + 1], t: smooth(clamp01((local - 0.12) / 0.76)) };
}

/** A faixa que aparece mais (para a legenda). */
export function beltShown(pos: number): BeltName {
  const j = journeyAt(pos);
  return j.t < 0.5 ? j.from : j.to;
}
