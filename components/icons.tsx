// Ícones simples, em traço, herdando a cor do texto.
type P = { className?: string };
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square' as const, 'aria-hidden': true };

export const ArrowDownIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M12 4v15M5 12l7 7 7-7" /></svg>
);
export const ArrowLeftIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M20 12H5M12 5l-7 7 7 7" /></svg>
);
export const ArrowRightIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M4 12h15M12 5l7 7-7 7" /></svg>
);
export const PlusIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const MenuIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
export const CloseIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const InstagramIcon = ({ className }: P) => (
  <svg {...base} className={className} strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" /></svg>
);
export const WhatsAppIcon = ({ className }: P) => (
  <svg {...base} className={className} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z" />
    <path d="M9 8.6c.2-.5.6-.6.9-.6h.5l.9 2.1-.7.9c.5 1 1.3 1.8 2.3 2.3l.9-.7 2.1.9v.5c0 .3-.1.7-.6.9-.8.4-2 .3-3.4-.6a9 9 0 0 1-2.4-2.4C8.7 10.6 8.6 9.4 9 8.6z" />
  </svg>
);
