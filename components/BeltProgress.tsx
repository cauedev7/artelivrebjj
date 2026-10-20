'use client';

import { useEffect, useRef, useState } from 'react';

/** As quatro seções que dão um grau cada; o último fecha no CTA final. */
const STRIPES = ['manifesto', 'ache-sua-turma', 'competicao', 'contato'];

/**
 * Indicador de progresso desenhado como uma faixa branca com a ponta preta.
 * O corpo da faixa enche com a rolagem; cada seção vencida cola um grau (fita) na ponta.
 */
export default function BeltProgress() {
  const fillRef = useRef<HTMLDivElement>(null);
  const [earned, setEarned] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (fillRef.current) fillRef.current.style.setProperty("--p", String(p));
      const line = window.innerHeight * 0.6;
      let n = 0;
      STRIPES.forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        const top = el.getBoundingClientRect().top;
        const done = i === STRIPES.length - 1 ? top < window.innerHeight * 0.75 || p > 0.985 : top < line;
        if (done) n = i + 1;
      });
      setEarned(n);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="belt" aria-hidden="true" data-earned={earned}>
      <div className="belt__body">
        <div ref={fillRef} className="belt__fill" />
      </div>
      <div className="belt__tip">
        {STRIPES.map((id, i) => (
          <span key={id} className={`belt__stripe ${i < earned ? 'is-on' : ''}`} />
        ))}
      </div>
    </div>
  );
}
