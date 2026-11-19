import { describe, expect, test } from 'vitest';
import { EXERCISES } from './exercises';
import { buildPlan } from './routines';
import { buildSegments, totalSeconds } from './segments';
import { PREP_MARGIN, prepSeconds, prepSpeech, segmentSpeech, speechSeconds, toSpeech } from './speech';

describe('voix', () => {
  test('explication de mise en place : nom, consignes, erreur à éviter', () => {
    const t = prepSpeech(EXERCISES.cobra);
    expect(t.startsWith('Cobra thoracique.')).toBe(true);
    for (const c of EXERCISES.cobra.cues) expect(t).toContain(toSpeech(c));
    expect(t.endsWith('À éviter : cambrer ou hausser les épaules.')).toBe(true);
  });

  test('abréviations écrites comme elles se disent', () => {
    expect(toSpeech('Inspire 4 s par le nez, expire 6 s.')).toBe('Inspire 4 secondes par le nez, expire 6 secondes.');
    expect(toSpeech('Respiration 90/90, genoux à 90°.')).toBe('Respiration 90 90, genoux à 90 degrés.');
    expect(toSpeech('Y-T-W 2 × 12, 0,5 kg')).toBe('Y, T, W 2 fois 12, 0,5 kilo');
  });

  test('la mise en place dure au moins le temps de l’explication', () => {
    const text = prepSpeech(EXERCISES.resp);
    expect(prepSeconds(10, text)).toBeGreaterThanOrEqual(speechSeconds(text) + PREP_MARGIN);
    expect(prepSeconds(60, text)).toBe(60);
  });

  test('voix active : mise en place allongée à la maison, jamais au bureau', () => {
    const maison = buildPlan('maison', 1, undefined, '', { voice: true }).items;
    expect(maison.every((i) => i.prep >= 10)).toBe(true);
    expect(maison.find((i) => i.exerciseId === 'resp')!.prep).toBeGreaterThan(10);
    expect(buildPlan('maison', 1).items.every((i) => i.prep === 10)).toBe(true);
    expect(buildPlan('bureau', 1, undefined, '', { voice: false }).items.every((i) => i.prep === 3)).toBe(true);
  });
});

describe('voix à chaque changement d’état', () => {
  const said = (id: string) => buildSegments(EXERCISES[id].doses[1]).filter((s) => s.kind !== 'prep').map(segmentSpeech);

  test('chaque étape de chaque exercice a son annonce', () => {
    for (const id of Object.keys(EXERCISES)) expect(said(id).every((t) => t.length > 0), id).toBe(true);
  });

  test('tenues et relâchements', () => {
    expect(said('cobra').slice(0, 3)).toEqual(['Tiens', 'Relâche', 'Tiens']);
    expect(said('rouleau').slice(0, 3)).toEqual(['Étends', 'Relâche', 'Étends']);
    expect(said('anges').slice(0, 2)).toEqual(['Monte', 'Descends']);
    expect(said('openbook').slice(0, 2)).toEqual(['Vas-y', 'Relâche']);
    expect(said('resp').slice(0, 2)).toEqual(['Inspire', 'Expire']);
  });

  test('changements, repos entre séries, longues tenues', () => {
    expect(said('ytw')).toContain('Change : lettre T');
    expect(said('ytw')).toContain('Repos, 10 secondes');
    expect(said('openbook')).toContain('Change de côté');
    expect(said('porte')[0]).toBe('Tiens, 30 secondes');
    expect(said('porte')).toContain('Change : coude à 120 degrés');
    expect(said('elong').slice(0, 2)).toEqual(['Tiens, 20 secondes', 'Relâche, 10 secondes']);
  });
});

describe('exercices 1 et 2', () => {
  test('exo 1 : 5 s de pause entre les deux séries de respirations', () => {
    const rests = buildSegments(EXERCISES.resp.doses[1]).filter((s) => s.label === 'Repos entre séries');
    expect(rests).toHaveLength(1);
    expect(rests[0].seconds).toBe(5);
  });

  test('Y-T-W : 10 s de repos entre les deux tours', () => {
    const rests = buildSegments(EXERCISES.ytw.doses[1]).filter((s) => s.label === 'Repos entre séries');
    expect(rests.map((s) => s.seconds)).toEqual([10]);
    expect(buildSegments(EXERCISES.ytw.doses[2]!).find((s) => s.label === 'Repos entre séries')?.seconds).toBe(10);
  });

  test('cobra : relâche de 3 s, aussi en phase 2', () => {
    expect(EXERCISES.cobra.doses[1]).toMatchObject({ rest: 3 });
    expect(EXERCISES.cobra.doses[2]).toMatchObject({ rest: 3 });
  });

  test('durées avec la voix (info)', () => {
    const secs = (t: 'maison' | 'maison-courte' | 'teletravail') =>
      buildPlan(t, 1, undefined, '', { voice: true }).items.reduce((a, i) => a + totalSeconds(buildSegments(i.dose, i.prep)), 0);
    const preps = buildPlan('maison', 1, undefined, '', { voice: true }).items.map((i) => `${i.exerciseId} ${i.prep} s`);
    console.log(preps.join(' · '), '| maison', Math.round(secs('maison') / 60), 'min | courte', Math.round(secs('maison-courte') / 60), 'min | télétravail', Math.round(secs('teletravail') / 60), 'min');
    expect(secs('maison')).toBeGreaterThan(0);
  });
});
