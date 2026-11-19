import './style.css';
import { kvGet, requestPersistence, type SessionRecord } from './db';
import type { SessionType } from './routines';
import { currentView, navigate, registerView } from './router';
import { loadSettings } from './state';
import { app, esc } from './ui';
import { initUpdates } from './update';
import { renderHistory } from './views/history';
import { renderHome } from './views/home';
import { onVisibility, openSession, renderResume, sessionActive, type LiveSnapshot } from './views/player';
import { renderSettings } from './views/settings';

const SESSION_TYPES: SessionType[] = ['maison', 'maison-courte', 'bureau', 'teletravail'];

initUpdates(sessionActive);
requestPersistence();
registerView('home', renderHome);
registerView('history', renderHistory);
registerView('settings', renderSettings);

async function boot() {
  await loadSettings();

  // Lien d'un rappel : ?seance=bureau&origine=rappel
  const params = new URLSearchParams(location.search);
  const seance = params.get('seance') as SessionType | null;
  const origin: SessionRecord['origin'] = params.get('origine') === 'rappel' ? 'rappel' : 'manuelle';
  if (location.search) history.replaceState(null, '', location.pathname);
  const launch = () => (seance && SESSION_TYPES.includes(seance) ? openSession(seance, origin, false) : navigate('home'));

  // Séance interrompue (iOS a fermé l'app, ou mise à jour) : on propose de la reprendre.
  const snap = await kvGet<LiveSnapshot | null>('live', null);
  if (snap) return renderResume(snap, launch);
  return launch();
}

document.addEventListener('visibilitychange', () => {
  const visible = document.visibilityState === 'visible';
  if (sessionActive()) return onVisibility(visible);
  // Au retour, l'accueil se met à jour (jour, prochain créneau).
  if (visible && currentView() === 'home' && app.querySelector('main.home')) renderHome();
});

boot().catch((e) => {
  app.innerHTML = `<main><h1>Erreur</h1><pre>${esc(String(e))}</pre></main>`;
});
