import HomePage from '@/components/HomePage';

// Site da Arte Livre BJJ (versão 6.2): kimono preto que se transforma no kimono da Arte Livre (hero),
// faixa das Turmas que se transforma com a rolagem, logo 3D nos Planos e "o que levar" nas dúvidas.
export default function Home() {
  return <HomePage heroVariant="transform" beltPhoto />;
}
