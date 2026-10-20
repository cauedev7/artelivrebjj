import type { Config } from 'tailwindcss';

// Tailwind só como utilitário de layout; cores e tipos vêm de styles/tokens.css.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    screens: { sm: '40rem', md: '48rem', lg: '64rem', xl: '80rem' },
    extend: {
      colors: {
        brand: 'var(--color-brand)',
        bright: 'var(--color-brand-bright)',
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        panel: 'var(--color-panel)',
        ink: 'var(--color-text-primary)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
      },
    },
  },
  plugins: [],
};
export default config;
