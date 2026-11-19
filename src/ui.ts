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
  style?: 'primary' | 'secondary' | 'danger';
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

const TABS: { view: View; label: string; icon: string }[] = [
  { view: 'home', label: 'Accueil', icon: '<path d="M4 11.5 12 5l8 6.5V20h-5.5v-5h-5v5H4z"/>' },
  { view: 'history', label: 'Historique', icon: '<path d="M5 20V11M12 20V5M19 20v-6"/>' },
  {
    view: 'settings',
    label: 'Réglages',
    icon: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  },
];

/** Barre d'onglets du bas (absente pendant une séance). */
export function tabbar(active: View): string {
  return `<nav class="tabs" aria-label="Navigation">${TABS.map(
    (t) =>
      `<button data-nav="${t.view}" class="${t.view === active ? 'on' : ''}" ${t.view === active ? 'aria-current="page"' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${t.icon}</svg><span>${t.label}</span></button>`,
  ).join('')}</nav>`;
}

export function bindTabs(root: ParentNode = app) {
  root.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.nav as View)),
  );
}
