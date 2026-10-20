'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { BeltState, SectionKind, SectionScene } from '@/lib/sectionScenes';

gsap.registerPlugin(ScrollTrigger);

type Props = {
  kind: SectionKind;
  className?: string;
  /** Só para a faixa das Turmas: diz a cor e os graus do momento. */
  getState?: () => BeltState;
};

/**
 * Peça 3D de uma seção. Carrega o three.js só quando chega perto da tela, desenha só enquanto
 * está visível e segue a rolagem da própria seção. Quem pede menos movimento vê a imagem parada.
 */
export default function Scene3D({ kind, className = '', getState }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const stateRef = useRef(getState);
  stateRef.current = getState;

  useEffect(() => {
    const host = ref.current!;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      host.dataset.static = 'true';
      return;
    }
    let scene: SectionScene | null = null;
    let loading = false;
    let visible = false;
    let disposed = false;
    const section = (host.closest('section') as HTMLElement | null) ?? host;
    let progress = 0;
    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        progress = self.progress;
      },
    });
    progress = st.progress;
    let shown = progress;

    const load = () => {
      if (loading) return;
      loading = true;
      import('@/lib/sectionScenes').then(({ createSectionScene }) => {
        if (disposed) return;
        scene = createSectionScene(kind, host, { mobile: window.innerWidth < 768, onReady: () => (host.dataset.ready = 'true') });
      });
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) load();
      },
      { rootMargin: '30% 0px' },
    );
    io.observe(host);

    const tick = (_t: number, deltaMs: number) => {
      if (!scene || !visible) return;
      const dt = Math.min(deltaMs / 1000, 0.1);
      shown += (progress - shown) * (1 - Math.exp(-dt / 0.2));
      scene.update(shown, dt, stateRef.current?.());
    };
    gsap.ticker.add(tick);
    const onResize = () => scene?.resize();
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', onResize);
      io.disconnect();
      st.kill();
      scene?.dispose();
    };
  }, [kind]);

  return (
    <div ref={ref} className={`scene3d scene3d--${kind} ${className}`} aria-hidden="true">
      {kind !== 'belt' && (
        <img
          className="scene3d__fallback"
          src={kind === 'logo' ? '/img/logo-arte.png' : kind === 'beltPhoto' ? '/v62/faixas/branca.webp' : '/v5/kimono-2k.webp'}
          alt=""
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
}
