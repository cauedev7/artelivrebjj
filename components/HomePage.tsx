import BeltProgress from './BeltProgress';
import Competicao from './Competicao';
import CtaFinal from './CtaFinal';
import Faq from './Faq';
import Footer from './Footer';
import HeroSequence from './HeroSequence';
import Horarios from './Horarios';
import Manifesto from './Manifesto';
import Mestre3D, { type MestreMode } from './Mestre3D';
import Marquee from './Marquee';
import Effects from './Effects';
import Nav from './Nav';
import OndeQuando from './OndeQuando';
import Planos from './Planos';
import Reveal from './Reveal';
import SmoothScroll from './SmoothScroll';
import Turmas from './Turmas';

type Props = {
  heroVariant?: 'scroll' | 'transform' | 'kimono' | 'space' | 'type' | 'static';
  /** v7: seção com o Mestre Neury interativo, logo depois do manifesto (foto viva, vídeos, modelo 3D ou boneco). */
  mestre?: MestreMode;
  /** v6.2: a faixa das Turmas vira fotos de faixas que se transformam com a rolagem, e as dúvidas mostram o que levar no primeiro treino. */
  beltPhoto?: boolean;
};

/** A página inteira; só o hero muda conforme a versão (transformação, kimono 3D, só palavras, luta ou espaço 3D). */
export default function HomePage({ heroVariant = 'scroll', mestre, beltPhoto = false }: Props) {
  // As peças 3D nas seções fazem parte da v6 (hero da transformação).
  const fx3d = heroVariant === 'transform';
  return (
    <>
      <a href="#manifesto" className="skip-link">
        Pular para o conteúdo
      </a>
      <Nav />
      <main>
        <HeroSequence variant={heroVariant} />
        <Manifesto />
        {mestre && <Mestre3D mode={mestre} />}
        <Marquee words={['Jiu-jitsu', 'Disciplina', 'Evolução', 'Vassouras-RJ']} />
        <Turmas fx3d={fx3d} beltPhoto={beltPhoto} />
        <Horarios />
        <Planos fx3d={fx3d} />
        <Competicao />
        <Marquee variant="outline" direction={-1} words={['Kids', 'Infantil', 'Feminino', 'Iniciante', 'Avançado', 'No-Gi', 'Competidor', 'Open']} />
        <OndeQuando />
        <Faq firstClass={beltPhoto} />
        <CtaFinal fx3d={fx3d} />
      </main>
      <Footer />
      <BeltProgress />
      <SmoothScroll />
      <Reveal />
      <Effects />
    </>
  );
}
