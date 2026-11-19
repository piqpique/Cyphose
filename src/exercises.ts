/**
 * Exercices du protocole (données, pas de logique).
 *
 * Doses : reprises de SPEC.md. Quand la spec ne précise pas un temps de repos
 * entre deux répétitions, on met 2 s (juste le temps de relâcher).
 *
 * Consignes et « erreur à éviter » : BROUILLON à faire valider (kiné).
 * Elles reprennent les indications de la spec et des illustrations (public/illustrations/).
 */

export type Phase = 1 | 2 | 3 | 4;

export type Dose =
  /** n répétitions × tenue de x s, repos de y s ; éventuellement par position (lettres, niveaux) et en séries. */
  | {
      kind: 'holds';
      reps: number;
      hold: number;
      rest: number;
      sets?: number;
      setRest?: number;
      positions?: string[];
      positionLabel?: string;
      holdLabel?: string;
      restLabel?: string;
      note?: string;
    }
  /** n répétitions côté gauche, puis « change de côté ». hold = durée d'une répétition. */
  | { kind: 'perSide'; reps: number; hold: number; rest: number; sets?: number; setRest?: number; note?: string }
  /** Tenue simple de x s, × répétitions, × positions, × côtés. */
  | {
      kind: 'simpleHold';
      seconds: number;
      reps?: number;
      rest?: number;
      sides?: boolean;
      positions?: string[];
      note?: string;
    }
  /** n cycles inspire / expire, en séries. */
  | { kind: 'breaths'; cycles: number; inhale: number; exhale: number; sets?: number; setRest?: number; note?: string };

export interface Exercise {
  id: string;
  name: string;
  illustration: string;
  cues: string[];
  avoid: string;
  /** Dose par phase : la phase courante prend la dernière définie à son niveau ou en dessous. */
  doses: Partial<Record<Phase, Dose>> & { 1: Dose };
}

export const SET_REST = 30;

const ytwPhase1: Dose = {
  kind: 'holds',
  reps: 8,
  hold: 3,
  rest: 2,
  sets: 2,
  setRest: 10,
  positions: ['Y', 'T', 'W'],
  positionLabel: 'Lettre',
};

const cobraPhase1: Dose = { kind: 'holds', reps: 10, hold: 5, rest: 3, sets: 2, setRest: 5 };

export const EXERCISES: Record<string, Exercise> = {
  resp: {
    id: 'resp',
    name: 'Respiration 90/90, menton rentré',
    illustration: 'resp.svg',
    cues: [
      'Sur le dos, pieds à plat au mur, hanches et genoux à 90°.',
      'Nuque à plat, menton rentré.',
      'Inspire 4 s par le nez dans le haut du dos, expire 6 s.',
    ],
    avoid: 'Lever les épaules à l’inspiration.',
    doses: { 1: { kind: 'breaths', cycles: 5, inhale: 4, exhale: 6, sets: 2, setRest: 5 } },
  },
  rouleau: {
    id: 'rouleau',
    name: 'Extension sur rouleau',
    illustration: 'rouleau.svg',
    cues: [
      'Rouleau sous les omoplates, fesses au sol, mains derrière la tête.',
      'Bascule par-dessus le rouleau en expirant.',
      'Change de niveau en remontant le rouleau.',
    ],
    avoid: 'Cambrer le bas du dos : garde les côtes basses.',
    doses: {
      1: {
        kind: 'holds',
        reps: 5,
        hold: 3,
        rest: 2,
        positions: ['bas', 'milieu', 'haut'],
        positionLabel: 'Niveau',
        holdLabel: 'Étends',
      },
    },
  },
  openbook: {
    id: 'openbook',
    name: 'Open book',
    illustration: 'openbook.svg',
    cues: [
      'Allongé sur le côté, genoux pliés à 90°, bras tendus devant.',
      'Ouvre le bras du dessus vers l’arrière en suivant la main des yeux.',
      'Les genoux restent posés.',
    ],
    avoid: 'Décoller les genoux pour aller plus loin.',
    doses: { 1: { kind: 'perSide', reps: 8, hold: 2, rest: 2 } },
  },
  ytw: {
    id: 'ytw',
    name: 'Y-T-W à plat ventre',
    illustration: 'ytw.svg',
    cues: [
      'À plat ventre, front sur une serviette.',
      'Décolle les bras en dessinant la lettre, pouces vers le plafond.',
      'Épaules basses, omoplates vers le bas.',
    ],
    avoid: 'Cambrer ou hausser les épaules.',
    doses: {
      1: ytwPhase1,
      2: {
        ...ytwPhase1,
        reps: 12,
        hold: 5,
        note: 'Progression phase 2 : 12 par lettre, puis tenue 5 s, puis 0,5 kg.',
      },
    },
  },
  cobra: {
    id: 'cobra',
    name: 'Cobra thoracique',
    illustration: 'cobra.svg',
    cues: [
      'À plat ventre, bras le long du corps.',
      'Le sternum monte, le nombril reste au sol, regard au sol.',
      'Serre les omoplates.',
    ],
    avoid: 'Cambrer ou hausser les épaules.',
    doses: {
      1: cobraPhase1,
      2: { ...cobraPhase1, note: 'Objectif phase 2 : 2 × 10 bras tendus en Y.' },
    },
  },
  anges: {
    id: 'anges',
    name: 'Anges au mur',
    illustration: 'anges.svg',
    cues: [
      'Dos, tête et bras contre le mur.',
      'Bras en W, monte en Y en gardant le contact avec le mur.',
      'Redescends lentement en W.',
    ],
    avoid: 'Décoller le bas du dos du mur.',
    doses: { 1: { kind: 'holds', reps: 8, hold: 4, rest: 4, sets: 2, holdLabel: 'Monte', restLabel: 'Descends' } },
  },
  porte: {
    id: 'porte',
    name: 'Étirement à la porte',
    illustration: 'porte.svg',
    cues: [
      'Avant-bras contre le cadre, coude à hauteur d’épaule, puis vers 120°.',
      'Fais un pas en avant : le corps avance, l’épaule reste en arrière.',
      'Respire calmement.',
    ],
    avoid: 'Pousser jusqu’à la douleur ou cambrer.',
    doses: { 1: { kind: 'simpleHold', seconds: 30, rest: 5, sides: true, positions: ['coude à l’épaule', 'coude à 120°'] } },
  },
  elong: {
    id: 'elong',
    name: 'Auto-élongation debout',
    illustration: 'elong.svg',
    cues: [
      'Debout, pousse le sommet du crâne vers le plafond.',
      'Menton rentré, sternum haut, sans cambrer.',
      'Puis relâche d’environ 30 % et tiens cette hauteur en respirant.',
    ],
    avoid: 'Lever le menton.',
    doses: { 1: { kind: 'simpleHold', seconds: 20, reps: 5, rest: 5 } },
  },

  // Micro-séances bureau / télétravail
  B1: {
    id: 'B1',
    name: 'Extension sur le dossier',
    illustration: 'dossier.svg',
    cues: [
      'Bassin au fond du siège, dossier sous les omoplates, mains sur les cuisses.',
      'Le haut du dos passe par-dessus le dossier.',
      'Reviens lentement.',
    ],
    avoid: 'Mettre les mains derrière la tête.',
    doses: { 1: { kind: 'holds', reps: 5, hold: 3, rest: 2, holdLabel: 'Étends' } },
  },
  B2: {
    id: 'B2',
    name: 'Appui sur le bureau',
    illustration: 'bureau.svg',
    cues: [
      'Avant-bras posés sur le bureau, recule les pieds.',
      'Hanches au-dessus des pieds.',
      'En expirant, la poitrine descend entre les bras.',
    ],
    avoid: 'Creuser le bas du dos.',
    doses: { 1: { kind: 'holds', reps: 5, hold: 5, rest: 2 } },
  },
  B3: {
    id: 'B3',
    name: 'Menton rentré, omoplates dans les poches',
    illustration: 'menton.svg',
    cues: [
      'La tête recule : double menton, sans baisser la tête.',
      'Glisse les omoplates vers les poches arrière.',
      'Relâche entre deux.',
    ],
    avoid: 'Baisser la tête au lieu de la reculer.',
    doses: { 1: { kind: 'holds', reps: 8, hold: 5, rest: 2 } },
  },
  B4: {
    id: 'B4',
    name: 'Anges au mur',
    illustration: 'anges.svg',
    cues: [
      'Dos, tête et bras contre le mur.',
      'Bras en W, monte en Y en gardant le contact avec le mur.',
      'Redescends lentement en W.',
    ],
    avoid: 'Décoller le bas du dos du mur.',
    doses: { 1: { kind: 'holds', reps: 8, hold: 4, rest: 4, holdLabel: 'Monte', restLabel: 'Descends' } },
  },
  B5: {
    id: 'B5',
    name: 'Rotation assise',
    illustration: 'rotation.svg',
    cues: [
      'Assis droit, bras croisés sur la poitrine.',
      'Les épaules tournent, genoux et bassin restent fixes.',
      'Reviens au centre.',
    ],
    avoid: 'Tourner le bassin avec le buste.',
    doses: { 1: { kind: 'perSide', reps: 5, hold: 3, rest: 0 } },
  },
  B6: {
    id: 'B6',
    name: 'Étirement à la porte',
    illustration: 'porte.svg',
    cues: [
      'Avant-bras contre le cadre, coude à hauteur d’épaule, puis vers 120°.',
      'Fais un pas en avant : le corps avance, l’épaule reste en arrière.',
      'Respire calmement.',
    ],
    avoid: 'Pousser jusqu’à la douleur.',
    doses: { 1: { kind: 'simpleHold', seconds: 30, rest: 5, sides: true, positions: ['coude à l’épaule', 'coude à 120°'] } },
  },
  B7: {
    id: 'B7',
    name: 'Auto-élongation assise',
    illustration: 'elong.svg',
    cues: [
      'Assis, pousse le sommet du crâne vers le plafond.',
      'Menton rentré, sternum haut, sans cambrer.',
      'Puis relâche d’environ 30 % et tiens cette hauteur en respirant.',
    ],
    avoid: 'Lever le menton.',
    doses: { 1: { kind: 'simpleHold', seconds: 20 } },
  },
};

export function doseFor(ex: Exercise, phase: Phase): Dose {
  for (let p = phase; p >= 1; p--) {
    const d = ex.doses[p as Phase];
    if (d) return d;
  }
  return ex.doses[1];
}
