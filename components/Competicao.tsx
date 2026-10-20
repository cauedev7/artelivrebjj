import { COMPETITION } from '@/data/schedule';

export default function Competicao() {
  return (
    <section id="competicao" className="competicao" aria-labelledby="competicao-title">
      <figure className="competicao__photo photo" data-reveal>
        <img
          data-parallax="0.12"
          src="/img/foto-03-montada.webp"
          srcSet="/img/foto-03-montada-sm.webp 900w, /img/foto-03-montada.webp 1672w"
          sizes="(min-width: 64rem) 58vw, 100vw"
          alt="Atleta por cima, na montada, segurando a gola do kimono do oponente deitado no tatame"
          loading="lazy"
          decoding="async"
          width={1672}
          height={941}
        />
      </figure>
      <div className="container competicao__inner">
        <div className="competicao__col">
        <h2 id="competicao-title" className="display display--section" style={{ '--fit': 9 } as React.CSSProperties} data-reveal>
          <span className="line">A equipe</span>
          <span className="line line--red">no pódio.</span>
        </h2>
        <div className="competicao__stat" data-reveal style={{ '--i': 1 } as React.CSSProperties}>
          <p className="competicao__numeral" aria-hidden="true" data-count={COMPETITION.podiums}>
            {COMPETITION.podiums}
          </p>
          <p className="competicao__statline">
            <span className="sr-only">{COMPETITION.podiums} </span>
            pódios em eventos IBJJF: {COMPETITION.silver} pratas e {COMPETITION.bronze} bronzes, de {COMPETITION.athletes} atletas.
          </p>
        </div>
        <div className="competicao__text" data-reveal style={{ '--i': 2 } as React.CSSProperties}>
          <p>
            Os números vêm de uma compilação de terceiros sobre resultados da IBJJF, não de um título oficial. A Arte Livre
            BJJ Team também tem perfil de clube no AJP Tour e aparece nos rankings da FJJRio de 2026, no geral e no No-Gi.
            Confira nas fontes:
          </p>
          <ul className="competicao__links">
            {COMPETITION.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label}
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        </div>
      </div>
    </section>
  );
}
