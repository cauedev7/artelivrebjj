'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Camada de efeitos da página, num único laço por quadro:
 * botões 3D de vidro (rolagem + mouse), cartões com inclinação e reflexo, parallax nas fotos,
 * faixas de texto que reagem à rolagem, títulos letra a letra, números contando.
 * Tudo só com transform/opacity; desligado para quem pede menos movimento.
 */
export default function Effects() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const cleanups: (() => void)[] = [];

    /* ---------- Títulos letra a letra (o texto continua no aria-label) ---------- */
    document.querySelectorAll<HTMLElement>('.display--section, .display--cta').forEach((h) => {
      if (h.dataset.split) return;
      h.dataset.split = 'true';
      h.setAttribute('aria-label', Array.from(h.querySelectorAll('.line')).map((l) => l.textContent).join(' '));
      let ci = 0;
      h.querySelectorAll<HTMLElement>('.line').forEach((line) => {
        const words = (line.textContent ?? '').split(' ');
        line.textContent = '';
        line.setAttribute('aria-hidden', 'true');
        words.forEach((w, wi) => {
          const word = document.createElement('span');
          word.className = 'word';
          for (const ch of w) {
            const c = document.createElement('span');
            c.className = 'char';
            c.textContent = ch;
            c.style.setProperty('--ci', String(ci++));
            word.appendChild(c);
          }
          line.appendChild(word);
          if (wi < words.length - 1) line.appendChild(document.createTextNode(' '));
        });
      });
      h.classList.add('split');
    });

    /* ---------- Números que contam ao aparecer ---------- */
    const counters = Array.from(document.querySelectorAll<HTMLElement>('[data-count]'));
    if (!reduce) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            const el = e.target as HTMLElement;
            io.unobserve(el);
            const end = Number(el.dataset.count);
            const obj = { v: 0 };
            gsap.to(obj, {
              v: end,
              duration: 1.6,
              ease: 'power3.out',
              onUpdate: () => {
                el.textContent = String(Math.round(obj.v));
              },
            });
          });
        },
        { threshold: 0.4 },
      );
      counters.forEach((el) => {
        el.textContent = '0';
        io.observe(el);
      });
      cleanups.push(() => io.disconnect());
    }

    if (reduce) return () => cleanups.forEach((f) => f());

    /* ---------- Visibilidade: só anima o que está na tela ---------- */
    const visible = new Set<Element>();
    const vio = new IntersectionObserver(
      (entries) => entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))),
      { rootMargin: '15% 0px 15% 0px' },
    );
    cleanups.push(() => vio.disconnect());

    /* ---------- Botões 3D ---------- */
    type Btn = { el: HTMLElement; hover: boolean; px: number; py: number; press: number; rx: number; ry: number; tx: number; ty: number; s: number };
    const buttons: Btn[] = Array.from(document.querySelectorAll<HTMLElement>('.btn, .icon-btn:not(.faq__icon)')).map((el) => ({
      el,
      hover: false,
      px: 0,
      py: 0,
      press: 0,
      rx: 0,
      ry: 0,
      tx: 0,
      ty: 0,
      s: 1,
    }));
    buttons.forEach((b) => {
      vio.observe(b.el);
      b.el.classList.add('fx-3d');
      const move = (e: PointerEvent) => {
        const r = b.el.getBoundingClientRect();
        b.px = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
        b.py = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
        b.el.style.setProperty('--gx', `${((b.px + 1) / 2) * 100}%`);
        b.el.style.setProperty('--gy', `${((b.py + 1) / 2) * 100}%`);
      };
      const enter = () => (b.hover = true);
      const leave = () => {
        b.hover = false;
        b.px = 0;
        b.py = 0;
        b.press = 0;
      };
      const down = () => (b.press = 1);
      const up = () => (b.press = 0);
      if (fine) {
        b.el.addEventListener('pointermove', move);
        b.el.addEventListener('pointerenter', enter);
        b.el.addEventListener('pointerleave', leave);
      }
      b.el.addEventListener('pointerdown', down);
      window.addEventListener('pointerup', up);
      cleanups.push(() => {
        b.el.removeEventListener('pointermove', move);
        b.el.removeEventListener('pointerenter', enter);
        b.el.removeEventListener('pointerleave', leave);
        b.el.removeEventListener('pointerdown', down);
        window.removeEventListener('pointerup', up);
        b.el.style.transform = '';
      });
    });

    /* ---------- Cartões com inclinação e reflexo ---------- */
    type Card = { el: HTMLElement; px: number; py: number; rx: number; ry: number };
    const cards: Card[] = Array.from(document.querySelectorAll<HTMLElement>('[data-tilt]')).map((el) => ({ el, px: 0, py: 0, rx: 0, ry: 0 }));
    cards.forEach((c) => {
      vio.observe(c.el);
      if (!fine) return;
      const move = (e: PointerEvent) => {
        const r = c.el.getBoundingClientRect();
        c.px = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
        c.py = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
        c.el.style.setProperty('--mx', `${((c.px + 1) / 2) * 100}%`);
        c.el.style.setProperty('--my', `${((c.py + 1) / 2) * 100}%`);
      };
      const leave = () => {
        c.px = 0;
        c.py = 0;
      };
      c.el.addEventListener('pointermove', move);
      c.el.addEventListener('pointerleave', leave);
      cleanups.push(() => {
        c.el.removeEventListener('pointermove', move);
        c.el.removeEventListener('pointerleave', leave);
        c.el.style.transform = '';
      });
    });

    /* ---------- Parallax ---------- */
    const parallax = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]')).map((el) => ({
      el,
      k: Number(el.dataset.parallax) || 0.12,
      y: 0,
    }));
    parallax.forEach((p) => vio.observe(p.el));

    /* ---------- Faixas de texto ---------- */
    const marquees = Array.from(document.querySelectorAll<HTMLElement>('[data-marquee]')).map((el) => ({
      el,
      track: el.querySelector<HTMLElement>('.marquee__track')!,
      x: 0,
      dir: Number(el.dataset.marquee) || 1,
    }));
    marquees.forEach((m) => vio.observe(m.el));

    /* ---------- Linhas dos títulos que "esticam" com a velocidade ---------- */
    const skewLines = Array.from(document.querySelectorAll<HTMLElement>('.display--section .line, .display--cta .line'));
    skewLines.forEach((l) => vio.observe(l));

    /* ---------- Painel claro das turmas cresce ao entrar ---------- */
    const panel = document.getElementById('turmas');
    if (panel) {
      const tw = gsap.fromTo(
        panel,
        { scale: 0.92, borderRadius: 48 },
        {
          scale: 1,
          borderRadius: 0,
          ease: 'none',
          scrollTrigger: { trigger: panel, start: 'top bottom', end: 'top 25%', scrub: true },
        },
      );
      cleanups.push(() => {
        tw.scrollTrigger?.kill();
        tw.kill();
        panel.style.transform = '';
        panel.style.borderRadius = '';
      });
    }

    /* ---------- Laço único ---------- */
    let lastY = window.scrollY;
    let vel = 0;
    const tick = (_t: number, dtMs: number) => {
      const dt = Math.min(dtMs, 50) / 16.67;
      const y = window.scrollY;
      const raw = (y - lastY) / Math.max(dt, 0.001);
      lastY = y;
      vel = lerp(vel, clamp(raw / 40, -1, 1), 0.12 * dt);
      const vh = window.innerHeight;

      buttons.forEach((b) => {
        if (!visible.has(b.el)) return;
        const r = b.el.getBoundingClientRect();
        // Posição na tela (-1 em baixo, 1 em cima): o botão inclina enquanto atravessa a tela.
        const pos = clamp(((r.top + r.height / 2) / vh) * 2 - 1, -1.2, 1.2);
        const trx = -b.py * 16 + pos * 14 + vel * 26;
        const tryy = b.px * 18;
        const ttx = b.hover ? b.px * 7 : 0;
        const tty = (b.hover ? b.py * 5 - 2 : 0) - vel * 6;
        const ts = b.press ? 0.95 : b.hover ? 1.04 : 1;
        const k = 0.16 * dt;
        b.rx = lerp(b.rx, trx, k);
        b.ry = lerp(b.ry, tryy, k);
        b.tx = lerp(b.tx, ttx, k);
        b.ty = lerp(b.ty, tty, k);
        b.s = lerp(b.s, ts, 0.25 * dt);
        b.el.style.transform = `perspective(600px) translate3d(${b.tx.toFixed(2)}px, ${b.ty.toFixed(2)}px, 0) rotateX(${b.rx.toFixed(2)}deg) rotateY(${b.ry.toFixed(2)}deg) scale(${b.s.toFixed(3)})`;
      });

      cards.forEach((c) => {
        if (!visible.has(c.el)) return;
        const r = c.el.getBoundingClientRect();
        const pos = clamp(((r.top + r.height / 2) / vh) * 2 - 1, -1, 1);
        c.rx = lerp(c.rx, -c.py * 8 + pos * 6 + vel * 10, 0.12 * dt);
        c.ry = lerp(c.ry, c.px * 10, 0.12 * dt);
        c.el.style.transform = `perspective(1100px) rotateX(${c.rx.toFixed(2)}deg) rotateY(${c.ry.toFixed(2)}deg)`;
      });

      parallax.forEach((p) => {
        if (!visible.has(p.el)) return;
        const host = p.el.parentElement!.getBoundingClientRect();
        const off = (host.top + host.height / 2 - vh / 2) * -p.k;
        p.y = lerp(p.y, off, 0.2 * dt);
        p.el.style.transform = `translate3d(0, ${p.y.toFixed(2)}px, 0) scale(1.18)`;
      });

      marquees.forEach((m) => {
        if (!visible.has(m.el)) return;
        const half = m.track.scrollWidth / 2;
        const dirSign = vel < -0.02 ? -1 : 1;
        m.x -= (0.9 + Math.abs(vel) * 9) * dt * m.dir * dirSign;
        if (m.x <= -half) m.x += half;
        if (m.x > 0) m.x -= half;
        m.track.style.transform = `translate3d(${m.x.toFixed(2)}px, 0, 0) skewX(${(-vel * 12).toFixed(2)}deg)`;
      });

      const skew = (-vel * 5).toFixed(2);
      skewLines.forEach((l) => {
        if (visible.has(l)) l.style.transform = `skewY(${skew}deg)`;
      });

    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));

    return () => cleanups.forEach((f) => f());
  }, []);

  return null;
}
