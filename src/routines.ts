import { doseFor, EXERCISES, type Dose, type Phase } from './exercises';

export type SessionType = 'maison' | 'maison-courte' | 'bureau' | 'teletravail';

export const SESSION_LABELS: Record<SessionType, string> = {
  maison: 'Routine maison complète',
  'maison-courte': 'Routine maison courte',
  bureau: 'Micro-séance bureau',
  teletravail: 'Micro-séance télétravail',
};

export interface PlanItem {
  exerciseId: string;
  dose: Dose;
  /** Secondes de mise en place avant l'exercice. */
  prep: number;
}

/** Mise en place : plus longue à la maison (changer de position au sol). */
const PREP: Record<SessionType, number> = { maison: 10, 'maison-courte': 10, bureau: 3, teletravail: 5 };

/** Rotation des familles pour la micro-séance télétravail. */
export interface RotationState {
  ext: number;
  ctrl: number;
  rot: number;
  /** Date (AAAA-MM-JJ) du dernier étirement à la porte B6 : une seule fois par jour. */
  lastPorte?: string;
}

export const INITIAL_ROTATION: RotationState = { ext: 0, ctrl: 0, rot: 0 };

export function buildPlan(
  type: SessionType,
  phase: Phase,
  rotation: RotationState = INITIAL_ROTATION,
  today = '',
): { items: PlanItem[]; rotation: RotationState } {
  const item = (id: string, override?: Partial<Dose>): PlanItem => {
    const base = doseFor(EXERCISES[id], phase);
    return { exerciseId: id, dose: { ...base, ...override } as Dose, prep: PREP[type] };
  };
  switch (type) {
    case 'maison':
      return {
        items: ['resp', 'rouleau', 'openbook', 'ytw', 'cobra', 'anges', 'porte', 'elong'].map((id) => item(id)),
        rotation,
      };
    case 'maison-courte':
      // Y-T-W et cobra ne sont jamais supprimés.
      return {
        items: [
          item('resp', { sets: 1 }),
          item('rouleau', { reps: 3 }),
          item('ytw', { sets: 1 }),
          item('cobra', { sets: 1 }),
          item('elong', { reps: 3 }),
        ],
        rotation,
      };
    case 'bureau':
      return { items: ['B3', 'B1', 'B5', 'B7'].map((id) => item(id)), rotation };
    case 'teletravail': {
      const ext = rotation.ext % 2 === 0 ? 'B1' : 'B2';
      const ctrl = rotation.ctrl % 2 === 0 ? 'B3' : 'B4';
      let rot = rotation.rot % 2 === 0 ? 'B5' : 'B6';
      if (rot === 'B6' && rotation.lastPorte === today) rot = 'B5';
      const next: RotationState = {
        ext: rotation.ext + 1,
        ctrl: rotation.ctrl + 1,
        rot: rotation.rot + 1,
        lastPorte: rot === 'B6' ? today : rotation.lastPorte,
      };
      return { items: [ext, ctrl, rot, 'B7'].map((id) => item(id)), rotation: next };
    }
  }
}
