/**
 * Son (Web Audio), voix (synthèse vocale) et écran allumé (Wake Lock).
 * Safari iOS ne gère pas la vibration.
 */

let ctx: AudioContext | null = null;

/** À appeler pendant un toucher : iOS n'autorise le son qu'après une interaction. */
export function unlockAudio() {
  ctx ??= new AudioContext();
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  beep(1, 0.01, 0);
}

export function beep(freq: number, dur = 0.12, volume = 0.25) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = 'sine';
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(Math.max(volume, 0.0001), t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

let voice: SpeechSynthesisVoice | null | undefined;

function frenchVoice(): SpeechSynthesisVoice | null {
  if (voice !== undefined && voice !== null) return voice;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null; // pas encore chargées : la voix par défaut fera l'affaire
  voice = voices.find((v) => v.lang === 'fr-FR' && v.localService) ?? voices.find((v) => v.lang.startsWith('fr')) ?? null;
  return voice;
}

/** Annonce vocale courte. Les annonces s'enchaînent dans l'ordre. */
export function speak(text: string) {
  if (!text || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  const v = frenchVoice();
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

export function stopSpeech() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
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

/** Au retour dans l'app : iOS a relâché l'écran allumé et peut avoir suspendu le son. */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (wanted) acquire();
  if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
});
