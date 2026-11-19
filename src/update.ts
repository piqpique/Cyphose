import { registerSW } from 'virtual:pwa-register';

/**
 * Mises à jour de l'app. Le service worker se met à jour tout seul, mais la page
 * ne recharge jamais pendant une séance : le rechargement attend le retour à l'accueil.
 */
let registration: ServiceWorkerRegistration | undefined;
let pending = false;
let isBusy: () => boolean = () => false;

export function initUpdates(busy: () => boolean) {
  isBusy = busy;
  registerSW({
    immediate: true,
    onNeedReload() {
      if (isBusy()) pending = true;
      else location.reload();
    },
    onRegisteredSW(_url, reg) {
      registration = reg;
    },
  });
  // iOS vérifie rarement les mises à jour d'une app de l'écran d'accueil : on le fait au retour dans l'app.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') registration?.update().catch(() => {});
  });
}

/** Recharge si une mise à jour attendait. Renvoie true si la page va recharger. */
export function applyPendingUpdate(): boolean {
  if (!pending || isBusy()) return false;
  location.reload();
  return true;
}
