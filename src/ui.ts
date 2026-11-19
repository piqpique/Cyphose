import { navigate, type View } from './router';

export const app = document.querySelector<HTMLDivElement>('#app')!;

export const esc = (t: string | number) =>
  String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const pad = (n: number) => String(n).padStart(2, '0');

export const fmtDuration = (sec: number) => (sec < 60 ? `${sec} s` : `${Math.floor(sec / 60)} min ${pad(sec % 60)} s`);
export const fmtMinutes = (sec: number) => (sec < 60 ? 'moins d’1 min' : `${Math.round(sec / 60)} min`);

const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const dayMonthFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
export const fmtDay = (d: Date | number) => dateFmt.format(d);
export const fmtDayMonth = (d: Date | number) => dayMonthFmt.format(d);
export const fmtTime = (ms: number) => {
  const d = new Date(ms);
  return `${d.getHours()}h${pad(d.getMinutes())}`;
};

export interface AskAction {
  id: string;
  label: string;
  /** Un seul « primary » par boîte ; « link » pour revenir en arrière. */
  style?: 'primary' | 'secondary' | 'link';
}

/** Boîte de dialogue modale. Renvoie l'id du bouton touché, ou null si fermée autrement. */
export function ask(opts: { title: string; text?: string; actions: AskAction[] }): Promise<string | null> {
  const d = document.createElement('dialog');
  d.className = 'sheet';
  d.innerHTML = `
    <h2>${esc(opts.title)}</h2>
    ${opts.text ? `<p>${esc(opts.text)}</p>` : ''}
    <div class="sheet-actions">
      ${opts.actions.map((a) => `<button data-id="${esc(a.id)}" class="${a.style ?? 'secondary'}">${esc(a.label)}</button>`).join('')}
    </div>`;
  document.body.append(d);
  return new Promise((resolve) => {
    d.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
      if (b) d.close(b.dataset.id);
      else if (e.target === d) d.close(''); // toucher en dehors de la boîte
    });
    d.addEventListener('close', () => {
      resolve(d.returnValue || null);
      d.remove();
    });
    d.showModal();
  });
}

let toastTimer = 0;
export function toast(text: string) {
  let el = document.querySelector<HTMLElement>('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), 3500);
}

/** Charte : pas de jeu d'icônes. Les onglets sont des libellés mono ; le point de repère marque l'onglet actif. */
const TABS: { view: View; label: string }[] = [
  { view: 'home', label: 'Accueil' },
  { view: 'history', label: 'Historique' },
  { view: 'settings', label: 'Réglages' },
];

/** Barre d'onglets du bas (absente pendant une séance). */
export function tabbar(active: View): string {
  return `<nav class="tabs" aria-label="Navigation">${TABS.map(
    (t) =>
      `<button data-nav="${t.view}" class="${t.view === active ? 'on' : ''}" ${t.view === active ? 'aria-current="page"' : ''}><span>${t.label}</span></button>`,
  ).join('')}</nav>`;
}

/** Le repère de marque (asset Marque/repere.svg) : ligne de mesure, deux embouts, point central, en ambre. */
export const repere = (width = 141) =>
  `<svg class="repere" viewBox="0 0 188 40" width="${width}" height="${Math.round((width * 40) / 188)}" aria-hidden="true"><path d="M6 8V32M182 8V32M6 20H182" stroke="#E08A2E" stroke-width="4" fill="none"/><circle cx="94" cy="20" r="9" fill="#E08A2E"/></svg>`;

export function bindTabs(root: ParentNode = app) {
  root.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.nav as View)),
  );
}
