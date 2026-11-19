export type DayType = 'bureau' | 'teletravail' | 'conge';
export type DayKind = DayType | 'weekend';

export interface ScheduleSettings {
  firstSlot: string;
  intervalMin: number;
  dayEnd: string;
  lunchStart: string;
  lunchEnd: string;
  homeTime: string;
}

export const DEFAULT_SCHEDULE: ScheduleSettings = {
  firstSlot: '09:30',
  intervalMin: 75,
  dayEnd: '17:00',
  lunchStart: '12:15',
  lunchEnd: '13:45',
  homeTime: '19:00',
};

/** Planning par défaut : 1 = lundi … 5 = vendredi. */
export type Weekday = 1 | 2 | 3 | 4 | 5;
export type Planning = Record<Weekday, DayType>;
export const DEFAULT_PLANNING: Planning = { 1: 'bureau', 2: 'bureau', 3: 'teletravail', 4: 'bureau', 5: 'teletravail' };
export const WEEKDAYS: { day: Weekday; label: string }[] = [
  { day: 1, label: 'Lundi' },
  { day: 2, label: 'Mardi' },
  { day: 3, label: 'Mercredi' },
  { day: 4, label: 'Jeudi' },
  { day: 5, label: 'Vendredi' },
];

export const DAY_LABELS: Record<DayKind, string> = {
  bureau: 'Bureau',
  teletravail: 'Télétravail',
  conge: 'Congé',
  weekend: 'Week-end',
};

/** Ce qu'il faut pour savoir combien de créneaux étaient prévus. */
export interface PlanCtx {
  planning: Planning;
  overrides: Record<string, DayType>;
  schedule: ScheduleSettings;
  protocolStart: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const fmtMin = (min: number) => `${Math.floor(min / 60)}h${pad(min % 60)}`;

/** Date locale au format AAAA-MM-JJ. */
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
/** Minuit local, n jours plus tard (sans souci de changement d'heure). */
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
export const daysBetween = (a: string, b: string) => Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86_400_000);

/**
 * Créneaux de micro-séance (minutes depuis minuit). Un créneau qui tombe dans la
 * pause de midi est reporté 15 min après la fin de la pause.
 * Défauts : 9h30, 10h45, 12h00, 14h00, 15h15, 16h30.
 */
export function microSlots(s: ScheduleSettings): number[] {
  const end = toMin(s.dayEnd);
  const ls = toMin(s.lunchStart);
  const le = toMin(s.lunchEnd);
  const step = Math.max(15, s.intervalMin);
  const slots: number[] = [];
  let t = toMin(s.firstSlot);
  while (t < end) {
    if (t >= ls && t < le) {
      t = le + 15;
      continue;
    }
    slots.push(t);
    t += step;
  }
  return slots;
}

/** Message d'erreur si les horaires sont incohérents, sinon null. */
export function scheduleError(s: ScheduleSettings): string | null {
  const times = [s.firstSlot, s.dayEnd, s.lunchStart, s.lunchEnd, s.homeTime];
  if (times.some((t) => !/^\d{2}:\d{2}$/.test(t))) return 'Une heure est incomplète.';
  if (s.intervalMin < 60 || s.intervalMin > 90) return 'L’intervalle doit être entre 60 et 90 min.';
  if (toMin(s.firstSlot) >= toMin(s.dayEnd)) return 'Le premier créneau doit précéder la fin de journée.';
  if (toMin(s.lunchStart) >= toMin(s.lunchEnd)) return 'La pause de midi doit finir après avoir commencé.';
  return null;
}

export function dayKind(date: Date, planning: Planning, overrides: Record<string, DayType>): DayKind {
  const wd = date.getDay();
  if (wd === 0 || wd === 6) return 'weekend';
  return overrides[isoDate(date)] ?? planning[wd as Weekday];
}

/** Prochain créneau de la journée (micro-séance ou routine maison), ou null. */
export function nextSlot(now: Date, kind: DayKind, s: ScheduleSettings): { min: number; what: 'micro' | 'maison' } | null {
  const cur = now.getHours() * 60 + now.getMinutes();
  const micro = kind === 'bureau' || kind === 'teletravail' ? microSlots(s) : [];
  const m = micro.find((t) => t > cur);
  if (m !== undefined) return { min: m, what: 'micro' };
  const h = toMin(s.homeTime);
  return h > cur ? { min: h, what: 'maison' } : null;
}

/**
 * Nombre de créneaux de micro-séance prévus entre `from` (inclus) et `to` (heure
 * comprise), hors week-end, congés et jours antérieurs au début du protocole.
 */
export function plannedSlots(from: Date, to: Date, ctx: PlanCtx): number {
  const slots = microSlots(ctx.schedule);
  const toIso = isoDate(to);
  const toMinute = to.getHours() * 60 + to.getMinutes();
  let n = 0;
  for (let d = addDays(from, 0); isoDate(d) <= toIso; d = addDays(d, 1)) {
    const iso = isoDate(d);
    if (iso < ctx.protocolStart) continue;
    const k = dayKind(d, ctx.planning, ctx.overrides);
    if (k !== 'bureau' && k !== 'teletravail') continue;
    n += iso === toIso ? slots.filter((t) => t <= toMinute).length : slots.length;
  }
  return n;
}
