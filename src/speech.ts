import type { Exercise } from './exercises';
import type { Segment } from './segments';

/**
 * Ce que dit la voix pendant la mise en place : le nom de l'exercice, le placement
 * et les consignes, puis l'erreur à éviter.
 */
export function prepSpeech(ex: Exercise): string {
  const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
  return toSpeech([`${ex.name}.`, ...ex.cues, `À éviter : ${lower(ex.avoid)}`].join(' '));
}

/**
 * Ce que dit la voix à chaque changement d'état, sur tous les exercices :
 * « Tiens », « Relâche », « Étends », « Monte », « Inspire », « Change de côté »…
 * Les étapes de 10 s et plus donnent leur durée ; le repos entre séries aussi.
 */
export function segmentSpeech(seg: Segment): string {
  if (seg.kind === 'prep') return '';
  if (seg.label === 'Repos entre séries') return `Repos, ${seg.seconds} secondes`;
  const long = seg.seconds >= 10 && (seg.kind === 'work' || seg.kind === 'rest');
  return toSpeech(long ? `${seg.label}, ${seg.seconds} secondes` : seg.label);
}

/** Écrit les abréviations comme elles se disent : la synthèse vocale lit mal « 4 s », « 90° » ou « 90/90 ». */
export function toSpeech(text: string): string {
  return text
    .replace(/(\d+)\/(\d+)/g, '$1 $2')
    .replace(/(\d+)\s?°/g, '$1 degrés')
    .replace(/(\d+(?:,\d+)?) s\b/g, '$1 secondes')
    .replace(/(\d+(?:,\d+)?) kg\b/g, '$1 kilo')
    .replace(/ × /g, ' fois ')
    .replace(/Y-T-W/g, 'Y, T, W')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Durée de lecture estimée (s), volontairement large : environ 13 caractères par
 * seconde, plus une courte pause par signe de ponctuation.
 */
export function speechSeconds(text: string): number {
  const pauses = (text.match(/[.,;:!?]/g) ?? []).length;
  return text.length / 13 + pauses * 0.3;
}

/** Marge pour finir de se placer une fois l'explication terminée. */
export const PREP_MARGIN = 2;

/** Mise en place assez longue pour entendre toute l'explication. */
export function prepSeconds(base: number, text: string): number {
  return Math.max(base, Math.ceil(speechSeconds(text) + PREP_MARGIN));
}
