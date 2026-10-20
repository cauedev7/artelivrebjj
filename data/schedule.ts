/**
 * Dados da Arte Livre BJJ (fonte: apresentação 2026 em /referencias).
 * Para atualizar a grade, os preços ou o contato, edite só este arquivo.
 */

/* ------------------------------------------------------------------ */
/* Contato                                                             */
/* ------------------------------------------------------------------ */

/**
 * WhatsApp da escola: DDI + DDD + número, só dígitos.
 * Se ficar vazio, os botões passam a abrir o Direct do Instagram e copiam a mensagem.
 */
export const WHATSAPP_NUMBER = '5524992640800';
/** Como o número aparece escrito na página. */
export const WHATSAPP_DISPLAY = '(24) 99264-0800';
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export const INSTAGRAM_HANDLE = 'artelivrebjj';
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;
export const INSTAGRAM_DM_URL = `https://ig.me/m/${INSTAGRAM_HANDLE}`;

export const ADDRESS = {
  street: 'Rua Nilo Peçanha, 85',
  district: 'Centro',
  city: 'Vassouras',
  state: 'RJ',
  country: 'BR',
  mapsQuery: 'Rua Nilo Peçanha, 85, Centro, Vassouras - RJ',
};

export const MOTTO = ['Jiu-jitsu', 'Disciplina', 'Evolução'];

/* ------------------------------------------------------------------ */
/* Turmas                                                              */
/* ------------------------------------------------------------------ */

export type ClassId =
  | 'kids1'
  | 'kids2'
  | 'infantil'
  | 'nogi'
  | 'open'
  | 'iniciante'
  | 'feminino'
  | 'avancado1'
  | 'avancado2'
  | 'competidor'
  | 'particular';

export type ClassInfo = {
  id: ClassId;
  name: string;
  /** Dado real exibido como numeral gigante e a legenda logo abaixo. */
  numeral: string;
  numeralNote: string;
  description: string;
};

/** Na ordem de idade: Kids → Infantil → Adulto → Avançado/Competidor. */
export const CLASSES: ClassInfo[] = [
  { id: 'kids1', name: 'Kids 1', numeral: '3–6', numeralNote: 'anos', description: 'A turma dos menores. Terça e quinta, de manhã ou no fim da tarde.' },
  { id: 'kids2', name: 'Kids 2', numeral: '7–9', numeralNote: 'anos', description: 'Segunda, quarta e sexta de manhã; terça e quinta no fim da tarde.' },
  { id: 'infantil', name: 'Infantil', numeral: '10–14', numeralNote: 'anos', description: 'Segunda e quarta, às 18h15.' },
  { id: 'nogi', name: 'No-Gi', numeral: '13+', numeralNote: 'anos', description: 'Jiu-jitsu sem kimono, duas vezes por semana, às sextas.' },
  { id: 'open', name: 'Open', numeral: '13+', numeralNote: 'anos', description: 'Treino aberto às turmas, sábado de manhã.' },
  { id: 'iniciante', name: 'Iniciante', numeral: '14+', numeralNote: 'anos', description: 'Nunca treinou? Começa aqui. De segunda a quinta, das 6h às 19h30.' },
  { id: 'feminino', name: 'Feminino', numeral: '15+', numeralNote: 'anos', description: 'Turma só para mulheres, às terças e quintas.' },
  { id: 'avancado1', name: 'Avançado 1', numeral: '2', numeralNote: 'graus na faixa branca', description: 'Adulto. O passo seguinte para quem já tem dois graus na faixa branca.' },
  { id: 'avancado2', name: 'Avançado 2', numeral: 'Azul', numeralNote: 'a partir da faixa', description: 'Aulas de técnicas avançadas, a partir da faixa azul.' },
  { id: 'competidor', name: 'Competidor', numeral: '20h30', numeralNote: 'terça e quinta', description: 'Treino de alto rendimento para quem compete.' },
];

export const PARTICULAR: { name: string } = { name: 'Particular' };

export function className(id: ClassId): string {
  if (id === 'particular') return 'Aula particular';
  return CLASSES.find((c) => c.id === id)?.name ?? id;
}

/* ------------------------------------------------------------------ */
/* Grade semanal                                                       */
/* ------------------------------------------------------------------ */

export type DayGroupId = 'segqua' | 'terqui' | 'sex' | 'sab';

export type DayGroup = {
  id: DayGroupId;
  label: string; // "Seg e Qua"
  short: string; // "seg/qua" (usado na mensagem)
  days: number; // quantos dias da semana o grupo cobre
};

export const DAY_GROUPS: DayGroup[] = [
  { id: 'segqua', label: 'Seg e Qua', short: 'seg/qua', days: 2 },
  { id: 'terqui', label: 'Ter e Qui', short: 'ter/qui', days: 2 },
  { id: 'sex', label: 'Sexta', short: 'sexta', days: 1 },
  { id: 'sab', label: 'Sábado', short: 'sábado', days: 1 },
];

export type Slot = { group: DayGroupId; time: string; minutes: number; classId: ClassId };

const t = (group: DayGroupId, time: string, classId: ClassId): Slot => {
  const [h, m = '0'] = time.split('h');
  return { group, time, minutes: Number(h) * 60 + Number(m || 0), classId };
};

export const SCHEDULE: Slot[] = [
  t('segqua', '6h', 'iniciante'),
  t('segqua', '7h', 'iniciante'),
  t('segqua', '7h', 'avancado1'),
  t('segqua', '9h30', 'kids2'),
  t('segqua', '18h15', 'infantil'),
  t('segqua', '19h30', 'iniciante'),
  t('segqua', '19h30', 'avancado1'),

  t('terqui', '7h', 'iniciante'),
  t('terqui', '8h', 'iniciante'),
  t('terqui', '8h', 'avancado2'),
  t('terqui', '9h30', 'kids1'),
  t('terqui', '17h15', 'kids1'),
  t('terqui', '17h15', 'iniciante'),
  t('terqui', '18h15', 'kids2'),
  t('terqui', '19h', 'feminino'),
  t('terqui', '19h30', 'iniciante'),
  t('terqui', '19h30', 'avancado1'),
  t('terqui', '20h30', 'competidor'),

  t('sex', '7h', 'nogi'),
  t('sex', '9h30', 'kids2'),
  t('sex', '16h', 'particular'),
  t('sex', '19h', 'nogi'),

  t('sab', '8h', 'particular'),
  t('sab', '9h', 'particular'),
  t('sab', '10h', 'particular'),
  t('sab', '10h', 'open'),
];

/* ------------------------------------------------------------------ */
/* Funcionamento                                                       */
/* ------------------------------------------------------------------ */

export const OPENING_HOURS = [
  { days: 'Segunda e quarta', morning: '6h–11h', evening: '16h–21h30', schema: { days: ['Monday', 'Wednesday'], ranges: [['06:00', '11:00'], ['16:00', '21:30']] } },
  { days: 'Terça e quinta', morning: '7h–11h', evening: '16h–21h30', schema: { days: ['Tuesday', 'Thursday'], ranges: [['07:00', '11:00'], ['16:00', '21:30']] } },
  { days: 'Sexta', morning: '7h–11h', evening: '16h–21h30', schema: { days: ['Friday'], ranges: [['07:00', '11:00'], ['16:00', '21:30']] } },
  { days: 'Sábado', morning: '8h–11h30', evening: '—', schema: { days: ['Saturday'], ranges: [['08:00', '11:30']] } },
] as const;

/* ------------------------------------------------------------------ */
/* Planos (valores 2026)                                               */
/* ------------------------------------------------------------------ */

export type PlanId = 'basico' | 'avancado' | 'livre';

export const PLANS: { id: PlanId; name: string; price: number; frequency: string; schedule: string; note: string }[] = [
  { id: 'basico', name: 'Básico', price: 135, frequency: '2 a 3 aulas por semana', schedule: 'Fixo', note: 'Para encaixar o treino na rotina, com dia e hora certos.' },
  { id: 'avancado', name: 'Avançado', price: 150, frequency: '5 aulas por semana', schedule: 'Fixo', note: 'Tatame de segunda a sexta, na sua turma.' },
  { id: 'livre', name: 'Livre', price: 165, frequency: 'Até 3 treinos por dia', schedule: 'Livre', note: 'Entra na turma que quiser, quantas vezes o dia permitir.' },
];

/** Adicional No-Gi. Como se aplica a cada plano fica sob consulta (assim aparece no site). */
export const NOGI_ADDON = 15;

/* ------------------------------------------------------------------ */
/* Competição (referências públicas de terceiros)                      */
/* ------------------------------------------------------------------ */

export const COMPETITION = {
  podiums: 9,
  silver: 4,
  bronze: 5,
  athletes: 6,
  links: [
    { label: 'Perfil de clube no AJP Tour', href: 'https://ajptour.com/en/club/930' },
    { label: 'Rankings da FJJRio (geral e No-Gi, 2026)', href: 'https://www.fjjrio.com.br/' },
    { label: 'Compilação BJJLF de resultados IBJJF', href: 'https://bjjlf.pro/arte-livre-jiu-jitsu' },
  ],
};

/* ------------------------------------------------------------------ */
/* Mensagens prontas                                                   */
/* ------------------------------------------------------------------ */

export function contactHref(message: string): string {
  if (WHATSAPP_NUMBER) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }
  return INSTAGRAM_DM_URL;
}

export const hasWhatsApp = WHATSAPP_NUMBER.length > 0;
