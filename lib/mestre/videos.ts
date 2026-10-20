/**
 * Opção 2 da v7: o Mestre em vídeo. Cada pose é um clipe curto (vertical, fundo escuro, mesmo enquadramento),
 * e `giro` é uma volta de 360° que o visitante "arrasta" com o dedo ou o mouse.
 *
 * ONDE TROCAR OS VÍDEOS: hoje os caminhos apontam para clipes de TESTE feitos a partir da foto (só para provar
 * o funcionamento). Quando chegarem os clipes gerados por IA (Kling, Higgsfield, Runway...) ou gravados com o
 * Mestre, coloque os .mp4 em `public/v7/videos/` e troque os caminhos abaixo (e `test: false`).
 * Dicas: 720x1080 ou 1080x1620, H.264, sem som, 3 a 6 s; o `giro` com um quadro-chave por quadro
 * (ffmpeg `-g 1`) para o arrastar responder na hora.
 */
export type VideoClips = {
  /** Em pé, respirando: fica em loop. */
  parado: string;
  saudar?: string;
  guarda?: string;
  campeao?: string;
  /** Uma volta completa (ou parte dela), usada para girar arrastando. */
  giro?: string;
  /** true enquanto forem os clipes de teste. */
  test: boolean;
};

export const VIDEO_CLIPS: VideoClips = {
  parado: '/v7/videos/teste-parado.mp4',
  saudar: '/v7/videos/teste-saudar.mp4',
  guarda: '/v7/videos/teste-guarda.mp4',
  campeao: '/v7/videos/teste-campeao.mp4',
  giro: '/v7/videos/teste-giro.mp4',
  test: true,
};
