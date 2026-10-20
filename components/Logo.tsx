/** O emblema da escola sobre um disco branco, com respiro (como pede a apresentação da marca). */
export default function Logo({ size = 'md', alt = '' }: { size?: 'sm' | 'md' | 'lg'; alt?: string }) {
  return (
    <span className={`logo-badge logo-badge--${size}`}>
      <img src="/img/logo.webp" alt={alt} width={468} height={468} decoding="async" />
    </span>
  );
}
