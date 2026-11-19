import type { SessionRecord } from './db';
import { addDays, isoDate, mondayOf, parseIso, plannedSlots, type PlanCtx } from './schedule';

export const isHome = (r: SessionRecord) => r.type === 'maison' || r.type === 'maison-courte';
export const isMicro = (r: SessionRecord) => r.type === 'bureau' || r.type === 'teletravail';
/** Une séance compte dans les statistiques si au moins un exercice a été fait. */
export const counts = (r: SessionRecord) => r.exercises.some((e) => e.status === 'done');
const dayOf = (r: SessionRecord) => isoDate(new Date(r.startedAt));

export interface WeekStats {
  /** Lundi de la semaine (AAAA-MM-JJ). */
  week: string;
  /** Jours avec au moins une routine maison (complète ou courte). */
  homeDays: number;
  micro: number;
  /** Créneaux de micro-séance prévus (jusqu'à maintenant pour la semaine en cours). */
  planned: number;
}

export function weekStats(records: SessionRecord[], monday: Date, now: Date, ctx: PlanCtx): WeekStats {
  const start = monday.getTime();
  const end = addDays(monday, 7).getTime();
  const inWeek = records.filter((r) => counts(r) && r.startedAt >= start && r.startedAt < end);
  const until = now.getTime() < end ? now : new Date(end - 60_000);
  return {
    week: isoDate(monday),
    homeDays: new Set(inWeek.filter(isHome).map(dayOf)).size,
    micro: inWeek.filter(isMicro).length,
    planned: plannedSlots(monday, until, ctx),
  };
}

/** Une entrée par semaine, du début du protocole à la semaine en cours. */
export function weeklySeries(records: SessionRecord[], now: Date, ctx: PlanCtx): WeekStats[] {
  let m = mondayOf(parseIso(ctx.protocolStart));
  const earliest = records.reduce((min, r) => Math.min(min, r.startedAt), Infinity);
  if (earliest < m.getTime()) m = mondayOf(new Date(earliest));
  const current = mondayOf(now).getTime();
  const out: WeekStats[] = [];
  for (; m.getTime() <= current; m = addDays(m, 7)) out.push(weekStats(records, m, now, ctx));
  return out;
}

/** Jours consécutifs avec une routine maison, jusqu'à aujourd'hui (ou hier si pas encore faite). */
export function streak(records: SessionRecord[], now: Date): number {
  const days = new Set(records.filter((r) => counts(r) && isHome(r)).map(dayOf));
  let d = addDays(now, 0);
  if (!days.has(isoDate(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(isoDate(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Nombre de fois où chaque exercice a été fait (regroupé par nom). */
export function totalsByExercise(records: SessionRecord[], nameOf: (id: string) => string): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of records)
    for (const e of r.exercises)
      if (e.status === 'done') {
        const n = nameOf(e.id);
        m.set(n, (m.get(n) ?? 0) + 1);
      }
  return [...m]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'));
}
