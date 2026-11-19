import { describe, expect, test } from 'vitest';
import { EXERCISES } from './exercises';
import { buildPlan } from './routines';
import { buildSegments, totalSeconds, type Segment } from './segments';
import {
  activeMs,
  advance,
  currentSegment,
  elapsedSeconds,
  finishRun,
  pause,
  remaining,
  remainingTotal,
  resume,
  resumeAfterAbsence,
  skipExercise,
  skipSegment,
  startRun,
} from './timer';
import { DEFAULT_PLANNING, DEFAULT_SCHEDULE, dayKind, fmtMin, microSlots, nextSlot } from './schedule';

const seg = (seconds: number, kind: Segment['kind'] = 'work'): Segment => ({ kind, label: '', counter: '', seconds });

test("calcule le temps depuis l'heure de début", () => {
  expect(elapsedSeconds(0, 65_400)).toBe(65);
  expect(elapsedSeconds(1000, 0)).toBe(0);
});

describe('moteur de séance', () => {
  const plan = [[seg(5), seg(3, 'rest')], [seg(10)]];

  test('rattrape les segments écoulés écran verrouillé', () => {
    const s0 = startRun(plan, 0);
    const { state, events } = advance(s0, 12_000); // 5 + 3 écoulés, 4 s dans le 3e
    expect(state.ex).toBe(1);
    expect(state.seg).toBe(0);
    expect(remaining(state, 12_000)).toBeCloseTo(6);
    expect(state.statuses).toEqual(['done', 'pending']);
    expect(events.filter((e) => e.type === 'segmentEnd')).toHaveLength(2);
  });

  test('termine la séance quand tout est écoulé', () => {
    const { state, events } = advance(startRun(plan, 0), 60_000);
    expect(state.finished).toBe(true);
    expect(state.statuses).toEqual(['done', 'done']);
    expect(events.at(-1)).toEqual({ type: 'finished' });
  });

  test('la pause ne consomme pas de temps', () => {
    let s = startRun(plan, 0);
    s = pause(s, 2_000);
    expect(advance(s, 100_000).state.seg).toBe(0);
    expect(remaining(s, 100_000)).toBeCloseTo(3);
    s = resume(s, 100_000);
    expect(remaining(s, 101_000)).toBeCloseTo(2);
  });

  test('passer un exercice le marque sauté', () => {
    const { state } = skipExercise(startRun(plan, 0), 1_000);
    expect(state.statuses).toEqual(['skipped', 'pending']);
    expect(state.ex).toBe(1);
    expect(remaining(state, 1_000)).toBeCloseTo(10);
  });

  test('terminer marque le reste sauté', () => {
    expect(finishRun(startRun(plan, 0)).statuses).toEqual(['skipped', 'skipped']);
  });

  test('étape suivante : passe le segment sans sauter l’exercice', () => {
    let r = skipSegment(startRun(plan, 0), 1_000);
    expect(r.state.seg).toBe(1);
    expect(remaining(r.state, 1_000)).toBeCloseTo(3);
    r = skipSegment(r.state, 2_000);
    expect(r.state.ex).toBe(1);
    expect(r.state.statuses).toEqual(['done', 'pending']);
    expect(r.events[0]).toEqual({ type: 'segmentEnd', kind: 'rest' });
  });

  test('temps restant de la séance', () => {
    expect(remainingTotal(startRun(plan, 0), 2_000)).toBeCloseTo(16);
  });

  test('durée active : pauses exclues', () => {
    let s = startRun(plan, 0);
    s = pause(s, 4_000);
    s = resume(s, 64_000); // 1 min de pause
    expect(activeMs(s, 0, 70_000)).toBe(10_000);
    expect(activeMs(pause(s, 70_000), 0, 100_000)).toBe(10_000);
  });

  test('absence courte : le chrono rattrape', () => {
    const r = resumeAfterAbsence(startRun(plan, 0), 2_000, 60_000, 300_000);
    expect(r.autoPaused).toBe(false);
    expect(advance(r.state, 60_000).state.finished).toBe(true);
  });

  test('absence longue : pause à l’heure du départ, rien n’est compté comme fait', () => {
    const r = resumeAfterAbsence(startRun(plan, 0), 2_000, 2_000 + 600_000, 300_000);
    expect(r.autoPaused).toBe(true);
    expect(r.state.pausedAt).toBe(2_000);
    expect(r.state.statuses).toEqual(['pending', 'pending']);
    expect(remaining(r.state, 999_999)).toBeCloseTo(3);
  });
});

describe('segments', () => {
  test('cobra phase 1 : 2 × 10, tenue 5 s, relâche 3 s, repos entre séries 30 s', () => {
    const segs = buildSegments(EXERCISES.cobra.doses[1]);
    expect(segs.filter((s) => s.kind === 'work')).toHaveLength(20);
    expect(segs.filter((s) => s.kind === 'work').every((s) => s.seconds === 5)).toBe(true);
    expect(segs.filter((s) => s.label === 'Relâche').every((s) => s.seconds === 3)).toBe(true);
    expect(segs.find((s) => s.label === 'Repos entre séries')?.seconds).toBe(30);
    // mise en place 10 + 2 × (10 × 5 + 9 × 3) + 30
    expect(totalSeconds(segs)).toBe(10 + 2 * 77 + 30);
  });

  test('Y-T-W : 2 tours × 8 par lettre', () => {
    const work = buildSegments(EXERCISES.ytw.doses[1]).filter((s) => s.kind === 'work');
    expect(work).toHaveLength(48);
    expect(work[8].counter).toContain('Lettre T');
  });

  test('porte : 30 s × 2 hauteurs × 2 côtés', () => {
    const work = buildSegments(EXERCISES.porte.doses[1]).filter((s) => s.kind === 'work');
    expect(work).toHaveLength(4);
    expect(work.every((s) => s.seconds === 30)).toBe(true);
  });

  test('open book : 8 par côté avec changement de côté', () => {
    const segs = buildSegments(EXERCISES.openbook.doses[1]);
    expect(segs.filter((s) => s.kind === 'work')).toHaveLength(16);
    expect(segs.some((s) => s.label === 'Change de côté')).toBe(true);
  });

  test('respiration : inspire 4 s / expire 6 s', () => {
    const segs = buildSegments(EXERCISES.resp.doses[1]);
    expect(segs.filter((s) => s.kind === 'inhale')).toHaveLength(10);
    expect(segs.find((s) => s.kind === 'exhale')?.seconds).toBe(6);
  });
});

describe('routines', () => {
  test('routine complète ≈ 18 min', () => {
    const { items } = buildPlan('maison', 1);
    const min = items.reduce((t, i) => t + totalSeconds(buildSegments(i.dose, i.prep)), 0) / 60;
    expect(items).toHaveLength(8);
    expect(min).toBeGreaterThan(14);
    expect(min).toBeLessThan(22);
  });

  test('micro-séances courtes : mise en place réduite', () => {
    const secs = (t: 'bureau' | 'teletravail') =>
      buildPlan(t, 1).items.reduce((sum, i) => sum + totalSeconds(buildSegments(i.dose, i.prep)), 0);
    expect(buildPlan('bureau', 1).items.every((i) => i.prep === 3)).toBe(true);
    expect(secs('bureau')).toBeLessThan(150);
    expect(secs('teletravail')).toBeLessThan(180);
  });

  test('routine courte garde Y-T-W et cobra', () => {
    const ids = buildPlan('maison-courte', 1).items.map((i) => i.exerciseId);
    expect(ids).toEqual(['resp', 'rouleau', 'ytw', 'cobra', 'elong']);
  });

  test('phase 2 : Y-T-W 12 par lettre, tenue 5 s', () => {
    const ytw = buildPlan('maison', 2).items.find((i) => i.exerciseId === 'ytw')!.dose;
    expect(ytw).toMatchObject({ reps: 12, hold: 5 });
  });

  test('télétravail : rotation des familles et porte une fois par jour', () => {
    const a = buildPlan('teletravail', 1, undefined, '2026-11-19');
    expect(a.items.map((i) => i.exerciseId)).toEqual(['B1', 'B3', 'B5', 'B7']);
    const b = buildPlan('teletravail', 1, a.rotation, '2026-11-19');
    expect(b.items.map((i) => i.exerciseId)).toEqual(['B2', 'B4', 'B6', 'B7']);
    const c = buildPlan('teletravail', 1, { ...b.rotation, rot: 1 }, '2026-11-19');
    expect(c.items.map((i) => i.exerciseId)[2]).toBe('B5');
  });
});

describe('planning', () => {
  test('créneaux par défaut de la spec', () => {
    expect(microSlots(DEFAULT_SCHEDULE).map(fmtMin)).toEqual(['9h30', '10h45', '12h00', '14h00', '15h15', '16h30']);
  });

  test('week-end et congé', () => {
    expect(dayKind(new Date(2026, 10, 21), DEFAULT_PLANNING, {})).toBe('weekend');
    expect(dayKind(new Date(2026, 10, 19), DEFAULT_PLANNING, {})).toBe('bureau'); // jeudi
    expect(dayKind(new Date(2026, 10, 19), DEFAULT_PLANNING, { '2026-11-19': 'conge' })).toBe('conge');
  });

  test('prochain créneau', () => {
    expect(nextSlot(new Date(2026, 10, 19, 10, 0), 'bureau', DEFAULT_SCHEDULE)).toEqual({ min: 645, what: 'micro' });
    expect(nextSlot(new Date(2026, 10, 19, 10, 0), 'conge', DEFAULT_SCHEDULE)).toEqual({ min: 1140, what: 'maison' });
    expect(nextSlot(new Date(2026, 10, 19, 20, 0), 'bureau', DEFAULT_SCHEDULE)).toBeNull();
  });
});

test('currentSegment', () => {
  expect(currentSegment(startRun([[seg(1)]], 0))?.seconds).toBe(1);
});
