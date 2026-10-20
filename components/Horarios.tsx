import { DAY_GROUPS, SCHEDULE, className } from '@/data/schedule';
import TurmaFinder from './TurmaFinder';

export default function Horarios() {
  return (
    <section id="ache-sua-turma" className="horarios" aria-labelledby="finder-title">
      <div className="container">
        <h2 id="finder-title" className="display display--section" style={{ '--fit': 8 } as React.CSSProperties} data-reveal>
          <span className="line">Ache sua</span>
          <span className="line line--red">turma.</span>
        </h2>
        <p className="horarios__lede" data-reveal style={{ '--i': 1 } as React.CSSProperties}>
          Duas perguntas e a grade real da semana responde: turma, dia, horário e o plano que encaixa.
        </p>
        <div data-reveal style={{ '--i': 2 } as React.CSSProperties}>
          <TurmaFinder />
        </div>
      </div>

      <div id="horarios" className="container grade">
        <h3 className="display display--sub" data-reveal>
          Grade da semana
        </h3>
        <div className="grade__scroll" tabIndex={0} role="region" aria-label="Grade semanal, role para o lado no celular">
          <div className="grade__cols">
            {DAY_GROUPS.map((g, i) => (
              <table key={g.id} className="grade__day" data-reveal style={{ '--i': i } as React.CSSProperties}>
                <caption>{g.label}</caption>
                <thead>
                  <tr>
                    <th scope="col">Hora</th>
                    <th scope="col">Turma</th>
                  </tr>
                </thead>
                <tbody>
                  {SCHEDULE.filter((s) => s.group === g.id).map((s) => (
                    <tr key={`${s.time}-${s.classId}`}>
                      <th scope="row">{s.time}</th>
                      <td>{className(s.classId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </div>
        <p className="grade__note">
          Algumas aulas acontecem no mesmo horário, em turmas diferentes. Confirme a sua com a escola antes do primeiro treino.
        </p>
      </div>
    </section>
  );
}
