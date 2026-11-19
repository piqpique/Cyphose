import type { Phase } from './exercises';
import { addDays, daysBetween, isoDate, parseIso } from './schedule';

export interface PhaseInfo {
  name: string;
  /** Durée minimale en semaines (null : phase sans fin). */
  weeks: number | null;
  /** Critère de passage à la phase suivante, validé par l'utilisateur. */
  criterion: string;
  /** Objectif hebdomadaire de jours avec routine maison. */
  goal: number;
  goalText: string;
  /** Rappel affiché sur l'accueil. */
  hint?: string;
}

export const PHASES: Record<Phase, PhaseInfo> = {
  1: {
    name: 'Apprentissage',
    weeks: 4,
    criterion: 'Y-T-W et cobra sans cambrer ni hausser les épaules, sans douleur.',
    goal: 5,
    goalText: '5',
  },
  2: {
    name: 'Renforcement',
    weeks: 8,
    criterion: 'Y-T-W 2 × 12 par lettre, tenue 5 s, avec 0,5 kg ; cobra 2 × 10 bras tendus en Y.',
    goal: 5,
    goalText: '5',
    hint: 'Version courte possible 2 jours par semaine.',
  },
  3: {
    name: 'Intégration',
    weeks: 12,
    criterion: 'Posture redressée tenue sans y penser, assis comme en marchant.',
    goal: 5,
    goalText: '5',
    hint: 'Routine complète 5 jours sur 7, variantes les plus difficiles.',
  },
  4: {
    name: 'Entretien',
    weeks: null,
    criterion: 'Retour en phase 2 si le dos s’arrondit à nouveau.',
    goal: 3,
    goalText: '3 à 4',
    hint: 'Version courte 3 à 4 fois par semaine.',
  },
};

export const weeksInPhase = (start: string, today: string) => Math.floor(daysBetween(start, today) / 7);

export function phaseWeekLabel(phase: Phase, start: string, today: string): string {
  const w = weeksInPhase(start, today) + 1;
  const total = PHASES[phase].weeks;
  if (!total) return `semaine ${w}`;
  return w <= total ? `semaine ${w} sur ${total}` : `semaine ${w} · durée minimale atteinte`;
}

/** Propose la phase suivante quand la durée minimale est atteinte (sauf report). */
export function phaseProposal(
  phase: Phase,
  start: string,
  snoozeUntil: string,
  today: string,
): { next: Phase; weeks: number; criterion: string } | null {
  const info = PHASES[phase];
  if (!info.weeks) return null;
  const weeks = weeksInPhase(start, today);
  if (weeks < info.weeks) return null;
  if (snoozeUntil && today < snoozeUntil) return null;
  return { next: (phase + 1) as Phase, weeks, criterion: info.criterion };
}

export const snoozeDate = (today: string, days = 7) => isoDate(addDays(parseIso(today), days));
