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

let lastCancel = 0;

/**
 * Annonce vocale. Les annonces s'enchaînent dans l'ordre ; `interrupt` coupe d'abord
 * celle en cours (nouvel exercice). Juste après une coupure, Safari peut ignorer
 * l'annonce suivante : on la décale de 250 ms.
 */
export function speak(text: string, opts: { interrupt?: boolean } = {}) {
  if (!text || !('speechSynthesis' in window)) return;
  if (opts.interrupt && (speechSynthesis.speaking || speechSynthesis.pending)) stopSpeech();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  const v = frenchVoice();
  if (v) u.voice = v;
  const wait = 250 - (Date.now() - lastCancel);
  if (wait > 0) setTimeout(() => speechSynthesis.speak(u), wait);
  else speechSynthesis.speak(u);
}

export function stopSpeech() {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  lastCancel = Date.now();
}

export const isSpeaking = () => 'speechSynthesis' in window && (speechSynthesis.speaking || speechSynthesis.pending);

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
