import { NOGI_ADDON, PLANS } from '@/data/schedule';
import ContactButton from './ContactButton';
import Scene3D from './Scene3D';

export default function Planos({ fx3d = false }: { fx3d?: boolean }) {
  return (
    <section id="planos" className="planos" aria-labelledby="planos-title">
      <div className={`container ${fx3d ? 'planos__head' : ''}`}>
        <div className="planos__title">
          <h2 id="planos-title" className="display display--section" style={{ '--fit': 12 } as React.CSSProperties} data-reveal>
            <span className="line">Três planos,</span>
            <span className="line line--red">um tatame.</span>
          </h2>
        </div>
        {fx3d && <Scene3D kind="logo" className="planos__scene" />}
      </div>
      <ul className="planos__list container-wide">
        {PLANS.map((p, i) => (
          <li key={p.id} className={`plano ${p.id === 'livre' ? 'plano--featured' : ''}`} data-reveal style={{ '--i': i + 1 } as React.CSSProperties}>
            <div className="plano__card" data-tilt>
            <h3 className="plano__name">{p.name}</h3>
            <p className="plano__price">
              <span className="plano__currency">R$</span>
              <span className="plano__value" data-count={p.price}>
                {p.price}
              </span>
              <span className="plano__period">por mês</span>
            </p>
            <dl className="plano__facts">
              <div>
                <dt>Frequência</dt>
                <dd>{p.frequency}</dd>
              </div>
              <div>
                <dt>Horário</dt>
                <dd>{p.schedule}</dd>
              </div>
            </dl>
            <p className="plano__note">{p.note}</p>
            <ContactButton
              message={`Olá! Vi o site e quero saber do plano ${p.name} (R$ ${p.price}/mês). Como faço?`}
              className={p.id === 'livre' ? 'btn btn--inverse' : 'btn btn--primary'}
            >
              Quero o plano {p.name}
            </ContactButton>
            </div>
          </li>
        ))}
      </ul>
      <div className="container">
        <p className="planos__nogi" data-reveal>
          No-Gi, o jiu-jitsu sem kimono, tem adicional de <strong>R$ {NOGI_ADDON}</strong> no plano. Consulte como fica no seu.
          Valores de 2026.
        </p>
      </div>
    </section>
  );
}
