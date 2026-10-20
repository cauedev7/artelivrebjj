const TRAITS = [
  { word: 'Disciplinada.', line: 'Horário fixo, turma certa, tatame toda semana.' },
  { word: 'Acessível.', line: 'Plano a partir de R$ 135 e turmas dos 3 anos ao adulto.' },
  { word: 'Determinada.', line: 'Faixa a faixa, grau a grau.' },
  { word: 'Competitiva.', line: 'Equipe nos tatames da FJJRio e do AJP Tour.' },
];

export default function Manifesto() {
  return (
    <section id="manifesto" className="manifesto" aria-labelledby="manifesto-title">
      <div className="container">
        <h2 id="manifesto-title" className="display display--section" style={{ '--fit': 21 } as React.CSSProperties} data-reveal>
          <span className="line">Disciplina no tatame.</span>
          <span className="line line--red">Evolução na vida.</span>
        </h2>
      </div>
      <div className="manifesto__grid">
        <figure className="manifesto__figure" data-reveal style={{ '--i': 2 } as React.CSSProperties}>
          <div className="manifesto__photo photo">
            <img
              data-parallax="0.08"
              src="/img/mestre-neury.webp"
              alt="Mestre Neury Gomes de braços cruzados, de kimono branco da Arte Livre BJJ e faixa vermelha e branca, no tatame da academia"
              loading="lazy"
              decoding="async"
              width={1024}
              height={1536}
            />
          </div>
          <figcaption>Mestre Neury Gomes</figcaption>
        </figure>
        <div className="manifesto__text">
          <p className="statement" data-reveal style={{ '--i': 1 } as React.CSSProperties}>
            A Arte Livre BJJ é a escola do mestre Neury Gomes no Centro de Vassouras. Tem turma para criança a partir de 3
            anos, para mulheres, para quem nunca pisou num tatame e para quem compete.
          </p>
          <ul className="traits">
            {TRAITS.map((t, i) => (
              <li key={t.word} data-reveal style={{ '--i': i + 2 } as React.CSSProperties}>
                <strong>{t.word}</strong>
                <span>{t.line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
