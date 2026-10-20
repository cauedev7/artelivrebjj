# Arte Livre BJJ — site (versão 6.2)

Site one-page da Arte Livre BJJ (Vassouras-RJ), só com a versão 6.2. Next.js 14 (export estático), Tailwind, GSAP + ScrollTrigger, Lenis e three.js.

O que tem nesta versão:

- **Hero:** um kimono preto liso que se transforma no kimono da Arte Livre conforme a rolagem (`lib/transformScene.ts`).
- **Turmas:** a faixa ao lado da lista se transforma com a rolagem, da branca à preta, com uma onda de brasa (`lib/beltTransform.ts`; ordem e legendas em `lib/beltJourney.ts`; fotos em `public/v62/faixas/`).
- **Planos:** a logo da equipe em 3D (`lib/logo3d.ts`).
- **Convite final:** o kimono com a faixa vermelha dando a volta (`lib/sectionScenes.ts`).
- **Dúvidas:** imagem "o que levar no primeiro treino" (`public/v62/primeiro-treino.webp`, gerada por IA).

## Rodar e publicar

```bash
npm install
npm run dev        # http://localhost:3100
npm run build      # gera a pasta out/ (o site pronto)
```

Para publicar, suba o conteúdo de `out/` em qualquer hospedagem estática (Vercel, Netlify, etc.). Antes, troque o domínio em `app/layout.tsx` (`SITE_URL`).

Horários, preços e contato ficam em `data/schedule.ts`.

Este site saiu do projeto `arte-livre-bjj` (onde ficam todas as versões, v0 a v7). Aqui só há a página principal; as outras versões e os arquivos delas foram retirados.
