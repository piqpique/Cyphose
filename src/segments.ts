import { SET_REST, type Dose } from './exercises';

export type SegmentKind = 'prep' | 'work' | 'rest' | 'switch' | 'inhale' | 'exhale';

export interface Segment {
  kind: SegmentKind;
  /** Ce qu'il faut faire maintenant (« Tiens », « Repos », « Change de côté »…). */
  label: string;
  /** Où on en est (« Série 1/2 · Répétition 4/10 »). */
  counter: string;
  seconds: number;
}

/** Mise en place avant chaque exercice ; « Je suis prêt » permet de l'écourter. */
const PREP = 10;
const SWITCH = 5;
const join = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' · ');
const of = (i: number, n: number) => `${i + 1}/${n}`;

/** Transforme une dose en suite de segments chronométrés, préparation incluse. */
export function buildSegments(dose: Dose, prep = PREP): Segment[] {
  const out: Segment[] = [{ kind: 'prep', label: 'Mise en place', counter: '', seconds: prep }];
  const push = (s: Segment) => {
    if (s.seconds > 0) out.push(s);
  };

  switch (dose.kind) {
    case 'holds': {
      const sets = dose.sets ?? 1;
      const positions = dose.positions ?? [undefined];
      for (let s = 0; s < sets; s++) {
        positions.forEach((pos, pi) => {
          const where = join(
            sets > 1 && `${dose.positions ? 'Tour' : 'Série'} ${of(s, sets)}`,
            pos !== undefined && `${dose.positionLabel ?? ''} ${pos}`.trim(),
          );
          for (let r = 0; r < dose.reps; r++) {
            const counter = join(where, `Répétition ${of(r, dose.reps)}`);
            push({ kind: 'work', label: dose.holdLabel ?? 'Tiens', counter, seconds: dose.hold });
            if (r < dose.reps - 1) push({ kind: 'rest', label: dose.restLabel ?? 'Relâche', counter, seconds: dose.rest });
          }
          const nextPos = positions[pi + 1];
          if (nextPos !== undefined)
            push({ kind: 'switch', label: `Change : ${dose.positionLabel?.toLowerCase() ?? ''} ${nextPos}`.replace('  ', ' '), counter: where, seconds: SWITCH });
        });
        if (s < sets - 1)
          push({ kind: 'rest', label: 'Repos entre séries', counter: `Série ${of(s, sets)} terminée`, seconds: dose.setRest ?? SET_REST });
      }
      break;
    }
    case 'perSide': {
      const sets = dose.sets ?? 1;
      const sides = ['gauche', 'droit'];
      for (let s = 0; s < sets; s++) {
        sides.forEach((side, si) => {
          for (let r = 0; r < dose.reps; r++) {
            const counter = join(sets > 1 && `Série ${of(s, sets)}`, `Côté ${side}`, `Répétition ${of(r, dose.reps)}`);
            push({ kind: 'work', label: 'Vas-y', counter, seconds: dose.hold });
            if (r < dose.reps - 1) push({ kind: 'rest', label: 'Relâche', counter, seconds: dose.rest });
          }
          if (si === 0) push({ kind: 'switch', label: 'Change de côté', counter: 'Côté droit ensuite', seconds: SWITCH });
        });
        if (s < sets - 1)
          push({ kind: 'rest', label: 'Repos entre séries', counter: `Série ${of(s, sets)} terminée`, seconds: dose.setRest ?? SET_REST });
      }
      break;
    }
    case 'simpleHold': {
      const positions = dose.positions ?? [undefined];
      const sides = dose.sides ? ['gauche', 'droit'] : [undefined];
      const reps = dose.reps ?? 1;
      const blocks: { pos?: string; side?: string }[] = [];
      for (const pos of positions) for (const side of sides) blocks.push({ pos, side });
      blocks.forEach((b, bi) => {
        for (let r = 0; r < reps; r++) {
          const counter = join(
            b.pos && b.pos[0].toUpperCase() + b.pos.slice(1),
            b.side && `Côté ${b.side}`,
            reps > 1 && `Répétition ${of(r, reps)}`,
          );
          push({ kind: 'work', label: 'Tiens', counter, seconds: dose.seconds });
          const last = bi === blocks.length - 1 && r === reps - 1;
          if (last) continue;
          if (r === reps - 1) {
            const nb = blocks[bi + 1];
            const label = nb.pos !== b.pos ? `Change : ${nb.pos}` : `Change de côté`;
            push({ kind: 'switch', label, counter: '', seconds: SWITCH });
          } else push({ kind: 'rest', label: 'Relâche', counter, seconds: dose.rest ?? 10 });
        }
      });
      break;
    }
    case 'breaths': {
      const sets = dose.sets ?? 1;
      for (let s = 0; s < sets; s++) {
        for (let c = 0; c < dose.cycles; c++) {
          const counter = join(sets > 1 && `Série ${of(s, sets)}`, `Respiration ${of(c, dose.cycles)}`);
          push({ kind: 'inhale', label: 'Inspire', counter, seconds: dose.inhale });
          push({ kind: 'exhale', label: 'Expire', counter, seconds: dose.exhale });
        }
        if (s < sets - 1)
          push({ kind: 'rest', label: 'Repos entre séries', counter: `Série ${of(s, sets)} terminée`, seconds: dose.setRest ?? SET_REST });
      }
      break;
    }
  }
  return out;
}

export const totalSeconds = (segs: Segment[]) => segs.reduce((t, s) => t + s.seconds, 0);
