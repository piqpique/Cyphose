/** Son (Web Audio) et écran allumé (Wake Lock). Safari iOS ne gère pas la vibration. */

let ctx: AudioContext | null = null;

/** À appeler depuis un geste (toucher) : iOS n'autorise le son qu'après une interaction. */
export function unlockAudio() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  // Son muet pour débloquer la sortie audio sur iOS.
  beep(1, 0.01, 0);
}

export function beep(freq: number, dur = 0.12, volume = 0.25) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = 'sine';
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

let lock: WakeLockSentinel | null = null;
let wanted = false;

async function acquire() {
  try {
    lock = (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    lock = null;
  }
}

export async function keepAwake(on: boolean) {
  wanted = on;
  if (on) await acquire();
  else {
    await lock?.release().catch(() => {});
    lock = null;
  }
}

/** Le verrou est perdu quand l'app passe en arrière-plan : on le reprend au retour. */
document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible') acquire();
});

export const wakeLockSupported = () => 'wakeLock' in navigator;
