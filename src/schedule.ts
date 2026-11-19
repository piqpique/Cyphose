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
export type Planning = Record<1 | 2 | 3 | 4 | 5, DayType>;
export const DEFAULT_PLANNING: Planning = { 1: 'bureau', 2: 'bureau', 3: 'teletravail', 4: 'bureau', 5: 'teletravail' };

export const DAY_LABELS: Record<DayKind, string> = {
  bureau: 'Bureau',
  teletravail: 'Télétravail',
  conge: 'Congé',
  weekend: 'Week-end',
};

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const fmtMin = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;

/** Date locale au format AAAA-MM-JJ. */
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Créneaux de micro-séance (minutes depuis minuit). Un créneau qui tombe dans la
 * pause de midi est reporté 15 min après la fin de la pause.
 * Défauts : 9h30, 10h45, 12h00, 14h00, 15h15, 16h30.
 */
export function microSlots(s: ScheduleSettings): number[] {
  const end = toMin(s.dayEnd);
  const ls = toMin(s.lunchStart);
  const le = toMin(s.lunchEnd);
  const slots: number[] = [];
  let t = toMin(s.firstSlot);
  while (t < end) {
    if (t >= ls && t < le) {
      t = le + 15;
      continue;
    }
    slots.push(t);
    t += s.intervalMin;
  }
  return slots;
}

export function dayKind(date: Date, planning: Planning, overrides: Record<string, DayType>): DayKind {
  const wd = date.getDay();
  if (wd === 0 || wd === 6) return 'weekend';
  return overrides[isoDate(date)] ?? planning[wd as 1 | 2 | 3 | 4 | 5];
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
