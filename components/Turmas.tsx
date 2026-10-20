'use client';

import { useCallback, useRef, useState } from 'react';
import { CLASSES } from '@/data/schedule';
import { BELT_CAPTION, BELTS, JOURNEY_END, JOURNEY_START, beltShown } from '@/lib/beltJourney';
import type { BeltState } from '@/lib/sectionScenes';
import { ArrowLeftIcon, ArrowRightIcon } from './icons';
import Scene3D from './Scene3D';

// A faixa 3D só mostra o que a escola pede: Avançado 1 = dois graus na branca; Avançado 2 = a partir da azul.
const AVANCADO1 = CLASSES.findIndex((c) => c.id === 'avancado1');
const AVANCADO2 = CLASSES.findIndex((c) => c.id === 'avancado2');
const BELT_CAPTIONS = [
  'Turmas de base: começa na faixa branca.',
  'Avançado 1: dois graus na faixa branca.',
  'Avançado 2: a partir da faixa azul.',
];


export default function Turmas({ fx3d = false, beltPhoto = false }: { fx3d?: boolean; beltPhoto?: boolean }) {
  const listRef = useRef<HTMLOListElement>(null);
  const [beltStep, setBeltStep] = useState(0);
  const beltStepRef = useRef(0);

  // Qual turma está em foco: no desktop, a linha mais perto do meio da tela; no celular, o cartão do carrossel.
  const getBeltState = useCallback((): BeltState => {
    const list = listRef.current;
    let idx = 0;
    let pos = 0;
    if (list) {
      if (window.innerWidth < 768) {
        const item = list.querySelector('li');
        const w = item ? item.getBoundingClientRect().width + 16 : 1;
        idx = Math.round(list.scrollLeft / w);
        // v6.2 no celular: a jornada inteira cabe na rolagem do carrossel (branca no começo, preta no fim).
        const max = Math.max(1, list.scrollWidth - list.clientWidth);
        pos = JOURNEY_START + (list.scrollLeft / max) * (JOURNEY_END - JOURNEY_START);
      } else {
        let best = Infinity;
        list.querySelectorAll('li').forEach((row, i) => {
          const r = row.getBoundingClientRect();
          const dist = Math.abs(r.top + r.height / 2 - window.innerHeight * 0.45);
          if (dist < best) {
            best = dist;
            idx = i;
          }
        });
        // Posição contínua (com a fração até a próxima linha) para a faixa da v6.2 se transformar aos poucos.
        const centers = Array.from(list.querySelectorAll('li')).map((r) => {
          const b = r.getBoundingClientRect();
          return b.top + b.height / 2;
        });
        const mid = window.innerHeight * 0.45;
        // Antes da primeira turma a posição fica negativa: a primeira troca já começa enquanto a seção entra.
        if (mid <= centers[0]) pos = (mid - centers[0]) / (centers[1] - centers[0]);
        else if (mid >= centers[centers.length - 1]) pos = centers.length - 1;
        else {
          const i = centers.findIndex((c, k) => c <= mid && mid < centers[k + 1]);
          pos = i + (mid - centers[i]) / (centers[i + 1] - centers[i]);
        }
      }
    }
    pos = Math.max(JOURNEY_START, Math.min(JOURNEY_END, pos));
    const stepNow = beltPhoto ? BELTS.indexOf(beltShown(pos)) : idx >= AVANCADO2 ? 2 : idx >= AVANCADO1 ? 1 : 0;
    if (stepNow !== beltStepRef.current) {
      beltStepRef.current = stepNow;
      setBeltStep(stepNow);
    }
    if (beltPhoto) return { blue: 0, stripes: 0, pos };
    return stepNow === 2 ? { blue: 1, stripes: 0 } : stepNow === 1 ? { blue: 0, stripes: 2 } : { blue: 0, stripes: 0 };
  }, [beltPhoto]);

  // No celular a lista vira um carrossel; as setas passam uma turma por vez.
  const step = (dir: 1 | -1) => {
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector('li');
    const w = item ? item.getBoundingClientRect().width + 16 : list.clientWidth * 0.85;
    list.scrollBy({ left: dir * w, behavior: 'smooth' });
  };

  return (
    <section id="turmas" className="turmas" aria-labelledby="turmas-title">
      <div className="container">
        <div className="turmas__head">
          <h2 id="turmas-title" className="display display--section" style={{ '--fit': 13 } as React.CSSProperties} data-reveal>
            <span className="line">Dos 3 anos</span>
            <span className="line line--red">à faixa azul.</span>
          </h2>
          <p className="turmas__lede" data-reveal style={{ '--i': 1 } as React.CSSProperties}>
            Dez turmas, da criança que está começando ao treino de alto rendimento. O número é a idade mínima, ou o que a
            turma pede para entrar.
          </p>
        </div>
        <div className={fx3d ? 'turmas__layout' : undefined}>
        {fx3d && (
          <aside className="turmas__belt" aria-label="Faixa">
            <Scene3D kind={beltPhoto ? 'beltPhoto' : 'belt'} className={beltPhoto ? 'scene3d--belt' : ''} getState={getBeltState} />
            <p className="turmas__belt-caption" aria-live="polite">
              {beltPhoto ? BELT_CAPTION[BELTS[beltStep]] : BELT_CAPTIONS[beltStep]}
            </p>
          </aside>
        )}
        <ol ref={listRef} className="turmas__list" aria-label="Turmas, por idade">
          {CLASSES.map((c, i) => (
            <li key={c.id} className="turma" data-reveal style={{ '--i': (i % 2) + 1 } as React.CSSProperties}>
              <div className="turma__mark">
                <p className="turma__numeral" aria-hidden="true">
                  {c.numeral}
                </p>
                <p className="turma__note">
                  <span className="sr-only">{c.name}: {c.numeral} </span>
                  {c.numeralNote}
                </p>
              </div>
              <div className="turma__body">
                <h3 className="turma__name">{c.name}</h3>
                <p className="turma__desc">{c.description}</p>
              </div>
            </li>
          ))}
        </ol>
        </div>
        <div className="turmas__arrows">
          <button type="button" className="icon-btn icon-btn--light" onClick={() => step(-1)} aria-label="Turma anterior">
            <ArrowLeftIcon />
          </button>
          <button type="button" className="icon-btn icon-btn--light icon-btn--brand" onClick={() => step(1)} aria-label="Próxima turma">
            <ArrowRightIcon />
          </button>
        </div>
      </div>
    </section>
  );
}
