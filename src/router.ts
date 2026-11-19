import { applyPendingUpdate } from './update';

export type View = 'home' | 'history' | 'settings';
type Renderer = () => void | Promise<void>;

const renderers = {} as Record<View, Renderer>;
let current: View = 'home';

export function registerView(v: View, r: Renderer) {
  renderers[v] = r;
}

export const currentView = () => current;

export async function navigate(v: View) {
  current = v;
  // Une nouvelle version attendait la fin de la séance : on l'applique maintenant.
  if (applyPendingUpdate()) return;
  window.scrollTo(0, 0);
  await renderers[v]();
}
