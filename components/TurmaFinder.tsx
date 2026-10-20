'use client';

import { useId, useMemo, useState } from 'react';
import { ClassId, DAY_GROUPS, NOGI_ADDON, PLANS, SCHEDULE, Slot, className } from '@/data/schedule';
import ContactButton from './ContactButton';

type ProfileId = 'kids1' | 'kids2' | 'infantil' | 'iniciante' | 'jatreino' | 'feminino' | 'nogi';
type PeriodId = 'manha' | 'tarde' | 'noite' | 'sabado';

const PROFILES: { id: ProfileId; label: string; classes: ClassId[]; kids?: boolean }[] = [
  { id: 'kids1', label: 'Criança de 3 a 6 anos', classes: ['kids1'], kids: true },
  { id: 'kids2', label: 'Criança de 7 a 9 anos', classes: ['kids2'], kids: true },
  { id: 'infantil', label: 'De 10 a 14 anos', classes: ['infantil'], kids: true },
  { id: 'iniciante', label: 'Adulto, nunca treinei', classes: ['iniciante'] },
  { id: 'jatreino', label: 'Já treino', classes: ['avancado1', 'avancado2', 'competidor', 'open'] },
  { id: 'feminino', label: 'Mulheres, a partir de 15', classes: ['feminino'] },
  { id: 'nogi', label: 'Sem kimono (No-Gi)', classes: ['nogi'] },
];

const PERIODS: { id: PeriodId; label: string; phrase: string }[] = [
  { id: 'manha', label: 'Manhã', phrase: 'de manhã' },
  { id: 'tarde', label: 'Tarde', phrase: 'à tarde' },
  { id: 'noite', label: 'Noite', phrase: 'à noite' },
  { id: 'sabado', label: 'Sábado', phrase: 'no sábado' },
];

function inPeriod(slot: Slot, period: PeriodId) {
  if (period === 'sabado') return slot.group === 'sab';
  if (slot.group === 'sab') return false;
  if (period === 'manha') return slot.minutes < 12 * 60;
  if (period === 'tarde') return slot.minutes >= 12 * 60 && slot.minutes < 18 * 60;
  return slot.minutes >= 18 * 60;
}

const groupOf = (id: Slot['group']) => DAY_GROUPS.find((g) => g.id === id)!;
const groupOrder = (id: Slot['group']) => DAY_GROUPS.findIndex((g) => g.id === id);

function sortSlots(a: Slot, b: Slot) {
  return groupOrder(a.group) - groupOrder(b.group) || a.minutes - b.minutes;
}

export default function TurmaFinder() {
  const [profile, setProfile] = useState<ProfileId>('iniciante');
  const [period, setPeriod] = useState<PeriodId>('noite');
  const uid = useId();

  const p = PROFILES.find((x) => x.id === profile)!;
  const per = PERIODS.find((x) => x.id === period)!;

  const { matches, others, days, otherPeriods } = useMemo(() => {
    const mine = SCHEDULE.filter((s) => p.classes.includes(s.classId)).sort(sortSlots);
    const matches = mine.filter((s) => inPeriod(s, period));
    const others = mine.filter((s) => !inPeriod(s, period));
    const days = new Set(matches.map((s) => s.group)).size
      ? Array.from(new Set(matches.map((s) => s.group))).reduce((n, g) => n + groupOf(g).days, 0)
      : 0;
    const otherPeriods = PERIODS.filter((x) => x.id !== period && mine.some((s) => inPeriod(s, x.id)));
    return { matches, others, days, otherPeriods };
  }, [p, period]);

  const basico = PLANS.find((x) => x.id === 'basico')!;
  const avancado = PLANS.find((x) => x.id === 'avancado')!;
  const livre = PLANS.find((x) => x.id === 'livre')!;

  const message = (s: Slot) =>
    `Olá! Vi o site e quero treinar na turma ${className(s.classId)}, ${groupOf(s.group).short} ${s.time}. Como faço?`;

  return (
    <div className="finder">
      <form className="finder__form" onSubmit={(e) => e.preventDefault()} aria-label="Ache sua turma">
        <fieldset className="finder__q">
          <legend>Quem vai treinar?</legend>
          <div className="finder__options">
            {PROFILES.map((o) => (
              <label key={o.id} className="choice">
                <input
                  type="radio"
                  name={`${uid}-who`}
                  value={o.id}
                  checked={profile === o.id}
                  onChange={() => setProfile(o.id)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="finder__q">
          <legend>Que período?</legend>
          <div className="finder__options finder__options--row">
            {PERIODS.map((o) => (
              <label key={o.id} className="choice">
                <input
                  type="radio"
                  name={`${uid}-when`}
                  value={o.id}
                  checked={period === o.id}
                  onChange={() => setPeriod(o.id)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>

      <div className="finder__result" aria-live="polite">
        {matches.length > 0 ? (
          <>
            <p className="finder__summary">
              {matches.length === 1 ? 'Uma aula bate' : `${matches.length} aulas batem`} com {p.label.toLowerCase()} {per.phrase}.
            </p>
            <ul className="finder__list">
              {matches.map((s) => (
                <li key={`${s.group}-${s.time}-${s.classId}`} className="slot">
                  <span className="slot__time">{s.time}</span>
                  <span className="slot__info">
                    <strong>{className(s.classId)}</strong>
                    <span>{groupOf(s.group).label}</span>
                  </span>
                  <ContactButton message={message(s)} className="btn btn--primary btn--small">
                    Quero treinar nessa turma
                  </ContactButton>
                </li>
              ))}
            </ul>
            <div className="finder__plan">
              {days >= 4 ? (
                <p>
                  Nesse período dá para treinar {days} dias por semana. Plano sugerido: <strong>{avancado.name}, R$ {avancado.price}/mês</strong> ({avancado.frequency.toLowerCase()}). Se 2 ou 3 vezes bastam, o {basico.name} sai R$ {basico.price}.
                </p>
              ) : (
                <p>
                  Nesse período são {days} {days === 1 ? 'dia' : 'dias'} por semana. Plano sugerido: <strong>{basico.name}, R$ {basico.price}/mês</strong> ({basico.frequency.toLowerCase()}, horário fixo).
                </p>
              )}
              {!p.kids && (
                <p>
                  Quer entrar em mais de uma turma, até 3 treinos por dia? Plano <strong>{livre.name}, R$ {livre.price}/mês</strong>.
                </p>
              )}
              {profile === 'nogi' && <p>No-Gi tem adicional de R$ {NOGI_ADDON} no plano; consulte como fica no seu.</p>}
            </div>
          </>
        ) : (
          <div className="finder__empty">
            <p className="finder__summary">
              {p.classes.map(className).join(', ')} {p.classes.length > 1 ? 'não têm' : 'não tem'} aula {per.phrase}.
            </p>
            {others.length > 0 && (
              <p>
                Horários dessa turma:{' '}
                {others.map((s, i) => (
                  <span key={`${s.group}-${s.time}-${s.classId}`}>
                    {i > 0 && ', '}
                    {groupOf(s.group).short} {s.time}
                  </span>
                ))}
                .
              </p>
            )}
            <div className="finder__switch">
              {otherPeriods.map((o) => (
                <button key={o.id} type="button" className="btn btn--secondary btn--small" onClick={() => setPeriod(o.id)}>
                  Ver {o.phrase}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
