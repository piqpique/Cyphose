import { expect, test } from 'vitest';
import { elapsedSeconds } from './timer';

test('calcule le temps depuis l\'heure de début', () => {
  expect(elapsedSeconds(0, 65_400)).toBe(65);
  expect(elapsedSeconds(1000, 0)).toBe(0);
});
