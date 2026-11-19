/** Temps écoulé calculé sur l'heure de début (reste juste après verrouillage de l'écran). */
export function elapsedSeconds(startMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - startMs) / 1000));
}
