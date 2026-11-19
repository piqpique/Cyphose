import { describe, expect, test } from 'vitest';
import { EXERCISES } from './exercises';
import { buildPlan } from './routines';
import { buildSegments, totalSeconds } from './segments';
import { PREP_MARGIN, prepSeconds, prepSpeech, speechSeconds, toSpeech } from './speech';

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

describe('exercices 1 et 2', () => {
  test('exo 1 : 5 s de pause entre les deux séries de respirations', () => {
    const rests = buildSegments(EXERCISES.resp.doses[1]).filter((s) => s.label === 'Repos entre séries');
    expect(rests).toHaveLength(1);
    expect(rests[0].seconds).toBe(5);
  });

  test('exo 2 : la voix annonce « Étends » et « Relâche » à chaque répétition', () => {
    const dose = EXERCISES.rouleau.doses[1];
    expect('voiceReps' in dose && dose.voiceReps).toBe(true);
    const labels = buildSegments(dose).map((s) => s.label);
    expect(labels.filter((l) => l === 'Étends')).toHaveLength(15);
    expect(labels.filter((l) => l === 'Relâche')).toHaveLength(12);
  });

  test('durées avec la voix (info)', () => {
    const secs = (t: 'maison' | 'maison-courte' | 'teletravail') =>
      buildPlan(t, 1, undefined, '', { voice: true }).items.reduce((a, i) => a + totalSeconds(buildSegments(i.dose, i.prep)), 0);
    const preps = buildPlan('maison', 1, undefined, '', { voice: true }).items.map((i) => `${i.exerciseId} ${i.prep} s`);
    console.log(preps.join(' · '), '| maison', Math.round(secs('maison') / 60), 'min | courte', Math.round(secs('maison-courte') / 60), 'min | télétravail', Math.round(secs('teletravail') / 60), 'min');
    expect(secs('maison')).toBeGreaterThan(0);
  });
});
