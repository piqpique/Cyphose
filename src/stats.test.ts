import { describe, expect, test } from 'vitest';
import { toCsv } from './csv';
import type { SessionRecord } from './db';
import { phaseProposal, phaseWeekLabel, snoozeDate } from './phases';
import { DEFAULT_PLANNING, DEFAULT_SCHEDULE, plannedSlots, scheduleError, type PlanCtx } from './schedule';
import { counts, streak, totalsByExercise, weeklySeries, weekStats } from './stats';

const ctx: PlanCtx = { planning: DEFAULT_PLANNING, overrides: {}, schedule: DEFAULT_SCHEDULE, protocolStart: '2026-11-02' };
const at = (y: number, m: number, d: number, h = 19) => new Date(y, m - 1, d, h).getTime();
const rec = (startedAt: number, type: SessionRecord['type'], done = true): SessionRecord => ({
  startedAt,
  endedAt: startedAt + 600_000,
  durationSec: 600,
  type,
  origin: 'manuelle',
  exercises: [
    { id: 'ytw', status: done ? 'done' : 'skipped' },
    { id: 'cobra', status: 'skipped' },
  ],
});

describe('statistiques', () => {
  test('une séance sans exercice fait ne compte pas', () => {
    expect(counts(rec(0, 'maison', false))).toBe(false);
    expect(counts(rec(0, 'maison'))).toBe(true);
  });

  test('semaine : jours maison distincts, micro-séances, créneaux prévus', () => {
    const records = [
      rec(at(2026, 11, 16), 'maison'),
      rec(at(2026, 11, 16, 20), 'maison-courte'), // même jour : 1 seul jour
      rec(at(2026, 11, 17), 'maison'),
      rec(at(2026, 11, 18), 'maison', false), // rien de fait : ignorée
      rec(at(2026, 11, 17, 10), 'bureau'),
      rec(at(2026, 11, 9), 'maison'), // semaine précédente
    ];
    const now = new Date(2026, 10, 19, 10, 0); // jeudi 10h00
    const w = weekStats(records, new Date(2026, 10, 16), now, ctx);
    expect(w).toMatchObject({ week: '2026-11-16', homeDays: 2, micro: 1 });
    expect(w.planned).toBe(6 * 3 + 1); // lun-mer complets + 9h30 jeudi
  });

  test('créneaux prévus : rien avant le début du protocole, rien les jours de congé', () => {
    const from = new Date(2026, 10, 16);
    const to = new Date(2026, 10, 20, 23, 0);
    expect(plannedSlots(from, to, { ...ctx, protocolStart: '2026-11-19' })).toBe(12);
    expect(plannedSlots(from, to, { ...ctx, overrides: { '2026-11-17': 'conge' } })).toBe(24);
  });

  test('série par semaine depuis le début du protocole', () => {
    const s = weeklySeries([rec(at(2026, 11, 10), 'maison')], new Date(2026, 10, 19), ctx);
    expect(s.map((w) => w.week)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(s[1].homeDays).toBe(1);
  });

  test('jours consécutifs : compte jusqu’à hier si rien aujourd’hui', () => {
    const r = [rec(at(2026, 11, 16), 'maison'), rec(at(2026, 11, 17), 'maison-courte'), rec(at(2026, 11, 18), 'maison')];
    expect(streak(r, new Date(2026, 10, 18, 21))).toBe(3);
    expect(streak(r, new Date(2026, 10, 19, 8))).toBe(3);
    expect(streak(r, new Date(2026, 10, 20, 8))).toBe(0);
  });

  test('total par exercice regroupé par nom', () => {
    const names: Record<string, string> = { anges: 'Anges au mur', B4: 'Anges au mur', ytw: 'Y-T-W' };
    const r: SessionRecord = { ...rec(0, 'maison'), exercises: [{ id: 'anges', status: 'done' }, { id: 'B4', status: 'done' }, { id: 'ytw', status: 'skipped' }] };
    expect(totalsByExercise([r], (id) => names[id])).toEqual([{ name: 'Anges au mur', count: 2 }]);
  });
});

describe('phases', () => {
  test('propose la phase 2 après 4 semaines, sauf report', () => {
    expect(phaseProposal(1, '2026-11-02', '', '2026-11-29')).toBeNull();
    expect(phaseProposal(1, '2026-11-02', '', '2026-11-30')).toMatchObject({ next: 2, weeks: 4 });
    expect(phaseProposal(1, '2026-11-02', snoozeDate('2026-11-30'), '2026-12-03')).toBeNull();
    expect(phaseProposal(1, '2026-11-02', snoozeDate('2026-11-30'), '2026-12-07')).not.toBeNull();
    expect(phaseProposal(4, '2026-01-01', '', '2026-11-30')).toBeNull();
  });

  test('libellé de semaine', () => {
    expect(phaseWeekLabel(1, '2026-11-02', '2026-11-02')).toBe('semaine 1 sur 4');
    expect(phaseWeekLabel(1, '2026-11-02', '2026-12-10')).toBe('semaine 6 · durée minimale atteinte');
    expect(phaseWeekLabel(4, '2026-11-02', '2026-11-20')).toBe('semaine 3');
  });
});

describe('horaires', () => {
  test('refuse les horaires incohérents', () => {
    expect(scheduleError(DEFAULT_SCHEDULE)).toBeNull();
    expect(scheduleError({ ...DEFAULT_SCHEDULE, lunchEnd: '12:00' })).toMatch(/pause/);
    expect(scheduleError({ ...DEFAULT_SCHEDULE, firstSlot: '18:00' })).toMatch(/premier/i);
    expect(scheduleError({ ...DEFAULT_SCHEDULE, homeTime: '' })).toMatch(/incomplète/);
  });
});

describe('export CSV', () => {
  test('BOM, séparateur ; et échappement', () => {
    const r: SessionRecord = { ...rec(at(2026, 11, 19), 'maison'), phase: 1, origin: 'rappel' };
    const csv = toCsv([r], (id) => (id === 'ytw' ? 'Y-T-W ; "test"' : 'Cobra'));
    const [header, row] = csv.slice(1).split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(header).toBe('date;debut;fin;duree_s;type;origine;phase;exercices_faits;exercices_sautes;detail');
    expect(row).toBe('2026-11-19;19:00;19:10;600;Routine maison complète;rappel;1;1;1;"Y-T-W ; ""test"" : fait | Cobra : sauté"');
  });
});
