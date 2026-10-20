'use client';

import * as Accordion from '@radix-ui/react-accordion';
import { PlusIcon } from './icons';

const QA = [
  {
    q: 'Qual a idade mínima?',
    a: '3 anos, na turma Kids 1 (de 3 a 6 anos), às terças e quintas, 9h30 ou 17h15.',
  },
  {
    q: 'Nunca treinei. Por onde começo?',
    a: 'Pela turma Iniciante, a partir de 14 anos. Tem aula de segunda a quinta: 6h, 7h e 19h30 (seg/qua) e 7h, 8h, 17h15 e 19h30 (ter/qui).',
  },
  {
    q: 'Tem turma só para mulheres?',
    a: 'Tem. A turma Feminino, a partir de 15 anos, treina às terças e quintas, às 19h.',
  },
  {
    q: 'O que é No-Gi?',
    a: 'É o jiu-jitsu sem kimono. A turma é a partir de 13 anos e treina duas vezes por semana, às sextas, 7h e 19h. Tem adicional de R$ 15 no plano; consulte como fica no seu.',
  },
  {
    q: 'Como funciona o plano Livre?',
    a: 'R$ 165 por mês, sem horário fixo: dá para fazer até 3 treinos por dia.',
  },
  {
    q: 'Preciso ter kimono para começar?',
    a: 'Não. Na aula experimental e nas primeiras aulas você treina sem kimono.',
  },
  {
    q: 'Tem aula particular?',
    a: 'Tem: sexta às 16h e sábado às 8h, 9h e 10h. Valores sob consulta.',
  },
];

/** firstClass (v6.2): no lugar da foto de luta, o que levar no primeiro treino. */
export default function Faq({ firstClass = false }: { firstClass?: boolean }) {
  return (
    <section id="perguntas" className="faq" aria-labelledby="faq-title">
      <div className="container">
        <h2 id="faq-title" className="display display--section" style={{ '--fit': 16 } as React.CSSProperties} data-reveal>
          <span className="line">Antes do</span>
          <span className="line line--red">primeiro treino.</span>
        </h2>
      </div>
      <div className="container faq__grid">
        <div className="faq__head">
          {firstClass ? (
            <figure className="faq__photo faq__photo--kit" data-reveal style={{ '--i': 1 } as React.CSSProperties}>
              <div className="photo">
                <img
                  data-parallax="0.1"
                  src="/v62/primeiro-treino.webp"
                  alt="Vista de cima, sobre o tatame escuro: camiseta e bermuda pretas, garrafas de água, chinelo e toalhas"
                  loading="lazy"
                  decoding="async"
                  width={896}
                  height={1120}
                />
              </div>
              <figcaption>Sugestão para o primeiro treino: roupa de treino, água, chinelo e toalha. Kimono não precisa.</figcaption>
            </figure>
          ) : (
            <figure className="faq__photo photo" data-reveal style={{ '--i': 1 } as React.CSSProperties}>
              <img
                data-parallax="0.1"
                src="/img/foto-02-raspagem-sm.webp"
                alt="Atleta de pé segurando a lapela do oponente, que está no chão do tatame"
                loading="lazy"
                decoding="async"
                width={900}
                height={506}
              />
            </figure>
          )}
        </div>
        <Accordion.Root type="single" collapsible className="faq__list" defaultValue="item-0">
          {QA.map((item, i) => (
            <Accordion.Item key={item.q} value={`item-${i}`} className="faq__item" data-reveal style={{ '--i': i } as React.CSSProperties}>
              <Accordion.Header asChild>
                <h3>
                  <Accordion.Trigger className="faq__trigger">
                    <span>{item.q}</span>
                    <span className="icon-btn icon-btn--ghost faq__icon" aria-hidden="true">
                      <PlusIcon />
                    </span>
                  </Accordion.Trigger>
                </h3>
              </Accordion.Header>
              <Accordion.Content className="faq__content" forceMount>
                <p>{item.a}</p>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}
