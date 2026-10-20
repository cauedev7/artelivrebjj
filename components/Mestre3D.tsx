'use client';

import { useEffect, useRef, useState } from 'react';
import type { PoseName } from '@/lib/mestre/rig';

/**
 * v7: o Mestre Neury interativo, em uma de quatro formas (para comparar):
 * - "foto": a foto real com volume, que gira um pouco para cada lado (opção 1, a principal);
 * - "video": um vídeo por pose e um giro arrastável (opção 2; hoje com clipes de teste);
 * - "modelo": um modelo 3D em GLB, com poses (opção 3; hoje com um GLB de teste);
 * - "boneco": o boneco provisório feito com formas 3D.
 * O código pesado só é baixado quando a seção chega perto da tela. Sem suporte a 3D, fica a foto.
 */
export type MestreMode = 'foto' | 'video' | 'modelo' | 'boneco';

const LABEL: Record<PoseName, string> = {
  bracos: 'braços cruzados',
  guarda: 'em guarda',
  saudar: 'saudando',
  campeao: 'pose de campeão',
};

/**
 * Modelo da opção 3: forma 3D gerada por IA (Hunyuan3D-2.1, a partir da foto), reduzida por
 * comparar-versoes/ferramentas/preparar-modelo-ia.mjs. Veio sem textura: a foto é projetada por cima.
 */
const AI_MODEL = '/models/mestre-ia.glb';

const COPY: Record<MestreMode, { lede: string; note: string }> = {
  foto: {
    lede: 'A foto do mestre Neury Gomes, com volume. Arraste para o lado para girar.',
    note: 'É a foto real do mestre com relevo, não um modelo 3D: gira um pouco para cada lado, mas não mostra as costas nem muda de pose.',
  },
  video: {
    lede: 'O mestre Neury Gomes em vídeo: escolha a pose ou arraste para o lado para girar.',
    note: 'Teste com clipes provisórios feitos a partir da foto. Os vídeos de verdade (gerados por IA ou gravados) entram no lugar deles.',
  },
  modelo: {
    lede: 'Um modelo 3D do mestre Neury Gomes, gerado por IA a partir da foto. Arraste para o lado para girar.',
    note: 'Modelo 3D gerado por inteligência artificial a partir de uma única foto, com a foto projetada por cima: a frente é a foto real, as costas são uma estimativa. Ainda não tem esqueleto, então não muda de pose.',
  },
  boneco: {
    lede: 'Um boneco do mestre Neury Gomes para você girar e pôr em ação. Arraste para o lado para girar.',
    note: 'Boneco provisório, feito com formas 3D a partir das fotos. É uma aproximação, não um retrato fiel do mestre.',
  },
};

type Status = 'idle' | 'loading' | 'ready' | 'fallback';
type Scene = { setPose?(p: PoseName): void; reset(): void; dispose(): void; poses?: boolean };

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

async function createScene(mode: MestreMode, stage: HTMLElement, reducedMotion: boolean, onPose: (p: PoseName) => void): Promise<Scene> {
  const mobile = window.innerWidth < 768;
  if (mode === 'foto') return (await import('@/lib/mestre/photoScene')).createPhotoScene(stage, { mobile, reducedMotion });
  if (mode === 'video') return (await import('@/lib/mestre/videoPlayer')).createVideoScene(stage, { reducedMotion, onPose });
  const { createMestreScene } = await import('@/lib/mestre/scene');
  return createMestreScene(stage, { mobile, reducedMotion, onPose, modelUrl: mode === 'modelo' ? AI_MODEL : null, projectPhoto: mode === 'modelo' });
}

export default function Mestre3D({ mode = 'foto' }: { mode?: MestreMode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [pose, setPose] = useState<PoseName>('bracos');
  const [scenePoses, setScenePoses] = useState(true);
  const poses = mode !== 'foto' && scenePoses;

  useEffect(() => {
    const stage = stageRef.current!;
    let disposed = false;
    // O vídeo não precisa de 3D; as outras formas sim.
    if (mode !== 'video' && !hasWebGL()) {
      setStatus('fallback');
      return;
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        setStatus('loading');
        createScene(mode, stage, reducedMotion, (p) => !disposed && setPose(p))
          .then((scene) => {
            if (disposed) return scene.dispose();
            sceneRef.current = scene;
            setScenePoses(scene.poses !== false);
            setStatus('ready');
          })
          .catch((err) => {
            console.warn('Mestre interativo indisponível; mostrando a foto.', err);
            if (!disposed) setStatus('fallback');
          });
      },
      { rootMargin: '60% 0px' },
    );
    io.observe(stage);
    return () => {
      disposed = true;
      io.disconnect();
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [mode]);

  const choose = (p: PoseName) => {
    setPose(p);
    sceneRef.current?.setPose?.(p);
  };
  const reset = () => {
    setPose('bracos');
    sceneRef.current?.reset();
  };
  const ready = status === 'ready';
  const copy = COPY[mode];

  return (
    <section id="mestre" className="mestre3d" data-mode={mode} aria-labelledby="mestre-title">
      <div className="container mestre3d__grid">
        <div className="mestre3d__text">
          <h2 id="mestre-title" className="display display--section" style={{ '--fit': 15 } as React.CSSProperties} data-reveal>
            <span className="line">O mestre Neury,</span>
            <span className="line line--red">{mode === 'foto' || mode === 'video' ? 'de perto.' : 'em 3D.'}</span>
          </h2>
          <p className="mestre3d__lede" data-reveal style={{ '--i': 1 } as React.CSSProperties}>
            {status === 'fallback' ? 'Este aparelho não mostra a versão interativa. Aqui está o mestre Neury Gomes em foto.' : copy.lede}
          </p>
          {status !== 'fallback' && (
            <div className="mestre3d__controls" role="group" aria-label="Controles do mestre" data-reveal style={{ '--i': 2 } as React.CSSProperties}>
              {poses && (
                <>
                  <button type="button" className="btn btn--primary" aria-pressed={pose === 'saudar'} disabled={!ready} onClick={() => choose('saudar')}>
                    Saudar
                  </button>
                  <button type="button" className="btn btn--primary" aria-pressed={pose === 'guarda'} disabled={!ready} onClick={() => choose('guarda')}>
                    Entrar em guarda
                  </button>
                  <button type="button" className="btn btn--primary" aria-pressed={pose === 'campeao'} disabled={!ready} onClick={() => choose('campeao')}>
                    Pose de campeão
                  </button>
                </>
              )}
              <button type="button" className="btn btn--secondary" disabled={!ready} onClick={reset}>
                {poses ? 'Restaurar posição' : 'Voltar de frente'}
              </button>
            </div>
          )}
          <p className="mestre3d__status" aria-live="polite">
            {status === 'loading' && 'Carregando…'}
            {ready && poses && `Agora: ${LABEL[pose]}.`}
          </p>
          {status !== 'fallback' && <p className="mestre3d__note">{copy.note}</p>}
        </div>
        <div
          ref={stageRef}
          className="mestre3d__stage"
          data-status={status}
          role="img"
          aria-label={`Mestre Neury Gomes interativo. Arraste para girar.`}
        >
          <img
            className="mestre3d__fallback"
            src="/img/mestre-neury.webp"
            alt={status === 'fallback' ? 'Mestre Neury Gomes de braços cruzados, de kimono branco da Arte Livre BJJ e faixa vermelha e branca' : ''}
            loading="lazy"
            decoding="async"
            width={1024}
            height={1536}
          />
        </div>
      </div>
    </section>
  );
}
