import type { PoseName } from './rig';
import { VIDEO_CLIPS } from './videos';

/**
 * Player da opção 2: um vídeo por pose, empilhados; o "parado" fica em loop por baixo.
 * Os botões tocam a pose uma vez e voltam para o "parado"; arrastar mostra o "giro" e avança ou volta o vídeo
 * conforme o dedo, como girar o Mestre na mão.
 */
export type VideoScene = { setPose(p: PoseName): void; reset(): void; dispose(): void; test: boolean };
type Opts = { reducedMotion: boolean; onPose(p: PoseName): void };

export async function createVideoScene(host: HTMLElement, opts: Opts): Promise<VideoScene> {
  const box = document.createElement('div');
  box.className = 'mestre3d__videos';
  host.appendChild(box);
  const make = (src: string, loop: boolean) => {
    const v = document.createElement('video');
    v.src = src;
    v.muted = true;
    v.playsInline = true;
    v.loop = loop;
    v.preload = 'auto';
    v.setAttribute('playsinline', '');
    v.setAttribute('aria-hidden', 'true');
    v.className = 'mestre3d__video';
    box.appendChild(v);
    return v;
  };
  const parado = make(VIDEO_CLIPS.parado, true);
  const clips: Partial<Record<PoseName | 'giro', HTMLVideoElement>> = {};
  for (const k of ['saudar', 'guarda', 'campeao', 'giro'] as const) {
    const src = VIDEO_CLIPS[k];
    if (src) clips[k] = make(src, false);
  }
  await new Promise<void>((res, rej) => {
    parado.addEventListener('loadeddata', () => res(), { once: true });
    parado.addEventListener('error', () => rej(new Error('vídeo parado não carregou')), { once: true });
  });

  let shown: HTMLVideoElement = parado;
  const show = (v: HTMLVideoElement) => {
    shown = v;
    for (const el of [parado, ...Object.values(clips)]) el!.classList.toggle('is-on', el === v);
  };
  show(parado);
  if (!opts.reducedMotion) parado.play().catch(() => {});

  let returnTimer = 0;
  const backToRest = () => {
    window.clearTimeout(returnTimer);
    show(parado);
    if (!opts.reducedMotion) parado.play().catch(() => {});
    opts.onPose('bracos');
  };
  for (const k of ['saudar', 'guarda', 'campeao'] as const) clips[k]?.addEventListener('ended', () => k === 'saudar' && backToRest());

  // ---------- Girar arrastando: avança/volta o vídeo do giro ----------
  const giro = clips.giro;
  let dragging: number | null = null;
  let startX = 0;
  let startT = 0;
  const onDown = (e: PointerEvent) => {
    if (!giro || !giro.duration) return;
    dragging = e.pointerId;
    startX = e.clientX;
    startT = shown === giro ? giro.currentTime : 0;
    window.clearTimeout(returnTimer);
    giro.pause();
    giro.currentTime = startT;
    show(giro);
    host.classList.add('is-dragging');
  };
  const onMove = (e: PointerEvent) => {
    if (dragging !== e.pointerId || !giro) return;
    const d = giro.duration;
    const t = startT + ((e.clientX - startX) / Math.max(host.clientWidth, 1)) * d * 1.2;
    giro.currentTime = ((t % d) + d) % d;
  };
  const onUp = (e: PointerEvent) => {
    if (dragging !== e.pointerId) return;
    dragging = null;
    host.classList.remove('is-dragging');
    // Fica onde o visitante deixou por um tempo e depois volta a respirar de frente.
    returnTimer = window.setTimeout(backToRest, 2500);
  };
  host.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  // Só toca enquanto está na tela.
  const io = new IntersectionObserver(([en]) => {
    if (en.isIntersecting) {
      if (shown === parado && !opts.reducedMotion) parado.play().catch(() => {});
    } else {
      [parado, ...Object.values(clips)].forEach((v) => v!.pause());
    }
  });
  io.observe(host);

  return {
    test: VIDEO_CLIPS.test,
    setPose(p) {
      window.clearTimeout(returnTimer);
      const v = p === 'bracos' ? parado : clips[p];
      if (!v) return backToRest();
      if (v === parado) return backToRest();
      parado.pause();
      v.currentTime = 0;
      show(v);
      // Com menos movimento, mostra o fim da pose direto, sem tocar o clipe.
      if (opts.reducedMotion) {
        const toEnd = () => (v.currentTime = Math.max(0, v.duration - 0.05));
        if (v.readyState >= 1) toEnd();
        else v.addEventListener('loadedmetadata', toEnd, { once: true });
        if (p === 'saudar') returnTimer = window.setTimeout(backToRest, 1500);
      } else {
        v.play().catch(() => {});
      }
    },
    reset: backToRest,
    dispose() {
      window.clearTimeout(returnTimer);
      io.disconnect();
      host.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      box.remove();
    },
  };
}
