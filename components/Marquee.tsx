type Props = {
  words: string[];
  /** "red": faixa vermelha inclinada. "outline": letras vazadas sobre o preto. */
  variant?: 'red' | 'outline';
  /** Sentido base do movimento: 1 para a esquerda, -1 para a direita. */
  direction?: 1 | -1;
};

/** Faixa de texto que corre sozinha e acelera/inverte com a rolagem (ver Effects). Decorativa. */
export default function Marquee({ words, variant = 'red', direction = 1 }: Props) {
  const group = [...words, ...words, ...words];
  const items = group.map((w, i) => (
    <span key={i} className={`marquee__item ${i % 2 ? 'marquee__item--alt' : ''}`}>
      {w}
      <span className="marquee__dot">•</span>
    </span>
  ));
  return (
    <div className={`marquee marquee--${variant}`} aria-hidden="true" data-marquee={direction}>
      <div className="marquee__track">
        <span className="marquee__group">{items}</span>
        <span className="marquee__group">{items}</span>
      </div>
    </div>
  );
}
