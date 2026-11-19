import type { Segment } from './segments';

/** Temps écoulé calculé sur l'heure de début (reste juste après verrouillage de l'écran). */
export function elapsedSeconds(startMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - startMs) / 1000));
}

export type ExerciseStatus = 'pending' | 'done' | 'skipped';

export interface RunState {
  /** Segments de chaque exercice. */
  plan: Segment[][];
  ex: number;
  seg: number;
  /** Heure (ms) de début du segment courant, décalée des pauses. */
  segStart: number;
  pausedAt: number | null;
  /** Durée cumulée des pauses terminées (ms), pour la durée réelle de séance. */
  pausedMs: number;
  statuses: ExerciseStatus[];
  finished: boolean;
}

export type RunEvent = { type: 'segmentEnd'; kind: Segment['kind'] } | { type: 'exerciseEnd' } | { type: 'finished' };
export type SegmentEndEvent = Extract<RunEvent, { type: 'segmentEnd' }>;

export function startRun(plan: Segment[][], now: number): RunState {
  return {
    plan,
    ex: 0,
    seg: 0,
    segStart: now,
    pausedAt: null,
    pausedMs: 0,
    statuses: plan.map(() => 'pending'),
    finished: plan.length === 0,
  };
}

export const currentSegment = (s: RunState): Segment | undefined => s.plan[s.ex]?.[s.seg];
export const doneCount = (s: RunState) => s.statuses.filter((x) => x === 'done').length;

/** Secondes restantes (décimales) dans le segment courant. */
export function remaining(s: RunState, now: number): number {
  const seg = currentSegment(s);
  if (!seg) return 0;
  const t = s.pausedAt ?? now;
  return Math.max(0, seg.seconds - (t - s.segStart) / 1000);
}

/** Secondes restantes dans toute la séance. */
export function remainingTotal(s: RunState, now: number): number {
  if (s.finished) return 0;
  let t = remaining(s, now);
  const segs = s.plan[s.ex];
  for (let i = s.seg + 1; i < segs.length; i++) t += segs[i].seconds;
  for (let e = s.ex + 1; e < s.plan.length; e++) for (const g of s.plan[e]) t += g.seconds;
  return t;
}

/** Durée active (ms) entre le début et `now`, pauses exclues. */
export function activeMs(s: RunState, startedAt: number, now: number): number {
  const currentPause = s.pausedAt !== null ? now - s.pausedAt : 0;
  return Math.max(0, now - startedAt - s.pausedMs - currentPause);
}

function nextSegment(s: RunState, events: RunEvent[]): RunState {
  const segs = s.plan[s.ex];
  if (s.seg + 1 < segs.length) return { ...s, seg: s.seg + 1 };
  const statuses = s.statuses.slice();
  if (statuses[s.ex] === 'pending') statuses[s.ex] = 'done';
  events.push({ type: 'exerciseEnd' });
  if (s.ex + 1 < s.plan.length) return { ...s, ex: s.ex + 1, seg: 0, statuses };
  events.push({ type: 'finished' });
  return { ...s, statuses, finished: true };
}

/**
 * Fait avancer la séance jusqu'à `now`. Si l'écran a été verrouillé, rattrape
 * tous les segments écoulés d'un coup (calcul sur les heures, pas sur un compteur).
 */
export function advance(state: RunState, now: number): { state: RunState; events: RunEvent[] } {
  let s = state;
  const events: RunEvent[] = [];
  if (s.finished || s.pausedAt !== null) return { state: s, events };
  for (;;) {
    const seg = currentSegment(s);
    if (!seg) break;
    const end = s.segStart + seg.seconds * 1000;
    if (now < end) break;
    events.push({ type: 'segmentEnd', kind: seg.kind });
    s = { ...nextSegment(s, events), segStart: end };
    if (s.finished) break;
  }
  return { state: s, events };
}

export function pause(s: RunState, now: number): RunState {
  return s.pausedAt === null ? { ...s, pausedAt: now } : s;
}

export function resume(s: RunState, now: number): RunState {
  if (s.pausedAt === null) return s;
  const d = now - s.pausedAt;
  return { ...s, segStart: s.segStart + d, pausedMs: s.pausedMs + d, pausedAt: null };
}

/** Passe à l'étape suivante tout de suite (fin de la mise en place, d'un repos…). */
export function skipSegment(s: RunState, now: number): { state: RunState; events: RunEvent[] } {
  const seg = currentSegment(s);
  if (s.finished || !seg) return { state: s, events: [] };
  const events: RunEvent[] = [{ type: 'segmentEnd', kind: seg.kind }];
  const moved = nextSegment(s, events);
  return { state: { ...moved, segStart: now, pausedAt: s.pausedAt === null ? null : now }, events };
}

/** Passe l'exercice courant (marqué « sauté »). */
export function skipExercise(s: RunState, now: number): { state: RunState; events: RunEvent[] } {
  if (s.finished) return { state: s, events: [] };
  const statuses = s.statuses.slice();
  statuses[s.ex] = 'skipped';
  const events: RunEvent[] = [];
  const moved = nextSegment({ ...s, statuses, seg: s.plan[s.ex].length - 1 }, events);
  return { state: { ...moved, segStart: now, pausedAt: s.pausedAt === null ? null : now }, events };
}

/** Termine la séance : les exercices non commencés ou en cours sont « sautés ». */
export function finishRun(s: RunState): RunState {
  return { ...s, finished: true, statuses: s.statuses.map((st) => (st === 'pending' ? 'skipped' : st)) };
}

/**
 * Retour dans l'app après une absence (écran verrouillé, autre app, app tuée).
 * Absence courte : on laisse le chrono rattraper le temps écoulé.
 * Absence longue : la séance est mise en pause à l'heure du départ, pour ne pas
 * compter comme « faits » des exercices qui n'ont pas été faits.
 */
export function resumeAfterAbsence(
  s: RunState,
  hiddenAt: number,
  now: number,
  maxAbsenceMs: number,
): { state: RunState; autoPaused: boolean } {
  if (s.finished || s.pausedAt !== null || now - hiddenAt <= maxAbsenceMs) return { state: s, autoPaused: false };
  const at = advance(s, hiddenAt).state;
  if (at.finished) return { state: at, autoPaused: false };
  return { state: pause(at, hiddenAt), autoPaused: true };
}
