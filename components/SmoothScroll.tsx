'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Rolagem suave (Lenis) ligada ao relógio do GSAP, e âncoras internas com desconto da barra.
 * No celular (toque) fica a rolagem nativa: a suave briga com o dedo e com a barra de endereço.
 */
export default function SmoothScroll() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    let lenis: Lenis | null = null;
    let tick: ((time: number) => void) | null = null;

    // A barra de endereço do celular aparece e some ao rolar, mudando a altura da tela. Isso não pode fazer as
    // animações de rolagem se recalcularem no meio do gesto (era o que fazia a página "pular" ao subir).
    // Só quando a largura muda de verdade (girar o celular) é que recalcula.
    // As seções altas (hero) usam --vh: travado na altura "grande" da tela (sem a barra), medido uma vez e
    // refeito só ao girar o celular. Assim a altura da página não muda com a barra.
    const lockVh = () => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none';
      document.body.appendChild(probe);
      const h = Math.max(probe.getBoundingClientRect().height, window.innerHeight);
      probe.remove();
      document.documentElement.style.setProperty('--vh', `${h / 100}px`);
    };
    let lastW = window.innerWidth;
    let refreshTimer = 0;
    const onResize = () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      lockVh();
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 200);
    };
    if (touch) {
      lockVh();
      ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load' });
      ScrollTrigger.refresh();
      window.addEventListener('resize', onResize);
    }

    if (!reduce && !touch) {
      lenis = new Lenis({ duration: 1.15, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      tick = (time: number) => lenis!.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }

    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute('href')!.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      const navH = (document.querySelector('.nav') as HTMLElement | null)?.offsetHeight ?? 0;
      const offset = target.dataset.flush === 'true' ? 0 : -navH;
      if (lenis) lenis.scrollTo(target, { offset, duration: 1.6 });
      else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY + offset });
      history.replaceState(null, '', `#${id}`);
      // Move o foco para a seção, para quem navega por teclado.
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };
    document.addEventListener('click', onClick);

    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(refreshTimer);
      document.documentElement.style.removeProperty('--vh');
      if (tick) gsap.ticker.remove(tick);
      lenis?.destroy();
    };
  }, []);
  return null;
}
