import type { Metadata, Viewport } from 'next';
import { Anton, Barlow } from 'next/font/google';
import '../styles/tokens.css';
import './globals.css';
import { ADDRESS, INSTAGRAM_URL, OPENING_HOURS } from '@/data/schedule';

const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-anton', display: 'swap' });
const barlow = Barlow({ weight: ['400', '500', '600', '700'], subsets: ['latin'], variable: '--font-barlow', display: 'swap' });

// Endereço do site (prévias de link no WhatsApp/Google). Na Vercel vem sozinho do link do projeto;
// com domínio próprio, defina SITE_URL nas variáveis do projeto (ex.: https://artelivrebjj.com.br).
const SITE_URL =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://artelivrebjj.vercel.app');

const description =
  'Escola de jiu-jitsu em Vassouras-RJ, na Rua Nilo Peçanha, 85, Centro. Turmas Kids (a partir de 3 anos), Infantil, Feminino, Iniciante, Avançado, No-Gi e Competidor. Planos a partir de R$ 135.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Arte Livre BJJ | Jiu-Jitsu em Vassouras-RJ',
  description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: 'Arte Livre BJJ',
    title: 'Arte Livre BJJ | Jiu-Jitsu em Vassouras-RJ',
    description,
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: 'Atleta de kimono branco controlando o oponente no tatame, com luz vermelha ao fundo' }],
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: '#111116',
  width: 'device-width',
  initialScale: 1,
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SportsActivityLocation',
  name: 'Arte Livre BJJ',
  alternateName: 'Arte Livre BJJ Team',
  description,
  url: SITE_URL,
  image: `${SITE_URL}/og.jpg`,
  logo: `${SITE_URL}/img/logo.png`,
  telephone: '+55 24 99264-0800',
  sameAs: [INSTAGRAM_URL],
  sport: 'Brazilian Jiu-Jitsu',
  address: {
    '@type': 'PostalAddress',
    streetAddress: ADDRESS.street,
    addressLocality: ADDRESS.city,
    addressRegion: ADDRESS.state,
    addressCountry: ADDRESS.country,
  },
  openingHoursSpecification: OPENING_HOURS.flatMap((o) =>
    o.schema.ranges.map(([opens, closes]) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: o.schema.days,
      opens,
      closes,
    })),
  ),
  priceRange: 'R$ 135–165',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${anton.variable} ${barlow.variable}`} suppressHydrationWarning>
      <head>
        {/* Marca o documento como "com JS" antes da pintura, para que os estados iniciais de animação só valham com script. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
