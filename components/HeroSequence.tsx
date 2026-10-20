'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDownIcon } from './icons';
import Logo from './Logo';
import type { SpaceScene } from '@/lib/spaceScene';

gsap.registerPlugin(ScrollTrigger);

type Sequence = {
  id: '4k' | 'uhd' | 'hd' | 'sd' | 'mobile';
  count: number;
  src: (i: number) => string;
  /** Ponto (0–1) do quadro que precisa ficar sempre visível: os atletas. */
  focusX: number;
  /** Onde fica a faixa preta do atleta de cima no último quadro: alvo do zoom de transição. */
  belt: { x: number; y: number };
  mobile: boolean;
};

const pad = (n: number) => String(n).padStart(3, '0');

// Todos os quadros vêm do vídeo 4K (3840x2160, 60 fps), tirados a 30 fps no desktop e 24 fps no celular.
const DESKTOP_FRAMES = 238;
const MOBILE_FRAMES = 190;

// 1920x1080, para telas grandes comuns.
const HD: Sequence = {
  id: 'hd',
  count: DESKTOP_FRAMES,
  src: (i) => `/hero/desktop/f_${pad(i + 1)}.webp`,
  focusX: 0.66,
  belt: { x: 0.675, y: 0.63 },
  mobile: false,
};

// 3840x2160, para monitores 4K e telas retina muito grandes.
const UHD4K: Sequence = { ...HD, id: '4k', src: (i) => `/hero/desktop-4k/f_${pad(i + 1)}.webp` };

// 2560x1440, para telas retina de notebook.
const UHD: Sequence = { ...HD, id: 'uhd', src: (i) => `/hero/desktop-uhd/f_${pad(i + 1)}.webp` };

// 1280x720, para telas menores e conexões mais lentas.
const SD: Sequence = { ...HD, id: 'sd', src: (i) => `/hero/desktop-sd/f_${pad(i + 1)}.webp` };

// Recorte vertical (o equivalente a 820x720 a partir de x=460 num quadro de 1280): os dois atletas cabem inteiros.
const MOBILE: Sequence = {
  id: 'mobile',
  count: MOBILE_FRAMES,
  src: (i) => `/hero/mobile/f_${pad(i + 1)}.webp`,
  focusX: 0.5,
  belt: { x: 0.5, y: 0.63 },
  mobile: true,
};

/** Escolhe a versão pela largura real da tela em pixels físicos. */
function pickSequence(): Sequence {
  if (window.innerWidth < 768) return MOBILE;
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  if (conn?.effectiveType === '3g') return SD;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = window.innerWidth * dpr;
  if (px > 3200) return UHD4K;
  if (px > 2200) return UHD;
  return px > 1600 ? HD : SD;
}

/** Fração da rolagem do hero dedicada ao vídeo; o resto é a transição para a próxima cena. */
const VIDEO_END = 0.86;

/** As quatro palavras e a faixa de progresso em que cada uma vive. */
const BEATS = [
  { word: 'Encare.', from: 0.0, to: 0.21 },
  { word: 'Pegue.', from: 0.22, to: 0.43 },
  { word: 'Derrube.', from: 0.44, to: 0.65 },
  { word: 'Evolua.', from: 0.66, to: 0.9 },
] as const;

/** Constante de tempo da inércia: quanto maior, mais "pesado" e macio o vídeo segue a rolagem. */
const INERTIA = 0.14;
/** Aproximação lenta da câmera ao longo da luta. */
const CAMERA_PUSH = 0.07;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);
const easeIn = (v: number) => v * v * v;

type Props = {
  /**
   * "scroll": a luta controlada pela rolagem (versão principal).
   * "transform": um kimono preto liso se transforma no kimono da Arte Livre (versão principal da v6).
   * "kimono": o kimono da escola como personagem de uma cena 3D cinematográfica (hero da v5).
   * "space": voo 3D pelo espaço com o emblema da escola, sem os lutadores (hero das v2 e v3).
   * "type": só as palavras, com entrada ao abrir e troca pela rolagem, sobre o preto (versão principal da v4).
   * "static": foto fixa (usada automaticamente para quem pede menos movimento).
   */
  variant?: 'scroll' | 'transform' | 'kimono' | 'space' | 'type' | 'static';
};

export default function HeroSequence({ variant = 'scroll' }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const introRef = useRef<HTMLDivElement>(null);
  const finaleRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'scrub' | 'static'>(variant === 'static' ? 'static' : 'scrub');

  useEffect(() => {
    if (variant === 'static') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const slow = !!conn && (conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g');
    if (reduce || slow) {
      setMode('static');
      document.documentElement.classList.add('hero-static');
      return;
    }

    // "type", "space" e "kimono" não usam os quadros do vídeo.
    const scene3d = variant === 'space' || variant === 'kimono' || variant === 'transform';
    const typeOnly = variant === 'type' || scene3d;
    let space: SpaceScene | null = null;
    let heroVisible = true;
    const section = sectionRef.current!;
    const stage = stageRef.current!;
    // Na versão só com palavras não há canvas: um canvas solto evita checagens, e nada é desenhado nele.
    const canvas = canvasRef.current ?? document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false })!;

    let seq = pickSequence();
    // Quadros comprimidos (todos, ~6–12 MB) e quadros decodificados (só uma janela em volta da posição atual).
    type Drawable = ImageBitmap | HTMLImageElement;
    let blobs: (Blob | null)[] = [];
    let frames: (Drawable | null)[] = [];
    // Cópias leves (960 px; 480 no celular) de 1 a cada PROXY_STEP quadros, sempre prontas: cobrem saltos grandes de rolagem
    // enquanto o quadro em resolução cheia ainda está sendo decodificado.
    const PROXY_STEP = 6;
    const PROXY_WIDTH = 960;
    let proxies: (ImageBitmap | null)[] = [];
    let pending = new Set<number>();
    let fetchedCount = 0;
    let natural = { w: 0, h: 0 };
    let current = 0;
    let direction = 1;
    let generation = 0;
    let disposed = false;
    let base = { dx: 0, dy: 0, dw: 0, dh: 0 };
    let dpr = 1;
    let needsDraw = true;

    // Progresso alvo (rolagem) e progresso exibido (com inércia).
    let target = 0;
    let shown = 0;
    // Entrada de abertura, 0 → 1, uma vez quando o primeiro quadro chega.
    const intro = { t: 0 };

    function sizeCanvas() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      needsDraw = true;
    }

    /** Desktop: "cover" com foco nos atletas. Mobile: a luta inteira na largura, no meio da tela, fundindo no preto. */
    function computeGeometry() {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const iw = natural.w;
      const ih = natural.h;
      if (!iw) return;
      if (seq.mobile) {
        const scale = Math.max(w / (iw * 0.92), (h * 0.46) / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        base = { dx: (w - dw) * seq.focusX, dy: h * 0.56 - dh / 2, dw, dh };
      } else {
        const scale = Math.max(w / iw, h / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        // Mantém o ponto de foco dentro da tela quando a janela é mais estreita que 16:9.
        const dx = Math.min(0, Math.max(w - dw, w * 0.6 - dw * seq.focusX));
        base = { dx, dy: (h - dh) / 2, dw, dh };
      }
      needsDraw = true;
    }

    function nearestLoaded(i: number) {
      if (frames[i]) return i;
      for (let d = 1; d < seq.count; d++) {
        if (i - d >= 0 && frames[i - d]) return i - d;
        if (i + d < seq.count && frames[i + d]) return i + d;
      }
      return -1;
    }

    /* ---------- Janela de decodificação ---------- */
    // Decodifica fora da thread principal os quadros à frente (no sentido da rolagem) e um pouco atrás,
    // e libera os distantes: o quadro desenhado já está sempre pronto, sem custo de decodificação na hora.
    // O tamanho da janela depende do tamanho do quadro: cerca de 320 MB de quadros decodificados no máximo.
    const MEMORY_BUDGET = 320 * 1024 * 1024;
    let AHEAD = 18;
    let BEHIND = 8;
    let KEEP = 26;
    const MAX_DECODES = 3;
    function sizeWindow() {
      if (!natural.w) return;
      const fit = Math.floor(MEMORY_BUDGET / (natural.w * natural.h * 4));
      AHEAD = Math.max(6, Math.min(18, Math.round(fit * 0.55)));
      BEHIND = Math.max(3, Math.min(8, Math.round(fit * 0.25)));
      KEEP = AHEAD + 2;
    }
    const canBitmap = typeof window.createImageBitmap === 'function';

    function decode(i: number) {
      const blob = blobs[i];
      if (!blob) return;
      pending.add(i);
      const gen = generation;
      const done = (d: Drawable | null) => {
        pending.delete(i);
        if (disposed || gen !== generation) {
          if (d && 'close' in d) d.close();
          return;
        }
        if (d) {
          frames[i] = d;
          needsDraw = true;
        }
        pump();
      };
      if (canBitmap) {
        createImageBitmap(blob).then(done, () => done(null));
      } else {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.src = url;
        img
          .decode()
          .then(() => done(img), () => done(null))
          .finally(() => URL.revokeObjectURL(url));
      }
    }

    function pump() {
      if (disposed) return;
      const lo = Math.max(0, current - (direction > 0 ? BEHIND : AHEAD));
      const hi = Math.min(seq.count - 1, current + (direction > 0 ? AHEAD : BEHIND));
      // Do mais próximo para o mais distante.
      for (let d = 0; d <= Math.max(AHEAD, BEHIND) && pending.size < MAX_DECODES; d++) {
        for (const i of [current + d * direction, current - d * direction]) {
          if (i < lo || i > hi || frames[i] || pending.has(i) || !blobs[i]) continue;
          decode(i);
          if (pending.size >= MAX_DECODES) break;
        }
      }
      // Libera memória dos quadros longe da posição atual (o primeiro fica sempre).
      for (let i = 1; i < frames.length; i++) {
        const fr = frames[i];
        if (fr && Math.abs(i - current) > KEEP) {
          if ('close' in fr) fr.close();
          frames[i] = null;
        }
      }
    }

    /** Desenha o quadro (com fusão no seguinte), com a câmera e o zoom de transição aplicados no próprio canvas. */
    function draw(p: number) {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const videoP = clamp01(p / VIDEO_END);
      const f = videoP * (seq.count - 1);
      const i0 = Math.floor(f);
      const i1 = Math.min(i0 + 1, seq.count - 1);
      const frac = f - i0;
      let a = nearestLoaded(i0);
      // Quadro cheio longe do pedido: usa a cópia leve mais próxima, se estiver mais perto.
      let img: Drawable | null = a >= 0 ? frames[a] : null;
      if (a < 0 || Math.abs(a - i0) > 2) {
        const pi = Math.round(i0 / PROXY_STEP) * PROXY_STEP;
        const proxy = proxies[Math.min(pi, seq.count - 1)] ?? proxies[pi - PROXY_STEP];
        if (proxy && (a < 0 || Math.abs(pi - i0) < Math.abs(a - i0))) {
          img = proxy;
          a = -1;
        }
      }
      if (!img) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#111116';
      ctx.fillRect(0, 0, w, h);

      // Câmera: aproximação lenta ao longo da luta + leve recuo na abertura.
      const cam = 1 + CAMERA_PUSH * smooth(videoP) + 0.06 * (1 - easeOut(intro.t));
      const fx = base.dx + base.dw * seq.focusX;
      const fy = base.dy + base.dh * 0.55;
      // Transição: zoom profundo na faixa preta.
      const k = smooth(clamp01((p - VIDEO_END) / (1 - VIDEO_END)));
      const zoom = 1 + k * k * 9;
      const bx = base.dx + base.dw * seq.belt.x;
      const by = base.dy + base.dh * seq.belt.y;

      ctx.translate(bx, by);
      ctx.scale(zoom, zoom);
      ctx.translate(-bx, -by);
      ctx.translate(fx, fy);
      ctx.scale(cam, cam);
      ctx.translate(-fx, -fy);

      ctx.drawImage(img, base.dx, base.dy, base.dw, base.dh);
      // Fusão com o quadro seguinte: o movimento corre contínuo entre um quadro e outro.
      const next = frames[i1];
      if (a === i0 && i1 !== i0 && next && frac > 0.01) {
        ctx.globalAlpha = frac;
        ctx.drawImage(next, base.dx, base.dy, base.dw, base.dh);
        ctx.globalAlpha = 1;
      }

      if (seq.mobile) {
        // Véu para fundir as bordas do vídeo no preto do galpão (único gradiente permitido).
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const top = by - (by - base.dy) * zoom * cam;
        const height = base.dh * zoom * cam;
        const fade = height * 0.22;
        let g = ctx.createLinearGradient(0, top, 0, top + fade);
        g.addColorStop(0, 'rgba(17,17,22,1)');
        g.addColorStop(1, 'rgba(17,17,22,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, top - 1, w, fade + 1);
        g = ctx.createLinearGradient(0, top + height - fade, 0, top + height);
        g.addColorStop(0, 'rgba(17,17,22,0)');
        g.addColorStop(1, 'rgba(17,17,22,1)');
        ctx.fillStyle = g;
        ctx.fillRect(0, top + height - fade, w, fade + 1);
      }

      veilRef.current!.style.opacity = String(smooth(clamp01((k - 0.3) / 0.65)));
    }

    /** Palavras com revelação por máscara: sobem de baixo, saem por cima. */
    function renderText(p: number) {
      const it = easeOut(intro.t);
      // Só palavras: o progresso vai para o CSS, que move e acende o brilho de neon (.hero--type).
      if (variant === 'type') stage.style.setProperty('--p', p.toFixed(4));
      BEATS.forEach((b, i) => {
        const el = wordRefs.current[i];
        if (!el) return;
        const ramp = 0.045;
        const vin = i === 0 ? it : easeOut(clamp01((p - b.from) / ramp));
        const vout = easeIn(clamp01((p - (b.to - ramp)) / ramp));
        const y = (1 - vin) * 108 - vout * 108;
        const visible = vin > 0.001 && vout < 0.999;
        el.style.transform = `translate3d(0, ${y}%, 0)`;
        el.style.visibility = visible ? 'visible' : 'hidden';
      });

      const introEl = introRef.current!;
      const iv = 1 - smooth(clamp01((p - 0.02) / 0.05));
      introEl.style.opacity = String(iv);
      introEl.style.transform = `translate3d(0, ${(1 - iv) * -20}px, 0)`;
      introEl.style.visibility = iv < 0.01 ? 'hidden' : 'visible';

      const fin = finaleRef.current!;
      const fin_in = smooth(clamp01((p - 0.7) / 0.04));
      const fin_out = smooth(clamp01((p - 0.86) / 0.04));
      const fv = fin_in * (1 - fin_out);
      fin.style.opacity = String(fv);
      fin.style.transform = `translate3d(0, ${(1 - fin_in) * 24 - fin_out * 24}px, 0)`;
      fin.style.visibility = fv < 0.01 ? 'hidden' : 'visible';
    }

    let lastShown = -1;
    let lastIntro = -1;
    function tick(_time: number, deltaMs: number) {
      if (disposed) return;
      const dt = Math.min(deltaMs / 1000, 0.1);
      // Na cena do kimono, um pouco mais de peso: o movimento fica mais fluido e menos nervoso.
      const alpha = 1 - Math.exp(-dt / (variant === 'kimono' || variant === 'transform' ? 0.22 : INERTIA));
      shown += (target - shown) * alpha;
      if (Math.abs(target - shown) < 0.00002) shown = target;
      const idx = Math.round(clamp01(shown / VIDEO_END) * (seq.count - 1));
      if (!typeOnly && idx !== current) {
        direction = idx > current ? 1 : -1;
        current = idx;
        pump();
      }
      // A cena 3D anima sozinha (giros, portais), então desenha todo quadro enquanto o hero está na tela.
      if (space && heroVisible) {
        space.update(shown, dt);
        veilRef.current!.style.opacity = String(smooth(clamp01((shown - 0.9) / 0.09)));
      }
      if (needsDraw || shown !== lastShown || intro.t !== lastIntro) {
        if (!typeOnly) draw(shown);
        renderText(shown);
        lastShown = shown;
        lastIntro = intro.t;
        needsDraw = false;
      }
    }

    // Fila de decodificação das cópias leves, uma de cada vez, para não disputar com os quadros cheios.
    let proxyQueue: Promise<void> = Promise.resolve();
    function queueProxy(i: number, blob: Blob, gen: number) {
      if (!canBitmap) return;
      const width = seq.mobile ? PROXY_WIDTH / 2 : PROXY_WIDTH;
      proxyQueue = proxyQueue.then(() =>
        createImageBitmap(blob, { resizeWidth: Math.min(width, natural.w || width), resizeQuality: 'medium' })
          .then((bmp) => {
            if (disposed || gen !== generation) bmp.close();
            else proxies[i] = bmp;
          })
          .catch(() => {}),
      );
    }

    function loadSequence() {
      generation++;
      const gen = generation;
      frames.forEach((fr) => fr && 'close' in fr && fr.close());
      blobs = new Array(seq.count).fill(null);
      frames = new Array(seq.count).fill(null);
      proxies.forEach((pr) => pr && pr.close());
      proxies = new Array(seq.count).fill(null);
      pending = new Set();
      fetchedCount = 0;
      const mySeq = seq;

      // Ordem de download: primeiro quadro, depois um a cada 8, depois a cada 4, 2 e o resto.
      const order: number[] = [];
      const seen = new Set<number>([0]);
      for (const step of [8, 4, 2, 1]) {
        for (let i = 0; i < seq.count; i += step) {
          if (seen.has(i)) continue;
          seen.add(i);
          order.push(i);
        }
      }

      const fetchFrame = (i: number) =>
        fetch(mySeq.src(i))
          .then((r) => (r.ok ? r.blob() : null))
          .then((blob) => {
            if (disposed || gen !== generation || !blob) return;
            blobs[i] = blob;
            if (i % PROXY_STEP === 0) queueProxy(i, blob, gen);
            fetchedCount++;
            const ratio = fetchedCount / mySeq.count;
            if (loaderRef.current) {
              loaderRef.current.style.transform = `scaleX(${ratio})`;
              if (ratio >= 1) loaderRef.current.parentElement!.dataset.done = 'true';
            }
            pump();
          })
          .catch(() => {});

      let cursor = 0;
      const CONCURRENCY = 6;
      const next = (): Promise<void> | void => {
        if (disposed || gen !== generation || cursor >= order.length) return;
        const i = order[cursor++];
        return fetchFrame(i).then(next);
      };

      // O primeiro quadro sozinho, com prioridade; os outros em paralelo depois.
      fetch(mySeq.src(0))
        .then((r) => r.blob())
        .then((blob) => (canBitmap ? createImageBitmap(blob).then((bmp) => ({ blob, bmp })) : null))
        .then((res) => {
          if (disposed || gen !== generation) return;
          if (res) {
            blobs[0] = res.blob;
            frames[0] = res.bmp;
            natural = { w: res.bmp.width, h: res.bmp.height };
            sizeWindow();
            fetchedCount++;
          } else {
            const img = new Image();
            img.src = mySeq.src(0);
            return img.decode().then(() => {
              frames[0] = img;
              natural = { w: img.naturalWidth, h: img.naturalHeight };
              sizeWindow();
            });
          }
        })
        .then(() => {
          if (disposed || gen !== generation) return;
          computeGeometry();
          stage.dataset.ready = 'true';
          if (intro.t < 1) gsap.to(intro, { t: 1, duration: 1.6, ease: 'none', delay: 0.1 });
          for (let c = 0; c < CONCURRENCY; c++) next();
        })
        .catch(() => {});
    }

    if (!typeOnly) {
      sizeCanvas();
      loadSequence();
    }

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        target = self.progress;
      },
    });
    target = st.progress;
    shown = target;
    // Se a página abrir já rolada, não refaz a entrada.
    if (target > 0.02) intro.t = 1;
    // Sem quadros para esperar: a entrada começa logo.
    if (typeOnly && intro.t < 1) gsap.to(intro, { t: 1, duration: 1.4, ease: 'none', delay: 0.2 });

    gsap.ticker.add(tick);

    // Cena 3D: baixada só nesta versão, depois que a página abre.
    let io: IntersectionObserver | null = null;
    const onPointer = (e: PointerEvent) => space?.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    if (scene3d) {
      io = new IntersectionObserver(([entry]) => (heroVisible = entry.isIntersecting));
      io.observe(section);
      if (window.matchMedia('(pointer: fine)').matches) window.addEventListener('pointermove', onPointer, { passive: true });
      const mobile = window.innerWidth < 768;
      if (variant === 'transform') {
        import('@/lib/transformScene').then(({ createTransformScene }) => {
          if (disposed) return;
          space = createTransformScene(stage, { mobile, onReady: () => (stage.dataset.ready = 'true') });
        });
      } else if (variant === 'kimono') {
        import('@/lib/kimonoScene').then(({ createKimonoScene }) => {
          if (disposed) return;
          // Só aparece quando o kimono e o fundo terminaram de carregar.
          space = createKimonoScene(stage, { mobile, onReady: () => (stage.dataset.ready = 'true') });
        });
      } else {
        import('@/lib/spaceScene').then(({ createSpaceScene }) => {
          if (disposed) return;
          space = createSpaceScene(stage, { mobile });
          if (space) stage.dataset.ready = 'true';
        });
      }
    }

    let resizeRaf = 0;
    const onResize = () => {
      if (space) space.resize();
      if (typeOnly) return;
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        sizeCanvas();
        const wanted = pickSequence();
        // Troca de sequência só ao cruzar celular ↔ desktop, para não recarregar à toa.
        if (wanted.mobile !== seq.mobile) {
          seq = wanted;
          loadSequence();
        } else {
          computeGeometry();
        }
      });
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      space?.dispose();
      io?.disconnect();
      window.removeEventListener('pointermove', onPointer);
      frames.forEach((fr) => fr && 'close' in fr && fr.close());
      proxies.forEach((pr) => pr && pr.close());
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', onResize);
      st.kill();
      gsap.killTweensOf(intro);
    };
  }, [variant]);

  const staticMode = mode === 'static';
  const typeMode = variant === 'type' && !staticMode;
  const spaceMode = (variant === 'space' || variant === 'kimono' || variant === 'transform') && !staticMode;
  // A foto com os lutadores só aparece na versão com lutadores (ou no modo estático dela).
  const showPoster = variant === 'scroll' || variant === 'static';

  return (
    <section
      ref={sectionRef}
      id="inicio"
      className={`hero ${staticMode ? 'hero--static' : ''} ${typeMode ? 'hero--type' : ''} ${spaceMode ? 'hero--space' : ''}`}
      aria-labelledby="hero-title"
    >
      <div ref={stageRef} className="hero__stage">
        {/* Sem script ou sem movimento: foto estática por baixo do canvas. */}
        {showPoster && (
        <picture className="hero__poster">
          <source media="(max-width: 47.99rem)" srcSet={staticMode ? '/img/foto-03-montada-mobile.webp' : '/hero/mobile/f_001.webp'} />
          <img
            src={staticMode ? '/img/foto-03-montada.webp' : '/hero/desktop-sd/f_001.webp'}
            alt=""
            fetchPriority="high"
            decoding="async"
          />
        </picture>
        )}
        {variant === 'scroll' && !staticMode && <canvas ref={canvasRef} className="hero__canvas" aria-hidden="true" />}
        {!typeMode && <div className="hero__scrim" aria-hidden="true" />}

        <div className="hero__words" aria-hidden="true">
          {BEATS.map((b, i) => (
            <p key={b.word} className={`hero__word ${i === BEATS.length - 1 ? 'hero__word--last' : ''}`}>
              <span
                ref={(el) => {
                  wordRefs.current[i] = el;
                }}
                className="hero__word-inner"
              >
                {b.word}
              </span>
            </p>
          ))}
        </div>

        <div ref={introRef} className="hero__intro">
          <h1 id="hero-title" className="hero__title">
            <span className="line">Jiu-jitsu em Vassouras,</span>
            <span className="line line--red">para todas as idades.</span>
          </h1>
          <p className="hero__lede">
            Arte Livre BJJ. Turmas a partir de 3 anos, na Rua Nilo Peçanha, 85, Centro.
          </p>
          <div className="hero__actions">
            <a className="btn btn--primary" href="#ache-sua-turma">
              Ache sua turma
            </a>
            <a className="btn btn--secondary" href="#planos">
              Ver planos
            </a>
          </div>
        </div>

        <div ref={finaleRef} className="hero__finale">
          <div className="hero__brand">
            <Logo size="md" />
            <p className="hero__name">Arte Livre BJJ</p>
          </div>
          <p className="hero__place">Vassouras-RJ · Disciplina no tatame, evolução na vida.</p>
          <div className="hero__actions">
            <a className="btn btn--primary" href="#ache-sua-turma">
              Ache sua turma
            </a>
            <a className="btn btn--secondary" href="#planos">
              Ver planos
            </a>
          </div>
        </div>

        <a className="icon-btn hero__down" href="#manifesto" aria-label="Rolar para a próxima seção">
          <ArrowDownIcon />
        </a>

        {variant === 'scroll' && !staticMode && (
          <div className="hero__loader" aria-hidden="true">
            <div ref={loaderRef} className="hero__loader-fill" />
          </div>
        )}
        <div ref={veilRef} className="hero__veil" aria-hidden="true" />
      </div>
    </section>
  );
}
