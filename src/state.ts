import { kvGet, kvSet } from './db';
import type { Phase } from './exercises';
import { INITIAL_ROTATION, type RotationState } from './routines';
import { addDays, DEFAULT_PLANNING, DEFAULT_SCHEDULE, isoDate, type DayType, type Planning, type ScheduleSettings } from './schedule';

export interface Settings {
  phase: Phase;
  /** Début de la phase courante (AAAA-MM-JJ). */
  phaseStart: string;
  /** Proposition de phase suivante repoussée jusqu'à cette date. */
  phaseSnooze: string;
  /** Son en routine maison et en télétravail. */
  sound: boolean;
  /** Son pendant le set discret du bureau (coupé par défaut). */
  soundBureau: boolean;
  /** Annonces vocales (jamais pendant le set discret du bureau). */
  voice: boolean;
  planning: Planning;
  schedule: ScheduleSettings;
  overrides: Record<string, DayType>;
  protocolStart: string;
  rotation: RotationState;
}

/** Réglages en mémoire, chargés au démarrage. */
export const settings = {} as Settings;

export async function loadSettings() {
  const today = isoDate(new Date());
  const protocolStart = await kvGet('protocolStart', '');
  Object.assign(settings, {
    phase: await kvGet<Phase>('phase', 1),
    phaseStart: await kvGet('phaseStart', protocolStart || today),
    phaseSnooze: await kvGet('phaseSnooze', ''),
    sound: await kvGet('sound', true),
    soundBureau: await kvGet('soundBureau', false),
    voice: await kvGet('voice', true),
    planning: { ...DEFAULT_PLANNING, ...(await kvGet<Partial<Planning>>('planning', {})) },
    schedule: { ...DEFAULT_SCHEDULE, ...(await kvGet<Partial<ScheduleSettings>>('schedule', {})) },
    overrides: await kvGet<Record<string, DayType>>('overrides', {}),
    protocolStart: protocolStart || today,
    rotation: await kvGet<RotationState>('rotation', INITIAL_ROTATION),
  } satisfies Settings);
  if (!protocolStart) await kvSet('protocolStart', today);
}

export async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  settings[key] = value;
  await kvSet(key, value);
}

export async function setPhase(p: Phase) {
  await saveSetting('phase', p);
  await saveSetting('phaseStart', isoDate(new Date()));
  await saveSetting('phaseSnooze', '');
}

/** Type d'un jour précis (les exceptions de plus de 2 mois sont oubliées). */
export async function setOverride(date: string, t: DayType) {
  const limit = isoDate(addDays(new Date(), -62));
  const kept = Object.fromEntries(Object.entries(settings.overrides).filter(([d]) => d >= limit));
  await saveSetting('overrides', { ...kept, [date]: t });
}
